import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { z } from "zod";
import { randomUUID, timingSafeEqual, createHmac } from "node:crypto";
import { certaintySchema } from "@raices/shared";
import { type Sql } from "./db.ts";
import { sharedTree } from "./shared-tree.ts";
import { ensureFamily, library, mergePeople, json } from "./store.ts";
import { cloud, saveAudio, deleteAudio, readAudio } from "./audio.ts";
import { aiConfigured, reviewClaim, searchSources, transcribe } from "./ai.ts";
import {
  deleteDocumentFile,
  readDocumentFile,
  saveDocumentFile,
  supportedDocuments,
  validDocumentFile,
} from "./documents.ts";
import {
  createAccount,
  createSession,
  publicUser,
  revokeSession,
  sessionUser,
  usernameKey,
  verifyPassword,
} from "./auth.ts";
const uuid = z.uuid();
const credentials = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[\p{L}\p{N}_.-]+$/u),
  password: z.string().min(8).max(200),
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 5 },
});
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 3 },
});
const safeEquals = (a: string, b: string) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createApp(db: Sql) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const origins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:8081"
  ).split(",");
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: "100kb" }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
  const signingSecret = randomUUID();
  const signature = (id: string, expires: string) =>
    createHmac("sha256", signingSecret)
      .update(`${id}:${expires}`)
      .digest("hex");
  app.get("/health", (_req, res) =>
    res.json({
      ok: true,
      aiConfigured: aiConfigured(),
      storage: cloud ? "supabase" : "local",
    }),
  );
  // Short-lived bearer capability for audio players that cannot set Authorization headers.
  app.get("/audio/:id", async (req, res) => {
    const { expires, sig } = req.query;
    if (
      typeof expires !== "string" ||
      typeof sig !== "string" ||
      !/^\d+$/.test(expires) ||
      Number(expires) < Date.now() ||
      !safeEquals(sig, signature(req.params.id as string, expires))
    )
      return res.sendStatus(403);
    const [c] = await db.all("SELECT * FROM conversations WHERE id=?", [
      req.params.id,
    ]);
    if (!c) return res.sendStatus(404);
    res.setHeader("Cache-Control", "private, no-store");
    res.type(c.mime_type).send(await readAudio(c.audio_path));
  });
  app.get("/document-file/:id", async (req, res) => {
    const { expires, sig } = req.query;
    if (
      typeof expires !== "string" ||
      typeof sig !== "string" ||
      !/^\d+$/.test(expires) ||
      Number(expires) < Date.now() ||
      !safeEquals(sig, signature(`document:${req.params.id}`, expires))
    )
      return res.sendStatus(403);
    const [doc] = await db.all("SELECT * FROM documents WHERE id=?", [
      req.params.id,
    ]);
    if (!doc) return res.sendStatus(404);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${doc.id}.${doc.mime_type === "application/pdf" ? "pdf" : doc.mime_type.split("/")[1]}"`,
    );
    res.type(doc.mime_type).send(await readDocumentFile(doc.storage_path));
  });
  const authLimit = rateLimit({ windowMs: 60_000, limit: 10 });
  app.get("/auth/username-available", authLimit, async (req, res) => {
    const result = credentials.shape.username.safeParse(req.query.username);
    if (!result.success)
      return res.status(400).json({
        error:
          "El nombre debe tener entre 3 y 40 caracteres y usar letras, números, puntos, guiones o guion bajo",
      });
    const [existing] = await db.all(
      "SELECT id FROM app_users WHERE username_key=?",
      [usernameKey(result.data)],
    );
    res.json({ available: !existing });
  });
  app.post("/auth/register", authLimit, async (req, res) => {
    const result = credentials.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({
        error:
          "Introduce un nombre válido y una contraseña de al menos 8 caracteres",
      });
    const user = await createAccount(
      db,
      result.data.username,
      result.data.password,
    );
    if (!user)
      return res
        .status(409)
        .json({ error: "Ese nombre de usuario ya está seleccionado" });
    const token = await createSession(db, user.id);
    res.status(201).json({ user, token });
  });
  app.post("/auth/login", authLimit, async (req, res) => {
    const result = credentials.safeParse(req.body);
    if (!result.success)
      return res
        .status(400)
        .json({ error: "Nombre de usuario o contraseña incorrectos" });
    const [user] = await db.all(
      "SELECT * FROM app_users WHERE username_key=?",
      [usernameKey(result.data.username)],
    );
    if (
      !user ||
      !(await verifyPassword(result.data.password, user.password_hash))
    )
      return res
        .status(401)
        .json({ error: "Nombre de usuario o contraseña incorrectos" });
    const token = await createSession(db, user.id);
    res.json({ user: publicUser(user), token });
  });
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace(/^Bearer /, "") || "";
    const account = await sessionUser(db, token);
    if (account) {
      res.locals.userId = account.id;
      res.locals.account = account;
    } else if (cloud && token.split(".").length === 3) {
      const { data, error } = await cloud.auth.getUser(token);
      if (!error && data.user) res.locals.userId = data.user.id;
    }
    if (!res.locals.userId)
      return res
        .status(401)
        .json({ error: "Inicia sesión para acceder a tus recuerdos" });
    res.locals.familyId = await ensureFamily(
      db,
      res.locals.userId,
      res.locals.account ? "app" : "legacy",
    );
    next();
  });
  app.get("/auth/me", (_req, res) => {
    if (!res.locals.account) return res.sendStatus(401);
    res.json({ user: res.locals.account });
  });
  app.post("/auth/logout", async (req, res) => {
    await revokeSession(
      db,
      req.headers.authorization?.replace(/^Bearer /, "") || "",
    );
    res.json({ ok: true });
  });
  // Profiles and invitations use app accounts only; no library is shared by a request.
  app.get("/profile", async (_req, res) => {
    if (!res.locals.account) return res.sendStatus(403);
    const [p] = await db.all("SELECT * FROM account_profiles WHERE user_id=?", [
      res.locals.userId,
    ]);
    res.json({
      profile: p
        ? {
            firstName: p.first_name,
            surname1: p.surname1,
            surname2: p.surname2,
            discoverable: Boolean(p.discoverable),
          }
        : null,
    });
  });
  app.put("/profile", async (req, res) => {
    if (!res.locals.account) return res.sendStatus(403);
    const name = z.string().trim().min(1).max(80);
    const p = z
      .object({
        firstName: name,
        surname1: name,
        surname2: name,
        discoverable: z.boolean(),
      })
      .parse(req.body);
    await db.all(
      "INSERT INTO account_profiles(user_id,first_name,surname1,surname2,discoverable) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name,surname1=excluded.surname1,surname2=excluded.surname2,discoverable=excluded.discoverable",
      [
        res.locals.userId,
        p.firstName,
        p.surname1,
        p.surname2,
        p.discoverable ? 1 : 0,
      ],
    );
    res.json({ profile: p });
  });
  app.get(
    "/account-search",
    rateLimit({ windowMs: 60_000, limit: 20 }),
    async (req, res) => {
      if (!res.locals.account) return res.sendStatus(403);
      const [own] = await db.all(
        "SELECT user_id FROM account_profiles WHERE user_id=?",
        [res.locals.userId],
      );
      if (!own)
        return res
          .status(403)
          .json({ error: "Completa tu perfil antes de buscar familiares" });
      const query = z
        .string()
        .trim()
        .min(3)
        .max(120)
        .parse(req.query.q)
        .toLocaleLowerCase("es");
      // Match complete names or exact usernames. A name is never an identity match.
      const rows = await db.all(
        "SELECT u.id,u.username,p.first_name,p.surname1,p.surname2 FROM app_users u JOIN account_profiles p ON p.user_id=u.id WHERE p.discoverable=1 AND u.id<>?",
        [res.locals.userId],
      );
      const matches = rows
        .filter(
          (r) =>
            r.username.toLocaleLowerCase("es") === query ||
            `${r.first_name} ${r.surname1} ${r.surname2}`.toLocaleLowerCase(
              "es",
            ) === query,
        )
        .slice(0, 20)
        .map((r) => ({
          id: r.id,
          username: r.username,
          name: `${r.first_name} ${r.surname1} ${r.surname2}`,
        }));
      res.json({ matches });
    },
  );
  app.get("/family-links", async (_req, res) => {
    if (!res.locals.account) return res.sendStatus(403);
    const rows = await db.all(
      "SELECT r.*,s.username AS sender_username,t.username AS recipient_username,p.name AS person_name FROM family_link_requests r JOIN app_users s ON s.id=r.sender_id JOIN app_users t ON t.id=r.recipient_id JOIN people p ON p.id=r.person_id WHERE r.sender_id=? OR r.recipient_id=? ORDER BY r.created_at DESC",
      [res.locals.userId, res.locals.userId],
    );
    res.json({
      requests: rows.map((r) => ({
        id: r.id,
        senderId: r.sender_id,
        senderUsername: r.sender_username,
        recipientUsername: r.recipient_username,
        personName: r.person_name,
        relationship: r.relationship,
        status: r.status,
        incoming: r.recipient_id === res.locals.userId,
      })),
    });
  });
  app.post("/family-links", async (req, res) => {
    if (!res.locals.account) return res.sendStatus(403);
    const input = z
      .object({
        recipientId: uuid,
        personId: uuid,
        relationship: z.string().trim().min(1).max(80),
      })
      .parse(req.body);
    if (input.recipientId === res.locals.userId) return res.sendStatus(400);
    const [profile] = await db.all(
      "SELECT user_id FROM account_profiles WHERE user_id=?",
      [res.locals.userId],
    );
    const [target] = await db.all(
      "SELECT user_id FROM account_profiles WHERE user_id=? AND discoverable=1",
      [input.recipientId],
    );
    const [person] = await db.all(
      "SELECT id FROM people WHERE id=? AND family_id=?",
      [input.personId, res.locals.familyId],
    );
    if (!profile || !target || !person)
      return res
        .status(404)
        .json({ error: "No se encuentra el perfil o la persona seleccionada" });
    const [existing] = await db.all(
      "SELECT id FROM family_link_requests WHERE sender_id=? AND recipient_id=? AND status IN ('pending','accepted')",
      [res.locals.userId, input.recipientId],
    );
    if (existing)
      return res.status(409).json({
        error: "Ya existe una solicitud o vinculación con esa cuenta",
      });
    await db.all(
      "INSERT INTO family_link_requests(id,sender_id,recipient_id,person_id,relationship,status,created_at) VALUES(?,?,?,?,?,'pending',?)",
      [
        randomUUID(),
        res.locals.userId,
        input.recipientId,
        input.personId,
        input.relationship,
        new Date().toISOString(),
      ],
    );
    res.status(201).json({ ok: true });
  });
  app.post("/family-links/:id/respond", async (req, res) => {
    if (!res.locals.account) return res.sendStatus(403);
    const { decision } = z
      .object({ decision: z.enum(["accepted", "rejected"]) })
      .parse(req.body);
    const changed = await db.all(
      "UPDATE family_link_requests SET status=? WHERE id=? AND recipient_id=? AND status='pending' RETURNING id",
      [decision, uuid.parse(req.params.id), res.locals.userId],
    );
    if (!changed.length) return res.sendStatus(404);
    res.json({ ok: true });
  });
  app.get("/shared-tree", async (_req, res) => {
    if (!res.locals.account) return res.sendStatus(403);
    res.json(await sharedTree(db, res.locals.userId));
  });
  app.get("/shared-tree/mine", async (_req, res) => {
    if (!res.locals.account) return res.sendStatus(403);
    const rows = await db.all(
      "SELECT person_id FROM shared_tree_people WHERE user_id=?",
      [res.locals.userId],
    );
    res.json({ personIds: rows.map((row) => row.person_id) });
  });
  app.put("/shared-tree/people/:id", async (req, res) => {
    if (!res.locals.account) return res.sendStatus(403);
    const personId = uuid.parse(req.params.id);
    const { shared } = z.object({ shared: z.boolean() }).parse(req.body);
    const [person] = await db.all(
      "SELECT id FROM people WHERE id=? AND family_id=?",
      [personId, res.locals.familyId],
    );
    if (!person) return res.sendStatus(404);
    if (shared)
      await db.all(
        "INSERT INTO shared_tree_people(user_id,person_id) VALUES(?,?) ON CONFLICT(user_id,person_id) DO NOTHING",
        [res.locals.userId, personId],
      );
    else
      await db.all(
        "DELETE FROM shared_tree_people WHERE user_id=? AND person_id=?",
        [res.locals.userId, personId],
      );
    res.json({ ok: true });
  });
  app.get("/library", async (_req, res) =>
    res.json(await library(db, res.locals.familyId)),
  );
  app.post(
    "/documents",
    rateLimit({ windowMs: 60_000, limit: 10 }),
    documentUpload.single("file"),
    async (req, res) => {
      if (!req.file)
        return res
          .status(400)
          .json({ error: "Selecciona un PDF o una imagen" });
      const mime = req.file.mimetype;
      if (
        !supportedDocuments.includes(mime) ||
        !validDocumentFile(req.file.buffer, mime)
      )
        return res
          .status(400)
          .json({ error: "Usa un PDF, JPG, PNG o WebP válido" });
      const title = z.string().trim().min(1).max(180).parse(req.body.title);
      const kind = z
        .string()
        .trim()
        .min(1)
        .max(80)
        .parse(req.body.kind || "Documento familiar");
      const id = randomUUID();
      const family = res.locals.familyId;
      const path = `${family}/${id}`;
      await saveDocumentFile(path, req.file.buffer, mime);
      try {
        await db.transaction(async (tx) => {
          await tx.all(
            "INSERT INTO documents(id,family_id,title,kind,file_name,mime_type,storage_path,created_at,status) VALUES(?,?,?,?,?,?,?,?,?)",
            [
              id,
              family,
              title,
              kind,
              req.file!.originalname.slice(0, 180),
              mime,
              path,
              new Date().toISOString(),
              "queued",
            ],
          );
          await tx.all(
            "INSERT INTO document_processing_jobs(id,document_id,available_at) VALUES(?,?,?)",
            [randomUUID(), id, new Date().toISOString()],
          );
        });
      } catch (error) {
        await deleteDocumentFile(path);
        throw error;
      }
      res.status(201).json({ id, status: "queued" });
    },
  );
  const document = async (id: string, family: string) =>
    (
      await db.all("SELECT * FROM documents WHERE id=? AND family_id=?", [
        id,
        family,
      ])
    )[0];
  app.get("/documents/:id/file-url", async (req, res) => {
    const doc = await document(req.params.id as string, res.locals.familyId);
    if (!doc) return res.sendStatus(404);
    if (cloud) {
      const { data, error } = await cloud.storage
        .from("family-documents")
        .createSignedUrl(doc.storage_path, 600);
      if (error) throw error;
      return res.json({ url: data.signedUrl });
    }
    const expires = String(Date.now() + 600_000);
    res.json({
      url: `/document-file/${doc.id}?expires=${expires}&sig=${signature(`document:${doc.id}`, expires)}`,
    });
  });
  app.post("/documents/:id/retry", async (req, res) => {
    const doc = await document(req.params.id as string, res.locals.familyId);
    if (!doc) return res.sendStatus(404);
    if (doc.status !== "failed")
      return res
        .status(409)
        .json({ error: "El documento no está pendiente de reintento" });
    await db.transaction(async (tx) => {
      await tx.all(
        "UPDATE document_processing_jobs SET status='queued',attempts=0,error=NULL,available_at=? WHERE document_id=?",
        [new Date().toISOString(), doc.id],
      );
      await tx.all(
        "UPDATE documents SET status='queued',error=NULL WHERE id=?",
        [doc.id],
      );
    });
    res.json({ ok: true });
  });
  app.delete("/documents/:id", async (req, res) => {
    const doc = await document(req.params.id as string, res.locals.familyId);
    if (!doc) return res.sendStatus(404);
    if (["reading", "extracting"].includes(doc.status))
      return res
        .status(409)
        .json({ error: "Espera a que termine el procesamiento" });
    await deleteDocumentFile(doc.storage_path);
    await db.all("DELETE FROM documents WHERE id=?", [doc.id]);
    res.json({ ok: true });
  });
  app.get("/export", async (_req, res) => {
    res.attachment("raices-recuerdos.json");
    res.json({
      ...(await library(db, res.locals.familyId)),
      exportedAt: new Date().toISOString(),
    });
  });
  app.post(
    "/conversations",
    rateLimit({ windowMs: 60_000, limit: 10 }),
    upload.single("audio"),
    async (req, res) => {
      const id = uuid.parse(req.body.id);
      const family = res.locals.familyId;
      const [existing] = await db.all(
        "SELECT * FROM conversations WHERE id=?",
        [id],
      );
      if (existing) {
        if (existing.family_id !== family) return res.sendStatus(404);
        return res.json({ id, status: existing.status });
      }
      if (!req.file)
        return res.status(400).json({ error: "Falta el archivo de audio" });
      const title = z
        .string()
        .trim()
        .min(1)
        .max(180)
        .parse(req.body.title || "Una conversación familiar");
      const duration = z.coerce
        .number()
        .min(0)
        .max(14400)
        .parse(req.body.duration || 0);
      const bookmarks = z
        .array(z.number().nonnegative())
        .max(100)
        .parse(JSON.parse(req.body.bookmarks || "[]"));
      const mime = req.file.mimetype;
      if (
        ![
          "audio/mp4",
          "audio/m4a",
          "audio/x-m4a",
          "audio/mpeg",
          "audio/mp3",
          "audio/wav",
          "audio/x-wav",
          "audio/webm",
          "audio/ogg",
          "audio/flac",
          "audio/x-flac",
          "audio/aac",
          "audio/x-caf",
          "audio/3gpp",
          "video/webm",
          "video/mp4",
          "application/octet-stream",
        ].includes(mime)
      )
        return res
          .status(400)
          .json({ error: "Formato de audio no compatible" });
      const path = `${family}/${id}`;
      await saveAudio(path, req.file.buffer, mime);
      try {
        await db.transaction(async (tx) => {
          await tx.all(
            "INSERT INTO conversations(id,family_id,title,created_at,duration,status,audio_path,mime_type,bookmarks) VALUES(?,?,?,?,?,?,?,?,?)",
            [
              id,
              family,
              title,
              new Date().toISOString(),
              duration,
              "queued",
              path,
              mime,
              json(bookmarks),
            ],
          );
          await tx.all(
            "INSERT INTO processing_jobs(id,conversation_id,available_at) VALUES(?,?,?)",
            [randomUUID(), id, new Date().toISOString()],
          );
        });
      } catch (error) {
        await deleteAudio(path);
        throw error;
      }
      res.status(201).json({ id, status: "queued" });
    },
  );
  const conversation = async (id: string, family: string) =>
    (
      await db.all("SELECT * FROM conversations WHERE id=? AND family_id=?", [
        id,
        family,
      ])
    )[0];
  app.patch("/conversations/:id", async (req, res) => {
    const c = await conversation(req.params.id as string, res.locals.familyId);
    if (!c) return res.sendStatus(404);
    const title = z.string().trim().min(1).max(180).parse(req.body.title);
    await db.all("UPDATE conversations SET title=? WHERE id=?", [title, c.id]);
    res.json({ ok: true });
  });
  app.post("/conversations/:id/retry", async (req, res) => {
    const c = await conversation(req.params.id as string, res.locals.familyId);
    if (!c) return res.sendStatus(404);
    if (!["failed", "queued"].includes(c.status))
      return res
        .status(409)
        .json({ error: "La conversación ya se está procesando o está lista" });
    await db.transaction(async (tx) => {
      await tx.all(
        "UPDATE processing_jobs SET status='queued',attempts=0,error=NULL,available_at=? WHERE conversation_id=?",
        [new Date().toISOString(), c.id],
      );
      await tx.all(
        "UPDATE conversations SET status='queued',error=NULL WHERE id=?",
        [c.id],
      );
    });
    res.json({ ok: true });
  });
  app.get("/conversations/:id/audio-url", async (req, res) => {
    const c = await conversation(req.params.id as string, res.locals.familyId);
    if (!c) return res.sendStatus(404);
    if (cloud) {
      const { data, error } = await cloud.storage
        .from("family-audio")
        .createSignedUrl(c.audio_path, 600);
      if (error) throw error;
      return res.json({ url: data.signedUrl });
    }
    const expires = String(Date.now() + 600_000);
    res.json({
      url: `/audio/${c.id}?expires=${expires}&sig=${signature(c.id, expires)}`,
    });
  });
  app.delete("/conversations/:id", async (req, res) => {
    const c = await conversation(req.params.id as string, res.locals.familyId);
    if (!c) return res.sendStatus(404);
    if (["transcribing", "extracting"].includes(c.status))
      return res.status(409).json({
        error: "Espera a que termine el procesamiento para eliminarlo",
      });
    await deleteAudio(c.audio_path);
    await db.all("DELETE FROM conversations WHERE id=?", [c.id]);
    res.json({ ok: true });
  });
  app.get("/people/:id/sources", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const family = res.locals.familyId;
    const [person] = await db.all(
      "SELECT id FROM people WHERE id=? AND family_id=?",
      [id, family],
    );
    if (!person) return res.sendStatus(404);
    const rows = await db.all(
      "SELECT id,query,result,created_at FROM person_source_searches WHERE person_id=? AND family_id=? ORDER BY created_at DESC LIMIT 20",
      [id, family],
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        query: row.query,
        createdAt: row.created_at,
        ...JSON.parse(row.result),
      })),
    );
  });
  app.post(
    "/people/:id/sources",
    rateLimit({
      windowMs: 60 * 60_000,
      limit: 10,
      keyGenerator: (_req, res) => res.locals.familyId,
      message: {
        error:
          "Has alcanzado el límite de búsquedas por hora. Vuelve a intentarlo más tarde.",
      },
    }),
    async (req, res) => {
      const id = uuid.parse(req.params.id);
      const family = res.locals.familyId;
      const { query } = z
        .object({ query: z.string().trim().min(5).max(500) })
        .parse(req.body);
      const [person] = await db.all(
        "SELECT id FROM people WHERE id=? AND family_id=?",
        [id, family],
      );
      if (!person) return res.sendStatus(404);
      if (!process.env.OPENAI_API_KEY)
        return res
          .status(503)
          .json({ error: "La búsqueda de fuentes no está configurada" });
      const result = await searchSources(query);
      const search = {
        id: randomUUID(),
        query,
        createdAt: new Date().toISOString(),
        ...result,
      };
      await db.all(
        "INSERT INTO person_source_searches(id,family_id,person_id,query,result,created_at) VALUES(?,?,?,?,?,?)",
        [
          search.id,
          family,
          id,
          query,
          JSON.stringify(result),
          search.createdAt,
        ],
      );
      res.status(201).json(search);
    },
  );
  app.post("/conversations/:id/correct", async (req, res) => {
    const input = z
      .object({
        from: z.string().trim().min(1).max(200),
        to: z.string().trim().min(1).max(200),
        kind: z.enum(["transcription", "interpretation"]),
      })
      .parse(req.body);
    const family = res.locals.familyId;
    const id = uuid.parse(req.params.id);
    const [conversation] = await db.all(
      "SELECT id, status FROM conversations WHERE id=? AND family_id=?",
      [id, family],
    );
    if (!conversation) return res.sendStatus(404);
    if (conversation.status !== "ready")
      return res
        .status(409)
        .json({ error: "Espera a que termine el procesamiento" });
    if (input.from === input.to)
      return res.status(400).json({ error: "Los textos son iguales" });
    await db.transaction(async (tx) => {
      const replace = async (
        table: string,
        column: string,
        scope: string,
        values: unknown[],
      ) => {
        await tx.all(
          `UPDATE ${table} SET ${column}=replace(${column}, ?, ?) WHERE ${scope}`,
          [input.from, input.to, ...values],
        );
      };
      if (input.kind === "transcription") {
        // Explicitly requested spelling corrections apply to the whole family library.
        await replace("people", "name", "family_id=?", [family]);
        for (const column of ["title", "summary"])
          await replace("conversations", column, "family_id=?", [family]);
        for (const column of ["text"])
          await replace(
            "segments",
            column,
            "conversation_id IN (SELECT id FROM conversations WHERE family_id=?)",
            [family],
          );
        for (const column of ["quote", "statement"])
          await replace(
            "claims",
            column,
            "conversation_id IN (SELECT id FROM conversations WHERE family_id=?)",
            [family],
          );
        for (const column of ["description", "place"])
          await replace(
            "events",
            column,
            "conversation_id IN (SELECT id FROM conversations WHERE family_id=?)",
            [family],
          );
        for (const column of ["title", "summary", "extracted_text"])
          await replace("documents", column, "family_id=?", [family]);
        for (const column of ["quote", "statement"])
          await replace(
            "document_claims",
            column,
            "document_id IN (SELECT id FROM documents WHERE family_id=?)",
            [family],
          );
        for (const column of ["description", "place"])
          await replace(
            "document_events",
            column,
            "document_id IN (SELECT id FROM documents WHERE family_id=?)",
            [family],
          );
      } else {
        // Interpretation corrections leave the source transcript and quotations intact.
        await replace("conversations", "summary", "id=? AND family_id=?", [
          id,
          family,
        ]);
        await replace("claims", "statement", "conversation_id=?", [id]);
        await replace("events", "description", "conversation_id=?", [id]);
        await replace(
          "relationships",
          "type",
          "family_id=? AND claim_id IN (SELECT id FROM claims WHERE conversation_id=?)",
          [family, id],
        );
      }
    });
    res.json({ ok: true });
  });
  app.post(
    "/review/transcribe",
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }).single("audio"),
    async (req, res) => {
      if (!req.file)
        return res.status(400).json({ error: "Falta la grabación" });
      if (!["audio/webm", "audio/mp4", "audio/m4a"].includes(req.file.mimetype))
        return res
          .status(400)
          .json({ error: "Formato de audio no compatible" });
      const segments = await transcribe(req.file.buffer, req.file.mimetype);
      res.json({ text: segments.map((segment) => segment.text).join(" ") });
    },
  );
  app.post("/claims/:id/review", async (req, res) => {
    const input = z
      .object({
        answer: z.string().trim().min(1).max(2000),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              text: z.string().max(2000),
            }),
          )
          .max(12),
      })
      .parse(req.body);
    const [claim] = await db.all(
      "SELECT cl.* FROM claims cl JOIN conversations c ON c.id=cl.conversation_id WHERE cl.id=? AND c.family_id=?",
      [uuid.parse(req.params.id), res.locals.familyId],
    );
    if (!claim) return res.sendStatus(404);
    const relations = await db.all(
      "SELECT id,type FROM relationships WHERE family_id=? AND claim_id=?",
      [res.locals.familyId, claim.id],
    );
    const relation = relations.length === 1 ? relations[0] : null;
    const result = await reviewClaim({
      statement: claim.statement,
      quote: claim.quote,
      relationshipType: relation?.type || null,
      ...input,
    });
    res.json({
      ...result,
      relationshipId: relation?.id || null,
      originalStatement: claim.statement,
    });
  });
  app.post("/claims/:id/review/apply", async (req, res) => {
    const input = z
      .object({
        originalStatement: z.string().min(1).max(2000),
        statement: z.string().trim().min(1).max(2000),
        relationshipId: z.string().uuid().nullable(),
        relationshipType: z.string().trim().min(1).max(100).nullable(),
      })
      .parse(req.body);
    const claimId = uuid.parse(req.params.id);
    const family = res.locals.familyId;
    const result = await db.transaction(async (tx) => {
      const [claim] = await tx.all(
        "SELECT cl.* FROM claims cl JOIN conversations c ON c.id=cl.conversation_id WHERE cl.id=? AND c.family_id=?",
        [claimId, family],
      );
      if (!claim) return "missing";
      if (
        claim.statement !== input.originalStatement ||
        claim.certainty === "confirmed"
      )
        return "changed";
      if (input.relationshipType) {
        if (!input.relationshipId) return "changed";
        const relations = await tx.all(
          "SELECT id FROM relationships WHERE id=? AND claim_id=? AND family_id=?",
          [input.relationshipId, claimId, family],
        );
        if (relations.length !== 1) return "changed";
        await tx.all(
          "UPDATE relationships SET type=? WHERE id=? AND family_id=?",
          [input.relationshipType, input.relationshipId, family],
        );
      }
      await tx.all(
        "UPDATE claims SET statement=?,certainty='confirmed' WHERE id=?",
        [input.statement, claimId],
      );
      return "ok";
    });
    if (result === "missing") return res.sendStatus(404);
    if (result === "changed")
      return res
        .status(409)
        .json({ error: "El dato cambió. Actualízalo antes de continuar." });
    res.json({ ok: true });
  });
  app.patch("/claims/:id", async (req, res) => {
    const input = z
      .object({
        certainty: certaintySchema.optional(),
        statement: z.string().trim().min(1).max(2000).optional(),
      })
      .refine(
        (value) =>
          value.certainty !== undefined || value.statement !== undefined,
      )
      .parse(req.body);
    const [claim] = await db.all(
      "SELECT cl.* FROM claims cl JOIN conversations c ON c.id=cl.conversation_id WHERE cl.id=? AND c.family_id=?",
      [req.params.id, res.locals.familyId],
    );
    if (!claim) return res.sendStatus(404);
    await db.all("UPDATE claims SET certainty=?, statement=? WHERE id=?", [
      input.certainty ??
        (input.statement !== undefined ? "pending" : claim.certainty),
      input.statement ?? claim.statement,
      claim.id,
    ]);
    res.json({ ok: true });
  });
  app.post("/people/:id/merge", async (req, res) => {
    await mergePeople(
      db,
      res.locals.familyId,
      uuid.parse(req.params.id),
      uuid.parse(req.body.targetId),
    );
    res.json({ ok: true });
  });
  app.post("/people/:id/distinct", async (req, res) => {
    const result = await db.all(
      "UPDATE people SET candidate_ids='[]' WHERE id=? AND family_id=? RETURNING id",
      [uuid.parse(req.params.id), res.locals.familyId],
    );
    if (!result.length) return res.sendStatus(404);
    res.json({ ok: true });
  });
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return res
          .status(400)
          .json({ error: "Los datos enviados no son válidos" });
      if (error instanceof multer.MulterError)
        return res.status(413).json({
          error:
            "Archivo demasiado grande o demasiados archivos (documentos: 20 MB; audio: 100 MB)",
        });
      console.error("Error interno del API (detalles privados omitidos).");
      res.status(500).json({ error: "No se pudo completar la operación" });
    },
  );
  return app;
}
