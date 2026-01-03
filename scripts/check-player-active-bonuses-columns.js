/**
 * Vérification de la structure de player_active_bonuses
 */

const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 Structure de player_active_bonuses');
  console.log('='.repeat(60));

  try {
    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Colonnes:');
    console.table(columns);

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

check();
