const db = require('./utils/database-pg');
require('dotenv').config();

async function analyzeSecondPlayer() {
  try {
    const guildId = '1248028543389143070';
    const discordId = '1438267586495119380';

    console.log('🔍 ANALYSE DU JOUEUR\n');
    console.log('═'.repeat(70));

    // 1. Récupérer le joueur
    const player = await db.queryOne(`
      SELECT id, username, discord_id FROM players
      WHERE guild_id = $1 AND discord_id = $2
    `, [guildId, discordId]);

    if (!player) {
      console.log('❌ Joueur introuvable avec cet ID Discord');
      process.exit(1);
    }

    console.log(`\n👤 Joueur: ${player.username}`);
    console.log(`   Discord ID: ${player.discord_id}`);
    console.log(`   Player ID: ${player.id}\n`);

    // 2. Collectibles actuels (actifs)
    const activeCollectibles = await db.queryAll(`
      SELECT col.name, col.rarity, c.collected_at, c.source
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
      ORDER BY c.collected_at DESC
    `, [guildId, player.id]);

    console.log('═'.repeat(70));
    console.log(`\n📦 COLLECTIBLES ACTIFS: ${activeCollectibles.length}\n`);

    if (activeCollectibles.length > 0) {
      activeCollectibles.forEach((c, i) => {
        const emoji = c.rarity === 'legendary' ? '⭐' :
                      c.rarity === 'epic' ? '💎' :
                      c.rarity === 'rare' ? '🔷' : '⚪';
        const date = new Date(c.collected_at).toLocaleString('fr-FR');
        console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity})`);
        console.log(`      Source: ${c.source} | Collecté: ${date}`);
      });
    } else {
      console.log('   ⚠️ Aucun collectible actif');
    }

    // Compter par source
    const sources = {};
    activeCollectibles.forEach(c => {
      sources[c.source] = (sources[c.source] || 0) + 1;
    });
    console.log('\n   📊 Par source:');
    Object.entries(sources).forEach(([source, count]) => {
      console.log(`      - ${source}: ${count}`);
    });

    // 3. Collectibles perdus
    const lostCollectibles = await db.queryAll(`
      SELECT col.name, col.rarity, c.collected_at, c.lost_at, c.source
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NOT NULL
      ORDER BY c.lost_at DESC
    `, [guildId, player.id]);

    console.log('\n═'.repeat(70));
    console.log(`\n❌ COLLECTIBLES PERDUS: ${lostCollectibles.length}\n`);

    if (lostCollectibles.length > 0) {
      lostCollectibles.forEach((c, i) => {
        const emoji = c.rarity === 'legendary' ? '⭐' :
                      c.rarity === 'epic' ? '💎' :
                      c.rarity === 'rare' ? '🔷' : '⚪';
        const collectedDate = new Date(c.collected_at).toLocaleString('fr-FR');
        const lostDate = new Date(c.lost_at).toLocaleString('fr-FR');
        console.log(`   ${i + 1}. ${emoji} ${c.name} (${c.rarity})`);
        console.log(`      Source: ${c.source}`);
        console.log(`      Collecté: ${collectedDate}`);
        console.log(`      Perdu: ${lostDate}`);
      });
    } else {
      console.log('   ✅ Aucun collectible perdu');
    }

    // 4. Historique des missions
    const missions = await db.queryAll(`
      SELECT mp.status, mp.created_at, mp.completed_at,
             m.name as mission_name, m.type
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.guild_id = $1 AND mp.player_id = $2
      ORDER BY mp.created_at DESC
      LIMIT 20
    `, [guildId, player.id]);

    console.log('\n═'.repeat(70));
    console.log(`\n📋 HISTORIQUE DES MISSIONS: ${missions.length}\n`);

    const statusEmoji = {
      'completed': '✅',
      'failed': '❌',
      'in_progress': '🔄',
      'submitted': '📤'
    };

    if (missions.length > 0) {
      missions.forEach((m, i) => {
        const emoji = statusEmoji[m.status] || '❓';
        const createdDate = new Date(m.created_at).toLocaleString('fr-FR');
        console.log(`   ${i + 1}. ${emoji} ${m.mission_name} (${m.type}) - ${m.status.toUpperCase()}`);
        console.log(`      Créée: ${createdDate}`);
        if (m.completed_at) {
          const completedDate = new Date(m.completed_at).toLocaleString('fr-FR');
          console.log(`      Complétée: ${completedDate}`);
        }
      });

      // Compter par statut
      const completed = missions.filter(m => m.status === 'completed').length;
      const failed = missions.filter(m => m.status === 'failed').length;
      const inProgress = missions.filter(m => m.status === 'in_progress').length;

      console.log('\n   📊 Résumé:');
      console.log(`      ✅ Complétées: ${completed}`);
      console.log(`      ❌ Échouées: ${failed}`);
      console.log(`      🔄 En cours: ${inProgress}`);
    } else {
      console.log('   ⚠️ Aucune mission trouvée');
    }

    // 5. Progression actuelle
    const progress = await db.queryOne(`
      SELECT pp.collected_count, t.required_items, t.name as theme_name
      FROM player_progress pp
      JOIN themes t ON pp.theme_id = t.id
      WHERE pp.guild_id = $1 AND pp.player_id = $2
    `, [guildId, player.id]);

    console.log('\n═'.repeat(70));
    console.log('\n📈 PROGRESSION ACTUELLE:\n');

    if (progress) {
      console.log(`   Thème: ${progress.theme_name}`);
      console.log(`   Progression: ${progress.collected_count}/${progress.required_items}`);
      console.log(`   Manquant: ${progress.required_items - progress.collected_count}`);
    } else {
      console.log('   ⚠️ Aucune progression trouvée');
    }

    // 6. ANALYSE DU BUG
    console.log('\n═'.repeat(70));
    console.log('\n🔍 ANALYSE DU BUG:\n');

    const completedMissions = missions.filter(m => m.status === 'completed').length;
    const missionCollectibles = activeCollectibles.filter(c => c.source === 'mission').length;
    const missingSources = completedMissions - missionCollectibles;

    console.log(`   Missions complétées: ${completedMissions}`);
    console.log(`   Collectibles de missions: ${missionCollectibles}`);
    console.log(`   Récompenses manquantes: ${missingSources}`);

    if (lostCollectibles.length > 0) {
      console.log(`   Collectibles perdus (pièges): ${lostCollectibles.length}`);
    }

    console.log('\n═'.repeat(70));
    console.log('\n💡 COMPENSATION RECOMMANDÉE:\n');

    if (lostCollectibles.length > 0) {
      console.log(`   1. Restaurer ${lostCollectibles.length} collectible(s) perdu(s)`);
    }

    if (missingSources > 0) {
      console.log(`   2. Donner ${missingSources} collectible(s) pour missions non récompensées`);
    }

    if (progress && activeCollectibles.length !== progress.collected_count) {
      console.log(`   3. Synchroniser le compteur de progression (${activeCollectibles.length} vs ${progress.collected_count})`);
    }

    console.log('\n═'.repeat(70));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyzeSecondPlayer();
