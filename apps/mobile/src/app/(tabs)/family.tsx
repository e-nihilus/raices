import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
import type { Person } from "@raices/shared";
import {
  Badge,
  Card,
  Copy,
  Empty,
  Icon,
  Screen,
  colors,
  styles,
} from "../../components/ui";
import { demoFamilyGenerations } from "../../lib/demo";
import { useLibrary } from "../../state/LibraryProvider";

function openPerson(id: string) {
  router.push({ pathname: "/person/[id]", params: { id } });
}

export default function Family() {
  const { data, demo } = useLibrary();
  const [query, setQuery] = useState("");
  const matches = data.people.filter((person) =>
    `${person.name} ${person.aliases.join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <Screen>
      <Badge>♧ RECONSTRUCCIÓN CON IA GENEALÓGICA</Badge>
      <Copy kind="title">Árbol Genealógico Vivo</Copy>
      <Copy style={{ color: colors.muted }}>
        {demo
          ? "Una familia ficticia de cuatro generaciones para explorar cómo puede crecer tu árbol."
          : "Construido a partir de vuestras grabaciones, documentos y correcciones familiares."}
      </Copy>
      {demo ? (
        <DemoTree people={data.people} />
      ) : data.people.length ? (
        <Card style={{ backgroundColor: "#e8f0e9", borderWidth: 0 }}>
          <Copy kind="heading">Personas de tu archivo</Copy>
          <Copy kind="small">
            {data.people.length} personas identificadas. Abre una ficha para
            consultar sus recuerdos y fuentes.
          </Copy>
        </Card>
      ) : null}
      <TextInput
        accessibilityLabel="Buscar persona"
        placeholder="Buscar un nombre o parentesco…"
        value={query}
        onChangeText={setQuery}
        style={styles.input}
      />
      {(!demo || query.trim()) &&
        matches.map((person) => (
          <Pressable
            key={person.id}
            accessibilityRole="button"
            onPress={() => openPerson(person.id)}
          >
            <Card>
              <View style={styles.row}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 28,
                    backgroundColor: colors.mint,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Copy kind="heading" style={{ color: colors.primary }}>
                    {initials(person.name)}
                  </Copy>
                </View>
                <View style={{ flex: 1 }}>
                  <Copy kind="heading">{person.name}</Copy>
                  <Copy kind="small">
                    {person.aliases.join(" · ") ||
                      "Mencionado en tus recuerdos"}
                  </Copy>
                </View>
                <Icon name="chevron-right" />
              </View>
              {person.candidateIds.length > 0 && (
                <Badge warm>Identidad pendiente de revisar</Badge>
              )}
            </Card>
          </Pressable>
        ))}
      {query.trim() && !matches.length && (
        <Copy style={{ color: colors.muted }}>
          No encontramos a nadie con ese nombre o parentesco.
        </Copy>
      )}
      {!data.people.length && (
        <Empty
          title="Las historias nos conectan"
          text="Cuando proceses una conversación con IA, las personas mencionadas aparecerán aquí con sus recuerdos y fuentes."
        />
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/relic" as never)}
        style={{
          padding: 16,
          backgroundColor: "#fff2e7",
          borderRadius: 22,
        }}
      >
        <View style={styles.row}>
          <Icon name="camera" color={colors.terra} />
          <View style={{ flex: 1 }}>
            <Copy kind="label">Añadir documento u objeto</Copy>
            <Copy kind="small">
              Una carta, fotografía o reliquia también puede abrir una historia.
            </Copy>
          </View>
          <Icon name="chevron-right" />
        </View>
      </Pressable>
    </Screen>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function DemoTree({ people }: { people: Person[] }) {
  const byId = new Map(people.map((person) => [person.id, person]));
  return (
    <Card style={{ backgroundColor: "#e8f0e9", borderWidth: 0 }}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Badge warm>FAMILIA DE EJEMPLO</Badge>
        <Copy kind="small">{people.length} miembros</Copy>
      </View>
      <Copy kind="small">
        Toca cualquier persona para ver su ficha y sus vínculos familiares.
      </Copy>
      {demoFamilyGenerations.map((generation, index) => (
        <View key={generation.title} style={{ alignItems: "center" }}>
          {index > 0 && (
            <View
              style={{
                width: 2,
                height: 26,
                backgroundColor: colors.sage,
              }}
            />
          )}
          <View style={{ width: "100%", gap: 12 }}>
            <Copy
              kind="heading"
              style={{ textAlign: "center", color: colors.primary }}
            >
              {generation.title}
            </Copy>
            {generation.groups.map((group) => (
              <View
                key={group.title}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 20,
                  padding: 12,
                  gap: 10,
                }}
              >
                <Copy
                  kind="small"
                  style={{ color: colors.primary, textAlign: "center" }}
                >
                  {group.title}
                </Copy>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {group.ids.map((id) => {
                    const person = byId.get(id);
                    return person ? (
                      <TreePerson key={id} person={person} />
                    ) : null;
                  })}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Card>
  );
}

function TreePerson({ person }: { person: Person }) {
  const isElena = person.id === "demo-elena";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver perfil de ${person.name}`}
      onPress={() => openPerson(person.id)}
      style={({ pressed }) => ({
        width: 126,
        minHeight: 112,
        borderRadius: 18,
        borderWidth: isElena ? 2 : 1,
        borderColor: isElena ? colors.primary : colors.line,
        backgroundColor: isElena ? colors.soft : colors.white,
        padding: 10,
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 20,
          backgroundColor: colors.mint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Copy kind="label" style={{ color: colors.primary }}>
          {initials(person.name)}
        </Copy>
      </View>
      <Copy
        kind="label"
        numberOfLines={2}
        style={{ fontSize: 13, textAlign: "center" }}
      >
        {person.name}
      </Copy>
      <Copy kind="small" numberOfLines={1} style={{ textAlign: "center" }}>
        {person.aliases[0]}
      </Copy>
    </Pressable>
  );
}
