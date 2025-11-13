const db = require('./utils/database-pg');

async function addQuestion() {
  try {
    console.log('🔍 Ajout d\'une question de quiz...\n');

    // Récupérer le thème actif
    const theme = await db.getActiveTheme(process.env.GUILD_ID);

    if (!theme) {
      console.log('❌ Aucun thème actif trouvé');
      process.exit(1);
    }

    console.log(`✅ Thème actif: ${theme.name} (ID: ${theme.id})\n`);

    // Ajouter une question
    const question = await db.addQuizQuestion(
      process.env.GUILD_ID,
      theme.id,
      'Combien y a-t-il de nains dans Blanche-Neige ?',
      '7',
      ['3', '5', '8', '10'], // Mauvaises réponses (pour un futur QCM)
      'Ils vivent avec Blanche-Neige dans la forêt',
      'easy'
    );

    console.log(`✅ Question ajoutée avec succès (ID: ${question.id})\n`);

    // Vérifier toutes les questions
    const questions = await db.queryAll(`
      SELECT * FROM quiz_questions
      WHERE guild_id = $1 AND theme_id = $2
    `, [process.env.GUILD_ID, theme.id]);

    console.log(`📋 Questions dans la base (${questions.length}):\n`);
    questions.forEach((q, i) => {
      console.log(`${i + 1}. ${q.question_text}`);
      console.log(`   Réponse: ${q.correct_answer}`);
      if (q.hint) console.log(`   Indice: ${q.hint}`);
      console.log(`   Difficulté: ${q.difficulty}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

addQuestion();
