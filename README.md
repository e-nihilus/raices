# Raíces

Primera versión de una aplicación móvil que conserva conversaciones familiares y transforma sus recuerdos en información con fuentes.

Los cuatro diseños originales de Stitch siguen intactos en `stitch_ra_ces_memoria_familiar_app/`. Se han adaptado a componentes nativos: no se carga el HTML en un WebView.

## Arranque rápido

Necesitas Node.js 22.13 o superior (recomendado Node 24 LTS) y npm. Las dependencias ya están instaladas en este ordenador.

```sh
npm install
npm run setup:local
```

`setup:local` crea dos archivos `.env` sin sobrescribir los existentes. No necesita una cuenta externa. Al abrir la app, crea una cuenta con nombre de usuario y contraseña.

En dos terminales, desde esta carpeta:

```sh
npm run server
```

```sh
npm run web
```

Abre http://localhost:8081. Para el teléfono ejecuta `npm run dev` y abre el proyecto con una versión de Expo Go compatible con SDK 57 o una compilación de desarrollo. La grabación con pantalla bloqueada necesita validar una compilación nativa con las opciones del plugin de audio, no sólo la vista web.

## Desplegar la demo web en Vercel

La aplicación ya incluye una configuración estática para Vercel en `vercel.json`. Esta edición está pensada para abrirse desde el navegador del móvil y enseñar el flujo completo con datos ficticios; no exige una cuenta, un backend ni claves privadas.

1. Sube esta carpeta a un repositorio de GitHub y créalo como proyecto en [Vercel](https://vercel.com/new).
2. Mantén como **Root Directory** la raíz del repositorio. Vercel leerá automáticamente `vercel.json`.
3. Pulsa **Deploy**. La compilación ejecuta `npm run build:web` y publica `apps/mobile/dist`.
4. Comparte la URL de producción o cualquier URL de Preview. En móviles se abre directamente en Safari o Chrome.

La demo abre con el archivo familiar ficticio de Elena y no envía esas historias a ningún servidor. Las grabaciones que haga un visitante se guardan sólo en el navegador de ese dispositivo mientras no configures una API pública.

Cuando quieras habilitar cuentas, subida de audios y procesamiento real, aloja `apps/server` en un servicio Node persistente y define estas variables de compilación en **Vercel → Project Settings → Environment Variables**:

```dotenv
EXPO_PUBLIC_API_URL=https://tu-api.example.com
```

No añadas `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, claves de IA ni ninguna otra credencial privada a Vercel para esta web: pertenecen únicamente al backend. La API actual no se despliega en Vercel porque procesa audios y mantiene una cola de trabajos; el límite de carga de Vercel Functions tampoco permite los audios de hasta 100 MB de Raíces.

## Probar cuentas y audios reales

Para esta fase se usan dos despliegues: **Vercel** sirve la web y **Railway** ejecuta el backend persistente que recibe los audios, procesa la cola y se conecta al Storage privado de Supabase. El repositorio incluye `Dockerfile` y `railway.json`, por lo que Railway detecta el servicio sin cambiar comandos.

1. En Railway, crea un proyecto desde el mismo repositorio de GitHub y despliega el servicio desde la raíz. Railway usará el `Dockerfile` y comprobará `GET /health` antes de publicar la nueva versión.
2. En Railway → Variables añade:

```dotenv
NODE_ENV=production
DATABASE_URL=conexion-del-session-pooler-de-supabase
DATABASE_SSL=true
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SUPABASE_CA_CERT_BASE64=contenido-base64-del-certificado-de-supabase
OPENAI_API_KEY=tu-clave-privada
TRANSCRIPTION_MODEL=whisper-1
EXTRACTION_MODEL=gpt-4.1-mini
ALLOWED_ORIGINS=https://tu-proyecto.vercel.app
```

Usa la URL de **Session pooler** de Supabase en `DATABASE_URL`: Railway es un backend persistente que normalmente necesita conexión IPv4. Descarga el certificado desde **Supabase → Database → Settings → SSL Configuration** y conviértelo a Base64 antes de guardarlo en Railway. En macOS:

```sh
base64 -i apps/server/supabase-ca.crt | pbcopy
```

Pega el resultado en `SUPABASE_CA_CERT_BASE64`. No copies el certificado ni las claves al repositorio.

3. Railway generará una URL pública para el API. Ábrela añadiendo `/health`; debe responder `{"ok":true,...}`.
4. En Vercel → **Project Settings → Environment Variables**, añade para Production y Preview:

```dotenv
EXPO_PUBLIC_API_URL=https://tu-api.up.railway.app
```

5. Ejecuta las migraciones SQL en Supabase, actualiza `ALLOWED_ORIGINS` en Railway con tu dominio final de Vercel y vuelve a desplegar ambos proyectos. Crea la cuenta desde la app con un nombre y una contraseña.

Las variables `EXPO_PUBLIC_*` se integran en el JavaScript de la web; sólo deben contener la URL pública del API. `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y las claves de IA permanecen exclusivamente en Railway.

Para conectar un teléfono físico al backend local:

1. En `apps/server/.env`, cambia `HOST=127.0.0.1` por `HOST=0.0.0.0`.
2. En `apps/mobile/.env`, sustituye `localhost` en `EXPO_PUBLIC_API_URL` por la IP privada de este ordenador. Usa una red de confianza.
3. Reinicia ambos procesos y crea una cuenta desde la aplicación.

## Qué puedes probar ahora

- Inicio con un botón grande para grabar; pausa, continuación y marcas de momentos.
- Guardado persistente del audio: documentos de la app en móvil e IndexedDB en web.
- Importación de un audio de hasta 100 MB.
- Pantalla de guardado, título editable, biblioteca, búsqueda y estados reales.
- Reproducción, avance y retroceso de 15 segundos; reproducción desde un fragmento.
- Pantallas de familia y línea temporal con fuentes.
- Datos de ejemplo separados, activables desde el inicio o ajustes. No se insertan en la base de datos.
- Exportación de JSON y del audio local, y eliminación de un recuerdo.
- Backend local con SQLite, cuentas con nombre único y contraseña, sesiones privadas y cola persistente.

Sin una clave de IA, los audios recibidos quedan **en cola**: no se inventan resúmenes, transcripciones ni progresos.

## Activar IA sin Supabase

FFmpeg ya está disponible en este ordenador. Comprueba `ffmpeg -version`; en otro servidor instálalo o utiliza el Dockerfile.

En `apps/server/.env`:

```dotenv
OPENAI_API_KEY=tu_clave_privada
TRANSCRIPTION_MODEL=whisper-1
EXTRACTION_MODEL=gpt-4.1-mini
```

Reinicia `npm run server`. El worker empezará a consumir los audios pendientes. Las llamadas al proveedor tendrán el coste de tu cuenta. No se han realizado llamadas reales ni se han usado credenciales externas durante el desarrollo.

El adaptador usa transcripción con tiempos de segmentos y extracción JSON validada con Zod. Los modelos son configurables. Esta versión **no separa ni identifica automáticamente los hablantes**: utiliza `speaker=null` y la interfaz dice “Hablante sin identificar”. Elige un modelo compatible con el formato del adaptador; cambiar únicamente el nombre a un modelo con otra API no basta.

## Activar Supabase

1. Crea un proyecto Supabase; elige región teniendo en cuenta dónde guardarás las conversaciones.
2. Ejecuta, en orden, `supabase/migrations/202610110001_initial.sql` y `supabase/migrations/202610260001_username_auth.sql` en su SQL Editor o con Supabase CLI.
3. Las migraciones crean las tablas, las cuentas de usuario, las políticas de lectura por familia y el bucket privado `family-audio`.
4. En `apps/server/.env`, configura `DATABASE_URL`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Usa la cadena PostgreSQL o pooler de **sesión**, manteniendo SSL verificado. Descarga el certificado raíz en **Database → Settings → SSL Configuration**, guárdalo como `apps/server/supabase-ca.crt` y configura `SUPABASE_CA_CERT_PATH=supabase-ca.crt`. La contraseña de la base de datos debe estar correctamente codificada en la URL.
5. En `apps/mobile/.env`, configura `EXPO_PUBLIC_API_URL`.
6. Reinicia ambos procesos. Crea una cuenta desde la aplicación con nombre de usuario y contraseña; no se pide correo.

El servidor crea un espacio familiar personal al registrar la cuenta. El esquema permite varios miembros, pero las invitaciones y la selección de varios espacios aún no están implementadas.

Las sesiones nuevas se validan en el backend mediante un token aleatorio guardado como hash en la base de datos. La contraseña se guarda con scrypt y sal aleatoria, nunca en claro. El nombre se compara sin distinguir mayúsculas y la restricción única de la base de datos evita duplicados simultáneos. Las escrituras pasan por el backend. La conexión PostgreSQL del servidor debe tener permisos suficientes para administrar estas tablas; nunca la distribuyas con la app. El servidor usa la clave de servicio para administrar el bucket privado. Las cuentas antiguas de Supabase Auth siguen siendo reconocidas por el API, pero el acceso nuevo desde la app utiliza las cuentas por nombre.

Las migraciones y políticas SQL ya están aplicadas al proyecto Supabase configurado para este entorno. SQLite local no se migra automáticamente a Supabase. Exporta tus datos y audios antes de cambiar de modo; la importación de ese archivo JSON es trabajo posterior.

## Estructura

```text
apps/mobile/          React Native + Expo Router + TypeScript
  src/app/            Pantallas y navegación
  src/components/     Interfaz compartida y reproductor
  src/state/          Grabación, biblioteca y sincronización
  src/lib/            Audio local, API, sesiones y ejemplos
apps/server/          Node.js + Express + worker
  src/ai.ts           Adaptador de transcripción y extracción
  src/store.ts        Persistencia y reconciliación básica
  src/db.ts           SQLite local / PostgreSQL cloud
  src/schema.sql      Esquema del modo local
  test/               Pruebas de fuentes, cola, datos y API
packages/shared/      Tipos, esquemas y validación de evidencias
supabase/migrations/  Esquema PostgreSQL, RLS y bucket privado
docs/                 Arquitectura, pruebas y siguientes etapas
```

## Comprobaciones

```sh
npm run typecheck
npm run lint
npm test
npm run build:web
npm exec --package=expo-doctor -- expo-doctor apps/mobile
```

Hay pruebas con proveedores sustituidos que verifican el pipeline sin gastar créditos ni enviar voces al exterior. Sigue `docs/VALIDACION.md` para probar grabación y comportamiento nativo.

## Límites de esta entrega

Es un prototipo funcional, pendiente de validación con una conversación real de 20–30 minutos. El pipeline guarda cada evento como una versión independiente, reutiliza nombres completos inequívocos y propone revisión para coincidencias cortas. La detección de contradicciones es deliberadamente básica; no implementa una reconciliación semántica completa.

El servidor actual usa un solo proceso con un worker. La app debe permanecer abierta hasta que la subida al servidor termine; después el procesamiento continúa en el servidor. No hay notificaciones push ni subida nativa en segundo plano. Si cierras antes, la copia local permite reintentar.

Las fuentes evitan referencias a fragmentos inexistentes; no garantizan que la interpretación de la IA sea correcta. Las afirmaciones siguen pendientes de revisión y sólo el usuario puede marcarlas como confirmadas.

El prototipo implementa controles de acceso y almacenamiento privado, pero aún no representa una revisión jurídica o de producción completa. Los datos locales no llevan cifrado propio; dependen de la protección del dispositivo. Los tokens de sesión móviles se guardan con SecureStore; en web se guardan en el navegador. Revisa `docs/ROADMAP.md` antes de publicar.
