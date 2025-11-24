const db = require('./utils/database-pg');

async function fix() {
  console.log('🔧 Réparation des questions quiz orphelines...\n');

  const guildId = process.env.GUILD_ID;

  // 1. Récupérer les missions quiz par thème
  const quizMissions = await db.queryAll(`
    SELECT m.id as mission_id, m.theme_id, m.name, t.name as theme_name
    FROM missions m
    JOIN themes t ON m.theme_id = t.id
    WHERE m.guild_id = $1 AND m.type = 'quiz'
    ORDER BY m.theme_id, m.id
  `, [guildId]);

  console.log('📋 Missions quiz trouvées:');
  console.table(quizMissions.map(m => ({
    mission_id: m.mission_id,
    theme: m.theme_name,
    mission: m.name
  })));

  // 2. Récupérer les questions orphelines par thème
  const orphanQuestions = await db.queryAll(`
    SELECT qq.id, qq.theme_id, qq.question_text, t.name as theme_name
    FROM quiz_questions qq
    JOIN themes t ON qq.theme_id = t.id
    WHERE qq.guild_id = $1 AND qq.mission_id IS NULL
    ORDER BY qq.theme_id, qq.id
  `, [guildId]);

  console.log(`\n❌ Questions orphelines: ${orphanQuestions.length}`);

  // 3. Grouper les missions par theme_id
  const missionsByTheme = {};
  quizMissions.forEach(m => {
    if (!missionsByTheme[m.theme_id]) {
      missionsByTheme[m.theme_id] = [];
    }
    missionsByTheme[m.theme_id].push(m);
  });

  // 4. Grouper les questions par theme_id
  const questionsByTheme = {};
  orphanQuestions.forEach(q => {
    if (!questionsByTheme[q.theme_id]) {
      questionsByTheme[q.theme_id] = [];
    }
    questionsByTheme[q.theme_id].push(q);
  });

  // 5. Lier les questions aux missions
  let linkedCount = 0;
  let skippedCount = 0;

  for (const [themeId, questions] of Object.entries(questionsByTheme)) {
    const themeMissions = missionsByTheme[themeId] || [];
    const themeName = questions[0]?.theme_name || 'Unknown';

    if (themeMissions.length === 0) {
      console.log(`\n⚠️  Thème "${themeName}": ${questions.length} questions mais aucune mission quiz - SKIP`);
      skippedCount += questions.length;
      continue;
    }

    if (themeMissions.length === 1) {
      // Un seul mission quiz = toutes les questions vont à cette mission
      const missionId = themeMissions[0].mission_id;
      console.log(`\n✅ Thème "${themeName}": ${questions.length} questions → Mission "${themeMissions[0].name}"`);

      for (const question of questions) {
        await db.query(`
          UPDATE quiz_questions
          SET mission_id = $1
          WHERE id = $2
        `, [missionId, question.id]);
        linkedCount++;
      }
    } else {
      // Plusieurs missions quiz = impossible de lier automatiquement
      console.log(`\n⚠️  Thème "${themeName}": ${questions.length} questions mais ${themeMissions.length} missions quiz`);
      console.log(`   Missions: ${themeMissions.map(m => `"${m.name}"`).join(', ')}`);
      console.log(`   ⚠️  Liaison automatique impossible - Nécessite ré-import manuel du thème`);
      skippedCount += questions.length;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Résultats:`);
  console.log(`   ✅ Questions liées: ${linkedCount}`);
  console.log(`   ⚠️  Questions non liées: ${skippedCount}`);

  if (skippedCount > 0) {
    console.log(`\n⚠️  Pour les thèmes avec plusieurs missions quiz, vous devez:`);
    console.log(`   1. Exporter le thème avec le nouveau code (utils/themeExporter.js)`);
    console.log(`   2. Ré-importer le thème avec le nouveau code (utils/themeImporter.js)`);
  }

  await db.close();
  process.exit(0);
}

fix().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
