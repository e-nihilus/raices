# Validación

## Automática

`npm test` cubre autenticación local, upload, UUID idempotente, enlaces de audio, exportación, borrado, fuentes, claves y referencias de extracción, certeza, persistencia transaccional, aislamiento de familias, resolución básica de identidad, cola/reintentos y contradicciones de fechas.

Los proveedores de IA están sustituidos por fixtures controlados. Estas pruebas no confirman calidad de transcripción real ni el funcionamiento remoto de Supabase.

`npm run typecheck` comprueba el código móvil, backend y esquema compartido. `npm run lint` analiza el código móvil. `npm run build:web` compila la interfaz para navegador; `expo export --platform all` verifica también los bundles nativos sin generar binarios de tienda.

## Manual en móvil

1. Arrancar backend y Expo; configurar IP LAN si el teléfono es físico.
2. Pulsar Grabar. Debe pedir permiso sólo cuando sea necesario.
3. Grabar una charla, pausar y continuar. Comprobar que el tiempo no sigue avanzando durante la pausa.
4. Marcar un momento. Terminar y comprobar la reproducción desde esa marca.
5. Cerrar y abrir. El audio y su título deben mantenerse.
6. Repetir sin red; el recuerdo debe mantenerse local y permitir envío posterior.
7. Con una compilación nativa, probar bloqueo de pantalla, cambio de app, llamada y desconexión de auriculares. Registrar el comportamiento observado.
8. Confirmar que el audio acaba subiendo antes de cerrar la app cuando se espera procesamiento remoto.
9. Procesar una conversación de 20–30 minutos con IA configurada y comparar datos con lo dicho realmente.
10. Exportar datos y audio. Eliminar un recuerdo de prueba y comprobar que su conversación, fragmentos y afirmaciones desaparecen.

## Supabase

Usar dos cuentas con familias distintas. Intentar acceder al UUID de una conversación ajena debe devolver 404; leer sus filas o sus archivos directamente tampoco debe funcionar. Probar registro, confirmación de correo, cierre/inicio de sesión y renovación de sesión.

Comprobar que el bucket no es público y que las claves privadas no aparecen en el bundle de la app. Probar que `NODE_ENV=production` no acepta el token local.

## Resultado de esta entrega — 11 de octubre de 2026

- TypeScript y lint: correctos.
- Pruebas del backend: 9 correctas.
- Expo Doctor: 21 de 21 comprobaciones correctas.
- Exportación de bundles web, iOS y Android: correcta. No equivale a una compilación firmada ni a pruebas en dispositivos físicos.
- Prueba manual web con un WAV sintético de dos segundos: importación, subida, edición de título, persistencia tras recargar y reproducción correctas. El recuerdo “Prueba técnica · audio sintético” es un archivo de validación, no una conversación real.
- Auditoría de dependencias de producción del backend: sin avisos en la consulta realizada.
- Auditoría global: avisos en dependencias transitivas del ecosistema Expo/React Native, incluidos paquetes sin versión corregida publicada en la consulta. Se han resuelto los módulos nativos duplicados; no se han forzado versiones de SDK incompatibles. Revisar los avisos actuales antes de distribuir públicamente.
- Supabase remoto, llamadas reales a IA, binarios firmados y grabación prolongada con micrófono: pendientes de cuentas/credenciales o de pruebas en dispositivo.
