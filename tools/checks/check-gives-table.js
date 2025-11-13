const db = require('./utils/database-pg');

async function checkGivesTable() {
  try {
    console.log('🔄 Vérification de la structure de la table give_logs...\n');

    // 1. Structure de la table
    console.log('📋 Structure actuelle:');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name='give_logs'
      ORDER BY ordinal_position;
    `);

    console.table(columns);

    // 2. Vérifier si target_channels existe
    const targetChannelsExists = columns.find(col => col.column_name === 'target_channels');

    if (targetChannelsExists) {
      console.log('\n✅ La colonne target_channels existe déjà!');
    } else {
      console.log('\n❌ La colonne target_channels n\'existe pas.');
    }

    // 3. Quelques exemples de gives
    console.log('\n📊 Exemples de gives récents:');
    const gives = await db.queryAll(`
      SELECT id, guild_id, give_type, channel_id, launched_at
      FROM give_logs
      ORDER BY launched_at DESC
      LIMIT 5;
    `);

    if (gives && gives.length > 0) {
      console.table(gives);
    } else {
      console.log('Aucun give trouvé.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkGivesTable();
