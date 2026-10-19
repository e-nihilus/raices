import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Badge, Card, Copy, Icon, Screen, colors, styles } from "../../components/ui";
import { useLibrary } from "../../state/LibraryProvider";

export default function Archive() {
  const { data } = useLibrary();
  const [question, setQuestion] = useState("");
  const answer = useMemo(() => {
    const text = question.toLowerCase();
    const person = data.people.find((p) => text.includes(p.name.toLowerCase().split(" ")[0]));
    const conversation = person
      ? data.conversations.find((c) => c.claims.some((claim) => claim.personId === person.id) || c.events.some((event) => event.personIds.includes(person.id)))
      : data.conversations.find((c) => c.summary);
    return { person, conversation };
  }, [data, question]);
  const ask = (value: string) => setQuestion(value);
  return (
    <Screen>
      <Badge warm>▤ MEMORIA VIVA Y CONTRASTADA</Badge>
      <Copy kind="title">Consultar al Archivo Familiar</Copy>
      <Copy style={{ color: colors.muted }}>Pregunta por anécdotas, fechas y personas. Las respuestas se apoyan sólo en el archivo guardado.</Copy>
      <View style={{ gap: 9 }}>
        <Copy kind="label">Sugerencias para explorar</Copy>
        {["¿Qué sabemos de nuestra familia?", "¿Qué historias siguen sin comprobar?", "¿Qué documentos tenemos?"] .map((suggestion) => (
          <Pressable key={suggestion} onPress={() => ask(suggestion)} style={{ backgroundColor: colors.soft, padding: 14, borderRadius: 22 }}>
            <Copy>♡ {suggestion}</Copy>
          </Pressable>
        ))}
      </View>
      {question ? (
        <>
          <View style={{ alignSelf: "flex-end", maxWidth: "88%", backgroundColor: colors.primary, padding: 16, borderRadius: 18 }}><Copy style={{ color: "white" }}>{question}</Copy></View>
          <Card style={{ backgroundColor: "#e8f0e9", borderWidth: 0 }}>
            <View style={styles.row}><View style={styles.logo}><Icon name="zap" /></View><Copy kind="label">Archivo Raíces</Copy></View>
            <Copy kind="small" style={{ color: colors.terra }}>SEGÚN LOS RECUERDOS GUARDADOS</Copy>
            <Copy>
              {answer.conversation?.summary || "Aún no hay suficiente información en el archivo para responder con rigor. Graba o incorpora documentos para ampliar esta historia."}
            </Copy>
            {answer.person && <Badge>{answer.person.name}</Badge>}
            {answer.conversation && (
              <Pressable onPress={() => router.push({ pathname: "/memory/[id]", params: { id: answer.conversation!.id } })} style={{ paddingTop: 4 }}>
                <Copy kind="label" style={{ color: colors.primary }}>Ver fuente: {answer.conversation.title} →</Copy>
              </Pressable>
            )}
            <Copy kind="small">Esta respuesta no completa huecos ni convierte testimonios en hechos documentados.</Copy>
          </Card>
        </>
      ) : (
        <Card style={{ backgroundColor: "#e8f0e9", borderWidth: 0 }}>
          <Copy kind="heading">Un archivo que crece contigo</Copy>
          <Copy>Cuando haya conversaciones procesadas, podrás preguntar por personas, lugares y fuentes sin salir de la aplicación.</Copy>
        </Card>
      )}
      <View style={[styles.row, { backgroundColor: colors.white, borderRadius: 28, padding: 8, borderWidth: 1, borderColor: colors.line }]}>
        <TextInput value={question} onChangeText={setQuestion} placeholder="Escribe tu pregunta…" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1, borderWidth: 0, paddingVertical: 8 }]} />
        <Pressable accessibilityLabel="Enviar pregunta" onPress={() => setQuestion(question.trim())} style={{ width: 46, height: 46, borderRadius: 24, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}><Icon name="arrow-up" color="white" /></Pressable>
      </View>
      <Pressable onPress={() => router.push("/relic" as never)} style={{ alignItems: "center", padding: 8 }}><Copy kind="label" style={{ color: colors.primary }}>Añadir documento u objeto familiar</Copy></Pressable>
    </Screen>
  );
}
