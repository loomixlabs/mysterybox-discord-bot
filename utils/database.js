const Database = require('better-sqlite3');
const path = require('path');

/**
 * Connexion à SQLite (pour tests locaux)
 */
class DatabaseWrapper {
  constructor() {
    // Gérer les chemins relatifs et absolus
    let dbPath = process.env.DATABASE_URL || 'bot.db';

    // Si c'est juste un nom de fichier, utiliser le répertoire de travail
    if (!path.isAbsolute(dbPath) && !dbPath.includes('/') && !dbPath.includes('\\')) {
      dbPath = path.join(process.cwd(), dbPath);
    }

    console.log(`📦 Tentative d'ouverture de la base de données: ${dbPath}`);

    this.db = new Database(dbPath, { verbose: console.log });
    this.db.pragma('journal_mode = WAL');

    console.log(`✅ SQLite database connectée: ${dbPath}`);
  }

  /**
   * Exécuter une requête SQL (avec conversion des paramètres PostgreSQL)
   */
  async query(text, params = []) {
    const start = Date.now();
    try {
      // Convertir les paramètres $1, $2, etc. en ?
      const sqliteQuery = text.replace(/\$(\d+)/g, '?');

      // Pour les requêtes INSERT/UPDATE/DELETE
      if (text.trim().toUpperCase().startsWith('INSERT') ||
          text.trim().toUpperCase().startsWith('UPDATE') ||
          text.trim().toUpperCase().startsWith('DELETE')) {
        const stmt = this.db.prepare(sqliteQuery);
        const result = stmt.run(...params);
        const duration = Date.now() - start;
        console.log(`✅ Query executed in ${duration}ms`);
        return { rows: [], rowCount: result.changes, lastID: result.lastInsertRowid };
      }

      // Pour les requêtes SELECT
      const stmt = this.db.prepare(sqliteQuery);
      const rows = stmt.all(...params);
      const duration = Date.now() - start;
      console.log(`✅ Query executed in ${duration}ms`);
      return { rows };
    } catch (error) {
      console.error('🔴 Database query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    }
  }

  /**
   * Récupérer une seule ligne
   */
  async queryOne(text, params = []) {
    const result = await this.query(text, params);
    return result.rows[0] || null;
  }

  /**
   * Récupérer toutes les lignes
   */
  async queryAll(text, params = []) {
    const result = await this.query(text, params);
    return result.rows;
  }

  /**
   * Vérifier la connexion
   */
  async testConnection() {
    try {
      const result = await this.query("SELECT datetime('now') as time");
      console.log('✅ Database connected:', result.rows[0].time);
      return true;
    } catch (error) {
      console.error('🔴 Database connection failed:', error);
      return false;
    }
  }

  /**
   * Fermer la connexion
   */
  async close() {
    this.db.close();
    console.log('🔌 Database connection closed');
  }

  // ============================================
  // MÉTHODES SPÉCIFIQUES AU BOT
  // ============================================

  /**
   * Récupérer le thème actif
   */
  async getActiveTheme() {
    return this.queryOne(
      'SELECT * FROM themes WHERE is_active = 1 LIMIT 1'
    );
  }

  /**
   * Récupérer tous les thèmes
   */
  async getAllThemes() {
    return this.queryAll(
      'SELECT * FROM themes ORDER BY created_at DESC'
    );
  }

  /**
   * Activer un thème (désactive tous les autres)
   */
  async setActiveTheme(themeId) {
    // Désactiver tous les thèmes
    await this.query('UPDATE themes SET is_active = 0');

    // Activer le thème choisi
    await this.query(
      'UPDATE themes SET is_active = 1 WHERE id = $1',
      [themeId]
    );

    return this.queryOne('SELECT * FROM themes WHERE id = $1', [themeId]);
  }

  /**
   * Créer un nouveau thème
   */
  async createTheme(themeData) {
    const { themeId, name, duration_days, required_items, final_role_name, final_role_color, final_role_id } = themeData;

    // Insérer le thème
    await this.query(
      `INSERT INTO themes (theme_id, name, duration_days, required_items, final_role_name, final_role_color, final_role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
      [themeId, name, duration_days, required_items, final_role_name, final_role_color, final_role_id || null]
    );

    // Récupérer le thème créé
    const theme = await this.queryOne('SELECT * FROM themes WHERE theme_id = $1', [themeId]);

    // Créer la configuration par défaut
    await this.query(
      `INSERT INTO theme_config (theme_id, probability_collectible, probability_mission, probability_trap)
       VALUES ($1, 40, 40, 20)`,
      [theme.id]
    );

    return theme;
  }

  /**
   * Mettre à jour un thème
   */
  async updateTheme(themeId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    values.push(themeId);

    await this.query(
      `UPDATE themes SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = $${paramIndex}`,
      values
    );

    return this.queryOne('SELECT * FROM themes WHERE id = $1', [themeId]);
  }

  /**
   * Supprimer un thème (avec toutes ses dépendances)
   */
  async deleteTheme(themeId) {
    // Supprimer dans l'ordre inverse des dépendances
    await this.query('DELETE FROM theme_messages WHERE theme_id = $1', [themeId]);
    await this.query('DELETE FROM player_malus_points WHERE theme_id = $1', [themeId]);
    await this.query('DELETE FROM give_campaigns WHERE theme_id = $1', [themeId]);

    // Supprimer les trap_triggered pour les traps de ce thème
    await this.query(
      'DELETE FROM trap_triggered WHERE trap_id IN (SELECT id FROM traps WHERE theme_id = $1)',
      [themeId]
    );

    // Supprimer les cooldowns pour les traps de ce thème
    await this.query(
      'DELETE FROM player_cooldowns WHERE trap_id IN (SELECT id FROM traps WHERE theme_id = $1)',
      [themeId]
    );

    // Supprimer les traps
    await this.query('DELETE FROM traps WHERE theme_id = $1', [themeId]);

    // Supprimer la progression des missions
    await this.query(
      'DELETE FROM mission_progress WHERE mission_id IN (SELECT id FROM missions WHERE theme_id = $1)',
      [themeId]
    );

    // Supprimer les missions
    await this.query('DELETE FROM missions WHERE theme_id = $1', [themeId]);

    // Supprimer les collections des collectibles de ce thème
    await this.query(
      'DELETE FROM collections WHERE collectible_id IN (SELECT id FROM collectibles WHERE theme_id = $1)',
      [themeId]
    );

    // Supprimer les collectibles
    await this.query('DELETE FROM collectibles WHERE theme_id = $1', [themeId]);

    // Supprimer la progression des joueurs
    await this.query('DELETE FROM player_progress WHERE theme_id = $1', [themeId]);

    // Supprimer la configuration
    await this.query('DELETE FROM theme_config WHERE theme_id = $1', [themeId]);

    // Supprimer le thème
    await this.query('DELETE FROM themes WHERE id = $1', [themeId]);
  }

  /**
   * Récupérer un thème par ID
   */
  async getThemeById(themeId) {
    return this.queryOne('SELECT * FROM themes WHERE id = $1', [themeId]);
  }

  /**
   * Supprimer un collectible
   */
  async deleteCollectible(collectibleId) {
    // D'abord, supprimer toutes les collections de ce collectible
    await this.query(
      'DELETE FROM collections WHERE collectible_id = $1',
      [collectibleId]
    );

    // Ensuite, supprimer le collectible lui-même
    return this.query(
      'DELETE FROM collectibles WHERE id = $1',
      [collectibleId]
    );
  }

  /**
   * Récupérer un joueur par Discord ID
   */
  async getPlayerByDiscordId(discordId) {
    return this.queryOne(
      'SELECT * FROM players WHERE discord_id = $1',
      [discordId]
    );
  }

  /**
   * Créer ou mettre à jour un joueur
   */
  async upsertPlayer(discordId, username) {
    // SQLite utilise une syntaxe différente pour UPSERT
    const existing = await this.getPlayerByDiscordId(discordId);

    if (existing) {
      await this.query(
        `UPDATE players SET username = $1, updated_at = datetime('now') WHERE discord_id = $2`,
        [username, discordId]
      );
      return this.getPlayerByDiscordId(discordId);
    } else {
      const result = await this.query(
        `INSERT INTO players (discord_id, username, created_at, updated_at)
         VALUES ($1, $2, datetime('now'), datetime('now'))`,
        [discordId, username]
      );
      return this.getPlayerByDiscordId(discordId);
    }
  }

  /**
   * Vérifier si un joueur possède un collectible
   */
  async hasCollectible(playerId, collectibleId) {
    const result = await this.queryOne(
      `SELECT * FROM collections
       WHERE player_id = $1 AND collectible_id = $2`,
      [playerId, collectibleId]
    );
    return result !== null;
  }

  /**
   * Ajouter un collectible à un joueur
   */
  async addCollectible(playerId, collectibleId) {
    await this.query(
      `INSERT INTO collections (player_id, collectible_id, collected_at)
       VALUES ($1, $2, datetime('now'))`,
      [playerId, collectibleId]
    );
    return this.queryOne(
      'SELECT * FROM collections WHERE player_id = $1 AND collectible_id = $2',
      [playerId, collectibleId]
    );
  }

  /**
   * Récupérer la progression d'un joueur
   */
  async getPlayerProgress(playerId, themeId) {
    return this.queryOne(
      `SELECT * FROM player_progress
       WHERE player_id = $1 AND theme_id = $2`,
      [playerId, themeId]
    );
  }

  /**
   * Créer ou incrémenter la progression
   */
  async incrementProgress(playerId, themeId) {
    const existing = await this.getPlayerProgress(playerId, themeId);

    if (existing) {
      await this.query(
        `UPDATE player_progress
         SET collected_count = collected_count + 1
         WHERE player_id = $1 AND theme_id = $2`,
        [playerId, themeId]
      );
    } else {
      await this.query(
        `INSERT INTO player_progress (player_id, theme_id, collected_count, started_at)
         VALUES ($1, $2, 1, datetime('now'))`,
        [playerId, themeId]
      );
    }

    return this.getPlayerProgress(playerId, themeId);
  }

  /**
   * Marquer une collection comme complète
   */
  async completeCollection(playerId, themeId) {
    await this.query(
      `UPDATE player_progress
       SET is_completed = 1, completed_at = datetime('now')
       WHERE player_id = $1 AND theme_id = $2`,
      [playerId, themeId]
    );
    return this.getPlayerProgress(playerId, themeId);
  }

  /**
   * Récupérer un collectible par ID
   */
  async getCollectibleById(id) {
    return this.queryOne(
      `SELECT c.*, t.name as theme_name, t.required_items, t.final_role_name, t.final_role_color
       FROM collectibles c
       JOIN themes t ON c.theme_id = t.id
       WHERE c.id = $1`,
      [id]
    );
  }

  /**
   * Récupérer tous les collectibles d'un thème
   */
  async getCollectiblesByTheme(themeId) {
    return this.queryAll(
      'SELECT * FROM collectibles WHERE theme_id = $1 ORDER BY id',
      [themeId]
    );
  }

  /**
   * Récupérer un piège par ID
   */
  async getTrapById(id) {
    return this.queryOne(
      `SELECT t.*, th.name as theme_name
       FROM traps t
       JOIN themes th ON t.theme_id = th.id
       WHERE t.id = $1`,
      [id]
    );
  }

  /**
   * Ajouter un nouveau piège
   */
  async addTrap(themeId, trapId, name, type, description, imageUrl, typeData, announcementMessage) {
    // typeData contient les champs spécifiques selon le type (cooldown_duration, shame_message, malus_points, etc.)
    const { cooldown_duration, shame_message, shame_channel_id, malus_points } = typeData || {};

    return this.query(
      `INSERT INTO traps (theme_id, trap_id, name, type, description, image_url, cooldown_duration, shame_message, shame_channel_id, malus_points, announcement_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [themeId, trapId, name, type, description, imageUrl, cooldown_duration, shame_message, shame_channel_id, malus_points, announcementMessage]
    );
  }

  /**
   * Modifier un piège existant
   */
  async updateTrap(id, name, type, description, imageUrl, typeData, announcementMessage) {
    const { cooldown_duration, shame_message, shame_channel_id, malus_points } = typeData || {};

    return this.query(
      `UPDATE traps
       SET name = $1, type = $2, description = $3, image_url = $4, cooldown_duration = $5, shame_message = $6, shame_channel_id = $7, malus_points = $8, announcement_message = $9
       WHERE id = $10`,
      [name, type, description, imageUrl, cooldown_duration, shame_message, shame_channel_id, malus_points, announcementMessage, id]
    );
  }

  /**
   * Supprimer un piège
   */
  async deleteTrap(id) {
    return this.query(
      `DELETE FROM traps WHERE id = $1`,
      [id]
    );
  }

  /**
   * Logger un piège déclenché
   */
  async logTrapTriggered(playerId, trapId, expiresAt) {
    await this.query(
      `INSERT INTO trap_triggered (player_id, trap_id, triggered_at, expires_at)
       VALUES ($1, $2, datetime('now'), $3)`,
      [playerId, trapId, expiresAt]
    );
    return this.queryOne(
      'SELECT * FROM trap_triggered WHERE player_id = $1 AND trap_id = $2 ORDER BY id DESC LIMIT 1',
      [playerId, trapId]
    );
  }

  /**
   * Logger un give
   */
  async logGive(giveType, itemId, messageId, channelId) {
    await this.query(
      `INSERT INTO give_logs (give_type, item_id, message_id, channel_id, created_at)
       VALUES ($1, $2, $3, $4, datetime('now'))`,
      [giveType, itemId, messageId, channelId]
    );
    return this.queryOne(
      'SELECT * FROM give_logs WHERE message_id = $1',
      [messageId]
    );
  }

  /**
   * Mettre à jour le gagnant d'un give
   */
  async updateGiveWinner(messageId, winnerId, winnerUsername) {
    return this.query(
      `UPDATE give_logs
       SET winner_id = $1, winner_username = $2, claimed_at = datetime('now')
       WHERE message_id = $3`,
      [winnerId, winnerUsername, messageId]
    );
  }

  /**
   * Récupérer les messages d'un thème
   */
  async getThemeMessages(themeId) {
    const rows = await this.queryAll(
      'SELECT key, content FROM theme_messages WHERE theme_id = $1',
      [themeId]
    );

    const messages = {};
    rows.forEach(row => {
      messages[row.key] = row.content;
    });
    return messages;
  }

  /**
   * Récupérer le leaderboard
   */
  async getLeaderboard(themeId, limit = 10) {
    return this.queryAll(
      `SELECT p.username, p.discord_id, pp.collected_count, pp.is_completed, pp.started_at
       FROM player_progress pp
       JOIN players p ON pp.player_id = p.id
       WHERE pp.theme_id = $1
       ORDER BY pp.is_completed DESC, pp.collected_count DESC, pp.started_at ASC
       LIMIT $2`,
      [themeId, limit]
    );
  }

  /**
   * Récupérer les collectibles d'un joueur
   */
  async getPlayerCollectibles(playerId, themeId) {
    return this.queryAll(
      `SELECT c.name, c.role_name, c.image_url, col.collected_at
       FROM collections col
       JOIN collectibles c ON col.collectible_id = c.id
       WHERE col.player_id = $1 AND c.theme_id = $2
       ORDER BY col.collected_at DESC`,
      [playerId, themeId]
    );
  }

  /**
   * Logger une action admin
   */
  async logAudit(action, adminId, details) {
    return this.query(
      `INSERT INTO audit_logs (action, admin_id, details, created_at)
       VALUES ($1, $2, $3, datetime('now'))`,
      [action, adminId, JSON.stringify(details)]
    );
  }

  // ============================================
  // MÉTHODES V2 - SYSTÈME BOÎTE MYSTÈRE
  // ============================================

  /**
   * Récupérer la configuration d'un thème
   */
  async getThemeConfig(themeId) {
    return this.queryOne(
      'SELECT * FROM theme_config WHERE theme_id = $1',
      [themeId]
    );
  }

  /**
   * Récupérer toutes les missions d'un thème
   */
  async getMissionsByTheme(themeId) {
    return this.queryAll(
      'SELECT * FROM missions WHERE theme_id = $1',
      [themeId]
    );
  }

  /**
   * Récupérer tous les pièges d'un thème
   */
  async getTrapsByTheme(themeId) {
    return this.queryAll(
      'SELECT * FROM traps WHERE theme_id = $1',
      [themeId]
    );
  }

  /**
   * Récupérer une mission par ID
   */
  async getMissionById(id) {
    return this.queryOne(
      `SELECT m.*, t.name as theme_name
       FROM missions m
       JOIN themes t ON m.theme_id = t.id
       WHERE m.id = $1`,
      [id]
    );
  }

  /**
   * Ajouter une nouvelle mission
   */
  async addMission(themeId, missionId, name, type, description, validationData, timeout, imageUrl, announcementMessage) {
    return this.query(
      `INSERT INTO missions (theme_id, mission_id, name, type, description, validation_type, validation_data, timeout, image_url, announcement_message)
       VALUES ($1, $2, $3, $4, $5, 'auto', $6, $7, $8, $9)`,
      [themeId, missionId, name, type, description, validationData, timeout, imageUrl, announcementMessage]
    );
  }

  /**
   * Modifier une mission existante
   */
  async updateMission(id, name, type, description, validationData, timeout, imageUrl, announcementMessage) {
    return this.query(
      `UPDATE missions
       SET name = $1, type = $2, description = $3, validation_data = $4, timeout = $5, image_url = $6, announcement_message = $7
       WHERE id = $8`,
      [name, type, description, validationData, timeout, imageUrl, announcementMessage, id]
    );
  }

  /**
   * Supprimer une mission
   */
  async deleteMission(id) {
    return this.query(
      `DELETE FROM missions WHERE id = $1`,
      [id]
    );
  }

  /**
   * Vérifier si un joueur a un cooldown actif
   */
  async hasActiveCooldown(playerId) {
    const result = await this.queryOne(
      `SELECT * FROM player_cooldowns
       WHERE player_id = $1
       AND is_active = 1
       AND datetime(expires_at) > datetime('now')
       LIMIT 1`,
      [playerId]
    );
    return result !== null;
  }

  /**
   * Ajouter un cooldown à un joueur
   */
  async addCooldown(playerId, trapId, durationMinutes) {
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    return this.queryOne(
      `INSERT INTO player_cooldowns (player_id, trap_id, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [playerId, trapId, expiresAt]
    );
  }

  /**
   * Ajouter/Mettre à jour les points de malédiction d'un joueur
   */
  async addMalusPoints(playerId, themeId, points) {
    const existing = await this.queryOne(
      'SELECT * FROM player_malus_points WHERE player_id = $1 AND theme_id = $2',
      [playerId, themeId]
    );

    if (existing) {
      return this.query(
        `UPDATE player_malus_points
         SET points = points + $1, updated_at = datetime('now')
         WHERE player_id = $2 AND theme_id = $3`,
        [points, playerId, themeId]
      );
    } else {
      return this.query(
        `INSERT INTO player_malus_points (player_id, theme_id, points)
         VALUES ($1, $2, $3)`,
        [playerId, themeId, points]
      );
    }
  }

  /**
   * Créer une progression de mission
   */
  async createMissionProgress(playerId, missionId, threadId = null) {
    return this.query(
      `INSERT INTO mission_progress (player_id, mission_id, thread_id, status)
       VALUES ($1, $2, $3, 'in_progress')`,
      [playerId, missionId, threadId]
    );
  }

  /**
   * Compléter une mission
   */
  async completeMission(progressId, validatedBy = null) {
    return this.query(
      `UPDATE mission_progress
       SET status = 'completed', completed_at = datetime('now'), validated_by = $2
       WHERE id = $1`,
      [progressId, validatedBy]
    );
  }

  /**
   * Récupérer la progression de mission active d'un joueur
   */
  async getActiveMissionProgress(playerId, missionId) {
    return this.queryOne(
      `SELECT * FROM mission_progress
       WHERE player_id = $1 AND mission_id = $2 AND status = 'in_progress'
       LIMIT 1`,
      [playerId, missionId]
    );
  }

  /**
   * Récupérer un collectible aléatoire du thème
   */
  async getRandomCollectible(themeId) {
    return this.queryOne(
      `SELECT * FROM collectibles
       WHERE theme_id = $1
       ORDER BY RANDOM()
       LIMIT 1`,
      [themeId]
    );
  }

  // ============================================
  // MÉTHODES CAMPAGNES - Phase 2
  // ============================================

  /**
   * Créer une campagne
   */
  async createCampaign(data) {
    const {
      themeId,
      mode,
      totalCount,
      intervalSeconds,
      durationDays,
      frequencyHours,
      activeHoursStart,
      activeHoursEnd,
      targetChannels,
      channelMode,
      createdBy
    } = data;

    const result = await this.query(
      `INSERT INTO campaigns (
        theme_id, mode, status,
        total_count, interval_seconds,
        duration_days, frequency_hours, active_hours_start, active_hours_end,
        target_channels, channel_mode, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        themeId, mode, 'active',
        totalCount, intervalSeconds,
        durationDays, frequencyHours, activeHoursStart, activeHoursEnd,
        JSON.stringify(targetChannels), channelMode, createdBy
      ]
    );

    return this.queryOne(
      'SELECT * FROM campaigns WHERE id = $1',
      [result.lastID]
    );
  }

  /**
   * Récupérer une campagne par ID
   */
  async getCampaignById(id) {
    const campaign = await this.queryOne(
      'SELECT * FROM campaigns WHERE id = $1',
      [id]
    );

    if (campaign && campaign.target_channels) {
      campaign.target_channels = JSON.parse(campaign.target_channels);
    }

    return campaign;
  }

  /**
   * Récupérer toutes les campagnes actives
   */
  async getActiveCampaigns() {
    const campaigns = await this.queryAll(
      `SELECT * FROM campaigns
       WHERE status IN ('active', 'paused')
       ORDER BY created_at DESC`
    );

    return campaigns.map(c => {
      if (c.target_channels) {
        c.target_channels = JSON.parse(c.target_channels);
      }
      return c;
    });
  }

  /**
   * Récupérer toutes les campagnes d'un thème
   */
  async getCampaignsByTheme(themeId, limit = 20) {
    const campaigns = await this.queryAll(
      `SELECT * FROM campaigns
       WHERE theme_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [themeId, limit]
    );

    return campaigns.map(c => {
      if (c.target_channels) {
        c.target_channels = JSON.parse(c.target_channels);
      }
      return c;
    });
  }

  /**
   * Mettre à jour le statut d'une campagne
   */
  async updateCampaignStatus(campaignId, status) {
    return this.query(
      `UPDATE campaigns
       SET status = $1
       WHERE id = $2`,
      [status, campaignId]
    );
  }

  /**
   * Incrémenter le compteur de lancements
   */
  async incrementCampaignLaunched(campaignId) {
    return this.query(
      `UPDATE campaigns
       SET launched_count = launched_count + 1
       WHERE id = $1`,
      [campaignId]
    );
  }

  /**
   * Marquer le démarrage d'une campagne
   */
  async markCampaignStarted(campaignId) {
    return this.query(
      `UPDATE campaigns
       SET started_at = datetime('now')
       WHERE id = $1 AND started_at IS NULL`,
      [campaignId]
    );
  }

  /**
   * Marquer la complétion d'une campagne
   */
  async completeCampaign(campaignId) {
    return this.query(
      `UPDATE campaigns
       SET status = 'completed', completed_at = datetime('now')
       WHERE id = $1`,
      [campaignId]
    );
  }

  /**
   * Logger un lancement de campagne
   */
  async logCampaignLaunch(campaignId, messageId, channelId) {
    return this.query(
      `INSERT INTO campaign_launches (campaign_id, message_id, channel_id)
       VALUES ($1, $2, $3)`,
      [campaignId, messageId, channelId]
    );
  }

  /**
   * Récupérer les lancements d'une campagne
   */
  async getCampaignLaunches(campaignId) {
    return this.queryAll(
      `SELECT * FROM campaign_launches
       WHERE campaign_id = $1
       ORDER BY launched_at DESC`,
      [campaignId]
    );
  }

  /**
   * Compter les lancements d'une campagne
   */
  async countCampaignLaunches(campaignId) {
    const result = await this.queryOne(
      `SELECT COUNT(*) as count FROM campaign_launches
       WHERE campaign_id = $1`,
      [campaignId]
    );
    return result ? result.count : 0;
  }

  // ============================================
  // MÉTHODES GIVE CHANNELS
  // ============================================

  /**
   * Ajouter un canal ou catégorie
   */
  async addGiveChannel(type, discordId, name, createdBy, parentCategoryId = null) {
    return this.query(
      `INSERT INTO give_channels (type, discord_id, name, created_by, parent_category_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [type, discordId, name, createdBy, parentCategoryId]
    );
  }

  /**
   * Récupérer tous les canaux/catégories configurés
   */
  async getAllGiveChannels() {
    return this.queryAll(
      `SELECT * FROM give_channels
       ORDER BY type DESC, created_at ASC`
    );
  }

  /**
   * Récupérer les catégories configurées
   */
  async getGiveCategories() {
    return this.queryAll(
      `SELECT * FROM give_channels
       WHERE type = 'category'
       ORDER BY created_at ASC`
    );
  }

  /**
   * Récupérer les canaux configurés (sans catégorie ou tous)
   */
  async getGiveChannelsList() {
    return this.queryAll(
      `SELECT * FROM give_channels
       WHERE type = 'channel'
       ORDER BY created_at ASC`
    );
  }

  /**
   * Récupérer les canaux d'une catégorie
   */
  async getChannelsByCategory(categoryId) {
    return this.queryAll(
      `SELECT * FROM give_channels
       WHERE type = 'channel' AND parent_category_id = $1
       ORDER BY created_at ASC`,
      [categoryId]
    );
  }

  /**
   * Vérifier si un canal/catégorie existe
   */
  async giveChannelExists(discordId) {
    const result = await this.queryOne(
      `SELECT * FROM give_channels WHERE discord_id = $1`,
      [discordId]
    );
    return !!result;
  }

  /**
   * Supprimer un canal ou catégorie
   */
  async deleteGiveChannel(discordId) {
    return this.query(
      `DELETE FROM give_channels WHERE discord_id = $1`,
      [discordId]
    );
  }

  /**
   * Récupérer un canal/catégorie par ID
   */
  async getGiveChannelById(discordId) {
    return this.queryOne(
      `SELECT * FROM give_channels WHERE discord_id = $1`,
      [discordId]
    );
  }

  /**
   * Récupérer tous les IDs de canaux configurés (pour gives random)
   */
  async getAllGiveChannelIds() {
    const results = await this.queryAll(
      `SELECT discord_id FROM give_channels WHERE type = 'channel'`
    );
    return results.map(r => r.discord_id);
  }

  /**
   * Récupérer tous les IDs de catégories configurées
   */
  async getAllGiveCategoryIds() {
    const results = await this.queryAll(
      `SELECT discord_id FROM give_channels WHERE type = 'category'`
    );
    return results.map(r => r.discord_id);
  }

  // ============================================
  // CANAL D'ANNONCES
  // ============================================

  /**
   * Définir le canal d'annonces
   */
  async setAnnouncementChannel(channelId, channelName) {
    return this.query(
      `INSERT OR REPLACE INTO announcement_channel (id, channel_id, channel_name, updated_at)
       VALUES (1, $1, $2, datetime('now'))`,
      [channelId, channelName]
    );
  }

  /**
   * Récupérer le canal d'annonces
   */
  async getAnnouncementChannel() {
    return this.queryOne(
      `SELECT * FROM announcement_channel WHERE id = 1`
    );
  }

  /**
   * Supprimer le canal d'annonces
   */
  async deleteAnnouncementChannel() {
    return this.query(
      `DELETE FROM announcement_channel WHERE id = 1`
    );
  }

  /**
   * Récupérer les paramètres d'annonces
   */
  async getAnnouncementSettings() {
    return this.queryOne(
      `SELECT * FROM announcement_settings WHERE id = 1`
    );
  }

  /**
   * Mettre à jour un paramètre d'annonce spécifique
   */
  async updateAnnouncementSetting(settingName, value) {
    const validSettings = [
      'legendary_collectible',
      'collection_completed',
      'collection_traded',
      'collection_lost',
      'trap_curse',
      'mission_word_guessed'
    ];

    if (!validSettings.includes(settingName)) {
      throw new Error(`Invalid setting name: ${settingName}`);
    }

    return this.query(
      `UPDATE announcement_settings SET ${settingName} = $1, updated_at = datetime('now') WHERE id = 1`,
      [value ? 1 : 0]
    );
  }

  /**
   * Mettre à jour tous les paramètres d'annonces
   */
  async updateAllAnnouncementSettings(settings) {
    return this.query(
      `UPDATE announcement_settings
       SET legendary_collectible = $1,
           collection_completed = $2,
           collection_traded = $3,
           collection_lost = $4,
           trap_curse = $5,
           mission_word_guessed = $6,
           updated_at = datetime('now')
       WHERE id = 1`,
      [
        settings.legendary_collectible ? 1 : 0,
        settings.collection_completed ? 1 : 0,
        settings.collection_traded ? 1 : 0,
        settings.collection_lost ? 1 : 0,
        settings.trap_curse ? 1 : 0,
        settings.mission_word_guessed ? 1 : 0
      ]
    );
  }

  // ============================================
  // TEMPLATES D'ANNONCES
  // ============================================

  /**
   * Récupérer un template d'annonce par type
   */
  async getAnnouncementTemplate(type) {
    return this.queryOne(
      `SELECT * FROM announcement_templates WHERE type = $1`,
      [type]
    );
  }

  /**
   * Récupérer tous les templates d'annonces
   */
  async getAllAnnouncementTemplates() {
    return this.queryAll(
      `SELECT * FROM announcement_templates ORDER BY type ASC`
    );
  }

  /**
   * Mettre à jour un template d'annonce
   */
  async updateAnnouncementTemplate(type, template) {
    return this.query(
      `UPDATE announcement_templates
       SET title = $1,
           description = $2,
           color = $3,
           image_url = $4,
           thumbnail_url = $5,
           footer_text = $6,
           updated_at = datetime('now')
       WHERE type = $7`,
      [
        template.title,
        template.description,
        template.color,
        template.image_url || null,
        template.thumbnail_url || null,
        template.footer_text,
        type
      ]
    );
  }

  /**
   * Réinitialiser un template à ses valeurs par défaut
   */
  async resetAnnouncementTemplate(type) {
    const defaults = {
      'legendary_collectible': {
        title: '⭐ COLLECTIBLE LÉGENDAIRE TROUVÉ !',
        description: '**{userName}** a trouvé le collectible légendaire **{collectibleName}** !',
        color: '#FFD700',
        footer_text: 'Système d\'annonces'
      },
      'collection_completed': {
        title: '🎉 COLLECTION COMPLÉTÉE !',
        description: '**{userName}** a complété sa collection **{themeName}** !\n\n🏆 {userName} a obtenu le rôle **{roleName}** !',
        color: '#00FF00',
        footer_text: 'Système d\'annonces'
      },
      'collection_traded': {
        title: '🔄 ÉCHANGE DE COLLECTION !',
        description: '**{user1Name}** et **{user2Name}** ont échangé leurs collections\ngrâce à la mission **{missionName}** !',
        color: '#3498db',
        footer_text: 'Système d\'annonces'
      },
      'collection_lost': {
        title: '💀 COLLECTION PERDUE !',
        description: '**{userName}** a perdu entièrement sa collection à cause du piège **{trapName}** !',
        color: '#FF0000',
        footer_text: 'Système d\'annonces'
      },
      'trap_curse': {
        title: '😈 MALÉDICTION ACTIVÉE !',
        description: '**{userName}** a reçu la malédiction du piège **{trapName}** !\n\n{trapEffect}',
        color: '#8B00FF',
        footer_text: 'Système d\'annonces'
      },
      'mission_word_guessed': {
        title: '🎯 MOT DEVINÉ !',
        description: '**{userName}** a réussi à faire deviner le mot **{word}**\ndans sa mission **{missionName}** !',
        color: '#FFA500',
        footer_text: 'Système d\'annonces'
      }
    };

    const defaultTemplate = defaults[type];
    if (!defaultTemplate) {
      throw new Error(`Type de template invalide: ${type}`);
    }

    return this.query(
      `UPDATE announcement_templates
       SET title = $1,
           description = $2,
           color = $3,
           image_url = NULL,
           thumbnail_url = NULL,
           footer_text = $4,
           updated_at = datetime('now')
       WHERE type = $5`,
      [
        defaultTemplate.title,
        defaultTemplate.description,
        defaultTemplate.color,
        defaultTemplate.footer_text,
        type
      ]
    );
  }

  // ============================================
  // MÉTHODES SUPER BONUS - Phase 5
  // ============================================

  /**
   * Récupérer tous les super bonus
   */
  async getAllSuperBonuses() {
    return this.queryAll(
      `SELECT * FROM super_bonuses ORDER BY rarity DESC, name ASC`
    );
  }

  /**
   * Récupérer un super bonus par son bonus_id
   */
  async getSuperBonusByBonusId(bonusId) {
    return this.queryOne(
      `SELECT * FROM super_bonuses WHERE bonus_id = $1`,
      [bonusId]
    );
  }

  /**
   * Récupérer un super bonus par son ID
   */
  async getSuperBonusById(id) {
    return this.queryOne(
      `SELECT * FROM super_bonuses WHERE id = $1`,
      [id]
    );
  }

  /**
   * Récupérer les super bonus d'un thème (ou globaux si themeId null)
   */
  async getSuperBonusesByTheme(themeId = null) {
    if (themeId === null) {
      return this.queryAll(
        `SELECT * FROM super_bonuses WHERE theme_id IS NULL ORDER BY rarity DESC, name ASC`
      );
    }
    return this.queryAll(
      `SELECT * FROM super_bonuses WHERE theme_id = $1 OR theme_id IS NULL ORDER BY rarity DESC, name ASC`,
      [themeId]
    );
  }

  /**
   * Récupérer les bonus actifs d'un joueur
   */
  async getActiveBonusesByPlayer(userId) {
    return this.queryAll(
      `SELECT pab.*, sb.bonus_id, sb.name, sb.description, sb.icon, sb.effect_type, sb.effect_config, sb.duration_type, sb.color
       FROM player_active_bonuses pab
       JOIN super_bonuses sb ON pab.bonus_id = sb.id
       WHERE pab.user_id = $1 AND pab.is_active = 1
       AND (pab.expires_at IS NULL OR datetime(pab.expires_at) > datetime('now'))
       ORDER BY pab.activated_at DESC`,
      [userId]
    );
  }

  /**
   * Vérifier si un joueur a un bonus spécifique actif
   */
  async playerHasActiveBonus(userId, bonusId) {
    const result = await this.queryOne(
      `SELECT * FROM player_active_bonuses
       WHERE user_id = $1 AND bonus_id = $2 AND is_active = 1
       AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))
       LIMIT 1`,
      [userId, bonusId]
    );
    return result !== null;
  }

  /**
   * Donner un bonus à un joueur
   */
  async addBonusToPlayer(userId, bonusId, obtainedFrom = 'manual_admin', givenBy = null) {
    // Récupérer les infos du bonus
    const bonus = await this.getSuperBonusById(bonusId);
    if (!bonus) {
      throw new Error(`Super bonus avec ID ${bonusId} introuvable`);
    }

    // Calculer expires_at si temporaire
    let expiresAt = null;
    if (bonus.duration_type === 'temporary' && bonus.duration_value) {
      const expirationDate = new Date(Date.now() + bonus.duration_value * 1000);
      expiresAt = expirationDate.toISOString();
    }

    // Déterminer remaining_charges
    let remainingCharges = null;
    if (bonus.duration_type === 'charges') {
      remainingCharges = bonus.duration_value;
    }

    // Insérer le bonus actif
    const result = await this.query(
      `INSERT INTO player_active_bonuses (
        user_id, bonus_id, expires_at, remaining_charges, is_active, obtained_from, given_by
      ) VALUES ($1, $2, $3, $4, 1, $5, $6)`,
      [userId, bonusId, expiresAt, remainingCharges, obtainedFrom, givenBy]
    );

    return this.queryOne(
      `SELECT * FROM player_active_bonuses WHERE id = $1`,
      [result.lastID]
    );
  }

  /**
   * Consommer un bonus (marquer comme inactif)
   */
  async consumeBonus(activeBonusId) {
    return this.query(
      `UPDATE player_active_bonuses
       SET is_active = 0, used_at = datetime('now')
       WHERE id = $1`,
      [activeBonusId]
    );
  }

  /**
   * Décrémenter une charge de bonus
   */
  async decrementBonusCharge(activeBonusId) {
    // Décrémenter
    await this.query(
      `UPDATE player_active_bonuses
       SET remaining_charges = remaining_charges - 1
       WHERE id = $1`,
      [activeBonusId]
    );

    // Récupérer le bonus mis à jour
    const updated = await this.queryOne(
      `SELECT * FROM player_active_bonuses WHERE id = $1`,
      [activeBonusId]
    );

    // Si remaining_charges = 0, marquer comme inactif
    if (updated && updated.remaining_charges <= 0) {
      await this.consumeBonus(activeBonusId);
    }

    return updated;
  }

  /**
   * Logger l'utilisation d'un bonus
   */
  async logBonusUsage(userId, bonusId, effectResult = null, triggerType = 'manual', relatedEventId = null) {
    return this.query(
      `INSERT INTO bonus_usage_history (
        user_id, bonus_id, effect_result, trigger_type, related_event_id
      ) VALUES ($1, $2, $3, $4, $5)`,
      [userId, bonusId, JSON.stringify(effectResult), triggerType, relatedEventId]
    );
  }

  /**
   * Nettoyer les bonus expirés (marquer comme inactifs)
   */
  async cleanupExpiredBonuses() {
    return this.query(
      `UPDATE player_active_bonuses
       SET is_active = 0, used_at = datetime('now')
       WHERE is_active = 1
       AND expires_at IS NOT NULL
       AND datetime(expires_at) <= datetime('now')`
    );
  }

  /**
   * Récupérer l'historique d'utilisation d'un joueur
   */
  async getBonusUsageHistory(userId, limit = 20) {
    return this.queryAll(
      `SELECT buh.*, sb.name, sb.icon
       FROM bonus_usage_history buh
       JOIN super_bonuses sb ON buh.bonus_id = sb.id
       WHERE buh.user_id = $1
       ORDER BY buh.used_at DESC
       LIMIT $2`,
      [userId, limit]
    );
  }

  /**
   * Créer un nouveau super bonus (admin)
   */
  async createSuperBonus(bonusData) {
    const {
      bonusId,
      name,
      description,
      icon,
      bonusType,
      effectType,
      effectConfig,
      durationType,
      durationValue,
      imageUrl,
      color,
      rarity,
      themeId,
      announcementMessage
    } = bonusData;

    const result = await this.query(
      `INSERT INTO super_bonuses (
        bonus_id, name, description, icon, bonus_type, effect_type,
        effect_config, duration_type, duration_value, image_url, color,
        rarity, theme_id, announcement_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        bonusId, name, description, icon, bonusType, effectType,
        JSON.stringify(effectConfig), durationType, durationValue,
        imageUrl, color, rarity, themeId, announcementMessage
      ]
    );

    return this.queryOne(
      `SELECT * FROM super_bonuses WHERE id = $1`,
      [result.lastID]
    );
  }

  /**
   * Mettre à jour un super bonus
   */
  async updateSuperBonus(bonusId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      // Convertir les objets en JSON si nécessaire
      if (key === 'effect_config' && typeof value === 'object') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    }

    values.push(bonusId);

    await this.query(
      `UPDATE super_bonuses SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = $${paramIndex}`,
      values
    );

    return this.queryOne('SELECT * FROM super_bonuses WHERE id = $1', [bonusId]);
  }

  /**
   * Supprimer un super bonus
   */
  async deleteSuperBonus(bonusId) {
    // Les cascades s'occupent de player_active_bonuses
    return this.query(
      `DELETE FROM super_bonuses WHERE id = $1`,
      [bonusId]
    );
  }

  /**
   * Retirer un collectible d'un joueur (piège lose-collectible)
   */
  async removePlayerCollectible(playerId, collectibleId) {
    return this.query(
      `DELETE FROM player_collectibles
       WHERE player_id = $1 AND collectible_id = $2
       LIMIT 1`,
      [playerId, collectibleId]
    );
  }
}

// Export singleton
module.exports = new DatabaseWrapper();
