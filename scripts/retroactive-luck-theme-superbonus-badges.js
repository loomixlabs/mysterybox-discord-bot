/**
 * Script rétroactif pour les badges LUCK, THEME et SUPER_BONUS
 *
 * LUCK:
 * - win_streak (5 niveaux: 3, 5, 7, 10, 15)
 * - legendaries_24h (4 niveaux: 1, 2, 3, 5)
 *
 * THEME:
 * - completion (4 niveaux: 25%, 50%, 75%, 100%)
 * - completed (4 niveaux: 1, 3, 5, 10 thèmes)
 *
 * SUPER_BONUS:
 * - vision_divine, jackpot_x2, legendary_magnet progressions
 * - SUPER_BONUS_COLLECTIONNEUR (11 bonus utilisés)
 */

require('dotenv').config();
const db = require('../utils/database-pg');

// Mappings from badgeHandler.js
const LUCK_BADGES = {
  legendaries_24h: [
    { code: 'LUCK_LEGENDARY_24H', threshold: 1 },
    { code: 'LUCK_2_LEGENDARY_24H', threshold: 2 },
    { code: 'LUCK_3_LEGENDARY_24H', threshold: 3 },
    { code: 'LUCK_5_LEGENDARY_24H', threshold: 5 }
  ],
  win_streak: [
    { code: 'LUCK_STREAK_3', threshold: 3 },
    { code: 'LUCK_STREAK_5', threshold: 5 },
    { code: 'LUCK_STREAK_7', threshold: 7 },
    { code: 'LUCK_STREAK_10', threshold: 10 },
    { code: 'LUCK_STREAK_15', threshold: 15 }
  ]
};

const THEME_BADGES = {
  completion: [
    { code: 'THEME_25_PERCENT', threshold: 25 },
    { code: 'THEME_50_PERCENT', threshold: 50 },
    { code: 'THEME_75_PERCENT', threshold: 75 },
    { code: 'THEME_100_PERCENT', threshold: 100 }
  ],
  completed: [
    { code: 'THEME_COMPLETER_1', threshold: 1 },
    { code: 'THEME_COMPLETER_3', threshold: 3 },
    { code: 'THEME_COMPLETER_5', threshold: 5 },
    { code: 'THEME_COMPLETER_10', threshold: 10 }
  ]
};

const SUPER_BONUS_TO_BADGE_MAP = {
  vision_divine: [
    { code: 'VOYANT_DIVIN_APPRENTI', threshold: 10 },
    { code: 'VOYANT_DIVIN_EXPERT', threshold: 50 },
    { code: 'VOYANT_DIVIN_MAITRE', threshold: 100 }
  ],
  jackpot_x2: [
    { code: 'JACKPOT_CHANCEUX', threshold: 10 },
    { code: 'JACKPOT_FORTUNE', threshold: 30 },
    { code: 'JACKPOT_ROI', threshold: 50 }
  ],
  legendary_magnet: [
    { code: 'AIMANT_DEBUTANT', threshold: 5 },
    { code: 'AIMANT_COLLECTIONNEUR', threshold: 15 },
    { code: 'AIMANT_MAITRE', threshold: 30 }
  ]
};

async function updateBadgeProgress(guildId, playerId, badgeCode, currentValue) {
  try {
    const badge = await db.queryOne('SELECT id, condition_value FROM badges WHERE code = $1', [badgeCode]);
    if (!badge) return null;

    const threshold = parseInt(badge.condition_value);
    if (currentValue < threshold) return null;

    // Vérifier si déjà débloqué
    const existing = await db.queryOne(`
      SELECT id FROM player_badges WHERE guild_id = $1 AND player_id = $2 AND badge_id = $3
    `, [guildId, playerId, badge.id]);

    if (existing) return null;

    // Débloquer le badge
    await db.query(`
      INSERT INTO player_badges (guild_id, player_id, badge_id, unlocked_at, unlocked_from)
      VALUES ($1, $2, $3, NOW(), 'retroactive_v3_audit')
    `, [guildId, playerId, badge.id]);

    return badgeCode;
  } catch (error) {
    console.error(`Erreur badge ${badgeCode}:`, error.message);
    return null;
  }
}

async function runRetroactive() {
  console.log('🏆 Attribution rétroactive des badges LUCK, THEME, SUPER_BONUS...\n');
  console.log('='.repeat(70));

  let stats = {
    luck_streak: 0,
    luck_legendaries: 0,
    theme_completion: 0,
    theme_completed: 0,
    super_bonus: 0,
    super_bonus_collector: 0,
    errors: 0
  };

  try {
    // Récupérer tous les joueurs
    const players = await db.queryAll(`
      SELECT DISTINCT p.id, p.guild_id, p.username, p.discord_id
      FROM players p
      ORDER BY p.guild_id, p.id
    `);
    console.log(`\n📊 ${players.length} joueurs à analyser\n`);

    for (const player of players) {
      try {
        // ============================================
        // 1. LUCK - WIN STREAK
        // ============================================
        // Calculer le streak actuel (mystery boxes sans piège)
        const lastTrap = await db.queryOne(`
          SELECT MAX(triggered_at) as last_trap FROM trap_triggered
          WHERE guild_id = $1 AND player_id = $2
        `, [player.guild_id, player.id]);

        let streakQuery = `
          SELECT COUNT(*) as streak FROM give_logs
          WHERE guild_id = $1 AND winner_id = $2
        `;
        let streakParams = [player.guild_id, player.discord_id];

        if (lastTrap?.last_trap) {
          streakQuery += ` AND claimed_at > $3`;
          streakParams.push(lastTrap.last_trap);
        }

        const streakResult = await db.queryOne(streakQuery, streakParams);
        const winStreak = streakResult ? parseInt(streakResult.streak) : 0;

        if (winStreak >= 3) {
          for (const badgeInfo of LUCK_BADGES.win_streak) {
            const result = await updateBadgeProgress(player.guild_id, player.id, badgeInfo.code, winStreak);
            if (result) {
              console.log(`   🔥 ${player.username}: ${result} (streak: ${winStreak})`);
              stats.luck_streak++;
            }
          }
        }

        // ============================================
        // 2. LUCK - LEGENDARIES IN 24H (historique max)
        // ============================================
        // Pour le rétroactif, on ne peut pas savoir le max en 24h dans l'historique
        // On vérifie si le joueur a au moins X légendaires collectés le même jour
        const maxLegendariesPerDay = await db.queryOne(`
          SELECT DATE(collected_at) as day, COUNT(*) as count
          FROM collections c
          JOIN collectibles col ON c.collectible_id = col.id
          WHERE c.guild_id = $1 AND c.player_id = $2 AND col.rarity = 'legendary'
          GROUP BY DATE(collected_at)
          ORDER BY count DESC
          LIMIT 1
        `, [player.guild_id, player.id]);

        const legendaries24h = maxLegendariesPerDay ? parseInt(maxLegendariesPerDay.count) : 0;

        if (legendaries24h >= 1) {
          for (const badgeInfo of LUCK_BADGES.legendaries_24h) {
            const result = await updateBadgeProgress(player.guild_id, player.id, badgeInfo.code, legendaries24h);
            if (result) {
              console.log(`   🍀 ${player.username}: ${result} (max ${legendaries24h} legendary/jour)`);
              stats.luck_legendaries++;
            }
          }
        }

        // ============================================
        // 3. THEME - COMPLETION (thème actif)
        // ============================================
        const activeTheme = await db.getActiveTheme(player.guild_id);
        if (activeTheme) {
          const totalCollectibles = await db.queryOne(`
            SELECT COUNT(*) as count FROM collectibles WHERE guild_id = $1 AND theme_id = $2
          `, [player.guild_id, activeTheme.id]);

          const playerCollectibles = await db.queryOne(`
            SELECT COUNT(DISTINCT c.collectible_id) as count
            FROM collections c
            JOIN collectibles col ON c.collectible_id = col.id
            WHERE c.guild_id = $1 AND c.player_id = $2 AND col.theme_id = $3 AND c.lost_at IS NULL
          `, [player.guild_id, player.id, activeTheme.id]);

          const total = totalCollectibles ? parseInt(totalCollectibles.count) : 0;
          const collected = playerCollectibles ? parseInt(playerCollectibles.count) : 0;
          const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;

          if (percentage >= 25) {
            for (const badgeInfo of THEME_BADGES.completion) {
              const result = await updateBadgeProgress(player.guild_id, player.id, badgeInfo.code, percentage);
              if (result) {
                console.log(`   📚 ${player.username}: ${result} (${percentage}%)`);
                stats.theme_completion++;
              }
            }
          }
        }

        // ============================================
        // 4. THEME - COMPLETED (thèmes complétés)
        // ============================================
        const completedThemes = await db.queryAll(`
          SELECT DISTINCT col.theme_id
          FROM collections c
          JOIN collectibles col ON c.collectible_id = col.id
          WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
          GROUP BY col.theme_id
          HAVING COUNT(DISTINCT c.collectible_id) >= (
            SELECT COUNT(*) FROM collectibles WHERE guild_id = $1 AND theme_id = col.theme_id
          )
        `, [player.guild_id, player.id]);

        const completedCount = completedThemes ? completedThemes.length : 0;

        if (completedCount >= 1) {
          for (const badgeInfo of THEME_BADGES.completed) {
            const result = await updateBadgeProgress(player.guild_id, player.id, badgeInfo.code, completedCount);
            if (result) {
              console.log(`   🏆 ${player.username}: ${result} (${completedCount} thèmes)`);
              stats.theme_completed++;
            }
          }
        }

        // ============================================
        // 5. SUPER_BONUS - Par type
        // ============================================
        for (const [bonusType, badges] of Object.entries(SUPER_BONUS_TO_BADGE_MAP)) {
          const usageCount = await db.queryOne(`
            SELECT COUNT(*) as count FROM bonus_usage_history
            WHERE guild_id = $1 AND user_id = $2
              AND bonus_id IN (SELECT id FROM super_bonuses WHERE bonus_id = $3)
          `, [player.guild_id, player.discord_id, bonusType]);

          const count = usageCount ? parseInt(usageCount.count) : 0;

          if (count >= 5) {
            for (const badgeInfo of badges) {
              const result = await updateBadgeProgress(player.guild_id, player.id, badgeInfo.code, count);
              if (result) {
                console.log(`   🎁 ${player.username}: ${result} (${count}x ${bonusType})`);
                stats.super_bonus++;
              }
            }
          }
        }

        // ============================================
        // 6. SUPER_BONUS_COLLECTIONNEUR (total)
        // ============================================
        const totalBonusUsed = await db.queryOne(`
          SELECT COUNT(*) as count FROM bonus_usage_history
          WHERE guild_id = $1 AND user_id = $2
        `, [player.guild_id, player.discord_id]);

        const totalUsed = totalBonusUsed ? parseInt(totalBonusUsed.count) : 0;

        if (totalUsed >= 11) {
          const result = await updateBadgeProgress(player.guild_id, player.id, 'SUPER_BONUS_COLLECTIONNEUR', totalUsed);
          if (result) {
            console.log(`   ⭐ ${player.username}: ${result} (${totalUsed} bonus total)`);
            stats.super_bonus_collector++;
          }
        }

      } catch (error) {
        console.error(`   ❌ Erreur pour ${player.username}: ${error.message}`);
        stats.errors++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSUMÉ:');
    console.log(`   🔥 Badges LUCK (streak): ${stats.luck_streak}`);
    console.log(`   🍀 Badges LUCK (legendaries): ${stats.luck_legendaries}`);
    console.log(`   📚 Badges THEME (completion): ${stats.theme_completion}`);
    console.log(`   🏆 Badges THEME (completed): ${stats.theme_completed}`);
    console.log(`   🎁 Badges SUPER_BONUS (types): ${stats.super_bonus}`);
    console.log(`   ⭐ Badges SUPER_BONUS_COLLECTIONNEUR: ${stats.super_bonus_collector}`);
    console.log(`   ❌ Erreurs: ${stats.errors}`);
    console.log(`   📊 TOTAL: ${stats.luck_streak + stats.luck_legendaries + stats.theme_completion + stats.theme_completed + stats.super_bonus + stats.super_bonus_collector} badges attribués`);
    console.log('='.repeat(70));

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
