import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { dataDir } from "./db.ts";
export const cloud =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
    : null;
export const audioDir = join(dataDir, "audio");
export async function saveAudio(path: string, buffer: Buffer, mime: string) {
  if (cloud) {
    const { error } = await cloud.storage
      .from("family-audio")
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (error) throw error;
  } else {
    await mkdir(join(audioDir, path.split("/")[0]), { recursive: true });
    await writeFile(join(audioDir, path), buffer, { mode: 0o600, flag: "wx" });
  }
}
export async function readAudio(path: string) {
  if (cloud) {
    const { data, error } = await cloud.storage
      .from("family-audio")
      .download(path);
    if (error) throw error;
    return Buffer.from(await data!.arrayBuffer());
  }
  return readFile(join(audioDir, path));
}
export async function deleteAudio(path: string) {
  if (cloud) {
    const { error } = await cloud.storage.from("family-audio").remove([path]);
    if (error) throw error;
  } else await rm(join(audioDir, path), { force: true });
}
