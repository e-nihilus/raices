import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { certaintyLabels, formatTime } from "@raices/shared";
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
import { AudioPlayer } from "../../components/AudioPlayer";
import { useLibrary } from "../../state/LibraryProvider";
import { request } from "../../lib/api";
import { shareAudio } from "../../lib/audio-files";
export default function Memory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lib = useLibrary();
  const c = lib.data.conversations.find((c) => c.id === id);
  const [tab, setTab] = useState("summary"),
    [seek, setSeek] = useState<{ time: number; nonce: number }>(),
    [deleting, setDeleting] = useState(false),
    [editing, setEditing] = useState(false),
    [title, setTitle] = useState("");
  if (!c)
    return (
      <Screen back>
        <Copy>No se encuentra el recuerdo.</Copy>
      </Screen>
    );
  return (
    <Screen back title="Un recuerdo">
      <Copy kind="title">{c.title}</Copy>
      <Copy kind="small">
        {new Date(c.createdAt).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}{" "}
        · {c.duration ? formatTime(c.duration) : "Audio importado"}
      </Copy>
      <AudioPlayer conversation={c} seek={seek} />
      <View style={styles.row}>
        {[
          ["summary", "Resumen"],
          ["transcript", "Transcripción"],
        ].map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === key }}
            onPress={() => setTab(key)}
            style={{
              flex: 1,
              padding: 13,
              borderRadius: 24,
              backgroundColor: tab === key ? colors.primary : colors.soft,
              alignItems: "center",
            }}
          >
            <Copy
              kind="label"
              style={{ color: tab === key ? "white" : colors.primary }}
            >
              {label}
            </Copy>
          </Pressable>
        ))}
      </View>
      {c.status !== "ready" && (
        <Card>
          <Badge warm={c.status === "failed"}>
            {c.status === "local"
              ? "Conservado en tu dispositivo"
              : c.status === "queued"
                ? "En cola"
                : c.status === "failed"
                  ? "Procesamiento pendiente de reintento"
                  : "Procesando"}
          </Badge>
          <Copy>
            {c.error ||
              "La transcripción y los acontecimientos aparecerán aquí cuando termine el procesamiento con IA."}
          </Copy>
          {["local", "failed"].includes(c.status) && (
            <Button
              label={
                c.status === "local"
                  ? "Enviar para procesar con IA"
                  : "Reintentar procesamiento"
              }
              icon="upload-cloud"
              onPress={() => void lib.run(() => lib.retry(c))}
            />
          )}
        </Card>
      )}
      {tab === "summary" ? (
        <>
          <Copy style={{ color: colors.muted }}>
            {c.summary || "Todavía no hay un resumen disponible."}
          </Copy>
          {c.events.length > 0 && (
            <Copy kind="heading">Momentos que quedan</Copy>
          )}
          {c.events.map((e) => {
            const claim = c.claims.find((cl) => e.claimIds.includes(cl.id));
            const segment = c.segments.find((s) => s.id === claim?.segmentId);
            return (
              <Card key={e.id}>
                <View style={[styles.row, { justifyContent: "space-between" }]}>
                  <Badge>
                    {e.year
                      ? `${e.year}${e.certainty === "approximate" || e.certainty === "inferred" ? " aprox." : ""}`
                      : "Fecha por conocer"}
                  </Badge>
                  <Icon name="map-pin" size={18} />
                </View>
                <Copy kind="heading">{e.description}</Copy>
                {Boolean(e.place) && <Copy kind="small">{e.place}</Copy>}
                <Badge warm>{certaintyLabels[e.certainty]}</Badge>
                {claim && (
                  <>
                    <View style={styles.divider} />
                    <Copy
                      style={{ fontFamily: "NewsreaderItalic", fontSize: 21 }}
                    >
                      “{claim.quote}”
                    </Copy>
                    <Copy kind="small">
                      Fuente: esta conversación ·{" "}
                      {segment?.speaker || "Hablante sin identificar"} ·{" "}
                      {formatTime(segment?.start || 0)}
                    </Copy>
                    {segment && (
                      <Button
                        secondary
                        label={`Escuchar en ${formatTime(segment.start)}`}
                        icon="play"
                        disabled={c.demo}
                        onPress={() =>
                          setSeek({ time: segment.start, nonce: Date.now() })
                        }
                      />
                    )}{" "}
                    {!c.demo && (
                      <Button
                        secondary
                        label={
                          claim.certainty === "confirmed"
                            ? "Afirmación confirmada"
                            : "Confirmar esta afirmación"
                        }
                        icon="check"
                        disabled={claim.certainty === "confirmed"}
                        onPress={() =>
                          void lib.run(async () => {
                            await request(`/claims/${claim.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({ certainty: "confirmed" }),
                            });
                            await lib.refresh();
                          })
                        }
                      />
                    )}
                  </>
                )}
              </Card>
            );
          })}
          {c.claims.length > 0 && (
            <>
              <Copy kind="heading">Lo que nos contaron</Copy>
              {c.claims.map((cl) => (
                <Card key={cl.id}>
                  <Copy>{cl.statement}</Copy>
                  <Badge warm>{certaintyLabels[cl.certainty]}</Badge>
                  <Copy kind="small">“{cl.quote}”</Copy>
                </Card>
              ))}
            </>
          )}
        </>
      ) : (
        <>
          {c.segments.length ? (
            c.segments.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                onPress={() =>
                  !c.demo && setSeek({ time: s.start, nonce: Date.now() })
                }
              >
                <Card>
                  <Copy kind="small" style={{ color: colors.primary }}>
                    {formatTime(s.start)} ·{" "}
                    {s.speaker || "Hablante sin identificar"}
                  </Copy>
                  <Copy>{s.text}</Copy>
                </Card>
              </Pressable>
            ))
          ) : (
            <Copy style={{ color: colors.muted }}>
              La transcripción aún no está disponible.
            </Copy>
          )}
        </>
      )}
      {c.bookmarks.length > 0 && (
        <>
          <Copy kind="heading">Tus momentos marcados</Copy>
          <View style={{ gap: 10 }}>
            {c.bookmarks.map((time, i) => (
              <Button
                key={`${time}-${i}`}
                secondary
                icon="bookmark"
                label={`Momento ${formatTime(time)}`}
                onPress={() => setSeek({ time, nonce: Date.now() })}
              />
            ))}
          </View>
        </>
      )}
      {!c.demo && (
        <>
          <Button
            secondary
            label="Cambiar título"
            icon="edit-3"
            onPress={() => {
              setTitle(c.title);
              setEditing(!editing);
            }}
          />
          {editing && (
            <Card>
              <TextInput
                accessibilityLabel="Nuevo título"
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                maxLength={180}
              />
              <Button
                label="Guardar título"
                onPress={() =>
                  void lib.run(async () => {
                    await lib.rename(c.id, title);
                    setEditing(false);
                  })
                }
              />
            </Card>
          )}
          {Boolean(c.audioUri) && (
            <Button
              secondary
              label="Exportar audio original"
              icon="download"
              onPress={() => void lib.run(() => shareAudio(c.audioUri!))}
            />
          )}
          <Button
            secondary
            label="Eliminar este recuerdo"
            icon="trash-2"
            onPress={() => setDeleting(!deleting)}
          />
          {deleting && (
            <Card style={{ backgroundColor: "#fff0e8" }}>
              <Copy>
                Se eliminarán el audio y los datos extraídos de esta
                conversación.
              </Copy>
              <Button
                label="Confirmar eliminación"
                icon="trash-2"
                onPress={() =>
                  void lib.run(async () => {
                    await lib.remove(c.id);
                    router.replace("/memories");
                  })
                }
              />
              <Button
                secondary
                label="Conservar recuerdo"
                onPress={() => setDeleting(false)}
              />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
