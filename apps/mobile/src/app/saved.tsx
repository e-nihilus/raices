import { useState } from "react";
import { TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Copy,
  Icon,
  Screen,
  colors,
  styles,
} from "../components/ui";
import { useLibrary } from "../state/LibraryProvider";
export default function Saved() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lib = useLibrary();
  const c = lib.actualData.conversations.find((c) => c.id === id);
  const [title, setTitle] = useState("");
  if (!c)
    return (
      <Screen>
        <Copy>No se encuentra el recuerdo.</Copy>
        <Button label="Volver al inicio" onPress={() => router.replace("/")} />
      </Screen>
    );
  return (
    <Screen title="Resumen de conversación">
      <View style={{ alignItems: "center", gap: 22, paddingTop: 12 }}>
        <View
          style={{
            width: 114,
            height: 114,
            borderRadius: 65,
            backgroundColor: colors.mint,
            borderWidth: 10,
            borderColor: "#e7f4e9",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="check-circle" size={48} />
        </View>
        <Copy kind="title" style={{ textAlign: "center" }}>
          {c.title === "Una conversación familiar"
            ? "Tu conversación está a salvo"
            : c.title}
        </Copy>
        <Badge>
          {lib.networkBusy
            ? "Subiendo al servidor…"
            : c.status === "local"
              ? "Guardada en este dispositivo"
              : "Audio guardado en el servidor"}
        </Badge>
      </View>
      <Card>
        <Copy kind="label">Título de la charla · Opcional</Copy>
        <TextInput
          accessibilityLabel="Título de la conversación"
          placeholder="Ej.: Tardes de verano en el pueblo"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <Button
          secondary
          label="Guardar título"
          icon="edit-3"
          onPress={() => void lib.run(() => lib.rename(c.id, title))}
          disabled={!title.trim()}
        />
      </Card>
      <Card style={{ backgroundColor: colors.soft, borderWidth: 0 }}>
        <View style={styles.row}>
          <Icon name="sun" color={colors.terra} />
          <Copy kind="heading">
            {c.status === "local"
              ? "La voz original, conservada"
              : c.status === "ready"
                ? "Recuerdos organizados"
                : "Organizando los recuerdos"}
          </Copy>
        </View>
        <Copy style={{ color: colors.muted }}>
          {c.status === "local"
            ? "Puedes escuchar este audio sin conexión. Cuando conectes el backend, podrás enviarlo para transcribirlo y extraer personas y acontecimientos."
            : lib.aiConfigured
              ? "El servidor procesará el audio y vinculará cada dato con su fragmento original. Puedes salir de esta pantalla."
              : "El audio está en el servidor. Añade la clave de IA para iniciar la transcripción y la extracción de recuerdos."}
        </Copy>
      </Card>
      <Card style={{ backgroundColor: "#e8f0e9", borderWidth: 0 }}>
        <View style={styles.row}>
          <Icon name="zap" color={colors.terra} />
          <Copy kind="heading">Lo que Raíces organizará</Copy>
        </View>
        <Copy style={{ color: colors.muted }}>
          La transcripción conservará fragmentos, personas, lugares y acontecimientos con su fuente. Todo dato nuevo quedará pendiente de revisión.
        </Copy>
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          <Badge>{c.segments.length} fragmentos</Badge>
          <Badge warm>{c.claims.length} datos detectados</Badge>
          <Badge>{c.events.length} acontecimientos</Badge>
        </View>
      </Card>
      <Card style={{ backgroundColor: "#fff2e7", borderWidth: 0 }}>
        <Copy kind="heading">Para la próxima sobremesa</Copy>
        <Copy style={{ color: colors.muted }}>
          Cuando termine el análisis, Raíces propondrá preguntas para completar recuerdos y contrastar datos con la familia.
        </Copy>
      </Card>
      <Button
        label="Volver al inicio"
        icon="home"
        onPress={() => router.replace("/")}
      />
      <Button
        secondary
        label="Ver conversación y fuentes"
        icon="book-open"
        onPress={() =>
          router.replace({ pathname: "/memory/[id]", params: { id: c.id } })
        }
      />
    </Screen>
  );
}
