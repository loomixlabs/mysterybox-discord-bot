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
      ssl: false, // DÉSACTIVÉ pour Docker (évite les erreurs SSL en production)
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

      // Vérifier s'il existe un thème ACTIF pour ce serveur
      const existingActiveTheme = await this.queryOne(
        'SELECT id FROM themes WHERE guild_id = $1 AND is_active = TRUE',
        [guildId]
      );

      // Activer le nouveau thème uniquement s'il n'y a pas de thème déjà actif
      // (même comportement que l'import de thème)
      const isActive = !existingActiveTheme;

      // Insérer le thème avec activated_at si c'est le premier (pour démarrer le décompte)
      const theme = await this.queryOne(
        `INSERT INTO themes (guild_id, theme_id, name, duration_days, required_items, final_role_name, final_role_color, final_role_discord_id, is_active, activated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [guildId, themeId, name, duration_days, required_items, final_role_name, final_role_color, final_role_discord_id || null, isActive, isActive ? new Date() : null]
      );

      // Créer la configuration par défaut
      await this.query(
        `INSERT INTO theme_config (guild_id, theme_id, probability_collectible, probability_mission, probability_trap, probability_super_bonus)
         VALUES ($1, $2, 50, 25, 15, 10)`,
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

      // COMMIT la transaction principale AVANT de créer pièges/templates
      // (pour éviter qu'une erreur dans les pièges ne rollback le thème)
      await this.query('COMMIT');
      console.log(`✅ Transaction COMMIT - Thème ${theme.name} créé avec succès`);

      // Créer les pièges par défaut (EN DEHORS de la transaction)
      try {
        const { createDefaultTrapsForTheme } = require('./trapDefaults');
        await createDefaultTrapsForTheme(guildId, theme.id);
      } catch (error) {
        console.error('⚠️ Erreur lors de la création des pièges par défaut:', error);
        // Ne pas bloquer la création du thème si les pièges échouent
      }

      // Créer les templates d'annonces par défaut POUR CE THÈME SPÉCIFIQUE
      // (chaque thème a ses propres templates, pas de réutilisation des anciens)
      try {
        const { createDefaultTemplatesForTheme, createDefaultTemplatesForGuild } = require('./announcementDefaults');

        // Créer les templates spécifiques au thème (avec theme_id = theme.id)
        await createDefaultTemplatesForTheme(guildId, theme.id);

        // Si c'est le premier thème, aussi créer les settings d'annonces (toggles)
        if (existingThemes.length === 0) {
          await createDefaultTemplatesForGuild(guildId);
        }
      } catch (error) {
        console.error('⚠️ Erreur lors de la création des templates d\'annonces:', error);
        // Ne pas bloquer la création du thème si les templates échouent
      }

      // Créer les récompenses quotidiennes par défaut (preset "classic")
      try {
        await this.seedDefaultDailyRewards(guildId, theme.id, theme.duration_days || 30);
        console.log(`✅ Récompenses quotidiennes par défaut créées pour le thème ${theme.name}`);
      } catch (error) {
        console.error('⚠️ Erreur lors de la création des récompenses quotidiennes:', error);
        // Ne pas bloquer la création du thème si les récompenses échouent
      }

      // Créer les Mystery Boxes par défaut (une par rareté)
      try {
        await this.seedDefaultMysteryBoxes(guildId, theme.id);
        console.log(`✅ Mystery Boxes par défaut créées pour le thème ${theme.name}`);
      } catch (error) {
        console.error('⚠️ Erreur lors de la création des Mystery Boxes:', error);
        // Ne pas bloquer la création du thème si les boxes échouent
      }

      return theme;
    } catch (error) {
      await this.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Prolonger la durée d'un thème actif
   */
  async extendTheme(guildId, additionalDays) {
    guildId = this._getGuildId(guildId);

    const result = await this.queryOne(
      `UPDATE themes
       SET duration_days = CASE
         WHEN duration_days IS NULL THEN $2
         ELSE duration_days + $2
       END
       WHERE guild_id = $1 AND is_active = TRUE
       RETURNING *`,
      [guildId, additionalDays]
    );

    if (!result) {
      throw new Error('Aucun thème actif trouvé pour ce serveur');
    }

    return result;
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
   * Récupérer un message personnalisé du thème
   * @param {string} guildId - ID du serveur
   * @param {number} themeId - ID du thème
   * @param {string} key - Clé du message (ex: 'mystery_box_button_label')
   * @returns {string|null} Le contenu du message ou null si non trouvé
   */
  async getThemeMessage(guildId, themeId, key) {
    guildId = this._getGuildId(guildId);
    const result = await this.queryOne(
      'SELECT content FROM theme_messages WHERE guild_id = $1 AND theme_id = $2 AND key = $3',
      [guildId, themeId, key]
    );
    return result?.content || null;
  }

  /**
   * Récupérer tous les messages personnalisés d'un thème
   * @param {string} guildId - ID du serveur
   * @param {number} themeId - ID du thème
   * @returns {Object} Object avec les clés de message comme propriétés
   */
  async getThemeMessages(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    const messages = await this.queryAll(
      'SELECT key, content FROM theme_messages WHERE guild_id = $1 AND theme_id = $2',
      [guildId, themeId]
    );
    // Convertir en objet {key: content}
    return messages.reduce((acc, msg) => {
      acc[msg.key] = msg.content;
      return acc;
    }, {});
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
      `SELECT c.*, t.name as theme_name, t.required_items,
              t.final_role_name, t.final_role_color, t.final_role_discord_id
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
   * Récupérer tous les collectibles d'une rareté donnée pour un thème
   * N'exclut PAS les collectibles déjà possédés (permet les doublons)
   */
  async getCollectiblesByRarity(guildId, themeId, rarity) {
    guildId = this._getGuildId(guildId);

    // Mapping des raretés (anglais API → français DB)
    const rarityMap = {
      'common': 'Commun',
      'rare': 'Rare',
      'epic': 'Épique',
      'legendary': 'Légendaire'
    };

    const dbRarity = rarityMap[rarity.toLowerCase()] || rarity;

    return this.queryAll(
      `SELECT * FROM collectibles
       WHERE guild_id = $1 AND theme_id = $2 AND rarity = $3
       ORDER BY RANDOM()`,
      [guildId, themeId, dbRarity]
    );
  }

  /**
   * Sélectionner UN collectible aléatoire pour une Mystery Box par rareté
   * Logique: 100% de chance pour la rareté demandée + X% de chance d'upgrade
   *
   * @param {string} guildId - ID du serveur
   * @param {number} themeId - ID du thème actif
   * @param {string} rarity - Rareté de base (common, rare, epic, legendary)
   * @param {number} upgradeChance - % de chance d'avoir une rareté supérieure (default: 10%)
   * @returns {Object|null} Le collectible sélectionné avec info d'upgrade
   */
  async getCollectibleForMysteryBoxRarity(guildId, themeId, rarity, upgradeChance = 10) {
    guildId = this._getGuildId(guildId);

    // Ordre des raretés (du plus bas au plus haut)
    const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
    const currentIndex = rarityOrder.indexOf(rarity.toLowerCase());

    if (currentIndex === -1) {
      console.error(`❌ Rareté inconnue: ${rarity}`);
      return null;
    }

    // Tenter un upgrade si possible (pas déjà au max)
    let finalRarity = rarity.toLowerCase();
    let wasUpgraded = false;

    if (currentIndex < rarityOrder.length - 1) {
      const roll = Math.random() * 100;
      if (roll < upgradeChance) {
        finalRarity = rarityOrder[currentIndex + 1];
        wasUpgraded = true;
        console.log(`🎰 UPGRADE! ${rarity} → ${finalRarity} (roll: ${roll.toFixed(2)}% < ${upgradeChance}%)`);
      }
    }

    // Récupérer les collectibles de la rareté finale
    const collectibles = await this.getCollectiblesByRarity(guildId, themeId, finalRarity);

    if (!collectibles || collectibles.length === 0) {
      // Si pas de collectible à la rareté upgrade, fallback sur la rareté de base
      if (wasUpgraded) {
        console.log(`⚠️ Pas de collectible ${finalRarity}, fallback sur ${rarity}`);
        finalRarity = rarity.toLowerCase();
        wasUpgraded = false;
        const fallbackCollectibles = await this.getCollectiblesByRarity(guildId, themeId, finalRarity);
        if (!fallbackCollectibles || fallbackCollectibles.length === 0) {
          return null;
        }
        const selected = fallbackCollectibles[Math.floor(Math.random() * fallbackCollectibles.length)];
        return { ...selected, wasUpgraded: false, originalRarity: rarity, finalRarity };
      }
      return null;
    }

    // Sélectionner un collectible aléatoire
    const selected = collectibles[Math.floor(Math.random() * collectibles.length)];
    return {
      ...selected,
      wasUpgraded,
      originalRarity: rarity,
      finalRarity
    };
  }

  /**
   * @deprecated Utilisez getCollectibleForMysteryBoxRarity à la place
   * Ancienne fonction maintenue pour compatibilité
   */
  async getCollectiblesForMysteryBoxRarity(guildId, themeId, rarity, playerId = null) {
    // Redirige vers la nouvelle fonction sans exclusion
    return this.getCollectiblesByRarity(guildId, themeId, rarity);
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
   * Récupérer toutes les questions de quiz pour un thème (LEGACY - utiliser getQuizQuestionsByMission)
   */
  async getQuizQuestionsByTheme(guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      'SELECT * FROM quiz_questions WHERE guild_id = $1 AND theme_id = $2',
      [guildId, themeId]
    );
  }

  /**
   * Récupérer toutes les questions de quiz pour une mission spécifique
   */
  async getQuizQuestionsByMission(guildId, missionId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      'SELECT * FROM quiz_questions WHERE guild_id = $1 AND mission_id = $2',
      [guildId, missionId]
    );
  }

  /**
   * Récupérer une question de quiz aléatoire pour un thème (LEGACY)
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
   * Récupérer une question de quiz aléatoire pour une mission spécifique
   * Filtre par guild_id, mission_id ET theme_id pour une sécurité maximale
   */
  async getRandomQuizQuestionByMission(guildId, missionId, themeId = null) {
    guildId = this._getGuildId(guildId);

    // Si themeId est fourni, filtrer aussi par thème pour plus de sécurité
    if (themeId) {
      return this.queryOne(
        `SELECT * FROM quiz_questions
         WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3
         ORDER BY RANDOM()
         LIMIT 1`,
        [guildId, missionId, themeId]
      );
    }

    return this.queryOne(
      `SELECT * FROM quiz_questions
       WHERE guild_id = $1 AND mission_id = $2
       ORDER BY RANDOM()
       LIMIT 1`,
      [guildId, missionId]
    );
  }

  /**
   * Récupérer N questions true-false aléatoires pour une mission
   * @param {string} guildId - ID du serveur
   * @param {number} missionId - ID de la mission
   * @param {number} themeId - ID du thème (optionnel)
   * @param {number} count - Nombre de questions à récupérer
   * @returns {Array} Liste de questions
   */
  async getRandomTrueFalseQuestions(guildId, missionId, themeId = null, count = 3) {
    guildId = this._getGuildId(guildId);

    // Pour true-false, correct_answer doit être 'vrai' ou 'faux'
    if (themeId) {
      return this.queryAll(
        `SELECT * FROM quiz_questions
         WHERE guild_id = $1 AND mission_id = $2 AND theme_id = $3
         AND LOWER(correct_answer) IN ('vrai', 'faux', 'true', 'false')
         ORDER BY RANDOM()
         LIMIT $4`,
        [guildId, missionId, themeId, count]
      );
    }

    return this.queryAll(
      `SELECT * FROM quiz_questions
       WHERE guild_id = $1 AND mission_id = $2
       AND LOWER(correct_answer) IN ('vrai', 'faux', 'true', 'false')
       ORDER BY RANDOM()
       LIMIT $3`,
      [guildId, missionId, count]
    );
  }

  /**
   * Ajouter une question de quiz (LEGACY sans mission_id)
   */
  async addQuizQuestion(guildId, themeId, questionText, correctAnswer, wrongAnswers = [], hint = null, difficulty = 'medium', missionId = null) {
    guildId = this._getGuildId(guildId);
    return this.queryOne(
      `INSERT INTO quiz_questions (guild_id, theme_id, question_text, correct_answer, wrong_answers, hint, difficulty, mission_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [guildId, themeId, questionText, correctAnswer, wrongAnswers, hint, difficulty, missionId]
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
   * Ajouter une mission
   */
  async addMission(guildId, themeId, missionId, name, type, description, validationData, timeout, imageUrl = null, rewardType = 'random-collectible', rewardData = null) {
    guildId = this._getGuildId(guildId);
    // Déterminer le type de validation selon le type de mission
    const autoValidationTypes = ['quiz', 'keyword-message', 'true-false', 'emoji-puzzle', 'wordle', 'unscramble', 'hangman'];
    const validationType = autoValidationTypes.includes(type) ? 'auto' : 'manual';

    return this.queryOne(
      `INSERT INTO missions (guild_id, theme_id, mission_id, name, type, description, validation_type, validation_data, timeout, image_url, reward_type, reward_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [guildId, themeId, missionId, name, type, description, validationType, validationData, timeout, imageUrl, rewardType, rewardData]
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
   * @deprecated Utiliser getActiveKeywordMissionsInChannel() + filtrage JS avec quizAnswerMatcher
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
   * Récupérer TOUTES les missions "mot deviné" actives pour un canal
   * Le filtrage par mot-clé se fait côté JS avec quizAnswerMatcher pour gérer les accents
   */
  async getActiveKeywordMissionsInChannel(guildId, channelId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT mp.*, m.name as mission_name, m.reward_type, m.reward_data
       FROM mission_progress mp
       JOIN missions m ON mp.mission_id = m.id
       WHERE mp.guild_id = $1
         AND mp.status = 'in_progress'
         AND m.type = 'keyword-message'
         AND mp.target_channel_id = $2
         AND mp.target_keyword IS NOT NULL
         AND (mp.expires_at IS NULL OR mp.expires_at > NOW())`,
      [guildId, channelId]
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
   * Utilise INSERT ... ON CONFLICT pour:
   * - Créer un nouvel enregistrement si nouveau collectible
   * - Mettre à jour si le collectible existe déjà (doublon = update collected_at/source)
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
      `SELECT p.username, p.discord_id, pp.collected_count, pp.is_completed, pp.started_at, pp.completed_at
       FROM player_progress pp
       JOIN players p ON pp.player_id = p.id AND pp.guild_id = p.guild_id
       WHERE pp.guild_id = $1 AND pp.theme_id = $2
       ORDER BY pp.is_completed DESC, pp.completed_at ASC NULLS LAST, pp.collected_count DESC, pp.started_at ASC
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
    // FIX: Utiliser NOW() + INTERVAL côté PostgreSQL pour éviter les problèmes de timezone
    return this.queryOne(
      `INSERT INTO player_cooldowns (guild_id, player_id, trap_id, started_at, expires_at)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '1 minute' * $4)
       RETURNING *`,
      [guildId, playerId, trapId, durationMinutes]
    );
  }

  /**
   * Supprimer tous les cooldowns actifs d'un joueur (Accélérateur de Cooldown)
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @returns {number} Nombre de cooldowns supprimés
   */
  async removeAllCooldowns(guildId, playerId) {
    guildId = this._getGuildId(guildId);
    const result = await this.query(
      `UPDATE player_cooldowns
       SET is_active = FALSE
       WHERE guild_id = $1 AND player_id = $2
       AND is_active = TRUE
       AND expires_at > NOW()`,
      [guildId, playerId]
    );
    return result.rowCount || 0;
  }

  /**
   * Récupérer les cooldowns actifs d'un joueur avec détails
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @returns {Array} Liste des cooldowns actifs avec infos piège
   */
  async getActiveCooldowns(guildId, playerId) {
    guildId = this._getGuildId(guildId);
    return this.queryAll(
      `SELECT pc.*, t.name as trap_name, t.cooldown_duration,
              EXTRACT(EPOCH FROM (pc.expires_at - NOW())) / 60 as minutes_left
       FROM player_cooldowns pc
       LEFT JOIN traps t ON pc.trap_id = t.id
       WHERE pc.guild_id = $1 AND pc.player_id = $2
       AND pc.is_active = TRUE
       AND pc.expires_at > NOW()
       ORDER BY pc.expires_at ASC`,
      [guildId, playerId]
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
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} missionId - ID de la mission
   * @param {string|null} threadId - ID du thread de mission
   * @param {object|null} gameState - État du jeu (pour permission temporaire, etc.)
   */
  async createMissionProgress(guildId, playerId, missionId, threadId = null, gameState = null) {
    guildId = this._getGuildId(guildId);
    try {
      return await this.queryOne(
        `INSERT INTO mission_progress (guild_id, player_id, mission_id, thread_id, status, game_state)
         VALUES ($1, $2, $3, $4, 'in_progress', $5)
         RETURNING *`,
        [guildId, playerId, missionId, threadId, gameState ? JSON.stringify(gameState) : null]
      );
    } catch (error) {
      // 🔒 RACE CONDITION: Si violation de contrainte unique (23505), le joueur a déjà une mission active
      if (error.code === '23505' && error.constraint === 'idx_mission_progress_one_active_per_player') {
        console.warn(`⚠️ [RACE CONDITION] Joueur ${playerId} a tenté de créer une 2ème mission active - bloqué par contrainte DB`);
        return null; // Retourner null pour signaler l'échec
      }
      throw error; // Re-throw autres erreurs
    }
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
  async getAllSuperBonuses(guildId, themeId = null, activeOnly = false) {
    guildId = this._getGuildId(guildId);

    // Construire la clause WHERE
    let whereClause = 'WHERE guild_id = $1';
    let params = [guildId];

    if (themeId) {
      whereClause += ' AND (theme_id = $2 OR theme_id IS NULL)';
      params.push(themeId);
    }

    if (activeOnly) {
      whereClause += ' AND is_enabled = TRUE';
    }

    return this.queryAll(
      `SELECT * FROM super_bonuses ${whereClause} ORDER BY rarity DESC, name ASC`,
      params
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
      `SELECT pab.id, pab.bonus_id, pab.remaining_charges, pab.activated_at, pab.expires_at, pab.is_active,
              sb.name, sb.description, sb.icon, sb.effect_type, sb.effect_config, sb.duration_type, sb.duration_value, sb.color, sb.bonus_type
       FROM player_active_bonuses pab
       JOIN super_bonuses sb ON pab.bonus_id = sb.id
       WHERE pab.guild_id = $1 AND pab.user_id = $2 AND pab.is_active = TRUE
       AND (pab.expires_at IS NULL OR pab.expires_at > NOW())
       ORDER BY pab.activated_at DESC NULLS LAST`,
      [guildId, userId]
    );
  }

  /**
   * Donner un bonus à un joueur
   * Si le joueur a déjà ce bonus actif, cumule les charges ou étend la durée
   */
  async addBonusToPlayer(guildId, userId, bonusId, obtainedFrom = 'manual_admin', givenBy = null) {
    guildId = this._getGuildId(guildId);
    const bonus = await this.getSuperBonusById(guildId, bonusId);
    if (!bonus) {
      throw new Error(`Super bonus ${bonusId} introuvable`);
    }

    // Vérifier si le joueur a déjà ce bonus actif
    const existingBonus = await this.queryOne(
      `SELECT * FROM player_active_bonuses
       WHERE guild_id = $1 AND user_id = $2 AND bonus_id = $3 AND is_active = TRUE`,
      [guildId, userId, bonusId]
    );

    if (existingBonus) {
      // Bonus existant trouvé - cumuler selon le type
      if (bonus.duration_type === 'charges') {
        // Ajouter les charges au bonus existant
        const additionalCharges = bonus.duration_value || 1;
        return this.queryOne(
          `UPDATE player_active_bonuses
           SET remaining_charges = remaining_charges + $1
           WHERE guild_id = $2 AND id = $3
           RETURNING *`,
          [additionalCharges, guildId, existingBonus.id]
        );
      } else if (bonus.duration_type === 'temporary' && bonus.duration_value) {
        // Étendre la durée du bonus existant
        const additionalSeconds = bonus.duration_value;
        return this.queryOne(
          `UPDATE player_active_bonuses
           SET expires_at = expires_at + INTERVAL '${additionalSeconds} seconds'
           WHERE guild_id = $1 AND id = $2
           RETURNING *`,
          [guildId, existingBonus.id]
        );
      } else {
        // Bonus permanent ou sans durée - retourner l'existant
        console.log(`⚡ Bonus ${bonus.name} déjà actif pour l'utilisateur (permanent)`);
        return existingBonus;
      }
    }

    // Aucun bonus existant - créer un nouveau
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
          trap_public_shame, trap_malus_points, trap_empty_box, trap_lose_all_collectibles,
          mission_word_guessed, theme_expired, theme_expiring_soon, mission_started,
          mission_completed, mission_failed, mission_approved, mission_rejected
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [guildId, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
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
        mission_approved, mission_rejected, trap_lose_all_collectibles
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
             trap_lose_all_collectibles = EXCLUDED.trap_lose_all_collectibles,
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
        settings.mission_rejected ?? false,
        settings.trap_lose_all_collectibles ?? true
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
   * Stratégie: Cherche d'abord un template lié au thème actif, sinon fallback vers template global
   */
  async getAnnouncementTemplate(type, guildId) {
    guildId = this._getGuildId(guildId);

    // 1. Récupérer le thème actif pour ce serveur
    const activeTheme = await this.queryOne(
      `SELECT id FROM themes WHERE guild_id = $1 AND is_active = TRUE`,
      [guildId]
    );

    // 2. Si thème actif, chercher template spécifique au thème
    if (activeTheme) {
      const themeTemplate = await this.queryOne(
        `SELECT * FROM announcement_templates WHERE guild_id = $1 AND type = $2 AND theme_id = $3`,
        [guildId, type, activeTheme.id]
      );
      if (themeTemplate) return themeTemplate;
    }

    // 3. Fallback vers template global (theme_id IS NULL)
    return this.queryOne(
      `SELECT * FROM announcement_templates WHERE guild_id = $1 AND type = $2 AND theme_id IS NULL`,
      [guildId, type]
    );
  }

  /**
   * Mettre à jour un template d'annonce global (theme_id = NULL)
   */
  async updateAnnouncementTemplate(type, updates, guildId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text, image_url, thumbnail_url, theme_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
       ON CONFLICT (guild_id, type, theme_id)
       WHERE theme_id IS NULL
       DO UPDATE SET
         title = EXCLUDED.title,
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
   * Mettre à jour un template d'annonce pour un thème spécifique
   */
  async updateAnnouncementTemplateForTheme(type, updates, guildId, themeId) {
    guildId = this._getGuildId(guildId);
    return this.query(
      `INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text, image_url, thumbnail_url, theme_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (guild_id, type, theme_id)
       DO UPDATE SET
         title = EXCLUDED.title,
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
        updates.thumbnail_url || null,
        themeId
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
        trap_lose_all_collectibles: true,
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

  // ==================== GUILD BRANDING ====================

  /**
   * Récupérer la configuration de branding d'une guild
   * Auto-create si n'existe pas
   */
  async getGuildBranding(guildId) {
    guildId = this._getGuildId(guildId);

    let branding = await this.queryOne(
      'SELECT * FROM guild_branding WHERE guild_id = $1',
      [guildId]
    );

    // Auto-create si n'existe pas
    if (!branding) {
      branding = await this.queryOne(`
        INSERT INTO guild_branding (guild_id)
        VALUES ($1)
        RETURNING *
      `, [guildId]);
    }

    return branding;
  }

  /**
   * Mettre à jour la configuration de branding d'une guild
   */
  async updateGuildBranding(guildId, updates) {
    guildId = this._getGuildId(guildId);

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

    return this.queryOne(`
      UPDATE guild_branding
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE guild_id = $${keys.length + 1}
      RETURNING *
    `, [...values, guildId]);
  }

  /**
   * Récupérer une couleur par son code hexadécimal
   * @param {string} hexCode - Code hexadécimal de la couleur (#RRGGBB)
   * @returns {Object|null} Objet couleur avec {name, hex_code, emoji, category}
   */
  async getColorByHex(hexCode) {
    // Normaliser le hex code (avec ou sans #)
    const normalizedHex = hexCode.toUpperCase().startsWith('#') ? hexCode.toUpperCase() : `#${hexCode.toUpperCase()}`;

    return this.queryOne(
      'SELECT * FROM colors WHERE hex_code = $1',
      [normalizedHex]
    );
  }

  /**
   * Récupérer toutes les couleurs, optionnellement filtrées par catégorie
   * @param {string} category - Catégorie optionnelle (blue, red, green, etc.)
   * @returns {Array} Liste des couleurs
   */
  async getAllColors(category = null) {
    if (category) {
      return this.query(
        'SELECT * FROM colors WHERE category = $1 ORDER BY name',
        [category]
      );
    }

    return this.query('SELECT * FROM colors ORDER BY category, name');
  }

  // ==================== MISSION NOTIFICATIONS ====================

  /**
   * Récupérer les préférences de notification missions d'une guild
   * Auto-initialise avec les valeurs par défaut si nécessaire
   */
  async getMissionNotificationSettings(guildId) {
    guildId = this._getGuildId(guildId);

    const config = await this.queryOne(
      `SELECT
        notify_super_admins_thread,
        notify_super_admins_mention,
        notify_owner_thread,
        notify_owner_mention,
        notify_cofounders_thread,
        notify_cofounders_mention
      FROM guild_config
      WHERE guild_id = $1`,
      [guildId]
    );

    // Retourner les valeurs ou les valeurs par défaut
    return {
      superAdminsThread: config?.notify_super_admins_thread ?? true,
      superAdminsMention: config?.notify_super_admins_mention ?? false,
      ownerThread: config?.notify_owner_thread ?? true,
      ownerMention: config?.notify_owner_mention ?? false,
      cofoundersThread: config?.notify_cofounders_thread ?? true,
      cofoundersMention: config?.notify_cofounders_mention ?? true
    };
  }

  /**
   * Mettre à jour une préférence de notification mission
   * @param {string} guildId - ID du serveur
   * @param {string} setting - Nom du setting (ex: 'notify_super_admins_thread')
   * @param {boolean} value - Nouvelle valeur
   */
  async updateMissionNotificationSetting(guildId, setting, value) {
    guildId = this._getGuildId(guildId);

    // Vérifier que le setting est valide
    const validSettings = [
      'notify_super_admins_thread',
      'notify_super_admins_mention',
      'notify_owner_thread',
      'notify_owner_mention',
      'notify_cofounders_thread',
      'notify_cofounders_mention'
    ];

    if (!validSettings.includes(setting)) {
      throw new Error(`Invalid notification setting: ${setting}`);
    }

    await this.query(
      `UPDATE guild_config SET ${setting} = $1 WHERE guild_id = $2`,
      [value, guildId]
    );

    return { [setting]: value };
  }

  // ==================== SUPER BONUS INSTALLATION ====================

  /**
   * Installer les 8 super bonus fixes pour une guild
   * Utilisé lors de l'invitation du bot sur un nouveau serveur
   * ⚠️ Utilise ON CONFLICT DO NOTHING pour éviter les doublons
   *
   * IMPLÉMENTÉS (4):
   * - Vision Divine (reveal) - révèle contenu mystery box
   * - Aimant à Légendaires (rarity_boost) - boost drops légendaires
   * - Jackpot x2 (multiplier) - double les collectibles
   * - Bouclier Anti-Piège (protection) - bloque 1 piège
   *
   * À IMPLÉMENTER (4):
   * - Accélérateur de Cooldown (cooldown) - reset cooldowns
   * - Aura de Célébrité (cosmetic) - effets visuels
   * - Parrain/Marraine (transfer) - transfert bonus
   * - MysteryBox Joker (joker) - choisir collectible manquant
   */
  async installSuperBonusesForGuild(guildId) {
    guildId = this._getGuildId(guildId);

    console.log(`🎁 Installation des super bonus pour guild ${guildId}...`);

    // Définition des 7 super bonus
    const bonuses = [
      {
        bonus_id: 'divine_vision',
        name: 'Vision Divine',
        description: 'Révèle le contenu d\'une mystery box AVANT de cliquer',
        icon: '👁️',
        bonus_type: 'boost',
        effect_type: 'reveal',
        effect_config: { reveal_count: 1, can_skip: true },
        duration_type: 'charges',
        duration_value: 1,
        color: '#f1c40f',
        rarity: 'legendary'
      },
      {
        bonus_id: 'legendary_magnet',
        name: 'Aimant à Légendaires',
        description: 'Si un collectible tombe, +50% de chance qu\'il soit légendaire',
        icon: '🧲',
        bonus_type: 'boost',
        effect_type: 'rarity_boost',
        effect_config: { boost_percentage: 50, target_rarity: 'legendary' },
        duration_type: 'temporary',
        duration_value: 259200, // 3 jours
        color: '#9b59b6',
        rarity: 'legendary'
      },
      {
        bonus_id: 'jackpot_x2',
        name: 'Jackpot x2',
        description: 'La prochaine mystery box donnera DOUBLE récompense si collectible !',
        icon: '💵',
        bonus_type: 'economy',
        effect_type: 'multiplier',
        effect_config: { multiplier: 2, applies_to: 'collectible' },
        duration_type: 'charges',
        duration_value: 5,
        color: '#27ae60',
        rarity: 'epic'
      },
      {
        bonus_id: 'trap_shield',
        name: 'Bouclier Anti-Piège',
        description: 'Annule automatiquement le prochain piège que tu tombes dessus',
        icon: '🛡️',
        bonus_type: 'protection',
        effect_type: 'protection',
        effect_config: { blocks_traps: 1, auto_consume: true },
        duration_type: 'charges',
        duration_value: 1,
        color: '#3498db',
        rarity: 'epic'
      },
      {
        bonus_id: 'cooldown_accelerator',
        name: 'Accélérateur de Cooldown',
        description: 'Enlève TOUS tes cooldowns actifs immédiatement',
        icon: '⚡',
        bonus_type: 'time',
        effect_type: 'cooldown',
        effect_config: { removes_all_cooldowns: true, instant: true },
        duration_type: 'charges',
        duration_value: 1,
        color: '#e67e22',
        rarity: 'rare'
      },
      {
        bonus_id: 'celebrity_aura',
        name: 'Aura de Célébrité',
        description: 'Nom en GOLD et réaction ⭐ automatique sur tous tes messages',
        icon: '👑',
        bonus_type: 'social',
        effect_type: 'cosmetic',
        effect_config: { name_color: 'gold', auto_reaction: '⭐' },
        duration_type: 'temporary',
        duration_value: 172800, // 48h
        color: '#f39c12',
        rarity: 'rare'
      },
      {
        bonus_id: 'godparent',
        name: 'Parrain/Marraine',
        description: 'Offre UNE mystery box à quelqu\'un. S\'il trouve un collectible, tu gagnes 2x points !',
        icon: '🤝',
        bonus_type: 'social',
        effect_type: 'transfer',
        effect_config: { can_gift_boxes: 1, bonus_if_collectible: 2, affects_both: true },
        duration_type: 'temporary',
        duration_value: 432000, // 5 jours
        color: '#16a085',
        rarity: 'epic'
      },
      {
        bonus_id: 'mystery_joker',
        name: 'MysteryBox Joker',
        description: 'Choisissez N\'IMPORTE QUEL collectible manquant de votre collection !',
        icon: '🃏',
        bonus_type: 'choice',
        effect_type: 'joker',
        effect_config: { allows_choice: true, choice_from: 'missing_collectibles', shows_rarity: true },
        duration_type: 'charges',
        duration_value: 1,
        color: '#9b59b6',
        rarity: 'legendary'
      }
    ];

    let installed = 0;
    let skipped = 0;

    for (const bonus of bonuses) {
      try {
        const result = await this.query(`
          INSERT INTO super_bonuses (
            guild_id, bonus_id, name, description, icon, bonus_type,
            effect_type, effect_config, duration_type, duration_value, color, rarity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (guild_id, bonus_id) DO NOTHING
          RETURNING id
        `, [
          guildId,
          bonus.bonus_id,
          bonus.name,
          bonus.description,
          bonus.icon,
          bonus.bonus_type,
          bonus.effect_type,
          JSON.stringify(bonus.effect_config),
          bonus.duration_type,
          bonus.duration_value,
          bonus.color,
          bonus.rarity
        ]);

        if (result && result.length > 0) {
          installed++;
          console.log(`   ✅ ${bonus.icon} ${bonus.name} installé (ID: ${result[0].id})`);
        } else {
          skipped++;
          console.log(`   ⏭️  ${bonus.icon} ${bonus.name} déjà existant`);
        }
      } catch (error) {
        console.error(`   ❌ Erreur installation ${bonus.name}:`, error.message);
      }
    }

    console.log(`🎁 Installation terminée: ${installed} installés, ${skipped} déjà existants (total: ${bonuses.length})`);
    return { installed, skipped, total: bonuses.length };
  }

  // =====================================================
  // SECTION: BADGE SYSTEM
  // =====================================================

  /**
   * Créer un badge dans la base de données
   */
  async createBadge(badgeData) {
    const {
      code, name, description, emoji, color, rarity, category,
      condition_type, condition_target, condition_value,
      display_order = 0, is_secret = false
    } = badgeData;

    return this.queryOne(`
      INSERT INTO badges (
        code, name, description, emoji, color, rarity, category,
        condition_type, condition_target, condition_value,
        display_order, is_secret
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        emoji = EXCLUDED.emoji
      RETURNING *
    `, [
      code, name, description, emoji, color, rarity, category,
      condition_type, condition_target, condition_value,
      display_order, is_secret
    ]);
  }

  /**
   * Récupérer un badge par son code
   */
  async getBadgeByCode(code) {
    return this.queryOne('SELECT * FROM badges WHERE code = $1', [code]);
  }

  /**
   * Récupérer tous les badges d'une catégorie
   */
  async getBadgesByCategory(category) {
    return this.query(`
      SELECT * FROM badges
      WHERE category = $1
      ORDER BY display_order ASC, rarity DESC, name ASC
    `, [category]);
  }

  /**
   * Récupérer tous les badges (avec filtre optionnel)
   */
  async getAllBadges(filters = {}) {
    let query = 'SELECT * FROM badges WHERE 1=1';
    const params = [];

    if (filters.category) {
      params.push(filters.category);
      query += ` AND category = $${params.length}`;
    }

    if (filters.rarity) {
      params.push(filters.rarity);
      query += ` AND rarity = $${params.length}`;
    }

    if (filters.condition_type) {
      params.push(filters.condition_type);
      query += ` AND condition_type = $${params.length}`;
    }

    if (filters.exclude_secret) {
      query += ' AND is_secret = FALSE';
    }

    query += ' ORDER BY display_order ASC, rarity DESC, name ASC';

    return this.query(query, params);
  }

  /**
   * Débloquer un badge pour un joueur
   */
  async unlockBadge(guildId, playerId, badgeId, unlockedFrom = null) {
    try {
      const result = await this.queryOne(`
        INSERT INTO player_badges (guild_id, player_id, badge_id, unlocked_from)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guild_id, player_id, badge_id) DO NOTHING
        RETURNING *
      `, [guildId, playerId, badgeId, unlockedFrom]);

      // Si le badge a été débloqué (pas déjà existant)
      if (result) {
        // Supprimer la progression associée
        await this.query(`
          DELETE FROM badge_progress
          WHERE guild_id = $1 AND player_id = $2 AND badge_id = $3
        `, [guildId, playerId, badgeId]);
      }

      return result;
    } catch (error) {
      console.error('🔴 Erreur unlockBadge:', error);
      throw error;
    }
  }

  /**
   * Vérifier si un joueur a un badge
   */
  async playerHasBadge(guildId, playerId, badgeId) {
    const result = await this.queryOne(`
      SELECT 1 FROM player_badges
      WHERE guild_id = $1 AND player_id = $2 AND badge_id = $3
    `, [guildId, playerId, badgeId]);

    return !!result;
  }

  /**
   * Récupérer tous les badges d'un joueur
   */
  async getPlayerBadges(guildId, playerId, filters = {}) {
    let query = `
      SELECT
        pb.*,
        b.code,
        b.name,
        b.description,
        b.emoji,
        b.color,
        b.rarity,
        b.category
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      WHERE pb.guild_id = $1 AND pb.player_id = $2
    `;
    const params = [guildId, playerId];

    if (filters.category) {
      params.push(filters.category);
      query += ` AND b.category = $${params.length}`;
    }

    if (filters.rarity) {
      params.push(filters.rarity);
      query += ` AND b.rarity = $${params.length}`;
    }

    query += ' ORDER BY pb.unlocked_at DESC';

    return this.query(query, params);
  }

  /**
   * Compter les badges d'un joueur
   */
  async countPlayerBadges(guildId, playerId, filters = {}) {
    let query = `
      SELECT COUNT(*) as count
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      WHERE pb.guild_id = $1 AND pb.player_id = $2
    `;
    const params = [guildId, playerId];

    if (filters.category) {
      params.push(filters.category);
      query += ` AND b.category = $${params.length}`;
    }

    if (filters.rarity) {
      params.push(filters.rarity);
      query += ` AND b.rarity = $${params.length}`;
    }

    const result = await this.queryOne(query, params);
    return result ? parseInt(result.count) : 0;
  }

  /**
   * Mettre à jour ou créer la progression d'un badge
   */
  async updateBadgeProgress(guildId, playerId, badgeId, currentValue, targetValue) {
    try {
      // Vérifier si le badge est déjà débloqué
      const isUnlocked = await this.playerHasBadge(guildId, playerId, badgeId);
      if (isUnlocked) {
        return null; // Badge déjà débloqué, pas de progression
      }

      const result = await this.queryOne(`
        INSERT INTO badge_progress (guild_id, player_id, badge_id, current_value, target_value)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (guild_id, player_id, badge_id) DO UPDATE SET
          current_value = EXCLUDED.current_value,
          target_value = EXCLUDED.target_value,
          updated_at = NOW()
        RETURNING *
      `, [guildId, playerId, badgeId, currentValue, targetValue]);

      return result;
    } catch (error) {
      console.error('🔴 Erreur updateBadgeProgress:', error);
      throw error;
    }
  }

  /**
   * Incrémenter la progression d'un badge
   */
  async incrementBadgeProgress(guildId, playerId, badgeId, incrementBy = 1, targetValue) {
    try {
      // Vérifier si le badge est déjà débloqué
      const isUnlocked = await this.playerHasBadge(guildId, playerId, badgeId);
      if (isUnlocked) {
        return null;
      }

      const result = await this.queryOne(`
        INSERT INTO badge_progress (guild_id, player_id, badge_id, current_value, target_value)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (guild_id, player_id, badge_id) DO UPDATE SET
          current_value = badge_progress.current_value + $4,
          updated_at = NOW()
        RETURNING *
      `, [guildId, playerId, badgeId, incrementBy, targetValue]);

      return result;
    } catch (error) {
      console.error('🔴 Erreur incrementBadgeProgress:', error);
      throw error;
    }
  }

  /**
   * Récupérer la progression d'un badge pour un joueur
   */
  async getBadgeProgress(guildId, playerId, badgeId) {
    return this.queryOne(`
      SELECT * FROM badge_progress
      WHERE guild_id = $1 AND player_id = $2 AND badge_id = $3
    `, [guildId, playerId, badgeId]);
  }

  /**
   * Récupérer toutes les progressions d'un joueur
   */
  async getPlayerBadgeProgress(guildId, playerId) {
    return this.query(`
      SELECT
        bp.*,
        b.code,
        b.name,
        b.description,
        b.emoji,
        b.color,
        b.rarity,
        b.category
      FROM badge_progress bp
      JOIN badges b ON bp.badge_id = b.id
      WHERE bp.guild_id = $1 AND bp.player_id = $2
      ORDER BY bp.percentage DESC, b.rarity DESC
    `, [guildId, playerId]);
  }

  /**
   * Statistiques des badges d'un joueur
   */
  async getPlayerBadgeStats(guildId, playerId) {
    const stats = await this.queryOne(`
      SELECT
        COUNT(*) as total_badges,
        COUNT(CASE WHEN b.rarity = 'common' THEN 1 END) as common_count,
        COUNT(CASE WHEN b.rarity = 'uncommon' THEN 1 END) as uncommon_count,
        COUNT(CASE WHEN b.rarity = 'rare' THEN 1 END) as rare_count,
        COUNT(CASE WHEN b.rarity = 'epic' THEN 1 END) as epic_count,
        COUNT(CASE WHEN b.rarity = 'legendary' THEN 1 END) as legendary_count,
        COUNT(CASE WHEN b.rarity = 'mythic' THEN 1 END) as mythic_count,
        COUNT(CASE WHEN b.category = 'super_bonus' THEN 1 END) as super_bonus_count
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      WHERE pb.guild_id = $1 AND pb.player_id = $2
    `, [guildId, playerId]);

    return stats || {
      total_badges: 0,
      common_count: 0,
      uncommon_count: 0,
      rare_count: 0,
      epic_count: 0,
      legendary_count: 0,
      mythic_count: 0,
      super_bonus_count: 0
    };
  }

  /**
   * Leaderboard des badges (top joueurs)
   */
  async getBadgeLeaderboard(guildId, limit = 10) {
    return this.query(`
      SELECT
        p.discord_id,
        p.username,
        COUNT(pb.id) as total_badges,
        COUNT(CASE WHEN b.rarity = 'legendary' THEN 1 END) as legendary_count,
        COUNT(CASE WHEN b.rarity = 'mythic' THEN 1 END) as mythic_count,
        MAX(pb.unlocked_at) as last_unlock
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      JOIN players p ON pb.player_id = p.id
      WHERE pb.guild_id = $1
      GROUP BY p.discord_id, p.username
      ORDER BY total_badges DESC, legendary_count DESC, mythic_count DESC
      LIMIT $2
    `, [guildId, limit]);
  }

  /**
   * Badges récemment débloqués (activité)
   */
  async getRecentBadgeUnlocks(guildId, limit = 10) {
    return this.query(`
      SELECT
        pb.*,
        b.code,
        b.name,
        b.emoji,
        b.rarity,
        p.discord_id,
        p.username
      FROM player_badges pb
      JOIN badges b ON pb.badge_id = b.id
      JOIN players p ON pb.player_id = p.id
      WHERE pb.guild_id = $1
      ORDER BY pb.unlocked_at DESC
      LIMIT $2
    `, [guildId, limit]);
  }

  // ============================================================================
  // 📅 LOGIN TRACKING - Pour badges Engagement
  // ============================================================================

  /**
   * Enregistrer un login et calculer le streak
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @returns {Object} { streak, previousStreak, isNewStreak, brokeStreak }
   */
  async recordLogin(guildId, playerId) {
    try {
      const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

      // Récupérer le dernier login du joueur
      const player = await this.queryOne(`
        SELECT current_login_streak, last_login_date, best_login_streak
        FROM players
        WHERE guild_id = $1 AND id = $2
      `, [guildId, playerId]);

      if (!player) {
        console.warn(`⚠️  Joueur ${playerId} introuvable pour guild ${guildId}`);
        return null;
      }

      // Si déjà connecté aujourd'hui, ne rien faire
      if (player.last_login_date === today) {
        console.log(`ℹ️  Joueur ${playerId} déjà connecté aujourd'hui`);
        return {
          streak: player.current_login_streak,
          previousStreak: player.current_login_streak,
          isNewStreak: false,
          brokeStreak: false
        };
      }

      // Insérer le login du jour (ou ignorer si existe déjà)
      await this.query(`
        INSERT INTO player_login_history (guild_id, player_id, login_date)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, player_id, login_date) DO NOTHING
      `, [guildId, playerId, today]);

      // Calculer le nouveau streak
      const lastLogin = player.last_login_date ? new Date(player.last_login_date) : null;
      const todayDate = new Date(today);

      let newStreak = 1;
      let brokeStreak = false;
      const previousStreak = player.current_login_streak || 0;

      if (lastLogin) {
        // Calculer la différence en jours
        const diffTime = todayDate - lastLogin;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // Jour consécutif - incrémenter le streak
          newStreak = (player.current_login_streak || 0) + 1;
        } else if (diffDays > 1) {
          // Streak cassé - recommencer à 1
          newStreak = 1;
          brokeStreak = true;
          console.log(`📅 Streak cassé pour joueur ${playerId} (${diffDays} jours d'absence)`);
        }
      }

      // Mettre à jour le best streak si nécessaire
      const newBestStreak = Math.max(player.best_login_streak || 0, newStreak);

      // Mettre à jour les colonnes de cache dans players
      await this.query(`
        UPDATE players
        SET
          current_login_streak = $1,
          last_login_date = $2,
          best_login_streak = $3,
          updated_at = NOW()
        WHERE guild_id = $4 AND id = $5
      `, [newStreak, today, newBestStreak, guildId, playerId]);

      console.log(`📅 Login enregistré: Joueur ${playerId} - Streak: ${newStreak} (best: ${newBestStreak})`);

      return {
        streak: newStreak,
        previousStreak,
        isNewStreak: newStreak > previousStreak,
        brokeStreak,
        bestStreak: newBestStreak
      };
    } catch (error) {
      console.error('🔴 Erreur recordLogin:', error);
      throw error;
    }
  }

  /**
   * Récupérer le streak actuel d'un joueur
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @returns {Object} { currentStreak, lastLoginDate, bestStreak }
   */
  async getLoginStreak(guildId, playerId) {
    const player = await this.queryOne(`
      SELECT current_login_streak, last_login_date, best_login_streak
      FROM players
      WHERE guild_id = $1 AND id = $2
    `, [guildId, playerId]);

    return {
      currentStreak: player?.current_login_streak || 0,
      lastLoginDate: player?.last_login_date || null,
      bestStreak: player?.best_login_streak || 0
    };
  }

  /**
   * Récupérer l'historique des logins d'un joueur
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} limit - Nombre de logins à récupérer
   * @returns {Array} Liste des dates de login
   */
  async getLoginHistory(guildId, playerId, limit = 30) {
    return this.query(`
      SELECT login_date, created_at
      FROM player_login_history
      WHERE guild_id = $1 AND player_id = $2
      ORDER BY login_date DESC
      LIMIT $3
    `, [guildId, playerId, limit]);
  }

  // ============================================================================
  // MYSTERY BOX CREDITS SYSTEM
  // ============================================================================

  /**
   * Obtenir les crédits/clés Mystery Box d'un joueur (globaux, pas liés au thème)
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @returns {object} Clés par rareté {common, rare, epic, legendary, total}
   */
  async getMysteryBoxCredits(guildId, playerId) {
    const credits = await this.query(`
      SELECT rarity, credits
      FROM player_mystery_box_credits
      WHERE guild_id = $1 AND player_id = $2
    `, [guildId, playerId]);

    const result = {
      common: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
      total: 0
    };

    for (const row of credits) {
      result[row.rarity] = row.credits;
      result.total += row.credits;
    }

    return result;
  }

  /**
   * Ajouter des clés Mystery Box à un joueur (globales, pas liées au thème)
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {string} rarity - Rareté ('common', 'rare', 'epic', 'legendary')
   * @param {number} amount - Quantité à ajouter
   * @param {string} source - Source ('daily_claim', 'streak_milestone', 'admin', 'event')
   * @param {string} sourceDetail - Détails supplémentaires
   * @returns {object} Nouvelles clés
   */
  async addMysteryBoxCredits(guildId, playerId, rarity, amount, source, sourceDetail = null) {
    console.log(`🔑 [CLÉS] Ajout de ${amount} clé(s) ${rarity} au joueur ${playerId} (source: ${source})`);

    // Insérer ou mettre à jour les clés
    await this.query(`
      INSERT INTO player_mystery_box_credits (guild_id, player_id, rarity, credits, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (guild_id, player_id, rarity)
      DO UPDATE SET credits = player_mystery_box_credits.credits + $4, updated_at = NOW()
    `, [guildId, playerId, rarity, amount]);

    // Logger l'opération
    await this.query(`
      INSERT INTO mystery_box_credit_logs (guild_id, player_id, action, rarity, amount, source, source_detail)
      VALUES ($1, $2, 'earn', $3, $4, $5, $6)
    `, [guildId, playerId, rarity, amount, source, sourceDetail]);

    console.log(`✅ [CLÉS] Ajoutées avec succès`);

    return this.getMysteryBoxCredits(guildId, playerId);
  }

  /**
   * Utiliser une clé Mystery Box pour ouvrir une box
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {string} rarity - Rareté de la box à ouvrir
   * @param {object} result - Résultat obtenu {type, id, name, rarity}
   * @returns {boolean} Succès
   */
  async spendMysteryBoxCredit(guildId, playerId, rarity, result = null) {
    console.log(`🔑 [CLÉS] Utilisation d'1 clé ${rarity} par joueur ${playerId}`);

    // Vérifier qu'il y a des clés disponibles
    const current = await this.queryOne(`
      SELECT credits FROM player_mystery_box_credits
      WHERE guild_id = $1 AND player_id = $2 AND rarity = $3
    `, [guildId, playerId, rarity]);

    if (!current || current.credits < 1) {
      console.log(`❌ [CLÉS] Aucune clé disponible`);
      return false;
    }

    // Décrémenter les clés
    await this.query(`
      UPDATE player_mystery_box_credits
      SET credits = credits - 1, updated_at = NOW()
      WHERE guild_id = $1 AND player_id = $2 AND rarity = $3
    `, [guildId, playerId, rarity]);

    // Logger l'opération avec le résultat
    await this.query(`
      INSERT INTO mystery_box_credit_logs
      (guild_id, player_id, action, rarity, amount, source, result_type, result_id, result_name, result_rarity)
      VALUES ($1, $2, 'spend', $3, -1, 'mystery_box_open', $4, $5, $6, $7)
    `, [
      guildId,
      playerId,
      rarity,
      result?.type || null,
      result?.id || null,
      result?.name || null,
      result?.rarity || null
    ]);

    console.log(`✅ [CLÉS] Clé utilisée avec succès, résultat: ${result?.name || 'N/A'}`);

    return true;
  }

  /**
   * Obtenir la configuration des Mystery Box par rareté
   * @param {string} guildId - ID du serveur
   * @param {string} rarity - Rareté (optionnel, retourne toutes si non spécifié)
   * @param {number|null} themeId - ID du thème (null = cherche config globale puis thème actif)
   * @returns {object|array} Configuration(s)
   */
  async getMysteryBoxConfig(guildId, rarity = null, themeId = null) {
    // Si pas de themeId spécifié, récupérer le thème actif
    if (themeId === null) {
      const activeTheme = await this.getActiveTheme(guildId);
      themeId = activeTheme?.id || null;
    }

    if (rarity) {
      return this.queryOne(`
        SELECT * FROM mystery_box_config
        WHERE guild_id = $1 AND rarity = $2 AND theme_id ${themeId ? '= $3' : 'IS NULL'}
      `, themeId ? [guildId, rarity, themeId] : [guildId, rarity]);
    }

    return this.query(`
      SELECT * FROM mystery_box_config
      WHERE guild_id = $1 AND theme_id ${themeId ? '= $2' : 'IS NULL'}
      ORDER BY
        CASE rarity
          WHEN 'legendary' THEN 1
          WHEN 'epic' THEN 2
          WHEN 'rare' THEN 3
          WHEN 'common' THEN 4
        END
    `, themeId ? [guildId, themeId] : [guildId]);
  }

  /**
   * Obtenir l'historique des crédits Mystery Box d'un joueur
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} limit - Nombre d'entrées
   * @returns {array} Historique
   */
  async getMysteryBoxCreditHistory(guildId, playerId, limit = 20) {
    return this.query(`
      SELECT *
      FROM mystery_box_credit_logs
      WHERE guild_id = $1 AND player_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `, [guildId, playerId, limit]);
  }

  // ============================================================================
  // DAILY CLAIM SYSTEM
  // ============================================================================

  /**
   * Récupérer les infos de daily claim d'un joueur
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @returns {object} Infos daily claim
   */
  async getDailyClaimInfo(guildId, playerId) {
    const player = await this.queryOne(`
      SELECT last_daily_claim, total_daily_claims, current_claim_streak, best_claim_streak
      FROM players
      WHERE guild_id = $1 AND id = $2
    `, [guildId, playerId]);

    if (!player) return null;

    const today = new Date().toISOString().split('T')[0];
    const canClaim = !player.last_daily_claim || player.last_daily_claim !== today;

    // Calculer le jour actuel dans le cycle (1-30)
    const currentDay = ((player.total_daily_claims || 0) % 30) + 1;

    return {
      lastClaim: player.last_daily_claim,
      totalClaims: player.total_daily_claims || 0,
      currentStreak: player.current_claim_streak || 0,
      bestStreak: player.best_claim_streak || 0,
      currentDay: canClaim ? currentDay : ((player.total_daily_claims || 0) % 30) || 30,
      canClaim
    };
  }

  /**
   * Enregistrer un claim quotidien
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {object} reward - Récompense {type, rarity, amount, detail}
   * @returns {object} Résultat du claim
   */
  async recordDailyClaim(guildId, playerId, reward) {
    const today = new Date().toISOString().split('T')[0];

    // Récupérer l'état actuel
    const player = await this.queryOne(`
      SELECT last_daily_claim, total_daily_claims, current_claim_streak, best_claim_streak
      FROM players
      WHERE guild_id = $1 AND id = $2
    `, [guildId, playerId]);

    if (!player) return null;

    // Vérifier si déjà claim aujourd'hui
    if (player.last_daily_claim === today) {
      console.log(`📅 [DAILY] Player ${playerId} already claimed today`);
      return { success: false, reason: 'already_claimed' };
    }

    // Calculer le nouveau streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak;
    if (player.last_daily_claim === yesterdayStr) {
      // Claim consécutif
      newStreak = (player.current_claim_streak || 0) + 1;
      console.log(`📅 [DAILY] Consecutive claim! Streak: ${newStreak}`);
    } else {
      // Streak cassé ou premier claim
      newStreak = 1;
      if (player.last_daily_claim) {
        console.log(`📅 [DAILY] Streak broken for player ${playerId}`);
      }
    }

    const newBestStreak = Math.max(player.best_claim_streak || 0, newStreak);
    const newTotalClaims = (player.total_daily_claims || 0) + 1;
    const claimDay = ((player.total_daily_claims || 0) % 30) + 1;

    // Mettre à jour le joueur
    await this.query(`
      UPDATE players SET
        last_daily_claim = $1,
        total_daily_claims = $2,
        current_claim_streak = $3,
        best_claim_streak = $4,
        updated_at = NOW()
      WHERE guild_id = $5 AND id = $6
    `, [today, newTotalClaims, newStreak, newBestStreak, guildId, playerId]);

    // Logger le claim
    await this.query(`
      INSERT INTO daily_claim_logs
      (guild_id, player_id, claim_day, claim_date, streak_at_claim, reward_type, reward_rarity, reward_amount, reward_detail)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      guildId,
      playerId,
      claimDay,
      today,
      newStreak,
      reward.type,
      reward.rarity || null,
      reward.amount || null,
      reward.detail || null
    ]);

    console.log(`✅ [DAILY] Claim recorded: Day ${claimDay}, Streak ${newStreak}, Reward: ${reward.type}`);

    return {
      success: true,
      claimDay,
      streak: newStreak,
      bestStreak: newBestStreak,
      totalClaims: newTotalClaims,
      reward
    };
  }

  /**
   * Obtenir l'historique des claims quotidiens
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} limit - Nombre d'entrées
   * @param {number|null} themeId - ID du thème (null = tous)
   * @returns {array} Historique
   */
  async getDailyClaimHistory(guildId, playerId, limit = 30, themeId = null) {
    if (themeId) {
      return this.query(`
        SELECT *
        FROM daily_claim_logs
        WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
        ORDER BY claim_date DESC
        LIMIT $4
      `, [guildId, playerId, themeId, limit]);
    }
    return this.query(`
      SELECT *
      FROM daily_claim_logs
      WHERE guild_id = $1 AND player_id = $2
      ORDER BY claim_date DESC
      LIMIT $3
    `, [guildId, playerId, limit]);
  }

  // ============================================================================
  // DAILY CLAIM SYSTEM - THEME AWARE (v2.2.1)
  // ============================================================================

  /**
   * Récupérer la récompense du calendrier pour un jour donné
   * @param {string} guildId - ID du serveur
   * @param {number} themeId - ID du thème
   * @param {number} dayNumber - Numéro du jour (1 à duration_days)
   * @returns {object|null} Récompense configurée
   */
  async getDailyRewardForDay(guildId, themeId, dayNumber) {
    return this.queryOne(`
      SELECT
        drc.*,
        t.name as theme_name,
        t.duration_days as theme_duration
      FROM daily_rewards_config drc
      JOIN themes t ON drc.theme_id = t.id
      WHERE drc.guild_id = $1 AND drc.theme_id = $2 AND drc.day_number = $3
    `, [guildId, themeId, dayNumber]);
  }

  /**
   * Créer les récompenses quotidiennes par défaut pour un thème (preset "classic")
   * - Jours pairs: Loomix progressifs
   * - Jours impairs: Clé Commune
   * - Milestones (J7, J14, J21, dernier jour): Clé Rare → Épique → Légendaire
   */
  async seedDefaultDailyRewards(guildId, themeId, durationDays) {
    guildId = this._getGuildId(guildId);

    // Calculer les milestones (tous les 7 jours + dernier jour)
    const milestones = [];
    for (let d = 7; d <= durationDays; d += 7) {
      milestones.push(d);
    }
    if (!milestones.includes(durationDays)) {
      milestones.push(durationDays);
    }

    const totalPhases = milestones.length;

    // Emojis pour les raretés (combinés pour l'affichage)
    const RARITY_EMOJI = {
      common: '🔑',
      rare: '🔑💎',
      epic: '🔑✨',
      legendary: '🗝️👑'
    };

    // Générer et insérer les récompenses pour chaque jour
    for (let day = 1; day <= durationDays; day++) {
      const phase = Math.ceil(day / 7);
      const isMilestone = milestones.includes(day);
      const isFinalDay = day === durationDays;
      const isEvenDay = day % 2 === 0;

      let rewardType, rewardRarity, rewardAmount, displayEmoji;

      // Logique du preset "classic"
      if (isFinalDay) {
        // Dernier jour = Clé Légendaire
        rewardType = 'mystery_box';
        rewardRarity = 'legendary';
        rewardAmount = 1;
        displayEmoji = '👑';
      } else if (isMilestone) {
        // Milestone = Clé selon la progression
        rewardType = 'mystery_box';
        const progress = phase / totalPhases;
        if (progress > 0.75) rewardRarity = 'legendary';
        else if (progress > 0.4) rewardRarity = 'epic';
        else rewardRarity = 'rare';
        rewardAmount = 1;
        displayEmoji = RARITY_EMOJI[rewardRarity];
      } else if (isEvenDay) {
        // Jour pair = Loomix progressifs
        rewardType = 'currency';
        rewardRarity = null;
        const baseAmount = 50;
        const phaseBonus = (phase - 1) * 20;
        const dayBonus = Math.floor((day % 7) * 5);
        rewardAmount = baseAmount + phaseBonus + dayBonus;
        displayEmoji = '💰';
      } else {
        // Jour impair = Clé Commune
        rewardType = 'mystery_box';
        rewardRarity = 'common';
        rewardAmount = 1;
        displayEmoji = '🔑';
      }

      await this.query(`
        INSERT INTO daily_rewards_config (
          guild_id, theme_id, day_number, reward_type, reward_rarity,
          reward_amount, display_name, display_emoji, is_milestone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (guild_id, theme_id, day_number) DO NOTHING
      `, [
        guildId,
        themeId,
        day,
        rewardType,
        rewardRarity,
        rewardAmount,
        null, // display_name est généré dynamiquement
        displayEmoji,
        isMilestone
      ]);
    }

    console.log(`📅 ${durationDays} récompenses quotidiennes seedées pour le thème ${themeId}`);
  }

  /**
   * Créer les Mystery Boxes par défaut pour un thème
   * Une box par rareté avec probabilités par défaut et textes personnalisés
   * @param {string} guildId - ID du serveur
   * @param {number} themeId - ID du thème
   */
  async seedDefaultMysteryBoxes(guildId, themeId) {
    // Base URL pour les images de mystery boxes par défaut
    const BASE_IMG_URL = 'http://72.60.185.62:8080/assets/mystery-boxes';

    // 🎨 Configurations personnalisées par rareté (synced avec RARITY_DEFAULTS dans mysteryBoxHandler)
    const rarities = [
      {
        rarity: 'common',
        name: 'Mystery Box Commune',
        emoji: '📦',
        color: '#95A5A6',
        rewards_count: 1,
        text_title: '📦 MYSTERY BOX COMMUNE',
        text_description: 'Une box basique mais pleine de surprises...',
        text_opening: 'Une Mystery Box **commune** s\'ouvre doucement...',
        text_success: 'Tu as trouvé quelque chose dans cette box commune !',
        text_empty: 'La box commune était vide...',
        image_closed: `${BASE_IMG_URL}/common_closed.png`,
        image_opening: `${BASE_IMG_URL}/common_opening.png`,
        image_opened: `${BASE_IMG_URL}/common_opened.png`,
        image_empty: `${BASE_IMG_URL}/common_empty.png`
      },
      {
        rarity: 'rare',
        name: 'Mystery Box Rare',
        emoji: '💎',
        color: '#3498DB',
        rewards_count: 1,
        text_title: '💎 MYSTERY BOX RARE',
        text_description: 'Une box scintillante aux reflets bleutés...',
        text_opening: 'Une Mystery Box **rare** commence à briller...',
        text_success: 'Excellent ! Tu as débloqué un objet rare !',
        text_empty: 'La box rare n\'a rien révélé cette fois...',
        image_closed: `${BASE_IMG_URL}/rare_closed.png`,
        image_opening: `${BASE_IMG_URL}/rare_opening.png`,
        image_opened: `${BASE_IMG_URL}/rare_opened.png`,
        image_empty: `${BASE_IMG_URL}/rare_empty.png`
      },
      {
        rarity: 'epic',
        name: 'Mystery Box Épique',
        emoji: '✨',
        color: '#9B59B6',
        rewards_count: 2,
        text_title: '✨ MYSTERY BOX ÉPIQUE',
        text_description: 'Une box enveloppée d\'une aura mystique...',
        text_opening: 'Une Mystery Box **épique** pulse d\'énergie violette...',
        text_success: 'Incroyable ! Une récompense épique t\'attend !',
        text_empty: 'L\'énergie mystique s\'est dissipée... box vide.',
        image_closed: `${BASE_IMG_URL}/epic_closed.png`,
        image_opening: `${BASE_IMG_URL}/epic_opening.png`,
        image_opened: `${BASE_IMG_URL}/epic_opened.png`,
        image_empty: `${BASE_IMG_URL}/epic_empty.png`
      },
      {
        rarity: 'legendary',
        name: 'Mystery Box Légendaire',
        emoji: '👑',
        color: '#FFD700',
        rewards_count: 3,
        text_title: '👑 MYSTERY BOX LÉGENDAIRE',
        text_description: 'Une box dorée rayonnante de puissance...',
        text_opening: 'Une Mystery Box **légendaire** explose de lumière dorée...',
        text_success: 'LÉGENDAIRE ! Un trésor d\'exception !',
        text_empty: 'Même la légende peut parfois décevoir...',
        image_closed: `${BASE_IMG_URL}/legendary_closed.png`,
        image_opening: `${BASE_IMG_URL}/legendary_opening.png`,
        image_opened: `${BASE_IMG_URL}/legendary_opened.png`,
        image_empty: `${BASE_IMG_URL}/legendary_empty.png`
      }
    ];

    for (const box of rarities) {
      // Vérifier si une box de cette rareté existe déjà pour ce thème
      const existing = await this.queryOne(`
        SELECT id FROM mystery_box_config
        WHERE guild_id = $1 AND theme_id = $2 AND rarity = $3
      `, [guildId, themeId, box.rarity]);

      if (!existing) {
        await this.query(`
          INSERT INTO mystery_box_config (
            guild_id, theme_id, rarity, name, emoji, color,
            prob_collectible, prob_super_bonus,
            rewards_count, is_default, is_enabled, animation_duration,
            text_title, text_description, text_opening, text_success, text_empty,
            image_closed, image_opening, image_opened, image_empty
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, TRUE, 3000, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          guildId,
          themeId,
          box.rarity,
          box.name,
          box.emoji,
          box.color,
          90, // 90% collectible
          10, // 10% super bonus
          box.rewards_count,
          box.text_title,
          box.text_description,
          box.text_opening,
          box.text_success,
          box.text_empty,
          box.image_closed,
          box.image_opening,
          box.image_opened,
          box.image_empty
        ]);
      }
    }

    console.log(`📦 Mystery Boxes par défaut créées pour le thème ${themeId}`);
  }

  /**
   * Récupérer le calendrier complet d'un thème
   * @param {string} guildId - ID du serveur
   * @param {number} themeId - ID du thème
   * @returns {array} Calendrier avec toutes les récompenses
   */
  async getDailyRewardsCalendar(guildId, themeId) {
    return this.query(`
      SELECT * FROM v_daily_rewards_calendar
      WHERE guild_id = $1 AND theme_id = $2
      ORDER BY day_number
    `, [guildId, themeId]);
  }

  /**
   * Récupérer le streak de claim pour un thème spécifique
   * Le streak est stocké dans claim_streak_by_theme JSONB de players
   * Format: {"themeId": {"current": X, "best": Y, "last_claim": "2025-12-20", "total": Z}}
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} themeId - ID du thème
   * @returns {object} Streak info {current, best, lastClaim, total}
   */
  async getClaimStreakByTheme(guildId, playerId, themeId) {
    const player = await this.queryOne(`
      SELECT claim_streak_by_theme
      FROM players
      WHERE guild_id = $1 AND id = $2
    `, [guildId, playerId]);

    if (!player || !player.claim_streak_by_theme) {
      return { current: 0, best: 0, lastClaim: null, total: 0 };
    }

    const themeData = player.claim_streak_by_theme[themeId.toString()] || {};
    return {
      current: themeData.current || 0,
      best: themeData.best || 0,
      lastClaim: themeData.last_claim || null,
      total: themeData.total || 0
    };
  }

  /**
   * Infos complètes daily claim pour un thème (v2.2.1 theme-aware)
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number|null} themeId - ID du thème (null = thème actif)
   * @returns {object} Infos complètes
   */
  async getDailyClaimInfoByTheme(guildId, playerId, themeId = null) {
    // Si pas de themeId, récupérer le thème actif
    if (!themeId) {
      const activeTheme = await this.getActiveTheme(guildId);
      if (!activeTheme) return null;
      themeId = activeTheme.id;
    }

    // Récupérer les infos du thème
    const theme = await this.queryOne(`
      SELECT id, name, duration_days, activated_at
      FROM themes
      WHERE id = $1 AND guild_id = $2
    `, [themeId, guildId]);

    if (!theme) return null;

    // Récupérer le streak par thème
    const streak = await this.getClaimStreakByTheme(guildId, playerId, themeId);

    // Calculer si le joueur peut claim aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const canClaim = !streak.lastClaim || streak.lastClaim !== today;

    // Compter aussi les jours rattrapés (catchups)
    const catchupCount = await this.queryOne(`
      SELECT COUNT(*) as count FROM daily_catchup_history
      WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
    `, [guildId, playerId, themeId]);
    const caughtUpDays = parseInt(catchupCount?.count || 0);

    // Progression du joueur: nombre de récompenses obtenues (claims + catchups)
    // LOGIQUE SÉQUENTIELLE: on compte TOUTES les récompenses obtenues
    const totalRewardsObtained = (streak.total % theme.duration_days) + caughtUpDays;
    const currentDay = totalRewardsObtained; // Nombre total de récompenses obtenues

    // Prochain numéro de récompense à réclamer (1-indexed)
    const nextClaimDay = totalRewardsObtained + 1;

    // Calculer les jours restants du thème (basé sur activated_at)
    const now = new Date();
    const themeActivated = new Date(theme.activated_at);
    const themeEndDate = new Date(themeActivated);
    themeEndDate.setDate(themeEndDate.getDate() + theme.duration_days);
    const themeDaysRemaining = Math.max(0, Math.ceil((themeEndDate - now) / (1000 * 60 * 60 * 24)));
    const themeDaysPassed = theme.duration_days - themeDaysRemaining;

    // Récupérer la récompense du prochain jour (si peut claim)
    const todayReward = canClaim ? await this.getDailyRewardForDay(guildId, themeId, nextClaimDay) : null;

    return {
      themeId: theme.id,
      themeName: theme.name,
      themeDuration: theme.duration_days,
      themeActivatedAt: theme.activated_at,
      themeDaysRemaining,        // Jours restants avant fin du thème
      themeDaysPassed,           // Jours écoulés depuis activation
      currentDay,                // Nombre total de récompenses obtenues (claims + catchups)
      nextClaimDay,              // Prochain numéro de récompense (1-indexed, séquentiel)
      currentStreak: streak.current,
      bestStreak: streak.best,
      totalClaims: streak.total,
      caughtUpDays,              // Nombre de jours rattrapés (achetés)
      lastClaim: streak.lastClaim,
      canClaim,
      todayReward
    };
  }

  /**
   * Enregistrer un claim quotidien pour un thème (v2.2.1 theme-aware)
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} themeId - ID du thème
   * @param {object} reward - Récompense {type, rarity, amount, detail}
   * @returns {object} Résultat du claim
   */
  async recordDailyClaimByTheme(guildId, playerId, themeId, reward) {
    const today = new Date().toISOString().split('T')[0];

    // Récupérer le streak actuel du thème
    const streak = await this.getClaimStreakByTheme(guildId, playerId, themeId);

    // Vérifier si déjà claim aujourd'hui
    if (streak.lastClaim === today) {
      console.log(`📅 [DAILY] Player ${playerId} already claimed today for theme ${themeId}`);
      return { success: false, reason: 'already_claimed' };
    }

    // Récupérer la durée et date d'activation du thème
    const theme = await this.queryOne('SELECT duration_days, activated_at FROM themes WHERE id = $1', [themeId]);
    if (!theme) {
      return { success: false, reason: 'theme_not_found' };
    }

    // Calculer le jour actuel du thème basé sur la date d'activation
    const now = new Date();
    const themeActivatedAt = new Date(theme.activated_at);
    const claimDay = Math.min(
      Math.floor((now - themeActivatedAt) / (1000 * 60 * 60 * 24)) + 1,
      theme.duration_days
    );

    // Calculer le nouveau streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak;
    if (streak.lastClaim === yesterdayStr) {
      newStreak = streak.current + 1;
      console.log(`📅 [DAILY] Consecutive claim! Streak: ${newStreak}`);
    } else {
      newStreak = 1;
      if (streak.lastClaim) {
        console.log(`📅 [DAILY] Streak broken for player ${playerId} on theme ${themeId}`);
      }
    }

    const newBestStreak = Math.max(streak.best, newStreak);
    const newTotalClaims = streak.total + 1;

    // Mettre à jour le claim_streak_by_theme JSONB ET le streak global
    // Le streak global est utilisé pour les badges Engagement (persiste entre les thèmes)
    // IMPORTANT: Calculer le streak global depuis daily_claim_logs pour plus de fiabilité

    // 1. Récupérer les données actuelles du joueur
    const playerData = await this.queryOne(`
      SELECT best_claim_streak FROM players WHERE guild_id = $1 AND id = $2
    `, [guildId, playerId]);

    // 2. Calculer le streak global en comptant les jours consécutifs en arrière depuis hier
    // On regarde tous les thèmes car le streak global persiste entre les thèmes
    // NOTE: Au moment de ce calcul, le claim d'aujourd'hui n'est PAS encore dans les logs
    // Donc on compte depuis yesterday et on ajoute +1 à la fin
    const globalStreakResult = await this.queryOne(`
      WITH claim_dates AS (
        SELECT DISTINCT claim_date::date as claim_day
        FROM daily_claim_logs
        WHERE guild_id = $1 AND player_id = $2
        ORDER BY claim_day DESC
      ),
      numbered AS (
        SELECT claim_day,
               ROW_NUMBER() OVER (ORDER BY claim_day DESC) as rn,
               ($3::date - claim_day)::int as days_ago
        FROM claim_dates
      ),
      consecutive AS (
        SELECT claim_day, rn, days_ago
        FROM numbered
        WHERE days_ago = rn - 1  -- Fix: rn-1 car rn commence à 1, days_ago à 0 pour yesterday
      )
      SELECT COUNT(*) as streak FROM consecutive
    `, [guildId, playerId, yesterdayStr]);

    // +1 pour inclure le claim d'aujourd'hui
    let globalNewStreak = (parseInt(globalStreakResult?.streak) || 0) + 1;

    // 3. Compter le total des claims
    const totalClaimsResult = await this.queryOne(`
      SELECT COUNT(DISTINCT claim_date) as total FROM daily_claim_logs
      WHERE guild_id = $1 AND player_id = $2
    `, [guildId, playerId]);
    // +1 car le claim d'aujourd'hui n'est pas encore dans les logs
    const globalTotalClaims = (parseInt(totalClaimsResult?.total) || 0) + 1;

    const globalBestStreak = Math.max(playerData?.best_claim_streak || 0, globalNewStreak);

    console.log(`📅 [DAILY] Global streak calculated: ${globalNewStreak} (best: ${globalBestStreak}, total: ${globalTotalClaims})`);

    await this.query(`
      UPDATE players SET
        claim_streak_by_theme = COALESCE(claim_streak_by_theme, '{}')::jsonb ||
          jsonb_build_object($3::text, jsonb_build_object(
            'current', $4::int,
            'best', $5::int,
            'last_claim', $6::text,
            'total', $7::int
          )),
        current_claim_streak = $8,
        best_claim_streak = $9,
        last_daily_claim = $6::date,
        total_daily_claims = $10,
        updated_at = NOW()
      WHERE guild_id = $1 AND id = $2
    `, [guildId, playerId, themeId.toString(), newStreak, newBestStreak, today, newTotalClaims, globalNewStreak, globalBestStreak, globalTotalClaims]);

    // Logger le claim avec theme_id
    await this.query(`
      INSERT INTO daily_claim_logs
      (guild_id, theme_id, player_id, claim_day, claim_date, streak_at_claim, reward_type, reward_rarity, reward_amount, reward_detail)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      guildId,
      themeId,
      playerId,
      claimDay,
      today,
      newStreak,
      reward.type,
      reward.rarity || null,
      reward.amount || null,
      reward.detail || null
    ]);

    console.log(`✅ [DAILY] Claim recorded: Theme ${themeId}, Day ${claimDay}, Streak ${newStreak} (global: ${globalNewStreak}), Reward: ${reward.type}`);

    return {
      success: true,
      themeId,
      claimDay,
      streak: newStreak,
      bestStreak: newBestStreak,
      totalClaims: newTotalClaims,
      reward,
      // Streak global pour les badges Engagement
      globalStreak: globalNewStreak,
      globalBestStreak: globalBestStreak
    };
  }

  /**
   * Mettre à jour une récompense du calendrier
   * @param {string} guildId - ID du serveur
   * @param {number} themeId - ID du thème
   * @param {number} dayNumber - Numéro du jour
   * @param {object} rewardData - Données de la récompense
   * @returns {object} Récompense mise à jour
   */
  async updateDailyReward(guildId, themeId, dayNumber, rewardData) {
    const {
      reward_type,
      reward_rarity,
      reward_amount,
      reward_item_id,
      display_name,
      display_emoji,
      display_description,
      is_milestone,
      is_bonus_day,
      bonus_multiplier,
      animation_type
    } = rewardData;

    const result = await this.queryOne(`
      UPDATE daily_rewards_config SET
        reward_type = COALESCE($4, reward_type),
        reward_rarity = COALESCE($5, reward_rarity),
        reward_amount = COALESCE($6, reward_amount),
        reward_item_id = COALESCE($7, reward_item_id),
        display_name = COALESCE($8, display_name),
        display_emoji = COALESCE($9, display_emoji),
        display_description = COALESCE($10, display_description),
        is_milestone = COALESCE($11, is_milestone),
        is_bonus_day = COALESCE($12, is_bonus_day),
        bonus_multiplier = COALESCE($13, bonus_multiplier),
        animation_type = COALESCE($14, animation_type),
        updated_at = NOW()
      WHERE guild_id = $1 AND theme_id = $2 AND day_number = $3
      RETURNING *
    `, [guildId, themeId, dayNumber, reward_type, reward_rarity, reward_amount,
        reward_item_id, display_name, display_emoji, display_description,
        is_milestone, is_bonus_day, bonus_multiplier, animation_type]);

    return result;
  }

  // ============================================================================

  /**
   * Seed les badges Super Bonus en base de données
   */
  async seedSuperBonusBadges(guildId = null) {
    guildId = guildId || process.env.GUILD_ID;

    console.log('🏆 SEEDING: Badges Super Bonus\n');
    console.log('═'.repeat(100));

    const badges = [
      // Vision Divine - Tier 1 à 5
      {
        code: 'VOYANT_DIVIN_APPRENTI',
        name: 'Voyant Divin',
        description: 'As-tu vu l\'avenir ?',
        emoji: '👁️✨',
        color: '#9b59b6',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'vision_divine',
        condition_value: 10,
        display_order: 1
      },
      {
        code: 'VOYANT_DIVIN_EXPERT',
        name: 'Expert Vision',
        description: 'Tu commences à maîtriser la voyance',
        emoji: '👁️🔮',
        color: '#9b59b6',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'vision_divine',
        condition_value: 50,
        display_order: 2
      },
      {
        code: 'VOYANT_DIVIN_MAITRE',
        name: 'Maître Vision',
        description: 'Tu vois TOUT',
        emoji: '👁️👑',
        color: '#9b59b6',
        rarity: 'legendary',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'vision_divine',
        condition_value: 100,
        display_order: 3
      },

      // Bouclier Anti-Piège - Tier 1 à 3
      {
        code: 'BOUCLIER_NOVICE',
        name: 'Gardien Novice',
        description: 'Premier piège bloqué !',
        emoji: '🛡️✨',
        color: '#3498db',
        rarity: 'rare',
        category: 'super_bonus',
        condition_type: 'trap_block',
        condition_target: null,
        condition_value: 1,
        display_order: 10
      },
      {
        code: 'BOUCLIER_EXPERT',
        name: 'Défenseur Aguerri',
        description: 'Les pièges ne te font plus peur',
        emoji: '🛡️⚡',
        color: '#3498db',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'trap_block',
        condition_target: null,
        condition_value: 25,
        display_order: 11
      },
      {
        code: 'BOUCLIER_LEGENDE',
        name: 'Indestructible',
        description: 'Rien ne peut t\'arrêter',
        emoji: '🛡️👑',
        color: '#3498db',
        rarity: 'legendary',
        category: 'super_bonus',
        condition_type: 'trap_block',
        condition_target: null,
        condition_value: 50,
        display_order: 12
      },

      // Jackpot x2 - Tier 1 à 3
      {
        code: 'JACKPOT_CHANCEUX',
        name: 'Coup de Chance',
        description: 'Ton premier jackpot !',
        emoji: '💰✨',
        color: '#f1c40f',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'jackpot_x2',
        condition_value: 10,
        display_order: 20
      },
      {
        code: 'JACKPOT_FORTUNE',
        name: 'Machine à Gains',
        description: 'Tu attires l\'or !',
        emoji: '💰🎰',
        color: '#f1c40f',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'jackpot_x2',
        condition_value: 30,
        display_order: 21
      },
      {
        code: 'JACKPOT_ROI',
        name: 'Roi du Jackpot',
        description: 'Tu transformes tout en or',
        emoji: '💰👑',
        color: '#f1c40f',
        rarity: 'legendary',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'jackpot_x2',
        condition_value: 50,
        display_order: 22
      },

      // Aimant à Légendaires - Tier 1 à 3
      {
        code: 'AIMANT_DEBUTANT',
        name: 'Attraction Magique',
        description: 'Les légendaires t\'aiment bien',
        emoji: '🧲✨',
        color: '#e74c3c',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'legendary_magnet',
        condition_value: 5,
        display_order: 30
      },
      {
        code: 'AIMANT_COLLECTIONNEUR',
        name: 'Collectionneur Légendaire',
        description: 'Tu es une véritable attraction',
        emoji: '🧲💎',
        color: '#e74c3c',
        rarity: 'legendary',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'legendary_magnet',
        condition_value: 15,
        display_order: 31
      },
      {
        code: 'AIMANT_MAITRE',
        name: 'Maître de l\'Aimant',
        description: 'Tous les légendaires te trouvent',
        emoji: '🧲👑',
        color: '#e74c3c',
        rarity: 'mythic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'legendary_magnet',
        condition_value: 30,
        display_order: 32
      },

      // Badge spécial: Débloquer au moins 1 de chaque type de Super Bonus
      {
        code: 'SUPER_BONUS_COLLECTIONNEUR',
        name: 'Collectionneur de Super Bonus',
        description: 'Tu as utilisé tous les types de Super Bonus !',
        emoji: '🌟🏆',
        color: '#9b59b6',
        rarity: 'legendary',
        category: 'super_bonus',
        condition_type: 'custom',
        condition_target: 'all_super_bonus_types',
        condition_value: 11, // Nombre total de types de super bonus
        display_order: 100
      }
    ];

    let created = 0;
    let updated = 0;

    for (const badge of badges) {
      try {
        const result = await this.createBadge(badge);

        if (result) {
          created++;
          console.log(`   ✅ ${badge.emoji} ${badge.name} (${badge.rarity})`);
        }
      } catch (error) {
        if (error.message.includes('duplicate')) {
          updated++;
          console.log(`   ⏭️  ${badge.emoji} ${badge.name} déjà existant`);
        } else {
          console.error(`   ❌ Erreur création ${badge.name}:`, error.message);
        }
      }
    }

    console.log(`\n🏆 Seeding terminé: ${created} créés, ${updated} mis à jour (total: ${badges.length})`);
    return { created, updated, total: badges.length };
  }

  // ============================================================================
  // SYSTÈME LOOMIX - Monnaie Virtuelle
  // ============================================================================

  /**
   * Récupère le solde en monnaie virtuelle d'un joueur
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {string} currencyType - Type de monnaie (default: 'loomix')
   * @returns {object} Informations de balance
   */
  async getPlayerCurrency(guildId, playerId, currencyType = 'loomix') {
    let currency = await this.queryOne(`
      SELECT * FROM player_currency
      WHERE guild_id = $1 AND player_id = $2 AND currency_type = $3
    `, [guildId, playerId, currencyType]);

    // Créer l'entrée si n'existe pas
    if (!currency) {
      currency = await this.queryOne(`
        INSERT INTO player_currency (guild_id, player_id, currency_type, balance, total_earned, total_spent)
        VALUES ($1, $2, $3, 0, 0, 0)
        RETURNING *
      `, [guildId, playerId, currencyType]);
    }

    return currency;
  }

  /**
   * Ajoute de la monnaie à un joueur (gain)
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} amount - Montant à ajouter (positif)
   * @param {string} transactionType - Type de transaction (daily_claim, mission_reward, etc.)
   * @param {string} source - Source détaillée (ex: 'day_7', 'mission_123')
   * @param {string} description - Description optionnelle
   * @returns {object} Nouvelle balance + transaction
   */
  async addCurrency(guildId, playerId, amount, transactionType, source = null, description = null) {
    if (amount <= 0) {
      throw new Error('Le montant à ajouter doit être positif');
    }

    // Récupérer ou créer l'entrée
    const current = await this.getPlayerCurrency(guildId, playerId);

    // Mettre à jour le solde
    const newBalance = current.balance + amount;
    const newTotalEarned = current.total_earned + amount;

    await this.queryOne(`
      UPDATE player_currency SET
        balance = $4,
        total_earned = $5,
        updated_at = NOW()
      WHERE guild_id = $1 AND player_id = $2 AND currency_type = $3
    `, [guildId, playerId, 'loomix', newBalance, newTotalEarned]);

    // Enregistrer la transaction
    const transaction = await this.queryOne(`
      INSERT INTO currency_transactions
        (guild_id, player_id, currency_type, amount, balance_after, transaction_type, source, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [guildId, playerId, 'loomix', amount, newBalance, transactionType, source, description]);

    console.log(`💎 [LOOMIX] +${amount} pour joueur ${playerId} (${transactionType}) → Nouveau solde: ${newBalance}`);

    return {
      newBalance,
      totalEarned: newTotalEarned,
      transaction
    };
  }

  /**
   * Dépense de la monnaie d'un joueur
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} amount - Montant à dépenser (positif)
   * @param {string} transactionType - Type de transaction (catchup_purchase, shop_purchase, etc.)
   * @param {string} source - Source détaillée
   * @param {string} description - Description optionnelle
   * @returns {object} Nouvelle balance + transaction ou erreur si solde insuffisant
   */
  async spendCurrency(guildId, playerId, amount, transactionType, source = null, description = null) {
    if (amount <= 0) {
      throw new Error('Le montant à dépenser doit être positif');
    }

    const current = await this.getPlayerCurrency(guildId, playerId);

    if (current.balance < amount) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        currentBalance: current.balance,
        required: amount,
        missing: amount - current.balance
      };
    }

    // Mettre à jour le solde
    const newBalance = current.balance - amount;
    const newTotalSpent = current.total_spent + amount;

    await this.queryOne(`
      UPDATE player_currency SET
        balance = $4,
        total_spent = $5,
        updated_at = NOW()
      WHERE guild_id = $1 AND player_id = $2 AND currency_type = $3
    `, [guildId, playerId, 'loomix', newBalance, newTotalSpent]);

    // Enregistrer la transaction (montant négatif)
    const transaction = await this.queryOne(`
      INSERT INTO currency_transactions
        (guild_id, player_id, currency_type, amount, balance_after, transaction_type, source, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [guildId, playerId, 'loomix', -amount, newBalance, transactionType, source, description]);

    console.log(`💎 [LOOMIX] -${amount} pour joueur ${playerId} (${transactionType}) → Nouveau solde: ${newBalance}`);

    return {
      success: true,
      newBalance,
      totalSpent: newTotalSpent,
      transaction
    };
  }

  /**
   * Récupère l'historique des transactions d'un joueur
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} limit - Nombre max de transactions
   * @returns {array} Liste des transactions
   */
  async getCurrencyHistory(guildId, playerId, limit = 20) {
    return await this.queryAll(`
      SELECT * FROM currency_transactions
      WHERE guild_id = $1 AND player_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `, [guildId, playerId, limit]);
  }

  /**
   * Récupère la configuration de la monnaie du serveur
   * @param {string} guildId - ID du serveur
   * @param {string} currencyType - Type de monnaie (default: 'loomix')
   * @returns {object} Configuration de la monnaie
   */
  async getGuildCurrencyConfig(guildId, currencyType = 'loomix') {
    let config = await this.queryOne(`
      SELECT * FROM guild_currency_config
      WHERE guild_id = $1 AND currency_type = $2
    `, [guildId, currencyType]);

    // Créer la config par défaut si n'existe pas
    if (!config) {
      config = await this.queryOne(`
        INSERT INTO guild_currency_config
          (guild_id, currency_type, display_name, display_emoji, daily_claim_bonus, streak_bonus_per_day, mission_completion_bonus)
        VALUES ($1, $2, 'Loomix', '💎', 10, 5, 25)
        RETURNING *
      `, [guildId, currencyType]);
    }

    return config;
  }

  /**
   * Met à jour la configuration de la monnaie du serveur
   * @param {string} guildId - ID du serveur
   * @param {object} configData - Données de configuration
   * @returns {object} Configuration mise à jour
   */
  async updateGuildCurrencyConfig(guildId, configData) {
    const {
      display_name,
      display_emoji,
      daily_claim_bonus,
      streak_bonus_per_day,
      mission_completion_bonus
    } = configData;

    return await this.queryOne(`
      UPDATE guild_currency_config SET
        display_name = COALESCE($2, display_name),
        display_emoji = COALESCE($3, display_emoji),
        daily_claim_bonus = COALESCE($4, daily_claim_bonus),
        streak_bonus_per_day = COALESCE($5, streak_bonus_per_day),
        mission_completion_bonus = COALESCE($6, mission_completion_bonus),
        updated_at = NOW()
      WHERE guild_id = $1 AND currency_type = 'loomix'
      RETURNING *
    `, [guildId, display_name, display_emoji, daily_claim_bonus, streak_bonus_per_day, mission_completion_bonus]);
  }

  // ============================================================================
  // SYSTÈME DE RATTRAPAGE (CATCHUP)
  // ============================================================================

  /**
   * Récupère la configuration du rattrapage pour un thème
   * @param {string} guildId - ID du serveur
   * @param {number} themeId - ID du thème
   * @returns {object} Configuration du rattrapage
   */
  async getCatchupConfig(guildId, themeId) {
    let config = await this.queryOne(`
      SELECT * FROM daily_catchup_config
      WHERE guild_id = $1 AND theme_id = $2
    `, [guildId, themeId]);

    // Créer la config par défaut si n'existe pas
    if (!config) {
      config = await this.queryOne(`
        INSERT INTO daily_catchup_config
          (guild_id, theme_id, currency_type, base_price, price_increment, pricing_mode, enabled)
        VALUES ($1, $2, 'loomix', 250, 100, 'increment', TRUE)
        RETURNING *
      `, [guildId, themeId]);
    }

    return config;
  }

  /**
   * Met à jour la configuration du rattrapage pour un thème
   * @param {string} guildId - ID du serveur
   * @param {number} themeId - ID du thème
   * @param {object} configData - Données de configuration
   * @returns {object} Configuration mise à jour
   */
  async updateCatchupConfig(guildId, themeId, configData) {
    const {
      base_price,
      price_increment,
      price_multiplier,
      pricing_mode,
      max_price,
      max_catchup_days,
      enabled
    } = configData;

    return await this.queryOne(`
      UPDATE daily_catchup_config SET
        base_price = COALESCE($3, base_price),
        price_increment = COALESCE($4, price_increment),
        price_multiplier = COALESCE($5, price_multiplier),
        pricing_mode = COALESCE($6, pricing_mode),
        max_price = COALESCE($7, max_price),
        max_catchup_days = COALESCE($8, max_catchup_days),
        enabled = COALESCE($9, enabled),
        updated_at = NOW()
      WHERE guild_id = $1 AND theme_id = $2
      RETURNING *
    `, [guildId, themeId, base_price, price_increment, price_multiplier, pricing_mode, max_price, max_catchup_days, enabled]);
  }

  /**
   * Calcule le prix du rattrapage pour N jours manqués
   * @param {string} guildId - ID du serveur
   * @param {number} themeId - ID du thème
   * @param {number} missedDaysCount - Nombre de jours manqués à rattraper
   * @param {number|null} playerId - ID du joueur (pour calculer l'offset des achats précédents)
   * @returns {object} Prix détaillé
   */
  async calculateCatchupPrice(guildId, themeId, missedDaysCount, playerId = null) {
    const config = await this.getCatchupConfig(guildId, themeId);

    if (!config.enabled) {
      return { enabled: false, price: 0 };
    }

    // Calculer l'offset basé sur les achats précédents du joueur
    let previousPurchases = 0;
    if (playerId) {
      const result = await this.queryOne(`
        SELECT COUNT(*) as count
        FROM daily_catchup_history
        WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
      `, [guildId, playerId, themeId]);
      previousPurchases = parseInt(result?.count || 0);
    }

    let totalPrice = 0;
    const priceBreakdown = [];

    for (let i = 0; i < missedDaysCount; i++) {
      let dayPrice;
      // La position inclut l'offset des achats précédents
      const position = previousPurchases + i;

      if (config.pricing_mode === 'increment') {
        // Prix = base + (increment * position)
        dayPrice = config.base_price + (config.price_increment * position);
      } else {
        // Prix = base * (multiplier ^ position)
        dayPrice = Math.floor(config.base_price * Math.pow(parseFloat(config.price_multiplier), position));
      }

      // Appliquer le prix max si configuré
      if (config.max_price > 0) {
        dayPrice = Math.min(dayPrice, config.max_price);
      }

      priceBreakdown.push(dayPrice);
      totalPrice += dayPrice;
    }

    return {
      enabled: true,
      totalPrice,
      priceBreakdown,
      pricingMode: config.pricing_mode,
      basePrice: config.base_price,
      priceIncrement: config.price_increment,
      priceMultiplier: parseFloat(config.price_multiplier),
      maxPrice: config.max_price,
      previousPurchases  // Retourner le nombre d'achats précédents
    };
  }

  /**
   * Récupère les jours manqués d'un joueur pour un thème
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} themeId - ID du thème
   * @returns {array} Liste des jours manqués avec leur statut
   */
  async getMissedDays(guildId, playerId, themeId) {
    // Récupérer le thème et sa date d'activation
    const theme = await this.getThemeById(guildId, themeId);
    if (!theme) return [];

    const themeActivatedAt = new Date(theme.activated_at);
    const now = new Date();
    const themeDaysPassed = Math.floor((now - themeActivatedAt) / (1000 * 60 * 60 * 24));

    // Récupérer les jours déjà claim (depuis daily_claim_logs)
    const claims = await this.queryAll(`
      SELECT DISTINCT claim_day FROM daily_claim_logs
      WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
    `, [guildId, playerId, themeId]);

    const claimedDays = new Set(claims.map(c => c.claim_day));

    // Récupérer les jours déjà rattrapés
    const catchups = await this.queryAll(`
      SELECT day_number FROM daily_catchup_history
      WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
    `, [guildId, playerId, themeId]);

    const caughtUpDays = new Set(catchups.map(c => c.day_number));

    // Calculer les jours manqués
    const missedDays = [];
    for (let day = 1; day <= themeDaysPassed; day++) {
      if (!claimedDays.has(day) && !caughtUpDays.has(day)) {
        missedDays.push(day);
      }
    }

    return missedDays;
  }

  /**
   * Récupère les jours réclamés d'un joueur pour un thème
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} themeId - ID du thème
   * @returns {array} Liste des numéros de jours réclamés
   */
  async getClaimedDays(guildId, playerId, themeId) {
    const claims = await this.queryAll(`
      SELECT DISTINCT claim_day FROM daily_claim_logs
      WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
      ORDER BY claim_day
    `, [guildId, playerId, themeId]);

    return claims.map(c => c.claim_day);
  }

  /**
   * Récupère les jours rattrapés d'un joueur pour un thème
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} themeId - ID du thème
   * @returns {array} Liste des numéros de jours rattrapés
   */
  async getCaughtUpDays(guildId, playerId, themeId) {
    const catchups = await this.queryAll(`
      SELECT day_number FROM daily_catchup_history
      WHERE guild_id = $1 AND player_id = $2 AND theme_id = $3
      ORDER BY day_number
    `, [guildId, playerId, themeId]);

    return catchups.map(c => c.day_number);
  }

  /**
   * Achète le rattrapage d'un jour manqué
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} themeId - ID du thème
   * @param {number} dayNumber - Numéro du jour à rattraper
   * @returns {object} Résultat de l'achat + récompense obtenue
   */
  async purchaseCatchupDay(guildId, playerId, themeId, dayNumber) {
    // Vérifier que le jour est bien manqué
    const missedDays = await this.getMissedDays(guildId, playerId, themeId);
    if (!missedDays.includes(dayNumber)) {
      return {
        success: false,
        error: 'DAY_NOT_MISSED',
        message: 'Ce jour n\'est pas manqué ou a déjà été rattrapé'
      };
    }

    // Calculer le prix pour ce jour (avec offset des achats précédents)
    const dayIndex = missedDays.indexOf(dayNumber);
    const priceInfo = await this.calculateCatchupPrice(guildId, themeId, dayIndex + 1, playerId);

    if (!priceInfo.enabled) {
      return {
        success: false,
        error: 'CATCHUP_DISABLED',
        message: 'Le rattrapage est désactivé pour ce thème'
      };
    }

    const price = priceInfo.priceBreakdown[dayIndex];

    // Tenter de dépenser les Loomix
    const spendResult = await this.spendCurrency(
      guildId,
      playerId,
      price,
      'catchup_purchase',
      `day_${dayNumber}_theme_${themeId}`,
      `Rattrapage jour ${dayNumber}`
    );

    if (!spendResult.success) {
      return {
        success: false,
        error: spendResult.error,
        currentBalance: spendResult.currentBalance,
        required: price,
        missing: spendResult.missing
      };
    }

    // Récupérer la récompense du jour
    const reward = await this.getDailyRewardForDay(guildId, themeId, dayNumber);

    // Enregistrer l'historique du rattrapage
    await this.queryOne(`
      INSERT INTO daily_catchup_history
        (guild_id, player_id, theme_id, day_number, price_paid, reward_type, reward_details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      guildId,
      playerId,
      themeId,
      dayNumber,
      price,
      reward?.reward_type || 'mystery_box',
      JSON.stringify(reward || {})
    ]);

    console.log(`💎 [CATCHUP] Joueur ${playerId} a rattrapé le jour ${dayNumber} pour ${price} Loomix`);

    return {
      success: true,
      dayNumber,
      pricePaid: price,
      newBalance: spendResult.newBalance,
      reward
    };
  }

  /**
   * Achète plusieurs jours de rattrapage d'un coup
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} themeId - ID du thème
   * @param {number} daysCount - Nombre de jours à rattraper (prend les premiers manqués)
   * @returns {object} Résultat de l'achat
   */
  async purchaseMultipleCatchupDays(guildId, playerId, themeId, daysCount) {
    // Récupérer les jours manqués
    const missedDays = await this.getMissedDays(guildId, playerId, themeId);

    if (missedDays.length === 0) {
      return {
        success: false,
        error: 'NO_MISSED_DAYS',
        message: 'Aucun jour à rattraper'
      };
    }

    // Calculer le nombre de récompenses déjà obtenues (claims + catchups)
    const claimedDays = await this.getClaimedDays(guildId, playerId, themeId);
    const caughtUpDays = await this.getCaughtUpDays(guildId, playerId, themeId);
    const rewardsAlreadyObtained = claimedDays.length + caughtUpDays.length;

    // Limiter au nombre de jours manqués disponibles
    const actualDaysCount = Math.min(daysCount, missedDays.length);

    // Calculer le prix total avec offset des achats précédents
    const priceInfo = await this.calculateCatchupPrice(guildId, themeId, actualDaysCount, playerId);

    if (!priceInfo.enabled) {
      return {
        success: false,
        error: 'CATCHUP_DISABLED',
        message: 'Le rattrapage est désactivé pour ce thème'
      };
    }

    // Vérifier le solde
    const currency = await this.getPlayerCurrency(guildId, playerId);
    if (currency.balance < priceInfo.totalPrice) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        currentBalance: currency.balance,
        required: priceInfo.totalPrice,
        missing: priceInfo.totalPrice - currency.balance
      };
    }

    // Dépenser le total en une seule transaction
    const spendResult = await this.spendCurrency(
      guildId,
      playerId,
      priceInfo.totalPrice,
      'catchup_purchase',
      `rewards_${rewardsAlreadyObtained + 1}_to_${rewardsAlreadyObtained + actualDaysCount}_theme_${themeId}`,
      `Rattrapage ${actualDaysCount} récompense(s)`
    );

    if (!spendResult.success) {
      return {
        success: false,
        error: spendResult.error,
        currentBalance: spendResult.currentBalance,
        required: priceInfo.totalPrice,
        missing: spendResult.missing
      };
    }

    // Enregistrer chaque rattrapage et récupérer les récompenses SÉQUENTIELLES
    const rewards = [];
    for (let i = 0; i < actualDaysCount; i++) {
      const dayPrice = priceInfo.priceBreakdown[i];

      // Le JOUR DU THÈME manquant (pour le calendrier)
      const themeDayNumber = missedDays[i];  // Ex: jour 1, 2, 3... du thème

      // Le numéro de récompense est SÉQUENTIEL (basé sur le nombre déjà obtenu)
      const rewardNumber = rewardsAlreadyObtained + i + 1;

      // Récupérer la récompense correspondante (numéro séquentiel)
      const reward = await this.getDailyRewardForDay(guildId, themeId, rewardNumber);

      // Enregistrer l'historique avec le JOUR DU THÈME (pour le calendrier)
      await this.queryOne(`
        INSERT INTO daily_catchup_history
          (guild_id, player_id, theme_id, day_number, price_paid, reward_type, reward_details)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        guildId,
        playerId,
        themeId,
        themeDayNumber,  // Stocker le JOUR DU THÈME pour le calendrier
        dayPrice,
        reward?.reward_type || 'mystery_box',
        JSON.stringify(reward || {})
      ]);

      rewards.push({
        themeDayNumber,   // Jour du thème (pour calendrier)
        rewardNumber,     // Numéro de récompense séquentielle
        dayPrice,
        reward
      });
    }

    console.log(`💎 [CATCHUP] Joueur ${playerId} a rattrapé ${actualDaysCount} jours pour ${priceInfo.totalPrice} Loomix`);

    return {
      success: true,
      daysCount: actualDaysCount,
      daysProcessed: actualDaysCount,
      totalPaid: priceInfo.totalPrice,
      newBalance: spendResult.newBalance,
      rewards,
      previousPurchases: priceInfo.previousPurchases
    };
  }

  /**
   * Récupère l'historique de rattrapage d'un joueur
   * @param {string} guildId - ID du serveur
   * @param {number} playerId - ID du joueur
   * @param {number} themeId - ID du thème (optionnel)
   * @returns {array} Historique des rattrapages
   */
  async getCatchupHistory(guildId, playerId, themeId = null) {
    if (themeId) {
      return await this.queryAll(`
        SELECT dch.*, t.name as theme_name
        FROM daily_catchup_history dch
        JOIN themes t ON dch.theme_id = t.id
        WHERE dch.guild_id = $1 AND dch.player_id = $2 AND dch.theme_id = $3
        ORDER BY dch.created_at DESC
      `, [guildId, playerId, themeId]);
    }

    return await this.queryAll(`
      SELECT dch.*, t.name as theme_name
      FROM daily_catchup_history dch
      JOIN themes t ON dch.theme_id = t.id
      WHERE dch.guild_id = $1 AND dch.player_id = $2
      ORDER BY dch.created_at DESC
    `, [guildId, playerId]);
  }

  /**
   * Récupère le classement des joueurs par Loomix
   * @param {string} guildId - ID du serveur
   * @param {number} limit - Nombre max de joueurs
   * @returns {array} Classement avec balances
   */
  async getLoomixLeaderboard(guildId, limit = 10) {
    return await this.queryAll(`
      SELECT
        pc.balance,
        pc.total_earned,
        pc.total_spent,
        p.username,
        p.discord_id
      FROM player_currency pc
      JOIN players p ON pc.player_id = p.id
      WHERE pc.guild_id = $1 AND pc.currency_type = 'loomix'
      ORDER BY pc.balance DESC
      LIMIT $2
    `, [guildId, limit]);
  }

  // ============================================
  // SYSTÈME DE NIVEAUX COLLECTIBLES
  // ============================================

  /**
   * Récupère la configuration des collectibles pour un serveur
   * Crée la config par défaut si elle n'existe pas
   */
  async getCollectibleConfig(guildId) {
    guildId = this._getGuildId(guildId);

    let config = await this.queryOne(
      `SELECT * FROM guild_collectible_config WHERE guild_id = $1`,
      [guildId]
    );

    if (!config) {
      // Créer la config par défaut
      config = await this.queryOne(
        `INSERT INTO guild_collectible_config (guild_id)
         VALUES ($1)
         ON CONFLICT (guild_id) DO NOTHING
         RETURNING *`,
        [guildId]
      );

      // Si INSERT n'a rien retourné (race condition), récupérer
      if (!config) {
        config = await this.queryOne(
          `SELECT * FROM guild_collectible_config WHERE guild_id = $1`,
          [guildId]
        );
      }
    }

    return config;
  }

  /**
   * Récupère le prochain numéro de mint pour un collectible
   * Incrémente automatiquement le compteur
   */
  async getNextMintNumber(guildId, collectibleId) {
    guildId = this._getGuildId(guildId);

    const result = await this.queryOne(
      `INSERT INTO collectible_mint_counter (guild_id, collectible_id, next_mint_number)
       VALUES ($1, $2, 2)
       ON CONFLICT (guild_id, collectible_id)
       DO UPDATE SET next_mint_number = collectible_mint_counter.next_mint_number + 1
       RETURNING next_mint_number - 1 as mint_number`,
      [guildId, collectibleId]
    );

    return result?.mint_number || 1;
  }

  /**
   * Récupère un collectible avec ses infos de niveau
   */
  async getCollectionEntry(guildId, playerId, collectibleId) {
    guildId = this._getGuildId(guildId);

    return this.queryOne(
      `SELECT c.*, col.name, col.rarity, col.image_url, col.theme_id
       FROM collections c
       JOIN collectibles col ON c.collectible_id = col.id
       WHERE c.guild_id = $1 AND c.player_id = $2 AND c.collectible_id = $3 AND c.lost_at IS NULL`,
      [guildId, playerId, collectibleId]
    );
  }

  /**
   * Ajoute XP à un collectible et gère le level up automatique
   * Retourne { leveledUp: boolean, oldLevel, newLevel, xpGained, currentXp, rewards }
   */
  async addCollectibleXp(guildId, playerId, collectibleId, xpAmount = null) {
    guildId = this._getGuildId(guildId);

    // Récupérer la config pour l'XP par doublon
    const config = await this.getCollectibleConfig(guildId);
    const xpToAdd = xpAmount || config.xp_per_duplicate || 100;

    // Récupérer l'entrée actuelle
    const entry = await this.getCollectionEntry(guildId, playerId, collectibleId);
    if (!entry) {
      return null; // Le joueur n'a pas ce collectible
    }

    const oldLevel = entry.level || 1;
    const oldXp = entry.xp || 0;
    let newXp = oldXp + xpToAdd;
    let newLevel = oldLevel;

    // Seuils XP par niveau (depuis config ou défaut)
    const thresholds = config.level_thresholds || { "2": 100, "3": 300, "4": 700 };

    // Vérifier les level ups (peut monter plusieurs niveaux d'un coup)
    const maxLevel = 4;
    while (newLevel < maxLevel) {
      const nextLevelThreshold = thresholds[String(newLevel + 1)];
      if (nextLevelThreshold && newXp >= nextLevelThreshold) {
        newLevel++;
        // L'XP continue à s'accumuler, pas de reset
      } else {
        break;
      }
    }

    // Si niveau max atteint, plafonner l'XP au seuil max
    if (newLevel >= maxLevel) {
      newXp = thresholds[String(maxLevel)] || 700;
    }

    // Mettre à jour en base et récupérer l'entrée mise à jour
    const updatedEntry = await this.queryOne(
      `UPDATE collections
       SET level = $1, xp = $2
       WHERE guild_id = $3 AND player_id = $4 AND collectible_id = $5 AND lost_at IS NULL
       RETURNING *`,
      [newLevel, newXp, guildId, playerId, collectibleId]
    );

    // Calculer les récompenses si level up
    let rewards = null;
    if (newLevel > oldLevel) {
      const loomixRewards = config.loomix_rewards || {
        "2": { "common": 10, "rare": 25, "epic": 50, "legendary": 100 },
        "3": { "common": 25, "rare": 50, "epic": 100, "legendary": 200 },
        "4": { "common": 50, "rare": 100, "epic": 200, "legendary": 400 }
      };

      // Accumuler les récompenses pour tous les niveaux gagnés
      let totalLoomix = 0;
      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        const levelRewards = loomixRewards[String(lvl)];
        if (levelRewards && levelRewards[entry.rarity]) {
          totalLoomix += levelRewards[entry.rarity];
        }
      }

      rewards = { loomix: totalLoomix, rarity: entry.rarity };
    }

    // Calculer XP requis pour le prochain niveau
    let xpToNextLevel = null;
    if (newLevel < maxLevel) {
      xpToNextLevel = thresholds[String(newLevel + 1)] || 100;
    } else {
      // Niveau max atteint - afficher le seuil max
      xpToNextLevel = thresholds[String(maxLevel)] || 700;
    }

    return {
      leveledUp: newLevel > oldLevel,
      oldLevel,
      newLevel,
      xpGained: xpToAdd,
      currentXp: newXp,
      xpToNextLevel,
      rewards,
      collectible: { ...updatedEntry, name: entry.name, rarity: entry.rarity, image_url: entry.image_url, theme_id: entry.theme_id }
    };
  }

  /**
   * Ajoute un collectible avec gestion des niveaux et mint
   * Si le joueur a déjà le collectible: ajoute de l'XP (fusion)
   * Sinon: crée l'entrée avec mint_number
   * Retourne { isNew, fusion, data }
   */
  async addCollectibleWithLevels(guildId, playerId, collectibleId, source = 'mystery_box') {
    guildId = this._getGuildId(guildId);

    // Vérifier si le joueur a déjà ce collectible (actif, non perdu)
    const existing = await this.getCollectionEntry(guildId, playerId, collectibleId);

    if (existing) {
      // FUSION: Ajouter de l'XP
      const fusionResult = await this.addCollectibleXp(guildId, playerId, collectibleId);

      // Aplatir la structure pour accès direct aux propriétés
      return {
        isNew: false,
        fusion: true,
        restored: false,
        // Propriétés de niveau directement accessibles
        leveledUp: fusionResult.leveledUp,
        oldLevel: fusionResult.oldLevel,
        newLevel: fusionResult.newLevel,
        xpGained: fusionResult.xpGained,
        currentXp: fusionResult.currentXp,
        xpToNextLevel: fusionResult.xpToNextLevel,
        rewards: fusionResult.rewards,
        collectible: fusionResult.collectible,
        // Compat rétro
        mintNumber: fusionResult.collectible?.mint_number
      };
    }

    // OPTION B: Vérifier s'il existe un collectible PERDU à restaurer
    // Le joueur garde son niveau, XP et mint# original
    const lostEntry = await this.queryOne(
      `SELECT c.*, col.name, col.rarity, col.image_url, col.theme_id
       FROM collections c
       JOIN collectibles col ON c.collectible_id = col.id
       WHERE c.guild_id = $1 AND c.player_id = $2 AND c.collectible_id = $3
         AND c.lost_at IS NOT NULL
       ORDER BY c.lost_at DESC
       LIMIT 1`,
      [guildId, playerId, collectibleId]
    );

    if (lostEntry) {
      // RESTAURATION: Réactiver le collectible perdu (garder niveau, XP, mint#)
      const restoredEntry = await this.queryOne(
        `UPDATE collections
         SET lost_at = NULL, source = $2
         WHERE id = $1
         RETURNING *`,
        [lostEntry.id, source]
      );

      console.log(`✨ Collectible restauré: ${lostEntry.name} (Lvl ${lostEntry.level}, Mint #${lostEntry.mint_number})`);

      return {
        isNew: false,
        fusion: false,
        restored: true,
        // Garder les stats originales
        leveledUp: false,
        oldLevel: lostEntry.level,
        newLevel: lostEntry.level,
        xpGained: 0,
        currentXp: lostEntry.xp,
        rewards: null,
        mintNumber: lostEntry.mint_number,
        collectible: {
          ...restoredEntry,
          name: lostEntry.name,
          rarity: lostEntry.rarity,
          image_url: lostEntry.image_url,
          theme_id: lostEntry.theme_id
        }
      };
    }

    // NOUVEAU: Créer l'entrée avec mint
    const mintNumber = await this.getNextMintNumber(guildId, collectibleId);

    const newEntry = await this.queryOne(
      `INSERT INTO collections (guild_id, player_id, collectible_id, collected_at, source, level, xp, mint_number)
       VALUES ($1, $2, $3, NOW(), $4, 1, 0, $5)
       RETURNING *`,
      [guildId, playerId, collectibleId, source, mintNumber]
    );

    // Récupérer les infos complètes du collectible
    const collectible = await this.queryOne(
      `SELECT * FROM collectibles WHERE id = $1`,
      [collectibleId]
    );

    return {
      isNew: true,
      fusion: false,
      restored: false,
      // Propriétés de niveau pour nouveau collectible
      leveledUp: false,
      oldLevel: 0,
      newLevel: 1,
      xpGained: 0,
      currentXp: 0,
      rewards: null,
      mintNumber: mintNumber,
      collectible: {
        ...newEntry,
        name: collectible?.name,
        rarity: collectible?.rarity,
        image_url: collectible?.image_url,
        theme_id: collectible?.theme_id
      }
    };
  }

  // ============================================
  // SYSTÈME DE FAVORIS
  // ============================================

  /**
   * Récupère les 3 collectibles favoris d'un joueur
   */
  async getPlayerFavorites(guildId, playerId) {
    guildId = this._getGuildId(guildId);

    return this.queryAll(
      `SELECT pfc.position, pfc.added_at,
              c.id as collection_id, c.level, c.xp, c.mint_number,
              col.id as collectible_id, col.name, col.rarity, col.image_url, col.theme_id
       FROM player_favorite_collectibles pfc
       JOIN collections c ON pfc.collectible_id = c.collectible_id
                          AND pfc.player_id = c.player_id
                          AND pfc.guild_id = c.guild_id
       JOIN collectibles col ON c.collectible_id = col.id
       WHERE pfc.guild_id = $1 AND pfc.player_id = $2 AND c.lost_at IS NULL
       ORDER BY pfc.position`,
      [guildId, playerId]
    );
  }

  /**
   * Définit un collectible comme favori à une position (1, 2 ou 3)
   */
  async setPlayerFavorite(guildId, playerId, collectibleId, position) {
    guildId = this._getGuildId(guildId);

    if (position < 1 || position > 3) {
      throw new Error('Position must be 1, 2 or 3');
    }

    // Vérifier que le joueur possède ce collectible
    const hasIt = await this.hasCollectible(guildId, playerId, collectibleId);
    if (!hasIt) {
      throw new Error('Player does not own this collectible');
    }

    return this.queryOne(
      `INSERT INTO player_favorite_collectibles (guild_id, player_id, collectible_id, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id, player_id, position)
       DO UPDATE SET collectible_id = EXCLUDED.collectible_id, added_at = NOW()
       RETURNING *`,
      [guildId, playerId, collectibleId, position]
    );
  }

  /**
   * Retire un favori d'une position
   */
  async removePlayerFavorite(guildId, playerId, position) {
    guildId = this._getGuildId(guildId);

    return this.query(
      `DELETE FROM player_favorite_collectibles
       WHERE guild_id = $1 AND player_id = $2 AND position = $3`,
      [guildId, playerId, position]
    );
  }

  /**
   * Récupère tous les collectibles d'un joueur (pour sélection favoris)
   */
  async getPlayerCollectiblesForFavorites(guildId, playerId, themeId = null) {
    guildId = this._getGuildId(guildId);

    let query = `
      SELECT c.id as collection_id, c.level, c.xp, c.mint_number, c.collected_at,
             col.id as collectible_id, col.name, col.rarity, col.image_url, col.theme_id,
             t.name as theme_name,
             EXISTS(
               SELECT 1 FROM player_favorite_collectibles pfc
               WHERE pfc.guild_id = c.guild_id AND pfc.player_id = c.player_id
                 AND pfc.collectible_id = c.collectible_id
             ) as is_favorite
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      JOIN themes t ON col.theme_id = t.id
      WHERE c.guild_id = $1 AND c.player_id = $2 AND c.lost_at IS NULL
    `;

    const params = [guildId, playerId];

    if (themeId) {
      query += ` AND col.theme_id = $3`;
      params.push(themeId);
    }

    query += ` ORDER BY col.rarity DESC, c.level DESC, col.name`;

    return this.queryAll(query, params);
  }

  // ============================================
  // SYSTÈME DE FRAMES COLLECTIBLES
  // ============================================

  /**
   * Récupère l'URL de la frame pour un collectible selon sa rareté
   * Retourne la frame du thème si configurée, sinon le fallback
   */
  async getCollectibleFrameUrl(guildId, themeId, rarity) {
    guildId = this._getGuildId(guildId);

    // Common n'a pas de frame
    if (rarity === 'common') {
      return null;
    }

    // Chercher la frame du thème
    const themeFrame = await this.queryOne(
      `SELECT frame_url FROM theme_collectible_frames
       WHERE guild_id = $1 AND theme_id = $2 AND rarity = $3`,
      [guildId, themeId, rarity]
    );

    if (themeFrame?.frame_url) {
      return themeFrame.frame_url;
    }

    // Fallback en dur (VPS)
    const HARDCODED_FRAMES = {
      rare: 'http://72.60.185.62:8080/assets/frames/rare_frame.png',
      epic: 'http://72.60.185.62:8080/assets/frames/epic_frame.png',
      legendary: 'http://72.60.185.62:8080/assets/frames/legendary_frame.png'
    };

    // Fallback: frame par défaut en DB
    const defaultFrame = await this.queryOne(
      `SELECT frame_url FROM default_collectible_frames WHERE rarity = $1`,
      [rarity]
    );

    // Retourner: DB default > hardcoded > null
    return defaultFrame?.frame_url || HARDCODED_FRAMES[rarity] || null;
  }

  /**
   * Définit la frame d'un collectible pour un thème
   */
  async setThemeCollectibleFrame(guildId, themeId, rarity, frameUrl) {
    guildId = this._getGuildId(guildId);

    return this.queryOne(
      `INSERT INTO theme_collectible_frames (guild_id, theme_id, rarity, frame_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id, theme_id, rarity)
       DO UPDATE SET frame_url = EXCLUDED.frame_url, updated_at = NOW()
       RETURNING *`,
      [guildId, themeId, rarity, frameUrl]
    );
  }

  /**
   * Récupère toutes les frames de collectibles d'un thème
   * Retourne les frames configurées pour le thème, ou fallback si non configurées
   */
  async getThemeCollectibleFrames(guildId, themeId) {
    guildId = this._getGuildId(guildId);

    // Chercher les frames spécifiques au thème
    const themeFrames = await this.queryAll(
      `SELECT * FROM theme_collectible_frames
       WHERE guild_id = $1 AND theme_id = $2
       ORDER BY rarity`,
      [guildId, themeId]
    );

    // Si le thème a des frames, les retourner
    if (themeFrames.length > 0) {
      return themeFrames;
    }

    // Sinon, retourner les frames par défaut
    const defaultFrames = await this.queryAll(
      `SELECT id, rarity, frame_url, updated_at FROM default_collectible_frames ORDER BY rarity`
    );

    return defaultFrames;
  }

  /**
   * Récupère les frames par défaut des collectibles
   */
  async getDefaultCollectibleFrames() {
    return this.queryAll(
      `SELECT * FROM default_collectible_frames ORDER BY rarity`
    );
  }

  // ============================================
  // SYSTÈME DE FRAMES PROFIL
  // ============================================

  /**
   * Récupère les frames de profil par défaut (fallback)
   */
  async getDefaultProfileFrames() {
    return this.queryAll(
      `SELECT * FROM default_profile_frames ORDER BY frame_number`
    );
  }

  /**
   * Récupère les frames de profil d'un thème (2 max)
   * Si le thème n'a pas de frames configurées, utilise les frames par défaut
   */
  async getThemeProfileFrames(guildId, themeId) {
    guildId = this._getGuildId(guildId);

    // D'abord chercher les frames spécifiques au thème
    const themeFrames = await this.queryAll(
      `SELECT * FROM theme_profile_frames
       WHERE guild_id = $1 AND theme_id = $2
       ORDER BY frame_number`,
      [guildId, themeId]
    );

    // Si le thème a des frames, les retourner
    if (themeFrames.length > 0) {
      return themeFrames;
    }

    // Sinon, créer automatiquement les frames par défaut pour ce thème
    const defaultFrames = await this.getDefaultProfileFrames();

    if (defaultFrames.length === 0) {
      console.warn('⚠️ Aucune frame par défaut configurée dans default_profile_frames');
      return [];
    }

    // Insérer les frames par défaut pour ce thème
    const createdFrames = [];
    for (const df of defaultFrames) {
      const created = await this.queryOne(
        `INSERT INTO theme_profile_frames
         (guild_id, theme_id, frame_number, name, description, frame_url, unlock_condition, bonus_type, bonus_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (guild_id, theme_id, frame_number) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           frame_url = EXCLUDED.frame_url,
           unlock_condition = EXCLUDED.unlock_condition
         RETURNING *`,
        [guildId, themeId, df.frame_number, df.name, df.description, df.frame_url, JSON.stringify(df.unlock_condition), df.bonus_type, df.bonus_value]
      );
      createdFrames.push(created);
    }

    console.log(`✅ ${createdFrames.length} frame(s) par défaut créée(s) pour le thème ${themeId}`);
    return createdFrames;
  }

  /**
   * Crée ou met à jour une frame de profil pour un thème
   */
  async setThemeProfileFrame(guildId, themeId, frameNumber, name, description, frameUrl, unlockCondition, bonusType = null, bonusValue = null) {
    guildId = this._getGuildId(guildId);

    return this.queryOne(
      `INSERT INTO theme_profile_frames
       (guild_id, theme_id, frame_number, name, description, frame_url, unlock_condition, bonus_type, bonus_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (guild_id, theme_id, frame_number)
       DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         frame_url = EXCLUDED.frame_url,
         unlock_condition = EXCLUDED.unlock_condition,
         bonus_type = EXCLUDED.bonus_type,
         bonus_value = EXCLUDED.bonus_value,
         updated_at = NOW()
       RETURNING *`,
      [guildId, themeId, frameNumber, name, description, frameUrl, JSON.stringify(unlockCondition), bonusType, bonusValue]
    );
  }

  /**
   * Vérifie si un joueur remplit les conditions pour débloquer une frame
   */
  async checkFrameUnlockCondition(guildId, playerId, frameId) {
    guildId = this._getGuildId(guildId);

    const frame = await this.queryOne(
      `SELECT * FROM theme_profile_frames WHERE id = $1`,
      [frameId]
    );

    if (!frame) return false;

    const condition = frame.unlock_condition;

    // Condition: X collectibles de niveau Y+
    if (condition.type === 'collectibles_level') {
      const count = await this.queryOne(
        `SELECT COUNT(*) as cnt FROM collections c
         JOIN collectibles col ON c.collectible_id = col.id
         WHERE c.guild_id = $1 AND c.player_id = $2
           AND col.theme_id = $3 AND c.level >= $4 AND c.lost_at IS NULL`,
        [guildId, playerId, frame.theme_id, condition.min_level]
      );
      return parseInt(count?.cnt || 0) >= condition.count;
    }

    // Condition: X légendaires de niveau Y+
    if (condition.type === 'legendary_level') {
      const count = await this.queryOne(
        `SELECT COUNT(*) as cnt FROM collections c
         JOIN collectibles col ON c.collectible_id = col.id
         WHERE c.guild_id = $1 AND c.player_id = $2
           AND col.theme_id = $3 AND col.rarity = 'legendary'
           AND c.level >= $4 AND c.lost_at IS NULL`,
        [guildId, playerId, frame.theme_id, condition.min_level]
      );
      return parseInt(count?.cnt || 0) >= condition.count;
    }

    return false;
  }

  /**
   * Vérifie et débloque les frames pour un joueur
   * Retourne les frames nouvellement débloquées
   * RÈGLE: Frame 2 ne peut être débloquée que si Frame 1 est déjà débloquée
   */
  async checkAndUnlockFrames(guildId, playerId, discordId, themeId) {
    guildId = this._getGuildId(guildId);

    const frames = await this.getThemeProfileFrames(guildId, themeId);
    const newlyUnlocked = [];

    // Trier par frame_number pour s'assurer de l'ordre
    const sortedFrames = [...frames].sort((a, b) => a.frame_number - b.frame_number);

    // Récupérer les frames déjà débloquées pour ce thème
    const alreadyUnlockedFrames = await this.queryAll(
      `SELECT puf.frame_id, tpf.frame_number
       FROM player_unlocked_frames puf
       JOIN theme_profile_frames tpf ON puf.frame_id = tpf.id
       WHERE puf.discord_id = $1 AND tpf.theme_id = $2`,
      [discordId, themeId]
    );
    const unlockedFrameNumbers = new Set(alreadyUnlockedFrames.map(f => f.frame_number));

    for (const frame of sortedFrames) {
      // Vérifier si déjà débloquée
      if (unlockedFrameNumbers.has(frame.frame_number)) continue;

      // RÈGLE: Pour frame_number > 1, vérifier que la frame précédente est débloquée
      if (frame.frame_number > 1) {
        const previousFrameUnlocked = unlockedFrameNumbers.has(frame.frame_number - 1);
        if (!previousFrameUnlocked) {
          // La frame précédente n'est pas débloquée, on ne peut pas débloquer celle-ci
          continue;
        }
      }

      // Vérifier la condition de déblocage
      const meetsCondition = await this.checkFrameUnlockCondition(guildId, playerId, frame.id);

      if (meetsCondition) {
        // Débloquer la frame
        await this.query(
          `INSERT INTO player_unlocked_frames (discord_id, frame_id, unlocked_on_guild)
           VALUES ($1, $2, $3)
           ON CONFLICT (discord_id, frame_id) DO NOTHING`,
          [discordId, frame.id, guildId]
        );
        newlyUnlocked.push(frame);
        // Ajouter à la liste des débloquées pour permettre le déblocage de la suivante dans cette même vérification
        unlockedFrameNumbers.add(frame.frame_number);
      }
    }

    return newlyUnlocked;
  }

  /**
   * Récupère toutes les frames débloquées par un joueur (multi-serveur)
   */
  async getUnlockedFrames(discordId) {
    return this.queryAll(
      `SELECT puf.*, tpf.name, tpf.description, tpf.frame_url, tpf.bonus_type, tpf.bonus_value,
              t.name as theme_name, t.id as theme_id
       FROM player_unlocked_frames puf
       JOIN theme_profile_frames tpf ON puf.frame_id = tpf.id
       JOIN themes t ON tpf.theme_id = t.id
       WHERE puf.discord_id = $1
       ORDER BY puf.unlocked_at DESC`,
      [discordId]
    );
  }

  /**
   * Équipe une frame de profil
   * guildId = null pour équiper globalement
   */
  async equipFrame(discordId, frameId, guildId = null) {
    const guildValue = guildId || '__global__';

    // Vérifier que le joueur a débloqué cette frame
    const unlocked = await this.queryOne(
      `SELECT * FROM player_unlocked_frames WHERE discord_id = $1 AND frame_id = $2`,
      [discordId, frameId]
    );

    if (!unlocked) {
      throw new Error('Frame not unlocked');
    }

    return this.queryOne(
      `INSERT INTO player_equipped_frame (discord_id, guild_id, frame_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (discord_id, guild_id)
       DO UPDATE SET frame_id = EXCLUDED.frame_id, equipped_at = NOW()
       RETURNING *`,
      [discordId, guildValue, frameId]
    );
  }

  /**
   * Récupère la frame équipée d'un joueur
   * Cherche d'abord la frame spécifique au serveur, puis la globale
   */
  async getEquippedFrame(discordId, guildId = null) {
    // Chercher frame spécifique au serveur
    if (guildId) {
      const serverFrame = await this.queryOne(
        `SELECT pef.*, tpf.name, tpf.frame_url, tpf.bonus_type, tpf.bonus_value
         FROM player_equipped_frame pef
         JOIN theme_profile_frames tpf ON pef.frame_id = tpf.id
         WHERE pef.discord_id = $1 AND pef.guild_id = $2`,
        [discordId, guildId]
      );
      if (serverFrame) return serverFrame;
    }

    // Fallback: frame globale
    return this.queryOne(
      `SELECT pef.*, tpf.name, tpf.frame_url, tpf.bonus_type, tpf.bonus_value
       FROM player_equipped_frame pef
       JOIN theme_profile_frames tpf ON pef.frame_id = tpf.id
       WHERE pef.discord_id = $1 AND pef.guild_id = '__global__'`,
      [discordId]
    );
  }

  /**
   * Retire la frame équipée
   */
  async unequipFrame(discordId, guildId = null) {
    const guildValue = guildId || '__global__';

    return this.query(
      `DELETE FROM player_equipped_frame WHERE discord_id = $1 AND guild_id = $2`,
      [discordId, guildValue]
    );
  }

  // ==========================================
  // FAIRNESS CONFIG (Système d'équité)
  // ==========================================

  /**
   * Récupère la configuration d'équité pour un serveur
   */
  async getFairnessConfig(guildId) {
    return this.queryOne(
      `SELECT * FROM fairness_config WHERE guild_id = $1`,
      [guildId]
    );
  }

  /**
   * Crée ou met à jour la configuration d'équité
   */
  async upsertFairnessConfig(guildId, config = {}) {
    const { enabled, show_countdown, exempt_roles, steps } = config;

    // Convertir exempt_roles en format PostgreSQL array si fourni
    const exemptRolesParam = exempt_roles ? exempt_roles : null;
    const stepsParam = steps ? JSON.stringify(steps) : null;

    return this.queryOne(
      `INSERT INTO fairness_config (guild_id, enabled, show_countdown, exempt_roles, steps)
       VALUES (
         $1,
         COALESCE($2, false),
         COALESCE($3, true),
         COALESCE($4::text[], '{}'::text[]),
         COALESCE($5::jsonb, '[{"min": 0, "max": 25, "delay": 0}, {"min": 26, "max": 50, "delay": 5}, {"min": 51, "max": 75, "delay": 10}, {"min": 76, "max": 99, "delay": 12}, {"min": 100, "max": 100, "delay": 15}]'::jsonb)
       )
       ON CONFLICT (guild_id) DO UPDATE SET
         enabled = COALESCE($2, fairness_config.enabled),
         show_countdown = COALESCE($3, fairness_config.show_countdown),
         exempt_roles = COALESCE($4::text[], fairness_config.exempt_roles),
         steps = COALESCE($5::jsonb, fairness_config.steps),
         updated_at = NOW()
       RETURNING *`,
      [guildId, enabled, show_countdown, exemptRolesParam, stepsParam]
    );
  }

  /**
   * Active ou désactive le système d'équité
   */
  async toggleFairnessEnabled(guildId) {
    // S'assurer que la config existe
    await this.upsertFairnessConfig(guildId, {});

    return this.queryOne(
      `UPDATE fairness_config
       SET enabled = NOT enabled, updated_at = NOW()
       WHERE guild_id = $1
       RETURNING *`,
      [guildId]
    );
  }

  /**
   * Active ou désactive l'affichage du compte à rebours
   */
  async toggleFairnessCountdown(guildId) {
    // S'assurer que la config existe
    await this.upsertFairnessConfig(guildId, {});

    return this.queryOne(
      `UPDATE fairness_config
       SET show_countdown = NOT show_countdown, updated_at = NOW()
       WHERE guild_id = $1
       RETURNING *`,
      [guildId]
    );
  }

  /**
   * Met à jour les paliers d'équité
   */
  async updateFairnessSteps(guildId, steps) {
    // S'assurer que la config existe
    await this.upsertFairnessConfig(guildId, {});

    return this.queryOne(
      `UPDATE fairness_config
       SET steps = $2::jsonb, updated_at = NOW()
       WHERE guild_id = $1
       RETURNING *`,
      [guildId, JSON.stringify(steps)]
    );
  }

  /**
   * Met à jour les rôles exemptés
   */
  async updateFairnessExemptRoles(guildId, roleIds) {
    // S'assurer que la config existe
    await this.upsertFairnessConfig(guildId, {});

    return this.queryOne(
      `UPDATE fairness_config
       SET exempt_roles = $2::text[], updated_at = NOW()
       WHERE guild_id = $1
       RETURNING *`,
      [guildId, roleIds || []]
    );
  }

  /**
   * Calcule le délai pour un joueur selon sa progression
   * @returns {number} Délai en secondes
   */
  async calculateFairnessDelay(guildId, progressionPercent, memberRoles = []) {
    const config = await this.getFairnessConfig(guildId);

    // Pas de config ou système désactivé
    if (!config || !config.enabled) {
      return 0;
    }

    // Vérifier si le membre a un rôle exempté
    if (config.exempt_roles && config.exempt_roles.length > 0) {
      const hasExemptRole = memberRoles.some(roleId => config.exempt_roles.includes(roleId));
      if (hasExemptRole) {
        return 0;
      }
    }

    // Trouver le palier correspondant
    const steps = config.steps || [];
    for (const step of steps) {
      if (progressionPercent >= step.min && progressionPercent <= step.max) {
        return step.delay;
      }
    }

    return 0;
  }

  /**
   * Calcule le pourcentage de progression d'un joueur pour un thème
   * @returns {number} Pourcentage de 0 à 100
   */
  async getPlayerProgressionPercent(guildId, playerId, themeId) {
    guildId = this._getGuildId(guildId);

    // Compter le nombre total de collectibles du thème
    const totalResult = await this.queryOne(
      `SELECT COUNT(*) as total FROM collectibles WHERE guild_id = $1 AND theme_id = $2`,
      [guildId, themeId]
    );
    const totalCollectibles = parseInt(totalResult?.total || 0);

    if (totalCollectibles === 0) {
      return 0;
    }

    // Compter les collectibles possédés par le joueur (non perdus)
    const collectedResult = await this.queryOne(
      `SELECT COUNT(DISTINCT collectible_id) as collected
       FROM collections
       WHERE guild_id = $1 AND player_id = $2 AND lost_at IS NULL
         AND collectible_id IN (SELECT id FROM collectibles WHERE guild_id = $1 AND theme_id = $3)`,
      [guildId, playerId, themeId]
    );
    const collected = parseInt(collectedResult?.collected || 0);

    return Math.round((collected / totalCollectibles) * 100);
  }

  /**
   * Vérifie l'équité pour un joueur et retourne le résultat complet
   * @returns {Object} { delay, showCountdown, canOpen, openAt }
   */
  async checkFairnessForPlayer(guildId, playerId, themeId, memberRoles = []) {
    const config = await this.getFairnessConfig(guildId);

    // Pas de config ou système désactivé
    if (!config || !config.enabled) {
      return { delay: 0, showCountdown: false, canOpen: true, openAt: null };
    }

    // Vérifier si le membre a un rôle exempté
    if (config.exempt_roles && config.exempt_roles.length > 0) {
      const hasExemptRole = memberRoles.some(roleId => config.exempt_roles.includes(roleId));
      if (hasExemptRole) {
        return { delay: 0, showCountdown: false, canOpen: true, openAt: null };
      }
    }

    // Calculer la progression
    const progressionPercent = await this.getPlayerProgressionPercent(guildId, playerId, themeId);

    // Trouver le palier correspondant
    const steps = config.steps || [];
    let delay = 0;
    for (const step of steps) {
      if (progressionPercent >= step.min && progressionPercent <= step.max) {
        delay = step.delay;
        break;
      }
    }

    if (delay === 0) {
      return { delay: 0, showCountdown: config.show_countdown, canOpen: true, openAt: null };
    }

    // Calculer le timestamp d'ouverture
    const openAt = Math.floor(Date.now() / 1000) + delay;

    return {
      delay,
      showCountdown: config.show_countdown,
      canOpen: false,
      openAt,
      progressionPercent
    };
  }

  // ============================================================================
  // THEME CATEGORIES SYSTEM
  // ============================================================================

  /**
   * Récupérer toutes les catégories de thèmes
   * @returns {Array} Liste des catégories ordonnées
   */
  async getThemeCategories() {
    return this.query(`
      SELECT id, code, emoji, label, description, keywords, display_order, is_default
      FROM theme_categories
      ORDER BY display_order ASC
    `);
  }

  /**
   * Récupérer une catégorie par son code
   * @param {string} code - Code de la catégorie
   * @returns {Object|null} Catégorie ou null
   */
  async getThemeCategoryByCode(code) {
    return this.queryOne(`
      SELECT id, code, emoji, label, description, keywords, display_order, is_default
      FROM theme_categories
      WHERE code = $1
    `, [code]);
  }

  /**
   * Créer une nouvelle catégorie de thèmes
   * @param {Object} categoryData - Données de la catégorie
   * @returns {Object} Catégorie créée
   */
  async createThemeCategory(categoryData) {
    const { code, emoji, label, description, keywords = [], display_order = 50 } = categoryData;

    return this.queryOne(`
      INSERT INTO theme_categories (code, emoji, label, description, keywords, display_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [code, emoji || '📁', label, description, keywords, display_order]);
  }

  /**
   * Mettre à jour une catégorie de thèmes
   * @param {number} categoryId - ID de la catégorie
   * @param {Object} updateData - Données à mettre à jour
   * @returns {Object} Catégorie mise à jour
   */
  async updateThemeCategory(categoryId, updateData) {
    const { emoji, label, description, keywords, display_order } = updateData;

    return this.queryOne(`
      UPDATE theme_categories SET
        emoji = COALESCE($2, emoji),
        label = COALESCE($3, label),
        description = COALESCE($4, description),
        keywords = COALESCE($5, keywords),
        display_order = COALESCE($6, display_order),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [categoryId, emoji, label, description, keywords, display_order]);
  }

  /**
   * Supprimer une catégorie de thèmes
   * @param {number} categoryId - ID de la catégorie
   * @returns {boolean} Succès de la suppression
   */
  async deleteThemeCategory(categoryId) {
    // Vérifier que ce n'est pas 'all' ou 'custom' (protégés)
    const category = await this.queryOne(`
      SELECT code, is_default FROM theme_categories WHERE id = $1
    `, [categoryId]);

    if (!category) return false;
    if (category.code === 'all' || category.is_default) {
      throw new Error('Impossible de supprimer cette catégorie protégée');
    }

    await this.query(`DELETE FROM theme_categories WHERE id = $1`, [categoryId]);
    return true;
  }

  /**
   * Détecter automatiquement la catégorie d'un thème basé sur son nom et ses tags
   * @param {string} themeName - Nom du thème
   * @param {Array} tags - Tags du thème
   * @returns {Object} Catégorie détectée
   */
  async detectThemeCategory(themeName, tags = []) {
    const searchText = `${themeName} ${tags.join(' ')}`.toLowerCase();

    // Récupérer toutes les catégories avec leurs keywords
    const categories = await this.query(`
      SELECT id, code, emoji, label, keywords
      FROM theme_categories
      WHERE code != 'all' AND array_length(keywords, 1) > 0
      ORDER BY display_order
    `);

    // Chercher une correspondance
    for (const cat of categories) {
      const keywords = cat.keywords || [];
      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          return cat;
        }
      }
    }

    // Retourner la catégorie par défaut ('custom')
    return this.queryOne(`
      SELECT id, code, emoji, label FROM theme_categories WHERE is_default = TRUE
    `);
  }

  /**
   * Ajouter un mot-clé à une catégorie
   * @param {number} categoryId - ID de la catégorie
   * @param {string} keyword - Mot-clé à ajouter
   * @returns {Object} Catégorie mise à jour
   */
  async addKeywordToCategory(categoryId, keyword) {
    return this.queryOne(`
      UPDATE theme_categories
      SET keywords = array_append(keywords, $2), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [categoryId, keyword.toLowerCase()]);
  }

  /**
   * Retirer un mot-clé d'une catégorie
   * @param {number} categoryId - ID de la catégorie
   * @param {string} keyword - Mot-clé à retirer
   * @returns {Object} Catégorie mise à jour
   */
  async removeKeywordFromCategory(categoryId, keyword) {
    return this.queryOne(`
      UPDATE theme_categories
      SET keywords = array_remove(keywords, $2), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [categoryId, keyword.toLowerCase()]);
  }
}

// Export singleton
module.exports = new DatabaseWrapper();
