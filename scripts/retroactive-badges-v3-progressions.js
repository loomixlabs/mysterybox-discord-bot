/**
 * Script de rétroactivité pour les badges V3 (progressions étendues)
 * Attribue les nouveaux badges basés sur les données existantes
 *
 * Usage: node scripts/retroactive-badges-v3-progressions.js
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function retroactiveBadgesV3() {
  console.log('🏆 Attribution rétroactive des badges V3 (Progressions étendues)...\n');
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
      // 1. RARITY BADGES - Legendary Count (6 niveaux)
      // =================================================================
      const legendaryCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
        AND col.rarity = 'legendary'
      `, [player.guild_id, player.player_id]);

      if (legendaryCount && parseInt(legendaryCount.count) > 0) {
        const count = parseInt(legendaryCount.count);
        const legendaryBadges = [
          { code: 'RARITY_LEGENDARY_NOVICE', threshold: 1 },
          { code: 'RARITY_LEGENDARY_SEEKER', threshold: 5 },
          { code: 'RARITY_LEGENDARY_HUNTER', threshold: 10 },
          { code: 'RARITY_LEGENDARY_COLLECTOR', threshold: 25 },
          { code: 'RARITY_LEGENDARY_MASTER', threshold: 50 },
          { code: 'RARITY_LEGENDARY_EMPEROR', threshold: 100 }
        ];

        for (const badgeInfo of legendaryBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }
      }

      // =================================================================
      // 2. RARITY BADGES - Epic Count (5 niveaux)
      // =================================================================
      const epicCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
        AND col.rarity = 'epic'
      `, [player.guild_id, player.player_id]);

      if (epicCount && parseInt(epicCount.count) > 0) {
        const count = parseInt(epicCount.count);
        const epicBadges = [
          { code: 'RARITY_EPIC_NOVICE', threshold: 5 },
          { code: 'RARITY_EPIC_SEEKER', threshold: 10 },
          { code: 'RARITY_EPIC_MASTER', threshold: 25 },
          { code: 'RARITY_EPIC_COLLECTOR', threshold: 50 },
          { code: 'RARITY_EPIC_EMPEROR', threshold: 100 }
        ];

        for (const badgeInfo of epicBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }
      }

      // =================================================================
      // 3. RARITY BADGES - Rare Count (5 niveaux)
      // =================================================================
      const rareCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
        AND col.rarity = 'rare'
      `, [player.guild_id, player.player_id]);

      if (rareCount && parseInt(rareCount.count) > 0) {
        const count = parseInt(rareCount.count);
        const rareBadges = [
          { code: 'RARITY_RARE_NOVICE', threshold: 10 },
          { code: 'RARITY_RARE_SEEKER', threshold: 25 },
          { code: 'RARITY_RARE_BARON', threshold: 50 },
          { code: 'RARITY_RARE_COLLECTOR', threshold: 100 },
          { code: 'RARITY_RARE_EMPEROR', threshold: 200 }
        ];

        for (const badgeInfo of rareBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }
      }

      // =================================================================
      // 4. MYSTERY BOX RARITY BADGES
      // =================================================================
      const epicBoxCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM give_logs
        WHERE guild_id = $1 AND winner_id = $2 AND mystery_box_rarity = 'epic'
      `, [player.guild_id, player.discord_id]);

      if (epicBoxCount && parseInt(epicBoxCount.count) > 0) {
        const count = parseInt(epicBoxCount.count);
        const epicBoxBadges = [
          { code: 'BOX_EPIC_NOVICE', threshold: 1 },
          { code: 'BOX_EPIC_SEEKER', threshold: 5 },
          { code: 'BOX_EPIC_COLLECTOR', threshold: 10 },
          { code: 'BOX_EPIC_MASTER', threshold: 25 },
          { code: 'BOX_EPIC_EMPEROR', threshold: 50 }
        ];

        for (const badgeInfo of epicBoxBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }
      }

      const legendaryBoxCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM give_logs
        WHERE guild_id = $1 AND winner_id = $2 AND mystery_box_rarity = 'legendary'
      `, [player.guild_id, player.discord_id]);

      if (legendaryBoxCount && parseInt(legendaryBoxCount.count) > 0) {
        const count = parseInt(legendaryBoxCount.count);
        const legendaryBoxBadges = [
          { code: 'BOX_LEGENDARY_NOVICE', threshold: 1 },
          { code: 'BOX_LEGENDARY_SEEKER', threshold: 3 },
          { code: 'BOX_LEGENDARY_COLLECTOR', threshold: 5 },
          { code: 'BOX_LEGENDARY_MASTER', threshold: 10 },
          { code: 'BOX_LEGENDARY_EMPEROR', threshold: 25 }
        ];

        for (const badgeInfo of legendaryBoxBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }
      }

      // =================================================================
      // 5. TRAP TRIGGERED BADGES (6 niveaux)
      // =================================================================
      const trapCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM trap_triggered
        WHERE guild_id = $1 AND player_id = $2
      `, [player.guild_id, player.player_id]);

      if (trapCount && parseInt(trapCount.count) > 0) {
        const count = parseInt(trapCount.count);
        const trapBadges = [
          { code: 'TRAP_TRIGGERED_1', threshold: 1 },
          { code: 'TRAP_TRIGGERED_5', threshold: 5 },
          { code: 'TRAP_TRIGGERED_10', threshold: 10 },
          { code: 'TRAP_TRIGGERED_25', threshold: 25 },
          { code: 'TRAP_TRIGGERED_50', threshold: 50 },
          { code: 'TRAP_TRIGGERED_100', threshold: 100 }
        ];

        for (const badgeInfo of trapBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }
      }

      // =================================================================
      // 6. ECONOMY BADGES - Loomix
      // =================================================================
      const currency = await db.queryOne(`
        SELECT balance, total_earned, total_spent
        FROM player_currency
        WHERE guild_id = $1 AND player_id = $2 AND currency_type = 'loomix'
      `, [player.guild_id, player.player_id]);

      if (currency) {
        // Spent badges
        const spentBadges = [
          { code: 'ECONOMY_FIRST_SPEND', threshold: 100 },
          { code: 'ECONOMY_REGULAR_SPENDER', threshold: 500 },
          { code: 'ECONOMY_SPENDER', threshold: 1000 },
          { code: 'ECONOMY_BIG_SPENDER', threshold: 5000 },
          { code: 'ECONOMY_MEGA_SPENDER', threshold: 10000 }
        ];
        const spent = parseInt(currency.total_spent) || 0;
        for (const badgeInfo of spentBadges) {
          if (spent >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${spent}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }

        // Earned badges
        const earnedBadges = [
          { code: 'ECONOMY_FIRST_EARNINGS', threshold: 1000 },
          { code: 'ECONOMY_REGULAR_EARNER', threshold: 5000 },
          { code: 'ECONOMY_MILLIONAIRE', threshold: 10000 },
          { code: 'ECONOMY_WEALTHY', threshold: 50000 },
          { code: 'ECONOMY_BILLIONAIRE', threshold: 100000 }
        ];
        const earned = parseInt(currency.total_earned) || 0;
        for (const badgeInfo of earnedBadges) {
          if (earned >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${earned}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }

        // Balance badges
        const balanceBadges = [
          { code: 'ECONOMY_FIRST_SAVINGS', threshold: 1000 },
          { code: 'ECONOMY_GOOD_SAVER', threshold: 2500 },
          { code: 'ECONOMY_SAVER', threshold: 5000 },
          { code: 'ECONOMY_RICH', threshold: 10000 },
          { code: 'ECONOMY_ULTRA_RICH', threshold: 25000 }
        ];
        const balance = parseInt(currency.balance) || 0;
        for (const badgeInfo of balanceBadges) {
          if (balance >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${balance}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }
      }

      // =================================================================
      // 7. SOCIAL - FLEX BADGES (6 niveaux)
      // =================================================================
      try {
        const flexCount = await db.queryOne(`
          SELECT COUNT(*) as count FROM audit_logs
          WHERE guild_id = $1 AND action_type = 'FLEX' AND target_id = $2
        `, [player.guild_id, player.discord_id]);

        if (flexCount && parseInt(flexCount.count) > 0) {
          const count = parseInt(flexCount.count);
          const flexBadges = [
            { code: 'SOCIAL_FIRST_FLEX', threshold: 1 },
            { code: 'SOCIAL_FLEX_5', threshold: 5 },
            { code: 'SOCIAL_FLEX_10', threshold: 10 },
            { code: 'SOCIAL_FLEX_25', threshold: 25 },
            { code: 'SOCIAL_FLEX_50', threshold: 50 },
            { code: 'SOCIAL_FLEX_100', threshold: 100 }
          ];

          for (const badgeInfo of flexBadges) {
            if (count >= badgeInfo.threshold) {
              const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
              if (result === 'awarded') {
                console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
                playerBadges++;
                totalAwarded++;
              } else if (result === 'skipped') {
                totalSkipped++;
              }
            }
          }
        }
      } catch (flexError) {
        // Ignorer si la colonne action_type n'existe pas
      }

      // =================================================================
      // 8. MISSION COMPLETE BADGES (5 niveaux)
      // =================================================================
      const missionCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM mission_progress
        WHERE guild_id = $1 AND player_id = $2 AND status = 'completed'
      `, [player.guild_id, player.player_id]);

      if (missionCount && parseInt(missionCount.count) > 0) {
        const count = parseInt(missionCount.count);
        const missionBadges = [
          { code: 'MISSION_FIRST', threshold: 1 },
          { code: 'MISSION_REGULAR', threshold: 10 },
          { code: 'MISSION_VETERAN', threshold: 25 },
          { code: 'MISSION_EXPERT', threshold: 50 },
          { code: 'MISSION_MASTER', threshold: 100 }
        ];

        for (const badgeInfo of missionBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }
      }

      // =================================================================
      // 9. MYSTERY BOX OPEN BADGES (6 niveaux)
      // =================================================================
      const mysteryBoxCount = await db.queryOne(`
        SELECT COUNT(*) as count FROM give_logs
        WHERE guild_id = $1 AND winner_id = $2
        AND mystery_box_rarity IS NOT NULL
      `, [player.guild_id, player.discord_id]);

      if (mysteryBoxCount && parseInt(mysteryBoxCount.count) > 0) {
        const count = parseInt(mysteryBoxCount.count);
        const boxBadges = [
          { code: 'BOX_OPENER_FIRST', threshold: 1 },
          { code: 'BOX_OPENER_10', threshold: 10 },
          { code: 'BOX_OPENER_50', threshold: 50 },
          { code: 'BOX_OPENER_100', threshold: 100 },
          { code: 'BOX_OPENER_500', threshold: 500 },
          { code: 'BOX_OPENER_1000', threshold: 1000 }
        ];

        for (const badgeInfo of boxBadges) {
          if (count >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${count}/${badgeInfo.threshold})`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }
      }

      // =================================================================
      // 10. THEME COMPLETION BADGES
      // =================================================================
      const themeProgress = await db.queryAll(`
        SELECT pp.*, t.required_items
        FROM player_progress pp
        JOIN themes t ON pp.theme_id = t.id
        WHERE pp.guild_id = $1 AND pp.player_id = $2
      `, [player.guild_id, player.player_id]);

      if (themeProgress && themeProgress.length > 0) {
        let themesCompleted = 0;
        let maxCompletion = 0;

        for (const progress of themeProgress) {
          const percentage = (progress.collected_count / progress.required_items) * 100;
          if (percentage > maxCompletion) maxCompletion = percentage;
          if (percentage >= 100) themesCompleted++;
        }

        // Completion badges
        const completionBadges = [
          { code: 'THEME_25_PERCENT', threshold: 25 },
          { code: 'THEME_50_PERCENT', threshold: 50 },
          { code: 'THEME_75_PERCENT', threshold: 75 },
          { code: 'THEME_100_PERCENT', threshold: 100 }
        ];

        for (const badgeInfo of completionBadges) {
          if (maxCompletion >= badgeInfo.threshold) {
            const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
            if (result === 'awarded') {
              console.log(`   ✅ ${badgeInfo.code} (${Math.round(maxCompletion)}%/${badgeInfo.threshold}%)`);
              playerBadges++;
              totalAwarded++;
            } else if (result === 'skipped') {
              totalSkipped++;
            }
          }
        }

        // Themes completed badges
        if (themesCompleted > 0) {
          const themesCompletedBadges = [
            { code: 'THEME_COMPLETER_1', threshold: 1 },
            { code: 'THEME_COMPLETER_3', threshold: 3 },
            { code: 'THEME_COMPLETER_5', threshold: 5 },
            { code: 'THEME_COMPLETER_10', threshold: 10 }
          ];

          for (const badgeInfo of themesCompletedBadges) {
            if (themesCompleted >= badgeInfo.threshold) {
              const result = await awardBadgeIfNotExists(player.guild_id, player.player_id, badgeInfo.code);
              if (result === 'awarded') {
                console.log(`   ✅ ${badgeInfo.code} (${themesCompleted}/${badgeInfo.threshold} thèmes)`);
                playerBadges++;
                totalAwarded++;
              } else if (result === 'skipped') {
                totalSkipped++;
              }
            }
          }
        }
      }

      if (playerBadges > 0) {
        console.log(`   📊 Total pour ce joueur: ${playerBadges} badges V3`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ GLOBAL (V3 Progressions):');
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
      VALUES ($1, $2, $3, NOW(), 'retroactive_v3_script')
      ON CONFLICT (guild_id, player_id, badge_id) DO NOTHING
    `, [guildId, playerId, badge.id]);

    return 'awarded';
  } catch (error) {
    console.error(`   ⚠️  Erreur pour ${badgeCode}:`, error.message);
    return 'error';
  }
}

retroactiveBadgesV3()
  .then(() => {
    console.log('\n✅ Script terminé !');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
