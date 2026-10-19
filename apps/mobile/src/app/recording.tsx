import { useEffect } from "react";
import { BackHandler, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { formatTime } from "@raices/shared";
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
export default function Recording() {
  const lib = useLibrary();
  const { mode } = useLocalSearchParams<{ mode?: "listen" | "interview" }>();
  const interviewing = mode === "interview";
  const paused = !lib.recorderState.isRecording;
  useEffect(() => {
    const handler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => handler.remove();
  }, []);
  if (!lib.recording)
    return (
      <Screen title="Grabación">
        <Copy>No hay una grabación en curso.</Copy>
        <Button label="Volver al inicio" onPress={() => router.replace("/")} />
      </Screen>
    );
  return (
    <Screen title={interviewing ? "Entrevista en curso" : "Grabación en curso"}>
      <View style={{ alignItems: "center", gap: 20, paddingTop: 12 }}>
        <Badge warm>
          {paused
            ? "Ⅱ Grabación pausada"
            : interviewing
              ? "✦ Raíces acompaña la charla"
              : "● Grabando en curso"}
        </Badge>
        <Copy kind="small" style={{ letterSpacing: 2, marginTop: 16 }}>
          UN NUEVO RECUERDO
        </Copy>
        <Copy
          kind="title"
          style={{ textAlign: "center", fontFamily: "NewsreaderItalic" }}
        >
          Una voz que merece{"\n"}quedarse contigo
        </Copy>
        <Copy
          style={{
            fontFamily: "Newsreader",
            fontSize: 64,
            lineHeight: 76,
            marginTop: 18,
          }}
        >
          {formatTime(lib.recorderState.durationMillis / 1000)}
        </Copy>
        <View style={styles.row}>
          <Icon name="mic" size={18} />
          <Copy style={{ color: colors.primary }}>
            {paused
              ? "Tómate todo el tiempo que necesites"
              : interviewing
                ? "Preparando preguntas al ritmo de la familia"
                : "Escuchando vuestra conversación"}
          </Copy>
        </View>
      </View>
      <Card
        style={{
          backgroundColor: colors.soft,
          paddingVertical: 28,
          borderWidth: 0,
        }}
      >
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Copy kind="label">Ondas de voz</Copy>
          <Copy kind="small">{paused ? "En pausa" : "Micrófono activo"}</Copy>
        </View>
        <View
          accessibilityLabel="Indicador del nivel de micrófono"
          style={{
            height: 100,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 5,
            marginVertical: 16,
          }}
        >
          {Array.from({ length: 22 }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                maxWidth: 9,
                borderRadius: 6,
                backgroundColor: i % 4 === 0 ? colors.primary : colors.sage,
                height: paused
                  ? 8
                  : 14 +
                    Math.abs(Math.sin(i * 1.8)) *
                      Math.max(
                        10,
                        Math.min(70, (lib.recorderState.metering ?? -40) + 80),
                      ),
              }}
            />
          ))}
        </View>
        <Copy style={{ textAlign: "center", color: colors.muted }}>
          Habla con naturalidad. Los pequeños detalles también forman parte de
          la historia.
        </Copy>
      </Card>
      {interviewing && (
        <Card style={{ backgroundColor: "#fff2e7", borderWidth: 0 }}>
          <Copy kind="small" style={{ color: colors.terra }}>
            PRÓXIMA PREGUNTA SUGERIDA
          </Copy>
          <Copy kind="heading">¿Qué recuerdas de aquella casa?</Copy>
          <Copy style={{ color: colors.muted }}>
            Raíces espera un momento natural para preguntar, sin interrumpir.
          </Copy>
        </Card>
      )}
      <Card style={{ backgroundColor: "#eaf0e9", borderWidth: 0 }}>
        <View style={[styles.row, { alignItems: "flex-start" }]}>
          <Icon name="coffee" />
          <View style={{ flex: 1, gap: 8 }}>
            <Copy kind="label">Puedes apoyar el móvil sobre la mesa</Copy>
            <Copy style={{ color: colors.muted }}>
              No hace falta sostenerlo. Haz una pausa cuando queráis descansar o
              recordar con calma.
            </Copy>
          </View>
        </View>
      </Card>
      <View style={styles.row}>
        <Button
          secondary
          label={paused ? "Continuar" : "Pausar"}
          icon={paused ? "play" : "pause"}
          onPress={paused ? lib.resume : lib.pause}
          style={{ flex: 1 }}
        />
        <Button
          secondary
          label="Hito clave"
          icon="bookmark"
          onPress={lib.bookmark}
          style={{ flex: 1 }}
        />
      </View>
      {lib.bookmarks.length > 0 && (
        <Copy kind="small" style={{ textAlign: "center" }}>
          {lib.bookmarks.length} momentos marcados
        </Copy>
      )}
      <Button
        label="Terminar y guardar recuerdo"
        icon="check-circle"
        onPress={() => void lib.run(lib.finish)}
        loading={lib.busy}
      />
      <Copy kind="small" style={{ textAlign: "center" }}>
        El audio se conserva en este dispositivo al terminar.
      </Copy>
    </Screen>
  );
}
