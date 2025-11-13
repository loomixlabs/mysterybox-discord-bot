const db = require('./utils/database-pg');

async function checkQuizAnswer() {
  try {
    console.log('🔍 Vérification de la question de quiz...\n');

    const questions = await db.queryAll(`
      SELECT q.id, q.question_text, q.correct_answer, q.wrong_answers, t.name as theme
      FROM quiz_questions q
      JOIN themes t ON q.theme_id = t.id
      WHERE t.name LIKE '%Blanche%'
      ORDER BY q.id
    `);

    if (questions.length === 0) {
      console.log('❌ Aucune question trouvée pour le thème Blanche-Neige');
      process.exit(1);
    }

    questions.forEach(q => {
      console.log(`📋 Question ${q.id}:`);
      console.log(`   Question: ${q.question_text}`);
      console.log(`   Réponse correcte: "${q.correct_answer}"`);
      console.log(`   Mauvaises réponses: ${JSON.stringify(q.wrong_answers)}`);
      console.log(`   Thème: ${q.theme}\n`);
    });

    console.log('✅ Vérification terminée !');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkQuizAnswer();
