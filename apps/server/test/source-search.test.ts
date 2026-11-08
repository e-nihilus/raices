import { test } from "node:test";
import assert from "node:assert/strict";
import { searchSources } from "../src/ai.ts";

test("la búsqueda conserva las citas válidas y no guarda la respuesta en OpenAI", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.tools[0].type, "web_search");
    return new Response(JSON.stringify({
      id: "resp_test", object: "response", status: "completed",
      output: [{ type: "message", id: "msg_test", role: "assistant", status: "completed", content: [{
        type: "output_text", text: "Una fuente confirma el hecho.", annotations: [
          { type: "url_citation", url: "https://example.org/fuente", title: "Fuente", start_index: 4, end_index: 10 },
          { type: "url_citation", url: "javascript:alert(1)", title: "Inválida", start_index: 4, end_index: 10 },
        ],
      }] }],
    }), { headers: { "content-type": "application/json" } });
  };
  try {
    const result = await searchSources("Una afirmación para buscar");
    assert.equal(result.text, "Una fuente confirma el hecho.");
    assert.deepEqual(result.citations, [{ url: "https://example.org/fuente", title: "Fuente", start: 4, end: 10 }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
