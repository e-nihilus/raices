import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createDatabase } from "../src/db.ts";
import { createApp } from "../src/app.ts";
test("API: autenticación, upload, idempotencia, reproducción, exportación y borrado", async () => {
  const db = createDatabase(":memory:");
  const server = createApp(db).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("No address");
  const url = `http://127.0.0.1:${addr.port}`;
  try {
    assert.equal((await fetch(`${url}/library`)).status, 401);
    const account = await fetch(`${url}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Prueba",
        password: "strong-password-123",
      }),
    });
    assert.equal(account.status, 201);
    const headers = { Authorization: `Bearer ${(await account.json()).token}` };
    const id = randomUUID();
    const form = () => {
      const body = new FormData();
      body.append("id", id);
      body.append("title", "La infancia");
      body.append("duration", "12");
      body.append(
        "audio",
        new Blob([Buffer.from("audio fixture")], { type: "audio/mp4" }),
        "audio.m4a",
      );
      return body;
    };
    assert.equal(
      (
        await fetch(`${url}/conversations`, {
          method: "POST",
          headers,
          body: form(),
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await fetch(`${url}/conversations`, {
          method: "POST",
          headers,
          body: form(),
        })
      ).status,
      200,
    );
    const library = await (await fetch(`${url}/library`, { headers })).json();
    assert.equal(library.conversations.length, 1);
    const documentForm = new FormData();
    documentForm.append("title", "Partida familiar");
    documentForm.append("kind", "Documento oficial");
    documentForm.append(
      "file",
      new Blob([Buffer.from("%PDF-1.7\nfixture")], { type: "application/pdf" }),
      "partida.pdf",
    );
    const uploadedDocument = await fetch(`${url}/documents`, {
      method: "POST",
      headers,
      body: documentForm,
    });
    assert.equal(uploadedDocument.status, 201);
    const documentId = (await uploadedDocument.json()).id;
    const documentLibrary = await (
      await fetch(`${url}/library`, { headers })
    ).json();
    assert.equal(documentLibrary.documents[0].id, documentId);
    const signedDocument = await (
      await fetch(`${url}/documents/${documentId}/file-url`, { headers })
    ).json();
    assert.equal(
      await (await fetch(`${url}${signedDocument.url}`)).text(),
      "%PDF-1.7\nfixture",
    );
    assert.equal(
      (await fetch(`${url}/document-file/${documentId}?expires=1&sig=bad`))
        .status,
      403,
    );
    const stranger = await fetch(`${url}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "OtraPersona",
        password: "strong-password-123",
      }),
    });
    const strangerHeaders = {
      Authorization: `Bearer ${(await stranger.json()).token}`,
    };
    assert.equal(
      (
        await fetch(`${url}/documents/${documentId}/file-url`, {
          headers: strangerHeaders,
        })
      ).status,
      404,
    );
    const signed = await (
      await fetch(`${url}/conversations/${id}/audio-url`, { headers })
    ).json();
    assert.equal(
      await (await fetch(`${url}${signed.url}`)).text(),
      "audio fixture",
    );
    assert.equal(
      (await fetch(`${url}/audio/${id}?expires=1&sig=bad`)).status,
      403,
    );
    const exported = await (await fetch(`${url}/export`, { headers })).json();
    assert.equal(exported.conversations[0].title, "La infancia");
    assert.equal(
      (
        await fetch(`${url}/conversations/${id}`, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Madrid" }),
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(`${url}/conversations/${id}`, { method: "DELETE", headers }))
        .status,
      200,
    );
    assert.equal(
      (
        await fetch(`${url}/documents/${documentId}`, {
          method: "DELETE",
          headers,
        })
      ).status,
      200,
    );
    assert.equal(
      (await (await fetch(`${url}/library`, { headers })).json()).conversations
        .length,
      0,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  }
});
