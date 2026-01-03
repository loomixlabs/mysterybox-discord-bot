/**
 * Script rétroactif pour recalculer les streaks globaux
 * basé sur les données réelles de daily_claim_logs
 *
 * Le streak global persiste entre les thèmes (contrairement au streak par thème)
 */
require('dotenv').config();
const db = require('../utils/database-pg');

async function recalculateGlobalStreaks() {
  console.log('🔄 RECALCUL DES STREAKS GLOBAUX\n');
  console.log('='.repeat(70));

  let updated = 0;
  let errors = 0;

  try {
    // Récupérer tous les joueurs qui ont des claims
    const playersWithClaims = await db.queryAll(`
      SELECT DISTINCT dcl.guild_id, dcl.player_id, p.username
      FROM daily_claim_logs dcl
      JOIN players p ON dcl.player_id = p.id AND dcl.guild_id = p.guild_id
      ORDER BY dcl.guild_id, dcl.player_id
    `);

    console.log(`\n📊 ${playersWithClaims.length} joueurs avec des claims à analyser\n`);

    const today = new Date().toISOString().split('T')[0];

    for (const player of playersWithClaims) {
      try {
        // Calculer le streak actuel (jours consécutifs jusqu'à aujourd'hui ou hier)
        const streakResult = await db.queryOne(`
          WITH claim_dates AS (
            SELECT DISTINCT claim_date::date as claim_day
            FROM daily_claim_logs
            WHERE guild_id = $1 AND player_id = $2
            ORDER BY claim_day DESC
          ),
          numbered AS (
            SELECT claim_day,
                   ROW_NUMBER() OVER (ORDER BY claim_day DESC) as rn
            FROM claim_dates
          ),
          with_expected AS (
            SELECT claim_day, rn,
                   (SELECT MAX(claim_day) FROM numbered) - ((rn - 1)::int) as expected_day
            FROM numbered
          ),
          consecutive AS (
            SELECT claim_day, rn
            FROM with_expected
            WHERE claim_day = expected_day
          )
          SELECT
            COUNT(*) as current_streak,
            (SELECT MAX(claim_day) FROM numbered)::text as last_claim
          FROM consecutive
        `, [player.guild_id, player.player_id]);

        // Calculer le meilleur streak historique
        // On groupe les jours consécutifs ensemble en utilisant la différence avec ROW_NUMBER
        const bestStreakResult = await db.queryOne(`
          WITH claim_dates AS (
            SELECT DISTINCT claim_date::date as claim_day
            FROM daily_claim_logs
            WHERE guild_id = $1 AND player_id = $2
            ORDER BY claim_day
          ),
          with_groups AS (
            SELECT claim_day,
                   claim_day - (ROW_NUMBER() OVER (ORDER BY claim_day) * INTERVAL '1 day') as grp
            FROM claim_dates
          ),
          streaks AS (
            SELECT grp, COUNT(*) as streak_length
            FROM with_groups
            GROUP BY grp
          )
          SELECT MAX(streak_length) as best_streak FROM streaks
        `, [player.guild_id, player.player_id]);

        // Compter le total des claims
        const totalResult = await db.queryOne(`
          SELECT COUNT(DISTINCT claim_date) as total
          FROM daily_claim_logs
          WHERE guild_id = $1 AND player_id = $2
        `, [player.guild_id, player.player_id]);

        const currentStreak = parseInt(streakResult?.current_streak) || 0;
        const lastClaim = streakResult?.last_claim;
        const bestStreak = parseInt(bestStreakResult?.best_streak) || currentStreak;
        const totalClaims = parseInt(totalResult?.total) || 0;

        // Vérifier si le streak est toujours actif (dernier claim = aujourd'hui ou hier)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let activeStreak = currentStreak;
        if (lastClaim !== today && lastClaim !== yesterdayStr) {
          // Le streak est cassé
          activeStreak = 0;
        }

        // Mettre à jour le joueur
        await db.query(`
          UPDATE players SET
            current_claim_streak = $3,
            best_claim_streak = $4,
            last_daily_claim = $5::date,
            total_daily_claims = $6,
            updated_at = NOW()
          WHERE guild_id = $1 AND id = $2
        `, [player.guild_id, player.player_id, activeStreak, bestStreak, lastClaim, totalClaims]);

        if (activeStreak > 0) {
          console.log(`   ✅ ${player.username}: streak=${activeStreak}, best=${bestStreak}, total=${totalClaims}`);
        }
        updated++;

      } catch (error) {
        console.error(`   ❌ Erreur ${player.username}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSUMÉ:');
    console.log(`   ✅ Joueurs mis à jour: ${updated}`);
    console.log(`   ❌ Erreurs: ${errors}`);

    // Statistiques finales
    const stats = await db.queryOne(`
      SELECT
        COUNT(CASE WHEN current_claim_streak >= 3 THEN 1 END) as streak_3,
        COUNT(CASE WHEN current_claim_streak >= 7 THEN 1 END) as streak_7,
        COUNT(CASE WHEN current_claim_streak >= 14 THEN 1 END) as streak_14,
        COUNT(CASE WHEN current_claim_streak >= 30 THEN 1 END) as streak_30,
        COUNT(CASE WHEN current_claim_streak >= 90 THEN 1 END) as streak_90,
        MAX(current_claim_streak) as max_streak
      FROM players
      WHERE guild_id = '1248028543389143070'
    `);

    console.log('\n📊 STATISTIQUES STREAKS (serveur principal):');
    console.log(`   🔥 Streak ≥ 3 jours: ${stats.streak_3}`);
    console.log(`   🔥 Streak ≥ 7 jours: ${stats.streak_7}`);
    console.log(`   🔥 Streak ≥ 14 jours: ${stats.streak_14}`);
    console.log(`   🔥 Streak ≥ 30 jours: ${stats.streak_30}`);
    console.log(`   🔥 Streak ≥ 90 jours: ${stats.streak_90}`);
    console.log(`   🏆 Max streak: ${stats.max_streak}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }

  process.exit(0);
}

recalculateGlobalStreaks();
