const db = require('./utils/database-pg');

async function checkPlayersSchema() {
  console.log('🔍 SCHÉMA DE LA TABLE PLAYERS\n');
  console.log('='.repeat(80));

  try {
    // Récupérer le schéma de la table players
    const schema = await db.queryAll(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'players'
      ORDER BY ordinal_position
    `);

    console.log('📋 Colonnes de la table players:\n');
    console.table(schema);

    // Vérifier les données d'un joueur
    const samplePlayer = await db.queryOne(`
      SELECT * FROM players LIMIT 1
    `);

    console.log('\n📝 Exemple de joueur:\n');
    if (samplePlayer) {
      console.table(samplePlayer);
    } else {
      console.log('⚠️  Aucun joueur dans la table');
    }

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkPlayersSchema();
