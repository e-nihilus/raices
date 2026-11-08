import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../src/db.ts";
import { ensureFamily, library, mergePeople } from "../src/store.ts";
import { processNextDocument, validDocumentFile } from "../src/documents.ts";
import type { Extraction } from "@raices/shared";

const documentText =
  "Pepe García López, nacido en Jaén en 1930, hijo de Juan García Ruiz.";
const extraction: Extraction = {
  summary: "Pepe García López es hijo de Juan García Ruiz.",
  people: [
    { key: "pepe", name: "Pepe García López", aliases: [] },
    { key: "juan", name: "Juan García Ruiz", aliases: [] },
  ],
  claims: [
    {
      key: "parentesco",
      personKey: "pepe",
      segmentId: "document-text",
      quote: documentText,
      statement: "Pepe García López es hijo de Juan García Ruiz.",
      certainty: "pending",
    },
  ],
  relationships: [
    { fromKey: "pepe", toKey: "juan", type: "hijo", claimKey: "parentesco" },
  ],
  events: [
    {
      key: "e1",
      description: "Nacimiento de Pepe García López",
      type: "nacimiento",
      year: 1930,
      place: "Jaén",
      certainty: "pending",
      personKeys: ["pepe"],
      claimKeys: ["parentesco"],
    },
  ],
};
async function enqueue(db: ReturnType<typeof createDatabase>, family: string) {
  const id = randomUUID();
  await db.all(
    "INSERT INTO documents(id,family_id,title,kind,file_name,mime_type,storage_path,created_at) VALUES(?,?,?,?,?,?,?,?)",
    [
      id,
      family,
      "Partida",
      "Documento oficial",
      "partida.pdf",
      "application/pdf",
      `${family}/${id}`,
      new Date().toISOString(),
    ],
  );
  await db.all(
    "INSERT INTO document_processing_jobs(id,document_id,available_at) VALUES(?,?,?)",
    [randomUUID(), id, new Date().toISOString()],
  );
  return id;
}
const providers = {
  readDocumentFile: async () => Buffer.from("%PDF-fixture"),
  readDocumentText: async () => documentText,
  extractDocumentFacts: async () => extraction,
};

test("analiza un documento, conserva la cita y enlaza apellidos completos sin duplicar personas", async () => {
  const db = createDatabase(":memory:");
  try {
    const family = await ensureFamily(db, "user");
    await enqueue(db, family);
    assert.equal(await processNextDocument(db, providers), true);
    const first = await library(db, family);
    assert.equal(first.documents?.[0].status, "ready");
    assert.equal(first.documents?.[0].claims[0].quote, documentText);
    assert.equal(
      first.documents?.[0].relationships[0].sourceDocumentId,
      first.documents?.[0].id,
    );
    assert.equal(first.documents?.[0].events[0].year, 1930);
    assert.equal(first.documents?.[0].events[0].personIds.length, 1);
    assert.equal(first.relationships?.length, 1);
    await enqueue(db, family);
    await processNextDocument(db, providers);
    assert.equal((await library(db, family)).people.length, 2);
    assert.equal(
      (await db.all("SELECT * FROM document_relationships")).length,
      2,
    );
  } finally {
    await db.close();
  }
});
test("fusionar personas conserva las citas y vínculos documentales", async () => {
  const db = createDatabase(":memory:");
  try {
    const family = await ensureFamily(db, "user");
    await enqueue(db, family);
    await processNextDocument(db, providers);
    const original = (await library(db, family)).people;
    const source = randomUUID();
    await db.all("INSERT INTO people(id,family_id,name) VALUES(?,?,?)", [
      source,
      family,
      "Pepe",
    ]);
    const target = original.find((p) => p.name === "Pepe García López")!.id;
    await db.all(
      "INSERT INTO document_people(document_id,person_id) VALUES(?,?)",
      [(await library(db, family)).documents![0].id, source],
    );
    await mergePeople(db, family, source, target);
    const doc = (await library(db, family)).documents![0];
    assert.equal(doc.personIds.filter((id) => id === target).length, 1);
    assert.equal(doc.claims.length, 1);
  } finally {
    await db.close();
  }
});
test("mismos apellidos con distinto nombre sugieren revisión sin unir identidades", async () => {
  const db = createDatabase(":memory:");
  try {
    const family = await ensureFamily(db, "user");
    const existing = randomUUID();
    await db.all("INSERT INTO people(id,family_id,name) VALUES(?,?,?)", [
      existing,
      family,
      "José García López",
    ]);
    await enqueue(db, family);
    await processNextDocument(db, providers);
    const pepe = (await library(db, family)).people.find(
      (p) => p.name === "Pepe García López",
    )!;
    assert.notEqual(pepe.id, existing);
    assert.ok(pepe.candidateIds.includes(existing));
  } finally {
    await db.close();
  }
});
test("rechaza archivos cuyo contenido no coincide con el tipo declarado", () => {
  assert.equal(
    validDocumentFile(Buffer.from("<script>"), "application/pdf"),
    false,
  );
  assert.equal(
    validDocumentFile(Buffer.from("%PDF-1.7"), "application/pdf"),
    true,
  );
});
