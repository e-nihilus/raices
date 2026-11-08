import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../src/db.ts";
import { createApp } from "../src/app.ts";

test("cuentas por nombre: duplicados, sesiones y datos separados", async () => {
  const db = createDatabase(":memory:");
  const server = createApp(db).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  const post = (
    path: string,
    username: string,
    password = "strong-password-123",
  ) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  try {
    assert.equal(
      (await fetch(`${base}/auth/username-available?username=Ana`)).status,
      200,
    );
    const first = await post("/auth/register", "Ana");
    assert.equal(first.status, 201);
    const ana = await first.json();
    assert.equal(ana.user.username, "Ana");
    assert.equal(
      (await fetch(`${base}/auth/username-available?username=ana`)).status,
      200,
    );
    assert.deepEqual(
      await (
        await fetch(`${base}/auth/username-available?username=ANA`)
      ).json(),
      { available: false },
    );
    const duplicate = await post("/auth/register", "aNa");
    assert.equal(duplicate.status, 409);
    assert.match((await duplicate.json()).error, /ya está seleccionado/);
    assert.equal(
      (await post("/auth/login", "Ana", "wrong-password")).status,
      401,
    );
    const login = await post("/auth/login", "ana");
    assert.equal(login.status, 200);
    const anaLogin = await login.json();
    assert.equal(anaLogin.user.id, ana.user.id);
    const bea = await (await post("/auth/register", "Bea")).json();
    const [anaFamily] = await db.all(
      "SELECT family_id FROM app_family_members WHERE user_id=?",
      [ana.user.id],
    );
    await db.all(
      "INSERT INTO conversations(id,family_id,title,created_at,status,audio_path,mime_type) VALUES(?,?,?,?,?,?,?)",
      [
        randomUUID(),
        anaFamily.family_id,
        "Recuerdo de Ana",
        new Date().toISOString(),
        "local",
        "audio",
        "audio/mp4",
      ],
    );
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
    const anaLibrary = await (
      await fetch(`${base}/library`, { headers: auth(ana.token) })
    ).json();
    const beaLibrary = await (
      await fetch(`${base}/library`, { headers: auth(bea.token) })
    ).json();
    assert.equal(anaLibrary.conversations.length, 1);
    assert.equal(beaLibrary.conversations.length, 0);
    assert.equal(
      (await fetch(`${base}/auth/me`, { headers: auth(ana.token) })).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${base}/auth/logout`, {
          method: "POST",
          headers: auth(ana.token),
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(`${base}/library`, { headers: auth(ana.token) })).status,
      401,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  }
});
