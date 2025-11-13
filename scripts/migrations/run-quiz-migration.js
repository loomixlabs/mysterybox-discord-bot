const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('🔍 Connexion à PostgreSQL...\n');

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, 'database', 'migrations', 'create-quiz-questions-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Exécution de la migration create-quiz-questions-table.sql...\n');

    // Exécuter la migration
    await pool.query(sql);

    console.log('✅ Table quiz_questions créée avec succès !\n');

    // Vérifier si le thème "Blanche-Neige" existe
    const theme = await pool.query(
      `SELECT id FROM themes WHERE name LIKE '%Blanche%' AND guild_id = $1 LIMIT 1`,
      [process.env.GUILD_ID]
    );

    if (theme.rows.length > 0) {
      const themeId = theme.rows[0].id;
      console.log(`📚 Thème trouvé : ID ${themeId}\n`);

      // Ajouter une question de quiz exemple
      console.log('➕ Ajout d\'une question de quiz exemple...\n');

      await pool.query(
        `INSERT INTO quiz_questions (guild_id, theme_id, question_text, correct_answer, hint, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [
          process.env.GUILD_ID,
          themeId,
          'Combien y a-t-il de nains dans Blanche-Neige ?',
          '7',
          'Ils vivent avec Blanche-Neige dans la forêt',
          'easy'
        ]
      );

      console.log('✅ Question exemple ajoutée !\n');

      // Afficher toutes les questions
      const questions = await pool.query(
        `SELECT * FROM quiz_questions WHERE guild_id = $1 AND theme_id = $2`,
        [process.env.GUILD_ID, themeId]
      );

      console.log(`📋 Questions dans la base de données (${questions.rows.length}):\n`);
      questions.rows.forEach((q, i) => {
        console.log(`${i + 1}. ${q.question_text}`);
        console.log(`   Réponse: ${q.correct_answer}`);
        if (q.hint) console.log(`   Indice: ${q.hint}`);
        console.log(`   Difficulté: ${q.difficulty}\n`);
      });
    } else {
      console.log('⚠️  Aucun thème Blanche-Neige trouvé, pas de question exemple ajoutée\n');
    }

    console.log('✅ Migration terminée avec succès !');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
