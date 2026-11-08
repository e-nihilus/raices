import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  identityCandidates,
  normalizeName,
  type Extraction,
} from "@raices/shared";
import { cloud } from "./audio.ts";
import { dataDir, type Sql } from "./db.ts";
import { extractDocumentFacts, readDocumentText } from "./document-ai.ts";
import { json, personFrom } from "./store.ts";

const directory = join(dataDir, "documents");
export const supportedDocuments = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
function surnameCandidates(
  name: string,
  people: ReturnType<typeof personFrom>[],
) {
  const tokens = normalizeName(name).split(" ");
  if (tokens.length < 3) return [];
  const surnames = tokens.slice(-2).join(" ");
  return people.filter((person) =>
    [person.name, ...person.aliases].some((alias) => {
      const parts = normalizeName(alias).split(" ");
      return parts.length >= 3 && parts.slice(-2).join(" ") === surnames;
    }),
  );
}
export function validDocumentFile(buffer: Buffer, mime: string) {
  if (mime === "application/pdf")
    return buffer.subarray(0, 5).toString() === "%PDF-";
  if (mime === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mime === "image/png")
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/webp")
    return (
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP"
    );
  return false;
}
export async function saveDocumentFile(
  path: string,
  buffer: Buffer,
  mime: string,
) {
  if (cloud) {
    const { error } = await cloud.storage
      .from("family-documents")
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (error) throw error;
  } else {
    await mkdir(join(directory, path.split("/")[0]), { recursive: true });
    await writeFile(join(directory, path), buffer, { mode: 0o600, flag: "wx" });
  }
}
export async function readDocumentFile(path: string) {
  if (cloud) {
    const { data, error } = await cloud.storage
      .from("family-documents")
      .download(path);
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }
  return readFile(join(directory, path));
}
export async function deleteDocumentFile(path: string) {
  if (cloud) {
    const { error } = await cloud.storage
      .from("family-documents")
      .remove([path]);
    if (error) throw error;
  } else await rm(join(directory, path), { force: true });
}

export async function saveDocumentExtraction(
  db: Sql,
  documentId: string,
  extraction: Extraction,
) {
  await db.transaction(async (tx) => {
    const [document] = await tx.all("SELECT * FROM documents WHERE id=?", [
      documentId,
    ]);
    if (!document || document.status === "ready") return;
    const people = (
      await tx.all("SELECT * FROM people WHERE family_id=?", [
        document.family_id,
      ])
    ).map(personFrom);
    const ids = new Map<string, string>();
    for (const item of extraction.people) {
      const exact = identityCandidates(item.name, people);
      const candidates = [
        ...new Map(
          [...exact, ...surnameCandidates(item.name, people)].map((p) => [
            p.id,
            p,
          ]),
        ).values(),
      ];
      const match =
        exact.length === 1 && normalizeName(item.name).split(" ").length >= 2
          ? exact[0]
          : null;
      const id = match?.id || randomUUID();
      ids.set(item.key, id);
      if (!match) {
        await tx.all(
          "INSERT INTO people(id,family_id,name,aliases,candidate_ids) VALUES(?,?,?,?,?)",
          [
            id,
            document.family_id,
            item.name,
            json(item.aliases),
            json(candidates.map((p) => p.id)),
          ],
        );
        people.push({
          id,
          name: item.name,
          aliases: item.aliases,
          candidateIds: candidates.map((p) => p.id),
        });
      }
      await tx.all(
        "INSERT INTO document_people(document_id,person_id) VALUES(?,?) ON CONFLICT DO NOTHING",
        [documentId, id],
      );
    }
    const claims = new Map<string, string>();
    for (const claim of extraction.claims) {
      const id = randomUUID();
      claims.set(claim.key, id);
      await tx.all(
        "INSERT INTO document_claims(id,document_id,person_id,quote,statement,certainty) VALUES(?,?,?,?,?,?)",
        [
          id,
          documentId,
          claim.personKey ? ids.get(claim.personKey) : null,
          claim.quote,
          claim.statement,
          claim.certainty,
        ],
      );
    }
    for (const relation of extraction.relationships) {
      await tx.all(
        "INSERT INTO document_relationships(id,document_id,family_id,person_a,person_b,type,claim_id) VALUES(?,?,?,?,?,?,?)",
        [
          randomUUID(),
          documentId,
          document.family_id,
          ids.get(relation.fromKey),
          ids.get(relation.toKey),
          relation.type,
          claims.get(relation.claimKey),
        ],
      );
    }
    for (const event of extraction.events) {
      const id = randomUUID();
      await tx.all(
        "INSERT INTO document_events(id,document_id,description,type,year,place,certainty) VALUES(?,?,?,?,?,?,?)",
        [
          id,
          documentId,
          event.description,
          event.type,
          event.year,
          event.place,
          event.certainty,
        ],
      );
      for (const key of new Set(event.personKeys))
        await tx.all(
          "INSERT INTO document_event_people(event_id,person_id) VALUES(?,?)",
          [id, ids.get(key)],
        );
      for (const key of new Set(event.claimKeys))
        await tx.all(
          "INSERT INTO document_event_claims(event_id,claim_id) VALUES(?,?)",
          [id, claims.get(key)],
        );
    }
    await tx.all(
      "UPDATE documents SET status='ready',summary=?,error=NULL WHERE id=?",
      [extraction.summary, documentId],
    );
    await tx.all(
      "UPDATE document_processing_jobs SET status='done',lease_until=NULL,error=NULL WHERE document_id=?",
      [documentId],
    );
  });
}

export async function processNextDocument(
  db: Sql,
  providers = { readDocumentFile, readDocumentText, extractDocumentFacts },
) {
  if (
    !process.env.OPENAI_API_KEY &&
    providers.readDocumentText === readDocumentText
  )
    return false;
  const now = new Date().toISOString();
  const lease = new Date(Date.now() + 30 * 60_000).toISOString();
  const [job] = await db.all(
    "UPDATE document_processing_jobs SET status='running',attempts=attempts+1,lease_until=? WHERE id=(SELECT id FROM document_processing_jobs WHERE (status='queued' AND available_at<=?) OR (status='running' AND lease_until<?) ORDER BY available_at LIMIT 1) AND ((status='queued' AND available_at<=?) OR (status='running' AND lease_until<?)) RETURNING *",
    [lease, now, now, now, now],
  );
  if (!job) return false;
  const heartbeat = setInterval(() => {
    void db
      .all("UPDATE document_processing_jobs SET lease_until=? WHERE id=?", [
        new Date(Date.now() + 30 * 60_000).toISOString(),
        job.id,
      ])
      .catch(() => {});
  }, 60_000);
  try {
    const [doc] = await db.all("SELECT * FROM documents WHERE id=?", [
      job.document_id,
    ]);
    if (!doc) return true;
    let text: string = doc.extracted_text;
    if (!text) {
      await db.all(
        "UPDATE documents SET status='reading',error=NULL WHERE id=?",
        [doc.id],
      );
      text = await providers.readDocumentText(
        await providers.readDocumentFile(doc.storage_path),
        doc.mime_type,
      );
      await db.all("UPDATE documents SET extracted_text=? WHERE id=?", [
        text,
        doc.id,
      ]);
    }
    await db.all("UPDATE documents SET status='extracting' WHERE id=?", [
      doc.id,
    ]);
    const people = (
      await db.all("SELECT * FROM people WHERE family_id=?", [doc.family_id])
    ).map(personFrom);
    const extraction = text
      ? await providers.extractDocumentFacts(text, people)
      : {
          summary: "No se encontró texto legible.",
          people: [],
          claims: [],
          relationships: [],
          events: [],
        };
    await saveDocumentExtraction(db, doc.id, extraction);
  } catch (error) {
    const message =
      error instanceof Error &&
      /extracción válida|cita literal|evidencia válida/.test(error.message)
        ? error.message
        : "No se pudo procesar el documento. Revisa el archivo y la configuración de OpenAI.";
    const retry = job.attempts < 3;
    await db.all(
      "UPDATE document_processing_jobs SET status=?,error=?,lease_until=NULL,available_at=? WHERE id=?",
      [
        retry ? "queued" : "failed",
        message,
        new Date(Date.now() + job.attempts * 30_000).toISOString(),
        job.id,
      ],
    );
    await db.all("UPDATE documents SET status=?,error=? WHERE id=?", [
      retry ? "queued" : "failed",
      message,
      job.document_id,
    ]);
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}
