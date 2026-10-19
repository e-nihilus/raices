import { readAudio } from "./audio.ts";
import { transcribe, extract } from "./ai.ts";
import { personFrom, saveExtraction } from "./store.ts";
import type { Sql } from "./db.ts";
export async function processNext(
  db: Sql,
  providers = { transcribe, extract, readAudio },
) {
  if (!process.env.OPENAI_API_KEY && providers.transcribe === transcribe)
    return false;
  const now = new Date().toISOString();
  const lease = new Date(Date.now() + 30 * 60_000).toISOString();
  const [job] = await db.all(
    `UPDATE processing_jobs SET status='running',attempts=attempts+1,lease_until=? WHERE id=(SELECT id FROM processing_jobs WHERE (status='queued' AND available_at<=?) OR (status='running' AND lease_until<?) ORDER BY available_at LIMIT 1) AND ((status='queued' AND available_at<=?) OR (status='running' AND lease_until<?)) RETURNING *`,
    [lease, now, now, now, now],
  );
  if (!job) return false;
  try {
    const [conversation] = await db.all(
      "SELECT * FROM conversations WHERE id=?",
      [job.conversation_id],
    );
    if (!conversation) return true;
    await db.all(
      "UPDATE conversations SET status='transcribing',error=NULL WHERE id=?",
      [conversation.id],
    );
    const heartbeat = setInterval(() => {
      void db
        .all("UPDATE processing_jobs SET lease_until=? WHERE id=?", [
          new Date(Date.now() + 30 * 60_000).toISOString(),
          job.id,
        ])
        .catch(() => {});
    }, 60_000);
    try {
      const segments = await providers.transcribe(
        await providers.readAudio(conversation.audio_path),
      );
      await db.all("UPDATE conversations SET status='extracting' WHERE id=?", [
        conversation.id,
      ]);
      const people = (
        await db.all("SELECT * FROM people WHERE family_id=?", [
          conversation.family_id,
        ])
      ).map(personFrom);
      const extraction = await providers.extract(segments, people);
      await saveExtraction(db, conversation.id, segments, extraction);
    } finally {
      clearInterval(heartbeat);
    }
  } catch (error) {
    // Provider details may include private data, so persist only a short, safe diagnostic.
    const message =
      error instanceof Error &&
      /No se detectó|extracción válida|cita literal|evidencia válida/.test(
        error.message,
      )
        ? error.message
        : "No se pudo procesar el audio. Revisa las credenciales, conexión y FFmpeg del servidor.";
    const retry = job.attempts < 3;
    await db.all(
      "UPDATE processing_jobs SET status=?,error=?,lease_until=NULL,available_at=? WHERE id=?",
      [
        retry ? "queued" : "failed",
        message,
        new Date(Date.now() + job.attempts * 30_000).toISOString(),
        job.id,
      ],
    );
    await db.all("UPDATE conversations SET status=?,error=? WHERE id=?", [
      retry ? "queued" : "failed",
      message,
      job.conversation_id,
    ]);
  }
  return true;
}
export function startWorker(db: Sql) {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await processNext(db);
    } catch {
      console.error("Error de cola; se volverá a intentar.");
    } finally {
      busy = false;
    }
  }, 2000);
  return () => clearInterval(timer);
}
