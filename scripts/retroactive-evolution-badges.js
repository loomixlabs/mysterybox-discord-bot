/**
 * Script pour attribuer rétroactivement les badges d'évolution
 * aux joueurs qui ont déjà des collectibles niveau 2+
 *
 * Usage: node scripts/retroactive-evolution-badges.js
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function retroactiveEvolutionBadges() {
  console.log('🏆 Attribution rétroactive des badges d\'évolution...\n');
  console.log('='.repeat(70));

  try {
    // 1. Trouver tous les joueurs avec des collectibles niveau 2+
    const playersWithEvolved = await db.queryAll(`
      SELECT DISTINCT c.guild_id, c.player_id, MAX(c.level) as max_level, p.username
      FROM collections c
      JOIN players p ON c.player_id = p.id AND c.guild_id = p.guild_id
      WHERE c.level >= 2 AND c.lost_at IS NULL
      GROUP BY c.guild_id, c.player_id, p.username
      ORDER BY max_level DESC
    `);

    console.log(`\n📊 Joueurs avec collectibles évolués: ${playersWithEvolved.length}`);

    // Mapping des badges d'évolution
    const evolutionBadges = [
      { code: 'EVOLUTION_LEVEL_2', level: 2 },
      { code: 'EVOLUTION_LEVEL_3', level: 3 },
      { code: 'EVOLUTION_LEVEL_4', level: 4 }
    ];

    let badgesAwarded = 0;
    let badgesSkipped = 0;

    for (const player of playersWithEvolved) {
      console.log(`\n👤 ${player.username} (guild: ${player.guild_id}) - Max niveau: ${player.max_level}`);

      for (const badgeInfo of evolutionBadges) {
        if (player.max_level >= badgeInfo.level) {
          // Récupérer le badge
          const badge = await db.getBadgeByCode(badgeInfo.code);
          if (!badge) {
            console.log(`   ⚠️  Badge ${badgeInfo.code} introuvable`);
            continue;
          }

          // Vérifier si déjà attribué
          const alreadyHas = await db.playerHasBadge(player.guild_id, player.player_id, badge.id);
          if (alreadyHas) {
            console.log(`   ⏭️  ${badgeInfo.code} déjà attribué`);
            badgesSkipped++;
            continue;
          }

          // Attribuer le badge
          await db.query(`
            INSERT INTO player_badges (guild_id, player_id, badge_id, unlocked_at, unlocked_from)
            VALUES ($1, $2, $3, NOW(), 'retroactive_script')
            ON CONFLICT (guild_id, player_id, badge_id) DO NOTHING
          `, [player.guild_id, player.player_id, badge.id]);

          console.log(`   ✅ ${badgeInfo.code} attribué !`);
          badgesAwarded++;
        }
      }

      // Vérifier pour EVOLUTION_MASTER (10 collectibles niveau 4)
      const level4Count = await db.queryOne(`
        SELECT COUNT(*) as count FROM collections
        WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL AND level = 4
      `, [player.guild_id, player.player_id]);

      const count = level4Count ? parseInt(level4Count.count) : 0;
      if (count >= 10) {
        const masterBadge = await db.getBadgeByCode('EVOLUTION_MASTER');
        if (masterBadge) {
          const alreadyHas = await db.playerHasBadge(player.guild_id, player.player_id, masterBadge.id);
          if (!alreadyHas) {
            await db.query(`
              INSERT INTO player_badges (guild_id, player_id, badge_id, unlocked_at, unlocked_from)
              VALUES ($1, $2, $3, NOW(), 'retroactive_script')
              ON CONFLICT (guild_id, player_id, badge_id) DO NOTHING
            `, [player.guild_id, player.player_id, masterBadge.id]);
            console.log(`   ✅ EVOLUTION_MASTER attribué ! (${count} collectibles niveau 4)`);
            badgesAwarded++;
          }
        }
      } else {
        // Mettre à jour la progression vers EVOLUTION_MASTER
        const masterBadge = await db.getBadgeByCode('EVOLUTION_MASTER');
        if (masterBadge && count > 0) {
          await db.updateBadgeProgress(player.guild_id, player.player_id, masterBadge.id, count, 10);
          console.log(`   📊 EVOLUTION_MASTER progression: ${count}/10`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSUMÉ:');
    console.log(`   ✅ Badges attribués: ${badgesAwarded}`);
    console.log(`   ⏭️  Badges déjà existants: ${badgesSkipped}`);
    console.log(`   👥 Joueurs traités: ${playersWithEvolved.length}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  }
}

retroactiveEvolutionBadges()
  .then(() => {
    console.log('\n✅ Script terminé !');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
