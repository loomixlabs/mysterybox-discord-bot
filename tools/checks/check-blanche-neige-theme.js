const db = require('./utils/database-pg');

async function checkBlancheNeigeTheme() {
  try {
    const guildId = '1248028543389143070';

    console.log('🔍 Recherche du thème "Blanche neige"...\n');

    // Récupérer tous les thèmes
    const themes = await db.getAllThemes(guildId);

    console.log(`📋 Thèmes disponibles pour ce serveur:\n`);
    themes.forEach(t => {
      console.log(`  - ID: ${t.id}, Nom: "${t.name}", Actif: ${t.is_active ? 'OUI' : 'NON'}`);
    });

    // Trouver le thème Blanche neige
    const blancheNeigeTheme = themes.find(t => t.name.toLowerCase().includes('blanche'));

    if (!blancheNeigeTheme) {
      console.log('\n❌ Thème "Blanche neige" introuvable. Assure-toi de l\'avoir créé d\'abord.');
      process.exit(1);
    }

    console.log(`\n✅ Thème trouvé: "${blancheNeigeTheme.name}" (ID: ${blancheNeigeTheme.id})\n`);

    // Récupérer les missions pour ce serveur
    console.log('🔍 Recherche des missions "Mot Deviné" et "Quiz"...\n');

    const missions = await db.queryAll(`
      SELECT id, mission_id, name, type
      FROM missions
      WHERE guild_id = $1
      ORDER BY id
    `, [guildId]);

    console.log('📋 Missions disponibles:\n');
    missions.forEach(m => {
      console.log(`  - ID: ${m.id}, Type: ${m.type}, Nom: "${m.name}"`);
    });

    // Trouver les missions spécifiques
    const motDevineMission = missions.find(m => m.type === 'keyword-message');
    const quizMission = missions.find(m => m.type === 'quiz');

    console.log('\n📌 Missions cibles:');
    if (motDevineMission) {
      console.log(`  ✅ Mot Deviné (ID: ${motDevineMission.id})`);
    } else {
      console.log('  ❌ Mot Deviné - INTROUVABLE');
    }

    if (quizMission) {
      console.log(`  ✅ Quiz (ID: ${quizMission.id})`);
    } else {
      console.log('  ❌ Quiz - INTROUVABLE');
    }

    console.log('\n📊 RÉSUMÉ POUR L\'INSERTION:');
    console.log('─────────────────────────────────────');
    console.log(`Guild ID: ${guildId}`);
    console.log(`Thème ID: ${blancheNeigeTheme.id}`);
    console.log(`Mission "Mot Deviné" ID: ${motDevineMission ? motDevineMission.id : 'N/A'}`);
    console.log(`Mission "Quiz" ID: ${quizMission ? quizMission.id : 'N/A'}`);
    console.log('─────────────────────────────────────\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkBlancheNeigeTheme();
