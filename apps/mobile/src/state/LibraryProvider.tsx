import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { randomUUID } from "expo-crypto";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import type { Conversation, Library } from "@raices/shared";
import { apiUrl, request, supabase, uploadConversation } from "../lib/api";
import { persistAudio, removeAudio, shareJson } from "../lib/audio-files";
import { demoLibrary } from "../lib/demo";
const empty: Library = { conversations: [], people: [] };
function useLibraryState() {
  const [data, setData] = useState<Library>(empty),
    [loaded, setLoaded] = useState(false),
    [demo, setDemo] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [networkBusy, setNetworkBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [bookmarks, setBookmarks] = useState<number[]>([]),
    [user, setUser] = useState<string | null>(null),
    [aiConfigured, setAiConfigured] = useState(false);
  const current = useRef(data);
  const cacheKey = useRef("raices-library-local-v1");
  const uploading = useRef(new Set<string>());
  const actionLock = useRef(false);
  const scope = useRef(0);
  const commitQueue = useRef(Promise.resolve());
  const loadedIdentity = useRef<string | null | undefined>(undefined);
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1,
    bitRate: 64000,
    sampleRate: 32000,
    directory: "document",
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 250);
  const commit = useCallback(
    async (next: Library | ((previous: Library) => Library)) => {
      const key = cacheKey.current;
      const generation = scope.current;
      const task = commitQueue.current.then(async () => {
        if (generation !== scope.current) return;
        const value = typeof next === "function" ? next(current.current) : next;
        await AsyncStorage.setItem(key, JSON.stringify(value));
        if (generation !== scope.current) return;
        current.current = value;
        setData(value);
      });
      commitQueue.current = task.catch(() => {});
      await task;
    },
    [],
  );
  const run = useCallback(async (work: () => Promise<void>) => {
    setError("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la acción",
      );
    }
  }, []);
  const refresh = useCallback(async () => {
    if (!apiUrl) return;
    const generation = scope.current;
    const remote = await request<Library>("/library");
    if (generation !== scope.current) return;
    const ids = new Set(remote.conversations.map((c) => c.id));
    await commit((previous) => ({
      ...remote,
      conversations: [
        ...remote.conversations.map((c) => ({
          ...c,
          audioUri: previous.conversations.find((x) => x.id === c.id)?.audioUri,
        })),
        ...previous.conversations.filter(
          (c) => c.status === "local" && !ids.has(c.id),
        ),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }));
  }, [commit]);
  useEffect(() => {
    let active = true;
    async function load(nextIdentity: string | null) {
      if (loadedIdentity.current === nextIdentity) return;
      loadedIdentity.current = nextIdentity;
      setLoaded(false);
      const identity = nextIdentity;
      const key = `raices-library-${identity || "local"}-v1`;
      const generation = ++scope.current;
      const saved = await AsyncStorage.getItem(key);
      if (!active || generation !== scope.current) return;
      cacheKey.current = key;
      current.current = saved ? JSON.parse(saved) : empty;
      setData(current.current);
      setLoaded(true);
      setUser(identity);
    }
    void (async () => {
      await load(
        supabase
          ? (await supabase.auth.getSession()).data.session?.user.id || null
          : null,
      );
    })().catch(() => setError("No se pudo abrir la biblioteca local"));
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      void load(session?.user.id || null).catch(() =>
        setError("No se pudo abrir la biblioteca"),
      );
    });
    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!loaded || !apiUrl || (supabase && !user)) return;
    void refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "No se pudo actualizar"),
    );
    void fetch(`${apiUrl}/health`)
      .then((r) => r.json())
      .then((r) => setAiConfigured(r.aiConfigured))
      .catch(() => {});
    const timer = setInterval(() => {
      if (
        current.current.conversations.some((c) =>
          ["queued", "transcribing", "extracting"].includes(c.status),
        )
      )
        void run(refresh);
    }, 5000);
    return () => clearInterval(timer);
  }, [loaded, user, refresh, run]);
  const send = useCallback(
    async (c: Conversation) => {
      if (uploading.current.has(c.id)) return;
      uploading.current.add(c.id);
      setNetworkBusy(true);
      const generation = scope.current;
      try {
        const result = await uploadConversation(c);
        if (generation !== scope.current) return;
        const latest = current.current.conversations.find((x) => x.id === c.id);
        if (latest && latest.title !== c.title)
          await request(`/conversations/${c.id}`, {
            method: "PATCH",
            body: JSON.stringify({ title: latest.title }),
          });
        await commit((previous) => ({
          ...previous,
          conversations: previous.conversations.map((x) =>
            x.id === c.id ? { ...x, status: result.status, error: null } : x,
          ),
        }));
        await refresh();
      } finally {
        uploading.current.delete(c.id);
        setNetworkBusy(uploading.current.size > 0);
      }
    },
    [commit, refresh],
  );
  const save = async (
    uri: string,
    duration: number,
    mimeType: string,
    marks = bookmarks,
  ) => {
    const id = randomUUID();
    const audioUri = await persistAudio(uri, id, mimeType);
    const c: Conversation = {
      id,
      title: "Una conversación familiar",
      createdAt: new Date().toISOString(),
      duration,
      status: "local",
      summary: "",
      error: null,
      audioUri,
      mimeType,
      segments: [],
      claims: [],
      events: [],
      bookmarks: marks,
    };
    await commit((previous) => ({
      ...previous,
      conversations: [c, ...previous.conversations],
    }));
    setDemo(false);
    if (Platform.OS !== "web" && uri !== audioUri)
      await removeAudio(uri).catch(() => {});
    router.replace({ pathname: "/saved", params: { id } });
    if (apiUrl && (!supabase || user)) void run(() => send(c));
  };
  const start = async (mode: "listen" | "interview" = "listen") => {
    if (recording) {
      router.push({ pathname: "/recording", params: { mode } });
      return;
    }
    if (actionLock.current || !loaded) return;
    actionLock.current = true;
    setBusy(true);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Activa el permiso del micrófono en los ajustes del dispositivo",
        );
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        allowsBackgroundRecording: Platform.OS !== "web",
        interruptionMode: "doNotMix",
      });
      setBookmarks([]);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      router.push({ pathname: "/recording", params: { mode } });
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const finish = async () => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      const duration = recorderState.durationMillis / 1000;
      await recorder.stop();
      setRecording(false);
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      if (!recorder.uri) throw new Error("No se encuentra el audio grabado");
      await save(
        recorder.uri,
        duration,
        Platform.OS === "web" ? "audio/webm" : "audio/mp4",
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const importAudio = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const file = picked.assets[0];
    if ((file.size || 0) > 100 * 1024 * 1024)
      throw new Error("El archivo debe ocupar menos de 100 MB");
    setBookmarks([]);
    await save(file.uri, 0, file.mimeType || "audio/mp4", []);
  };
  const rename = async (id: string, title: string) => {
    const c = current.current.conversations.find((c) => c.id === id);
    if (!c) return;
    const name = title.trim();
    if (!name) return;
    if (c.status !== "local")
      await request(`/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: name }),
      });
    await commit((previous) => ({
      ...previous,
      conversations: previous.conversations.map((c) =>
        c.id === id ? { ...c, title: name } : c,
      ),
    }));
  };
  const remove = async (id: string) => {
    if (uploading.current.has(id))
      throw new Error(
        "Espera a que termine la subida antes de eliminar el recuerdo",
      );
    const c = current.current.conversations.find((c) => c.id === id);
    if (!c) return;
    if (c.status !== "local")
      await request(`/conversations/${id}`, { method: "DELETE" });
    if (c.audioUri) await removeAudio(c.audioUri);
    await commit((previous) => ({
      ...previous,
      conversations: previous.conversations.filter((c) => c.id !== id),
    }));
  };
  const exportData = async () =>
    shareJson(
      JSON.stringify(
        { ...current.current, exportedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
  const retry = async (c: Conversation) => {
    if (c.status === "local") await send(c);
    else {
      await request(`/conversations/${c.id}/retry`, { method: "POST" });
      await refresh();
    }
  };
  const merge = async (id: string, targetId: string) => {
    await request(`/people/${id}/merge`, {
      method: "POST",
      body: JSON.stringify({ targetId }),
    });
    await refresh();
  };
  const distinct = async (id: string) => {
    await request(`/people/${id}/distinct`, { method: "POST" });
    await refresh();
  };
  return {
    data: demo ? demoLibrary : data,
    actualData: data,
    demo,
    setDemo,
    loaded,
    error,
    setError,
    busy,
    networkBusy,
    recording,
    recorderState,
    user,
    aiConfigured,
    bookmarks,
    run,
    refresh,
    start,
    finish,
    importAudio,
    rename,
    remove,
    exportData,
    retry,
    merge,
    distinct,
    pause: () => recorder.pause(),
    resume: () => recorder.record(),
    bookmark: () =>
      setBookmarks((old) => [...old, recorderState.durationMillis / 1000]),
  };
}
type Context = ReturnType<typeof useLibraryState>;
const LibraryContext = createContext<Context | null>(null);
export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const value = useLibraryState();
  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}
export function useLibrary() {
  const value = useContext(LibraryContext);
  if (!value) throw new Error("Biblioteca no disponible");
  return value;
}
