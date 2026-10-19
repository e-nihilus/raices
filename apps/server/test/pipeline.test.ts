import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../src/db.ts";
import {
  ensureFamily,
  library,
  saveExtraction,
  mergePeople,
} from "../src/store.ts";
import { processNext } from "../src/worker.ts";
import {
  validateEvidence,
  type Extraction,
  type Segment,
} from "@raices/shared";
const segments: Segment[] = [
  {
    id: randomUUID(),
    start: 32,
    end: 46,
    text: "Mi hermano Antonio y yo nos mudamos de Jaén a Madrid en 1964.",
    speaker: null,
  },
];
const extraction: Extraction = {
  summary: "Una mudanza familiar.",
  people: [
    { key: "manuel", name: "Manuel Sánchez", aliases: ["Manuel"] },
    { key: "antonio", name: "Antonio", aliases: [] },
  ],
  claims: [
    {
      key: "c1",
      personKey: "manuel",
      segmentId: segments[0].id,
      quote: segments[0].text,
      statement: "La familia se mudó a Madrid en 1964.",
      certainty: "pending",
    },
  ],
  relationships: [
    { fromKey: "manuel", toKey: "antonio", type: "hermano", claimKey: "c1" },
  ],
  events: [
    {
      key: "e1",
      description: "Mudanza a Madrid",
      type: "mudanza",
      year: 1964,
      place: "Madrid",
      certainty: "pending",
      personKeys: ["manuel", "antonio"],
      claimKeys: ["c1"],
    },
  ],
};
async function conversation(
  db: ReturnType<typeof createDatabase>,
  family: string,
) {
  const id = randomUUID();
  await db.all(
    "INSERT INTO conversations(id,family_id,title,created_at,status,audio_path,mime_type) VALUES(?,?,?,?,?,?,?)",
    [
      id,
      family,
      "Una charla",
      new Date().toISOString(),
      "queued",
      `${family}/${id}`,
      "audio/mp4",
    ],
  );
  await db.all(
    "INSERT INTO processing_jobs(id,conversation_id,available_at) VALUES(?,?,?)",
    [randomUUID(), id, new Date().toISOString()],
  );
  return id;
}
test("rechaza citas inventadas y referencias inexistentes", () => {
  assert.throws(
    () =>
      validateEvidence(
        {
          ...extraction,
          claims: [{ ...extraction.claims[0], quote: "Nunca se dijo esto" }],
        },
        segments,
      ),
    /cita literal/,
  );
  assert.throws(
    () =>
      validateEvidence(
        {
          ...extraction,
          events: [{ ...extraction.events[0], claimKeys: ["inventado"] }],
        },
        segments,
      ),
    /evidencia/,
  );
  assert.throws(
    () =>
      validateEvidence(
        { ...extraction, people: [...extraction.people, extraction.people[0]] },
        segments,
      ),
    /duplicadas/,
  );
});
test("la IA no puede confirmar automáticamente un hecho", () => {
  const data = structuredClone(extraction);
  data.claims[0].certainty = "confirmed";
  data.events[0].certainty = "confirmed";
  const result = validateEvidence(data, segments);
  assert.equal(result.claims[0].certainty, "pending");
  assert.equal(result.events[0].certainty, "pending");
});
test("guarda fuentes y relaciones en una transacción sin duplicar al reintentar", async () => {
  const db = createDatabase(":memory:");
  try {
    const family = await ensureFamily(db, "user-a");
    const id = await conversation(db, family);
    await saveExtraction(db, id, segments, extraction);
    await saveExtraction(db, id, segments, extraction);
    const data = await library(db, family);
    assert.equal(data.people.length, 2);
    assert.equal(data.conversations[0].claims.length, 1);
    assert.equal(data.conversations[0].segments[0].start, 32);
    assert.equal(data.conversations[0].events[0].personIds.length, 2);
    assert.equal((await db.all("SELECT * FROM relationships")).length, 1);
    assert.equal(data.conversations[0].status, "ready");
  } finally {
    await db.close();
  }
});
test("reutiliza nombres completos y deja nombres cortos pendientes de revisión", async () => {
  const db = createDatabase(":memory:");
  try {
    const family = await ensureFamily(db, "user-a");
    await saveExtraction(
      db,
      await conversation(db, family),
      segments,
      extraction,
    );
    const laterSegments = segments.map((s) => ({ ...s, id: randomUUID() }));
    const later = structuredClone(extraction);
    later.claims[0].segmentId = laterSegments[0].id;
    await saveExtraction(
      db,
      await conversation(db, family),
      laterSegments,
      later,
    );
    const data = await library(db, family);
    assert.equal(
      data.people.filter((p) => p.name === "Manuel Sánchez").length,
      1,
    );
    const antonios = data.people.filter((p) => p.name === "Antonio");
    assert.equal(antonios.length, 2);
    assert.equal(antonios.filter((p) => p.candidateIds.length > 0).length, 1);
    await mergePeople(db, family, antonios[1].id, antonios[0].id);
    assert.equal((await library(db, family)).people.length, 2);
  } finally {
    await db.close();
  }
});
test("aísla familias y rechaza fusiones entre ellas", async () => {
  const db = createDatabase(":memory:");
  try {
    const a = await ensureFamily(db, "a"),
      b = await ensureFamily(db, "b");
    await saveExtraction(db, await conversation(db, a), segments, extraction);
    assert.equal((await library(db, b)).conversations.length, 0);
    const data = await library(db, a);
    await assert.rejects(
      () => mergePeople(db, b, data.people[0].id, data.people[1].id),
      /inexistente/,
    );
  } finally {
    await db.close();
  }
});
test("el worker procesa la cola sin claves reales utilizando proveedores de prueba", async () => {
  const db = createDatabase(":memory:");
  try {
    const family = await ensureFamily(db, "user");
    await conversation(db, family);
    assert.equal(
      await processNext(db, {
        readAudio: async () => Buffer.from("fixture"),
        transcribe: async () => segments,
        extract: async () => extraction,
      }),
      true,
    );
    assert.equal((await library(db, family)).conversations[0].status, "ready");
    assert.equal(
      await processNext(db, {
        readAudio: async () => Buffer.from(""),
        transcribe: async () => segments,
        extract: async () => extraction,
      }),
      false,
    );
  } finally {
    await db.close();
  }
});
test("los fallos conservan el audio y reprograman el trabajo", async () => {
  const db = createDatabase(":memory:");
  try {
    const family = await ensureFamily(db, "user");
    await conversation(db, family);
    await processNext(db, {
      readAudio: async () => Buffer.from(""),
      transcribe: async () => {
        throw new Error("provider error");
      },
      extract: async () => extraction,
    });
    const [job] = await db.all("SELECT * FROM processing_jobs");
    assert.equal(job.status, "queued");
    assert.equal(job.attempts, 1);
    assert.equal((await library(db, family)).conversations[0].status, "queued");
  } finally {
    await db.close();
  }
});

test("conserva y señala versiones de fechas diferentes sin elegir una", async () => {
  const db = createDatabase(":memory:");
  try {
    const family = await ensureFamily(db, "user");
    await saveExtraction(
      db,
      await conversation(db, family),
      segments,
      extraction,
    );
    const laterSegments = segments.map((s) => ({
      ...s,
      id: randomUUID(),
      text: s.text.replace("1964", "1965"),
    }));
    const later = structuredClone(extraction);
    later.claims[0].segmentId = laterSegments[0].id;
    later.claims[0].quote = laterSegments[0].text;
    later.claims[0].statement = "La familia se mudó en 1965.";
    later.events[0].year = 1965;
    await saveExtraction(
      db,
      await conversation(db, family),
      laterSegments,
      later,
    );
    const events = (await library(db, family)).conversations.flatMap(
      (c) => c.events,
    );
    assert.deepEqual(events.map((e) => e.year).sort(), [1964, 1965]);
    assert.ok(events.every((e) => e.certainty === "contradictory"));
  } finally {
    await db.close();
  }
});
