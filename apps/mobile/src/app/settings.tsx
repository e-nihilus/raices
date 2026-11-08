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
import { apiUrl, login, logout, register, usernameAvailable } from "../lib/api";
import { demoUser } from "../lib/demo";
export default function Settings() {
  const lib = useLibrary();
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [authBusy, setAuthBusy] = useState(false);
  const submit = async (mode: "login" | "register") => {
    if (authBusy) return;
    setAuthBusy(true);
    setMessage("");
    try {
      if (mode === "register") {
        if (!(await usernameAvailable(username.trim()))) {
          setMessage("Ese nombre de usuario ya está seleccionado");
          return;
        }
        await register(username.trim(), password);
      } else await login(username.trim(), password);
      setPassword("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo acceder a la cuenta",
      );
    } finally {
      setAuthBusy(false);
    }
  };
  return (
    <Screen back={Boolean(lib.user)} title={lib.user ? "Ajustes" : "Tu cuenta"}>
      <Copy kind="title">Un lugar para tu historia</Copy>
      <Card>
        <Copy kind="heading">Tu espacio familiar</Copy>
        <Badge>
          {lib.user
            ? `Sesión iniciada: ${lib.username}`
            : apiUrl
              ? "Sin sesión"
              : "Desarrollo local"}
        </Badge>
        <Copy style={{ color: colors.muted }}>
          {apiUrl
            ? "Crea tu cuenta con un nombre de usuario y contraseña para guardar tus recuerdos en tu perfil."
            : "Puedes grabar sin cuenta. El modo local está pensado para probar la aplicación en tu propio dispositivo."}
        </Copy>
        {Boolean(apiUrl) && !lib.user && (
          <>
            <TextInput
              accessibilityLabel="Nombre de usuario"
              placeholder="Nombre de usuario"
              autoCapitalize="none"
              autoComplete="username"
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                setMessage("");
              }}
              style={styles.input}
            />
            <TextInput
              accessibilityLabel="Contraseña"
              placeholder="Contraseña"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
            <Copy kind="small">
              El nombre debe tener de 3 a 40 caracteres. La contraseña, al menos
              8.
            </Copy>
            <Button
              label="Iniciar sesión"
              disabled={authBusy || !username.trim() || !password}
              onPress={() => void submit("login")}
            />
            <Button
              secondary
              label="Crear cuenta"
              disabled={authBusy || !username.trim() || !password}
              onPress={() => void submit("register")}
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
                await logout();
                lib.setDemo(false);
              })
            }
          />
        )}
      </Card>
      {(!apiUrl || lib.user) && (
        <>
          {lib.demo && (
            <Card style={{ backgroundColor: "#e8f0e9", borderWidth: 0 }}>
              <Badge>PERFIL FICTICIO · SOLO VISTA PREVIA</Badge>
              <Copy kind="heading">{demoUser.name}</Copy>
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
              El audio local se mantiene aunque falle la conexión. Puedes volver
              a enviarlo desde el detalle del recuerdo.
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
              Graba siempre con el consentimiento de quienes participan. Cada
              dato extraído conserva su fuente y puedes revisar las
              afirmaciones.
            </Copy>
            <Copy kind="small">
              Las copias locales pertenecen a este dispositivo. Exporta los
              audios que quieras conservar fuera de la aplicación. El modo local
              no sustituye una copia de seguridad.
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
                lib.demo
                  ? "Volver a mis recuerdos"
                  : "Explorar datos de ejemplo"
              }
              icon="book-open"
              onPress={() => lib.setDemo(!lib.demo)}
            />
            <Copy kind="small" style={{ textAlign: "center" }}>
              Raíces · Primera versión{"\n"}Hecha para escuchar y conservar.
            </Copy>
          </View>
        </>
      )}
    </Screen>
  );
}
