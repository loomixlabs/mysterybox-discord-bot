const db = require('./utils/database-pg');

async function activateBlancheNeige() {
  try {
    const guildId = '1248028543389143070';

    console.log('🔍 Recherche du thème "Blanche neige"...\n');

    // Récupérer tous les thèmes du serveur
    const themes = await db.getAllThemes(guildId);

    if (themes.length === 0) {
      console.log('❌ Aucun thème trouvé pour ce serveur');
      process.exit(1);
    }

    console.log(`✅ ${themes.length} thème(s) trouvé(s):`);
    themes.forEach(t => {
      console.log(`  - ID: ${t.id}, Nom: "${t.name}", Actif: ${t.is_active ? 'OUI' : 'NON'}`);
    });

    // Trouver le thème Blanche neige (insensible à la casse)
    const blancheNeigeTheme = themes.find(t => t.name.toLowerCase().includes('blanche'));

    if (!blancheNeigeTheme) {
      console.log('\n❌ Thème "Blanche neige" introuvable. Vérifie qu\'il a bien été créé.');
      process.exit(1);
    }

    if (blancheNeigeTheme.is_active) {
      console.log(`\n✅ Le thème "${blancheNeigeTheme.name}" est déjà actif !`);
      process.exit(0);
    }

    console.log(`\n⚙️ Activation du thème "${blancheNeigeTheme.name}"...`);

    // Désactiver tous les autres thèmes
    await db.query(
      'UPDATE themes SET is_active = FALSE WHERE guild_id = $1',
      [guildId]
    );

    // Activer le thème Blanche neige
    await db.query(
      'UPDATE themes SET is_active = TRUE WHERE guild_id = $1 AND id = $2',
      [guildId, blancheNeigeTheme.id]
    );

    console.log(`✅ Thème "${blancheNeigeTheme.name}" activé avec succès !`);

    // Vérifier
    const activeTheme = await db.getActiveTheme(guildId);
    console.log(`\n📋 Thème actif: ${activeTheme.name} (ID: ${activeTheme.id})\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

activateBlancheNeige();
