import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewClaim } from "../src/ai.ts";

test("la revisión devuelve una propuesta sin aplicar cambios y conserva el contexto", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    const context = JSON.parse(body.input);
    assert.equal(context.answer, "Es mi tía abuela");
    assert.equal(context.relationshipType, "tía");
    return new Response(JSON.stringify({ id: "resp_test", object: "response", status: "completed", output: [{ type: "message", role: "assistant", id: "msg_test", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ message: "¿Quieres guardar esta corrección?", action: "correct", statement: "Sara es mi tía abuela", relationshipType: "tía abuela" }), annotations: [] }] }] }), { headers: { "content-type": "application/json" } });
  };
  try {
    const result = await reviewClaim({ statement: "Sara es mi tía", quote: "Sara es mi tía", relationshipType: "tía", answer: "Es mi tía abuela", history: [] });
    assert.equal(result.action, "correct");
    assert.equal(result.relationshipType, "tía abuela");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
});
