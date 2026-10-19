const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("raices-audio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("audio");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function persistAudio(uri: string, id: string, _mime: string) {
  const blob = await (await fetch(uri)).blob();
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("audio", "readwrite");
    tx.objectStore("audio").put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  db.close();
  return `idb:${id}`;
}
export async function resolveAudio(uri: string) {
  if (!uri.startsWith("idb:")) return uri;
  const db = await database();
  const blob = await new Promise<Blob>((resolve, reject) => {
    const req = db.transaction("audio").objectStore("audio").get(uri.slice(4));
    req.onsuccess = () =>
      req.result
        ? resolve(req.result)
        : reject(new Error("No se encuentra el audio local"));
    req.onerror = () => reject(req.error);
  });
  db.close();
  return URL.createObjectURL(blob);
}
export async function removeAudio(uri: string) {
  if (!uri.startsWith("idb:")) return;
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("audio", "readwrite");
    tx.objectStore("audio").delete(uri.slice(4));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
function download(url: string, name: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function shareJson(text: string) {
  download(
    URL.createObjectURL(new Blob([text], { type: "application/json" })),
    "raices-recuerdos.json",
  );
}
export async function shareAudio(uri: string) {
  const url = await resolveAudio(uri);
  download(url, "raices-audio");
}
