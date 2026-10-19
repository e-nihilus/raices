import { useState } from "react";
import { TextInput, View } from "react-native";
import { router } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Copy,
  Screen,
  colors,
  styles,
} from "../components/ui";
import { useLibrary } from "../state/LibraryProvider";
import { apiUrl, supabase } from "../lib/api";
import { demoUser } from "../lib/demo";
export default function Settings() {
  const lib = useLibrary();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState("");
  return (
    <Screen back title="Ajustes">
      <Copy kind="title">Un lugar para tu historia</Copy>
      <Card>
        <Copy kind="heading">Tu espacio familiar</Copy>
        <Badge>
          {lib.user
            ? "Sesión iniciada"
            : supabase
              ? "Sin sesión"
              : "Desarrollo local"}
        </Badge>
        <Copy style={{ color: colors.muted }}>
          {supabase
            ? "El acceso al espacio familiar requiere tu cuenta."
            : "Puedes grabar sin cuenta. El modo local está pensado para probar la aplicación en tu propio dispositivo."}
        </Copy>
        {supabase && !lib.user && (
          <>
            <TextInput
              accessibilityLabel="Correo electrónico"
              placeholder="Tu correo"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
            <TextInput
              accessibilityLabel="Contraseña"
              placeholder="Contraseña"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
            <Button
              label="Iniciar sesión"
              onPress={() =>
                void lib.run(async () => {
                  const { error } = await supabase!.auth.signInWithPassword({
                    email,
                    password,
                  });
                  if (error) throw error;
                  setPassword("");
                })
              }
            />
            <Button
              secondary
              label="Crear cuenta"
              onPress={() =>
                void lib.run(async () => {
                  const { error } = await supabase!.auth.signUp({
                    email,
                    password,
                  });
                  if (error) throw error;
                  setMessage(
                    "Revisa tu correo para confirmar la cuenta y después inicia sesión.",
                  );
                })
              }
            />
            {Boolean(message) && <Copy>{message}</Copy>}
          </>
        )}
        {Boolean(lib.user) && (
          <Button
            secondary
            label="Cerrar sesión"
            disabled={lib.recording || lib.networkBusy}
            onPress={() =>
              void lib.run(async () => {
                await supabase!.auth.signOut();
                lib.setDemo(false);
              })
            }
          />
        )}
      </Card>
      {lib.demo && (
        <Card style={{ backgroundColor: "#e8f0e9", borderWidth: 0 }}>
          <Badge>PERFIL FICTICIO · SOLO VISTA PREVIA</Badge>
          <Copy kind="heading">{demoUser.name}</Copy>
          <Copy kind="small">{demoUser.email}</Copy>
          <Copy>
            Explora sus recuerdos, acontecimientos y fuentes de ejemplo.
          </Copy>
          <Button
            label="Ver perfil de Elena"
            icon="users"
            onPress={() =>
              router.push({
                pathname: "/person/[id]",
                params: { id: demoUser.personId },
              })
            }
          />
        </Card>
      )}
      <Card>
        <Copy kind="heading">Conexión y procesamiento</Copy>
        <Copy kind="small">
          Servidor: {apiUrl || "Pendiente de configurar"}
        </Copy>
        <Badge warm={!lib.aiConfigured}>
          {lib.aiConfigured
            ? "IA configurada en el servidor"
            : "IA pendiente de configurar"}
        </Badge>
        <Copy style={{ color: colors.muted }}>
          El audio local se mantiene aunque falle la conexión. Puedes volver a
          enviarlo desde el detalle del recuerdo.
        </Copy>
        <Button
          secondary
          label="Comprobar conexión"
          icon="refresh-cw"
          onPress={() =>
            void lib.run(async () => {
              await lib.refresh();
              setMessage("Biblioteca actualizada.");
            })
          }
        />
        {Boolean(message) && lib.user && <Copy>{message}</Copy>}
      </Card>
      <Card>
        <Copy kind="heading">Privacidad y conservación</Copy>
        <Copy style={{ color: colors.muted }}>
          Graba siempre con el consentimiento de quienes participan. Cada dato
          extraído conserva su fuente y puedes revisar las afirmaciones.
        </Copy>
        <Copy kind="small">
          Las copias locales pertenecen a este dispositivo. Exporta los audios
          que quieras conservar fuera de la aplicación. El modo local no
          sustituye una copia de seguridad.
        </Copy>
        <Button
          secondary
          label="Exportar mis datos en JSON"
          icon="download"
          onPress={() => void lib.run(lib.exportData)}
        />
        <Copy kind="small">
          El archivo contiene transcripciones, personas, acontecimientos y
          referencias. Los audios se exportan desde cada recuerdo.
        </Copy>
      </Card>
      <View style={{ gap: 10 }}>
        <Button
          secondary
          label={
            lib.demo ? "Volver a mis recuerdos" : "Explorar datos de ejemplo"
          }
          icon="book-open"
          onPress={() => lib.setDemo(!lib.demo)}
        />
        <Copy kind="small" style={{ textAlign: "center" }}>
          Raíces · Primera versión{"\n"}Hecha para escuchar y conservar.
        </Copy>
      </View>
    </Screen>
  );
}
