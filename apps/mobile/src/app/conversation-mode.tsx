import { useState } from "react";
import { Pressable, View } from "react-native";
import { Badge, Button, Card, Copy, Icon, Screen, colors, styles } from "../components/ui";
import { useLibrary } from "../state/LibraryProvider";

type Mode = "listen" | "interview";

export default function ConversationMode() {
  const lib = useLibrary();
  const [mode, setMode] = useState<Mode>("listen");
  const select = (next: Mode) => setMode(next);
  return (
    <Screen back title="Modo grabación">
      <View style={{ gap: 10 }}>
        <Badge warm>⌂ MOMENTO EN FAMILIA</Badge>
        <Copy kind="title">¿Cómo prefieres acompañar esta charla?</Copy>
        <Copy style={{ color: colors.muted }}>
          Deja que la conversación fluya o permite que Raíces sugiera preguntas con voz suave.
        </Copy>
      </View>
      <Pressable accessibilityRole="radio" accessibilityState={{ selected: mode === "listen" }} onPress={() => select("listen")}>
        <Card style={{ backgroundColor: mode === "listen" ? "#e8f0e9" : colors.white, borderColor: mode === "listen" ? colors.primary : colors.line, gap: 16 }}>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <View style={styles.logo}><Icon name="headphones" size={25} /></View>
            {mode === "listen" && <View style={{ width: 32, height: 32, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}><Icon name="check" size={18} color="white" /></View>}
          </View>
          <View style={{ gap: 6 }}>
            <Copy kind="heading">Modo Escuchar</Copy>
            <Copy kind="small" style={{ color: colors.terra }}>RECOMENDADO PARA SOBREMESAS ESPONTÁNEAS</Copy>
            <Copy>Grabación discreta e ininterrumpida: el móvil permanece sobre la mesa sin emitir sonidos.</Copy>
          </View>
          <Copy kind="small">● Ideal para charlar con café y fotos viejas sin distracciones.</Copy>
        </Card>
      </Pressable>
      <Pressable accessibilityRole="radio" accessibilityState={{ selected: mode === "interview" }} onPress={() => select("interview")}>
        <Card style={{ backgroundColor: mode === "interview" ? "#fff2e7" : colors.white, borderColor: mode === "interview" ? colors.terra : colors.line, gap: 16 }}>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <View style={[styles.logo, { backgroundColor: colors.peach }]}><Icon name="star" size={23} color={colors.terra} /></View>
            {mode === "interview" && <View style={{ width: 32, height: 32, borderRadius: 18, backgroundColor: colors.terra, alignItems: "center", justifyContent: "center" }}><Icon name="check" size={18} color="white" /></View>}
          </View>
          <View style={{ gap: 6 }}>
            <Copy kind="heading">Modo Entrevistar</Copy>
            <Copy kind="small" style={{ color: colors.primary }}>GUIADO CON IA CARIÑOSA</Copy>
            <Copy>Cuando haya un silencio o una historia incompleta, Raíces propone preguntas basadas en lo que se va contando.</Copy>
          </View>
          <Card style={{ padding: 14, backgroundColor: "#f5f1eb", borderWidth: 0 }}>
            <Copy style={{ fontFamily: "NewsreaderItalic" }}>“¿Cómo era la casa de tu madre en Jaén?”</Copy>
          </Card>
        </Card>
      </Pressable>
      <Button
        label="Empezar conversación"
        icon="play"
        loading={lib.busy}
        onPress={() => void lib.run(() => lib.start(mode))}
      />
      <Copy kind="small" style={{ textAlign: "center" }}>
        Tus recuerdos se tratan de forma privada. La entrevista conversacional se activará al configurar el proveedor de voz.
      </Copy>
    </Screen>
  );
}
