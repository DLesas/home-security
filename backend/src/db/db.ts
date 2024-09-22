import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { db as schema } from "./schema/index";
import fs from 'fs';
import path from 'path';

// for migrations
// for query purposes
const queryClient = postgres(
  `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
);
export const db = drizzle(queryClient, { schema: schema });

export async function runMigrations() {
	console.log("Running migrations...");
	await migrate(db, { migrationsFolder: "./drizzle" });
	console.log("Migrations complete.");
}

export async function runCustomSQL() {
	console.log("Running custom Startup SQL...");
	const seedFilePath = path.join(__dirname, 'seed.sql');
	const seedSQL = fs.readFileSync(seedFilePath, 'utf8');
	await db.execute(sql.raw(seedSQL));
	console.log("Custom SQL execution complete.");
}