import { sessionStorage } from "./session-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import type { Conversation } from "@raices/shared";
import { resolveAudio } from "./audio-files";
export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || "").replace(
  /\/$/,
  "",
);
export const supabase =
  process.env.EXPO_PUBLIC_SUPABASE_URL &&
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        {
          auth: {
            storage: sessionStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
          },
        },
      )
    : null;
async function token() {
  if (supabase)
    return (await supabase.auth.getSession()).data.session?.access_token || "";
  return process.env.EXPO_PUBLIC_DEV_API_TOKEN || "";
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!apiUrl)
    throw new Error("Configura la dirección del backend para conectar la IA");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await token()}`);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = "No se pudo conectar con el servidor";
      try {
        message = (await response.json()).error || message;
      } catch {}
      throw new Error(message);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
export async function uploadConversation(c: Conversation) {
  if (!c.audioUri) throw new Error("No se encuentra el audio original");
  const uri = await resolveAudio(c.audioUri);
  const data = new FormData();
  data.append("id", c.id);
  data.append("title", c.title);
  data.append("duration", String(c.duration));
  data.append("bookmarks", JSON.stringify(c.bookmarks));
  try {
    if (Platform.OS === "web")
      data.append(
        "audio",
        await (await fetch(uri)).blob(),
        `audio.${c.mimeType?.includes("webm") ? "webm" : "m4a"}`,
      );
    else
      data.append("audio", {
        uri,
        name: "audio.m4a",
        type: c.mimeType || "audio/mp4",
      } as unknown as Blob);
    return await request<{ id: string; status: Conversation["status"] }>(
      "/conversations",
      { method: "POST", body: data },
    );
  } finally {
    if (Platform.OS === "web" && uri.startsWith("blob:"))
      URL.revokeObjectURL(uri);
  }
}
export async function audioUrl(c: Conversation) {
  if (c.audioUri) return resolveAudio(c.audioUri);
  if (c.demo)
    throw new Error("Este recuerdo de ejemplo no contiene un audio real");
  const { url } = await request<{ url: string }>(
    `/conversations/${c.id}/audio-url`,
  );
  return url.startsWith("/") ? `${apiUrl}${url}` : url;
}
