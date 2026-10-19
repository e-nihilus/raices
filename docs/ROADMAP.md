# Siguientes etapas

## Entregado

- Monorepo, React Native/Expo, backend Node y esquema compartido.
- Adaptación de cuatro pantallas Stitch y pantallas complementarias.
- Grabación, guardado, importación, reproductor, búsqueda y edición de título.
- Biblioteca, fichas, cronología, fuentes y revisión de afirmaciones.
- Persistencia local, API autenticado, cola con reintentos y adaptadores IA.
- Esquema Supabase con RLS y bucket privado.
- Reconciliación básica de nombres, revisión manual y preservación de versiones de fechas.
- Pruebas, configuración de CI, ejemplos de entorno y documentación.

## Etapa 1 — Validación real

- Configurar clave de IA y probar una conversación con consentimiento.
- Revisar al menos 20 afirmaciones y todos los enlaces de audio.
- Registrar errores de nombres, atribuciones, parentescos y fechas.
- Validar en iOS y Android una grabación de 30 minutos, bloqueo, interrupciones y falta de red.
- Comprobar coste y tiempo de procesamiento con el proveedor elegido.

## Etapa 2 — Cloud privado

- Crear proyecto y ejecutar migración Supabase.
- Probar aislamiento con dos cuentas: API, SQL directo y Storage.
- Desplegar backend con HTTPS, FFmpeg y almacenamiento persistente de configuración.
- Configurar copias de seguridad, límites por usuario y borrado de cuenta.
- Añadir invitaciones, roles y selección de espacios familiares.
- Revisar las dependencias y sus avisos de seguridad antes de publicar; no forzar cambios incompatibles de SDK.

## Etapa 3 — Mejor memoria

- Diarización y etiquetado manual de quién habla.
- Confirmación de identidad más rica para homónimos y apodos.
- Consolidación de acontecimientos equivalentes conservando sus distintas fuentes.
- Inferencias de fechas con fuentes múltiples e intervalos de incertidumbre.
- Revisión y resolución explícita de contradicciones.
- Recuperación selectiva de contexto y, cuando se necesite, embeddings.
- Corregir texto/personas/parentescos desde la interfaz, con historial de cambios.
- Importación del archivo JSON exportado y exportación completa con audios.

## Etapa 4 — Producto

- Árbol genealógico visual y fotos propias.
- Chat familiar con citas, historias, archivos y mapas.
- Subidas en segundo plano y avisos push.
- Entrevistador IA cuando el flujo de conservación esté validado.
- Evaluación de privacidad, consentimiento, retención y obligaciones jurídicas para Europa.
