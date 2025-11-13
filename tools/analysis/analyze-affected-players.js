const db = require('./utils/database-pg');
require('dotenv').config();

async function analyzeAffectedPlayers() {
  try {
    const guildId = '1248028543389143070';

    const affectedPlayers = [
      { discord_id: '1202557237382479912', username: 'amelie0335' },
      { discord_id: '1176956283518201917', username: 'sophiedg0739' },
      { discord_id: '297307186307006464', username: 'xmicordix' }
    ];

    console.log('🔍 ANALYSE DES JOUEURS AFFECTÉS PAR LE BUG\n');
    console.log('═'.repeat(80));

    for (const playerInfo of affectedPlayers) {
      console.log(`\n\n👤 JOUEUR: ${playerInfo.username.toUpperCase()}`);
      console.log('═'.repeat(80));

      const player = await db.queryOne(`
        SELECT id, username, discord_id FROM players
        WHERE guild_id = $1 AND discord_id = $2
      `, [guildId, playerInfo.discord_id]);

      console.log(`   Discord ID: ${player.discord_id}`);
      console.log(`   Player ID: ${player.id}\n`);

      // Collectibles actifs
      const activeCollectibles = await db.queryAll(`
        SELECT col.name, col.rarity, c.collected_at, c.source, c.id
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
        ORDER BY c.collected_at DESC
      `, [guildId, player.id]);

      console.log(`📦 COLLECTIBLES ACTIFS: ${activeCollectibles.length}`);
      if (activeCollectibles.length > 0) {
        activeCollectibles.forEach((c, i) => {
          const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
          console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity}) - source: ${c.source}`);
        });
      }

      const missionCollectibles = activeCollectibles.filter(c => c.source === 'mission').length;
      console.log(`   → Dont ${missionCollectibles} de missions\n`);

      // Collectibles perdus
      const lostCollectibles = await db.queryAll(`
        SELECT col.name, col.rarity, c.collected_at, c.lost_at, c.source, c.id
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NOT NULL
        ORDER BY c.lost_at DESC
      `, [guildId, player.id]);

      console.log(`❌ COLLECTIBLES PERDUS: ${lostCollectibles.length}`);
      if (lostCollectibles.length > 0) {
        lostCollectibles.forEach((c, i) => {
          const emoji = c.rarity === 'legendary' ? '⭐' : c.rarity === 'epic' ? '💎' : c.rarity === 'rare' ? '🔷' : '⚪';
          const lostDate = new Date(c.lost_at).toLocaleString('fr-FR');
          console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity}) - source: ${c.source} (perdu: ${lostDate})`);
        });
      }
      console.log();

      // Missions
      const missions = await db.queryAll(`
        SELECT mp.status, mp.created_at, mp.completed_at, m.name as mission_name, m.type
        FROM mission_progress mp
        JOIN missions m ON mp.mission_id = m.id
        WHERE mp.guild_id = $1 AND mp.player_id = $2
        ORDER BY mp.created_at DESC
        LIMIT 10
      `, [guildId, player.id]);

      const completedMissions = missions.filter(m => m.status === 'completed').length;
      console.log(`✅ MISSIONS COMPLÉTÉES: ${completedMissions}`);
      missions.filter(m => m.status === 'completed').forEach((m, i) => {
        const date = new Date(m.completed_at).toLocaleString('fr-FR');
        console.log(`   ${i + 1}. ${m.mission_name} (${m.type}) - ${date}`);
      });
      console.log();

      // Progression
      const progress = await db.queryOne(`
        SELECT pp.collected_count, t.required_items, t.name as theme_name
        FROM player_progress pp
        JOIN themes t ON pp.theme_id = t.id
        WHERE pp.guild_id = $1 AND pp.player_id = $2
      `, [guildId, player.id]);

      if (progress) {
        console.log(`📈 PROGRESSION: ${progress.collected_count}/${progress.required_items} (${progress.theme_name})\n`);
      }

      // Analyse
      const totalActive = activeCollectibles.length;
      const totalLost = lostCollectibles.length;
      const totalCompleted = completedMissions;
      const missingRewards = totalCompleted - missionCollectibles;

      console.log('🔍 ANALYSE:');
      console.log(`   Missions complétées: ${totalCompleted}`);
      console.log(`   Collectibles de missions: ${missionCollectibles}`);
      console.log(`   Collectibles perdus: ${totalLost}`);
      console.log(`   Récompenses manquantes: ${missingRewards}\n`);

      console.log('💡 COMPENSATION RECOMMANDÉE:');
      if (totalLost > 0) {
        console.log(`   1️⃣ Restaurer ${totalLost} collectible(s) perdu(s)`);
      }
      if (missingRewards > 0) {
        console.log(`   2️⃣ Donner ${missingRewards} collectible(s) pour missions non récompensées`);
      }
      if (progress && totalActive !== progress.collected_count) {
        console.log(`   3️⃣ Synchroniser compteur: ${totalActive} vs ${progress.collected_count}`);
      }

      console.log('\n' + '─'.repeat(80));
    }

    console.log('\n\n═'.repeat(80));
    console.log('📊 RÉSUMÉ GLOBAL\n');
    console.log('Total joueurs affectés: 3');
    console.log('✅ Tous les joueurs ont été analysés\n');
    console.log('💡 Prochaine étape: Exécuter la compensation automatique pour chaque joueur');
    console.log('═'.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyzeAffectedPlayers();
