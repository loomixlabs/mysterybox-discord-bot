require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';
const THREAD_ID = '1438784619234463794';
const DISCORD_ID = '1405861704474169364';

async function checkCharlottegndMissions() {
  console.log('🔍 Vérification des missions de charlottegnd...\n');

  try {
    // Récupérer le joueur
    const player = await db.query(
      `SELECT * FROM players WHERE guild_id = $1 AND discord_id = $2`,
      [GUILD_ID, DISCORD_ID]
    );

    if (player.length === 0) {
      console.log('❌ Joueur non trouvé en base de données');
      return;
    }

    console.log('👤 Joueur:', player[0].username);
    console.log('   ID:', player[0].id);
    console.log('   Discord ID:', player[0].discord_id);
    console.log('');

    console.log('━'.repeat(80));

    // Récupérer TOUTES les missions du joueur
    const allMissions = await db.query(
      `SELECT mp.*, m.name as mission_name, m.type, m.validation_type, m.reward_type, m.reward_data
       FROM mission_progress mp
       JOIN missions m ON mp.mission_id = m.id
       WHERE mp.guild_id = $1 AND mp.player_id = $2
       ORDER BY mp.created_at DESC`,
      [GUILD_ID, player[0].id]
    );

    console.log(`📋 Total missions: ${allMissions.length}\n`);

    allMissions.forEach((mission, index) => {
      console.log(`\n[${index + 1}] Mission: ${mission.mission_name}`);
      console.log(`    Type: ${mission.type}`);
      console.log(`    Statut: ${mission.status}`);
      console.log(`    Thread ID: ${mission.thread_id}`);
      console.log(`    Créée: ${mission.created_at}`);
      console.log(`    Complétée: ${mission.completed_at || 'N/A'}`);
      console.log(`    Validation: ${mission.validation_type}`);
      console.log(`    Récompense: ${mission.reward_type}`);

      if (mission.reward_data) {
        const rewardData = JSON.parse(mission.reward_data);
        console.log(`    Données récompense:`, rewardData);
      }

      // Vérifier si un collectible a été donné
      if (mission.status === 'completed') {
        console.log(`    🎁 Mission complétée - vérification du collectible...`);
      }
    });

    console.log('\n' + '━'.repeat(80));

    // Vérifier la mission actuelle spécifique
    console.log(`\n🎯 Mission actuelle (Thread ${THREAD_ID}):\n`);

    const currentMission = await db.query(
      `SELECT mp.*, m.name as mission_name, m.type, m.validation_type, m.reward_type, m.reward_data
       FROM mission_progress mp
       JOIN missions m ON mp.mission_id = m.id
       WHERE mp.guild_id = $1 AND mp.thread_id = $2`,
      [GUILD_ID, THREAD_ID]
    );

    if (currentMission.length === 0) {
      console.log('❌ Mission actuelle non trouvée en DB');
    } else {
      const mission = currentMission[0];
      console.log(`   Mission: ${mission.mission_name}`);
      console.log(`   Type: ${mission.type}`);
      console.log(`   Statut: ${mission.status}`);
      console.log(`   Validation: ${mission.validation_type}`);
      console.log(`   Créée: ${mission.created_at}`);
      console.log(`   Complétée: ${mission.completed_at || 'EN COURS'}`);

      if (mission.validation_data) {
        const validationData = JSON.parse(mission.validation_data);
        console.log(`   Données validation:`, validationData);
      }
    }

    console.log('\n' + '━'.repeat(80));

    // Vérifier les collectibles récents
    console.log('\n🎁 Collectibles récents de charlottegnd:\n');

    const recentCollectibles = await db.query(
      `SELECT col.*, c.name, c.rarity
       FROM collections col
       JOIN collectibles c ON col.collectible_id = c.id
       WHERE col.guild_id = $1 AND col.player_id = $2
       AND col.collected_at > NOW() - INTERVAL '24 hours'
       ORDER BY col.collected_at DESC`,
      [GUILD_ID, player[0].id]
    );

    if (recentCollectibles.length === 0) {
      console.log('   Aucun collectible collecté dans les dernières 24h');
    } else {
      recentCollectibles.forEach((col, i) => {
        console.log(`   [${i + 1}] ${col.name} (${col.rarity})`);
        console.log(`       Collecté: ${col.collected_at}`);
        console.log(`       Source: ${col.source}`);
        console.log(`       Perdu: ${col.lost_at || 'Non'}`);
      });
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

checkCharlottegndMissions();
