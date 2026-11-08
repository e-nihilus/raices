import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Copy,
  Icon,
  Screen,
  colors,
  styles,
} from "../components/ui";
import { uploadDocument } from "../lib/api";
import { useLibrary } from "../state/LibraryProvider";

export default function Relic() {
  const lib = useLibrary();
  const [kind, setKind] = useState("Documento familiar");
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const choose = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      setFile(result.assets[0]);
      if (!title.trim())
        setTitle(result.assets[0].name.replace(/\.[^.]+$/, ""));
    }
  };
  const save = async () => {
    if (!file || saving) return;
    if (!lib.user) {
      lib.setError("Inicia sesión para guardar documentos privados");
      return;
    }
    if ((file.size || 0) > 20 * 1024 * 1024) {
      lib.setError("El documento debe ocupar menos de 20 MB");
      return;
    }
    setSaving(true);
    try {
      await lib.run(async () => {
        const result = await uploadDocument(file, title.trim(), kind);
        await lib.refresh();
        router.replace({
          pathname: "/document/[id]",
          params: { id: result.id },
        } as never);
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen back title="Documento familiar">
      <Badge warm>▧ FUENTE FAMILIAR</Badge>
      <Copy kind="title">Añadir al archivo familiar</Copy>
      <Copy style={{ color: colors.muted }}>
        Sube una foto de un documento, carta o PDF. Leeremos el texto y
        propondremos personas y parentescos con citas.
      </Copy>
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        {[
          "Documento familiar",
          "Fotografía antigua",
          "Documento oficial",
          "Carta",
        ].map((item) => (
          <Pressable
            key={item}
            onPress={() => setKind(item)}
            style={{
              backgroundColor: kind === item ? colors.primary : colors.soft,
              paddingVertical: 11,
              paddingHorizontal: 13,
              borderRadius: 22,
            }}
          >
            <Copy
              kind="small"
              style={{ color: kind === item ? "white" : colors.primary }}
            >
              {item}
            </Copy>
          </Pressable>
        ))}
      </View>
      <Card
        style={{
          backgroundColor: "#f5f1eb",
          alignItems: "center",
          paddingVertical: 32,
        }}
      >
        <View
          style={[styles.logo, { width: 64, height: 64, borderRadius: 32 }]}
        >
          <Icon name={file ? "check" : "camera"} size={30} />
        </View>
        <Copy kind="heading" style={{ textAlign: "center" }}>
          {file?.name || "Tu documento"}
        </Copy>
        <Copy kind="small" style={{ textAlign: "center" }}>
          PDF, JPG, PNG o WebP · hasta 20 MB · original privado
        </Copy>
        <Button
          secondary
          label={file ? "Cambiar archivo" : "Elegir foto o PDF"}
          icon="upload"
          onPress={() => void choose()}
        />
      </Card>
      <View style={{ gap: 7 }}>
        <Copy kind="label">Título</Copy>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ej.: Partida de nacimiento de Juan García"
          style={styles.input}
        />
      </View>
      <Card style={{ backgroundColor: colors.soft, borderWidth: 0 }}>
        <Copy kind="label">Revisión de identidades</Copy>
        <Copy kind="small">
          Los nombres completos con apellidos podrán vincularse a una persona
          existente si coinciden de forma única. Los nombres ambiguos quedarán
          separados para que puedas revisarlos.
        </Copy>
      </Card>
      <Button
        label={saving ? "Guardando…" : "Guardar y analizar"}
        icon="bookmark"
        disabled={!file || !title.trim() || saving}
        onPress={() => void save()}
      />
      {!!lib.error && (
        <Copy kind="small" style={{ color: colors.terra }}>
          {lib.error}
        </Copy>
      )}
    </Screen>
  );
}
