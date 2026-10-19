import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const server = "apps/server/.env",
  mobile = "apps/mobile/.env";
if (existsSync(server) || existsSync(mobile)) {
  console.log("Ya existe configuración local. Se conserva sin sobrescribirla.");
  process.exit(0);
}
const token = randomBytes(32).toString("hex");
writeFileSync(
  server,
  readFileSync("apps/server/.env.example", "utf8").replace(
    "DEV_API_TOKEN=",
    "DEV_API_TOKEN=" + token,
  ),
  { mode: 0o600 },
);
writeFileSync(
  mobile,
  readFileSync("apps/mobile/.env.example", "utf8").replace(
    "EXPO_PUBLIC_DEV_API_TOKEN=",
    "EXPO_PUBLIC_DEV_API_TOKEN=" + token,
  ),
  { mode: 0o600 },
);
console.log(
  "Configuración local creada. Las claves externas siguen pendientes.",
);
