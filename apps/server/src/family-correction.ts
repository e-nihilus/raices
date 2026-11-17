import type { Sql } from "./db.ts";

// Replace complete words only: Pardo must never turn Pardos into Pardoss.
export async function correctFamilyWord(
  tx: Sql,
  family: string,
  from: string,
  to: string,
) {
  const escape = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])${escape(from)}(?![\\p{L}\\p{M}\\p{N}])`,
    "gu",
  );
  const replace = (text: string) => text.replace(pattern, () => to);
  const specs: [string, string[], string][] = [
    ["people", ["name"], "family_id=?"],
    ["conversations", ["title", "summary"], "family_id=?"],
    [
      "segments",
      ["text"],
      "conversation_id IN (SELECT id FROM conversations WHERE family_id=?)",
    ],
    [
      "claims",
      ["quote", "statement"],
      "conversation_id IN (SELECT id FROM conversations WHERE family_id=?)",
    ],
    [
      "events",
      ["description", "place"],
      "conversation_id IN (SELECT id FROM conversations WHERE family_id=?)",
    ],
    ["documents", ["title", "summary", "extracted_text"], "family_id=?"],
    [
      "document_claims",
      ["quote", "statement"],
      "document_id IN (SELECT id FROM documents WHERE family_id=?)",
    ],
    [
      "document_events",
      ["description", "place"],
      "document_id IN (SELECT id FROM documents WHERE family_id=?)",
    ],
  ];
  for (const [table, columns, scope] of specs) {
    const rows = await tx.all(
      `SELECT id,${columns.join(",")} FROM ${table} WHERE ${scope}`,
      [family],
    );
    for (const row of rows)
      for (const column of columns) {
        if (typeof row[column] !== "string") continue;
        const value = replace(row[column]);
        if (value !== row[column])
          await tx.all(`UPDATE ${table} SET ${column}=? WHERE id=?`, [
            value,
            row.id,
          ]);
      }
  }
  const people = await tx.all(
    "SELECT id,aliases FROM people WHERE family_id=?",
    [family],
  );
  for (const person of people) {
    const aliases: string[] = JSON.parse(person.aliases);
    const updated = aliases.map(replace);
    if (updated.some((alias, i) => alias !== aliases[i]))
      await tx.all("UPDATE people SET aliases=? WHERE id=?", [
        JSON.stringify(updated),
        person.id,
      ]);
  }
}
