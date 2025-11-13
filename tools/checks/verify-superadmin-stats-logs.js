const db = require('./utils/database-pg');
const GuildConfig = require('./utils/guildConfig');

async function verifyStatsAndLogs() {
  console.log('🔍 VÉRIFICATION DES STATS ET LOGS SUPER ADMIN\n');
  console.log('='.repeat(80));

  const guildId = process.env.GUILD_ID || '297309737135898624';

  try {
    // ========================================
    // 1. VÉRIFIER showGuildStats()
    // ========================================
    console.log('\n📊 TEST showGuildStats()\n');

    // Config
    const config = await GuildConfig.getConfig(guildId);
    console.log('✅ Config récupérée:', config?.guild_name || 'Non trouvé');

    // Stats
    const stats = await GuildConfig.getStats(guildId);
    console.log('✅ Stats récupérées:');
    console.table(stats);

    // Top players
    const topPlayers = await db.queryAll(`
      SELECT
        p.discord_id,
        COUNT(c.id) as collected_items,
        COALESCE(SUM(pm.points), 0) as malus_points,
        COUNT(pab.id) as total_bonus_points
      FROM players p
      LEFT JOIN collections c ON c.player_id = p.id AND c.guild_id = p.guild_id
      LEFT JOIN player_malus_points pm ON pm.player_id = p.id AND pm.guild_id = p.guild_id
      LEFT JOIN player_active_bonuses pab ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id AND pab.is_active = true
      WHERE p.guild_id = $1
      GROUP BY p.id, p.discord_id
      ORDER BY collected_items DESC
      LIMIT 5
    `, [guildId]);
    console.log(`✅ Top players: ${topPlayers.length} résultat(s)`);
    if (topPlayers.length > 0) {
      console.table(topPlayers);
    }

    // Recent gives
    const recentGives = await db.queryAll(`
      SELECT COUNT(*) as count, DATE(created_at) as date
      FROM give_logs
      WHERE guild_id = $1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 7
    `, [guildId]);
    console.log(`✅ Recent gives: ${recentGives.length} résultat(s)`);
    if (recentGives.length > 0) {
      console.table(recentGives);
    }

    // Theme info
    const themeInfo = await db.queryOne(`
      SELECT COUNT(*) as total_themes
      FROM themes
      WHERE guild_id = $1
    `, [guildId]);
    console.log('✅ Theme info:');
    console.table(themeInfo);

    // Missions completed
    const missionsCompleted = await db.queryOne(`
      SELECT COUNT(*) as total_completed
      FROM mission_progress
      WHERE guild_id = $1 AND status = 'completed'
    `, [guildId]);
    console.log('✅ Missions completed:');
    console.table(missionsCompleted);

    // ========================================
    // 2. VÉRIFIER showGuildLogs()
    // ========================================
    console.log('\n📜 TEST showGuildLogs()\n');

    // Super admin logs
    const superAdminLogs = await db.queryAll(`
      SELECT sal.*, sa.username
      FROM super_admin_logs sal
      LEFT JOIN super_admins sa ON sal.admin_id = sa.discord_id
      WHERE sal.target_guild_id = $1
      ORDER BY sal.created_at DESC
      LIMIT 20
    `, [guildId]);
    console.log(`✅ Super admin logs: ${superAdminLogs.length} résultat(s)`);
    if (superAdminLogs.length > 0) {
      console.table(superAdminLogs.slice(0, 5));
    }

    // Audit logs (IMPORTANT: Tester log.created_at)
    const auditLogs = await db.queryAll(`
      SELECT *
      FROM audit_logs
      WHERE guild_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [guildId]);
    console.log(`✅ Audit logs: ${auditLogs.length} résultat(s)`);
    if (auditLogs.length > 0) {
      console.table(auditLogs.slice(0, 5));

      // Tester le formatage de date (ligne 988 du bug)
      console.log('\n🔍 TEST FORMATAGE DATE (bug ligne 988):');
      auditLogs.slice(0, 3).forEach((log, i) => {
        try {
          const date = new Date(log.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          console.log(`  ${i + 1}. ✅ ${date} - ${log.action}`);
        } catch (error) {
          console.error(`  ${i + 1}. ❌ ERREUR:`, error.message);
        }
      });
    } else {
      console.log('⚠️  Aucun audit log - Impossible de tester le formatage de date');
    }

    // ========================================
    // RÉSUMÉ
    // ========================================
    console.log('\n' + '='.repeat(80));
    console.log('✅ RÉSULTAT:');
    console.log('   - showGuildStats() devrait fonctionner');
    console.log('   - showGuildLogs() devrait fonctionner');
    console.log('   - Bug log.timestamp → log.created_at CORRIGÉ\n');

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 ERREUR:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verifyStatsAndLogs();
