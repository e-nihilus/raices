import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import type { Person, Relationship } from "@raices/shared";
import { request } from "../lib/api";
import { Button, Card, Copy } from "./ui";
import { FamilyTreeMap } from "./FamilyTreeMap";

type SharedPerson = Person & { sharedBy: string };
type SharedData = { people: SharedPerson[]; relationships: Relationship[] };

export function PersonSharing({ personId }: { personId: string }) {
  const [shared, setShared] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    request<{ personIds: string[] }>("/shared-tree/mine")
      .then((result) => {
        if (active) {
          setShared(result.personIds.includes(personId));
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setMessage("No se pudo consultar el estado de esta ficha.");
      });
    return () => {
      active = false;
    };
  }, [personId]);
  return (
    <Card>
      <Copy kind="heading">Compartir en la familia conectada</Copy>
      <Copy kind="small">
        Si compartes esta ficha, podrán ver su nombre, alias y parentescos con
        otras fichas compartidas todas las cuentas conectadas a tu familia,
        también las que se conecten más adelante. Los recuerdos y documentos no
        se comparten con esta opción.
      </Copy>
      <Button
        secondary
        label={shared ? "Dejar de compartir ficha" : "Compartir ficha"}
        disabled={!loaded || busy}
        onPress={() =>
          void (async () => {
            setBusy(true);
            setMessage("");
            try {
              await request(`/shared-tree/people/${personId}`, {
                method: "PUT",
                body: JSON.stringify({ shared: !shared }),
              });
              setShared(!shared);
              setMessage(
                shared
                  ? "Ficha retirada del árbol compartido."
                  : "Ficha compartida con la familia conectada.",
              );
            } catch (e) {
              setMessage(
                e instanceof Error ? e.message : "No se pudo actualizar",
              );
            } finally {
              setBusy(false);
            }
          })()
        }
      />
      {!!message && <Copy kind="small">{message}</Copy>}
    </Card>
  );
}

export function SharedFamilyTree() {
  const [data, setData] = useState<SharedData>({
    people: [],
    relationships: [],
  });
  const [selected, setSelected] = useState<SharedPerson | null>(null);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await request<SharedData>("/shared-tree");
      setData(result);
      setMessage("");
    } catch {
      setMessage("No se pudo cargar el árbol compartido.");
    }
  }, []);
  useEffect(() => {
    let active = true;
    request<SharedData>("/shared-tree")
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setMessage("No se pudo cargar el árbol compartido.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <View style={{ gap: 10 }}>
      <Card>
        <Copy kind="heading">Fichas compartidas por tu familia</Copy>
        <Copy kind="small">
          Incluye las fichas que han elegido compartir las cuentas conectadas,
          incluso a través de otros familiares. Los nombres coincidentes no se
          fusionan automáticamente.
        </Copy>
        <Button
          secondary
          label="Actualizar fichas compartidas"
          onPress={() => void refresh()}
        />
        {!!message && <Copy kind="small">{message}</Copy>}
      </Card>
      {data.people.length > 0 && (
        <FamilyTreeMap
          people={data.people}
          relationships={data.relationships}
          onOpenPerson={(id) =>
            setSelected(data.people.find((p) => p.id === id) || null)
          }
        />
      )}
      {selected && (
        <Card>
          <Copy kind="heading">{selected.name}</Copy>
          <Copy kind="small">Compartida por @{selected.sharedBy}</Copy>
          {!!selected.aliases.length && (
            <Copy>También conocida como: {selected.aliases.join(", ")}</Copy>
          )}
          <Button
            secondary
            label="Cerrar ficha"
            onPress={() => setSelected(null)}
          />
        </Card>
      )}
    </View>
  );
}
