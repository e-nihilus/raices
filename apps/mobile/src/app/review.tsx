import { useEffect, useState } from "react";
import { Platform, TextInput, View } from "react-native";
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { router } from "expo-router";
import { Badge, Button, Card, Copy, Screen, colors, styles } from "../components/ui";
import { request } from "../lib/api";
import { useLibrary } from "../state/LibraryProvider";

type Turn = { role: "user" | "assistant"; text: string };
type Proposal = { message: string; action: "clarify" | "confirm" | "correct" | "skip"; statement: string | null; relationshipType: string | null; relationshipId: string | null; originalStatement: string };

export default function Review() {
  const lib = useLibrary();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const claims = lib.data.conversations.flatMap((conversation) => conversation.claims.map((claim) => ({ claim, title: conversation.title }))).filter(({ claim }) => claim.certainty !== "confirmed" && !skipped.includes(claim.id));
  const current = claims[0];
  useEffect(() => { setTurns([]); setAnswer(""); setProposal(null); setError(""); }, [current?.claim.id]);
  const record = async () => {
    setError("");
    try {
      if (!recording) {
        if (lib.recording) throw new Error("Termina primero la grabación que tienes en curso.");
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) throw new Error("Activa el permiso del micrófono para grabar tu respuesta.");
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync(); recorder.record(); setRecording(true);
      } else {
        setBusy(true);
        await recorder.stop(); setRecording(false);
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
        if (!recorder.uri) throw new Error("No se encuentra la grabación.");
        const data = new FormData();
        if (Platform.OS === "web") data.append("audio", await (await fetch(recorder.uri)).blob(), "respuesta.webm");
        else data.append("audio", { uri: recorder.uri, name: "respuesta.m4a", type: "audio/mp4" } as unknown as Blob);
        const result = await request<{ text: string }>("/review/transcribe", { method: "POST", body: data });
        setAnswer(result.text);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo grabar"); }
    finally { setBusy(false); }
  };
  return <Screen back title="Revisar recuerdos">
    {!current ? <Card><Copy kind="heading">No quedan datos por revisar</Copy><Copy>Los datos que hayas dejado para más tarde seguirán pendientes en Recuerdos.</Copy><Button label="Volver a recuerdos" onPress={() => router.back()} /></Card> : <>
      <Badge>{claims.length} pendientes en esta revisión</Badge>
      <Card>
        <Copy kind="small">Del recuerdo: {current.title}</Copy>
        <Copy kind="heading">¿Es correcto este dato?</Copy>
        <Copy>{current.claim.statement}</Copy>
        <Copy kind="small">Cita original: “{current.claim.quote}”</Copy>
      </Card>
      {turns.map((turn, i) => <Card key={i} style={{ backgroundColor: turn.role === "assistant" ? colors.soft : colors.white }}><Copy kind="small">{turn.role === "assistant" ? "Raíces" : "Tú"}</Copy><Copy>{turn.text}</Copy></Card>)}
      {proposal && (proposal.action === "confirm" || (proposal.action === "correct" && proposal.statement)) && <Card>
        <Copy kind="heading">Comprueba antes de guardar</Copy>
        <Copy>{proposal.action === "confirm" ? proposal.originalStatement : proposal.statement}</Copy>
        {proposal.relationshipType && <Copy kind="small">Parentesco propuesto: {proposal.relationshipType}</Copy>}
        <Copy kind="small">Se confirmará esta afirmación{proposal.relationshipType ? " y se actualizará el vínculo indicado" : ""}. El audio y la cita original no cambian; otros resúmenes no se actualizan automáticamente.</Copy>
        <Button label="Confirmar y guardar" disabled={busy} onPress={() => void (async () => {
          setBusy(true); setError("");
          try {
            await request(`/claims/${current.claim.id}/review/apply`, { method: "POST", body: JSON.stringify({ originalStatement: proposal.originalStatement, statement: proposal.action === "confirm" ? proposal.originalStatement : proposal.statement, relationshipId: proposal.relationshipId, relationshipType: proposal.relationshipType }) });
            await lib.refresh();
          } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
          finally { setBusy(false); }
        })()} />
        <Button secondary label="Seguir aclarando" onPress={() => setProposal(null)} />
      </Card>}
      {!proposal && <>
        <TextInput accessibilityLabel="Tu respuesta" value={answer} onChangeText={setAnswer} placeholder="Sí, o cuéntame qué hay que corregir…" multiline style={styles.input} />
        <Copy kind="small">Puedes escribir o grabar. La grabación se envía a ElevenLabs para transcribirla; la respuesta y la cita se envían a OpenAI para interpretarlas. Revisa el texto antes de enviarlo.</Copy>
        <Button secondary label={recording ? "Terminar grabación" : "Grabar respuesta"} icon="mic" disabled={busy} onPress={() => void record()} />
        <Button label="Enviar respuesta" icon="send" disabled={busy || recording || !answer.trim()} onPress={() => void (async () => {
          setBusy(true); setError("");
          try {
            const result = await request<Proposal>(`/claims/${current.claim.id}/review`, { method: "POST", body: JSON.stringify({ answer, history: turns.slice(-12) }) });
            setTurns((previous) => [...previous, { role: "user", text: answer }, { role: "assistant", text: result.message }]);
            setAnswer("");
            if (result.action === "confirm" || (result.action === "correct" && result.statement)) setProposal(result);
            else if (result.action === "skip") setSkipped((previous) => [...previous, current.claim.id]);
          } catch (e) { setError(e instanceof Error ? e.message : "No se pudo enviar"); }
          finally { setBusy(false); }
        })()} />
      </>}
      {!!error && <Copy style={{ color: colors.terra }}>{error}</Copy>}
      <View><Button secondary label="Dejar para más tarde" disabled={busy || recording} onPress={() => setSkipped((previous) => [...previous, current.claim.id])} /></View>
    </>}
  </Screen>;
}
