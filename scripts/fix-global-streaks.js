/**
 * Script de correction des streaks globaux
 *
 * Ce script recalcule et corrige les current_claim_streak et best_claim_streak
 * de tous les joueurs en se basant sur les logs de claims (daily_claim_logs).
 *
 * Le bug était: days_ago = rn au lieu de days_ago = rn - 1
 * Ce qui causait un décalage dans le comptage des jours consécutifs.
 */

const db = require('../utils/database-pg');

async function fixGlobalStreaks() {
  console.log('🔧 CORRECTION DES STREAKS GLOBAUX\n');
  console.log('='.repeat(80));

  try {
    // 1. Récupérer tous les joueurs avec des claims
    const players = await db.queryAll(`
      SELECT DISTINCT p.id, p.guild_id, p.username, p.current_claim_streak, p.best_claim_streak
      FROM players p
      INNER JOIN daily_claim_logs dcl ON dcl.player_id = p.id AND dcl.guild_id = p.guild_id
      ORDER BY p.guild_id, p.username
    `);

    console.log(`📊 ${players.length} joueurs avec des claims trouvés\n`);

    let corrected = 0;
    let unchanged = 0;

    for (const player of players) {
      // Calculer le streak correct depuis les logs
      const today = new Date().toISOString().split('T')[0];

      // Compter les jours consécutifs jusqu'à aujourd'hui
      const streakResult = await db.queryOne(`
        WITH claim_dates AS (
          SELECT DISTINCT claim_date::date as claim_day
          FROM daily_claim_logs
          WHERE guild_id = $1 AND player_id = $2
          ORDER BY claim_day DESC
        ),
        numbered AS (
          SELECT claim_day,
                 ROW_NUMBER() OVER (ORDER BY claim_day DESC) as rn,
                 ($3::date - claim_day)::int as days_ago
          FROM claim_dates
        ),
        consecutive AS (
          SELECT claim_day, rn, days_ago
          FROM numbered
          WHERE days_ago = rn - 1  -- Fix: jours consécutifs depuis aujourd'hui
        )
        SELECT COUNT(*) as streak FROM consecutive
      `, [player.guild_id, player.id, today]);

      const correctStreak = parseInt(streakResult?.streak) || 0;

      // Calculer le meilleur streak historique (plus complexe)
      // On cherche la plus longue série consécutive dans tous les logs
      const bestStreakResult = await db.queryOne(`
        WITH claim_dates AS (
          SELECT DISTINCT claim_date::date as claim_day
          FROM daily_claim_logs
          WHERE guild_id = $1 AND player_id = $2
          ORDER BY claim_day
        ),
        with_gaps AS (
          SELECT
            claim_day,
            claim_day - (ROW_NUMBER() OVER (ORDER BY claim_day))::int AS grp
          FROM claim_dates
        ),
        streaks AS (
          SELECT grp, COUNT(*) as streak_length
          FROM with_gaps
          GROUP BY grp
        )
        SELECT MAX(streak_length) as best_streak FROM streaks
      `, [player.guild_id, player.id]);

      const correctBestStreak = Math.max(
        parseInt(bestStreakResult?.best_streak) || 0,
        correctStreak,
        player.best_claim_streak || 0  // Garder l'ancien best s'il est plus grand
      );

      // Comparer avec les valeurs actuelles
      if (player.current_claim_streak !== correctStreak || player.best_claim_streak < correctBestStreak) {
        console.log(`\n👤 ${player.username} (guild: ${player.guild_id})`);
        console.log(`   current_claim_streak: ${player.current_claim_streak} → ${correctStreak}`);
        console.log(`   best_claim_streak: ${player.best_claim_streak} → ${correctBestStreak}`);

        // Mettre à jour
        await db.query(`
          UPDATE players SET
            current_claim_streak = $3,
            best_claim_streak = $4,
            updated_at = NOW()
          WHERE guild_id = $1 AND id = $2
        `, [player.guild_id, player.id, correctStreak, correctBestStreak]);

        corrected++;
      } else {
        unchanged++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`✅ CORRECTION TERMINÉE`);
    console.log(`   - ${corrected} joueurs corrigés`);
    console.log(`   - ${unchanged} joueurs déjà corrects`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

fixGlobalStreaks();
