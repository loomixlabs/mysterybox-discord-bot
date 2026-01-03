/**
 * Script rétroactif pour les badges ENGAGEMENT
 * Attribue les badges basés sur current_claim_streak et best_claim_streak
 *
 * ENGAGEMENT_BADGES:
 * - ENGAGEMENT_ACTIF: 3 jours
 * - ENGAGEMENT_ASSIDU: 7 jours
 * - ENGAGEMENT_DEVOU: 14 jours
 * - ENGAGEMENT_MARATHONIEN: 30 jours
 * - ENGAGEMENT_ETERNEL: 90 jours
 */
require('dotenv').config();
const db = require('../utils/database-pg');

const ENGAGEMENT_BADGES = [
  { code: 'ENGAGEMENT_ACTIF', threshold: 3 },
  { code: 'ENGAGEMENT_ASSIDU', threshold: 7 },
  { code: 'ENGAGEMENT_DEVOU', threshold: 14 },
  { code: 'ENGAGEMENT_MARATHONIEN', threshold: 30 },
  { code: 'ENGAGEMENT_ETERNEL', threshold: 90 }
];

async function awardBadgeIfNotExists(guildId, playerId, badgeCode, playerName) {
  try {
    const badge = await db.queryOne('SELECT id FROM badges WHERE code = $1', [badgeCode]);
    if (!badge) {
      console.log(`   ⚠️ Badge ${badgeCode} non trouvé`);
      return 'not_found';
    }

    const existing = await db.queryOne(`
      SELECT id FROM player_badges
      WHERE guild_id = $1 AND player_id = $2 AND badge_id = $3
    `, [guildId, playerId, badge.id]);

    if (existing) {
      return 'skipped';
    }

    await db.query(`
      INSERT INTO player_badges (guild_id, player_id, badge_id, unlocked_at, unlocked_from)
      VALUES ($1, $2, $3, NOW(), 'retroactive_engagement')
    `, [guildId, playerId, badge.id]);

    console.log(`   🔥 ${playerName}: ${badgeCode}`);
    return 'awarded';

  } catch (error) {
    console.error(`   ❌ Erreur badge ${badgeCode} pour ${playerName}: ${error.message}`);
    return 'error';
  }
}

async function runRetroactive() {
  console.log('🔥 ATTRIBUTION RÉTROACTIVE DES BADGES ENGAGEMENT\n');
  console.log('='.repeat(70));

  let stats = {
    awarded: 0,
    skipped: 0,
    errors: 0
  };

  try {
    // On utilise best_claim_streak car un joueur qui a eu un streak de 7 jours
    // mérite le badge même si son streak actuel est cassé
    const players = await db.queryAll(`
      SELECT p.id, p.guild_id, p.username, p.current_claim_streak, p.best_claim_streak
      FROM players p
      WHERE p.best_claim_streak >= 3 OR p.current_claim_streak >= 3
      ORDER BY GREATEST(p.best_claim_streak, p.current_claim_streak) DESC
    `);

    console.log(`\n📊 ${players.length} joueurs avec streak ≥ 3 jours\n`);

    for (const player of players) {
      // Utiliser le meilleur des deux streaks
      const maxStreak = Math.max(player.current_claim_streak || 0, player.best_claim_streak || 0);

      for (const badgeInfo of ENGAGEMENT_BADGES) {
        if (maxStreak >= badgeInfo.threshold) {
          const result = await awardBadgeIfNotExists(
            player.guild_id,
            player.id,
            badgeInfo.code,
            player.username
          );

          if (result === 'awarded') stats.awarded++;
          else if (result === 'skipped') stats.skipped++;
          else if (result === 'error') stats.errors++;
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSUMÉ:');
    console.log(`   🔥 Badges ENGAGEMENT attribués: ${stats.awarded}`);
    console.log(`   ⏭️  Déjà existants: ${stats.skipped}`);
    console.log(`   ❌ Erreurs: ${stats.errors}`);

    // Statistiques par badge
    console.log('\n📊 BADGES ENGAGEMENT EN DB:');
    for (const badge of ENGAGEMENT_BADGES) {
      const count = await db.queryOne(`
        SELECT COUNT(*) as count FROM player_badges pb
        JOIN badges b ON pb.badge_id = b.id
        WHERE b.code = $1
      `, [badge.code]);
      console.log(`   ${badge.code} (${badge.threshold}j): ${count.count}`);
    }
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }

  process.exit(0);
}

runRetroactive();
