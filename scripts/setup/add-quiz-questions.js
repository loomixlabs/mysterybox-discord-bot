const db = require('./utils/database-pg');

async function addQuizQuestions() {
  try {
    const guildId = '297309737135898624';
    const themeId = 1; // Blanche-Neige theme

    console.log('📝 Ajout de questions de quiz pour le thème Blanche-Neige...\n');

    const questions = [
      {
        questionText: 'Combien de nains accompagnent Blanche-Neige ?',
        correctAnswer: '7',
        wrongAnswers: ['5', '8', '6'],
        hint: 'Sept nains célèbres !',
        difficulty: 'easy'
      },
      {
        questionText: 'Quel fruit empoisonné est donné à Blanche-Neige ?',
        correctAnswer: 'pomme',
        wrongAnswers: ['poire', 'raisin', 'fraise'],
        hint: 'Un fruit rouge...',
        difficulty: 'easy'
      },
      {
        questionText: 'Quel nain éternue tout le temps ?',
        correctAnswer: 'atchoum',
        wrongAnswers: ['grincheux', 'prof', 'joyeux'],
        hint: 'Son nom ressemble à un éternuement',
        difficulty: 'medium'
      },
      {
        questionText: 'Qui réveille Blanche-Neige de son sommeil ?',
        correctAnswer: 'prince',
        wrongAnswers: ['roi', 'nain', 'fée'],
        hint: 'Le vrai amour...',
        difficulty: 'easy'
      },
      {
        questionText: 'Comment s\'appelle le nain le plus intelligent ?',
        correctAnswer: 'prof',
        wrongAnswers: ['sage', 'malin', 'savant'],
        hint: 'Il enseigne aux autres',
        difficulty: 'medium'
      }
    ];

    for (const q of questions) {
      const result = await db.addQuizQuestion(
        guildId,
        themeId,
        q.questionText,
        q.correctAnswer,
        q.wrongAnswers,
        q.hint,
        q.difficulty
      );
      console.log(`✅ Question ajoutée: ${q.questionText}`);
    }

    console.log(`\n✅ ${questions.length} questions de quiz ajoutées avec succès!\n`);

    // Vérifier
    const allQuestions = await db.getQuizQuestionsByTheme(guildId, themeId);
    console.log(`📋 Total de questions pour le thème: ${allQuestions.length}\n`);

    allQuestions.forEach((q, i) => {
      console.log(`${i + 1}. ${q.question_text}`);
      console.log(`   Réponse: ${q.correct_answer}`);
      console.log(`   Difficulté: ${q.difficulty}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

addQuizQuestions();
