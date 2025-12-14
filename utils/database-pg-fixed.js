/**
 * Database Wrapper pour PostgreSQL Multi-serveur
 * Version FIXÉE pour Docker sans SSL
 */

const { Pool } = require('pg');
const url = require('url');

class DatabaseWrapper {
  constructor() {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
      throw new Error('DATABASE_URL non défini dans .env');
    }

    // Vérifier si c'est PostgreSQL
    if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
      throw new Error('DATABASE_URL doit être une URL PostgreSQL (postgresql://...)');
    }

    console.log(`🐘 Connexion à PostgreSQL...`);

    // Parser l'URL manuellement pour éviter les problèmes SSL
    const parsedUrl = new url.URL(dbUrl);

    const config = {
      host: parsedUrl.hostname,
      port: parseInt(parsedUrl.port) || 5432,
      database: parsedUrl.pathname.split('/')[1],
      user: parsedUrl.username,
      password: decodeURIComponent(parsedUrl.password),
      ssl: false, // COMPLÈTEMENT DÉSACTIVÉ
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    console.log(`📊 Config: ${config.user}@${config.host}:${config.port}/${config.database}`);

    this.pool = new Pool(config);

    // Gérer les erreurs du pool
    this.pool.on('error', (err) => {
      console.error('🔴 Erreur PostgreSQL inattendue:', err);
    });

    console.log(`✅ PostgreSQL pool créé`);
  }

  /**
   * Exécuter une requête SQL
   */
  async query(text, params = []) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log(`✅ Query executed in ${duration}ms`);
      return result.rows;
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
    const rows = await this.query(text, params);
    return rows[0] || null;
  }

  /**
   * Récupérer toutes les lignes
   */
  async queryAll(text, params = []) {
    return await this.query(text, params);
  }

  /**
   * Vérifier la connexion
   */
  async testConnection() {
    try {
      const result = await this.query("SELECT NOW() as time");
      console.log('✅ Database connected:', result[0].time);
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
    await this.pool.end();
    console.log('🔌 Database connection closed');
  }

  /**
   * Helper: Récupérer guild_id avec fallback sur process.env.GUILD_ID
   * TEMPORAIRE: Pour compatibilité avec l'ancien code mono-serveur
   */
  _getGuildId(guildId) {
    if (guildId) return guildId;
    if (process.env.GUILD_ID) {
      console.warn('⚠️  guild_id non fourni, utilisation de process.env.GUILD_ID');
      return process.env.GUILD_ID;
    }
    throw new Error('guild_id requis pour cette opération');
  }

  // ========================================
  // MÉTHODES THÈMES
  // ========================================

  async getActiveTheme(guildId) {
    guildId = this._getGuildId(guildId);
    return await this.queryOne(
      'SELECT * FROM themes WHERE guild_id = $1 AND is_active = TRUE LIMIT 1',
      [guildId]
    );
  }

  async getAllThemes(guildId) {
    guildId = this._getGuildId(guildId);
    return await this.queryAll(
      'SELECT * FROM themes WHERE guild_id = $1 ORDER BY created_at DESC',
      [guildId]
    );
  }

  async setActiveTheme(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE themes SET is_active = FALSE WHERE guild_id = $1',
        [guildId]
      );
      await client.query(
        'UPDATE themes SET is_active = TRUE WHERE id = $1 AND guild_id = $2',
        [themeId, guildId]
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createTheme(guildId, name, description, duration_days) {
    guildId = this._getGuildId(guildId);
    const result = await this.query(
      'INSERT INTO themes (guild_id, name, description, duration_days) VALUES ($1, $2, $3, $4) RETURNING *',
      [guildId, name, description, duration_days]
    );
    return result[0];
  }

  // ========================================
  // MÉTHODES COLLECTIBLES
  // ========================================

  async getCollectiblesByTheme(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return await this.queryAll(
      'SELECT * FROM collectibles WHERE guild_id = $1 AND theme_id = $2',
      [guildId, themeId]
    );
  }

  async addCollectible(guildId, playerId, collectibleId, source = 'mystery_box') {
    guildId = this._getGuildId(guildId);

    const result = await this.query(`
      INSERT INTO collections (guild_id, player_id, collectible_id, source, collected_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (guild_id, player_id, collectible_id)
      DO UPDATE SET
        collected_at = NOW(),
        lost_at = NULL,
        source = EXCLUDED.source
      RETURNING *
    `, [guildId, playerId, collectibleId, source]);

    return result[0];
  }

  // ========================================
  // MÉTHODES JOUEURS
  // ========================================

  async getOrCreatePlayer(guildId, discordId, username) {
    guildId = this._getGuildId(guildId);

    let player = await this.queryOne(
      'SELECT * FROM players WHERE guild_id = $1 AND discord_id = $2',
      [guildId, discordId]
    );

    if (!player) {
      const result = await this.query(
        'INSERT INTO players (guild_id, discord_id, username) VALUES ($1, $2, $3) RETURNING *',
        [guildId, discordId, username]
      );
      player = result[0];
    }

    return player;
  }

  async getPlayerProgress(guildId, playerId, themeId) {
    guildId = this._getGuildId(guildId);
    return await this.queryOne(
      'SELECT * FROM player_progress WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3',
      [guildId, playerId, themeId]
    );
  }

  async updatePlayerProgress(guildId, playerId, themeId, updates) {
    guildId = this._getGuildId(guildId);
    const fields = Object.keys(updates).map((key, i) => `${key} = $${i + 4}`).join(', ');
    const values = [...Object.values(updates), guildId, playerId, themeId];

    await this.query(
      `UPDATE player_progress SET ${fields} WHERE guild_id = $${values.length - 2} AND player_id = $${values.length - 1} AND theme_id = $${values.length}`,
      values
    );
  }
}

module.exports = DatabaseWrapper;
