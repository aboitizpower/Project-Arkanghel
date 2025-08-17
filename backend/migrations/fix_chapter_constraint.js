import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Robust path to .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('Script started. Environment variables should be loaded.');

const executeMigration = async () => {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });
    console.log('Database connection successful.');

    // Migration logic here...
    console.log('Starting migration logic...');
    try {
      console.log('Attempting to drop legacy constraint: module_chapters_ibfk_1');
      await connection.query('ALTER TABLE module_chapters DROP FOREIGN KEY module_chapters_ibfk_1;');
      console.log('Success: Dropped legacy constraint module_chapters_ibfk_1.');
    } catch (e) {
      if (e.code === 'ER_CANNOT_DROP_FK') {
        console.log('Info: Legacy constraint module_chapters_ibfk_1 not found, skipping drop.');
      } else {
        throw e;
      }
    }

    try {
      console.log('Attempting to drop previous custom constraint: fk_module_chapters_workstream');
      await connection.query('ALTER TABLE module_chapters DROP FOREIGN KEY fk_module_chapters_workstream;');
      console.log('Success: Dropped previous custom constraint fk_module_chapters_workstream.');
    } catch (e) {
      if (e.code === 'ER_CANNOT_DROP_FK') {
        console.log('Info: Custom constraint fk_module_chapters_workstream not found, skipping drop.');
      } else {
        throw e;
      }
    }

    console.log('Attempting to add new cascading constraint: fk_chapters_to_workstreams_cascade');
    await connection.query('ALTER TABLE module_chapters ADD CONSTRAINT fk_chapters_to_workstreams_cascade FOREIGN KEY (workstream_id) REFERENCES workstreams(workstream_id) ON DELETE CASCADE;');
    console.log('Success: Added new constraint with ON DELETE CASCADE to module_chapters.');
    console.log('Migration completed successfully.');

  } catch (err) {
    console.error('Migration Error:', err.message);
    console.error('Stack Trace:', err.stack);
  } finally {
    if (connection) {
      console.log('Closing database connection.');
      await connection.end();
      console.log('Connection closed.');
    }
  }
};

// Self-executing function to run the migration
(async () => {
  await executeMigration();
})();

