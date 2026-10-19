import { createDatabase } from "./db.ts";
import { createApp } from "./app.ts";
import { startWorker } from "./worker.ts";
if (
  !process.env.DATABASE_URL &&
  (process.env.NODE_ENV === "production" ||
    !process.env.DEV_API_TOKEN ||
    process.env.DEV_API_TOKEN.length < 24)
)
  throw new Error(
    "Configura DEV_API_TOKEN (24 caracteres mínimo) para desarrollo, o PostgreSQL y Supabase para producción.",
  );
if (
  process.env.DATABASE_URL &&
  (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
)
  throw new Error(
    "El modo cloud requiere PostgreSQL, Supabase Auth y Storage configurados juntos.",
  );
const db = createDatabase();
const stop = startWorker(db);
const server = createApp(db).listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `Raíces API en puerto ${process.env.PORT || 3001}. IA ${process.env.OPENAI_API_KEY ? "configurada" : "pendiente de configurar"}.`,
    ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stop();
    server.close(() => void db.close().then(() => process.exit(0)));
  });
