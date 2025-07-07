import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Only initialize PostgreSQL if explicitly enabled
const USE_POSTGRESQL = process.env.USE_POSTGRESQL === 'true';

let pool: Pool | null = null;
let db: any = null;

if (USE_POSTGRESQL) {
  // Configure PostgreSQL with WebSocket support
  neonConfig.webSocketConstructor = ws;

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
  
  console.log('PostgreSQL initialized with WebSocket support');
} else {
  // Provide stub exports when PostgreSQL is not being used
  pool = null;
  db = null;
  
  console.log('PostgreSQL disabled - using Replit Database instead');
}

export { pool, db };