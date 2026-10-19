import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";
export type Row = Record<string, any>;
export interface Sql {
  all(sql: string, values?: unknown[]): Promise<Row[]>;
  transaction<T>(work: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export const dataDir = resolve(process.env.DATA_DIR || ".data");
const databaseCaPath = resolve(
  process.cwd(),
  process.env.SUPABASE_CA_CERT_PATH || "supabase-ca.crt",
);
mkdirSync(dataDir, { recursive: true });
function postgres(client: Pool | PoolClient): Sql {
  return {
    async all(query, values = []) {
      let i = 0;
      return (
        await client.query(
          query.replace(/\?/g, () => `$${++i}`),
          values,
        )
      ).rows;
    },
    async transaction(work) {
      const connection =
        "connect" in client
          ? await (client as Pool).connect()
          : (client as PoolClient);
      try {
        await connection.query("BEGIN");
        const result = await work(postgres(connection));
        await connection.query("COMMIT");
        return result;
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      } finally {
        if ("connect" in client) connection.release();
      }
    },
    async close() {
      if ("end" in client) await (client as Pool).end();
    },
  };
}
export function createDatabase(file = resolve(dataDir, "raices.sqlite")): Sql {
  if (process.env.DATABASE_URL) {
    const verifyCertificate = process.env.DATABASE_SSL === "true";
    const ca = verifyCertificate ? readFileSync(databaseCaPath, "utf8") : undefined;
    return postgres(
      new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: verifyCertificate ? { ca, rejectUnauthorized: true } : undefined,
      }),
    );
  }
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  // Serialize local transactions so requests cannot interleave a worker commit.
  let tail = Promise.resolve();
  const direct: Sql = {
    async all(sql, values = []) {
      return db.prepare(sql).all(...(values as any[])) as Row[];
    },
    async transaction(work) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = await work(direct);
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    async close() {
      db.close();
    },
  };
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = tail.then(fn);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  return {
    all: (sql, values) => enqueue(() => direct.all(sql, values)),
    transaction: (work) => enqueue(() => direct.transaction(work)),
    close: () => enqueue(() => direct.close()),
  };
}
