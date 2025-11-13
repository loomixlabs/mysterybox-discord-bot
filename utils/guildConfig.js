/**
 * Utilitaire de gestion de configuration par serveur (guild)
 *
 * Fonctions helper pour récupérer et gérer les configurations
 * spécifiques à chaque serveur Discord.
 */

const db = require('./database-pg');

class GuildConfig {
  /**
   * Vérifie si un serveur est enregistré et actif
   */
  static async isActive(guildId) {
    const result = await db.query(
      'SELECT is_active FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    if (!result || result.length === 0) {
      return false;
    }

    return result[0].is_active;
  }

  /**
   * Récupère la configuration complète d'un serveur
   */
  static async getConfig(guildId) {
    const result = await db.query(
      'SELECT * FROM guild_config WHERE guild_id = $1',
      [guildId]
    );

    return result && result.length > 0 ? result[0] : null;
  }

  /**
   * Enregistre un nouveau serveur
   */
  static async registerGuild(guildId, guildName, ownerId = null) {
    const result = await db.query(`
      INSERT INTO guild_config (guild_id, guild_name, owner_id, is_active)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (guild_id) DO UPDATE
        SET guild_name = EXCLUDED.guild_name,
            last_activity = NOW()
      RETURNING *
    `, [guildId, guildName, ownerId]);

    // Créer les tables de stats
    await db.query(`
      INSERT INTO guild_stats (guild_id)
      VALUES ($1)
      ON CONFLICT (guild_id) DO NOTHING
    `, [guildId]);

    // Créer les settings d'annonces par défaut
    await db.query(`
      INSERT INTO announcement_settings (guild_id)
      VALUES ($1)
      ON CONFLICT (guild_id) DO NOTHING
    `, [guildId]);

    return result[0];
  }

  /**
   * Désactive un serveur
   */
  static async deactivate(guildId, reason = null) {
    return await db.query(`
      UPDATE guild_config
      SET is_active = FALSE,
          deactivated_at = NOW(),
          notes = $2
      WHERE guild_id = $1
      RETURNING *
    `, [guildId, reason]);
  }

  /**
   * Réactive un serveur
   */
  static async activate(guildId) {
    return await db.query(`
      UPDATE guild_config
      SET is_active = TRUE,
          activated_at = NOW(),
          deactivated_at = NULL
      WHERE guild_id = $1
      RETURNING *
    `, [guildId]);
  }

  /**
   * Met à jour la dernière activité
   */
  static async updateActivity(guildId) {
    await db.query(
      'UPDATE guild_config SET last_activity = NOW() WHERE guild_id = $1',
      [guildId]
    );
  }

  /**
   * Récupère l'ID du rôle co-fondateur
   */
  static async getCoFounderRoleId(guildId) {
    // D'abord chercher dans la config du guild
    const config = await this.getConfig(guildId);
    if (config && config.co_founder_role_id) {
      return config.co_founder_role_id;
    }

    // Sinon, fallback sur la variable d'environnement (rétro-compatibilité)
    return process.env.CO_FOUNDER_ROLE_ID || null;
  }

  /**
   * Définit l'ID du rôle co-fondateur
   */
  static async setCoFounderRoleId(guildId, roleId) {
    return await db.query(`
      UPDATE guild_config
      SET co_founder_role_id = $2
      WHERE guild_id = $1
      RETURNING *
    `, [guildId, roleId]);
  }

  /**
   * Récupère les statistiques d'un serveur
   */
  static async getStats(guildId) {
    const result = await db.query(
      'SELECT * FROM guild_stats WHERE guild_id = $1',
      [guildId]
    );

    return result && result.length > 0 ? result[0] : null;
  }

  /**
   * Met à jour les statistiques d'un serveur
   */
  static async updateStats(guildId) {
    return await db.query(`
      WITH stats AS (
        SELECT
          (SELECT COUNT(*) FROM players WHERE guild_id = $1) as total_players,
          (SELECT COUNT(*) FROM give_logs WHERE guild_id = $1) as total_gives,
          (SELECT COUNT(*) FROM give_campaigns WHERE guild_id = $1) as total_campaigns,
          (SELECT COUNT(*) FROM collections WHERE guild_id = $1) as total_collections,
          (SELECT MAX(created_at) FROM give_logs WHERE guild_id = $1) as last_give_at
      )
      UPDATE guild_stats
      SET total_players = stats.total_players,
          total_gives = stats.total_gives,
          total_campaigns = stats.total_campaigns,
          total_collections = stats.total_collections,
          last_give_at = stats.last_give_at,
          updated_at = NOW()
      FROM stats
      WHERE guild_stats.guild_id = $1
      RETURNING guild_stats.*
    `, [guildId]);
  }

  /**
   * Vérifie si un guild a atteint sa limite de joueurs
   */
  static async hasReachedPlayerLimit(guildId) {
    const config = await this.getConfig(guildId);
    if (!config || config.max_players === null) {
      return false; // Pas de limite
    }

    const stats = await this.getStats(guildId);
    return stats && stats.total_players >= config.max_players;
  }

  /**
   * Vérifie si un guild est en période d'essai
   */
  static async isTrialExpired(guildId) {
    const config = await this.getConfig(guildId);
    if (!config || !config.is_trial) {
      return false; // Pas en période d'essai
    }

    if (!config.trial_expires_at) {
      return false; // Pas de date d'expiration
    }

    return new Date(config.trial_expires_at) < new Date();
  }

  /**
   * Récupère tous les serveurs actifs
   */
  static async getAllActive() {
    return await db.query(
      'SELECT * FROM guild_config WHERE is_active = TRUE ORDER BY guild_name'
    );
  }

  /**
   * Récupère tous les serveurs (pour super-admin)
   */
  static async getAll() {
    return await db.query(`
      SELECT
        gc.*,
        gs.total_players,
        gs.total_gives,
        gs.total_campaigns,
        gs.total_collections,
        gs.last_give_at
      FROM guild_config gc
      LEFT JOIN guild_stats gs ON gc.guild_id = gs.guild_id
      ORDER BY gc.last_activity DESC
    `);
  }

  /**
   * Supprime toutes les données d'un serveur
   * ⚠️ ATTENTION: Cette action est IRREVERSIBLE
   */
  static async deleteGuild(guildId) {
    // La cascade DELETE s'occupe de supprimer toutes les données liées
    return await db.query(
      'DELETE FROM guild_config WHERE guild_id = $1 RETURNING *',
      [guildId]
    );
  }

  /**
   * Réinitialise les données d'un serveur (garde la config)
   */
  static async resetGuildData(guildId) {
    await db.query('BEGIN');

    try {
      // Supprimer les données de jeu mais garder la config
      await db.query('DELETE FROM collections WHERE guild_id = $1', [guildId]);
      await db.query('DELETE FROM player_progress WHERE guild_id = $1', [guildId]);
      await db.query('DELETE FROM player_active_bonuses WHERE guild_id = $1', [guildId]);
      await db.query('DELETE FROM mission_progress WHERE guild_id = $1', [guildId]);
      await db.query('DELETE FROM player_cooldowns WHERE guild_id = $1', [guildId]);
      await db.query('DELETE FROM player_malus_points WHERE guild_id = $1', [guildId]);
      await db.query('DELETE FROM give_logs WHERE guild_id = $1', [guildId]);
      await db.query('DELETE FROM give_campaigns WHERE guild_id = $1', [guildId]);
      await db.query('DELETE FROM players WHERE guild_id = $1', [guildId]);

      // Réinitialiser les stats
      await db.query(`
        UPDATE guild_stats
        SET total_players = 0,
            total_gives = 0,
            total_campaigns = 0,
            total_collections = 0,
            last_give_at = NULL,
            updated_at = NOW()
        WHERE guild_id = $1
      `, [guildId]);

      await db.query('COMMIT');
      return true;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Middleware pour vérifier qu'un serveur est actif
   * Utilisé dans les commandes Discord
   */
  static async checkGuildMiddleware(interaction) {
    const guildId = interaction.guild.id;

    // Vérifier si le serveur est enregistré
    const isActive = await this.isActive(guildId);

    if (!isActive) {
      // Auto-enregistrer si pas encore fait
      const guild = interaction.guild;
      await this.registerGuild(guildId, guild.name, guild.ownerId);

      console.log(`✅ Nouveau serveur auto-enregistré: ${guild.name} (${guildId})`);
      return true;
    }

    // Vérifier si la période d'essai est expirée
    if (await this.isTrialExpired(guildId)) {
      await interaction.reply({
        content: '⚠️ Votre période d\'essai est expirée. Contactez les administrateurs du bot.',
        flags: 64
      });
      return false;
    }

    // Mettre à jour l'activité
    await this.updateActivity(guildId);

    return true;
  }
}

module.exports = GuildConfig;
