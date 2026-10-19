import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { certaintyLabels } from "@raices/shared";
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
import { useLibrary } from "../../state/LibraryProvider";
import {
  demoFamilyParents,
  demoFamilyPartners,
  demoUser,
} from "../../lib/demo";
export default function Person() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lib = useLibrary();
  const person = lib.data.people.find((p) => p.id === id);
  if (!person)
    return (
      <Screen back>
        <Copy>No se encuentra la persona.</Copy>
      </Screen>
    );
  const conversations = lib.data.conversations.filter(
    (c) =>
      c.claims.some((cl) => cl.personId === id) ||
      c.events.some((e) => e.personIds.includes(id)),
  );
  const events = conversations
    .flatMap((c) => c.events.filter((e) => e.personIds.includes(id)))
    .sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
  const sameParents = (first: string, second: string) => {
    const a = demoFamilyParents[first] || [];
    const b = demoFamilyParents[second] || [];
    return (
      a.length > 0 &&
      a.length === b.length &&
      a.every((parentId) => b.includes(parentId))
    );
  };
  const parents = demoFamilyParents[id] || [];
  const siblings = Object.keys(demoFamilyParents).filter(
    (relativeId) => relativeId !== id && sameParents(id, relativeId),
  );
  const auntsAndUncles = Object.keys(demoFamilyParents).filter(
    (relativeId) =>
      !parents.includes(relativeId) &&
      parents.some((parentId) => sameParents(parentId, relativeId)),
  );
  const cousins = Object.entries(demoFamilyParents)
    .filter(([, parentIds]) =>
      parentIds.some((parentId) => auntsAndUncles.includes(parentId)),
    )
    .map(([relativeId]) => relativeId);
  const children = Object.entries(demoFamilyParents)
    .filter(([, parentIds]) => parentIds.includes(id))
    .map(([relativeId]) => relativeId);
  const partners = demoFamilyPartners.flatMap(([first, second]) =>
    first === id ? [second] : second === id ? [first] : [],
  );
  const familyGroups = [
    { title: "Padres", ids: parents },
    { title: "Pareja", ids: partners },
    { title: "Hermanos", ids: siblings },
    { title: "Tíos", ids: auntsAndUncles },
    { title: "Primos", ids: cousins },
    { title: "Hijos", ids: children },
  ].filter((group) => group.ids.length > 0);
  return (
    <Screen back title="Ficha biográfica">
      <View style={{ alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 55,
            backgroundColor: colors.mint,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Copy kind="title" style={{ fontSize: 40, color: colors.primary }}>
            {person.name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")}
          </Copy>
        </View>
        <Copy kind="title" style={{ textAlign: "center" }}>
          {person.name}
        </Copy>
        {lib.demo && <Badge warm>Perfil de ejemplo · datos ficticios</Badge>}
        <Badge>
          {conversations.length
            ? "Historia y fuentes disponibles"
            : "En memoria viva"}
        </Badge>
        <Copy style={{ color: colors.muted, textAlign: "center" }}>
          {person.aliases.join(" · ") || "Parte de nuestra historia"}
        </Copy>
      </View>
      {lib.demo && person.id === demoUser.personId && (
        <Card>
          <Copy kind="heading">Sobre Elena</Copy>
          <Copy>
            Creció entre Madrid y los veranos en Jaén. Hoy reúne las voces de su
            familia para conservar los recuerdos que escuchó de niña.
          </Copy>
          <Copy kind="small">Correo de ejemplo: {demoUser.email}</Copy>
        </Card>
      )}
      {lib.demo && familyGroups.length > 0 && (
        <Card>
          <Copy kind="heading">Vínculos familiares</Copy>
          {familyGroups.map((group) => (
            <View key={group.title} style={{ gap: 7 }}>
              <Copy kind="label">{group.title}</Copy>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {group.ids.map((relativeId) => {
                  const relative = lib.data.people.find(
                    (p) => p.id === relativeId,
                  );
                  return relative ? (
                    <Button
                      key={relativeId}
                      secondary
                      label={relative.name}
                      style={{ minHeight: 38, paddingHorizontal: 12 }}
                      onPress={() =>
                        router.push({
                          pathname: "/person/[id]",
                          params: { id: relativeId },
                        })
                      }
                    />
                  ) : null;
                })}
              </View>
            </View>
          ))}
        </Card>
      )}
      <Card style={{ backgroundColor: "#e8f0e9", borderWidth: 0 }}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View>
            <Copy kind="label">Archivo personal</Copy>
            <Copy kind="small">
              {conversations.length} recuerdos · {events.length} acontecimientos
            </Copy>
          </View>
          <Icon name="heart" color={colors.terra} />
        </View>
        <View style={styles.row}>
          <Button
            secondary
            label="Historia"
            icon="book-open"
            style={{ flex: 1, minHeight: 46 }}
            onPress={() => {}}
          />
          <Button
            secondary
            label="Fuentes"
            icon="folder"
            style={{ flex: 1, minHeight: 46 }}
            onPress={() =>
              conversations[0] &&
              router.push({
                pathname: "/memory/[id]",
                params: { id: conversations[0].id },
              })
            }
          />
        </View>
      </Card>
      {person.candidateIds.map((candidateId) => {
        const candidate = lib.data.people.find((p) => p.id === candidateId);
        if (!candidate) return null;
        return (
          <Card key={candidateId} style={{ backgroundColor: "#fff2e7" }}>
            <Badge warm>Ayúdanos a conectar la historia</Badge>
            <Copy>
              ¿{person.name} y {candidate.name} son la misma persona?
            </Copy>
            <View style={styles.row}>
              <Button
                label="Sí, unir"
                style={{ flex: 1 }}
                onPress={() =>
                  void lib.run(async () => {
                    await lib.merge(person.id, candidateId);
                    router.replace({
                      pathname: "/person/[id]",
                      params: { id: candidateId },
                    });
                  })
                }
              />
              <Button
                secondary
                label="Son distintos"
                style={{ flex: 1 }}
                onPress={() => void lib.run(() => lib.distinct(person.id))}
              />
            </View>
            <Button
              secondary
              label="Ver por qué es una posible coincidencia"
              icon="search"
              onPress={() =>
                router.push({
                  pathname: "/candidate" as never,
                  params: { personId: person.id, candidateId },
                })
              }
            />
            <Copy kind="small">
              Puedes revisarlo más tarde. Sus datos siguen separados hasta que
              lo confirmes.
            </Copy>
          </Card>
        );
      })}
      <Copy kind="heading">Su línea de vida</Copy>
      {events.length ? (
        events.map((e) => (
          <Card key={e.id}>
            <Badge>{e.year || "Fecha por conocer"}</Badge>
            <Copy kind="heading">{e.description}</Copy>
            {e.place && <Copy kind="small">{e.place}</Copy>}
            <Badge warm>{certaintyLabels[e.certainty]}</Badge>
            <Button
              secondary
              label="Ver fuente y escuchar"
              icon="play"
              onPress={() =>
                router.push({
                  pathname: "/memory/[id]",
                  params: { id: e.conversationId },
                })
              }
            />
          </Card>
        ))
      ) : (
        <Copy style={{ color: colors.muted }}>
          Todavía faltan acontecimientos por descubrir.
        </Copy>
      )}
      <Copy kind="heading">Su voz en los recuerdos</Copy>
      {conversations.map((c) => (
        <MemoryCard key={c.id} memory={c} />
      ))}
      <Card style={{ backgroundColor: "#f5f1eb", borderWidth: 0 }}>
        <Copy kind="heading">Grados de certeza</Copy>
        <Copy kind="small">
          Cada historia conserva el tipo de evidencia que la respalda.
        </Copy>
        <View style={{ gap: 6 }}>
          {[
            ["Documentado", "Fuente original o registro oficial"],
            ["Corroborado", "Varias fuentes independientes coinciden"],
            ["Testimonio familiar", "Recuerdo grabado de un familiar"],
            ["Por verificar", "Aún no existe evidencia suficiente"],
          ].map(([title, text]) => (
            <View
              key={title}
              style={[styles.row, { alignItems: "flex-start" }]}
            >
              <Icon name="check-circle" size={16} color={colors.sage} />
              <View style={{ flex: 1 }}>
                <Copy kind="small" style={{ color: colors.ink }}>
                  {title}
                </Copy>
                <Copy kind="small">{text}</Copy>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
