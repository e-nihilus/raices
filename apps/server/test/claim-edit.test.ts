import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../src/db.ts";
import { createApp } from "../src/app.ts";

test("editar cita y dato actualiza solo el fragmento de la transcripción y mantiene el aislamiento", async () => {
  const db = createDatabase(":memory:");
  const server = createApp(db).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path: string, method: string, body: object, token = "") =>
    fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  try {
    const makeAccount = async (username: string) =>
      (
        await request("/auth/register", "POST", {
          username,
          password: "password-123",
        })
      ).json();
    const owner = await makeAccount("owner"),
      other = await makeAccount("other");
    const [family] = await db.all(
      "SELECT family_id FROM app_family_members WHERE user_id=?",
      [owner.user.id],
    );
    const conversation = randomUUID(),
      segment = randomUUID(),
      claim = randomUUID(),
      duplicate = randomUUID();
    await db.all(
      "INSERT INTO conversations(id,family_id,title,created_at,status,audio_path,mime_type) VALUES(?,?,?,?,?,?,?)",
      [
        conversation,
        family.family_id,
        "Rallo",
        new Date().toISOString(),
        "ready",
        "audio",
        "audio/mp4",
      ],
    );
    await db.all(
      "INSERT INTO segments(id,conversation_id,start_time,end_time,text) VALUES(?,?,?,?,?)",
      [segment, conversation, 0, 1, "Dijo: mi madre María Rallo. Otro Rallo."],
    );
    for (const id of [claim, duplicate])
      await db.all(
        "INSERT INTO claims(id,conversation_id,segment_id,quote,statement,certainty) VALUES(?,?,?,?,?,?)",
        [
          id,
          conversation,
          segment,
          "mi madre María Rallo",
          "Su madre es María Rallo",
          "confirmed",
        ],
      );
    const edit = {
      quote: "mi madre María Rayo",
      statement: "Su madre es María Rayo",
      originalQuote: "mi madre María Rallo",
      originalStatement: "Su madre es María Rallo",
    };
    assert.equal(
      (await request(`/claims/${claim}`, "PATCH", edit, other.token)).status,
      404,
    );
    assert.equal(
      (await request(`/claims/${claim}`, "PATCH", edit, owner.token)).status,
      200,
    );
    const [updated] = await db.all(
      "SELECT quote,statement,certainty FROM claims WHERE id=?",
      [claim],
    );
    assert.deepEqual(
      { ...updated },
      { quote: edit.quote, statement: edit.statement, certainty: "pending" },
    );
    assert.equal(
      (await db.all("SELECT text FROM segments WHERE id=?", [segment]))[0].text,
      "Dijo: mi madre María Rayo. Otro Rallo.",
    );
    assert.equal(
      (await db.all("SELECT quote FROM claims WHERE id=?", [duplicate]))[0]
        .quote,
      edit.quote,
    );
    assert.equal(
      (
        await db.all("SELECT title FROM conversations WHERE id=?", [
          conversation,
        ])
      )[0].title,
      "Rallo",
    );
    assert.equal(
      (await request(`/claims/${claim}`, "PATCH", edit, owner.token)).status,
      409,
    );
    assert.equal(
      (
        await request(
          `/claims/${claim}`,
          "PATCH",
          { certainty: "confirmed" },
          owner.token,
        )
      ).status,
      200,
    );
    assert.equal(
      (await db.all("SELECT quote FROM claims WHERE id=?", [claim]))[0].quote,
      edit.quote,
    );
    const person = randomUUID();
    await db.all(
      "INSERT INTO people(id,family_id,name,aliases) VALUES(?,?,?,?)",
      [
        person,
        family.family_id,
        "María Rayo",
        JSON.stringify(["Rayo", "Rayos"]),
      ],
    );
    const replacement = {
      quote: "mi madre María Rayos",
      statement: "Su madre es María Rayo",
      originalQuote: edit.quote,
      originalStatement: edit.statement,
      replaceThroughout: { from: "Rayo", to: "Rayos" },
    };
    assert.equal(
      (await request(`/claims/${claim}`, "PATCH", replacement, owner.token))
        .status,
      200,
    );
    const [renamed] = await db.all(
      "SELECT name,aliases FROM people WHERE id=?",
      [person],
    );
    assert.equal(renamed.name, "María Rayos");
    assert.deepEqual(JSON.parse(renamed.aliases), ["Rayos", "Rayos"]);
    const [after] = await db.all(
      "SELECT statement,quote FROM claims WHERE id=?",
      [claim],
    );
    assert.equal(after.statement, "Su madre es María Rayos");
    assert.equal(after.quote, "mi madre María Rayos");
    assert.equal(
      (await db.all("SELECT quote FROM claims WHERE id=?", [duplicate]))[0]
        .quote,
      "mi madre María Rayos",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  }
});
