/**
 * Vérifier toutes les colonnes de la table traps
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    console.log('🔍 COLONNES DE LA TABLE TRAPS\n');
    console.log('='.repeat(80));

    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'traps'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Colonnes:\n');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // Voir un exemple de piège
    console.log('\n📋 Exemple de piège existant:\n');
    const example = await pool.query('SELECT * FROM traps LIMIT 1');
    if (example.rows.length > 0) {
      console.log(JSON.stringify(example.rows[0], null, 2));
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    await pool.end();
    process.exit(1);
  }
}

check();
