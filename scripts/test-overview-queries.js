/**
 * Test des requêtes SQL pour l'Overview Dashboard
 */
require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624';

async function testOverviewQueries() {
  console.log('=== TEST REQUÊTES OVERVIEW ===');
  console.log('Guild:', GUILD_ID);

  try {
    // 1. Thème actif
    console.log('\n--- 1. Thème actif ---');
    const theme = await db.queryOne(
      'SELECT id, name, required_items FROM themes WHERE guild_id = $1 AND is_active = true',
      [GUILD_ID]
    );
    console.log('Résultat:', theme);

    const requiredItems = theme?.required_items || 0;
    const themeId = theme?.id;

    // 2. Joueurs
    console.log('\n--- 2. Joueurs ---');
    const players = await db.queryOne(
      'SELECT COUNT(*) as count FROM players WHERE guild_id = $1',
      [GUILD_ID]
    );
    console.log('Total:', players?.count);

    // 3. Collections
    console.log('\n--- 3. Collections ---');
    const cols = await db.queryOne(
      'SELECT COUNT(*) as count FROM collections WHERE guild_id = $1 AND lost_at IS NULL',
      [GUILD_ID]
    );
    console.log('Total:', cols?.count);

    // 4. Campagnes actives
    console.log('\n--- 4. Campagnes ---');
    const camps = await db.queryOne(
      "SELECT COUNT(*) as count FROM give_campaigns WHERE guild_id = $1 AND status = 'active'",
      [GUILD_ID]
    );
    console.log('Actives:', camps?.count);

    // 5. Joueurs avec collection complète
    console.log('\n--- 5. Joueurs complets ---');
    if (requiredItems > 0) {
      const completed = await db.queryOne(`
        SELECT COUNT(*) as count FROM (
          SELECT p.id
          FROM players p
          JOIN collections c ON c.player_id = p.id AND c.guild_id = p.guild_id AND c.lost_at IS NULL
          WHERE p.guild_id = $1
          GROUP BY p.id
          HAVING COUNT(c.id) >= $2
        ) as completed_players
      `, [GUILD_ID, requiredItems]);
      console.log(`Joueurs avec >= ${requiredItems} items:`, completed?.count);
    } else {
      console.log('Pas de thème actif - skip');
    }

    // 6. Nouveaux joueurs aujourd'hui
    console.log('\n--- 6. Nouveaux aujourd\'hui ---');
    const newToday = await db.queryOne(
      'SELECT COUNT(*) as count FROM players WHERE guild_id = $1 AND created_at >= CURRENT_DATE',
      [GUILD_ID]
    );
    console.log('Nouveaux:', newToday?.count);

    // 7. Top joueurs
    console.log('\n--- 7. Top 5 joueurs ---');
    const topPlayers = await db.queryAll(`
      SELECT p.username, p.discord_id, COUNT(c.id) as collected_count
      FROM players p
      LEFT JOIN collections c ON c.player_id = p.id AND c.guild_id = p.guild_id AND c.lost_at IS NULL
      WHERE p.guild_id = $1
      GROUP BY p.id
      ORDER BY collected_count DESC
      LIMIT 5
    `, [GUILD_ID]);
    console.table(topPlayers);

    // 8. Stats du thème actif
    if (themeId) {
      console.log('\n--- 8. Stats thème actif ---');
      const [collectibles, traps, missions] = await Promise.all([
        db.queryOne('SELECT COUNT(*) as count FROM collectibles WHERE guild_id = $1 AND theme_id = $2', [GUILD_ID, themeId]),
        db.queryOne('SELECT COUNT(*) as count FROM traps WHERE guild_id = $1 AND theme_id = $2', [GUILD_ID, themeId]),
        db.queryOne('SELECT COUNT(*) as count FROM missions WHERE guild_id = $1 AND theme_id = $2', [GUILD_ID, themeId])
      ]);
      console.log('Collectibles:', collectibles?.count);
      console.log('Pièges:', traps?.count);
      console.log('Missions:', missions?.count);
    }

    // 9. Activité récente (give_logs)
    console.log('\n--- 9. Activité récente (give_logs) ---');
    const logs = await db.queryAll(`
      SELECT gl.id, gl.give_type, gl.created_at, gl.winner_username, c.name as item_name
      FROM give_logs gl
      LEFT JOIN collectibles c ON c.id = gl.item_id AND c.guild_id = gl.guild_id
      WHERE gl.guild_id = $1
      ORDER BY gl.created_at DESC
      LIMIT 5
    `, [GUILD_ID]);
    console.table(logs);

    console.log('\n✅ Toutes les requêtes OK!');
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

testOverviewQueries();
