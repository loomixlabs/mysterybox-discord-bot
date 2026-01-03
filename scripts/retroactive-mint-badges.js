/**
 * Script rétroactif pour les badges MINT (V3 avec progressions)
 * Attribue les badges aux joueurs selon leurs mint #1, top 10, et #100
 */

require('dotenv').config();
const db = require('../utils/database-pg');

const MINT_BADGES = {
  first: [
    { code: 'MINT_FIRST', threshold: 1 },
    { code: 'MINT_FIRST_5', threshold: 5 },
    { code: 'MINT_FIRST_10', threshold: 10 }
  ],
  top_10: [
    { code: 'MINT_TOP_10', threshold: 1 },
    { code: 'MINT_TOP_10_5', threshold: 5 },
    { code: 'MINT_TOP_10_10', threshold: 10 },
    { code: 'MINT_TOP_10_25', threshold: 25 }
  ],
  mint_100: [
    { code: 'MINT_100', threshold: 1 },
    { code: 'MINT_100_5', threshold: 5 },
    { code: 'MINT_100_10', threshold: 10 }
  ]
};

async function awardBadgeIfNotExists(guildId, playerId, badgeCode) {
  try {
    const badge = await db.queryOne('SELECT id FROM badges WHERE code = $1', [badgeCode]);
    if (!badge) return 'not_found';

    const existing = await db.queryOne(`
      SELECT id FROM player_badges
      WHERE guild_id = $1 AND player_id = $2 AND badge_id = $3
    `, [guildId, playerId, badge.id]);

    if (existing) return 'skipped';

    await db.query(`
      INSERT INTO player_badges (guild_id, player_id, badge_id, unlocked_at, unlocked_from)
      VALUES ($1, $2, $3, NOW(), 'retroactive_mint')
    `, [guildId, playerId, badge.id]);

    return 'awarded';
  } catch (error) {
    console.error(`   ❌ Erreur badge ${badgeCode}:`, error.message);
    return 'error';
  }
}

async function runRetroactive() {
  console.log('🏆 Attribution rétroactive des badges MINT (V3)...\n');
  console.log('='.repeat(70));

  let totalAwarded = 0;
  let totalSkipped = 0;
  let errors = 0;

  try {
    // Récupérer tous les joueurs avec leurs stats de mint
    console.log('\n📊 Recherche des joueurs avec mint spéciaux...');

    const players = await db.queryAll(`
      SELECT
        c.guild_id,
        c.player_id,
        SUM(CASE WHEN c.mint_number = 1 THEN 1 ELSE 0 END) as mint_first_count,
        SUM(CASE WHEN c.mint_number <= 10 THEN 1 ELSE 0 END) as mint_top10_count,
        SUM(CASE WHEN c.mint_number = 100 THEN 1 ELSE 0 END) as mint_100_count
      FROM collections c
      WHERE c.mint_number IS NOT NULL AND c.lost_at IS NULL
      GROUP BY c.guild_id, c.player_id
      HAVING SUM(CASE WHEN c.mint_number = 1 THEN 1 ELSE 0 END) > 0
         OR SUM(CASE WHEN c.mint_number <= 10 THEN 1 ELSE 0 END) > 0
         OR SUM(CASE WHEN c.mint_number = 100 THEN 1 ELSE 0 END) > 0
    `);

    console.log(`   ✅ ${players.length} joueurs trouvés avec des mint spéciaux\n`);

    for (const player of players) {
      const mintFirst = parseInt(player.mint_first_count) || 0;
      const mintTop10 = parseInt(player.mint_top10_count) || 0;
      const mint100 = parseInt(player.mint_100_count) || 0;

      let playerBadges = 0;

      // Badges MINT_FIRST (mint #1)
      if (mintFirst > 0) {
        for (const badgeInfo of MINT_BADGES.first) {
          if (mintFirst >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ Player ${player.player_id}: ${badgeInfo.code} (${mintFirst}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            } else if (result === 'error') {
              errors++;
            }
          }
        }
      }

      // Badges MINT_TOP_10 (mint 1-10)
      if (mintTop10 > 0) {
        for (const badgeInfo of MINT_BADGES.top_10) {
          if (mintTop10 >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ Player ${player.player_id}: ${badgeInfo.code} (${mintTop10}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            } else if (result === 'error') {
              errors++;
            }
          }
        }
      }

      // Badges MINT_100 (mint #100)
      if (mint100 > 0) {
        for (const badgeInfo of MINT_BADGES.mint_100) {
          if (mint100 >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ Player ${player.player_id}: ${badgeInfo.code} (${mint100}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            } else if (result === 'error') {
              errors++;
            }
          }
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSUMÉ:');
    console.log(`   🏆 Badges MINT attribués: ${totalAwarded}`);
    console.log(`   ⏭️  Déjà existants: ${totalSkipped}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log('='.repeat(70));

    // Vérification finale
    const mintBadgesCount = await db.queryOne(`
      SELECT COUNT(*) as count FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      WHERE b.category = 'mint'
    `);
    console.log(`\n🏆 Total badges MINT en DB: ${mintBadgesCount.count}`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

runRetroactive()
  .then(() => {
    console.log('\n✅ Script terminé !');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
