require('dotenv').config();
const db = require('../utils/database-pg');

const THREAD_IDS = [
  '1438657149353066627',
  '1438649867831607316',
  '1438657495894851726'
];

const GUILD_ID = '1248028543389143070';

async function checkStuckMissions() {
  console.log('🔍 Vérification des missions bloquées...\n');

  try {
    for (const threadId of THREAD_IDS) {
      console.log('━'.repeat(80));
      console.log(`🧵 Thread ID: ${threadId}`);
      console.log('━'.repeat(80));

      // Chercher la mission progress associée
      const progress = await db.query(
        `SELECT mp.*, m.name as mission_name, m.type, m.validation_type, m.timeout,
                p.username, p.discord_id
         FROM mission_progress mp
         JOIN missions m ON mp.mission_id = m.id
         JOIN players p ON mp.player_id = p.id
         WHERE mp.guild_id = $1 AND mp.thread_id = $2`,
        [GUILD_ID, threadId]
      );

      if (progress.length === 0) {
        console.log('❌ Aucune mission trouvée pour ce thread');
        console.log('   Causes possibles:');
        console.log('   - Thread créé manuellement');
        console.log('   - Mission déjà complétée/expirée et supprimée');
        console.log('   - Erreur lors de la création de la mission\n');
        continue;
      }

      const mission = progress[0];
      console.log(`✅ Mission trouvée: ${mission.mission_name}`);
      console.log(`   Type: ${mission.type}`);
      console.log(`   Validation: ${mission.validation_type}`);
      console.log(`   Joueur: ${mission.username} (${mission.discord_id})`);
      console.log(`   Statut: ${mission.status}`);
      console.log(`   Créée: ${mission.created_at}`);
      console.log(`   Expire: ${mission.expires_at}`);
      console.log(`   Complétée: ${mission.completed_at || 'N/A'}`);

      // Vérifier si expirée
      const now = new Date();
      const expiresAt = new Date(mission.expires_at);
      const isExpired = expiresAt < now;

      console.log('\n📊 Analyse:');

      if (mission.status === 'completed') {
        console.log('   ✅ Mission déjà complétée');
      } else if (mission.status === 'failed') {
        console.log('   ❌ Mission échouée');
      } else if (isExpired) {
        console.log(`   ⏰ Mission EXPIRÉE (depuis ${Math.round((now - expiresAt) / 1000 / 60)} minutes)`);
        console.log('   🔧 ACTION: Devrait être marquée comme "failed"');
      } else {
        const remainingMinutes = Math.round((expiresAt - now) / 1000 / 60);
        console.log(`   ⏳ Mission en cours (expire dans ${remainingMinutes} minutes)`);
      }

      // Récupérer les détails selon le type
      if (mission.type === 'keyword-message') {
        console.log('\n🔑 Détails mission mot-clé:');
        console.log(`   Mot-clé assigné: ${mission.target_keyword}`);
        console.log(`   Canal cible: ${mission.target_channel_id}`);
        console.log(`   Difficulté: ${mission.difficulty || 'N/A'}`);
      } else if (mission.type === 'quiz') {
        console.log('\n📝 Détails mission quiz:');
        const quizData = mission.quiz_data ? JSON.parse(mission.quiz_data) : null;
        if (quizData) {
          console.log(`   Question: ${quizData.question}`);
          console.log(`   Réponse correcte: ${quizData.correct}`);
        }
      }

      console.log('');
    }

    console.log('━'.repeat(80));
    console.log('\n🔧 Voulez-vous corriger les missions expirées ? (oui/non)');
    console.log('   Cela marquera les missions expirées comme "failed"');
    console.log('   et archivera les threads associés.');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

checkStuckMissions();
