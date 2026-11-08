import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router } from "expo-router";
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
import { FamilyTreeMap } from "../../components/FamilyTreeMap";
import { useLibrary } from "../../state/LibraryProvider";

function openPerson(id: string) {
  router.push({ pathname: "/person/[id]", params: { id } });
}

export default function Family() {
  const { data, demo } = useLibrary();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;
  const matches = data.people.filter((person) =>
    `${person.name} ${person.aliases.join(" ")}`
      .toLowerCase()
      .includes(normalizedQuery),
  );

  return (
    <Screen wide={data.people.length > 0}>
      <Badge>♧ RECONSTRUCCIÓN CON IA GENEALÓGICA</Badge>
      <Copy kind="title">Árbol Genealógico Vivo</Copy>
      <Copy style={{ color: colors.muted }}>
        {demo
          ? "Una familia ficticia de cuatro generaciones para explorar cómo puede crecer tu árbol."
          : "Construido a partir de vuestras grabaciones, documentos y correcciones familiares."}
      </Copy>
      {data.people.length > 0 && (
        <FamilyTreeMap
          people={data.people}
          relationships={data.relationships}
          demo={demo}
          onOpenPerson={openPerson}
        />
      )}
      {!demo && data.people.length > 0 && !data.relationships?.length && (
        <Copy kind="small">
          Las conexiones aparecerán cuando se identifiquen parentescos en las
          conversaciones o documentos.
        </Copy>
      )}
      <TextInput
        accessibilityLabel="Buscar persona"
        placeholder="Buscar un nombre o parentesco…"
        value={query}
        onChangeText={setQuery}
        style={styles.input}
      />
      {hasQuery &&
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
      {hasQuery && !matches.length && (
        <Copy style={{ color: colors.muted }}>
          No encontramos a nadie con ese nombre o parentesco.
        </Copy>
      )}
      {!data.people.length && (
        <Empty
          title="Las historias nos conectan"
          text="Cuando proceses una conversación o documento con IA, las personas mencionadas aparecerán aquí con sus fuentes."
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
      {!!data.documents?.length && (
        <View style={{ gap: 8 }}>
          <Copy kind="heading">Documentos familiares</Copy>
          {data.documents.map((doc) => (
            <Pressable
              key={doc.id}
              onPress={() =>
                router.push({
                  pathname: "/document/[id]",
                  params: { id: doc.id },
                } as never)
              }
            >
              <Card>
                <Copy kind="label">{doc.title}</Copy>
                <Copy kind="small">
                  {doc.status === "ready"
                    ? `${doc.personIds.length} personas · ${doc.relationships.length} relaciones`
                    : doc.status === "failed"
                      ? "Análisis fallido · toca para reintentar"
                      : "Procesando documento…"}
                </Copy>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
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
