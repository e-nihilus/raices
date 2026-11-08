import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../src/db.ts";
import { createApp } from "../src/app.ts";

test("perfiles, homónimos y solicitudes requieren consentimiento sin compartir bibliotecas", async () => {
  const db = createDatabase(":memory:");
  const server = createApp(db).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  const call = (path: string, token = "", method = "GET", body?: object) =>
    fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    const register = async (username: string) =>
      (
        await call("/auth/register", "", "POST", {
          username,
          password: "password-123",
        })
      ).json();
    const a = await register("ana1"),
      b = await register("ana2"),
      c = await register("ana3");
    const profile = {
      firstName: "Ana",
      surname1: "García",
      surname2: "López",
      discoverable: true,
    };
    for (const user of [a, b, c])
      assert.equal(
        (await call("/profile", user.token, "PUT", profile)).status,
        200,
      );
    const matches = await (
      await call(
        `/account-search?q=${encodeURIComponent("Ana García López")}`,
        a.token,
      )
    ).json();
    assert.deepEqual(
      matches.matches.map((x: { username: string }) => x.username).sort(),
      ["ana2", "ana3"],
    );
    const [family] = await db.all(
      "SELECT family_id FROM app_family_members WHERE user_id=?",
      [a.user.id],
    );
    const person = randomUUID();
    await db.all("INSERT INTO people(id,family_id,name) VALUES(?,?,?)", [
      person,
      family.family_id,
      "Ana García López",
    ]);
    const invitation = {
      recipientId: b.user.id,
      personId: person,
      relationship: "hermana",
    };
    assert.equal(
      (await call("/family-links", a.token, "POST", invitation)).status,
      201,
    );
    const incoming = await (await call("/family-links", b.token)).json();
    assert.equal(incoming.requests.length, 1);
    const id = incoming.requests[0].id;
    assert.equal(
      (
        await call(`/family-links/${id}/respond`, c.token, "POST", {
          decision: "accepted",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(`/family-links/${id}/respond`, b.token, "POST", {
          decision: "accepted",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call(`/family-links/${id}/respond`, b.token, "POST", {
          decision: "accepted",
        })
      ).status,
      404,
    );
    assert.equal(
      (await (await call("/library", b.token)).json()).people.length,
      0,
    );
    const [bFamily] = await db.all(
      "SELECT family_id FROM app_family_members WHERE user_id=?",
      [b.user.id],
    );
    const [cFamily] = await db.all(
      "SELECT family_id FROM app_family_members WHERE user_id=?",
      [c.user.id],
    );
    const cPerson = randomUUID(),
      grandmother = randomUUID();
    await db.all("INSERT INTO people(id,family_id,name) VALUES(?,?,?)", [
      cPerson,
      bFamily.family_id,
      "Ana García López",
    ]);
    await db.all(
      "INSERT INTO people(id,family_id,name,candidate_ids) VALUES(?,?,?,?)",
      [grandmother, cFamily.family_id, "Abuela", '["private-id"]'],
    );
    assert.equal(
      (
        await call(`/shared-tree/people/${grandmother}`, c.token, "PUT", {
          shared: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await call("/shared-tree", a.token)).json()).people.length,
      0,
    );
    assert.equal(
      (
        await call("/family-links", b.token, "POST", {
          recipientId: c.user.id,
          personId: cPerson,
          relationship: "hermana",
        })
      ).status,
      201,
    );
    assert.equal(
      (await (await call("/shared-tree", a.token)).json()).people.length,
      0,
    );
    const cRequests = await (await call("/family-links", c.token)).json();
    assert.equal(
      (
        await call(
          `/family-links/${cRequests.requests[0].id}/respond`,
          c.token,
          "POST",
          { decision: "accepted" },
        )
      ).status,
      200,
    );
    const shared = await (await call("/shared-tree", a.token)).json();
    assert.equal(shared.people[0].name, "Abuela");
    assert.deepEqual(shared.people[0].candidateIds, []);
    assert.equal(
      (
        await call(`/shared-tree/people/${grandmother}`, a.token, "PUT", {
          shared: false,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(`/shared-tree/people/${grandmother}`, c.token, "PUT", {
          shared: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await call("/shared-tree", a.token)).json()).people.length,
      0,
    );
    await call("/profile", b.token, "PUT", { ...profile, discoverable: false });
    assert.equal(
      (await (await call("/account-search?q=ana2", a.token)).json()).matches
        .length,
      0,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  }
});
