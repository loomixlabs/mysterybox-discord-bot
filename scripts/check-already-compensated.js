require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function checkAlreadyCompensated() {
  console.log('🔍 VÉRIFICATION DES COMPENSATIONS DÉJÀ EFFECTUÉES\n');
  console.log('━'.repeat(80));

  try {
    // 1. Liste des missions complétées sans collectibles (dans les 2 minutes)
    console.log('📊 ÉTAPE 1: Missions complétées sans collectibles\n');

    const missionsWithoutReward = await db.query(`
      SELECT
        mp.id as mission_id,
        mp.player_id,
        p.username,
        p.discord_id,
        m.name as mission_name,
        m.theme_id,
        mp.target_keyword,
        mp.completed_at,
        mp.thread_id
      FROM mission_progress mp
      JOIN players p ON mp.player_id = p.id
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1
        AND mp.status = 'completed'
        AND mp.completed_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM collections c
          WHERE c.guild_id = mp.guild_id
            AND c.player_id = mp.player_id
            AND c.source = 'mission'
            AND c.collected_at BETWEEN mp.completed_at - INTERVAL '2 minutes'
                                   AND mp.completed_at + INTERVAL '2 minutes'
        )
      ORDER BY mp.completed_at DESC
    `, [GUILD_ID]);

    console.log(`Total: ${missionsWithoutReward.length} missions sans collectible\n`);

    // 2. Pour chaque mission, vérifier si une compensation manuelle a été faite
    console.log('━'.repeat(80));
    console.log('📊 ÉTAPE 2: Vérification des compensations manuelles\n');

    const results = [];

    for (const mission of missionsWithoutReward) {
      console.log(`Mission ${mission.mission_id} - ${mission.username}`);
      console.log(`   Complétée: ${mission.completed_at.toLocaleString()}`);
      console.log(`   Mot-clé: ${mission.target_keyword || 'N/A'}`);

      // Chercher des collectibles donnés après la complétion (possiblement une compensation)
      const laterCollectibles = await db.query(`
        SELECT c.*, col.name, col.rarity
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1
          AND c.player_id = $2
          AND c.collected_at > $3
          AND c.source = 'give'
        ORDER BY c.collected_at
        LIMIT 3
      `, [GUILD_ID, mission.player_id, mission.completed_at]);

      if (laterCollectibles.length > 0) {
        console.log(`   ⚠️  Collectibles reçus APRÈS (source: give):`);
        laterCollectibles.forEach(c => {
          const delay = Math.round((new Date(c.collected_at) - new Date(mission.completed_at)) / 1000 / 60);
          console.log(`      - ${c.name} (${c.rarity}) - ${delay} min après`);
        });

        // Si un collectible a été donné dans les 24h suivantes avec source='give',
        // c'est probablement une compensation
        const recentCompensation = laterCollectibles.find(c => {
          const delay = new Date(c.collected_at) - new Date(mission.completed_at);
          return delay < 24 * 60 * 60 * 1000; // moins de 24h
        });

        results.push({
          mission,
          compensated: !!recentCompensation,
          compensation: recentCompensation
        });
      } else {
        console.log(`   ❌ AUCUN collectible reçu après`);
        results.push({
          mission,
          compensated: false,
          compensation: null
        });
      }

      console.log('');
    }

    console.log('━'.repeat(80));
    console.log('📊 ÉTAPE 3: Résumé\n');

    const alreadyCompensated = results.filter(r => r.compensated);
    const needsCompensation = results.filter(r => !r.compensated);

    console.log(`✅ Déjà compensées: ${alreadyCompensated.length} missions`);
    if (alreadyCompensated.length > 0) {
      alreadyCompensated.forEach(r => {
        console.log(`   - Mission ${r.mission.mission_id}: ${r.mission.username} → ${r.compensation.name}`);
      });
    }

    console.log(`\n❌ BESOIN de compensation: ${needsCompensation.length} missions\n`);
    if (needsCompensation.length > 0) {
      needsCompensation.forEach(r => {
        console.log(`   - Mission ${r.mission.mission_id}: ${r.mission.username} (${r.mission.discord_id})`);
        console.log(`     Mot-clé: "${r.mission.target_keyword}", Complétée: ${r.mission.completed_at.toLocaleString()}`);
      });
    }

    console.log('\n' + '━'.repeat(80));
    console.log('📊 ÉTAPE 4: Joueurs uniques à compenser\n');

    // Grouper par joueur
    const playerMap = {};
    needsCompensation.forEach(r => {
      const key = r.mission.discord_id;
      if (!playerMap[key]) {
        playerMap[key] = {
          username: r.mission.username,
          discord_id: r.mission.discord_id,
          player_id: r.mission.player_id,
          missions: []
        };
      }
      playerMap[key].missions.push(r.mission);
    });

    const uniquePlayers = Object.values(playerMap);

    console.log(`Total joueurs à compenser: ${uniquePlayers.length}\n`);

    uniquePlayers.forEach((player, i) => {
      console.log(`[${i + 1}] ${player.username} (Discord: ${player.discord_id})`);
      console.log(`    ${player.missions.length} mission(s) non récompensée(s):`);
      player.missions.forEach(m => {
        console.log(`       - Mission ${m.mission_id}: "${m.target_keyword}" (${m.completed_at.toLocaleString()})`);
      });
      console.log('');
    });

    console.log('━'.repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

checkAlreadyCompensated();
