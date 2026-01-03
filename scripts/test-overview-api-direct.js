/**
 * Test direct de l'API Overview - simule exactement la même logique que routes/guild.js
 * Pour diagnostiquer pourquoi les stats sont à 0 dans le dashboard
 */
require('dotenv').config();
const db = require('../utils/database-pg');

// Guild de test confirmée avec thème testv4
const GUILD_ID = '297309737135898624';

async function testOverviewAPI() {
  console.log('='.repeat(80));
  console.log('🔍 TEST DIRECT API OVERVIEW');
  console.log('='.repeat(80));
  console.log('Guild ID:', GUILD_ID);
  console.log('');

  try {
    // 1. D'abord récupérer le thème actif pour avoir required_items
    console.log('📋 Étape 1: Récupération thème actif...');
    const activeTheme = await db.queryOne(`
      SELECT id, name, required_items, created_at
      FROM themes
      WHERE guild_id = $1 AND is_active = true
    `, [GUILD_ID]);

    console.log('   Résultat:', activeTheme);

    const requiredItems = activeTheme?.required_items || 0;
    const activeThemeId = activeTheme?.id;

    console.log('   requiredItems:', requiredItems);
    console.log('   activeThemeId:', activeThemeId);
    console.log('');

    // 2. Exécuter toutes les autres requêtes en parallèle
    console.log('📋 Étape 2: Requêtes parallèles...');
    const [
      playersCount,
      collectionsCount,
      activeCampaigns,
      badgesCount,
      adminRolesCount,
      completedPlayersCount,
      newPlayersToday,
      collectiblesCount,
      trapsCount,
      missionsCount,
      topPlayers,
      recentActivityRaw
    ] = await Promise.all([
      // Nombre de joueurs
      db.queryOne('SELECT COUNT(*) FROM players WHERE guild_id = $1', [GUILD_ID]),

      // Nombre de collectibles détenus
      db.queryOne('SELECT COUNT(*) FROM collections WHERE guild_id = $1 AND lost_at IS NULL', [GUILD_ID]),

      // Campagnes actives
      db.queryOne('SELECT COUNT(*) FROM give_campaigns WHERE guild_id = $1 AND status = $2', [GUILD_ID, 'active']),

      // Total badges
      db.queryOne('SELECT COUNT(*) FROM badges', []),

      // Rôles admin
      db.queryOne('SELECT COUNT(*) FROM guild_admin_roles WHERE guild_id = $1', [GUILD_ID]),

      // Joueurs avec collection complète (>= required_items)
      requiredItems > 0
        ? db.queryOne(`
            SELECT COUNT(*) as count FROM (
              SELECT p.id
              FROM players p
              JOIN collections c ON c.player_id = p.id AND c.guild_id = p.guild_id AND c.lost_at IS NULL
              WHERE p.guild_id = $1
              GROUP BY p.id
              HAVING COUNT(c.id) >= $2
            ) as completed_players
          `, [GUILD_ID, requiredItems])
        : Promise.resolve({ count: 0 }),

      // Nouveaux joueurs aujourd'hui
      db.queryOne(`
        SELECT COUNT(*) FROM players
        WHERE guild_id = $1 AND created_at >= CURRENT_DATE
      `, [GUILD_ID]),

      // Nombre de collectibles du thème actif
      activeThemeId
        ? db.queryOne('SELECT COUNT(*) FROM collectibles WHERE guild_id = $1 AND theme_id = $2', [GUILD_ID, activeThemeId])
        : Promise.resolve({ count: 0 }),

      // Nombre de pièges du thème actif
      activeThemeId
        ? db.queryOne('SELECT COUNT(*) FROM traps WHERE guild_id = $1 AND theme_id = $2', [GUILD_ID, activeThemeId])
        : Promise.resolve({ count: 0 }),

      // Nombre de missions du thème actif
      activeThemeId
        ? db.queryOne('SELECT COUNT(*) FROM missions WHERE guild_id = $1 AND theme_id = $2', [GUILD_ID, activeThemeId])
        : Promise.resolve({ count: 0 }),

      // Top 5 joueurs
      db.queryAll(`
        SELECT p.username, p.discord_id, COUNT(c.id) as collected_count
        FROM players p
        LEFT JOIN collections c ON c.player_id = p.id AND c.guild_id = p.guild_id AND c.lost_at IS NULL
        WHERE p.guild_id = $1
        GROUP BY p.id
        ORDER BY collected_count DESC
        LIMIT 5
      `, [GUILD_ID]),

      // Activité récente
      db.queryAll(`
        SELECT gl.id, gl.give_type, gl.created_at, gl.winner_username,
               c.name as item_name
        FROM give_logs gl
        LEFT JOIN collectibles c ON c.id = gl.item_id AND c.guild_id = gl.guild_id
        WHERE gl.guild_id = $1
        ORDER BY gl.created_at DESC
        LIMIT 10
      `, [GUILD_ID])
    ]);

    // 3. Afficher les résultats bruts
    console.log('');
    console.log('📊 RÉSULTATS BRUTS DES REQUÊTES:');
    console.log('-'.repeat(40));
    console.log('   playersCount:', playersCount);
    console.log('   collectionsCount:', collectionsCount);
    console.log('   activeCampaigns:', activeCampaigns);
    console.log('   badgesCount:', badgesCount);
    console.log('   adminRolesCount:', adminRolesCount);
    console.log('   completedPlayersCount:', completedPlayersCount);
    console.log('   newPlayersToday:', newPlayersToday);
    console.log('   collectiblesCount:', collectiblesCount);
    console.log('   trapsCount:', trapsCount);
    console.log('   missionsCount:', missionsCount);
    console.log('');

    // 4. Transformer comme dans l'API
    const recentActivity = (recentActivityRaw || []).map(activity => ({
      id: activity.id,
      type: activity.give_type || 'collectible',
      description: activity.winner_username
        ? `${activity.winner_username} a obtenu ${activity.item_name || 'un item'}`
        : activity.item_name || activity.give_type,
      created_at: activity.created_at
    }));

    const themeData = activeTheme ? {
      name: activeTheme.name,
      required_items: requiredItems,
      collectibles: new Array(parseInt(collectiblesCount?.count) || 0),
      traps: new Array(parseInt(trapsCount?.count) || 0),
      missions: new Array(parseInt(missionsCount?.count) || 0)
    } : null;

    const responseData = {
      success: true,
      stats: {
        totalPlayers: parseInt(playersCount?.count) || 0,
        totalCollections: parseInt(collectionsCount?.count) || 0,
        activeCampaigns: parseInt(activeCampaigns?.count) || 0,
        totalBadges: parseInt(badgesCount?.count) || 0,
        adminRolesCount: parseInt(adminRolesCount?.count) || 0,
        completedPlayers: parseInt(completedPlayersCount?.count) || 0,
        requiredItems: requiredItems,
        newPlayersToday: parseInt(newPlayersToday?.count) || 0
      },
      topPlayers: topPlayers || [],
      recentActivity: recentActivity,
      themeData: themeData
    };

    // 5. Afficher la réponse finale
    console.log('');
    console.log('📦 RÉPONSE API SIMULÉE:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(responseData, null, 2));
    console.log('='.repeat(80));

    // 6. Vérifier les valeurs
    console.log('');
    console.log('✅ VÉRIFICATION:');
    console.log('-'.repeat(40));
    console.log('   totalPlayers:', responseData.stats.totalPlayers, responseData.stats.totalPlayers > 0 ? '✅' : '❌');
    console.log('   totalCollections:', responseData.stats.totalCollections, responseData.stats.totalCollections > 0 ? '✅' : '❌');
    console.log('   completedPlayers:', responseData.stats.completedPlayers);
    console.log('   requiredItems:', responseData.stats.requiredItems);
    console.log('   themeData.name:', responseData.themeData?.name || 'null');
    console.log('   themeData.collectibles.length:', responseData.themeData?.collectibles?.length || 0);
    console.log('   topPlayers.length:', responseData.topPlayers.length);
    console.log('   recentActivity.length:', responseData.recentActivity.length);

    // 7. Comparer avec les attendus
    console.log('');
    console.log('📋 COMPARAISON AVEC ATTENDUS:');
    console.log('-'.repeat(40));
    console.log('   totalPlayers: attendu=3, obtenu=', responseData.stats.totalPlayers);
    console.log('   totalCollections: attendu=4, obtenu=', responseData.stats.totalCollections);
    console.log('   completedPlayers: attendu=1, obtenu=', responseData.stats.completedPlayers);
    console.log('   theme: attendu=testv4, obtenu=', responseData.themeData?.name);
    console.log('   collectibles: attendu=4, obtenu=', responseData.themeData?.collectibles?.length);
    console.log('   traps: attendu=5, obtenu=', responseData.themeData?.traps?.length);
    console.log('   missions: attendu=3, obtenu=', responseData.themeData?.missions?.length);

  } catch (error) {
    console.error('❌ ERREUR:', error);
    console.error(error.stack);
  }

  process.exit(0);
}

testOverviewAPI();
