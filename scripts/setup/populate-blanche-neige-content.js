const db = require('./utils/database-pg');

async function populateBlancheNeigeContent() {
  try {
    const guildId = '1248028543389143070';
    const themeId = 23; // Blanche neige
    const motDevineMissionId = 12;
    const quizMissionId = 13;

    console.log('🎨 INSERTION DU CONTENU BLANCHE-NEIGE\n');
    console.log('─────────────────────────────────────');
    console.log(`Guild ID: ${guildId}`);
    console.log(`Thème ID: ${themeId}`);
    console.log(`Mission "Mot Deviné" ID: ${motDevineMissionId}`);
    console.log(`Mission "Quiz" ID: ${quizMissionId}`);
    console.log('─────────────────────────────────────\n');

    // ============================================
    // MOTS À DEVINER (mission_keywords)
    // ============================================

    const keywords = [
      // FACILE (8 mots)
      { keyword: 'pomme', difficulty: 'easy' },
      { keyword: 'miroir', difficulty: 'easy' },
      { keyword: 'reine', difficulty: 'easy' },
      { keyword: 'prince', difficulty: 'easy' },
      { keyword: 'nains', difficulty: 'easy' },
      { keyword: 'château', difficulty: 'easy' },
      { keyword: 'forêt', difficulty: 'easy' },
      { keyword: 'baiser', difficulty: 'easy' },

      // MOYEN (8 mots)
      { keyword: 'Grincheux', difficulty: 'medium' },
      { keyword: 'Dormeur', difficulty: 'medium' },
      { keyword: 'Joyeux', difficulty: 'medium' },
      { keyword: 'Atchoum', difficulty: 'medium' },
      { keyword: 'marâtre', difficulty: 'medium' },
      { keyword: 'cercueil', difficulty: 'medium' },
      { keyword: 'chasseur', difficulty: 'medium' },
      { keyword: 'sorcière', difficulty: 'medium' },

      // DIFFICILE (8 mots)
      { keyword: 'Simplet', difficulty: 'hard' },
      { keyword: 'Timide', difficulty: 'hard' },
      { keyword: 'Prof', difficulty: 'hard' },
      { keyword: 'coeur', difficulty: 'hard' },
      { keyword: 'diamant', difficulty: 'hard' },
      { keyword: 'chaumière', difficulty: 'hard' },
      { keyword: 'sortilège', difficulty: 'hard' },
      { keyword: 'vieillard', difficulty: 'hard' }
    ];

    // ============================================
    // QUESTIONS DE QUIZ (quiz_questions)
    // ============================================

    const quizQuestions = [
      // FACILE (8 questions)
      {
        question: 'Combien y a-t-il de nains dans Blanche-Neige ?',
        answer: '7',
        hint: 'Un chiffre entre 5 et 10',
        difficulty: 'easy'
      },
      {
        question: 'Quelle est la couleur de la pomme empoisonnée ?',
        answer: 'rouge',
        hint: 'Une couleur vive',
        difficulty: 'easy'
      },
      {
        question: 'Comment s\'appelle l\'héroïne du conte ?',
        answer: 'Blanche-Neige',
        hint: 'C\'est dans le titre !',
        difficulty: 'easy'
      },
      {
        question: 'Qui donne la pomme empoisonnée à Blanche-Neige ?',
        answer: 'la Reine',
        hint: 'La méchante du conte',
        difficulty: 'easy'
      },
      {
        question: 'Comment Blanche-Neige est-elle réveillée ?',
        answer: 'un baiser',
        hint: 'Un geste d\'amour',
        difficulty: 'easy'
      },
      {
        question: 'Où vivent les sept nains ?',
        answer: 'dans la forêt',
        hint: 'Là où il y a beaucoup d\'arbres',
        difficulty: 'easy'
      },
      {
        question: 'Que demande la Reine à son miroir ?',
        answer: 'qui est la plus belle',
        hint: 'Une question sur la beauté',
        difficulty: 'easy'
      },
      {
        question: 'Quel fruit empoisonne Blanche-Neige ?',
        answer: 'une pomme',
        hint: 'Un fruit rouge',
        difficulty: 'easy'
      },

      // MOYEN (8 questions)
      {
        question: 'Quel est le nom du nain qui éternue tout le temps ?',
        answer: 'Atchoum',
        hint: 'Son nom ressemble au bruit d\'un éternuement',
        difficulty: 'medium'
      },
      {
        question: 'Qui est la marâtre de Blanche-Neige ?',
        answer: 'la Reine',
        hint: 'C\'est aussi la méchante',
        difficulty: 'medium'
      },
      {
        question: 'Dans quoi Blanche-Neige est-elle placée après avoir mangé la pomme ?',
        answer: 'un cercueil de verre',
        hint: 'Un objet transparent',
        difficulty: 'medium'
      },
      {
        question: 'Quel est le métier des sept nains ?',
        answer: 'mineurs',
        hint: 'Ils travaillent dans une mine',
        difficulty: 'medium'
      },
      {
        question: 'Quel nain est toujours de mauvaise humeur ?',
        answer: 'Grincheux',
        hint: 'Son nom décrit son caractère',
        difficulty: 'medium'
      },
      {
        question: 'Qui devait tuer Blanche-Neige dans la forêt ?',
        answer: 'le chasseur',
        hint: 'Un homme qui travaille pour la Reine',
        difficulty: 'medium'
      },
      {
        question: 'Quel nain dort tout le temps ?',
        answer: 'Dormeur',
        hint: 'Son nom indique son activité préférée',
        difficulty: 'medium'
      },
      {
        question: 'Comment la Reine se déguise-t-elle pour tromper Blanche-Neige ?',
        answer: 'en vieille femme',
        hint: 'Elle prend l\'apparence d\'une personne âgée',
        difficulty: 'medium'
      },

      // DIFFICILE (8 questions)
      {
        question: 'Donne le nom d\'au moins 3 nains parmi les 7',
        answer: 'Grincheux',
        hint: 'Pense aux personnalités : joyeux, timide, grincheux...',
        difficulty: 'hard'
      },
      {
        question: 'En quelle année est sorti le film Disney Blanche-Neige ?',
        answer: '1937',
        hint: 'C\'est dans les années 1930',
        difficulty: 'hard'
      },
      {
        question: 'Que demande la Reine au chasseur comme preuve de la mort de Blanche-Neige ?',
        answer: 'le coeur',
        hint: 'Un organe vital',
        difficulty: 'hard'
      },
      {
        question: 'Quel est le nom du nain qui porte des lunettes ?',
        answer: 'Prof',
        hint: 'Il est intelligent et studieux',
        difficulty: 'hard'
      },
      {
        question: 'Que cherchent les nains dans la mine ?',
        answer: 'des diamants',
        hint: 'Des pierres précieuses',
        difficulty: 'hard'
      },
      {
        question: 'Comment s\'appelle le nain le plus naïf et innocent ?',
        answer: 'Simplet',
        hint: 'Son nom reflète sa simplicité',
        difficulty: 'hard'
      },
      {
        question: 'Quel nain est très timide et rougit facilement ?',
        answer: 'Timide',
        hint: 'Son nom décrit son caractère',
        difficulty: 'hard'
      },
      {
        question: 'Quel est le premier long-métrage d\'animation de Disney ?',
        answer: 'Blanche-Neige',
        hint: 'C\'est le conte dont on parle !',
        difficulty: 'hard'
      }
    ];

    // ============================================
    // INSERTION DANS LA BASE DE DONNÉES
    // ============================================

    await db.query('BEGIN');

    try {
      console.log('📝 Insertion des mots à deviner...\n');

      let keywordCount = { easy: 0, medium: 0, hard: 0 };

      for (const kw of keywords) {
        await db.query(
          `INSERT INTO mission_keywords (guild_id, mission_id, keyword)
           VALUES ($1, $2, $3)
           ON CONFLICT (guild_id, mission_id, keyword) DO NOTHING`,
          [guildId, motDevineMissionId, kw.keyword]
        );
        keywordCount[kw.difficulty]++;
        console.log(`  ✅ [${kw.difficulty.toUpperCase()}] "${kw.keyword}"`);
      }

      console.log(`\n📊 Mots insérés:`);
      console.log(`  🟢 Facile: ${keywordCount.easy}`);
      console.log(`  🟡 Moyen: ${keywordCount.medium}`);
      console.log(`  🔴 Difficile: ${keywordCount.hard}`);
      console.log(`  📈 Total: ${keywords.length}\n`);

      console.log('─────────────────────────────────────\n');
      console.log('❓ Insertion des questions de quiz...\n');

      let quizCount = { easy: 0, medium: 0, hard: 0 };

      for (const quiz of quizQuestions) {
        await db.query(
          `INSERT INTO quiz_questions (guild_id, theme_id, question_text, correct_answer, hint, difficulty)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [guildId, themeId, quiz.question, quiz.answer, quiz.hint, quiz.difficulty]
        );
        quizCount[quiz.difficulty]++;
        console.log(`  ✅ [${quiz.difficulty.toUpperCase()}] ${quiz.question}`);
        console.log(`     → Réponse: "${quiz.answer}"`);
      }

      console.log(`\n📊 Questions insérées:`);
      console.log(`  🟢 Facile: ${quizCount.easy}`);
      console.log(`  🟡 Moyen: ${quizCount.medium}`);
      console.log(`  🔴 Difficile: ${quizCount.hard}`);
      console.log(`  📈 Total: ${quizQuestions.length}\n`);

      await db.query('COMMIT');

      console.log('─────────────────────────────────────');
      console.log('✅ INSERTION TERMINÉE AVEC SUCCÈS !');
      console.log('─────────────────────────────────────\n');

      // Vérification finale
      const totalKeywords = await db.queryOne(
        'SELECT COUNT(*) as count FROM mission_keywords WHERE guild_id = $1 AND mission_id = $2',
        [guildId, motDevineMissionId]
      );

      const totalQuiz = await db.queryOne(
        'SELECT COUNT(*) as count FROM quiz_questions WHERE guild_id = $1 AND theme_id = $2',
        [guildId, themeId]
      );

      console.log('📋 VÉRIFICATION FINALE:');
      console.log(`  Mots à deviner en BDD: ${totalKeywords.count}`);
      console.log(`  Questions quiz en BDD: ${totalQuiz.count}\n`);

      process.exit(0);
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

populateBlancheNeigeContent();
