import { useState } from "react";
import { Linking, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Badge, Button, Card, Copy, Screen, colors } from "../../components/ui";
import { documentUrl, request } from "../../lib/api";
import { useLibrary } from "../../state/LibraryProvider";

export default function DocumentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lib = useLibrary();
  const [deleting, setDeleting] = useState(false);
  const doc = lib.data.documents?.find((x) => x.id === id);
  if (!doc)
    return (
      <Screen back>
        <Copy>No se encuentra el documento.</Copy>
      </Screen>
    );
  const name = (personId: string) =>
    lib.data.people.find((p) => p.id === personId)?.name || "Persona";
  return (
    <Screen back title="Fuente documental">
      <Badge warm>{doc.kind}</Badge>
      <Copy kind="title">{doc.title}</Copy>
      <Copy kind="small">
        {doc.fileName} · {new Date(doc.createdAt).toLocaleDateString("es-ES")}
      </Copy>
      <Card>
        <Copy kind="label">Estado del análisis</Copy>
        <Copy>
          {
            (
              {
                queued: "En cola",
                reading: "Leyendo el documento",
                extracting: "Identificando personas y relaciones",
                ready: "Análisis terminado",
                failed: "No se pudo analizar",
              } as const
            )[doc.status]
          }
        </Copy>
        {!!doc.error && (
          <Copy kind="small" style={{ color: colors.terra }}>
            {doc.error}
          </Copy>
        )}
      </Card>
      <Button
        secondary
        label="Abrir original privado"
        icon="folder"
        onPress={() =>
          void lib.run(async () => {
            await Linking.openURL(await documentUrl(doc.id));
          })
        }
      />
      {doc.status === "failed" && (
        <Button
          secondary
          label="Reintentar análisis"
          onPress={() =>
            void lib.run(async () => {
              await request(`/documents/${doc.id}/retry`, { method: "POST" });
              await lib.refresh();
            })
          }
        />
      )}
      {!!doc.summary && (
        <Card>
          <Copy kind="heading">Resumen</Copy>
          <Copy>{doc.summary}</Copy>
        </Card>
      )}
      {doc.status === "ready" && (
        <Card>
          <Copy kind="heading">Personas mencionadas</Copy>
          {doc.personIds.length ? (
            doc.personIds.map((personId) => (
              <Button
                key={personId}
                secondary
                label={name(personId)}
                onPress={() =>
                  router.push({
                    pathname: "/person/[id]",
                    params: { id: personId },
                  })
                }
              />
            ))
          ) : (
            <Copy>No se identificaron personas con seguridad.</Copy>
          )}
        </Card>
      )}
      {!!doc.relationships.length && (
        <Card>
          <Copy kind="heading">Parentescos propuestos</Copy>
          <Copy kind="small">
            Se muestran en el árbol con evidencia documental. Revisa que cada
            identidad corresponda a la persona correcta.
          </Copy>
          {doc.relationships.map((relation) => {
            const claim = doc.claims.find((c) => c.id === relation.claimId);
            return (
              <View key={relation.id} style={{ gap: 5 }}>
                <Copy kind="label">
                  {name(relation.fromId)} — {relation.type} de —{" "}
                  {name(relation.toId)}
                </Copy>
                {claim && <Copy kind="small">“{claim.quote}”</Copy>}
                <Badge warm>Por confirmar</Badge>
              </View>
            );
          })}
        </Card>
      )}
      {!!doc.claims.length && (
        <Card>
          <Copy kind="heading">Datos extraídos y citas</Copy>
          {doc.claims.map((claim) => (
            <View key={claim.id} style={{ gap: 4 }}>
              <Copy>{claim.statement}</Copy>
              <Copy kind="small">“{claim.quote}”</Copy>
            </View>
          ))}
        </Card>
      )}
      {!!doc.events.length && (
        <Card>
          <Copy kind="heading">Acontecimientos</Copy>
          {doc.events.map((event) => (
            <View key={event.id} style={{ gap: 4 }}>
              <Copy kind="label">{event.description}</Copy>
              <Copy kind="small">
                {[event.year, event.place].filter(Boolean).join(" · ")}
              </Copy>
              {event.claimIds.map((claimId) => {
                const claim = doc.claims.find((c) => c.id === claimId);
                return claim ? (
                  <Copy key={claimId} kind="small">
                    “{claim.quote}”
                  </Copy>
                ) : null;
              })}
              <Badge warm>Por confirmar</Badge>
            </View>
          ))}
        </Card>
      )}
      {!!doc.text && (
        <Card>
          <Copy kind="heading">Texto leído</Copy>
          <Copy kind="small">
            Comprueba posibles errores de lectura en el original.
          </Copy>
          <Copy>{doc.text}</Copy>
        </Card>
      )}
      {doc.status === "ready" && !doc.text && (
        <Copy kind="small">No se encontró texto legible en el archivo.</Copy>
      )}
      {!["reading", "extracting"].includes(doc.status) && (
        <Button
          secondary
          label="Eliminar documento"
          icon="trash-2"
          onPress={() => setDeleting(!deleting)}
        />
      )}
      {deleting && (
        <Card style={{ backgroundColor: "#fff0e8" }}>
          <Copy>
            Se eliminarán el original y los datos extraídos de este documento.
          </Copy>
          <Button
            label="Confirmar eliminación"
            icon="trash-2"
            onPress={() =>
              void lib.run(async () => {
                await request(`/documents/${doc.id}`, { method: "DELETE" });
                await lib.refresh();
                router.replace("/family");
              })
            }
          />
          <Button
            secondary
            label="Conservar documento"
            onPress={() => setDeleting(false)}
          />
        </Card>
      )}
    </Screen>
  );
}
