const db = require('./utils/database-pg');
require('dotenv').config();

async function diagnoseMissions() {
  try {
    const guildId = '1248028543389143070';
    const themeId = 23;

    console.log('🔍 Diagnostic des missions - Validation\n');

    // 1. Vérifier les missions du thème
    console.log('1️⃣ Missions du thème Blanche-Neige:');
    const missions = await db.queryAll(`
      SELECT id, mission_id, name, type, validation_type, timeout, description
      FROM missions
      WHERE guild_id = $1 AND theme_id = $2
      ORDER BY id
    `, [guildId, themeId]);

    console.log(`   📊 Total missions: ${missions.length}\n`);

    missions.forEach(m => {
      console.log(`   Mission ID ${m.id}: ${m.name}`);
      console.log(`      - Type: ${m.type}`);
      console.log(`      - Validation: ${m.validation_type}`);
      console.log(`      - Timeout: ${m.timeout}s`);
      console.log(`      - Mission ID: ${m.mission_id}`);
      console.log('');
    });

    // 2. Vérifier les mots-clés pour "Mot Deviné"
    console.log('\n2️⃣ Mots-clés pour "Mot Deviné":');
    const motDevineMission = missions.find(m => m.mission_id === 'mot-devine' || m.type === 'keyword-message');

    if (motDevineMission) {
      const keywords = await db.queryAll(`
        SELECT id, keyword
        FROM mission_keywords
        WHERE mission_id = $1
        ORDER BY id
      `, [motDevineMission.id]);

      console.log(`   📊 Total mots-clés: ${keywords.length}`);
      if (keywords.length > 0) {
        keywords.forEach(kw => {
          console.log(`      - "${kw.keyword}"`);
        });
      } else {
        console.log('   ⚠️ AUCUN mot-clé configuré!');
      }
    } else {
      console.log('   ❌ Mission "Mot Deviné" introuvable!');
    }

    // 3. Vérifier les questions pour "Quiz"
    console.log('\n3️⃣ Questions pour "Quiz":');
    const quizMission = missions.find(m => m.mission_id === 'quiz' || m.type === 'quiz');

    if (quizMission) {
      // Les questions sont liées au thème, pas à la mission
      const questions = await db.queryAll(`
        SELECT id, question_text, correct_answer, wrong_answers, difficulty
        FROM quiz_questions
        WHERE guild_id = $1 AND theme_id = $2
        ORDER BY id
      `, [guildId, themeId]);

      console.log(`   📊 Total questions: ${questions.length}`);
      if (questions.length > 0) {
        questions.forEach(q => {
          console.log(`      Q: "${q.question_text}"`);
          console.log(`         Bonne réponse: ${q.correct_answer}`);
          console.log(`         Mauvaises: ${q.wrong_answers}`);
          console.log(`         Difficulté: ${q.difficulty || 'N/A'}`);
        });
      } else {
        console.log('   ⚠️ AUCUNE question configurée!');
      }
    } else {
      console.log('   ❌ Mission "Quiz" introuvable!');
    }

    // 4. Vérifier les missions actives des joueurs
    console.log('\n4️⃣ Missions actives des joueurs:');
    const activeMissions = await db.queryAll(`
      SELECT pm.id, pm.player_id, pm.mission_id, pm.status, pm.started_at,
             m.name, m.type, m.validation_type
      FROM player_missions pm
      JOIN missions m ON pm.mission_id = m.id
      WHERE pm.guild_id = $1 AND pm.status = 'in_progress'
      ORDER BY pm.started_at DESC
      LIMIT 5
    `, [guildId]);

    console.log(`   📊 Missions en cours: ${activeMissions.length}`);
    if (activeMissions.length > 0) {
      activeMissions.forEach(am => {
        console.log(`      Joueur ${am.player_id}: ${am.name} (${am.type})`);
        console.log(`         Status: ${am.status}`);
        console.log(`         Validation: ${am.validation_type}`);
      });
    }

    // 5. Résumé du problème
    console.log('\n📊 DIAGNOSTIC:');

    const motDevineOK = motDevineMission && keywords && keywords.length > 0;
    const quizOK = quizMission && questions && questions.length > 0;

    if (!motDevineOK) {
      console.log('   ❌ PROBLÈME "Mot Deviné": Aucun mot-clé configuré!');
      console.log('      → Les joueurs ne pourront jamais valider cette mission');
      console.log('      → Ajouter des mots-clés via /admin-panel → Missions');
    } else {
      console.log('   ✅ "Mot Deviné" OK avec des mots-clés');
    }

    if (!quizOK) {
      console.log('   ❌ PROBLÈME "Quiz": Aucune question configurée!');
      console.log('      → Les joueurs ne peuvent pas démarrer cette mission');
      console.log('      → Ajouter des questions via /admin-panel → Missions');
    } else {
      console.log('   ✅ "Quiz" OK avec des questions');
    }

    // 6. Vérifier les handlers
    console.log('\n🔍 Vérification des handlers:');
    console.log('   ℹ️ Fichier: events/messageCreate.js');
    console.log('      → Doit détecter les mots-clés dans les messages');
    console.log('   ℹ️ Fichier: handlers/missionHandler.js');
    console.log('      → Doit gérer les validations auto et manuelles');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

diagnoseMissions();
