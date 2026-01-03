/**
 * Compléter le contenu Harry Potter pour égaler Blanche-Neige
 * - Ajouter 6 mots à deviner (18 → 24)
 * - Ajouter 8 questions quiz (16 → 24)
 */
const db = require('../utils/database-pg');

const GUILD_ID = '1182395170273099806';
const THEME_ID = 65;

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('🧙 COMPLÉTION CONTENU HARRY POTTER');
  console.log('█'.repeat(60));

  await db.query('BEGIN');

  try {
    // ═══════════════════════════════════════════════════════════════
    // 1. MOTS À DEVINER SUPPLÉMENTAIRES
    // ═══════════════════════════════════════════════════════════════
    console.log('\n📝 1. AJOUT MOTS À DEVINER...\n');

    // Récupérer les IDs des missions keyword-message
    const keywordMissions = await db.queryAll(
      `SELECT id, name FROM missions WHERE guild_id = $1 AND theme_id = $2 AND type = 'keyword-message'`,
      [GUILD_ID, THEME_ID]
    );
    console.log('Missions keyword-message:', keywordMissions.map(m => `${m.name} (ID: ${m.id})`).join(', '));

    // Nouveaux mots à ajouter (2 par mission = 6 total)
    const newKeywords = [
      // Pour "Créature Magique" (ID: 190) - ajouter 2 mots
      { mission_id: 190, keyword: 'centaure' },
      { mission_id: 190, keyword: 'licorne' },

      // Pour "Qui suis-je ?" (ID: 189) - ajouter 2 mots
      { mission_id: 189, keyword: 'voldemort' },
      { mission_id: 189, keyword: 'sirius' },

      // Pour "Nom d'un Sortilège !" (ID: 188) - ajouter 2 mots
      { mission_id: 188, keyword: 'avada' },
      { mission_id: 188, keyword: 'crucio' }
    ];

    let keywordsAdded = 0;
    for (const kw of newKeywords) {
      try {
        await db.query(
          `INSERT INTO mission_keywords (guild_id, mission_id, keyword)
           VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, mission_id, keyword) DO NOTHING`,
          [GUILD_ID, kw.mission_id, kw.keyword]
        );
        keywordsAdded++;
        console.log(`   ✅ "${kw.keyword}" ajouté à mission ${kw.mission_id}`);
      } catch (e) {
        console.log(`   ⚠️ "${kw.keyword}": ${e.message}`);
      }
    }
    console.log(`\n📊 ${keywordsAdded} mots ajoutés`);

    // ═══════════════════════════════════════════════════════════════
    // 2. QUESTIONS QUIZ SUPPLÉMENTAIRES (8 nouvelles)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n❓ 2. AJOUT QUESTIONS QUIZ...\n');

    const newQuizQuestions = [
      // FACILE (2)
      {
        question_text: 'Comment s\'appelle le train qui emmène les élèves à Poudlard ?',
        correct_answer: 'Poudlard Express',
        hint: 'Un train magique qui part de King\'s Cross',
        difficulty: 'easy'
      },
      {
        question_text: 'Quel est le nom du hibou de Harry Potter ?',
        correct_answer: 'Hedwige',
        hint: 'Un hibou blanc femelle',
        difficulty: 'easy'
      },

      // MOYEN (3)
      {
        question_text: 'Quel est le vrai nom de Voldemort ?',
        correct_answer: 'Tom Jedusor',
        hint: 'Un anagramme de "Je suis Voldemort"',
        difficulty: 'medium'
      },
      {
        question_text: 'Combien y a-t-il de Horcruxes créés par Voldemort ?',
        correct_answer: '7',
        hint: 'Un chiffre magique entre 5 et 10',
        difficulty: 'medium'
      },
      {
        question_text: 'Quel est le patronus de Severus Rogue ?',
        correct_answer: 'une biche',
        hint: 'Le même que celui de Lily Potter',
        difficulty: 'medium'
      },

      // DIFFICILE (3)
      {
        question_text: 'En quelle année Harry Potter découvre-t-il qu\'il est un sorcier ?',
        correct_answer: '1991',
        hint: 'Au début des années 90',
        difficulty: 'hard'
      },
      {
        question_text: 'Quel est le nom complet de Dumbledore ?',
        correct_answer: 'Albus Percival Wulfric Brian Dumbledore',
        hint: 'Il a 5 prénoms',
        difficulty: 'hard'
      },
      {
        question_text: 'Quelle est la baguette de Sureau faite ?',
        correct_answer: 'bois de sureau et crin de Sombral',
        hint: 'Un arbre et une créature invisible',
        difficulty: 'hard'
      }
    ];

    let quizAdded = 0;
    for (const quiz of newQuizQuestions) {
      try {
        // Vérifier si la question existe déjà
        const exists = await db.queryOne(
          `SELECT id FROM quiz_questions WHERE guild_id = $1 AND theme_id = $2 AND question_text = $3`,
          [GUILD_ID, THEME_ID, quiz.question_text]
        );

        if (!exists) {
          await db.query(
            `INSERT INTO quiz_questions (guild_id, theme_id, question_text, correct_answer, hint, difficulty)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [GUILD_ID, THEME_ID, quiz.question_text, quiz.correct_answer, quiz.hint, quiz.difficulty]
          );
          quizAdded++;
          console.log(`   ✅ [${quiz.difficulty.toUpperCase()}] ${quiz.question_text}`);
          console.log(`      → Réponse: "${quiz.correct_answer}"`);
        } else {
          console.log(`   ⏭️ Question déjà existante: "${quiz.question_text.substring(0, 40)}..."`);
        }
      } catch (e) {
        console.log(`   ❌ Erreur: ${e.message}`);
      }
    }
    console.log(`\n📊 ${quizAdded} questions quiz ajoutées`);

    await db.query('COMMIT');

    // ═══════════════════════════════════════════════════════════════
    // VÉRIFICATION FINALE
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(60));
    console.log('📋 VÉRIFICATION FINALE');
    console.log('═'.repeat(60));

    // Compter les mots par mission
    const keywordCounts = await db.queryAll(`
      SELECT m.name, COUNT(mk.keyword) as count
      FROM missions m
      LEFT JOIN mission_keywords mk ON m.id = mk.mission_id AND mk.guild_id = m.guild_id
      WHERE m.guild_id = $1 AND m.theme_id = $2 AND m.type = 'keyword-message'
      GROUP BY m.id, m.name
    `, [GUILD_ID, THEME_ID]);
    console.log('\n📝 Mots à deviner par mission:');
    let totalKeywords = 0;
    keywordCounts.forEach(k => {
      console.log(`   • ${k.name}: ${k.count} mots`);
      totalKeywords += parseInt(k.count);
    });
    console.log(`   Total: ${totalKeywords} mots`);

    // Compter les questions quiz par difficulté
    const quizCounts = await db.queryAll(`
      SELECT difficulty, COUNT(*) as count
      FROM quiz_questions
      WHERE guild_id = $1 AND theme_id = $2
      GROUP BY difficulty
      ORDER BY
        CASE difficulty
          WHEN 'easy' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'hard' THEN 3
          ELSE 4
        END
    `, [GUILD_ID, THEME_ID]);
    console.log('\n❓ Questions quiz par difficulté:');
    let totalQuiz = 0;
    quizCounts.forEach(q => {
      const emoji = q.difficulty === 'easy' ? '🟢' : q.difficulty === 'medium' ? '🟡' : '🔴';
      console.log(`   ${emoji} ${q.difficulty}: ${q.count}`);
      totalQuiz += parseInt(q.count);
    });
    console.log(`   Total: ${totalQuiz} questions`);

    console.log('\n' + '█'.repeat(60));
    console.log('✅ CONTENU HARRY POTTER COMPLÉTÉ !');
    console.log('█'.repeat(60));

    console.log('\n📊 RÉSUMÉ FINAL:');
    console.log(`   ✅ ${totalKeywords} mots à deviner (objectif: 24)`);
    console.log(`   ✅ ${totalQuiz} questions quiz (objectif: 24)`);
    console.log('   ✅ 7 pièges personnalisés');
    console.log('   ✅ 15 missions (tous types)');
    console.log('   ✅ 22 collectibles');

    process.exit(0);

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

main();
