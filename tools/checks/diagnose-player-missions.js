const db = require('./utils/database-pg');
require('dotenv').config();

async function diagnosePlayerMissions() {
  try {
    const guildId = '1248028543389143070';
    const discordId = '692649463805640724';

    console.log('🔍 Diagnostic des missions du joueur\n');
    console.log(`Discord ID: ${discordId}\n`);

    // 1. Récupérer le joueur
    console.log('1️⃣ Informations du joueur:');
    const player = await db.queryOne(`
      SELECT id, discord_id, username
      FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, discordId]);

    if (!player) {
      console.log('   ❌ Joueur introuvable dans la base de données!');
      process.exit(1);
    }

    console.log(`   ✅ Joueur trouvé: ${player.username} (player_id: ${player.id})\n`);

    // 2. Récupérer toutes les missions en cours
    console.log('2️⃣ Missions en cours (mission_progress):');
    const activeMissions = await db.queryAll(`
      SELECT mp.id, mp.mission_id, mp.status, mp.started_at, mp.expires_at,
             mp.target_channel_id, mp.target_keyword, mp.thread_id,
             m.name as mission_name, m.type, m.validation_type
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1 AND mp.player_id = $2 AND mp.status = 'in_progress'
      ORDER BY mp.started_at DESC
    `, [guildId, player.id]);

    console.log(`   📊 Total: ${activeMissions.length} mission(s) en cours\n`);

    if (activeMissions.length > 0) {
      activeMissions.forEach(m => {
        console.log(`   Mission: ${m.mission_name} (ID: ${m.id})`);
        console.log(`      - Type: ${m.type}`);
        console.log(`      - Validation: ${m.validation_type}`);
        console.log(`      - Status: ${m.status}`);
        console.log(`      - Thread ID: ${m.thread_id || 'N/A'}`);
        console.log(`      - Démarrée: ${m.started_at || 'N/A'}`);
        console.log(`      - Expire: ${m.expires_at || 'N/A'}`);
        if (m.target_keyword) {
          console.log(`      - Mot-clé cible: "${m.target_keyword}"`);
          console.log(`      - Canal cible: ${m.target_channel_id || 'N/A'}`);
        }
        console.log('');
      });
    } else {
      console.log('   ⚠️ Aucune mission en cours pour ce joueur\n');
    }

    // 3. Récupérer les missions récemment terminées (dernières 24h)
    console.log('3️⃣ Missions récentes (dernières 24h):');
    const recentMissions = await db.queryAll(`
      SELECT mp.id, mp.status, mp.completed_at, mp.updated_at,
             m.name as mission_name, m.type
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1 AND mp.player_id = $2
        AND mp.updated_at > NOW() - INTERVAL '24 hours'
      ORDER BY mp.updated_at DESC
      LIMIT 10
    `, [guildId, player.id]);

    console.log(`   📊 Total: ${recentMissions.length} mission(s) récente(s)\n`);

    if (recentMissions.length > 0) {
      recentMissions.forEach(m => {
        const statusIcon = {
          'completed': '✅',
          'failed': '❌',
          'in_progress': '🔄'
        }[m.status] || '❓';

        console.log(`   ${statusIcon} ${m.mission_name} (${m.type})`);
        console.log(`      Status: ${m.status}`);
        console.log(`      Dernière MAJ: ${m.updated_at}`);
        if (m.completed_at) {
          console.log(`      Complétée: ${m.completed_at}`);
        }
        console.log('');
      });
    }

    // 4. Vérifier si les mots-clés sont bien configurés pour "Mot Deviné"
    console.log('4️⃣ Vérification mot-clés disponibles:');
    const keywordMission = await db.queryOne(`
      SELECT id, name FROM missions
      WHERE guild_id = $1 AND type = 'keyword-message'
      LIMIT 1
    `, [guildId]);

    if (keywordMission) {
      const keywords = await db.queryAll(`
        SELECT keyword FROM mission_keywords
        WHERE guild_id = $1 AND mission_id = $2
      `, [guildId, keywordMission.id]);

      console.log(`   Mission: ${keywordMission.name}`);
      console.log(`   📊 ${keywords.length} mot(s)-clé(s) configuré(s)`);
      if (keywords.length > 0) {
        console.log(`   Exemples: ${keywords.slice(0, 5).map(k => `"${k.keyword}"`).join(', ')}...\n`);
      }
    }

    // 5. Vérifier si les questions quiz sont bien configurées
    console.log('5️⃣ Vérification questions quiz disponibles:');
    const quizMission = await db.queryOne(`
      SELECT id, name, theme_id FROM missions
      WHERE guild_id = $1 AND type = 'quiz'
      LIMIT 1
    `, [guildId]);

    if (quizMission) {
      const questions = await db.queryAll(`
        SELECT id, question_text, correct_answer, wrong_answers
        FROM quiz_questions
        WHERE guild_id = $1 AND theme_id = $2
      `, [guildId, quizMission.theme_id]);

      console.log(`   Mission: ${quizMission.name}`);
      console.log(`   📊 ${questions.length} question(s) configurée(s)`);

      // Vérifier si wrong_answers sont bien remplis
      const questionsWithoutWrongAnswers = questions.filter(q => !q.wrong_answers || q.wrong_answers.length === 0);
      if (questionsWithoutWrongAnswers.length > 0) {
        console.log(`   ⚠️ ${questionsWithoutWrongAnswers.length} question(s) sans mauvaises réponses (wrong_answers: null/empty)`);
      }
      console.log('');
    }

    // 6. Tester la fonction getActiveKeywordMissions
    console.log('6️⃣ Test de la fonction getActiveKeywordMissions:');
    console.log('   (Simulation: un joueur dit le mot "pomme")');

    const testWord = 'pomme';
    const testChannelId = '1248028543795015737'; // Canal général par exemple

    const activeKeywordMissions = await db.queryAll(`
      SELECT mp.id, mp.player_id, mp.status, mp.target_keyword, mp.target_channel_id,
             m.name as mission_name, p.discord_id, p.username
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      JOIN players p ON mp.player_id = p.id
      WHERE mp.guild_id = $1
        AND mp.status = 'in_progress'
        AND mp.mission_type = 'keyword-message'
        AND mp.target_keyword = $2
        AND (mp.target_channel_id = $3 OR mp.target_channel_id IS NULL)
    `, [guildId, testWord, testChannelId]);

    console.log(`   📊 ${activeKeywordMissions.length} mission(s) active(s) pour le mot "${testWord}"`);
    if (activeKeywordMissions.length > 0) {
      activeKeywordMissions.forEach(m => {
        console.log(`      - ${m.username}: ${m.mission_name} (status: ${m.status})`);
      });
    }
    console.log('');

    // 7. Résumé du diagnostic
    console.log('📊 DIAGNOSTIC:');

    if (activeMissions.length === 0) {
      console.log('   ⚠️ Le joueur n\'a aucune mission en cours actuellement');
      console.log('   💡 Il doit ouvrir une mystery box pour obtenir une mission');
    } else {
      console.log(`   ✅ ${activeMissions.length} mission(s) en cours détectée(s)`);

      // Vérifier si les missions ont bien été "lancées" (expires_at défini)
      const notStartedMissions = activeMissions.filter(m => !m.expires_at);
      if (notStartedMissions.length > 0) {
        console.log(`   ⚠️ ${notStartedMissions.length} mission(s) pas encore lancée(s) (pas d'expires_at)`);
        console.log('   💡 Le joueur doit cliquer sur le bouton "Lancer la mission" dans le thread');
      }

      // Vérifier si les missions ont un thread_id
      const noThreadMissions = activeMissions.filter(m => !m.thread_id);
      if (noThreadMissions.length > 0) {
        console.log(`   ⚠️ ${noThreadMissions.length} mission(s) sans thread_id`);
        console.log('   💡 Le thread n\'a pas été créé correctement');
      }
    }

    console.log('\n💡 PROCHAINES ÉTAPES:');
    console.log('   1. Si le joueur a des missions en cours, vérifier les logs du bot');
    console.log('   2. Tester en envoyant un message avec le mot-clé dans le bon canal');
    console.log('   3. Tester en répondant à une question de quiz dans le thread');
    console.log('   4. Vérifier les permissions du bot dans les canaux/threads');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

diagnosePlayerMissions();
