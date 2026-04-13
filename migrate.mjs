import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const sql = readFileSync('./drizzle/0001_misty_bishop.sql', 'utf8');
const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

const conn = await createConnection(process.env.DATABASE_URL);
console.log('Connected to database');

for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log('✓', stmt.substring(0, 60).replace(/\n/g, ' '));
  } catch (err) {
    if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠ Already exists (skipping):', stmt.substring(0, 60).replace(/\n/g, ' '));
    } else {
      console.error('✗ Error:', err.message, '\nSQL:', stmt.substring(0, 100));
    }
  }
}

await conn.end();
console.log('Migration complete');
