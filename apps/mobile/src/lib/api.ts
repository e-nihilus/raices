import { sessionStorage } from "./session-storage";
import { Platform } from "react-native";
import type { Conversation } from "@raices/shared";
import { resolveAudio } from "./audio-files";
export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || "").replace(
  /\/$/,
  "",
);
export type Account = { id: string; username: string };
const sessionKey = "raices-account-session-v1";
let activeSession: { user: Account; token: string } | null = null;
const authListeners = new Set<(user: Account | null) => void>();
function publishAuth() {
  for (const listener of authListeners) listener(activeSession?.user || null);
}
export function onAuthChange(listener: (user: Account | null) => void) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}
export async function restoreAuth() {
  if (!apiUrl) return null;
  const saved = await sessionStorage.getItem(sessionKey);
  if (!saved) return null;
  const session = JSON.parse(saved) as { user: Account; token: string };
  try {
    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (response.status === 401) {
      await sessionStorage.removeItem(sessionKey);
      return null;
    }
    if (!response.ok) throw new Error("No se pudo comprobar la sesión");
    activeSession = {
      user: (await response.json()).user,
      token: session.token,
    };
    publishAuth();
    return activeSession.user;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "No se pudo comprobar la sesión"
    )
      throw error;
    throw new Error("No se pudo conectar para comprobar la sesión");
  }
}
async function authRequest<T>(path: string, body: object): Promise<T> {
  if (!apiUrl) throw new Error("Configura la dirección del servidor");
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "No se pudo acceder a la cuenta");
  return result as T;
}
async function acceptSession(result: { user: Account; token: string }) {
  await sessionStorage.setItem(sessionKey, JSON.stringify(result));
  activeSession = result;
  publishAuth();
}
export async function register(username: string, password: string) {
  await acceptSession(
    await authRequest("/auth/register", { username, password }),
  );
}
export async function login(username: string, password: string) {
  await acceptSession(await authRequest("/auth/login", { username, password }));
}
export async function logout() {
  const token = activeSession?.token;
  activeSession = null;
  await sessionStorage.removeItem(sessionKey);
  publishAuth();
  if (token) {
    try {
      await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  }
}
export async function usernameAvailable(username: string) {
  if (!apiUrl) throw new Error("Configura la dirección del servidor");
  const response = await fetch(
    `${apiUrl}/auth/username-available?username=${encodeURIComponent(username)}`,
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "No se pudo comprobar el nombre");
  return Boolean(result.available);
}
async function token() {
  if (activeSession) return activeSession.token;
  return "";
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
