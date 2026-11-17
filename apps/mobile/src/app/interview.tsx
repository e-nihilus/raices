import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { formatTime } from "@raices/shared";
import { Badge, Button, Card, Copy, Screen, colors } from "../components/ui";
import { apiUrl, request } from "../lib/api";
import { persistAudio, removeAudio } from "../lib/audio-files";
import { useLibrary } from "../state/LibraryProvider";

type Clip = { uri: string; duration: number };
type Turn = { question: string; answer: string };
type Prompt = { question: string; speechUrl: string };
type Phase =
  "loading" | "speaking" | "ready" | "recording" | "processing" | "saving";

export default function Interview() {
  const lib = useLibrary();
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1,
    bitRate: 64000,
    sampleRate: 32000,
    web: { ...RecordingPresets.HIGH_QUALITY.web, bitsPerSecond: 64000 },
    directory: "document",
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<Clip | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const clips = useRef<Clip[]>([]);
  const conversationId = useRef(randomUUID());
  const starting = useRef(false);
  const silenceSince = useRef<number | null>(null);
  const turnLock = useRef(false);
  const autoAdvance = useRef(false);

  const loadFirst = useCallback(async () => {
    setPhase("loading");
    setError("");
    try {
      const next = await request<Prompt>("/interview/question", {
        method: "POST",
        body: JSON.stringify({ history: [] }),
      });
      setPrompt(next);
      setPhase("speaking");
      player.replace(`${apiUrl}${next.speechUrl}`);
      player.play();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo iniciar la entrevista",
      );
      setPhase("ready");
    }
  }, [player]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    if (!starting.current) {
      starting.current = true;
      void loadFirst();
    }
    return () => subscription.remove();
  }, [loadFirst]);

  useEffect(() => {
    const subscription = player.addListener(
      "playbackStatusUpdate",
      (status) => {
        if (status.didJustFinish)
          setPhase((current) => (current === "speaking" ? "ready" : current));
      },
    );
    return () => subscription.remove();
  }, [player]);

  const stopAnswer = useCallback(async (): Promise<Clip> => {
    const duration = recorderState.durationMillis / 1000;
    await recorder.stop();
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
    if (!recorder.uri) throw new Error("No se encuentra la respuesta grabada");
    const uri =
      Platform.OS === "web"
        ? recorder.uri
        : await persistAudio(recorder.uri, randomUUID(), "audio/mp4");
    const clip = { uri, duration };
    clips.current = [...clips.current, clip];
    setCount(clips.current.length);
    setPending(clip);
    return clip;
  }, [recorder, recorderState.durationMillis]);

  const addAudio = useCallback(async (data: FormData, clip: Clip) => {
    if (Platform.OS === "web")
      data.append(
        "audio",
        await (await fetch(clip.uri)).blob(),
        "respuesta.webm",
      );
    else
      data.append("audio", {
        uri: clip.uri,
        name: "respuesta.m4a",
        type: "audio/mp4",
      } as unknown as Blob);
  }, []);

  const processAnswer = useCallback(
    async (clip: Clip) => {
      if (!prompt) return;
      setPhase("processing");
      setError("");
      try {
        const data = new FormData();
        data.append("history", JSON.stringify(turns));
        data.append("question", prompt.question);
        await addAudio(data, clip);
        const next = await request<Prompt & { answer: string }>(
          "/interview/turn",
          { method: "POST", body: data },
          300_000,
        );
        setTurns((previous) => [
          ...previous,
          { question: prompt.question, answer: next.answer },
        ]);
        setPending(null);
        setPrompt(next);
        setPhase("speaking");
        player.replace(`${apiUrl}${next.speechUrl}`);
        player.play();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudo preparar la pregunta",
        );
        setPhase("ready");
      }
    },
    [prompt, turns, addAudio, player],
  );

  const record = useCallback(async () => {
    if (turnLock.current) return;
    turnLock.current = true;
    setError("");
    try {
      if (phase === "recording") {
        const clip = await stopAnswer();
        await processAnswer(clip);
        return;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error("Activa el permiso del micrófono para responder");
      player.pause();
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        allowsBackgroundRecording: Platform.OS !== "web",
        interruptionMode: "doNotMix",
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      silenceSince.current = null;
      autoAdvance.current = false;
      setPhase("recording");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo grabar");
      setPhase("ready");
    } finally {
      turnLock.current = false;
    }
  }, [phase, player, recorder, stopAnswer, processAnswer]);

  useEffect(() => {
    if (phase !== "recording" || turnLock.current || autoAdvance.current)
      return;
    if (recorderState.durationMillis >= 10 * 60_000) {
      autoAdvance.current = true;
      setTimeout(() => void record(), 0);
      return;
    }
    if (recorderState.durationMillis < 8000 || recorderState.metering == null)
      return;
    if (recorderState.metering > -48) {
      silenceSince.current = null;
      return;
    }
    if (silenceSince.current === null) silenceSince.current = Date.now();
    else if (Date.now() - silenceSince.current >= 3000) {
      silenceSince.current = null;
      autoAdvance.current = true;
      setTimeout(() => void record(), 0);
    }
  }, [phase, recorderState.durationMillis, recorderState.metering, record]);

  const finish = async () => {
    if (turnLock.current) return;
    turnLock.current = true;
    setError("");
    try {
      const wasRecording = phase === "recording";
      setPhase("saving");
      player.pause();
      if (wasRecording) await stopAnswer();
      if (!clips.current.length)
        throw new Error("Graba al menos una respuesta antes de guardar");
      const data = new FormData();
      data.append("id", conversationId.current);
      data.append(
        "duration",
        String(clips.current.reduce((sum, clip) => sum + clip.duration, 0)),
      );
      data.append("bookmarks", "[]");
      for (const clip of clips.current) await addAudio(data, clip);
      await request(
        "/interview/finish",
        { method: "POST", body: data },
        600_000,
      );
      await lib.refresh();
      for (const clip of clips.current) {
        if (Platform.OS === "web") URL.revokeObjectURL(clip.uri);
        else await removeAudio(clip.uri).catch(() => {});
      }
      router.replace({
        pathname: "/saved",
        params: { id: conversationId.current },
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar la entrevista",
      );
      setPhase("ready");
    } finally {
      turnLock.current = false;
    }
  };

  const busy =
    phase === "loading" || phase === "processing" || phase === "saving";
  return (
    <Screen title="Entrevista familiar">
      <Badge warm>
        {phase === "recording"
          ? "● Grabando respuesta"
          : phase === "speaking"
            ? "✦ Raíces está hablando"
            : "✦ Raíces acompaña la charla"}
      </Badge>
      <Card style={{ backgroundColor: "#fff2e7", borderWidth: 0 }}>
        <Copy kind="small" style={{ color: colors.terra }}>
          PREGUNTA DE RAÍCES
        </Copy>
        <Copy kind="heading">
          {prompt?.question || "Preparando la primera pregunta…"}
        </Copy>
        <Copy style={{ color: colors.muted }}>
          {phase === "speaking"
            ? "Escucha la pregunta y responde cuando termine."
            : phase === "processing"
              ? "Transcribiendo la respuesta y preparando otra pregunta…"
              : "Podéis responder con calma. La voz de Raíces no se añadirá al audio guardado."}
        </Copy>
        {prompt && phase !== "recording" && (
          <Button
            secondary
            label="Volver a escuchar"
            icon="play"
            disabled={busy}
            onPress={() =>
              void (async () => {
                await player.seekTo(0);
                setPhase("speaking");
                player.play();
              })()
            }
          />
        )}
      </Card>
      {phase === "recording" && (
        <Card>
          <Copy kind="heading">
            {formatTime(recorderState.durationMillis / 1000)}
          </Copy>
          <Copy>
            Contad el recuerdo con naturalidad. Tras una pausa de unos segundos,
            Raíces propondrá otra pregunta. También puedes terminar la respuesta
            manualmente.
          </Copy>
        </Card>
      )}
      {turns.length > 0 && (
        <Card>
          <Copy kind="small">ÚLTIMA RESPUESTA</Copy>
          <Copy>{turns.at(-1)?.answer}</Copy>
        </Card>
      )}
      {!!error && <Copy style={{ color: colors.terra }}>{error}</Copy>}
      {!prompt && (
        <Button
          label="Reintentar inicio"
          disabled={busy}
          onPress={() => void loadFirst()}
        />
      )}
      {pending ? (
        <Button
          label="Reintentar siguiente pregunta"
          disabled={busy}
          onPress={() => void processAnswer(pending)}
        />
      ) : (
        <Button
          label={
            phase === "recording" ? "Terminar respuesta" : "Grabar respuesta"
          }
          icon="mic"
          disabled={busy || !prompt || (count >= 20 && phase !== "recording")}
          onPress={() => void record()}
        />
      )}
      {count > 0 && (
        <Copy kind="small" style={{ textAlign: "center" }}>
          {count} {count === 1 ? "respuesta grabada" : "respuestas grabadas"}
        </Copy>
      )}
      <Button
        secondary
        label="Terminar y guardar entrevista"
        icon="check-circle"
        disabled={busy || (!count && phase !== "recording")}
        onPress={() => void finish()}
      />
      {!count && phase !== "recording" && (
        <Button
          secondary
          label="Salir de la entrevista"
          disabled={busy}
          onPress={() => router.back()}
        />
      )}
      <Copy kind="small" style={{ textAlign: "center" }}>
        La entrevista necesita conexión. ElevenLabs transcribe las respuestas y
        OpenAI prepara preguntas. Las respuestas se reúnen en un solo recuerdo
        al guardarlas.
      </Copy>
    </Screen>
  );
}
