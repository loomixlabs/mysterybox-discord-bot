/**
 * Database Wrapper pour PostgreSQL Multi-serveur
 *
 * Ce wrapper supporte l'architecture multi-serveur avec guild_id
 * Toutes les méthodes nécessitent maintenant un guild_id
 */

const { Pool } = require('pg');

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

    this.pool = new Pool({
      connectionString: dbUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum 20 connexions
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

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
      console.warn('⚠️  guild_id non fourni, utilisation de process.env.GUILD_ID comme fallback');
      return process.env.GUILD_ID;
    }
    throw new Error('guild_id requis mais non fourni');
  }

  // ============================================
  // MÉTHODES MULTI-SERVEUR (guild_id requis)
  // ============================================

  /**
   * Récupérer le thème actif d'un serveur
   */
  async getActiveTheme(guildId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      'SELECT * FROM themes WHERE guild_id = $1 AND is_active = TRUE LIMIT 1',
      [guildId]
    );
  }

  /**
   * Récupérer tous les thèmes d'un serveur
   */
  async getAllThemes(guildId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      'SELECT * FROM themes WHERE guild_id = $1 ORDER BY created_at DESC',
      [guildId]
    );
  }

  /**
   * Activer un thème (désactive tous les autres du serveur)
   */
  async setActiveTheme(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    await this.query('BEGIN');
    try {
      // Désactiver tous les thèmes du serveur
      await this.query(
        'UPDATE themes SET is_active = FALSE WHERE guild_id = $1',
        [guildId]
      );

      // Activer le thème choisi et définir activated_at si c'est la première activation
      await this.query(
        `UPDATE themes
         SET is_active = TRUE,
             activated_at = COALESCE(activated_at, NOW())
         WHERE guild_id = $1 AND id = $2`,
        [guildId, themeId]
      );

      await this.query('COMMIT');
      return this.queryOne('SELECT * FROM themes WHERE id = $1', [themeId]);
    } catch (error) {
      await this.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Créer un nouveau thème
   */
  async createTheme(guildId, themeData) {
    guildId = this._getGuildId(guildId);
    const { themeId, name, duration_days, required_items, final_role_name, final_role_color, final_role_discord_id } = themeData;

    await this.query('BEGIN');
    try {
      // Vérifier s'il existe d'autres thèmes pour ce serveur
      const existingThemes = await this.queryAll(
        'SELECT id FROM themes WHERE guild_id = $1',
        [guildId]
      );

      // Si c'est le premier thème du serveur, l'activer automatiquement
      const isActive = existingThemes.length === 0;

      // Insérer le thème avec activated_at si c'est le premier (pour démarrer le décompte)
      const theme = await this.queryOne(
        `INSERT INTO themes (guild_id, theme_id, name, duration_days, required_items, final_role_name, final_role_color, final_role_discord_id, is_active, activated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [guildId, themeId, name, duration_days, required_items, final_role_name, final_role_color, final_role_discord_id || null, isActive, isActive ? new Date() : null]
      );

      // Créer la configuration par défaut
      await this.query(
        `INSERT INTO theme_config (guild_id, theme_id, probability_collectible, probability_mission, probability_trap)
         VALUES ($1, $2, 40, 40, 20)`,
        [guildId, theme.id]
      );

      // Créer les missions hardcodées (Mot Deviné et Quiz)
      const hardcodedMissions = [
        {
          mission_id: 'mot-devine',
          name: 'Mot Deviné',
          type: 'keyword-message',
          description: 'Fais dire le mot secret à un autre joueur dans le salon indiqué ! ⚠️ Si TU le dis, tu échoues la mission !',
          timeout: 300,
          validation_type: 'auto'
        },
        {
          mission_id: 'quiz',
          name: 'Quiz',
          type: 'quiz',
          description: 'Réponds correctement à une question de culture générale sur le thème !',
          timeout: 60,
          validation_type: 'auto'
        }
      ];

      let motDevineMissionId = null;
      for (const missionData of hardcodedMissions) {
        const missionResult = await this.queryOne(
          `INSERT INTO missions (guild_id, theme_id, mission_id, name, type, description, timeout, validation_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            guildId,
            theme.id,
            missionData.mission_id,
            missionData.name,
            missionData.type,
            missionData.description,
            missionData.timeout,
            missionData.validation_type
          ]
        );

        // Garder l'ID de la mission "Mot Deviné" pour ajouter les mots-clés
        if (missionData.mission_id === 'mot-devine') {
          motDevineMissionId = missionResult.id;
        }
      }

      // NOTE: Les missions sont créées VIDES (sans mots-clés ni questions)
      // L'admin devra ajouter le contenu spécifique au thème via l'admin panel:
      // - Mission "Mot Deviné": Ajouter des mots-clés pertinents pour le thème
      // - Mission "Quiz": Ajouter des questions en rapport avec le thème
      console.log(`✅ Missions templates créées (vides) - l'admin devra ajouter le contenu`);

      // Créer les pièges par défaut (5 pièges génériques)
      try {
        const { createDefaultTrapsForTheme } = require('./trapDefaults');
        await createDefaultTrapsForTheme(guildId, theme.id);
      } catch (error) {
        console.error('⚠️ Erreur lors de la création des pièges par défaut:', error);
        // Ne pas bloquer la création du thème si les pièges échouent
      }

      // Créer les templates d'annonces par défaut (si premier thème du serveur)
      if (existingThemes.length === 0) {
        try {
          const { createDefaultTemplatesForGuild } = require('./announcementDefaults');
          await createDefaultTemplatesForGuild(guildId);
        } catch (error) {
          console.error('⚠️ Erreur lors de la création des templates d\'annonces:', error);
          // Ne pas bloquer la création du thème si les templates échouent
        }
      }

      await this.query('COMMIT');
      return theme;
    } catch (error) {
      await this.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Mettre à jour un thème
   */
  async updateTheme(guildId, themeId, updates) {
    guildId = this._getGuildId(guildId);
    const fields = [];
    const values = [guildId, themeId];
    let paramIndex = 3;

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    await this.query(
      `UPDATE themes SET ${fields.join(', ')}, updated_at = NOW() WHERE guild_id = $1 AND id = $2`,
      values
    );

    return this.queryOne('SELECT * FROM themes WHERE guild_id = $1 AND id = $2', [guildId, themeId]);
  }

  /**
   * Supprimer un thème (CASCADE s'occupe des dépendances)
   */
  async deleteTheme(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      'DELETE FROM themes WHERE guild_id = $1 AND id = $2',
      [guildId, themeId]
    );
  }

  /**
   * Récupérer un thème par ID
   */
  async getThemeById(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      'SELECT * FROM themes WHERE guild_id = $1 AND id = $2',
      [guildId, themeId]
    );
  }

  /**
   * Récupérer la configuration d'un thème
   */
  async getThemeConfig(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      'SELECT * FROM theme_config WHERE guild_id = $1 AND theme_id = $2',
      [guildId, themeId]
    );
  }

  /**
   * Récupérer tous les collectibles d'un thème
   */
  async getCollectiblesByTheme(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      'SELECT * FROM collectibles WHERE guild_id = $1 AND theme_id = $2 ORDER BY id',
      [guildId, themeId]
    );
  }

  /**
   * Récupérer un collectible par ID
   */
  async getCollectibleById(guildId, id) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT c.*, t.name as theme_name, t.required_items, t.final_role_name, t.final_role_color
       FROM collectibles c
       JOIN themes t ON c.theme_id = t.id
       WHERE c.guild_id = $1 AND c.id = $2`,
      [guildId, id]
    );
  }

  /**
   * Récupérer un collectible aléatoire du thème
   */
  async getRandomCollectible(guildId, themeId, rarity = null) {
    guildId = this._getGuildId(guildId);
    if (rarity) {
      return this.queryOne(
        `SELECT * FROM collectibles
         WHERE guild_id = $1 AND theme_id = $2 AND rarity = $3
         ORDER BY RANDOM()
         LIMIT 1`,
        [guildId, themeId, rarity]
      );
    }
    return this.queryOne(
      `SELECT * FROM collectibles
       WHERE guild_id = $1 AND theme_id = $2
       ORDER BY RANDOM()
       LIMIT 1`,
      [guildId, themeId]
    );
  }

  /**
   * Supprimer un collectible
   */
  async deleteCollectible(guildId, collectibleId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      'DELETE FROM collectibles WHERE guild_id = $1 AND id = $2',
      [guildId, collectibleId]
    );
  }

  /**
   * Récupérer toutes les missions d'un thème
   */
  async getMissionsByTheme(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      'SELECT * FROM missions WHERE guild_id = $1 AND theme_id = $2',
      [guildId, themeId]
    );
  }

  /**
   * Récupérer une mission par ID
   */
  async getMissionById(guildId, id) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT m.*, t.name as theme_name
       FROM missions m
       JOIN themes t ON m.theme_id = t.id
       WHERE m.guild_id = $1 AND m.id = $2`,
      [guildId, id]
    );
  }

  /**
   * Supprimer une mission
   */
  async deleteMission(guildId, id) {
    guildId = this._getGuildId(guildId);
    return this.query(
      'DELETE FROM missions WHERE guild_id = $1 AND id = $2',
      [guildId, id]
    );
  }

  /**
   * Mettre à jour les canaux autorisés pour une mission
   */
  async updateMissionAllowedChannels(guildId, missionId, channelIds) {
    guildId = this._getGuildId(guildId);

    // Si channelIds est null, on réinitialise (tous les canaux)
    // Si c'est un tableau vide ou un tableau avec des IDs, on le définit
    const channelsValue = channelIds === null ? null : channelIds;

    await this.query(
      'UPDATE missions SET allowed_channels = $3 WHERE guild_id = $1 AND id = $2',
      [guildId, missionId, channelsValue]
    );

    return this.queryOne('SELECT * FROM missions WHERE guild_id = $1 AND id = $2', [guildId, missionId]);
  }

  /**
   * Récupérer toutes les questions de quiz pour un thème
   */
  async getQuizQuestionsByTheme(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      'SELECT * FROM quiz_questions WHERE guild_id = $1 AND theme_id = $2',
      [guildId, themeId]
    );
  }

  /**
   * Récupérer une question de quiz aléatoire pour un thème
   */
  async getRandomQuizQuestion(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT * FROM quiz_questions
       WHERE guild_id = $1 AND theme_id = $2
       ORDER BY RANDOM()
       LIMIT 1`,
      [guildId, themeId]
    );
  }

  /**
   * Ajouter une question de quiz
   */
  async addQuizQuestion(guildId, themeId, questionText, correctAnswer, wrongAnswers = [], hint = null, difficulty = 'medium') {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `INSERT INTO quiz_questions (guild_id, theme_id, question_text, correct_answer, wrong_answers, hint, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [guildId, themeId, questionText, correctAnswer, wrongAnswers, hint, difficulty]
    );
  }

  /**
   * Mettre à jour une question de quiz
   */
  async updateQuizQuestion(guildId, id, data) {
    guildId = this._getGuildId(guildId);
    const fields = [];
    const values = [guildId, id];
    let paramIndex = 3;

    if (data.questionText !== undefined) {
      fields.push(`question_text = $${paramIndex++}`);
      values.push(data.questionText);
    }
    if (data.correctAnswer !== undefined) {
      fields.push(`correct_answer = $${paramIndex++}`);
      values.push(data.correctAnswer);
    }
    if (data.wrongAnswers !== undefined) {
      fields.push(`wrong_answers = $${paramIndex++}`);
      values.push(data.wrongAnswers);
    }
    if (data.hint !== undefined) {
      fields.push(`hint = $${paramIndex++}`);
      values.push(data.hint);
    }
    if (data.difficulty !== undefined) {
      fields.push(`difficulty = $${paramIndex++}`);
      values.push(data.difficulty);
    }

    fields.push(`updated_at = NOW()`);

    return this.queryOne(
      `UPDATE quiz_questions SET ${fields.join(', ')}
       WHERE guild_id = $1 AND id = $2
       RETURNING *`,
      values
    );
  }

  /**
   * Supprimer une question de quiz
   */
  async deleteQuizQuestion(guildId, id) {
    guildId = this._getGuildId(guildId);
    return this.query(
      'DELETE FROM quiz_questions WHERE guild_id = $1 AND id = $2',
      [guildId, id]
    );
  }

  /**
   * MISSION KEYWORDS - Multi-keyword management
   */

  /**
   * Récupérer tous les mots-clés d'une mission
   */
  async getMissionKeywords(guildId, missionId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      'SELECT * FROM mission_keywords WHERE guild_id = $1 AND mission_id = $2 ORDER BY id',
      [guildId, missionId]
    );
  }

  /**
   * Ajouter un mot-clé à une mission
   */
  async addMissionKeyword(guildId, missionId, keyword, channelId = null, difficulty = 'medium') {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `INSERT INTO mission_keywords (guild_id, mission_id, keyword, target_channel_id, difficulty)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [guildId, missionId, keyword, channelId, difficulty]
    );
  }

  /**
   * Supprimer un mot-clé
   */
  async deleteMissionKeyword(guildId, id) {
    guildId = this._getGuildId(guildId);
    return this.query(
      'DELETE FROM mission_keywords WHERE guild_id = $1 AND id = $2',
      [guildId, id]
    );
  }

  /**
   * Récupérer les missions "mot deviné" actives pour un canal et mot-clé
   * Filtre sur le mot-clé ASSIGNÉ au joueur (mp.target_keyword) pour éviter les collisions
   */
  async getActiveKeywordMissions(guildId, channelId, keyword) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT mp.*, m.name as mission_name, m.reward_type, m.reward_data
       FROM mission_progress mp
       JOIN missions m ON mp.mission_id = m.id
       WHERE mp.guild_id = $1
         AND mp.status = 'in_progress'
         AND m.type = 'keyword-message'
         AND mp.target_channel_id = $2
         AND LOWER(mp.target_keyword) = LOWER($3)
         AND (mp.expires_at IS NULL OR mp.expires_at > NOW())`,
      [guildId, channelId, keyword]
    );
  }

  /**
   * Récupérer tous les pièges d'un thème (seulement ceux actifs)
   */
  async getTrapsByTheme(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      'SELECT * FROM traps WHERE guild_id = $1 AND theme_id = $2 AND is_active = TRUE',
      [guildId, themeId]
    );
  }

  /**
   * Récupérer TOUS les pièges d'un thème (actifs et inactifs) - pour l'admin
   */
  async getAllTrapsByTheme(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      'SELECT * FROM traps WHERE guild_id = $1 AND theme_id = $2',
      [guildId, themeId]
    );
  }

  /**
   * Récupérer un piège par ID
   */
  async getTrapById(guildId, id) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT t.*, th.name as theme_name
       FROM traps t
       JOIN themes th ON t.theme_id = th.id
       WHERE t.guild_id = $1 AND t.id = $2`,
      [guildId, id]
    );
  }

  /**
   * Supprimer un piège (empêche la suppression des pièges par défaut)
   */
  async deleteTrap(guildId, id) {
    guildId = this._getGuildId(guildId);

    // Vérifier si c'est un piège par défaut
    const trap = await this.queryOne(
      'SELECT is_default FROM traps WHERE guild_id = $1 AND id = $2',
      [guildId, id]
    );

    if (trap && trap.is_default) {
      throw new Error('Impossible de supprimer un piège par défaut. Vous pouvez uniquement le désactiver.');
    }

    return this.query(
      'DELETE FROM traps WHERE guild_id = $1 AND id = $2',
      [guildId, id]
    );
  }

  /**
   * Activer/Désactiver un piège
   */
  async toggleTrapActive(guildId, id) {
    guildId = this._getGuildId(guildId);
    return this.query(
      'UPDATE traps SET is_active = NOT is_active WHERE guild_id = $1 AND id = $2',
      [guildId, id]
    );
  }

  /**
   * Récupérer un joueur par Discord ID
   */
  async getPlayerByDiscordId(guildId, discordId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      'SELECT * FROM players WHERE guild_id = $1 AND discord_id = $2',
      [guildId, discordId]
    );
  }

  /**
   * Récupérer un joueur par son ID interne
   */
  async getPlayer(guildId, playerId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      'SELECT * FROM players WHERE guild_id = $1 AND id = $2',
      [guildId, playerId]
    );
  }

  /**
   * Créer ou mettre à jour un joueur
   */
  async upsertPlayer(guildId, discordId, username) {
    guildId = this._getGuildId(guildId);

    // Valider que username n'est pas null/undefined
    if (!username || username === 'undefined' || username === 'null') {
      throw new Error(`upsertPlayer: username invalide (${username}) pour discordId ${discordId}`);
    }

    const result = await this.queryOne(
      `INSERT INTO players (guild_id, discord_id, username, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (guild_id, discord_id) DO UPDATE
         SET username = EXCLUDED.username,
             updated_at = NOW()
       RETURNING *`,
      [guildId, discordId, username]
    );
    return result;
  }

  /**
   * Vérifier si un joueur possède un collectible
   */
  async hasCollectible(guildId, playerId, collectibleId) {
    guildId = this._getGuildId(guildId);
    const result = await this.queryOne(
      `SELECT * FROM collections
       WHERE guild_id = $1 AND player_id = $2 AND collectible_id = $3 AND lost_at IS NULL`,
      [guildId, playerId, collectibleId]
    );
    return result !== null;
  }

  /**
   * Ajouter un collectible à un joueur
   * Si le collectible avait été perdu (lost_at défini), il sera re-collecté (lost_at = NULL)
   */
  async addCollectible(guildId, playerId, collectibleId, source = 'give') {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `INSERT INTO collections (guild_id, player_id, collectible_id, collected_at, source, lost_at)
       VALUES ($1, $2, $3, NOW(), $4, NULL)
       ON CONFLICT (guild_id, player_id, collectible_id)
       DO UPDATE SET
         collected_at = NOW(),
         source = EXCLUDED.source,
         lost_at = NULL
       RETURNING *`,
      [guildId, playerId, collectibleId, source]
    );
  }

  /**
   * Récupérer la progression d'un joueur
   */
  async getPlayerProgress(guildId, playerId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT * FROM player_progress
       WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3`,
      [guildId, playerId, themeId]
    );
  }

  /**
   * Créer ou incrémenter la progression
   * CORRECTION: Calcule le nombre DISTINCT de collectibles au lieu d'incrémenter aveuglément
   */
  async incrementProgress(guildId, playerId, themeId) {
    guildId = this._getGuildId(guildId);

    // Calculer le nombre réel de collectibles DISTINCTS pour ce joueur et ce thème
    const realCount = await this.queryOne(
      `SELECT COUNT(DISTINCT col.collectible_id) as count
       FROM collections col
       JOIN collectibles c ON col.collectible_id = c.id
       WHERE col.guild_id = $1
         AND col.player_id = $2
         AND c.theme_id = $3
         AND col.lost_at IS NULL`,
      [guildId, playerId, themeId]
    );

    const distinctCount = parseInt(realCount?.count || 0);

    // Créer ou mettre à jour avec le compteur RÉEL
    await this.queryOne(
      `INSERT INTO player_progress (guild_id, player_id, theme_id, collected_count, started_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (guild_id, player_id, theme_id) DO UPDATE
         SET collected_count = $4,
             last_collected_at = NOW()`,
      [guildId, playerId, themeId, distinctCount]
    );

    return this.getPlayerProgress(guildId, playerId, themeId);
  }

  /**
   * Marquer une collection comme complète
   */
  async completeCollection(guildId, playerId, themeId) {
    guildId = this._getGuildId(guildId);
    await this.query(
      `UPDATE player_progress
       SET is_completed = TRUE, completed_at = NOW()
       WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3`,
      [guildId, playerId, themeId]
    );
    return this.getPlayerProgress(guildId, playerId, themeId);
  }

  /**
   * Récupérer le leaderboard d'un serveur
   */
  async getLeaderboard(guildId, themeId, limit = 10) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT p.username, p.discord_id, pp.collected_count, pp.is_completed, pp.started_at
       FROM player_progress pp
       JOIN players p ON pp.player_id = p.id
       WHERE pp.guild_id = $1 AND pp.theme_id = $2
       ORDER BY pp.is_completed DESC, pp.collected_count DESC, pp.started_at ASC
       LIMIT $3`,
      [guildId, themeId, limit]
    );
  }

  /**
   * Récupérer les collectibles d'un joueur
   */
  async getPlayerCollectibles(guildId, playerId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT c.id, c.name, c.image_url, col.collected_at, col.source
       FROM collections col
       JOIN collectibles c ON col.collectible_id = c.id
       WHERE col.guild_id = $1 AND col.player_id = $2 AND c.theme_id = $3 AND col.lost_at IS NULL
       ORDER BY col.collected_at DESC`,
      [guildId, playerId, themeId]
    );
  }

  /**
   * Vérifier si un joueur a un cooldown actif
   */
  async hasActiveCooldown(guildId, playerId) {
    guildId = this._getGuildId(guildId);
    const result = await this.queryOne(
      `SELECT * FROM player_cooldowns
       WHERE guild_id = $1 AND player_id = $2
       AND is_active = TRUE
       AND expires_at > NOW()
       LIMIT 1`,
      [guildId, playerId]
    );
    return result !== null;
  }

  /**
   * Ajouter un cooldown à un joueur
   */
  async addCooldown(guildId, playerId, trapId, durationMinutes) {
    guildId = this._getGuildId(guildId);
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    return this.queryOne(
      `INSERT INTO player_cooldowns (guild_id, player_id, trap_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [guildId, playerId, trapId, expiresAt]
    );
  }

  /**
   * Ajouter/Mettre à jour les points de malédiction
   */
  async addMalusPoints(guildId, playerId, themeId, points) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `INSERT INTO player_malus_points (guild_id, player_id, theme_id, points, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (guild_id, player_id, theme_id) DO UPDATE
         SET points = player_malus_points.points + EXCLUDED.points,
             updated_at = NOW()
       RETURNING *`,
      [guildId, playerId, themeId, points]
    );
  }

  /**
   * Créer une progression de mission
   */
  async createMissionProgress(guildId, playerId, missionId, threadId = null) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `INSERT INTO mission_progress (guild_id, player_id, mission_id, thread_id, status)
       VALUES ($1, $2, $3, $4, 'in_progress')
       RETURNING *`,
      [guildId, playerId, missionId, threadId]
    );
  }

  /**
   * Compléter une mission
   */
  async completeMission(guildId, progressId, validatedBy = null) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `UPDATE mission_progress
       SET status = 'completed', completed_at = NOW(), validated_by = $3
       WHERE guild_id = $1 AND id = $2`,
      [guildId, progressId, validatedBy]
    );
  }

  /**
   * Récupérer la progression de mission active d'un joueur
   */
  async getActiveMissionProgress(guildId, playerId, missionId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT * FROM mission_progress
       WHERE guild_id = $1 AND player_id = $2 AND mission_id = $3 AND status = 'in_progress'
       LIMIT 1`,
      [guildId, playerId, missionId]
    );
  }

  /**
   * Logger un give
   */
  async logGive(guildId, giveType, itemId, messageId, channelId, campaignId = null) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `INSERT INTO give_logs (guild_id, give_type, item_id, message_id, channel_id, campaign_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [guildId, giveType, itemId, messageId, channelId, campaignId]
    );
  }

  /**
   * Mettre à jour le gagnant d'un give
   */
  async updateGiveWinner(messageId, winnerId, winnerUsername) {
    return this.query(
      `UPDATE give_logs
       SET winner_id = $1, winner_username = $2, claimed_at = NOW()
       WHERE message_id = $3`,
      [winnerId, winnerUsername, messageId]
    );
  }

  /**
   * Logger une action admin
   */
  async logAudit(guildId, action, adminId, details) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `INSERT INTO audit_logs (guild_id, action, admin_id, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [guildId, action, adminId, JSON.stringify(details)]
    );
  }

  // ============================================
  // SUPER BONUS
  // ============================================

  /**
   * Récupérer tous les super bonus d'un serveur
   */
  async getAllSuperBonuses(guildId, themeId = null) {
    guildId = this._getGuildId(guildId);
    if (themeId) {
      return this.queryAll(
        `SELECT * FROM super_bonuses
         WHERE guild_id = $1 AND (theme_id = $2 OR theme_id IS NULL)
         ORDER BY rarity DESC, name ASC`,
        [guildId, themeId]
      );
    }
    return this.queryAll(
      `SELECT * FROM super_bonuses WHERE guild_id = $1 ORDER BY rarity DESC, name ASC`,
      [guildId]
    );
  }

  /**
   * Récupérer un super bonus par ID
   */
  async getSuperBonusById(guildId, id) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT * FROM super_bonuses WHERE guild_id = $1 AND id = $2`,
      [guildId, id]
    );
  }

  /**
   * Récupérer les bonus actifs d'un joueur
   */
  async getActiveBonusesByPlayer(guildId, userId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT pab.*, sb.bonus_id, sb.name, sb.description, sb.icon, sb.effect_type, sb.effect_config, sb.duration_type, sb.color
       FROM player_active_bonuses pab
       JOIN super_bonuses sb ON pab.bonus_id = sb.id
       WHERE pab.guild_id = $1 AND pab.user_id = $2 AND pab.is_active = TRUE
       AND (pab.expires_at IS NULL OR pab.expires_at > NOW())
       ORDER BY pab.activated_at DESC`,
      [guildId, userId]
    );
  }

  /**
   * Donner un bonus à un joueur
   */
  async addBonusToPlayer(guildId, userId, bonusId, obtainedFrom = 'manual_admin', givenBy = null) {
    guildId = this._getGuildId(guildId);
    const bonus = await this.getSuperBonusById(guildId, bonusId);
    if (!bonus) {
      throw new Error(`Super bonus ${bonusId} introuvable`);
    }

    let expiresAt = null;
    if (bonus.duration_type === 'temporary' && bonus.duration_value) {
      const expirationDate = new Date(Date.now() + bonus.duration_value * 1000);
      expiresAt = expirationDate;
    }

    let remainingCharges = null;
    if (bonus.duration_type === 'charges') {
      remainingCharges = bonus.duration_value;
    }

    return this.queryOne(
      `INSERT INTO player_active_bonuses (
        guild_id, user_id, bonus_id, expires_at, remaining_charges, is_active, obtained_from, given_by
      ) VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)
      RETURNING *`,
      [guildId, userId, bonusId, expiresAt, remainingCharges, obtainedFrom, givenBy]
    );
  }

  /**
   * Consommer un bonus
   */
  async consumeBonus(guildId, activeBonusId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `UPDATE player_active_bonuses
       SET is_active = FALSE, used_at = NOW()
       WHERE guild_id = $1 AND id = $2`,
      [guildId, activeBonusId]
    );
  }

  /**
   * Décrémenter une charge de bonus
   */
  async decrementBonusCharge(guildId, activeBonusId) {
    guildId = this._getGuildId(guildId);
    await this.query(
      `UPDATE player_active_bonuses
       SET remaining_charges = remaining_charges - 1
       WHERE guild_id = $1 AND id = $2`,
      [guildId, activeBonusId]
    );

    const updated = await this.queryOne(
      `SELECT * FROM player_active_bonuses WHERE guild_id = $1 AND id = $2`,
      [guildId, activeBonusId]
    );

    if (updated && updated.remaining_charges <= 0) {
      await this.consumeBonus(guildId, activeBonusId);
    }

    return updated;
  }

  /**
   * Nettoyer les bonus expirés
   */
  async cleanupExpiredBonuses(guildId = null) {
    // Ne pas appeler _getGuildId() car cette fonction nettoie intentionnellement tous les serveurs quand guildId est null
    if (guildId) {
      return this.query(
        `UPDATE player_active_bonuses
         SET is_active = FALSE, used_at = NOW()
         WHERE guild_id = $1 AND is_active = TRUE
         AND expires_at IS NOT NULL AND expires_at <= NOW()`,
        [guildId]
      );
    }
    // Nettoyer tous les serveurs
    return this.query(
      `UPDATE player_active_bonuses
       SET is_active = FALSE, used_at = NOW()
       WHERE is_active = TRUE
       AND expires_at IS NOT NULL AND expires_at <= NOW()`
    );
  }

  // ============================================
  // CAMPAGNES
  // ============================================

  /**
   * Récupérer toutes les campagnes actives d'un serveur
   */
  async getActiveCampaigns(guildId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT * FROM give_campaigns
       WHERE guild_id = $1 AND status IN ('running', 'paused')
       ORDER BY started_at DESC`,
      [guildId]
    );
  }

  /**
   * Récupérer une campagne par ID
   */
  async getCampaignById(guildId, id) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      'SELECT * FROM give_campaigns WHERE guild_id = $1 AND id = $2',
      [guildId, id]
    );
  }

  /**
   * Créer une nouvelle campagne
   */
  async createCampaign(campaignData) {
    const guildId = this._getGuildId(campaignData.guild_id);

    // Générer un campaign_id unique
    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Mapper les données du handler vers le schéma de la table
    const campaignType = campaignData.mode; // 'burst' ou 'schedule'
    const mode = campaignData.channel_mode || 'random'; // 'random' ou 'specific'

    // Calculer total_gives_planned
    let totalGivesPlanned;
    if (campaignType === 'burst') {
      totalGivesPlanned = campaignData.total_count;
    } else {
      // Pour schedule: estimer le nombre de boîtes
      const hoursTotal = campaignData.duration_days * 24;
      totalGivesPlanned = Math.floor(hoursTotal / campaignData.frequency_hours);
    }

    // Préparer les target_channels (si spécifique)
    let channelId = null;
    let categoryId = null;
    let targetChannelsJson = null;

    if (mode === 'specific' && campaignData.target_channels && campaignData.target_channels.length > 0) {
      // Stocker le premier canal comme exemple
      channelId = campaignData.target_channels[0];
      // Stocker tous les canaux en JSON
      targetChannelsJson = JSON.stringify(campaignData.target_channels);
    }

    // Insertion
    return this.queryOne(
      `INSERT INTO give_campaigns (
        guild_id, campaign_id, theme_id, campaign_type, mode,
        burst_count, burst_interval, scheduled_duration, scheduled_interval,
        total_gives_planned, admin_id, channel_id, category_id, target_channels, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        guildId,
        campaignId,
        campaignData.theme_id,
        campaignType,
        mode,
        campaignData.total_count || null,
        campaignData.interval_seconds || null,
        campaignData.duration_days || null,
        campaignData.frequency_hours || null,
        totalGivesPlanned,
        campaignData.admin_id || 'system',
        channelId,
        categoryId,
        targetChannelsJson,
        'running'
      ]
    );
  }

  /**
   * Marquer une campagne comme démarrée
   */
  async markCampaignStarted(guildId, campaignId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `UPDATE give_campaigns
       SET started_at = NOW()
       WHERE guild_id = $1 AND id = $2`,
      [guildId, campaignId]
    );
  }

  /**
   * Incrémenter le compteur de boîtes lancées
   */
  async incrementCampaignLaunched(guildId, campaignId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `UPDATE give_campaigns
       SET total_gives_posted = total_gives_posted + 1,
           last_give_at = NOW()
       WHERE guild_id = $1 AND id = $2`,
      [guildId, campaignId]
    );
  }

  /**
   * Marquer une campagne comme complétée
   */
  async completeCampaign(guildId, campaignId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `UPDATE give_campaigns
       SET status = 'completed',
           completed_at = NOW()
       WHERE guild_id = $1 AND id = $2`,
      [guildId, campaignId]
    );
  }

  /**
   * Logger un lancement de boîte mystère dans une campagne
   */
  async logCampaignLaunch(guildId, campaignId, messageId, channelId) {
    guildId = this._getGuildId(guildId);
    // Note: cette fonction attend que give_logs existe avec la colonne campaign_id
    // Pour l'instant, on ne fait rien si la structure n'est pas prête
    // TODO: Implémenter quand give_logs sera mis à jour
    console.log(`📝 Log campaign launch: campaign=${campaignId}, message=${messageId}, channel=${channelId}`);
  }

  /**
   * Mettre à jour le statut d'une campagne
   */
  async updateCampaignStatus(guildId, campaignId, status) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `UPDATE give_campaigns
       SET status = $3
       WHERE guild_id = $1 AND id = $2`,
      [guildId, campaignId, status]
    );
  }

  /**
   * Supprimer une campagne (et ses logs associés)
   */
  async deleteCampaign(guildId, campaignId) {
    guildId = this._getGuildId(guildId);

    // Supprimer d'abord les logs associés
    await this.query(
      `DELETE FROM give_logs
       WHERE guild_id = $1 AND campaign_id = $2`,
      [guildId, campaignId]
    );

    // Puis supprimer la campagne
    return this.query(
      `DELETE FROM give_campaigns
       WHERE guild_id = $1 AND id = $2`,
      [guildId, campaignId]
    );
  }

  /**
   * Récupérer les campagnes par statut
   */
  async getCampaignsByStatus(guildId, statuses) {
    guildId = this._getGuildId(guildId);
    const placeholders = statuses.map((_, i) => `$${i + 2}`).join(', ');
    return this.queryAll(
      `SELECT * FROM give_campaigns
       WHERE guild_id = $1 AND status IN (${placeholders})
       ORDER BY started_at DESC`,
      [guildId, ...statuses]
    );
  }

  // ============================================
  // CANAUX DE GIVE
  // ============================================

  /**
   * Récupérer tous les canaux/catégories configurés
   */
  async getAllGiveChannels(guildId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT * FROM give_channels
       WHERE guild_id = $1
       ORDER BY type DESC, created_at ASC`,
      [guildId]
    );
  }

  /**
   * Ajouter un canal ou catégorie
   */
  async addGiveChannel(guildId, type, discordId, name, createdBy, parentCategoryId = null) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `INSERT INTO give_channels (guild_id, type, discord_id, name, created_by, parent_category_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [guildId, type, discordId, name, createdBy, parentCategoryId]
    );
  }

  /**
   * Supprimer un canal ou catégorie
   */
  async deleteGiveChannel(guildId, discordId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `DELETE FROM give_channels WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, discordId]
    );
  }

  /**
   * Récupérer tous les IDs de canaux configurés
   */
  async getAllGiveChannelIds(guildId) {
    guildId = this._getGuildId(guildId);
    const results = await this.queryAll(
      `SELECT discord_id FROM give_channels WHERE guild_id = $1 AND type = 'channel'`,
      [guildId]
    );
    return results.map(r => r.discord_id);
  }

  /**
   * Récupérer uniquement les catégories configurées
   */
  async getGiveCategories(guildId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT * FROM give_channels WHERE guild_id = $1 AND type = 'category' ORDER BY created_at ASC`,
      [guildId]
    );
  }

  /**
   * Récupérer uniquement les canaux configurés (alias pour compatibilité)
   */
  async getGiveChannelsList(guildId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT * FROM give_channels WHERE guild_id = $1 AND type = 'channel' ORDER BY created_at ASC`,
      [guildId]
    );
  }

  /**
   * Vérifier si un canal/catégorie existe déjà
   */
  async giveChannelExists(guildId, discordId) {
    guildId = this._getGuildId(guildId);
    const result = await this.queryOne(
      `SELECT id FROM give_channels WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, discordId]
    );
    return !!result;
  }

  /**
   * Récupérer un canal/catégorie par son discord_id
   */
  async getGiveChannelById(guildId, discordId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT * FROM give_channels WHERE guild_id = $1 AND discord_id = $2`,
      [guildId, discordId]
    );
  }

  /**
   * Récupérer tous les canaux qui appartiennent à une catégorie
   */
  async getChannelsByCategory(guildId, categoryDiscordId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT * FROM give_channels
       WHERE guild_id = $1
         AND type = 'channel'
         AND parent_category_id = $2
       ORDER BY name ASC`,
      [guildId, categoryDiscordId]
    );
  }

  // ============================================
  // ANNONCES
  // ============================================

  /**
   * Récupérer le canal d'annonces
   */
  async getAnnouncementChannel(guildId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT * FROM announcement_channel WHERE guild_id = $1`,
      [guildId]
    );
  }

  /**
   * Définir le canal d'annonces
   */
  async setAnnouncementChannel(guildId, channelId, channelName) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `INSERT INTO announcement_channel (guild_id, channel_id, channel_name, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (guild_id) DO UPDATE
         SET channel_id = EXCLUDED.channel_id,
             channel_name = EXCLUDED.channel_name,
             updated_at = NOW()
       RETURNING *`,
      [guildId, channelId, channelName]
    );
  }

  /**
   * Récupérer les paramètres d'annonces
   */
  async getAnnouncementSettings(guildId) {
    guildId = this._getGuildId(guildId);
    let settings = await this.queryOne(
      `SELECT * FROM announcement_settings WHERE guild_id = $1`,
      [guildId]
    );

    // Si aucun paramètre n'existe, créer des paramètres par défaut
    if (!settings) {
      await this.query(
        `INSERT INTO announcement_settings (
          guild_id, legendary_collectible, collection_completed, collection_traded,
          collection_lost, trap_curse, trap_cooldown, trap_lose_collectible,
          trap_public_shame, trap_malus_points, mission_word_guessed, theme_expired,
          theme_expiring_soon, mission_started, mission_completed, mission_failed,
          mission_approved, mission_rejected
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [guildId, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
      );

      settings = await this.queryOne(
        `SELECT * FROM announcement_settings WHERE guild_id = $1`,
        [guildId]
      );
    }

    return settings;
  }

  /**
   * Mettre à jour les paramètres d'annonces
   */
  async updateAllAnnouncementSettings(guildId, settings) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `INSERT INTO announcement_settings (
        guild_id, legendary_collectible, collection_completed, collection_traded,
        collection_lost, trap_curse, trap_cooldown, trap_lose_collectible,
        trap_public_shame, trap_malus_points, mission_word_guessed, theme_expired,
        theme_expiring_soon, mission_started, mission_completed, mission_failed,
        mission_approved, mission_rejected
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       ON CONFLICT (guild_id) DO UPDATE
         SET legendary_collectible = EXCLUDED.legendary_collectible,
             collection_completed = EXCLUDED.collection_completed,
             collection_traded = EXCLUDED.collection_traded,
             collection_lost = EXCLUDED.collection_lost,
             trap_curse = EXCLUDED.trap_curse,
             trap_cooldown = EXCLUDED.trap_cooldown,
             trap_lose_collectible = EXCLUDED.trap_lose_collectible,
             trap_public_shame = EXCLUDED.trap_public_shame,
             trap_malus_points = EXCLUDED.trap_malus_points,
             mission_word_guessed = EXCLUDED.mission_word_guessed,
             theme_expired = EXCLUDED.theme_expired,
             theme_expiring_soon = EXCLUDED.theme_expiring_soon,
             mission_started = EXCLUDED.mission_started,
             mission_completed = EXCLUDED.mission_completed,
             mission_failed = EXCLUDED.mission_failed,
             mission_approved = EXCLUDED.mission_approved,
             mission_rejected = EXCLUDED.mission_rejected,
             updated_at = NOW()`,
      [
        guildId,
        settings.legendary_collectible,
        settings.collection_completed,
        settings.collection_traded,
        settings.collection_lost,
        settings.trap_curse,
        settings.trap_cooldown ?? true,
        settings.trap_lose_collectible ?? true,
        settings.trap_public_shame ?? true,
        settings.trap_malus_points ?? true,
        settings.mission_word_guessed,
        settings.theme_expired ?? false,
        settings.theme_expiring_soon ?? false,
        settings.mission_started ?? false,
        settings.mission_completed ?? false,
        settings.mission_failed ?? false,
        settings.mission_approved ?? false,
        settings.mission_rejected ?? false
      ]
    );
  }

  /**
   * Supprimer le canal d'annonces
   */
  async deleteAnnouncementChannel(guildId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `DELETE FROM announcement_channel WHERE guild_id = $1`,
      [guildId]
    );
  }

  /**
   * Récupérer un template d'annonce
   */
  async getAnnouncementTemplate(type, guildId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT * FROM announcement_templates WHERE guild_id = $1 AND type = $2`,
      [guildId, type]
    );
  }

  /**
   * Mettre à jour un template d'annonce
   */
  async updateAnnouncementTemplate(type, updates, guildId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text, image_url, thumbnail_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (guild_id, type) DO UPDATE
         SET title = EXCLUDED.title,
             description = EXCLUDED.description,
             color = EXCLUDED.color,
             footer_text = EXCLUDED.footer_text,
             image_url = EXCLUDED.image_url,
             thumbnail_url = EXCLUDED.thumbnail_url,
             updated_at = NOW()`,
      [
        guildId,
        type,
        updates.title,
        updates.description,
        updates.color || '#3498db',
        updates.footer_text || 'Système d\'annonces',
        updates.image_url || null,
        updates.thumbnail_url || null
      ]
    );
  }

  /**
   * Réinitialiser un template aux valeurs par défaut
   */
  async resetAnnouncementTemplate(type, guildId) {
    guildId = this._getGuildId(guildId);
    // Supprimer le template personnalisé pour revenir aux templates par défaut du script init
    return this.query(
      `DELETE FROM announcement_templates WHERE guild_id = $1 AND type = $2`,
      [guildId, type]
    );
  }

  /**
   * Récupérer la configuration d'un serveur
   */
  async getGuildConfig(guildId) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `SELECT * FROM guild_config WHERE guild_id = $1`,
      [guildId]
    );
  }

  /**
   * Mettre à jour un paramètre d'annonce spécifique (pour les toggles)
   */
  async updateAnnouncementSetting(settingName, value, guildId) {
    guildId = this._getGuildId(guildId);

    // D'abord, récupérer les paramètres actuels
    const currentSettings = await this.getAnnouncementSettings(guildId);

    if (!currentSettings) {
      // Créer les paramètres par défaut si ils n'existent pas
      const defaultSettings = {
        legendary_collectible: false,
        collection_completed: false,
        collection_traded: false,
        collection_lost: false,
        trap_curse: false,
        trap_cooldown: true,
        trap_lose_collectible: true,
        trap_public_shame: true,
        trap_malus_points: true,
        mission_word_guessed: false,
        theme_expired: false,
        theme_expiring_soon: false
      };
      defaultSettings[settingName] = value;
      return this.updateAllAnnouncementSettings(guildId, defaultSettings);
    }

    // Mettre à jour seulement le paramètre spécifié
    currentSettings[settingName] = value;
    return this.updateAllAnnouncementSettings(guildId, currentSettings);
  }

  /**
   * Récupérer tous les templates d'annonces
   */
  async getAllAnnouncementTemplates(guildId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT * FROM announcement_templates WHERE guild_id = $1 ORDER BY type`,
      [guildId]
    );
  }

  /**
   * Supprimer un collectible d'un joueur (pour le piège lose-collectible)
   * @param {string} guildId - ID du serveur Discord
   * @param {number} playerId - ID du joueur
   * @param {number} collectibleId - ID du collectible à supprimer
   * @returns {Promise<Object|null>} Collectible supprimé ou null
   */
  async removePlayerCollectible(guildId, playerId, collectibleId) {
    guildId = this._getGuildId(guildId);

    // Récupérer les infos du collectible AVANT suppression (pour le log et décrement)
    const collection = await this.queryOne(
      `SELECT c.*, col.name, col.theme_id
       FROM collections c
       JOIN collectibles col ON c.collectible_id = col.id
       WHERE c.player_id = $1 AND c.guild_id = $2 AND c.collectible_id = $3 AND c.lost_at IS NULL
       LIMIT 1`,
      [playerId, guildId, collectibleId]
    );

    if (!collection) {
      console.log(`⚠️ Aucun collectible actif à supprimer (player=${playerId}, collectible=${collectibleId})`);
      return null;
    }

    // Soft delete: marquer comme perdu au lieu de supprimer
    await this.query(
      `UPDATE collections
       SET lost_at = NOW()
       WHERE id = $1 AND guild_id = $2`,
      [collection.id, guildId]
    );

    // Recalculer le compteur réel au lieu de juste décrémenter (plus fiable)
    const realCount = await this.queryOne(
      `SELECT COUNT(DISTINCT c.collectible_id) as count
       FROM collections c
       JOIN collectibles col ON c.collectible_id = col.id
       WHERE c.player_id = $1 AND c.guild_id = $2 AND col.theme_id = $3 AND c.lost_at IS NULL`,
      [playerId, guildId, collection.theme_id]
    );

    await this.query(
      `UPDATE player_progress
       SET collected_count = $1
       WHERE player_id = $2 AND guild_id = $3 AND theme_id = $4`,
      [parseInt(realCount?.count || 0), playerId, guildId, collection.theme_id]
    );

    console.log(`🗑️ Collectible perdu: ${collection.name} (player=${playerId}, guild=${guildId}, nouveau compteur=${realCount?.count || 0})`);
    return collection;
  }
}

// Export singleton
module.exports = new DatabaseWrapper();
