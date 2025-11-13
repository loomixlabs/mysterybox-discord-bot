const db = require('./utils/database-pg');

async function fixGuildConfig() {
  try {
    const guildId = '1248028543389143070'; // Nouveau serveur

    console.log('🔍 Vérification de guild_config pour', guildId);

    // D'abord, vérifier la structure de la table
    const columns = await db.queryAll(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'guild_config'
       ORDER BY ordinal_position`
    );

    console.log('\n📋 Structure de guild_config:');
    columns.forEach(col => console.log(`  - ${col.column_name} (${col.data_type})`));

    // Vérifier si le guild_config existe
    const existingConfig = await db.queryOne(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    if (existingConfig) {
      console.log('\n✅ guild_config existe déjà:', existingConfig);
    } else {
      console.log('\n⚠️ guild_config n\'existe pas, création...');

      // Créer l'entrée guild_config avec guild_id et guild_name
      await db.query(
        `INSERT INTO guild_config (guild_id, guild_name)
         VALUES ($1, $2)
         ON CONFLICT (guild_id) DO NOTHING`,
        [guildId, 'Nouveau Serveur']
      );

      console.log('✅ guild_config créé pour', guildId);
    }

    // Afficher tous les guild_configs
    const allConfigs = await db.queryAll('SELECT guild_id FROM guild_config');
    console.log('\n📋 Tous les guild_configs:');
    allConfigs.forEach(c => console.log('  -', c.guild_id));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixGuildConfig();
