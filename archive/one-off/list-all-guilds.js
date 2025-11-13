const db = require('./utils/database-pg');

async function listAllGuilds() {
  try {
    console.log('🔍 Liste de tous les serveurs configurés...\n');

    const guilds = await db.queryAll(`
      SELECT guild_id, guild_name, is_active, added_at
      FROM guild_config
      ORDER BY added_at DESC
    `);

    console.log(`📋 ${guilds.length} serveur(s) trouvé(s):\n`);

    for (const guild of guilds) {
      console.log(`─────────────────────────────────────`);
      console.log(`Guild ID: ${guild.guild_id}`);
      console.log(`Nom: ${guild.guild_name}`);
      console.log(`Actif: ${guild.is_active ? 'OUI' : 'NON'}`);
      console.log(`Ajouté le: ${guild.added_at}`);

      // Compter les thèmes pour ce serveur
      const themes = await db.queryAll(
        'SELECT id, name, is_active FROM themes WHERE guild_id = $1',
        [guild.guild_id]
      );

      console.log(`Thèmes: ${themes.length}`);
      if (themes.length > 0) {
        themes.forEach(t => {
          console.log(`  - "${t.name}" (ID: ${t.id}) ${t.is_active ? '✅ ACTIF' : ''}`);
        });
      }
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

listAllGuilds();
