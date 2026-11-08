import { useEffect, useState } from "react";
import { Linking, Text, TextInput, View } from "react-native";
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
import { PersonSharing } from "../../components/SharedTree";
import { FindRelative } from "../../components/AccountLinks";
import { MemoryCard } from "../../components/MemoryCard";
import { useLibrary } from "../../state/LibraryProvider";
import { request } from "../../lib/api";
import {
  demoFamilyParents,
  demoFamilyPartners,
  demoUser,
} from "../../lib/demo";

type SourceSearch = {
  id: string;
  query: string;
  createdAt: string;
  text: string;
  citations: { url: string; title: string; start: number; end: number }[];
};

function SourceResearch({
  personId,
  name,
  suggestions,
}: {
  personId: string;
  name: string;
  suggestions: string[];
}) {
  const [query, setQuery] = useState(name);
  const [searches, setSearches] = useState<SourceSearch[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setQuery(name);
    setSearches([]);
    setError("");
    request<SourceSearch[]>(`/people/${personId}/sources`)
      .then((results) => {
        if (active) setSearches(results);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar las búsquedas anteriores.");
      });
    return () => {
      active = false;
    };
  }, [personId]);
  return (
    <Card>
      <Copy kind="heading">Fuentes en internet</Copy>
      <Copy kind="small">
        Busca noticias y documentos relacionados con esta persona. Una
        coincidencia de nombre no confirma su identidad ni demuestra que el
        recuerdo sea cierto.
      </Copy>
      <Button
        secondary
        label={open ? "Cerrar búsqueda" : "Buscar fuentes"}
        icon="search"
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          {!!suggestions.length && (
            <Copy kind="small">Puedes partir de un dato guardado:</Copy>
          )}
          {suggestions.slice(0, 5).map((suggestion, i) => (
            <Button
              key={`${i}-${suggestion}`}
              secondary
              label={suggestion}
              onPress={() => setQuery(suggestion)}
            />
          ))}
          <TextInput
            accessibilityLabel="Texto que se buscará en internet"
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            multiline
            maxLength={500}
          />
          <Copy kind="small">
            Al buscar, este texto se enviará a OpenAI y podrá utilizarse en
            consultas a proveedores de búsqueda. Incluye solo los datos que
            quieras compartir.
          </Copy>
          <Button
            label={busy ? "Buscando fuentes…" : "Buscar en internet"}
            icon="search"
            loading={busy}
            disabled={query.trim().length < 5}
            onPress={() =>
              void (async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await request<SourceSearch>(
                    `/people/${personId}/sources`,
                    { method: "POST", body: JSON.stringify({ query }) },
                  );
                  setSearches((previous) => [result, ...previous].slice(0, 20));
                  setOpen(false);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "No se pudo buscar",
                  );
                } finally {
                  setBusy(false);
                }
              })()
            }
          />
        </>
      )}
      {!!error && <Copy kind="small">{error}</Copy>}
      {searches.map((search) => {
        const citations = [...search.citations].sort(
          (a, b) => a.start - b.start,
        );
        let cursor = 0;
        const fragments: React.ReactNode[] = [];
        for (const citation of citations) {
          if (citation.start < cursor || citation.end > search.text.length)
            continue;
          fragments.push(search.text.slice(cursor, citation.start));
          fragments.push(
            <Text
              key={`${citation.start}-${citation.url}`}
              accessibilityRole="link"
              onPress={() =>
                void Linking.openURL(citation.url).catch(() =>
                  setError("No se pudo abrir el enlace."),
                )
              }
              style={{ color: colors.primary, textDecorationLine: "underline" }}
            >
              {search.text.slice(citation.start, citation.end)} [
              {citation.title}]
            </Text>,
          );
          cursor = citation.end;
        }
        fragments.push(search.text.slice(cursor));
        return (
          <View
            key={search.id}
            style={{
              gap: 8,
              borderTopWidth: 1,
              borderTopColor: colors.line,
              paddingTop: 12,
            }}
          >
            <Copy kind="label">{search.query}</Copy>
            <Copy kind="small">
              {new Date(search.createdAt).toLocaleDateString("es-ES")} ·
              Resultado por revisar
            </Copy>
            <Copy>{fragments}</Copy>
            {!citations.length && (
              <Copy kind="small">
                No se encontraron enlaces citados para comprobar este resultado.
              </Copy>
            )}
          </View>
        );
      })}
    </Card>
  );
}
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
  const documents =
    lib.data.documents?.filter((d) => d.personIds.includes(id)) || [];
  const events = conversations
    .flatMap((c) => c.events.filter((e) => e.personIds.includes(id)))
    .sort((a, b) => (a.year ?? Infinity) - (b.year ?? Infinity));
  const documentEvents = documents.flatMap((doc) =>
    doc.events
      .filter((event) => event.personIds.includes(id))
      .map((event) => ({ doc, event })),
  );
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
      {lib.user && !lib.demo && <PersonSharing personId={person.id} />}
      {lib.user && !lib.demo && (
        <FindRelative personId={person.id} name={person.name} />
      )}
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
          {conversations.length || documents.length
            ? "Historia y fuentes disponibles"
            : "En memoria viva"}
        </Badge>
        <Copy style={{ color: colors.muted, textAlign: "center" }}>
          {person.aliases.join(" · ") || "Parte de nuestra historia"}
        </Copy>
      </View>
      {!lib.demo && (
        <SourceResearch
          personId={person.id}
          name={person.name}
          suggestions={conversations.flatMap((conversation) =>
            conversation.claims
              .filter((claim) => claim.personId === id)
              .map((claim) => claim.statement),
          )}
        />
      )}
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
              {conversations.length} recuerdos · {documents.length} documentos ·{" "}
              {events.length + documentEvents.length} acontecimientos
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
      {events.length || documentEvents.length ? (
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
      {documentEvents.map(({ doc, event }) => (
        <Card key={event.id}>
          <Badge>{event.year || "Fecha por conocer"}</Badge>
          <Copy kind="heading">{event.description}</Copy>
          {event.place && <Copy kind="small">{event.place}</Copy>}
          <Badge warm>Por confirmar</Badge>
          <Button
            secondary
            label="Ver documento y cita"
            onPress={() =>
              router.push({
                pathname: "/document/[id]",
                params: { id: doc.id },
              } as never)
            }
          />
        </Card>
      ))}
      <Copy kind="heading">Su voz en los recuerdos</Copy>
      {conversations.map((c) => (
        <MemoryCard key={c.id} memory={c} />
      ))}
      {!!documents.length && (
        <>
          <Copy kind="heading">Documentos donde aparece</Copy>
          {documents.map((doc) => (
            <Card key={doc.id}>
              <Copy kind="label">{doc.title}</Copy>
              <Copy kind="small">{doc.kind}</Copy>
              <Button
                secondary
                label="Ver citas y original"
                onPress={() =>
                  router.push({
                    pathname: "/document/[id]",
                    params: { id: doc.id },
                  } as never)
                }
              />
            </Card>
          ))}
        </>
      )}
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
