require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTraps() {
  try {
    const result = await pool.query(`
      SELECT id, name, type, theme_id
      FROM traps
      WHERE type LIKE '%lose%'
      ORDER BY theme_id, type
    `);

    console.log('🔍 Pièges avec "lose" dans le type:\n');
    result.rows.forEach(row => {
      console.log(`  ID: ${row.id}`);
      console.log(`  Nom: ${row.name}`);
      console.log(`  Type: "${row.type}"`);
      console.log(`  Theme ID: ${row.theme_id}`);
      console.log('');
    });

    // Vérifier les types uniques
    const types = await pool.query(`
      SELECT DISTINCT type FROM traps ORDER BY type
    `);
    console.log('📋 Tous les types de pièges uniques:');
    types.rows.forEach(row => console.log(`  - "${row.type}"`));

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkTraps();
