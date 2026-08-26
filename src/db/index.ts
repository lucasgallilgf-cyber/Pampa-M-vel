import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: ReturnType<typeof postgres> | undefined;
}

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

// Lazily create the connection on first actual use (i.e. when a query runs),
// rather than at module-import time. Next.js imports every route module
// during `next build` (to collect page data / static analysis) without ever
// invoking the handler, so throwing here eagerly would fail the production
// build whenever env vars aren't configured yet. Deferring the check to
// first property access keeps the build green and only surfaces the error
// (with a clear message) when a request actually tries to hit the database.
function createDb(): DbClient {
  // Accept whichever env var name the storage provider injected (Vercel's
  // native Postgres/Neon integration commonly uses POSTGRES_URL rather than
  // DATABASE_URL).
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error(
      "Nenhuma variável de conexão com o banco encontrada (DATABASE_URL / POSTGRES_URL). Configure o banco de dados nas variáveis de ambiente do projeto na Vercel."
    );
  }

  const client =
    global.__dbClient ??
    postgres(connectionString, { max: 5, prepare: false });

  if (process.env.NODE_ENV !== "production") {
    global.__dbClient = client;
  }

  return drizzle(client, { schema });
}

let cached: DbClient | undefined;

export const db: DbClient = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    if (!cached) cached = createDb();
    return Reflect.get(cached as object, prop, receiver);
  },
});
