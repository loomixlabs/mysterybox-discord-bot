require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
  const constraints = await db.queryAll(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'badges'::regclass
    AND contype = 'c'
  `);
  console.log('Contraintes CHECK sur badges:\n');
  constraints.forEach(c => {
    console.log(`${c.conname}:`);
    console.log(`${c.definition}\n`);
  });
  process.exit(0);
}
check();
