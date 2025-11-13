const db = require('./utils/database-pg');

async function createTable() {
  try {
    console.log('🔍 Création de la table quiz_questions...\n');

    const sql = `
-- Création de la table quiz_questions
CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  wrong_answers TEXT[],
  hint TEXT,
  difficulty VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_quiz_questions_guild_theme ON quiz_questions(guild_id, theme_id);
    `;

    await db.query(sql);

    console.log('✅ Table quiz_questions créée avec succès !\n');

    // Vérifier la table
    const tableExists = await db.queryOne(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'quiz_questions'
    `);

    if (tableExists) {
      console.log('✅ Vérification: La table quiz_questions existe\n');
    }

    // Ajouter une question exemple
    console.log('➕ Ajout d\'une question exemple...\n');

    const theme = await db.getActiveTheme(process.env.GUILD_ID);

    if (theme) {
      const question = await db.addQuizQuestion(
        process.env.GUILD_ID,
        theme.id,
        'Combien y a-t-il de nains dans Blanche-Neige ?',
        '7',
        ['3', '5', '8', '10'],
        'Ils vivent avec Blanche-Neige dans la forêt',
        'easy'
      );

      console.log(`✅ Question ajoutée (ID: ${question.id})\n`);

      // Vérifier
      const allQuestions = await db.queryAll(`
        SELECT * FROM quiz_questions WHERE guild_id = $1 AND theme_id = $2
      `, [process.env.GUILD_ID, theme.id]);

      console.log(`📋 Total de questions: ${allQuestions.length}\n`);
      allQuestions.forEach((q, i) => {
        console.log(`${i + 1}. ${q.question_text}`);
        console.log(`   Réponse: ${q.correct_answer}`);
        if (q.hint) console.log(`   Indice: ${q.hint}`);
        console.log();
      });
    }

    console.log('✅ Tout est prêt ! Tu peux maintenant lancer des quiz.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createTable();
