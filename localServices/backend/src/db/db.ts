import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { db as schema } from "./schema/index";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout } from 'timers/promises';
import { errorLogsTable } from "./schema/errorLogs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//console.log(path.resolve(__dirname, '../../../db/drizzle')); // '/home/node/db/drizzle'
//console.log(path.join(__dirname, '../../../db/seed.sql')) // '/home/node/db/seed.sql'


/**
 * Attempts to connect to the PostgreSQL database with retry logic.
 * @param retries Number of retry attempts
 * @param interval Interval between retries in milliseconds
 * @returns A postgres client
 */
/**
 * Attempts to connect to the PostgreSQL database with retry logic.
 * @param retries Number of retry attempts
 * @param interval Interval between retries in milliseconds
 * @returns A postgres client
 * @throws Error if unable to connect after all retries
 */
async function connectWithRetry(retries = 50, interval = 1000): Promise<postgres.Sql> {
  for (let i = 0; i < retries; i++) {
    try {
      const client = postgres(
        `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
      );
      // Test the connection
      await client`SELECT 1`;
      console.log('Successfully connected to the database');
      return client;
    } catch (err) {
      console.error(`postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,);
      console.error(`Failed to connect to the database (attempt ${i + 1}/${retries}):`, err);
      if (i < retries - 1) {
        console.log(`Retrying in ${interval}ms...`);
        await setTimeout(interval);
      }
    }
  }
  throw new Error(`Failed to connect to the database after ${retries} retries`);
}

// Replace the existing queryClient initialization with this:
const queryClient = await connectWithRetry();

export const db = drizzle(queryClient, { schema: schema });

/**
 * Runs database migrations.
 * 
 * This function logs the start of the migration process, runs the migrations
 * using the `migrate` function from `drizzle-orm`, and logs the completion of
 * the migration process.
 * 
 * @returns {Promise<void>} A promise that resolves when the migrations are complete.
 */
export async function runMigrations() {
	console.log("Running migrations...");
	await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../db/drizzle') });
	console.log("Migrations complete.");
}

/**
 * Executes custom SQL from a seed file.
 * 
 * This function logs the start of the custom SQL execution, reads the SQL
 * statements from a `seed.sql` file, executes them using the `db.execute` method,
 * and logs the completion of the SQL execution.
 * 
 * @returns {Promise<void>} A promise that resolves when the custom SQL execution is complete.
 */
export async function runCustomSQL() {
	console.log("Running custom Startup SQL...");
	const seedFilePath = path.join(__dirname, '../../../db/seed.sql');
	const seedSQL = fs.readFileSync(seedFilePath, 'utf8');
	await db.execute(sql.raw(seedSQL));
	console.log("Custom SQL execution complete.");
}

/**
 * Forces a checkpoint in the PostgreSQL database.
 * 
 * This function logs the start of the checkpoint process, executes the
 * `CHECKPOINT` SQL command using the `db.execute` method, and logs the
 * completion of the checkpoint process.
 * 
 * @returns {Promise<void>} A promise that resolves when the checkpoint is complete.
 */
export async function writePostgresCheckpoint() {
	try {
		console.log("Writing PostgreSQL checkpoint...");
		await db.execute(sql`CHECKPOINT`);
		console.log("PostgreSQL checkpoint written successfully.");
	} catch (error) {
		console.error("Failed to write PostgreSQL checkpoint:", error);
		throw error;
	}
}

/**
 * Logs an error to the database
 * @param {string} endpoint - The endpoint where the error occurred
 * @param {Error} error - The error object
 */
export async function logError(endpoint: string, error: Error): Promise<void> {
  await db.insert(errorLogsTable).values({
    endpoint,
    errorTrace: error.stack + "\n" + error.message + "\n" + String(error),
    level: "critical",
  });
}



