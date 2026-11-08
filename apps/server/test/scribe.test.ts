import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentsFromScribe, transcribe } from "../src/ai.ts";

const transcript = {
  text: "Hola Ana. Soy Pedro. Volví. Sí.",
  words: [
    { text: "Hola", start: 0, end: 0.4, type: "word", speaker_id: "speaker_0" },
    {
      text: " ",
      start: 0.4,
      end: 0.45,
      type: "spacing",
      speaker_id: "speaker_0",
    },
    {
      text: "Ana.",
      start: 0.45,
      end: 0.8,
      type: "word",
      speaker_id: "speaker_0",
    },
    {
      text: "Soy",
      start: 1.1,
      end: 1.3,
      type: "word",
      speaker_id: "speaker_1",
    },
    {
      text: " ",
      start: 1.3,
      end: 1.4,
      type: "spacing",
      speaker_id: "speaker_1",
    },
    {
      text: "Pedro.",
      start: 1.4,
      end: 1.8,
      type: "word",
      speaker_id: "speaker_1",
    },
    {
      text: "[aplausos]",
      start: 1.9,
      end: 2.2,
      type: "audio_event",
      speaker_id: null,
    },
    {
      text: "Volví.",
      start: 4.2,
      end: 4.5,
      type: "word",
      speaker_id: "speaker_1",
    },
    { text: "Sí.", start: 5, end: 5.3, type: "word", speaker_id: "speaker_0" },
  ],
};

test("Scribe conserva texto, tiempos e identidad anónima de cada voz", () => {
  const segments = segmentsFromScribe(transcript);
  assert.deepEqual(
    segments.map(({ text, start, end, speaker }) => ({
      text,
      start,
      end,
      speaker,
    })),
    [
      { text: "Hola Ana.", start: 0, end: 0.8, speaker: "Hablante 1" },
      { text: "Soy Pedro.", start: 1.1, end: 1.8, speaker: "Hablante 2" },
      { text: "Volví.", start: 4.2, end: 4.5, speaker: "Hablante 2" },
      { text: "Sí.", start: 5, end: 5.3, speaker: "Hablante 1" },
    ],
  );
  assert.equal(new Set(segments.map((s) => s.id)).size, segments.length);
});

test("envía el archivo completo a Scribe v2 con diarización", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = "test-key";
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.elevenlabs.io/v1/speech-to-text");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("xi-api-key"), "test-key");
    const form = init?.body as FormData;
    assert.equal(form.get("model_id"), "scribe_v2");
    assert.equal(form.get("diarize"), "true");
    assert.equal(form.get("tag_audio_events"), "false");
    assert.equal(form.get("timestamps_granularity"), "word");
    const file = form.get("file");
    assert.ok(file instanceof File);
    assert.equal(file.name, "recording.webm");
    assert.equal(file.type, "audio/webm");
    assert.equal(await file.text(), "audio de prueba");
    return new Response(JSON.stringify(transcript), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const segments = await transcribe(
      Buffer.from("audio de prueba"),
      "audio/webm",
    );
    assert.equal(segments[0].speaker, "Hablante 1");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = previousKey;
  }
});
