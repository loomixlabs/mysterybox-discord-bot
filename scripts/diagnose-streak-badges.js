/**
 * Script de diagnostic pour les badges SENIORITY et ENGAGEMENT
 */
require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function diagnose() {
  console.log('🔍 DIAGNOSTIC BADGES SENIORITY & ENGAGEMENT\n');
  console.log('='.repeat(70));

  try {
    // 1. Vérifier les données de streak globales
    console.log('\n📊 1. Données streak globales (players table):');
    const players = await db.queryAll(`
      SELECT id, username, current_claim_streak, best_claim_streak,
             last_daily_claim::text, total_daily_claims, created_at::date as joined_date,
             EXTRACT(DAY FROM NOW() - created_at)::integer as days_since_creation
      FROM players
      WHERE guild_id = $1
      ORDER BY current_claim_streak DESC NULLS LAST
      LIMIT 10
    `, [GUILD_ID]);
    console.table(players);

    // 2. Vérifier les claims récents
    console.log('\n📅 2. Claims récents (daily_claim_logs):');
    const claims = await db.queryAll(`
      SELECT dcl.player_id, p.username, dcl.claim_date::text, dcl.streak_at_claim,
             dcl.theme_id
      FROM daily_claim_logs dcl
      JOIN players p ON dcl.player_id = p.id
      WHERE dcl.guild_id = $1
      ORDER BY dcl.claim_date DESC
      LIMIT 15
    `, [GUILD_ID]);
    console.table(claims);

    // 3. Vérifier le claim_streak_by_theme JSONB
    console.log('\n📊 3. JSONB claim_streak_by_theme pour top 5 joueurs:');
    const jsonbData = await db.queryAll(`
      SELECT id, username, claim_streak_by_theme
      FROM players
      WHERE guild_id = $1 AND claim_streak_by_theme IS NOT NULL
      ORDER BY current_claim_streak DESC NULLS LAST
      LIMIT 5
    `, [GUILD_ID]);
    for (const p of jsonbData) {
      console.log(`\n👤 ${p.username} (ID: ${p.id}):`);
      console.log(JSON.stringify(p.claim_streak_by_theme, null, 2));
    }

    // 4. Comparer last_daily_claim avec le dernier log
    console.log('\n\n🔄 4. Comparaison last_daily_claim vs dernier claim réel:');
    const comparison = await db.queryAll(`
      SELECT
        p.id, p.username,
        p.last_daily_claim::text as player_last_claim,
        MAX(dcl.claim_date)::text as actual_last_claim,
        p.current_claim_streak as stored_streak,
        MAX(dcl.streak_at_claim) as actual_streak
      FROM players p
      LEFT JOIN daily_claim_logs dcl ON dcl.player_id = p.id AND dcl.guild_id = p.guild_id
      WHERE p.guild_id = $1
      GROUP BY p.id, p.username, p.last_daily_claim, p.current_claim_streak
      HAVING MAX(dcl.claim_date) IS NOT NULL
      ORDER BY MAX(dcl.claim_date) DESC
      LIMIT 10
    `, [GUILD_ID]);
    console.table(comparison);

    // 5. Badges SENIORITY attribués
    console.log('\n🏆 5. Badges SENIORITY attribués:');
    const seniorityBadges = await db.queryAll(`
      SELECT b.code, b.name, COUNT(pb.id) as count
      FROM badges b
      LEFT JOIN player_badges pb ON pb.badge_id = b.id AND pb.guild_id = $1
      WHERE b.code LIKE 'SENIORITY%'
      GROUP BY b.id, b.code, b.name
      ORDER BY b.code
    `, [GUILD_ID]);
    console.table(seniorityBadges);

    // 6. Badges ENGAGEMENT attribués
    console.log('\n🔥 6. Badges ENGAGEMENT attribués:');
    const engagementBadges = await db.queryAll(`
      SELECT b.code, b.name, b.condition_value, COUNT(pb.id) as awarded
      FROM badges b
      LEFT JOIN player_badges pb ON pb.badge_id = b.id AND pb.guild_id = $1
      WHERE b.code LIKE 'ENGAGEMENT%'
      GROUP BY b.id, b.code, b.name, b.condition_value
      ORDER BY b.condition_value::int
    `, [GUILD_ID]);
    console.table(engagementBadges);

    // 7. Calcul théorique d'ancienneté
    console.log('\n📅 7. Joueurs par ancienneté (calcul réel):');
    const seniority = await db.queryAll(`
      SELECT
        CASE
          WHEN EXTRACT(DAY FROM NOW() - created_at) >= 365 THEN 'YEAR+'
          WHEN EXTRACT(DAY FROM NOW() - created_at) >= 180 THEN '6MONTHS+'
          WHEN EXTRACT(DAY FROM NOW() - created_at) >= 30 THEN 'MONTH+'
          WHEN EXTRACT(DAY FROM NOW() - created_at) >= 7 THEN 'WEEK+'
          ELSE 'NEW'
        END as tier,
        COUNT(*) as players
      FROM players
      WHERE guild_id = $1
      GROUP BY tier
      ORDER BY
        CASE tier
          WHEN 'YEAR+' THEN 5
          WHEN '6MONTHS+' THEN 4
          WHEN 'MONTH+' THEN 3
          WHEN 'WEEK+' THEN 2
          ELSE 1
        END DESC
    `, [GUILD_ID]);
    console.table(seniority);

    // 8. Vérifier si onPlayerActivity est appelé
    console.log('\n🔍 8. Joueurs créés il y a plus de 7 jours sans badge SENIORITY_WEEK:');
    const missingSeniority = await db.queryAll(`
      SELECT p.id, p.username,
             EXTRACT(DAY FROM NOW() - p.created_at)::integer as days_old,
             p.created_at::date as joined
      FROM players p
      LEFT JOIN player_badges pb ON pb.player_id = p.id AND pb.guild_id = p.guild_id
        AND pb.badge_id = (SELECT id FROM badges WHERE code = 'SENIORITY_WEEK')
      WHERE p.guild_id = $1
        AND EXTRACT(DAY FROM NOW() - p.created_at) >= 7
        AND pb.id IS NULL
      ORDER BY p.created_at
      LIMIT 10
    `, [GUILD_ID]);
    console.table(missingSeniority);

    console.log('\n' + '='.repeat(70));
    console.log('✅ Diagnostic terminé');

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }

  process.exit(0);
}

diagnose();
