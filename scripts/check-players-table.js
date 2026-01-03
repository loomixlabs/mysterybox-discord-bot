const db = require('../utils/database-pg');

async function checkPlayersTable() {
  try {
    console.log('🔍 VÉRIFICATION TABLE PLAYERS\n');
    console.log('='.repeat(80));

    const result = await db.queryAll(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'players'
      ORDER BY ordinal_position
    `);

    console.table(result);
    console.log(`\n✅ ${result.length} colonne(s) trouvée(s)`);

    // Vérifier si preferred_color existe
    const hasPreferredColor = result.some(col => col.column_name === 'preferred_color');
    console.log(`\n📊 Colonne 'preferred_color': ${hasPreferredColor ? '✅ Existe' : '❌ N\'existe pas'}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkPlayersTable();
