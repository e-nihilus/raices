import { randomUUID } from "node:crypto";
import {
  identityCandidates,
  normalizeName,
  type Library,
  type Person,
  type Segment,
  type Extraction,
} from "@raices/shared";
import type { Sql, Row } from "./db.ts";
export const json = (value: unknown) => JSON.stringify(value);
const parse = (value: string) => JSON.parse(value);
export const personFrom = (p: Row): Person => ({
  id: p.id,
  name: p.name,
  aliases: parse(p.aliases),
  candidateIds: parse(p.candidate_ids),
});
export async function ensureFamily(db: Sql, userId: string) {
  return db.transaction(async (tx) => {
    // PostgreSQL advisory lock prevents parallel first requests creating duplicate spaces.
    if (process.env.DATABASE_URL)
      await tx.all("SELECT pg_advisory_xact_lock(hashtext(?))", [userId]);
    const rows = await tx.all(
      "SELECT f.* FROM families f JOIN family_members m ON m.family_id=f.id WHERE m.user_id=? ORDER BY f.created_at LIMIT 1",
      [userId],
    );
    if (rows[0]) return rows[0].id as string;
    const id = randomUUID();
    await tx.all("INSERT INTO families(id,name,created_at) VALUES(?,?,?)", [
      id,
      "Mi familia",
      new Date().toISOString(),
    ]);
    await tx.all("INSERT INTO family_members(family_id,user_id) VALUES(?,?)", [
      id,
      userId,
    ]);
    return id;
  });
}
export async function library(db: Sql, familyId: string): Promise<Library> {
  const conversations = await db.all(
    "SELECT * FROM conversations WHERE family_id=? ORDER BY created_at DESC",
    [familyId],
  );
  const people = (
    await db.all("SELECT * FROM people WHERE family_id=? ORDER BY name", [
      familyId,
    ])
  ).map(personFrom);
  const relationships = (
    await db.all("SELECT * FROM relationships WHERE family_id=?", [familyId])
  ).map((r) => ({
    id: r.id,
    fromId: r.person_a,
    toId: r.person_b,
    type: r.type,
    claimId: r.claim_id,
  }));
  const result: Library = { people, conversations: [], relationships };
  for (const c of conversations) {
    const segments = (
      await db.all(
        "SELECT * FROM segments WHERE conversation_id=? ORDER BY start_time",
        [c.id],
      )
    ).map((s) => ({
      id: s.id,
      start: s.start_time,
      end: s.end_time,
      text: s.text,
      speaker: s.speaker,
    }));
    const claims = (
      await db.all("SELECT * FROM claims WHERE conversation_id=?", [c.id])
    ).map((x) => ({
      id: x.id,
      conversationId: c.id,
      personId: x.person_id,
      segmentId: x.segment_id,
      quote: x.quote,
      statement: x.statement,
      certainty: x.certainty,
    }));
    const events = [];
    for (const e of await db.all(
      "SELECT * FROM events WHERE conversation_id=? ORDER BY year",
      [c.id],
    )) {
      events.push({
        id: e.id,
        conversationId: c.id,
        description: e.description,
        type: e.type,
        year: e.year,
        place: e.place,
        certainty: e.certainty,
        personIds: (
          await db.all("SELECT person_id FROM event_people WHERE event_id=?", [
            e.id,
          ])
        ).map((x) => x.person_id),
        claimIds: (
          await db.all("SELECT claim_id FROM event_claims WHERE event_id=?", [
            e.id,
          ])
        ).map((x) => x.claim_id),
      });
    }
    result.conversations.push({
      id: c.id,
      title: c.title,
      createdAt: c.created_at,
      duration: c.duration,
      status: c.status,
      summary: c.summary,
      error: c.error,
      mimeType: c.mime_type,
      bookmarks: parse(c.bookmarks),
      segments,
      claims,
      events,
    });
  }
  return result;
}
export async function saveExtraction(
  db: Sql,
  conversationId: string,
  segments: Segment[],
  extraction: Extraction,
) {
  await db.transaction(async (tx) => {
    const [conversation] = await tx.all(
      "SELECT * FROM conversations WHERE id=?",
      [conversationId],
    );
    if (!conversation || conversation.status === "ready") return;
    const people = (
      await tx.all("SELECT * FROM people WHERE family_id=?", [
        conversation.family_id,
      ])
    ).map(personFrom);
    const personIds = new Map<string, string>();
    for (const item of extraction.people) {
      const candidates = identityCandidates(item.name, people);
      // Only unambiguous full-name matches are reused; short names remain separate pending review.
      const match =
        candidates.length === 1 &&
        normalizeName(item.name).split(" ").length >= 2
          ? candidates[0]
          : null;
      const id = match?.id || randomUUID();
      personIds.set(item.key, id);
      if (!match) {
        await tx.all(
          "INSERT INTO people(id,family_id,name,aliases,candidate_ids) VALUES(?,?,?,?,?)",
          [
            id,
            conversation.family_id,
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
    }
    for (const s of segments)
      await tx.all(
        "INSERT INTO segments(id,conversation_id,start_time,end_time,text,speaker) VALUES(?,?,?,?,?,?)",
        [s.id, conversationId, s.start, s.end, s.text, s.speaker],
      );
    const claimIds = new Map<string, string>();
    for (const c of extraction.claims) {
      const id = randomUUID();
      claimIds.set(c.key, id);
      await tx.all(
        "INSERT INTO claims(id,conversation_id,person_id,segment_id,quote,statement,certainty) VALUES(?,?,?,?,?,?,?)",
        [
          id,
          conversationId,
          c.personKey ? personIds.get(c.personKey) : null,
          c.segmentId,
          c.quote,
          c.statement,
          c.certainty,
        ],
      );
    }
    for (const r of extraction.relationships)
      await tx.all(
        "INSERT INTO relationships(id,family_id,person_a,person_b,type,claim_id) VALUES(?,?,?,?,?,?)",
        [
          randomUUID(),
          conversation.family_id,
          personIds.get(r.fromKey),
          personIds.get(r.toKey),
          r.type,
          claimIds.get(r.claimKey),
        ],
      );
    for (const e of extraction.events) {
      const id = randomUUID();
      let certainty = e.certainty;
      if (e.year !== null) {
        const prior = await tx.all(
          "SELECT DISTINCT ev.*, ep.person_id FROM events ev JOIN event_people ep ON ep.event_id=ev.id JOIN conversations c ON c.id=ev.conversation_id WHERE c.family_id=? AND ev.year IS NOT NULL AND ev.year<>?",
          [conversation.family_id, e.year],
        );
        const involved = new Set(e.personKeys.map((key) => personIds.get(key)));
        const conflicts = prior.filter(
          (old) =>
            involved.has(old.person_id) &&
            normalizeName(old.type) === normalizeName(e.type) &&
            (["nacimiento", "fallecimiento"].includes(normalizeName(e.type)) ||
              (normalizeName(old.description) ===
                normalizeName(e.description) &&
                normalizeName(old.place || "") ===
                  normalizeName(e.place || ""))),
        );
        if (conflicts.length) {
          certainty = "contradictory";
          for (const old of conflicts)
            await tx.all(
              "UPDATE events SET certainty='contradictory' WHERE id=?",
              [old.id],
            );
        }
      }
      await tx.all(
        "INSERT INTO events(id,conversation_id,description,type,year,place,certainty) VALUES(?,?,?,?,?,?,?)",
        [id, conversationId, e.description, e.type, e.year, e.place, certainty],
      );
      for (const key of new Set(e.personKeys))
        await tx.all(
          "INSERT INTO event_people(event_id,person_id) VALUES(?,?)",
          [id, personIds.get(key)],
        );
      for (const key of new Set(e.claimKeys))
        await tx.all(
          "INSERT INTO event_claims(event_id,claim_id) VALUES(?,?)",
          [id, claimIds.get(key)],
        );
    }
    await tx.all(
      "UPDATE conversations SET status='ready', summary=?, error=NULL, extraction=? WHERE id=?",
      [extraction.summary, json(extraction), conversationId],
    );
    await tx.all(
      "UPDATE processing_jobs SET status='done', lease_until=NULL, error=NULL WHERE conversation_id=?",
      [conversationId],
    );
  });
}
export async function mergePeople(
  db: Sql,
  familyId: string,
  sourceId: string,
  targetId: string,
) {
  if (sourceId === targetId)
    throw new Error("No puedes fusionar una persona consigo misma");
  await db.transaction(async (tx) => {
    const rows = await tx.all(
      "SELECT * FROM people WHERE family_id=? AND id IN (?,?)",
      [familyId, sourceId, targetId],
    );
    const source = rows.find((x) => x.id === sourceId),
      target = rows.find((x) => x.id === targetId);
    if (!source || !target) throw new Error("Persona inexistente");
    await tx.all("UPDATE claims SET person_id=? WHERE person_id=?", [
      targetId,
      sourceId,
    ]);
    await tx.all("UPDATE relationships SET person_a=? WHERE person_a=?", [
      targetId,
      sourceId,
    ]);
    await tx.all("UPDATE relationships SET person_b=? WHERE person_b=?", [
      targetId,
      sourceId,
    ]);
    await tx.all(
      "DELETE FROM relationships WHERE person_a=person_b AND family_id=?",
      [familyId],
    );
    for (const row of await tx.all(
      "SELECT event_id FROM event_people WHERE person_id=?",
      [sourceId],
    ))
      await tx.all(
        "INSERT INTO event_people(event_id,person_id) VALUES(?,?) ON CONFLICT DO NOTHING",
        [row.event_id, targetId],
      );
    await tx.all("DELETE FROM event_people WHERE person_id=?", [sourceId]);
    await tx.all("UPDATE people SET aliases=?,candidate_ids=? WHERE id=?", [
      json([
        ...new Set([
          ...parse(target.aliases),
          source.name,
          ...parse(source.aliases),
        ]),
      ]),
      json([]),
      targetId,
    ]);
    await tx.all("DELETE FROM people WHERE id=?", [sourceId]);
    for (const row of await tx.all("SELECT * FROM people WHERE family_id=?", [
      familyId,
    ]))
      await tx.all("UPDATE people SET candidate_ids=? WHERE id=?", [
        json(
          parse(row.candidate_ids).filter(
            (x: string) => x !== sourceId && x !== targetId,
          ),
        ),
        row.id,
      ]);
  });
}
