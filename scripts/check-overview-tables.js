/**
 * Check database tables structure for Overview Dashboard
 */
require('dotenv').config();
const db = require('../utils/database-pg');

async function checkTables() {
  console.log('=== STRUCTURE DES TABLES POUR OVERVIEW ===\n');

  const tables = ['mission_progress', 'trap_triggered', 'player_active_bonuses', 'players', 'collections', 'give_logs'];

  for (const table of tables) {
    console.log(`\n📋 TABLE: ${table}`);
    console.log('-'.repeat(50));

    try {
      const cols = await db.queryAll(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      if (cols.length > 0) {
        console.table(cols);
      } else {
        console.log('Table non trouvée ou vide');
      }
    } catch (error) {
      console.error('Erreur:', error.message);
    }
  }

  // Test des données existantes
  console.log('\n\n=== DONNÉES TEST (Guild 297309737135898624) ===\n');
  const guildId = '297309737135898624';

  // Missions en cours
  const missions = await db.queryOne(`
    SELECT COUNT(*) as count FROM mission_progress
    WHERE guild_id = $1 AND status = 'in_progress'
  `, [guildId]);
  console.log('Missions en cours:', missions?.count || 0);

  // Pièges déclenchés (7 derniers jours)
  const traps = await db.queryOne(`
    SELECT COUNT(*) as count FROM trap_triggered
    WHERE guild_id = $1 AND triggered_at >= NOW() - INTERVAL '7 days'
  `, [guildId]);
  console.log('Pièges récents (7j):', traps?.count || 0);

  // Bonus actifs
  const bonuses = await db.queryOne(`
    SELECT COUNT(*) as count FROM player_active_bonuses
    WHERE guild_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
  `, [guildId]);
  console.log('Bonus actifs:', bonuses?.count || 0);

  // Tendance 7 jours - nouveaux joueurs
  const trend = await db.queryAll(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM players
    WHERE guild_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [guildId]);
  console.log('\nTendance joueurs (7j):');
  console.table(trend);

  // Tendance 7 jours - items collectés
  const itemsTrend = await db.queryAll(`
    SELECT DATE(collected_at) as date, COUNT(*) as count
    FROM collections
    WHERE guild_id = $1 AND collected_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(collected_at)
    ORDER BY date
  `, [guildId]);
  console.log('\nTendance items (7j):');
  console.table(itemsTrend);

  process.exit(0);
}

checkTables();
