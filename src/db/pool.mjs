import pg from "pg";
import { getDbCredentials } from "./credentials.mjs";

const { Pool } = pg;

let pool;

export async function getPool() {
  if (pool) {
    return pool;
  }

  const credentials = await getDbCredentials();

  pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: credentials.username,
    password: credentials.password,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  console.log(`Database pool created successfully with db ${process.env.DB_NAME} and user ${credentials.username}`);

  return pool;
}