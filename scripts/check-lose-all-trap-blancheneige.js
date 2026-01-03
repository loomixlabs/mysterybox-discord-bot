/**
 * Vérifier la configuration exacte du piège lose-all-collectibles dans Blanche-Neige
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    console.log('🔍 PIÈGE lose-all-collectibles DANS BLANCHE-NEIGE\n');
    console.log('='.repeat(80));

    const trap = await pool.query(`
      SELECT t.*, th.name as theme_name, th.guild_id as theme_guild
      FROM traps t
      JOIN themes th ON t.theme_id = th.id
      WHERE t.type = 'lose-all-collectibles'
      LIMIT 1
    `);

    if (trap.rows.length > 0) {
      console.log('\n📋 Piège existant:\n');
      const t = trap.rows[0];
      console.log(`   Theme: ${t.theme_name} (ID: ${t.theme_id})`);
      console.log(`   Guild: ${t.theme_guild}`);
      console.log('');
      console.log(JSON.stringify(t, null, 2));
    } else {
      console.log('\n❌ Aucun piège lose-all-collectibles trouvé');
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
