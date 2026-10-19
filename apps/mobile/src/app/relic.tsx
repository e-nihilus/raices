import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { Badge, Button, Card, Copy, Icon, Screen, colors, styles } from "../components/ui";
import { useLibrary } from "../state/LibraryProvider";

export default function Relic() {
  const { data } = useLibrary();
  const [kind, setKind] = useState("Fotografía antigua");
  const [file, setFile] = useState("");
  const [title, setTitle] = useState("");
  const choose = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
    if (!result.canceled) setFile(result.assets[0].name);
  };
  return (
    <Screen back title="Carga de reliquia">
      <Badge warm>▧ LEGADO FAMILIAR</Badge>
      <Copy kind="title">Añadir al Archivo Familiar</Copy>
      <Copy style={{ color: colors.muted }}>Fotografías, cartas, partidas u objetos con historia.</Copy>
      <View style={[styles.row, { flexWrap: "wrap" }]}>
        {["Fotografía antigua", "Documento oficial", "Carta", "Objeto"].map((item) => <Pressable key={item} onPress={() => setKind(item)} style={{ backgroundColor: kind === item ? colors.primary : colors.soft, paddingVertical: 11, paddingHorizontal: 13, borderRadius: 22 }}><Copy kind="small" style={{ color: kind === item ? "white" : colors.primary }}>{item}</Copy></Pressable>)}
      </View>
      <Card style={{ backgroundColor: "#f5f1eb", alignItems: "center", paddingVertical: 32 }}>
        <View style={[styles.logo, { width: 64, height: 64, borderRadius: 32 }]}><Icon name={file ? "check" : "camera"} size={30} /></View>
        <Copy kind="heading" style={{ textAlign: "center" }}>{file || "Tu pieza familiar"}</Copy>
        <Copy kind="small" style={{ textAlign: "center" }}>Conservaremos el original como fuente privada de la familia.</Copy>
        <Button secondary label={file ? "Cambiar archivo" : "Elegir foto o documento"} icon="upload" onPress={() => void choose()} />
      </Card>
      <View style={{ gap: 7 }}><Copy kind="label">Título o descripción</Copy><TextInput value={title} onChangeText={setTitle} placeholder="Ej.: Boda de los tíos en Úbeda" style={styles.input} /></View>
      <Card style={{ backgroundColor: colors.soft, borderWidth: 0 }}>
        <Copy kind="label">Personas vinculadas</Copy>
        <Copy kind="small">La relación con personas existentes y el análisis del documento estarán disponibles al guardar los cambios de esta fase.</Copy>
        <View style={[styles.row, { flexWrap: "wrap" }]}>{data.people.slice(0, 3).map((person) => <Badge key={person.id}>{person.name}</Badge>)}</View>
      </Card>
      <Button label="Guardar en la historia familiar" icon="bookmark" disabled={!file || !title.trim()} onPress={() => router.replace("/family")} />
      <Copy kind="small" style={{ textAlign: "center" }}>En esta versión, la ficha se ha integrado en la interfaz. El guardado de documentos y su extracción automática se conectará al almacenamiento privado de Supabase en la siguiente fase.</Copy>
    </Screen>
  );
}
