# Raíces

Primera versión de una aplicación móvil que conserva conversaciones familiares y transforma sus recuerdos en información con fuentes.

Los cuatro diseños originales de Stitch siguen intactos en `stitch_ra_ces_memoria_familiar_app/`. Se han adaptado a componentes nativos: no se carga el HTML en un WebView.

## Arranque rápido

Necesitas Node.js 22.13 o superior (recomendado Node 24 LTS) y npm. Las dependencias ya están instaladas en este ordenador.

```sh
npm install
npm run setup:local
```

`setup:local` crea dos archivos `.env` con un token de desarrollo aleatorio compartido. Conserva los archivos existentes y no imprime el token. No necesita una cuenta externa.

En dos terminales, desde esta carpeta:

```sh
npm run server
```

```sh
npm run web
```

Abre http://localhost:8081. Para el teléfono ejecuta `npm run dev` y abre el proyecto con una versión de Expo Go compatible con SDK 57 o una compilación de desarrollo. La grabación con pantalla bloqueada necesita validar una compilación nativa con las opciones del plugin de audio, no sólo la vista web.

Para conectar un teléfono físico al backend local:

1. En `apps/server/.env`, cambia `HOST=127.0.0.1` por `HOST=0.0.0.0`.
2. En `apps/mobile/.env`, sustituye `localhost` en `EXPO_PUBLIC_API_URL` por la IP privada de este ordenador. Usa una red de confianza.
3. Reinicia ambos procesos. Mantén el mismo token local en ambos `.env`.

## Qué puedes probar ahora

- Inicio con un botón grande para grabar; pausa, continuación y marcas de momentos.
- Guardado persistente del audio: documentos de la app en móvil e IndexedDB en web.
- Importación de un audio de hasta 100 MB.
- Pantalla de guardado, título editable, biblioteca, búsqueda y estados reales.
- Reproducción, avance y retroceso de 15 segundos; reproducción desde un fragmento.
- Pantallas de familia y línea temporal con fuentes.
- Datos de ejemplo separados, activables desde el inicio o ajustes. No se insertan en la base de datos.
- Exportación de JSON y del audio local, y eliminación de un recuerdo.
- Backend local con SQLite, autenticación por token de desarrollo y cola persistente.

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
2. Ejecuta `supabase/migrations/202610110001_initial.sql` en su SQL Editor o con Supabase CLI.
3. La migración crea las tablas, políticas de lectura por familia y el bucket privado `family-audio`.
4. En `apps/server/.env`, configura `DATABASE_URL`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Usa la cadena PostgreSQL o pooler de **sesión**, manteniendo SSL verificado. Descarga el certificado raíz en **Database → Settings → SSL Configuration**, guárdalo como `apps/server/supabase-ca.crt` y configura `SUPABASE_CA_CERT_PATH=supabase-ca.crt`. La contraseña de la base de datos debe estar correctamente codificada en la URL.
5. En `apps/mobile/.env`, configura `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` y `EXPO_PUBLIC_API_URL`.
6. Reinicia ambos procesos. Crea una cuenta desde Ajustes, confirma su correo e inicia sesión.

El servidor crea un espacio familiar personal en la primera petición autenticada. El esquema permite varios miembros, pero las invitaciones y la selección de varios espacios aún no están implementadas.

En modo PostgreSQL se exige una sesión Supabase; el token local queda desactivado. Las escrituras pasan por el backend. La conexión PostgreSQL del servidor debe tener permisos suficientes para administrar estas tablas; nunca la distribuyas con la app. El servidor usa la clave de servicio únicamente para validar sesiones y administrar el bucket privado.

La configuración cloud y las políticas SQL están preparadas, pero **no se han ejecutado contra un proyecto real** porque no se han proporcionado credenciales. SQLite local no se migra automáticamente a Supabase. Exporta tus datos y audios antes de cambiar de modo; la importación de ese archivo JSON es trabajo posterior.

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
