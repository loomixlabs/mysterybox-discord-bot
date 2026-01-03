/**
 * Script pour attribuer rétroactivement TOUS les badges V2
 * basé sur les données existantes en base
 *
 * Usage: node scripts/retroactive-all-badges.js
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function retroactiveAllBadges() {
  console.log('🏆 Attribution rétroactive de TOUS les badges V2...\n');
  console.log('='.repeat(80));

  let totalAwarded = 0;
  let totalSkipped = 0;

  try {
    // Récupérer tous les joueurs actifs
    const allPlayers = await db.queryAll(`
      SELECT DISTINCT guild_id, id as player_id, username, discord_id
      FROM players
      ORDER BY guild_id, id
    `);

    console.log(`\n📊 Joueurs à traiter: ${allPlayers.length}\n`);

    for (const player of allPlayers) {
      console.log(`\n👤 ${player.username} (guild: ${player.guild_id})`);
      let playerBadges = 0;

      // =================================================================
      // 1. BADGES ÉVOLUTION
      // =================================================================
      const maxLevel = await db.queryOne(`
        SELECT MAX(level) as max_level FROM collections
        WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL
      `, [player.guild_id, player.player_id]);

      if (maxLevel && maxLevel.max_level >= 2) {
        const evolutionBadges = [
          { code: 'EVOLUTION_LEVEL_2', level: 2 },
          { code: 'EVOLUTION_LEVEL_3', level: 3 },
          { code: 'EVOLUTION_LEVEL_4', level: 4 }
        ];

        for (const badgeInfo of evolutionBadges) {
          if (maxLevel.max_level >= badgeInfo.level) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code}`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }
      }

      // =================================================================
      // 2. BADGES ÉCONOMIE (depuis player_currency)
      // =================================================================
      const currency = await db.queryOne(`
        SELECT balance, total_earned, total_spent
        FROM player_currency
        WHERE guild_id = $1 AND player_id = $2 AND currency_type = 'loomix'
      `, [player.guild_id, player.player_id]);

      if (currency) {
        const economyBadges = [
          { code: 'ECONOMY_SPENDER', field: 'total_spent', threshold: 1000 },
          { code: 'ECONOMY_MILLIONAIRE', field: 'total_earned', threshold: 10000 },
          { code: 'ECONOMY_BILLIONAIRE', field: 'total_earned', threshold: 100000 },
          { code: 'ECONOMY_SAVER', field: 'balance', threshold: 5000 }
        ];

        for (const badgeInfo of economyBadges) {
          const value = currency[badgeInfo.field] || 0;
          if (value >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${value}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          } else if (value > 0) {
            // Mettre à jour la progression
            await updateBadgeProgressIfExists(player.guild_id, player.player_id, badgeInfo.code, value, badgeInfo.threshold);
          }
        }
      }

      // =================================================================
      // 3. BADGES RARETÉ (legendary_count, epic_count, rare_count)
      // =================================================================
      const rarityCounts = await db.queryOne(`
        SELECT
          SUM(CASE WHEN col.rarity = 'legendary' THEN 1 ELSE 0 END) as legendary_count,
          SUM(CASE WHEN col.rarity = 'epic' THEN 1 ELSE 0 END) as epic_count,
          SUM(CASE WHEN col.rarity = 'rare' THEN 1 ELSE 0 END) as rare_count
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
      `, [player.guild_id, player.player_id]);

      if (rarityCounts) {
        const rarityBadges = [
          { code: 'RARITY_LEGENDARY_HUNTER', field: 'legendary_count', threshold: 10 },
          { code: 'RARITY_LEGENDARY_MASTER', field: 'legendary_count', threshold: 50 },
          { code: 'RARITY_EPIC_MASTER', field: 'epic_count', threshold: 25 },
          { code: 'RARITY_RARE_BARON', field: 'rare_count', threshold: 50 }
        ];

        for (const badgeInfo of rarityBadges) {
          const value = parseInt(rarityCounts[badgeInfo.field]) || 0;
          if (value >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${value}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          } else if (value > 0) {
            await updateBadgeProgressIfExists(player.guild_id, player.player_id, badgeInfo.code, value, badgeInfo.threshold);
          }
        }
      }

      // =================================================================
      // 4. BADGES MYSTERY BOX PAR RARETÉ
      // =================================================================
      const boxCounts = await db.queryOne(`
        SELECT
          SUM(CASE WHEN gl.mystery_box_rarity = 'epic' THEN 1 ELSE 0 END) as epic_boxes,
          SUM(CASE WHEN gl.mystery_box_rarity = 'legendary' THEN 1 ELSE 0 END) as legendary_boxes,
          COUNT(DISTINCT gl.mystery_box_rarity) as rarity_count
        FROM give_logs gl
        WHERE gl.guild_id = $1 AND gl.winner_id = $2
        AND gl.mystery_box_rarity IN ('common', 'rare', 'epic', 'legendary')
      `, [player.guild_id, player.discord_id]);

      if (boxCounts) {
        const boxBadges = [
          { code: 'BOX_EPIC_COLLECTOR', field: 'epic_boxes', threshold: 10 },
          { code: 'BOX_LEGENDARY_COLLECTOR', field: 'legendary_boxes', threshold: 5 }
        ];

        for (const badgeInfo of boxBadges) {
          const value = parseInt(boxCounts[badgeInfo.field]) || 0;
          if (value >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${value}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          } else if (value > 0) {
            await updateBadgeProgressIfExists(player.guild_id, player.player_id, badgeInfo.code, value, badgeInfo.threshold);
          }
        }

        // Badge "toutes les raretés"
        const rarityCount = parseInt(boxCounts.rarity_count) || 0;
        if (rarityCount >= 4) {
          const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, 'BOX_FULL_SET');
          if (result === 'awarded') {
            console.log(`   ✅ BOX_FULL_SET (${rarityCount}/4 raretés)`);
            playerBadges++;
            totalAwarded++;
          }
        }
      }

      // =================================================================
      // 5. BADGES PIÈGES DÉCLENCHÉS
      // =================================================================
      const trapCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM trap_triggered
        WHERE guild_id = $1 AND player_id = $2
      `, [player.guild_id, player.player_id]);

      if (trapCount && parseInt(trapCount.count) > 0) {
        const count = parseInt(trapCount.count);
        const trapBadges = [
          { code: 'TRAP_TRIGGERED_10', threshold: 10 },
          { code: 'TRAP_TRIGGERED_50', threshold: 50 }
        ];

        for (const badgeInfo of trapBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            }
          } else {
            await updateBadgeProgressIfExists(player.guild_id, player.player_id, badgeInfo.code, count, badgeInfo.threshold);
          }
        }
      }

      // =================================================================
      // 6. BADGES ANCIENNETÉ
      // =================================================================
      const playerInfo = await db.queryOne(`
        SELECT created_at, EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 as days_active
        FROM players
        WHERE guild_id = $1 AND id = $2
      `, [player.guild_id, player.player_id]);

      if (playerInfo && playerInfo.days_active) {
        const days = Math.floor(parseFloat(playerInfo.days_active));
        const seniorityBadges = [
          { code: 'SENIORITY_WEEK', threshold: 7 },
          { code: 'SENIORITY_MONTH', threshold: 30 },
          { code: 'SENIORITY_6MONTHS', threshold: 180 },
          { code: 'SENIORITY_YEAR', threshold: 365 }
        ];

        for (const badgeInfo of seniorityBadges) {
          if (days >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${days}/${badgeInfo.threshold} jours)`);
              playerBadges++;
              totalAwarded++;
            }
          }
        }
      }

      // =================================================================
      // 7. BADGES COLLECTION (nombre total de collectibles)
      // =================================================================
      const collectibleCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM collections
        WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL
      `, [player.guild_id, player.player_id]);

      if (collectibleCount && parseInt(collectibleCount.count) > 0) {
        const count = parseInt(collectibleCount.count);
        const collectionBadges = [
          { code: 'COLLECTION_DEBUTANT', threshold: 1 },
          { code: 'COLLECTION_COLLECTIONNEUR', threshold: 10 },
          { code: 'COLLECTION_CHASSEUR', threshold: 25 },
          { code: 'COLLECTION_EXPERT', threshold: 50 },
          { code: 'COLLECTION_MAITRE', threshold: 100 },
          { code: 'COLLECTION_LEGENDE', threshold: 200 }
        ];

        for (const badgeInfo of collectionBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            }
          } else if (count > 0) {
            await updateBadgeProgressIfExists(player.guild_id, player.player_id, badgeInfo.code, count, badgeInfo.threshold);
          }
        }
      }

      // =================================================================
      // 8. BADGES MISSIONS
      // =================================================================
      const missionCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM mission_progress
        WHERE guild_id = $1 AND player_id = $2 AND status = 'completed'
      `, [player.guild_id, player.player_id]);

      if (missionCount && parseInt(missionCount.count) > 0) {
        const count = parseInt(missionCount.count);
        const missionBadges = [
          { code: 'MISSION_NOVICE', threshold: 1 },
          { code: 'MISSION_AVENTURIER', threshold: 10 },
          { code: 'MISSION_CHAMPION', threshold: 50 },
          { code: 'MISSION_LEGENDE', threshold: 100 }
        ];

        for (const badgeInfo of missionBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            }
          } else if (count > 0) {
            await updateBadgeProgressIfExists(player.guild_id, player.player_id, badgeInfo.code, count, badgeInfo.threshold);
          }
        }
      }

      if (playerBadges > 0) {
        console.log(`   📊 Total pour ce joueur: ${playerBadges} badges`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ GLOBAL:');
    console.log(`   ✅ Badges attribués: ${totalAwarded}`);
    console.log(`   ⏭️  Badges déjà existants: ${totalSkipped}`);
    console.log(`   👥 Joueurs traités: ${allPlayers.length}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  }
}

async function awardBadgeIfNotExists(guildId, playerId, badgeCode) {
  try {
    const badge = await db.getBadgeByCode(badgeCode);
    if (!badge) {
      return 'not_found';
    }

    const alreadyHas = await db.playerHasBadge(guildId, playerId, badge.id);
    if (alreadyHas) {
      return 'skipped';
    }

    await db.query(`
      INSERT INTO player_badges (guild_id, player_id, badge_id, unlocked_at, unlocked_from)
      VALUES ($1, $2, $3, NOW(), 'retroactive_script')
      ON CONFLICT (guild_id, player_id, badge_id) DO NOTHING
    `, [guildId, playerId, badge.id]);

    return 'awarded';
  } catch (error) {
    console.error(`   ⚠️  Erreur pour ${badgeCode}:`, error.message);
    return 'error';
  }
}

async function updateBadgeProgressIfExists(guildId, playerId, badgeCode, currentValue, targetValue) {
  try {
    const badge = await db.getBadgeByCode(badgeCode);
    if (!badge) return;

    const alreadyHas = await db.playerHasBadge(guildId, playerId, badge.id);
    if (alreadyHas) return;

    await db.updateBadgeProgress(guildId, playerId, badge.id, currentValue, targetValue);
  } catch (error) {
    // Silently ignore progression errors
  }
}

retroactiveAllBadges()
  .then(() => {
    console.log('\n✅ Script terminé !');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
