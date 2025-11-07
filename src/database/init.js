/**
 * Database Initialization
 * تهيئة قاعدة البيانات
 */

import Database from 'better-sqlite3';
import { schema, indexes } from './schema.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/family_assistant.db');

/**
 * Initialize database
 */
export function initDatabase() {
  // Create data directory if it doesn't exist
  const dataDir = path.dirname(DATABASE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Open database connection
  const db = new Database(DATABASE_PATH);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Set journal mode to WAL for better performance
  db.pragma('journal_mode = WAL');

  console.log('📚 Creating database tables...');

  // Create all tables
  for (const [tableName, sql] of Object.entries(schema)) {
    try {
      db.exec(sql);
      console.log(`✅ Table '${tableName}' created successfully`);
    } catch (error) {
      console.error(`❌ Error creating table '${tableName}':`, error.message);
      throw error;
    }
  }

  console.log('\n📊 Creating indexes...');

  // Create all indexes
  for (const indexSql of indexes) {
    try {
      db.exec(indexSql);
    } catch (error) {
      console.error('❌ Error creating index:', error.message);
    }
  }

  console.log('✅ All indexes created successfully\n');

  return db;
}

/**
 * Get database connection
 */
export function getDatabase() {
  if (!fs.existsSync(DATABASE_PATH)) {
    throw new Error('Database not initialized. Run npm run db:init first.');
  }

  const db = new Database(DATABASE_PATH);
  db.pragma('foreign_keys = ON');

  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(db) {
  if (db) {
    db.close();
    console.log('Database connection closed');
  }
}

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log('🚀 Initializing Family Assistant Database...\n');
    const db = initDatabase();
    console.log('✅ Database initialized successfully!');
    console.log(`📍 Location: ${DATABASE_PATH}\n`);
    closeDatabase(db);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}
