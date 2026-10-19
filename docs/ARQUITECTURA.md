# Arquitectura del MVP

## Flujo

1. La app solicita permiso de micrófono y graba una conversación.
2. Al terminar, guarda el original en almacenamiento persistente local y su metadata en AsyncStorage.
3. Si hay backend configurado, sube audio y metadata con un UUID estable. Un reintento de ese UUID no crea una segunda conversación.
4. El API verifica la sesión, determina el espacio familiar del usuario y guarda el archivo y un trabajo en cola.
5. Un worker adquiere un trabajo con lease; los trabajos abandonados pueden volver a procesarse después de que caduque.
6. FFmpeg produce fragmentos MP3 mono de diez minutos para la transcripción. El original se conserva intacto.
7. El transcriptor devuelve texto y tiempos; no asigna nombres a voces.
8. El LLM extrae personas, relaciones, afirmaciones y eventos siguiendo un esquema estricto.
9. Zod valida la estructura. La aplicación valida claves únicas, referencias, citas literales y fuentes de cada evento.
10. Una transacción guarda segmentos, afirmaciones, personas, relaciones, eventos y sus vínculos. Marca el trabajo como finalizado.
11. La app consulta estados mientras haya trabajos pendientes y presenta fuentes y controles de revisión.

## Datos

Una afirmación guarda `conversation_id`, `segment_id`, cita, interpretación, persona opcional y certeza. Un acontecimiento puede apoyarse en varias afirmaciones, enlazadas mediante `event_claims`. Una persona puede intervenir en varios eventos mediante `event_people`.

Cada segmento conserva inicio y fin. La conversación conserva su fecha y archivo original. Esta estructura permite llegar de un acontecimiento a la frase y al minuto donde se contó.

El JSON bruto de extracción se conserva en la conversación para auditoría. Las consultas de producto usan las tablas relacionadas. Los audios viven en disco privado en local o en Supabase Storage privado en cloud; no en columnas de la base de datos.

## Identidad y memoria

La memoria inicial reutiliza una coincidencia única de nombre completo dentro de la misma familia. Nombres cortos coincidentes crean una ficha provisional con candidatos y requieren revisión. Una fusión confirmada actualiza afirmaciones, parentescos y eventos, y conserva los alias.

Esta heurística todavía necesita validación con homónimos y apodos. No infiere automáticamente el narrador, parentescos no declarados ni fechas de nacimiento. No usa embeddings.

Las distintas versiones de eventos se conservan. Para nombres de persona resueltos, fechas diferentes de nacimiento/fallecimiento o de un evento con descripción, tipo y lugar idénticos se señalan como contradictorias. La detección no cubre toda la diversidad del lenguaje natural. No se elige una fecha automáticamente.

## Procesamiento y errores

Los trabajos tienen `attempts`, `available_at`, `lease_until`, `status` y un error legible. El worker renueva el lease durante el procesamiento y reintenta hasta tres veces con espera creciente. El usuario puede solicitar otro intento desde la interfaz.

La escritura final es transaccional y una conversación lista no se inserta de nuevo. El archivo permanece guardado si falla la IA. Esta entrega utiliza un worker por instancia y no está pensada para desplegar varias réplicas sin revisar concurrencia y leases.

## Acceso

El modo local requiere un token aleatorio y escucha en localhost por defecto. Sólo es para desarrollo. En cloud, el servidor valida el JWT con Supabase Auth, verifica el espacio familiar y realiza las escrituras. Las políticas RLS permiten leer sólo a miembros. Las tablas de trabajos no son accesibles a clientes.

El audio usa enlaces firmados de diez minutos; el enlace es una autorización temporal y debe tratarse como privado. Las credenciales de IA, PostgreSQL y servicio Supabase sólo están en el servidor. Los mensajes de error evitan volcar transcripciones o respuestas del proveedor en logs.

## Referencias de implementación

- Audio Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/sdk/audio/
- Transcripción: https://developers.openai.com/api/docs/guides/speech-to-text
- JSON estructurado: https://developers.openai.com/api/docs/guides/structured-outputs
- RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Storage privado: https://supabase.com/docs/guides/storage/security/access-control
