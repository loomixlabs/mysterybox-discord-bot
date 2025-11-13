const db = require('./utils/database-pg');

async function activateTheme() {
  try {
    const guildId = '1248028543389143070';

    console.log('🔍 Recherche du thème à activer...');

    // Récupérer tous les thèmes du serveur
    const themes = await db.getAllThemes(guildId);

    if (themes.length === 0) {
      console.log('❌ Aucun thème trouvé pour ce serveur');
      process.exit(1);
    }

    console.log(`✅ ${themes.length} thème(s) trouvé(s):`);
    themes.forEach(t => {
      console.log(`  - ID: ${t.id}, Nom: ${t.name}, Actif: ${t.is_active ? 'OUI' : 'NON'}`);
    });

    // Prendre le dernier thème créé (le plus récent)
    const latestTheme = themes[themes.length - 1];

    if (latestTheme.is_active) {
      console.log(`\n✅ Le thème "${latestTheme.name}" est déjà actif`);
      process.exit(0);
    }

    console.log(`\n⚙️ Activation du thème "${latestTheme.name}"...`);

    // Désactiver tous les autres thèmes
    await db.query(
      'UPDATE themes SET is_active = FALSE WHERE guild_id = $1',
      [guildId]
    );

    // Activer ce thème
    await db.query(
      'UPDATE themes SET is_active = TRUE WHERE guild_id = $1 AND id = $2',
      [guildId, latestTheme.id]
    );

    console.log(`✅ Thème "${latestTheme.name}" activé avec succès !`);

    // Vérifier
    const activeTheme = await db.getActiveTheme(guildId);
    console.log(`\n📋 Thème actif: ${activeTheme.name} (ID: ${activeTheme.id})`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

activateTheme();
