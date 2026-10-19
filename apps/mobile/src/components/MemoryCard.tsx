import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { formatTime, type Conversation } from "@raices/shared";
import { Badge, Card, Copy, Icon, colors, styles } from "./ui";
export const statusLabels: Record<Conversation["status"], string> = {
  local: "Guardado en este dispositivo",
  queued: "En cola",
  transcribing: "Transcribiendo",
  extracting: "Organizando recuerdos",
  ready: "Listo",
  failed: "Requiere atención",
};
export function MemoryCard({ memory }: { memory: Conversation }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${memory.title}`}
      onPress={() =>
        router.push({ pathname: "/memory/[id]", params: { id: memory.id } })
      }
    >
      <Card>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View style={styles.row}>
            <Icon name="calendar" size={15} />
            <Copy kind="small">
              {new Date(memory.createdAt).toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
              })}{" "}
              ·{" "}
              {memory.duration
                ? formatTime(memory.duration)
                : "Audio importado"}
            </Copy>
          </View>
          <Icon name="arrow-up-right" size={20} />
        </View>
        <Copy kind="heading">{memory.title}</Copy>
        {memory.summary ? (
          <Copy numberOfLines={2} style={{ color: colors.muted, fontSize: 15 }}>
            {memory.summary}
          </Copy>
        ) : (
          <Copy kind="small">
            {memory.status === "local"
              ? "Tu voz original está guardada. Conecta el servidor para organizarla con IA."
              : memory.status === "queued"
                ? "El audio está en el servidor, pendiente de procesamiento."
                : "Conservando cada detalle de la conversación."}
          </Copy>
        )}
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Badge warm={memory.status === "failed"}>
            {statusLabels[memory.status]}
          </Badge>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.soft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name={
                memory.status === "ready" || memory.status === "local"
                  ? "play"
                  : "clock"
              }
              size={18}
            />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
