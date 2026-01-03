require('dotenv').config();
const db = require('../utils/database-pg');

const THREAD_IDS = [
  '1438657149353066627',
  '1438649867831607316',
  '1438657495894851726'
];

const GUILD_ID = '1248028543389143070';

async function verifyMissionRewards() {
  console.log('🔍 Vérification des récompenses de missions...\n');

  try {
    for (const threadId of THREAD_IDS) {
      console.log('━'.repeat(80));

      // Récupérer la mission progress
      const progress = await db.query(
        `SELECT mp.*, m.name as mission_name, m.reward_type, m.reward_data,
                p.username, p.discord_id, p.id as player_id
         FROM mission_progress mp
         JOIN missions m ON mp.mission_id = m.id
         JOIN players p ON mp.player_id = p.id
         WHERE mp.guild_id = $1 AND mp.thread_id = $2`,
        [GUILD_ID, threadId]
      );

      if (progress.length === 0) {
        console.log(`❌ Mission non trouvée pour thread ${threadId}`);
        continue;
      }

      const mission = progress[0];
      console.log(`🎯 Mission: ${mission.mission_name}`);
      console.log(`   Joueur: ${mission.username} (ID: ${mission.player_id})`);
      console.log(`   Statut: ${mission.status}`);
      console.log(`   Complétée: ${mission.completed_at}`);
      console.log(`   Type de récompense: ${mission.reward_type}`);

      // Parse reward_data
      const rewardData = mission.reward_data ? JSON.parse(mission.reward_data) : null;
      console.log(`   Données récompense: ${JSON.stringify(rewardData)}`);

      // Vérifier si le collectible a été donné
      if (mission.reward_type === 'collectible' && rewardData && rewardData.collectible_id) {
        const collectibleId = rewardData.collectible_id;

        // Récupérer les infos du collectible
        const collectible = await db.query(
          `SELECT * FROM collectibles WHERE guild_id = $1 AND id = $2`,
          [GUILD_ID, collectibleId]
        );

        if (collectible.length === 0) {
          console.log(`   ❌ Collectible ID ${collectibleId} introuvable en DB`);
          continue;
        }

        console.log(`   📦 Collectible attendu: ${collectible[0].name} (${collectible[0].rarity})`);

        // Vérifier si le joueur possède ce collectible
        const collection = await db.query(
          `SELECT * FROM collections
           WHERE guild_id = $1 AND player_id = $2 AND collectible_id = $3 AND lost_at IS NULL
           ORDER BY collected_at DESC
           LIMIT 1`,
          [GUILD_ID, mission.player_id, collectibleId]
        );

        if (collection.length > 0) {
          console.log(`   ✅ COLLECTIBLE REÇU !`);
          console.log(`      Collecté le: ${collection[0].collected_at}`);
          console.log(`      Source: ${collection[0].source}`);
        } else {
          console.log(`   ❌ COLLECTIBLE NON REÇU !`);
          console.log(`   🔧 Le joueur n'a PAS ce collectible dans sa collection`);

          // Vérifier s'il l'a eu puis perdu
          const lostCollection = await db.query(
            `SELECT * FROM collections
             WHERE guild_id = $1 AND player_id = $2 AND collectible_id = $3 AND lost_at IS NOT NULL
             ORDER BY lost_at DESC
             LIMIT 1`,
            [GUILD_ID, mission.player_id, collectibleId]
          );

          if (lostCollection.length > 0) {
            console.log(`   ⚠️  Le collectible a été collecté puis PERDU`);
            console.log(`      Collecté le: ${lostCollection[0].collected_at}`);
            console.log(`      Perdu le: ${lostCollection[0].lost_at}`);
          } else {
            console.log(`   ❌ Le collectible n'a JAMAIS été ajouté à la collection`);
          }
        }
      } else if (mission.reward_type === 'random' || mission.reward_type === 'random-collectible') {
        console.log(`   📦 Récompense aléatoire - Vérification des ajouts récents...`);

        // Vérifier tous les collectibles ajoutés autour de la date de complétion
        const completedAt = new Date(mission.completed_at);
        const before = new Date(completedAt.getTime() - 120000); // 2 min avant
        const after = new Date(completedAt.getTime() + 120000); // 2 min après

        const recentCollections = await db.query(
          `SELECT col.*, c.name, c.rarity
           FROM collections col
           JOIN collectibles c ON col.collectible_id = c.id
           WHERE col.guild_id = $1 AND col.player_id = $2
           AND col.collected_at BETWEEN $3 AND $4
           AND col.source = 'mission'
           ORDER BY col.collected_at DESC`,
          [GUILD_ID, mission.player_id, before, after]
        );

        if (recentCollections.length > 0) {
          console.log(`   ✅ Collectible(s) reçu(s) autour de la complétion:`);
          recentCollections.forEach(col => {
            const isLost = col.lost_at ? ` (PERDU le ${col.lost_at})` : '';
            console.log(`      - ${col.name} (${col.rarity}) le ${col.collected_at}${isLost}`);
          });
        } else {
          console.log(`   ❌ Aucun collectible trouvé autour de la date de complétion`);
          console.log(`   🔧 Période vérifiée: ${before.toLocaleString()} - ${after.toLocaleString()}`);
        }
      } else {
        console.log(`   ⚠️  Type de récompense inconnu: ${mission.reward_type}`);
      }

      console.log('');
    }

    console.log('━'.repeat(80));
    console.log('\n✅ Vérification terminée');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

verifyMissionRewards();
