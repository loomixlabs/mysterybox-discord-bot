/**
 * Vérifie l'état is_active des thèmes en DB
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    console.log('🔍 ANALYSE is_active DES THÈMES\n');
    console.log('='.repeat(80));

    const themes = await pool.query(`
      SELECT id, name, is_active, activated_at, duration_days, created_at
      FROM themes
      WHERE guild_id = '1248028543389143070'
      ORDER BY is_active DESC, id
    `);

    console.log('\n📊 Thèmes du serveur de production:');
    console.table(themes.rows.map(t => ({
      ID: t.id,
      Nom: t.name.substring(0, 25),
      'is_active': t.is_active,
      'activated_at': t.activated_at ? new Date(t.activated_at).toLocaleDateString('fr-FR') : '-',
      'duration_days': t.duration_days
    })));

    const activeCount = themes.rows.filter(t => t.is_active).length;
    console.log(`\n✅ Thèmes actifs: ${activeCount}`);
    console.log(`📦 Thèmes inactifs: ${themes.rows.length - activeCount}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    await pool.end();
    process.exit(1);
  }
}

check();
