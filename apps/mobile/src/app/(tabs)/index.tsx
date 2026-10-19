import { useRef, useState } from "react";
import { Modal, Pressable, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Copy,
  Icon,
  Screen,
  colors,
  styles,
} from "../../components/ui";
import { MemoryCard } from "../../components/MemoryCard";
import { demoUser } from "../../lib/demo";
import { useLibrary } from "../../state/LibraryProvider";
export default function Home() {
  const lib = useLibrary();
  const [mode, setMode] = useState<"listen" | "interview">("listen");
  const [modeOpen, setModeOpen] = useState(false);
  const [modePosition, setModePosition] = useState({ top: 0, left: 0 });
  const modeButton = useRef<View>(null);
  const { width: windowWidth } = useWindowDimensions();
  const openModePicker = () => {
    modeButton.current?.measureInWindow((x, y, width) => {
      setModePosition({
        top: Math.max(12, y - 140),
        left: Math.max(12, Math.min(windowWidth - 266, x + width / 2 - 127)),
      });
      setModeOpen(true);
    });
  };
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 13, paddingTop: 6 }}>
        <Badge>♧ EL SANTUARIO DE LA MEMORIA</Badge>
        <Copy kind="title" style={{ textAlign: "center", maxWidth: 340 }}>
          Cada conversación{"\n"}guarda una historia
        </Copy>
        <Copy
          style={{ textAlign: "center", color: colors.muted, maxWidth: 300 }}
        >
          Escucha, conversa y guarda sus recuerdos con calma y cariño.
        </Copy>
      </View>
      <View
        style={{
          alignItems: "center",
          paddingTop: 24,
          paddingBottom: 8,
          gap: 8,
        }}
      >
        <View style={{ width: 254, alignItems: "center" }}>
          <Pressable
            ref={modeButton}
            accessibilityRole="button"
            accessibilityLabel={`Modo de grabación: ${mode === "listen" ? "Conversación" : "Entrevista"}`}
            accessibilityState={{ expanded: modeOpen }}
            onPress={openModePicker}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingHorizontal: 16,
              paddingVertical: 9,
              borderRadius: 22,
              backgroundColor: pressed ? "#e2ece4" : colors.soft,
            })}
          >
            <Copy kind="small" style={{ color: colors.primary }}>
              Modo: {mode === "listen" ? "Conversación" : "Entrevista"}
            </Copy>
            <Icon name={modeOpen ? "chevron-up" : "chevron-down"} size={16} />
          </Pressable>
        </View>
        <Modal
          visible={modeOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setModeOpen(false)}
        >
          <View style={{ flex: 1 }}>
            <Pressable
              accessibilityLabel="Cerrar selección de modo"
              onPress={() => setModeOpen(false)}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              }}
            />
            <View
              style={{
                position: "absolute",
                top: modePosition.top,
                left: modePosition.left,
                width: 254,
                padding: 8,
                borderRadius: 20,
                backgroundColor: colors.white,
                borderWidth: 1,
                borderColor: colors.line,
                boxShadow: "0px 8px 22px rgba(56,86,69,0.14)",
              }}
            >
              {(
                [
                  {
                    value: "listen",
                    label: "Conversación",
                    icon: "headphones",
                    detail: "Escuchar sin interrumpir",
                  },
                  {
                    value: "interview",
                    label: "Entrevista",
                    icon: "star",
                    detail: "Preguntas sugeridas",
                  },
                ] as const
              ).map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: mode === option.value }}
                  onPress={() => {
                    setMode(option.value);
                    setModeOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    padding: 10,
                    borderRadius: 13,
                    backgroundColor:
                      mode === option.value
                        ? colors.soft
                        : pressed
                          ? "#f7f9f6"
                          : colors.white,
                  })}
                >
                  <Icon name={option.icon} size={20} />
                  <View style={{ flex: 1 }}>
                    <Copy kind="label" style={{ fontSize: 14 }}>
                      {option.label}
                    </Copy>
                    <Copy kind="small" style={{ fontSize: 11 }}>
                      {option.detail}
                    </Copy>
                  </View>
                  {mode === option.value && <Icon name="check" size={18} />}
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>
        <View
          style={{
            width: 254,
            height: 254,
            borderRadius: 140,
            backgroundColor: "#f0f5f0",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 224,
              height: 224,
              borderRadius: 120,
              backgroundColor: "#e8efea",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 194,
                height: 194,
                borderRadius: 100,
                backgroundColor: "#dceddf",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Pressable
                disabled={lib.busy || !lib.loaded}
                accessibilityRole="button"
                accessibilityLabel="Empezar a grabar"
                onPress={() => void lib.run(() => lib.start(mode))}
                style={({ pressed }) => ({
                  width: 160,
                  height: 160,
                  borderRadius: 85,
                  backgroundColor: colors.sage,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 13,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                  opacity: lib.busy ? 0.5 : 1,
                  boxShadow: "0px 8px 18px rgba(56,86,69,0.18)",
                })}
              >
                <View
                  style={{
                    width: 146,
                    height: 146,
                    borderRadius: 80,
                    borderWidth: 2,
                    borderColor: "#87a18f",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 62,
                      height: 62,
                      borderRadius: 32,
                      backgroundColor: "#64806e",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="mic" color="white" size={35} />
                  </View>
                  <Copy kind="label" style={{ color: "white" }}>
                    Grabar
                  </Copy>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
        <Copy
          kind="label"
          style={{ fontSize: 18, color: colors.primary, marginTop: 8 }}
        >
          Empezar a grabar
        </Copy>
        <Copy kind="small">Toca el botón cuando estéis listos</Copy>
        <Button
          secondary
          label="O subir un archivo de audio"
          icon="upload-cloud"
          onPress={() => void lib.run(lib.importAudio)}
          style={{ minHeight: 46, marginTop: 12, backgroundColor: colors.soft }}
        />
      </View>
      <Card style={{ backgroundColor: colors.soft, borderWidth: 0 }}>
        <View style={styles.row}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 24,
              backgroundColor: "#dcefe2",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="shield" />
          </View>
          <View style={{ flex: 1 }}>
            <Copy kind="label">Un espacio de respeto mutuo</Copy>
            <Copy kind="small">
              Asegúrate de que todos en la mesa aceptan guardar esta
              conversación familiar.
            </Copy>
          </View>
        </View>
      </Card>
      <Card style={{ backgroundColor: "#faf1e8", borderWidth: 0 }}>
        <View style={[styles.row, { alignItems: "flex-start" }]}>
          <Icon name="sun" color={colors.terra} />
          <View style={{ flex: 1, gap: 6 }}>
            <Copy kind="small" style={{ color: colors.terra }}>
              PREGUNTA DE HOY
            </Copy>
            <Copy style={{ fontFamily: "NewsreaderItalic", fontSize: 21 }}>
              “¿Cómo era una tarde cualquiera en tu barrio de la infancia?”
            </Copy>
          </View>
        </View>
      </Card>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Copy kind="heading">Últimos recuerdos</Copy>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/memories")}
          style={{ padding: 10 }}
        >
          <Copy kind="small" style={{ color: colors.primary }}>
            Ver todos →
          </Copy>
        </Pressable>
      </View>
      {lib.data.conversations.slice(0, 2).map((c) => (
        <MemoryCard key={c.id} memory={c} />
      ))}
      {!lib.data.conversations.length && (
        <Card>
          <Copy kind="heading">Tu historia empieza aquí</Copy>
          <Copy style={{ color: colors.muted }}>
            Graba la primera conversación. Puedes guardar el audio incluso sin
            conexión.
          </Copy>
          <Button
            label="Ver perfil de ejemplo"
            secondary
            icon="book-open"
            onPress={() => {
              lib.setDemo(true);
              router.push({
                pathname: "/person/[id]",
                params: { id: demoUser.personId },
              });
            }}
          />
        </Card>
      )}
      <Copy
        style={{
          textAlign: "center",
          fontFamily: "NewsreaderItalic",
          fontSize: 24,
          lineHeight: 32,
          color: "#708676",
          paddingVertical: 8,
        }}
      >
        “Las voces queridas nunca se olvidan.”
      </Copy>
    </Screen>
  );
}
