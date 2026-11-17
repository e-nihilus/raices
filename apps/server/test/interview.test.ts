import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import {
  combineInterviewAudio,
  interviewConfigured,
  nextInterviewQuestion,
  speakInterviewQuestion,
} from "../src/interview.ts";
import { createDatabase } from "../src/db.ts";
import { createApp } from "../src/app.ts";

const exec = promisify(execFile);

test("la voz de la entrevista usa ElevenLabs con la clave sólo en el servidor", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.ELEVENLABS_API_KEY;
  const oldVoice = process.env.ELEVENLABS_VOICE_ID;
  process.env.ELEVENLABS_API_KEY = "test-key";
  process.env.ELEVENLABS_VOICE_ID = "test-voice";
  globalThis.fetch = async (url, init) => {
    assert.equal(
      url,
      "https://api.elevenlabs.io/v1/text-to-speech/test-voice?output_format=mp3_44100_128",
    );
    assert.equal(new Headers(init?.headers).get("xi-api-key"), "test-key");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      text: "¿Cómo era aquella casa?",
      model_id: "eleven_multilingual_v2",
    });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  };
  try {
    assert.deepEqual(
      await speakInterviewQuestion("¿Cómo era aquella casa?"),
      Buffer.from([1, 2, 3]),
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = oldKey;
    if (oldVoice === undefined) delete process.env.ELEVENLABS_VOICE_ID;
    else process.env.ELEVENLABS_VOICE_ID = oldVoice;
  }
});

test("la siguiente pregunta usa el relato previo sin guardar la respuesta en OpenAI", async () => {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.deepEqual(JSON.parse(body.input), [
      {
        question: "¿Dónde vivías?",
        answer: "En una casa de Jaén con mi madre.",
      },
    ]);
    return new Response(
      JSON.stringify({
        id: "resp_test",
        object: "response",
        status: "completed",
        output: [
          {
            type: "message",
            role: "assistant",
            id: "msg_test",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  question: "¿Cómo era aquella casa de Jaén?",
                }),
                annotations: [],
              },
            ],
          },
        ],
      }),
      { headers: { "content-type": "application/json" } },
    );
  };
  try {
    assert.equal(
      await nextInterviewQuestion([
        {
          question: "¿Dónde vivías?",
          answer: "En una casa de Jaén con mi madre.",
        },
      ]),
      "¿Cómo era aquella casa de Jaén?",
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
});

test("une las respuestas por orden en un único MP3 reproducible", async () => {
  const clips = await Promise.all(
    [440, 880].map(async (frequency) => {
      const { stdout } = await exec(
        "ffmpeg",
        [
          "-nostdin",
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "lavfi",
          "-i",
          `sine=frequency=${frequency}:duration=0.4`,
          "-c:a",
          "aac",
          "-movflags",
          "frag_keyframe+empty_moov",
          "-f",
          "mp4",
          "pipe:1",
        ],
        { encoding: "buffer" },
      );
      return { buffer: stdout as Buffer, mime: "audio/mp4" };
    }),
  );
  const output = await combineInterviewAudio(clips);
  assert.equal(output.subarray(0, 3).toString(), "ID3");
  assert.ok(output.length > 1000);
});

test("la entrevista exige las claves de ambos proveedores", () => {
  const oldOpenAI = process.env.OPENAI_API_KEY;
  const oldEleven = process.env.ELEVENLABS_API_KEY;
  delete process.env.OPENAI_API_KEY;
  process.env.ELEVENLABS_API_KEY = "test-key";
  try {
    assert.equal(interviewConfigured(), false);
  } finally {
    if (oldOpenAI === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldOpenAI;
    if (oldEleven === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = oldEleven;
  }
});

test("el cierre guarda una entrevista y el reintento no la duplica", async () => {
  const db = createDatabase(":memory:");
  const server = createApp(db).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const url = `http://127.0.0.1:${address.port}`;
  const id = randomUUID();
  try {
    const account = await fetch(`${url}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "EntrevistaTest",
        password: "strong-password-123",
      }),
    });
    assert.equal(account.status, 201);
    const headers = { Authorization: `Bearer ${(await account.json()).token}` };
    const { stdout } = await exec(
      "ffmpeg",
      [
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=0.4",
        "-c:a",
        "aac",
        "-movflags",
        "frag_keyframe+empty_moov",
        "-f",
        "mp4",
        "pipe:1",
      ],
      { encoding: "buffer" },
    );
    const form = () => {
      const data = new FormData();
      data.append("id", id);
      data.append("duration", "0.8");
      data.append("bookmarks", "[]");
      data.append(
        "audio",
        new Blob([new Uint8Array(stdout as Buffer)], { type: "audio/mp4" }),
        "uno.m4a",
      );
      data.append(
        "audio",
        new Blob([new Uint8Array(stdout as Buffer)], { type: "audio/mp4" }),
        "dos.m4a",
      );
      return data;
    };
    assert.equal(
      (
        await fetch(`${url}/interview/finish`, {
          method: "POST",
          headers,
          body: form(),
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await fetch(`${url}/interview/finish`, {
          method: "POST",
          headers,
          body: form(),
        })
      ).status,
      200,
    );
    const library = await (await fetch(`${url}/library`, { headers })).json();
    assert.equal(
      library.conversations.filter(
        (conversation: { id: string }) => conversation.id === id,
      ).length,
      1,
    );
    const signed = await (
      await fetch(`${url}/conversations/${id}/audio-url`, { headers })
    ).json();
    const audio = Buffer.from(
      await (await fetch(`${url}${signed.url}`)).arrayBuffer(),
    );
    assert.equal(audio.subarray(0, 3).toString(), "ID3");
    assert.equal(
      (await fetch(`${url}/conversations/${id}`, { method: "DELETE", headers }))
        .status,
      200,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  }
});
