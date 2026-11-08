import { useCallback, useEffect, useState } from "react";
import { Switch, TextInput, View } from "react-native";
import { request } from "../lib/api";
import { Button, Card, Copy, styles } from "./ui";

type Profile = {
  firstName: string;
  surname1: string;
  surname2: string;
  discoverable: boolean;
};
type LinkRequest = {
  id: string;
  senderUsername: string;
  recipientUsername: string;
  personName: string;
  relationship: string;
  status: string;
  incoming: boolean;
};
type Match = { id: string; name: string; username: string };
const blank: Profile = {
  firstName: "",
  surname1: "",
  surname2: "",
  discoverable: false,
};

export function AccountProfile() {
  const [profile, setProfile] = useState<Profile>(blank);
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [p, links] = await Promise.all([
      request<{ profile: Profile | null }>("/profile"),
      request<{ requests: LinkRequest[] }>("/family-links"),
    ]);
    setProfile(p.profile || blank);
    setRequests(links.requests);
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
      request<{ profile: Profile | null }>("/profile"),
      request<{ requests: LinkRequest[] }>("/family-links"),
    ])
      .then(([p, links]) => {
        if (active) {
          setProfile(p.profile || blank);
          setRequests(links.requests);
        }
      })
      .catch(() => {
        if (active) setMessage("No se pudo cargar el perfil.");
      });
    return () => {
      active = false;
    };
  }, []);
  const respond = async (id: string, decision: "accepted" | "rejected") => {
    setBusy(true);
    setMessage("");
    try {
      await request(`/family-links/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo responder");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Card>
        <Copy kind="heading">Tu perfil</Copy>
        <Copy kind="small">
          Tu nombre y tus dos apellidos ayudan a tus familiares a encontrarte.
          El nombre de usuario permite distinguir a personas con el mismo
          nombre.
        </Copy>
        {(
          [
            ["firstName", "Nombre"],
            ["surname1", "Primer apellido"],
            ["surname2", "Segundo apellido"],
          ] as const
        ).map(([key, label]) => (
          <TextInput
            key={key}
            accessibilityLabel={label}
            placeholder={label}
            value={profile[key]}
            maxLength={80}
            onChangeText={(value) =>
              setProfile((old) => ({ ...old, [key]: value }))
            }
            style={styles.input}
          />
        ))}
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Copy>Permitir que me encuentren</Copy>
          <Switch
            accessibilityLabel="Permitir que me encuentren"
            value={profile.discoverable}
            onValueChange={(value) =>
              setProfile((old) => ({ ...old, discoverable: value }))
            }
          />
        </View>
        <Button
          label="Guardar perfil"
          disabled={
            busy ||
            !profile.firstName.trim() ||
            !profile.surname1.trim() ||
            !profile.surname2.trim()
          }
          onPress={() =>
            void (async () => {
              setBusy(true);
              setMessage("");
              try {
                await request("/profile", {
                  method: "PUT",
                  body: JSON.stringify(profile),
                });
                setMessage("Perfil guardado.");
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "No se pudo guardar",
                );
              } finally {
                setBusy(false);
              }
            })()
          }
        />
        {!!message && <Copy kind="small">{message}</Copy>}
      </Card>
      <Card>
        <Copy kind="heading">Solicitudes familiares</Copy>
        <Copy kind="small">
          Aceptar una solicitud no comparte todavía recuerdos, documentos ni
          árboles.
        </Copy>
        {!requests.length && <Copy kind="small">No hay solicitudes.</Copy>}
        {requests.map((item) => (
          <View key={item.id} style={{ gap: 8 }}>
            <Copy>
              {item.incoming
                ? `@${item.senderUsername} quiere vincularte con ${item.personName}.`
                : `Solicitud a @${item.recipientUsername} para ${item.personName}.`}
            </Copy>
            <Copy kind="small">
              Parentesco indicado: {item.relationship} ·{" "}
              {item.status === "pending"
                ? "Pendiente"
                : item.status === "accepted"
                  ? "Aceptada"
                  : "Rechazada"}
            </Copy>
            {item.incoming && item.status === "pending" && (
              <>
                <Button
                  label="Aceptar solicitud"
                  disabled={busy}
                  onPress={() => void respond(item.id, "accepted")}
                />
                <Button
                  secondary
                  label="Rechazar"
                  disabled={busy}
                  onPress={() => void respond(item.id, "rejected")}
                />
              </>
            )}
          </View>
        ))}
      </Card>
    </>
  );
}

export function FindRelative({
  personId,
  name,
}: {
  personId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(name);
  const [relationship, setRelationship] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <Copy kind="heading">Conectar con su cuenta</Copy>
      <Copy kind="small">
        Busca por nombre completo o nombre de usuario. Comprueba el usuario con
        tu familiar antes de enviar una solicitud.
      </Copy>
      <Button
        secondary
        label={open ? "Cerrar búsqueda" : "Buscar cuenta"}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <TextInput
            accessibilityLabel="Nombre completo o usuario"
            placeholder="Nombre completo o usuario"
            style={styles.input}
            value={query}
            onChangeText={setQuery}
          />
          <TextInput
            accessibilityLabel="Parentesco contigo"
            placeholder="Parentesco contigo (por ejemplo, hermano)"
            style={styles.input}
            value={relationship}
            onChangeText={setRelationship}
            maxLength={80}
          />
          <Button
            label="Buscar"
            disabled={busy || query.trim().length < 3}
            onPress={() =>
              void (async () => {
                setBusy(true);
                setMessage("");
                try {
                  const result = await request<{ matches: Match[] }>(
                    `/account-search?q=${encodeURIComponent(query.trim())}`,
                  );
                  setMatches(result.matches);
                  if (!result.matches.length)
                    setMessage(
                      "No hay cuentas visibles con ese nombre exacto o usuario.",
                    );
                } catch (e) {
                  setMessage(
                    e instanceof Error ? e.message : "No se pudo buscar",
                  );
                } finally {
                  setBusy(false);
                }
              })()
            }
          />
          {matches.map((match) => (
            <View key={match.id} style={{ gap: 6 }}>
              <Copy>{match.name}</Copy>
              <Copy kind="small">@{match.username}</Copy>
              <Button
                secondary
                label={`Solicitar a @${match.username}`}
                disabled={busy || !relationship.trim()}
                onPress={() =>
                  void (async () => {
                    setBusy(true);
                    setMessage("");
                    try {
                      await request("/family-links", {
                        method: "POST",
                        body: JSON.stringify({
                          recipientId: match.id,
                          personId,
                          relationship,
                        }),
                      });
                      setMessage(
                        "Solicitud enviada. No se ha compartido información.",
                      );
                      setMatches([]);
                    } catch (e) {
                      setMessage(
                        e instanceof Error ? e.message : "No se pudo enviar",
                      );
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              />
            </View>
          ))}
        </>
      )}
      {!!message && <Copy kind="small">{message}</Copy>}
    </Card>
  );
}
