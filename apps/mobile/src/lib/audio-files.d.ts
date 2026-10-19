export function persistAudio(
  uri: string,
  id: string,
  mime: string,
): Promise<string>;
export function resolveAudio(uri: string): Promise<string>;
export function removeAudio(uri: string): Promise<void>;
export function shareJson(text: string): Promise<void>;
export function shareAudio(uri: string): Promise<void>;
