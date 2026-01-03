/**
 * Analyser le contenu actuel du thème Harry Potter
 * Pour comparer avec Blanche-Neige
 */
const db = require('../utils/database-pg');

const GUILD_ID = '1182395170273099806';
const THEME_ID = 65;

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('🧙 ANALYSE CONTENU HARRY POTTER vs BLANCHE-NEIGE');
  console.log('█'.repeat(60));

  // 1. Missions
  console.log('\n📋 1. MISSIONS:');
  const missions = await db.queryAll(
    `SELECT id, name, type, validation_type FROM missions WHERE guild_id = $1 AND theme_id = $2`,
    [GUILD_ID, THEME_ID]
  );
  console.table(missions);

  // Compter par type
  const missionTypes = {};
  missions.forEach(m => {
    missionTypes[m.type] = (missionTypes[m.type] || 0) + 1;
  });
  console.log('\nRépartition par type:', missionTypes);

  // 2. Mots à deviner (mission_keywords)
  console.log('\n📋 2. MOTS À DEVINER (mission_keywords):');
  // Trouver les missions keyword-message
  const keywordMissions = missions.filter(m => m.type === 'keyword-message');

  if (keywordMissions.length > 0) {
    for (const mission of keywordMissions) {
      const keywords = await db.queryAll(
        `SELECT keyword FROM mission_keywords WHERE guild_id = $1 AND mission_id = $2`,
        [GUILD_ID, mission.id]
      );
      console.log(`\nMission "${mission.name}" (ID: ${mission.id}):`);
      console.log(`  → ${keywords.length} mots: ${keywords.map(k => k.keyword).join(', ')}`);
    }
  } else {
    console.log('  ⚠️ Aucune mission keyword-message trouvée');
  }

  // 3. Questions de Quiz
  console.log('\n📋 3. QUESTIONS QUIZ:');
  const quizQuestions = await db.queryAll(
    `SELECT id, question_text, correct_answer, difficulty, hint FROM quiz_questions WHERE guild_id = $1 AND theme_id = $2`,
    [GUILD_ID, THEME_ID]
  );
  console.log(`Total: ${quizQuestions.length} questions`);

  // Répartition par difficulté
  const diffCount = {};
  quizQuestions.forEach(q => {
    diffCount[q.difficulty || 'non-définie'] = (diffCount[q.difficulty || 'non-définie'] || 0) + 1;
  });
  console.log('Par difficulté:', diffCount);

  // Afficher quelques questions
  console.log('\nExemples de questions:');
  quizQuestions.slice(0, 5).forEach((q, i) => {
    console.log(`  ${i+1}. ${q.question_text}`);
    console.log(`     → Réponse: "${q.correct_answer}" | Difficulté: ${q.difficulty || 'N/A'}`);
  });

  // 4. Pièges
  console.log('\n📋 4. PIÈGES:');
  const traps = await db.queryAll(
    `SELECT name, type, notif_title FROM traps WHERE guild_id = $1 AND theme_id = $2`,
    [GUILD_ID, THEME_ID]
  );
  console.table(traps);

  // 5. Collectibles
  console.log('\n📋 5. COLLECTIBLES:');
  const collectibles = await db.queryAll(
    `SELECT rarity, COUNT(*) as count FROM collectibles WHERE guild_id = $1 AND theme_id = $2 GROUP BY rarity ORDER BY rarity`,
    [GUILD_ID, THEME_ID]
  );
  console.table(collectibles);

  // Résumé comparatif
  console.log('\n' + '═'.repeat(60));
  console.log('📊 COMPARAISON HP vs BLANCHE-NEIGE');
  console.log('═'.repeat(60));
  console.log('\n| Élément                | Blanche-Neige | Harry Potter |');
  console.log('|------------------------|---------------|--------------|');
  console.log(`| Mots à deviner         | 24            | À vérifier   |`);
  console.log(`| Questions Quiz         | 24            | ${quizQuestions.length}            |`);
  console.log(`| Pièges                 | 4             | ${traps.length}             |`);
  console.log(`| Missions               | ~4-5          | ${missions.length}            |`);

  console.log('\n⚠️ CE QUI MANQUE POUR ÊTRE COMPLET:');
  if (quizQuestions.length < 24) {
    console.log(`   • Ajouter ${24 - quizQuestions.length} questions quiz`);
  }
  console.log('   • Vérifier/ajouter mots à deviner pour missions keyword-message');
  console.log('   • Les pièges sont déjà personnalisés ✅');

  process.exit(0);
}

main().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
