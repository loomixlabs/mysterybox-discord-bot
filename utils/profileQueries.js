const db = require('./database-pg');

/**
 * 🔄 Normaliser le nom de rareté (accepte français et anglais)
 * @param {string} rarity - Rareté brute
 * @returns {string} Rareté normalisée en français
 */
function normalizeRarity(rarity) {
  if (!rarity) return 'Commun';

  const lower = rarity.toLowerCase();

  if (lower === 'legendary' || lower === 'légendaire') return 'Légendaire';
  if (lower === 'epic' || lower === 'épique') return 'Épique';
  if (lower === 'rare') return 'Rare';
  if (lower === 'common' || lower === 'commun') return 'Commun';

  // Si déjà en français, retourner tel quel
  return rarity;
}

/**
 * 📜 Récupérer l'historique des activités groupées
 * @param {number} playerId - ID du joueur
 * @param {string} guildId - ID du serveur
 * @param {number} themeId - ID du thème
 * @param {number} limit - Nombre max d'activités
 * @returns {Array} Liste des activités avec détails
 */
async function getActivityTimeline(playerId, guildId, themeId, limit = 20) {
  try {
    // Récupérer TOUS les événements : gains ET pertes comme événements distincts
    // Utiliser UNION ALL pour créer une ligne par événement
    // Inclut level, xp, mint_number pour le système d'évolution
    const timeline = await db.queryAll(`
      -- Événements de collecte
      SELECT
        col.id as collectible_id,
        col.name,
        col.rarity,
        col.image_url,
        col.theme_id,
        c.source,
        c.collected_at as event_date,
        c.level,
        c.xp,
        c.mint_number,
        'collected' as event_type
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1
        AND c.guild_id = $2
        AND col.theme_id = $3

      UNION ALL

      -- Événements de perte
      SELECT
        col.id as collectible_id,
        col.name,
        col.rarity,
        col.image_url,
        col.theme_id,
        c.source,
        c.lost_at as event_date,
        c.level,
        c.xp,
        c.mint_number,
        'lost' as event_type
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1
        AND c.guild_id = $2
        AND col.theme_id = $3
        AND c.lost_at IS NOT NULL

      ORDER BY event_date DESC
      LIMIT $4
    `, [playerId, guildId, themeId, limit]);

    // Normaliser les raretés
    return (timeline || []).map(item => ({
      ...item,
      rarity: normalizeRarity(item.rarity)
    }));
  } catch (error) {
    console.error('🔴 Erreur getActivityTimeline:', error);
    return [];
  }
}

/**
 * 📊 Récupérer les statistiques détaillées du joueur
 * @param {number} playerId - ID du joueur
 * @param {string} guildId - ID du serveur
 * @param {number} themeId - ID du thème
 * @returns {Object} Statistiques complètes
 */
async function getDetailedStats(playerId, guildId, themeId) {
  try {
    // Stats de collection par rareté
    const collectionStats = await db.queryAll(`
      SELECT
        col.rarity,
        COUNT(DISTINCT c.collectible_id) as count
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1
        AND c.guild_id = $2
        AND col.theme_id = $3
        AND c.lost_at IS NULL
      GROUP BY col.rarity
    `, [playerId, guildId, themeId]);

    // Stats de missions
    const missionStats = await db.queryOne(`
      SELECT
        COUNT(CASE WHEN mp.status = 'completed' THEN 1 END) as missions_completed,
        COUNT(CASE WHEN mp.status = 'failed' THEN 1 END) as missions_failed,
        COUNT(CASE WHEN mp.status = 'approved' THEN 1 END) as missions_approved,
        COUNT(CASE WHEN mp.status = 'rejected' THEN 1 END) as missions_rejected
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.player_id = $1
        AND mp.guild_id = $2
        AND m.theme_id = $3
    `, [playerId, guildId, themeId]);

    // Stats de pièges - Compter les pièges déclenchés
    const trapCount = await db.queryOne(`
      SELECT COUNT(*) as traps_triggered
      FROM trap_triggered tt
      JOIN traps t ON tt.trap_id = t.id
      WHERE tt.player_id = $1
        AND tt.guild_id = $2
        AND t.theme_id = $3
    `, [playerId, guildId, themeId]);

    // Stats de malus - Depuis player_malus_points
    const malusPoints = await db.queryOne(`
      SELECT COALESCE(points, 0) as total_malus
      FROM player_malus_points
      WHERE player_id = $1
        AND guild_id = $2
        AND theme_id = $3
    `, [playerId, guildId, themeId]);

    // Mystery boxes ouvertes (approximation via source)
    const mysteryBoxCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM collections
      WHERE player_id = $1
        AND guild_id = $2
        AND source = 'mystery_box'
        AND lost_at IS NULL
    `, [playerId, guildId]);

    // Total d'items collectés (incluant duplicatas)
    const totalCollected = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.player_id = $1
        AND c.guild_id = $2
        AND col.theme_id = $3
        AND c.lost_at IS NULL
    `, [playerId, guildId, themeId]);

    // Stats de pièges bloqués par le Bouclier Anti-Piège
    const trapsBlocked = await db.queryOne(`
      SELECT COALESCE(traps_blocked, 0) as traps_blocked
      FROM players
      WHERE id = $1
    `, [playerId]);

    // Compiler les stats
    const stats = {
      total_collected: parseInt(totalCollected?.count || 0),
      legendary_count: 0,
      epic_count: 0,
      rare_count: 0,
      common_count: 0,
      missions_completed: parseInt(missionStats?.missions_completed || 0),
      missions_failed: parseInt(missionStats?.missions_failed || 0),
      missions_approved: parseInt(missionStats?.missions_approved || 0),
      missions_rejected: parseInt(missionStats?.missions_rejected || 0),
      traps_triggered: parseInt(trapCount?.traps_triggered || 0),
      traps_blocked: parseInt(trapsBlocked?.traps_blocked || 0),
      total_malus: parseInt(malusPoints?.total_malus || 0),
      mystery_boxes_opened: parseInt(mysteryBoxCount?.count || 0)
    };

    // Mapper les raretés (accepter français ET anglais lowercase)
    collectionStats.forEach(stat => {
      const rarity = stat.rarity.toLowerCase();
      if (stat.rarity === 'Légendaire' || rarity === 'legendary' || rarity === 'légendaire') {
        stats.legendary_count = parseInt(stat.count);
      }
      if (stat.rarity === 'Épique' || rarity === 'epic' || rarity === 'épique') {
        stats.epic_count = parseInt(stat.count);
      }
      if (stat.rarity === 'Rare' || rarity === 'rare') {
        stats.rare_count = parseInt(stat.count);
      }
      if (stat.rarity === 'Commun' || rarity === 'common' || rarity === 'commun') {
        stats.common_count = parseInt(stat.count);
      }
    });

    return stats;

  } catch (error) {
    console.error('🔴 Erreur getDetailedStats:', error);
    return {
      total_collected: 0,
      legendary_count: 0,
      epic_count: 0,
      rare_count: 0,
      common_count: 0,
      missions_completed: 0,
      missions_failed: 0,
      missions_approved: 0,
      missions_rejected: 0,
      traps_triggered: 0,
      traps_blocked: 0,
      total_malus: 0,
      mystery_boxes_opened: 0
    };
  }
}

/**
 * 🎒 Récupérer l'inventaire groupé par rareté
 * @param {number} playerId - ID du joueur
 * @param {string} guildId - ID du serveur
 * @param {number} themeId - ID du thème
 * @returns {Object} Inventaire groupé par rareté
 */
async function getInventoryGrouped(playerId, guildId, themeId) {
  try {
    // Récupérer TOUS les collectibles du thème avec indicateur si le joueur les a
    // Inclut level, xp, mint_number pour le système d'évolution
    const inventory = await db.queryAll(`
      SELECT
        col.id,
        col.name,
        col.rarity,
        col.image_url,
        col.theme_id,
        c.collected_at,
        c.source,
        c.level,
        c.xp,
        c.mint_number,
        CASE WHEN c.id IS NOT NULL THEN TRUE ELSE FALSE END as collected
      FROM collectibles col
      LEFT JOIN LATERAL (
        SELECT id, collected_at, source, level, xp, mint_number
        FROM collections
        WHERE collectible_id = col.id
          AND player_id = $1
          AND guild_id = $2
          AND lost_at IS NULL
        ORDER BY collected_at DESC
        LIMIT 1
      ) c ON true
      WHERE col.theme_id = $3
      ORDER BY
        CASE col.rarity
          WHEN 'Légendaire' THEN 1
          WHEN 'Épique' THEN 2
          WHEN 'Rare' THEN 3
          WHEN 'Commun' THEN 4
        END,
        col.name
    `, [playerId, guildId, themeId]);

    // Grouper par rareté
    const grouped = {
      'Légendaire': [],
      'Épique': [],
      'Rare': [],
      'Commun': []
    };

    inventory.forEach(item => {
      // Normaliser la rareté pour le groupement
      const normalizedRarity = normalizeRarity(item.rarity);
      if (grouped[normalizedRarity]) {
        // Garder la rareté normalisée pour l'affichage
        item.rarity = normalizedRarity;
        grouped[normalizedRarity].push(item);
      }
    });

    return grouped;

  } catch (error) {
    console.error('🔴 Erreur getInventoryGrouped:', error);
    return {
      'Légendaire': [],
      'Épique': [],
      'Rare': [],
      'Commun': []
    };
  }
}

/**
 * 🌐 Récupérer les données de comparaison serveur
 * @param {number} playerId - ID du joueur
 * @param {string} guildId - ID du serveur
 * @returns {Object} Stats de comparaison
 */
async function getServerComparison(playerId, guildId) {
  try {
    // Total de joueurs sur le serveur
    const totalPlayers = await db.queryOne(`
      SELECT COUNT(DISTINCT id) as count
      FROM players
      WHERE guild_id = $1
    `, [guildId]);

    // Nombre de collections complètes du joueur
    const completedThemes = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM player_progress
      WHERE player_id = $1
        AND guild_id = $2
        AND is_completed = TRUE
    `, [playerId, guildId]);

    // Calculer le rang du joueur (basé sur le nombre total d'items collectés)
    const playerTotalItems = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM collections
      WHERE player_id = $1
        AND guild_id = $2
        AND lost_at IS NULL
    `, [playerId, guildId]);

    const playerCount = parseInt(playerTotalItems?.count || 0);

    // Nombre de joueurs avec plus d'items
    const playersAbove = await db.queryOne(`
      SELECT COUNT(DISTINCT player_id) as count
      FROM (
        SELECT player_id, COUNT(*) as item_count
        FROM collections
        WHERE guild_id = $1 AND lost_at IS NULL
        GROUP BY player_id
        HAVING COUNT(*) > $2
      ) AS subquery
    `, [guildId, playerCount]);

    const rank = parseInt(playersAbove?.count || 0) + 1;

    return {
      rank: rank,
      total_players: parseInt(totalPlayers?.count || 1),
      completed_themes: parseInt(completedThemes?.count || 0)
    };

  } catch (error) {
    console.error('🔴 Erreur getServerComparison:', error);
    return {
      rank: 0,
      total_players: 0,
      completed_themes: 0
    };
  }
}

/**
 * 🏆 Récupérer le top des joueurs
 * @param {string} guildId - ID du serveur
 * @param {number} themeId - ID du thème
 * @param {number} limit - Nombre de joueurs
 * @returns {Array} Top joueurs
 */
async function getTopPlayers(guildId, themeId, limit = 10) {
  try {
    const topPlayers = await db.queryAll(`
      SELECT
        p.discord_id,
        p.username,
        pp.collected_count,
        pp.is_completed,
        pp.completed_at
      FROM player_progress pp
      JOIN players p ON pp.player_id = p.id
      WHERE pp.guild_id = $1
        AND pp.theme_id = $2
      ORDER BY
        pp.is_completed DESC,
        pp.collected_count DESC,
        pp.completed_at ASC NULLS LAST
      LIMIT $3
    `, [guildId, themeId, limit]);

    return topPlayers || [];

  } catch (error) {
    console.error('🔴 Erreur getTopPlayers:', error);
    return [];
  }
}

/**
 * 🎯 Récupérer les missions du joueur
 * @param {number} playerId - ID du joueur
 * @param {string} guildId - ID du serveur
 * @param {number} themeId - ID du thème
 * @returns {Array} Liste des missions
 */
async function getPlayerMissions(playerId, guildId, themeId) {
  try {
    const missions = await db.queryAll(`
      SELECT
        m.type,
        m.question,
        mp.status,
        mp.created_at as started_at,
        mp.completed_at,
        mp.submitted_proof as answer
      FROM mission_progress mp
      JOIN missions m ON mp.mission_id = m.id
      WHERE mp.player_id = $1
        AND mp.guild_id = $2
        AND m.theme_id = $3
      ORDER BY mp.created_at DESC
    `, [playerId, guildId, themeId]);

    return missions || [];

  } catch (error) {
    console.error('🔴 Erreur getPlayerMissions:', error);
    return [];
  }
}

/**
 * 🎁 Récupérer les bonus actifs du joueur
 * @param {string} discordId - Discord ID du joueur
 * @param {string} guildId - ID du serveur
 * @returns {Array} Liste des bonus actifs
 */
async function getActiveBonuses(discordId, guildId) {
  try {
    const bonuses = await db.queryAll(`
      SELECT
        type,
        value,
        expires_at
      FROM player_active_bonuses
      WHERE user_id = $1
        AND guild_id = $2
        AND is_active = TRUE
        AND expires_at > NOW()
      ORDER BY expires_at ASC
    `, [discordId, guildId]);

    return bonuses || [];

  } catch (error) {
    console.error('🔴 Erreur getActiveBonuses:', error);
    return [];
  }
}

/**
 * ⏳ Récupérer les cooldowns actifs du joueur
 * @param {number} playerId - ID du joueur
 * @param {string} guildId - ID du serveur
 * @returns {Array} Liste des cooldowns actifs
 */
async function getActiveCooldowns(playerId, guildId) {
  try {
    const cooldowns = await db.queryAll(`
      SELECT
        type,
        expires_at
      FROM player_cooldowns
      WHERE player_id = $1
        AND guild_id = $2
        AND expires_at > NOW()
      ORDER BY expires_at ASC
    `, [playerId, guildId]);

    return cooldowns || [];

  } catch (error) {
    console.error('🔴 Erreur getActiveCooldowns:', error);
    return [];
  }
}

/**
 * 📈 Récupérer la progression globale du joueur
 * @param {number} playerId - ID du joueur
 * @param {string} guildId - ID du serveur
 * @returns {Object} Progression globale
 */
async function getGlobalProgress(playerId, guildId) {
  try {
    const progress = await db.queryAll(`
      SELECT
        t.name as theme_name,
        t.required_items,
        pp.collected_count,
        pp.is_completed,
        pp.completed_at
      FROM player_progress pp
      JOIN themes t ON pp.theme_id = t.id
      WHERE pp.player_id = $1
        AND pp.guild_id = $2
      ORDER BY t.created_at DESC
    `, [playerId, guildId]);

    return progress || [];

  } catch (error) {
    console.error('🔴 Erreur getGlobalProgress:', error);
    return [];
  }
}

/**
 * 🔍 Récupérer les collectibles manquants
 * @param {number} playerId - ID du joueur
 * @param {string} guildId - ID du serveur
 * @param {number} themeId - ID du thème
 * @returns {Array} Liste des collectibles manquants
 */
async function getMissingCollectibles(playerId, guildId, themeId) {
  try {
    const missing = await db.queryAll(`
      SELECT
        col.id,
        col.name,
        col.rarity,
        col.image_url
      FROM collectibles col
      WHERE col.theme_id = $3
        AND col.id NOT IN (
          SELECT DISTINCT collectible_id
          FROM collections
          WHERE player_id = $1
            AND guild_id = $2
            AND lost_at IS NULL
        )
      ORDER BY
        CASE col.rarity
          WHEN 'Légendaire' THEN 1
          WHEN 'Épique' THEN 2
          WHEN 'Rare' THEN 3
          WHEN 'Commun' THEN 4
        END,
        col.name
    `, [playerId, guildId, themeId]);

    return missing || [];

  } catch (error) {
    console.error('🔴 Erreur getMissingCollectibles:', error);
    return [];
  }
}

module.exports = {
  getActivityTimeline,
  getDetailedStats,
  getInventoryGrouped,
  getServerComparison,
  getTopPlayers,
  getPlayerMissions,
  getActiveBonuses,
  getActiveCooldowns,
  getGlobalProgress,
  getMissingCollectibles
};
