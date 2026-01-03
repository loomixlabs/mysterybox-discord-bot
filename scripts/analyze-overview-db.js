/**
 * Analyse DB pour le dashboard Overview
 * Vérifie toutes les données nécessaires
 */

require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1315712707839498375'; // Test server

async function analyzeOverviewData() {
  console.log('🔍 ANALYSE DB POUR OVERVIEW DASHBOARD\n');
  console.log('='.repeat(80));
  console.log('Guild ID:', GUILD_ID);

  try {
    // 1. Thème actif
    console.log('\n📋 1. THÈME ACTIF');
    console.log('-'.repeat(40));
    const theme = await db.queryOne(
      'SELECT id, name, required_items, is_active FROM themes WHERE guild_id = $1 AND is_active = true',
      [GUILD_ID]
    );
    console.log('Résultat:', theme || 'AUCUN THÈME ACTIF');

    // 2. Nombre de joueurs
    console.log('\n📋 2. JOUEURS');
    console.log('-'.repeat(40));
    const players = await db.queryOne(
      'SELECT COUNT(*) as count FROM players WHERE guild_id = $1',
      [GUILD_ID]
    );
    console.log('Total joueurs:', players?.count || 0);

    // 3. Collections (items collectés non perdus)
    console.log('\n📋 3. COLLECTIONS');
    console.log('-'.repeat(40));
    const collections = await db.queryOne(
      'SELECT COUNT(*) as count FROM collections WHERE guild_id = $1 AND lost_at IS NULL',
      [GUILD_ID]
    );
    console.log('Items collectés (non perdus):', collections?.count || 0);

    // 4. Campagnes actives
    console.log('\n📋 4. CAMPAGNES ACTIVES');
    console.log('-'.repeat(40));
    const campaigns = await db.queryOne(
      "SELECT COUNT(*) as count FROM give_campaigns WHERE guild_id = $1 AND status = 'active'",
      [GUILD_ID]
    );
    console.log('Campagnes actives:', campaigns?.count || 0);

    // 5. Joueurs avec collection complète
    console.log('\n📋 5. COLLECTIONS COMPLÈTES');
    console.log('-'.repeat(40));
    if (theme?.required_items) {
      const completedQuery = `
        SELECT COUNT(*) as count FROM (
          SELECT p.id
          FROM players p
          JOIN collections c ON c.player_id = p.id AND c.guild_id = p.guild_id AND c.lost_at IS NULL
          WHERE p.guild_id = $1
          GROUP BY p.id
          HAVING COUNT(c.id) >= $2
        ) as completed_players
      `;
      const completed = await db.queryOne(completedQuery, [GUILD_ID, theme.required_items]);
      console.log(`Joueurs complétés (>= ${theme.required_items} items):`, completed?.count || 0);
    } else {
      console.log('Pas de thème actif - impossible de calculer');
    }

    // 6. Nouveaux joueurs aujourd'hui
    console.log('\n📋 6. NOUVEAUX JOUEURS AUJOURD\'HUI');
    console.log('-'.repeat(40));
    const newToday = await db.queryOne(
      'SELECT COUNT(*) as count FROM players WHERE guild_id = $1 AND created_at >= CURRENT_DATE',
      [GUILD_ID]
    );
    console.log('Nouveaux aujourd\'hui:', newToday?.count || 0);

    // 7. Top joueurs
    console.log('\n📋 7. TOP 5 JOUEURS');
    console.log('-'.repeat(40));
    const topPlayers = await db.queryAll(`
      SELECT p.id, p.username, p.discord_id, COUNT(c.id) as collected_count
      FROM players p
      LEFT JOIN collections c ON c.player_id = p.id AND c.guild_id = p.guild_id AND c.lost_at IS NULL
      WHERE p.guild_id = $1
      GROUP BY p.id, p.username, p.discord_id
      ORDER BY collected_count DESC
      LIMIT 5
    `, [GUILD_ID]);
    if (topPlayers.length > 0) {
      console.table(topPlayers);
    } else {
      console.log('Aucun joueur trouvé');
    }

    // 8. Structure give_logs
    console.log('\n📋 8. STRUCTURE TABLE give_logs');
    console.log('-'.repeat(40));
    const logsCols = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'give_logs'
      ORDER BY ordinal_position
    `);
    console.table(logsCols);

    // 9. Activité récente
    console.log('\n📋 9. ACTIVITÉ RÉCENTE (give_logs)');
    console.log('-'.repeat(40));
    const recentLogs = await db.queryAll(`
      SELECT id, action_type, details, created_at
      FROM give_logs
      WHERE guild_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [GUILD_ID]);
    if (recentLogs.length > 0) {
      console.table(recentLogs);
    } else {
      console.log('Aucun log trouvé');
    }

    // 10. Stats du thème actif
    if (theme?.id) {
      console.log('\n📋 10. STATS THÈME ACTIF (ID: ' + theme.id + ')');
      console.log('-'.repeat(40));

      const collectibles = await db.queryOne(
        'SELECT COUNT(*) as count FROM collectibles WHERE guild_id = $1 AND theme_id = $2',
        [GUILD_ID, theme.id]
      );
      console.log('Collectibles:', collectibles?.count || 0);

      const traps = await db.queryOne(
        'SELECT COUNT(*) as count FROM traps WHERE guild_id = $1 AND theme_id = $2',
        [GUILD_ID, theme.id]
      );
      console.log('Pièges:', traps?.count || 0);

      const missions = await db.queryOne(
        'SELECT COUNT(*) as count FROM missions WHERE guild_id = $1 AND theme_id = $2',
        [GUILD_ID, theme.id]
      );
      console.log('Missions:', missions?.count || 0);
    }

    // 11. Vérifier badges
    console.log('\n📋 11. BADGES');
    console.log('-'.repeat(40));
    const badges = await db.queryOne(
      'SELECT COUNT(*) as count FROM badges WHERE guild_id = $1',
      [GUILD_ID]
    );
    console.log('Badges:', badges?.count || 0);

    // 12. Admin roles
    console.log('\n📋 12. ADMIN ROLES');
    console.log('-'.repeat(40));
    const adminRoles = await db.queryOne(
      'SELECT COUNT(*) as count FROM guild_admin_roles WHERE guild_id = $1',
      [GUILD_ID]
    );
    console.log('Admin roles:', adminRoles?.count || 0);

    console.log('\n' + '='.repeat(80));
    console.log('✅ ANALYSE TERMINÉE');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

analyzeOverviewData();
