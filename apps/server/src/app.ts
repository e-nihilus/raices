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
import { ensureFamily, library, mergePeople, json } from "./store.ts";
import { cloud, saveAudio, deleteAudio, readAudio } from "./audio.ts";
const uuid = z.uuid();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 5 },
});
const safeEquals = (a: string, b: string) =>
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createApp(db: Sql) {
  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const origins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:8081"
  ).split(",");
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: "100kb" }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120 }));
  const signingSecret = process.env.DEV_API_TOKEN || randomUUID();
  const signature = (id: string, expires: string) =>
    createHmac("sha256", signingSecret)
      .update(`${id}:${expires}`)
      .digest("hex");
  app.get("/health", (_req, res) =>
    res.json({
      ok: true,
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
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
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace(/^Bearer /, "") || "";
    if (
      process.env.NODE_ENV !== "production" &&
      !process.env.DATABASE_URL &&
      process.env.DEV_API_TOKEN &&
      safeEquals(token, process.env.DEV_API_TOKEN)
    )
      res.locals.userId = "local-development";
    else if (cloud && token) {
      const { data, error } = await cloud.auth.getUser(token);
      if (!error && data.user) res.locals.userId = data.user.id;
    }
    if (!res.locals.userId)
      return res
        .status(401)
        .json({ error: "Inicia sesión para acceder a tus recuerdos" });
    res.locals.familyId = await ensureFamily(db, res.locals.userId);
    next();
  });
  app.get("/library", async (_req, res) =>
    res.json(await library(db, res.locals.familyId)),
  );
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
  app.patch("/claims/:id", async (req, res) => {
    const certainty = certaintySchema.parse(req.body.certainty);
    const [claim] = await db.all(
      "SELECT cl.* FROM claims cl JOIN conversations c ON c.id=cl.conversation_id WHERE cl.id=? AND c.family_id=?",
      [req.params.id, res.locals.familyId],
    );
    if (!claim) return res.sendStatus(404);
    await db.all("UPDATE claims SET certainty=? WHERE id=?", [
      certainty,
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
        return res
          .status(413)
          .json({ error: "Sube un único archivo de audio de menos de 100 MB" });
      console.error("Error interno del API (detalles privados omitidos).");
      res.status(500).json({ error: "No se pudo completar la operación" });
    },
  );
  return app;
}
