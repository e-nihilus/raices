import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import {
  Badge,
  Button,
  Copy,
  Empty,
  Screen,
  colors,
  styles,
} from "../../components/ui";
import { MemoryCard } from "../../components/MemoryCard";
import { useLibrary } from "../../state/LibraryProvider";
export default function Memories() {
  const lib = useLibrary();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const list = lib.data.conversations.filter(
    (c) =>
      (filter === "all" ||
        (filter === "ready"
          ? ["ready", "local"].includes(c.status)
          : !["ready", "local"].includes(c.status))) &&
      `${c.title} ${c.summary} ${c.segments.map((s) => s.text).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Badge>• Fonoteca viva</Badge>
          <Copy kind="small">{lib.data.conversations.length} recuerdos</Copy>
        </View>
        <Copy kind="title">Recuerdos grabados</Copy>
        <Copy style={{ color: colors.muted }}>
          Historias vivas, anécdotas y conversaciones de tu familia.
        </Copy>
      </View>
      <TextInput
        accessibilityLabel="Buscar recuerdos"
        placeholder="Buscar por persona, lugar o palabra…"
        value={query}
        onChangeText={setQuery}
        style={styles.input}
        placeholderTextColor={colors.muted}
      />
      <View style={[styles.row, { gap: 8 }]}>
        {[
          ["all", "Todos"],
          ["ready", "Guardados"],
          ["processing", "Procesando"],
        ].map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === key }}
            onPress={() => setFilter(key)}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 24,
              backgroundColor: filter === key ? colors.primary : colors.soft,
            }}
          >
            <Copy
              kind="small"
              style={{ color: filter === key ? "white" : colors.primary }}
            >
              {label}
            </Copy>
          </Pressable>
        ))}
      </View>
      {list.map((c) => (
        <MemoryCard key={c.id} memory={c} />
      ))}
      {!list.length && (
        <Empty
          title={
            query ? "No encontramos ese recuerdo" : "Cada voz merece quedarse"
          }
          text={
            query
              ? "Prueba con otra palabra."
              : "Empieza con una charla sencilla. Los recuerdos aparecerán aquí."
          }
          action={
            <Button
              label="Grabar una conversación"
              icon="mic"
              onPress={() => void lib.run(lib.start)}
            />
          }
        />
      )}
      {!lib.demo && (
        <Button
          secondary
          label="Actualizar recuerdos"
          icon="refresh-cw"
          onPress={() => void lib.run(lib.refresh)}
        />
      )}
    </Screen>
  );
}
