import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
export async function persistAudio(uri: string, id: string, mime: string) {
  const extension = mime.includes("webm")
    ? "webm"
    : mime.includes("mpeg")
      ? "mp3"
      : mime.includes("wav")
        ? "wav"
        : "m4a";
  const target = new File(Paths.document, `${id}.${extension}`);
  new File(uri).copy(target);
  return target.uri;
}
export async function resolveAudio(uri: string) {
  return uri;
}
export async function removeAudio(uri: string) {
  const file = new File(uri);
  if (file.exists) file.delete();
}
export async function shareJson(text: string) {
  const file = new File(Paths.cache, "raices-recuerdos.json");
  file.write(text);
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(file.uri, { mimeType: "application/json" });
  else throw new Error("No se puede compartir en este dispositivo");
}
export async function shareAudio(uri: string) {
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  else throw new Error("No se puede compartir en este dispositivo");
}
