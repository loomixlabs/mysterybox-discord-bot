const db = require('../utils/database-pg');

// Serveur de test
const GUILD_ID = '1182395170273099806';

async function auditStreakSystem() {
  try {
    console.log('='.repeat(80));
    console.log('🔍 AUDIT SYSTÈME DE STREAK');
    console.log('='.repeat(80));
    console.log(`Date système: ${new Date().toISOString()}`);
    console.log(`Today (split): ${new Date().toISOString().split('T')[0]}`);
    console.log('');

    // 1. Vérifier la structure de la table players
    console.log('\n📊 STRUCTURE TABLE PLAYERS (colonnes streak)');
    console.log('-'.repeat(40));

    const columns = await db.queryAll(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'players'
      AND column_name IN ('current_login_streak', 'last_login_date', 'best_login_streak')
      ORDER BY column_name
    `);

    console.table(columns);

    // 2. Récupérer tous les joueurs avec leur streak
    console.log('\n📊 TOUS LES JOUEURS AVEC STREAK');
    console.log('-'.repeat(40));

    const players = await db.queryAll(`
      SELECT
        id,
        username,
        current_login_streak,
        last_login_date,
        best_login_streak,
        updated_at
      FROM players
      WHERE guild_id = $1
      ORDER BY current_login_streak DESC NULLS LAST
    `, [GUILD_ID]);

    console.table(players.map(p => ({
      id: p.id,
      username: p.username?.substring(0, 15) || 'N/A',
      streak: p.current_login_streak,
      last_login: p.last_login_date,
      best: p.best_login_streak,
      updated: p.updated_at?.toISOString?.()?.split('T')[0] || 'N/A'
    })));

    // 3. Vérifier l'historique des logins
    console.log('\n📊 TABLE player_login_history');
    console.log('-'.repeat(40));

    // Vérifier si la table existe
    const tableExists = await db.queryOne(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'player_login_history'
      ) as exists
    `);

    if (!tableExists?.exists) {
      console.log('❌ Table player_login_history n\'existe pas !');
    } else {
      const loginHistory = await db.queryAll(`
        SELECT
          plh.player_id,
          p.username,
          plh.login_date,
          plh.created_at
        FROM player_login_history plh
        JOIN players p ON plh.player_id = p.id
        WHERE plh.guild_id = $1
        ORDER BY plh.login_date DESC
        LIMIT 30
      `, [GUILD_ID]);

      console.table(loginHistory.map(l => ({
        player_id: l.player_id,
        username: l.username?.substring(0, 15) || 'N/A',
        login_date: l.login_date,
        created_at: l.created_at?.toISOString?.() || 'N/A'
      })));
    }

    // 4. Tester le calcul de diffDays
    console.log('\n📊 TEST CALCUL diffDays');
    console.log('-'.repeat(40));

    const today = new Date().toISOString().split('T')[0];
    const todayDate = new Date(today);

    // Simuler hier
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Calcul comme dans recordLogin
    const lastLogin = new Date(yesterdayStr);
    const diffTime = todayDate - lastLogin;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    console.log(`Today string: ${today}`);
    console.log(`Yesterday string: ${yesterdayStr}`);
    console.log(`todayDate: ${todayDate.toISOString()}`);
    console.log(`lastLogin: ${lastLogin.toISOString()}`);
    console.log(`diffTime (ms): ${diffTime}`);
    console.log(`diffDays: ${diffDays}`);

    if (diffDays === 1) {
      console.log('✅ Calcul correct - jour consécutif détecté');
    } else {
      console.log(`❌ Calcul incorrect - diffDays devrait être 1, pas ${diffDays}`);
    }

    // 5. Vérifier les joueurs qui sont bloqués à 2
    console.log('\n📊 JOUEURS BLOQUÉS À 2 JOURS');
    console.log('-'.repeat(40));

    const stuckPlayers = await db.queryAll(`
      SELECT
        id,
        username,
        current_login_streak,
        last_login_date,
        best_login_streak
      FROM players
      WHERE guild_id = $1
      AND current_login_streak = 2
    `, [GUILD_ID]);

    for (const p of stuckPlayers) {
      console.log(`\n👤 ${p.username} (ID: ${p.id})`);
      console.log(`   Streak: ${p.current_login_streak}`);
      console.log(`   Last Login: ${p.last_login_date}`);
      console.log(`   Best: ${p.best_login_streak}`);

      // Calculer si ce joueur devrait avoir un streak plus élevé
      if (p.last_login_date) {
        const playerLastLogin = new Date(p.last_login_date);
        const playerDiffTime = todayDate - playerLastLogin;
        const playerDiffDays = Math.floor(playerDiffTime / (1000 * 60 * 60 * 24));
        console.log(`   Jours depuis dernier login: ${playerDiffDays}`);

        // Vérifier l'historique complet
        const playerHistory = await db.queryAll(`
          SELECT login_date
          FROM player_login_history
          WHERE guild_id = $1 AND player_id = $2
          ORDER BY login_date DESC
          LIMIT 10
        `, [GUILD_ID, p.id]);

        console.log(`   Historique logins: ${playerHistory.map(h => h.login_date).join(', ')}`);
      }
    }

    // 6. Vérifier les badges Engagement
    console.log('\n📊 BADGES ENGAGEMENT');
    console.log('-'.repeat(40));

    const engagementBadges = await db.queryAll(`
      SELECT id, code, name, emoji, condition_value
      FROM badges
      WHERE category = 'engagement'
      ORDER BY condition_value
    `);

    console.table(engagementBadges);

    // 7. Vérifier les progressions de badges Engagement
    console.log('\n📊 PROGRESSIONS BADGES ENGAGEMENT');
    console.log('-'.repeat(40));

    const badgeProgress = await db.queryAll(`
      SELECT
        pb.player_id,
        p.username,
        b.code,
        pb.current_progress,
        pb.is_unlocked
      FROM player_badges pb
      JOIN players p ON pb.player_id = p.id AND pb.guild_id = p.guild_id
      JOIN badges b ON pb.badge_id = b.id
      WHERE pb.guild_id = $1
      AND b.category = 'engagement'
      ORDER BY p.username, b.condition_value
    `, [GUILD_ID]);

    console.table(badgeProgress.map(bp => ({
      username: bp.username?.substring(0, 15) || 'N/A',
      badge: bp.code,
      progress: bp.current_progress,
      unlocked: bp.is_unlocked
    })));

    console.log('\n✅ Audit terminé');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

auditStreakSystem();
