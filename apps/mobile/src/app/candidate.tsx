import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Badge, Button, Card, Copy, Icon, Screen, colors, styles } from "../components/ui";
import { useLibrary } from "../state/LibraryProvider";

export default function Candidate() {
  const { personId, candidateId } = useLocalSearchParams<{ personId: string; candidateId: string }>();
  const lib = useLibrary();
  const person = lib.data.people.find((item) => item.id === personId);
  const candidate = lib.data.people.find((item) => item.id === candidateId);
  if (!person || !candidate) return <Screen back><Copy>No se encuentra esta posible coincidencia.</Copy></Screen>;
  return (
    <Screen back title="Coincidencia documental">
      <Badge warm>⌕ HALLAZGO SIN VERIFICAR</Badge>
      <Copy kind="title">Posible relación entre {person.name} y {candidate.name}</Copy>
      <Copy style={{ color: colors.muted }}>Los nombres o los recuerdos se parecen, pero una coincidencia nunca se incorpora como hecho automáticamente.</Copy>
      <Card style={{ backgroundColor: "#fff2e7", borderWidth: 0 }}>
        <View style={styles.row}><Icon name="alert-circle" color={colors.terra} /><Copy kind="label">Tratar con serenidad genealógica</Copy></View>
        <Copy kind="small">Faltan pruebas de identidad. Conserva esta relación como candidata hasta revisarla con la familia o una fuente documental.</Copy>
      </Card>
      <Card style={{ backgroundColor: "#e8f0e9", borderWidth: 0 }}>
        <Copy kind="heading">Datos que coinciden</Copy>
        <Copy>✓ Nombre o alias familiar</Copy>
        <Copy>✓ Contexto mencionado en los recuerdos</Copy>
        <Copy>✓ Posible relación con la misma rama</Copy>
      </Card>
      <Card style={{ backgroundColor: "#fff2e7", borderWidth: 0 }}>
        <Copy kind="heading">Por verificar con la familia</Copy>
        <Copy>• Segundo apellido o nombre completo</Copy>
        <Copy>• Fecha y localidad de nacimiento</Copy>
        <Copy>• Padres, pareja o hermanos</Copy>
      </Card>
      <Button label="Guardar como candidato a verificar" icon="bookmark" onPress={() => router.back()} />
      <Button secondary label="Crear pregunta para la próxima charla" icon="message-circle" onPress={() => router.replace("/conversation-mode" as never)} />
      <Button secondary label="Descartar esta coincidencia" icon="x" onPress={() => router.back()} />
    </Screen>
  );
}
