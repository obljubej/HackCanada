import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("No DATABASE_URL found in .env. Attempting to run SQL manually is required if omitted.");
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const sqlPath = path.join(process.cwd(), 'sql/002_meetings_schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log(`Executing SQL from ${sqlPath}...`);
    await pool.query(sqlContent);
    console.log("Migration executed successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

run();
