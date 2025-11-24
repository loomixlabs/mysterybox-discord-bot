/**
 * Importateur de thèmes préconfigurés
 * Gère l'import complet d'un fichier .theme.json vers la base de données
 */

const fs = require('fs');
const path = require('path');
const db = require('./database-pg');
const ThemeValidator = require('./themeValidator');

/**
 * Mapping des types de templates JSON vers les types système
 * Certains types génériques dans le JSON peuvent mapper vers plusieurs types système
 */
const TEMPLATE_TYPE_MAPPING = {
  // Types directs (1:1)
  'legendary_collectible': ['legendary_collectible'],
  'collection_completed': ['collection_completed'],
  'collection_traded': ['collection_traded'],
  'collection_lost': ['collection_lost'],
  'trap_cooldown': ['trap_cooldown'],
  'trap_lose_collectible': ['trap_lose_collectible'],
  'trap_public_shame': ['trap_public_shame'],
  'trap_empty_box': ['trap_empty_box'],
  'trap_lose_all_collectibles': ['trap_lose_all_collectibles'],
  'mission_word_guessed': ['mission_word_guessed'],
  'mission_started': ['mission_started'],
  'mission_completed': ['mission_completed'],
  'mission_failed': ['mission_failed'],
  'mission_approved': ['mission_approved'],
  'mission_rejected': ['mission_rejected'],
  'theme_expired': ['theme_expired'],
  'theme_expiring_soon': ['theme_expiring_soon'],
  'legendary_super_bonus': ['legendary_super_bonus'],

  // Types génériques du JSON qui mappent vers des types spécifiques
  'collectible_found': ['legendary_collectible'], // Utilisé pour les légendaires
  'trap_triggered': ['trap_cooldown', 'trap_lose_collectible', 'trap_public_shame', 'trap_empty_box', 'trap_lose_all_collectibles'],
  'role_unlocked': ['collection_completed'],
  'super_bonus': ['legendary_super_bonus'] // Alias pour super bonus dans les JSON
};

/**
 * Types système valides pour announcement_templates
 */
const VALID_SYSTEM_TYPES = [
  'legendary_collectible', 'collection_completed', 'collection_traded', 'collection_lost',
  'trap_cooldown', 'trap_lose_collectible', 'trap_public_shame', 'trap_empty_box', 'trap_lose_all_collectibles',
  'mission_word_guessed', 'mission_started', 'mission_completed', 'mission_failed', 'mission_approved', 'mission_rejected',
  'theme_expired', 'theme_expiring_soon', 'legendary_super_bonus'
];

class ThemeImporter {
  constructor(guildId) {
    this.guildId = guildId;
    this.validator = new ThemeValidator();
    this.importedData = {
      themeId: null,
      collectibles: 0,
      traps: 0,
      missions: 0,
      keywords: 0,
      questions: 0,
      announcementTemplates: 0
    };
    this.errors = [];
  }

  /**
   * Importe un thème depuis un fichier JSON
   * @param {string} filePath - Chemin vers le fichier .theme.json
   * @param {Object} options - Options d'import
   * @returns {Promise<Object>} Résultat de l'import
   */
  async importFromFile(filePath, options = {}) {
    try {
      // Lire et parser le fichier
      const content = fs.readFileSync(filePath, 'utf8');
      const themeData = JSON.parse(content);

      return await this.import(themeData, options);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: false, errors: [`Fichier non trouvé: ${filePath}`] };
      }
      if (error instanceof SyntaxError) {
        return { success: false, errors: [`JSON invalide: ${error.message}`] };
      }
      return { success: false, errors: [`Erreur: ${error.message}`] };
    }
  }

  /**
   * Importe un thème depuis un objet JavaScript
   * @param {Object} themeData - Données du thème
   * @param {Object} options - Options d'import
   * @returns {Promise<Object>} Résultat de l'import
   */
  async import(themeData, options = {}) {
    const {
      autoCreateRoles = true,
      autoInstallSuperBonuses = true,
      activateAfterImport = false,
      guild = null // Instance Discord Guild pour création de rôles
    } = options;

    // Valider les données
    const validation = this.validator.validate(themeData);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    try {
      // Ordre d'insertion (respecter les FK):
      // 1. themes
      // 2. theme_config
      // 3. collectibles
      // 4. traps
      // 5. missions
      // 6. mission_keywords + quiz_questions
      // 7. theme_messages

      console.log(`📦 Début de l'import du thème "${themeData.metadata.name}" pour guild ${this.guildId}`);

      // 1. Créer le thème principal
      const themeId = await this.createTheme(themeData.theme);
      this.importedData.themeId = themeId;

      // 2. Créer la configuration du thème
      if (themeData.theme_config) {
        await this.createThemeConfig(themeId, themeData.theme_config);
      } else {
        await this.createDefaultThemeConfig(themeId);
      }

      // 3. Créer les collectibles
      if (themeData.collectibles && themeData.collectibles.length > 0) {
        await this.createCollectibles(themeId, themeData.collectibles);
      }

      // 4. Créer les pièges
      if (themeData.traps && themeData.traps.length > 0) {
        await this.createTraps(themeId, themeData.traps);
      }

      // 5. Créer les missions et contenu associé
      if (themeData.missions) {
        await this.createMissions(themeId, themeData.missions);
      }

      // 6. Créer les messages personnalisés
      if (themeData.theme_messages) {
        await this.createThemeMessages(themeId, themeData.theme_messages);
      }

      // 6b. Créer les templates d'annonces personnalisés
      if (themeData.announcement_templates) {
        await this.createAnnouncementTemplates(themeData.announcement_templates);
      }

      // 7. Créer le rôle Discord si demandé
      let roleCreated = null;
      if (autoCreateRoles && guild) {
        roleCreated = await this.createDiscordRole(guild, themeData.theme);
      }

      // 8. Installer les super bonus si demandé
      if (autoInstallSuperBonuses) {
        await this.installSuperBonuses();
      }

      // 9. Activer le thème si demandé
      if (activateAfterImport) {
        await this.activateTheme(themeId);
      }

      console.log(`✅ Import terminé avec succès!`);
      console.log(`   - Collectibles: ${this.importedData.collectibles}`);
      console.log(`   - Pièges: ${this.importedData.traps}`);
      console.log(`   - Missions: ${this.importedData.missions}`);
      console.log(`   - Mots-clés: ${this.importedData.keywords}`);
      console.log(`   - Questions: ${this.importedData.questions}`);
      console.log(`   - Templates d'annonces: ${this.importedData.announcementTemplates}`);

      return {
        success: true,
        themeId: themeId,
        imported: this.importedData,
        roleCreated: roleCreated,
        errors: this.errors
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'import:', error);
      this.errors.push(error.message);

      // Rollback: supprimer le thème créé en cas d'erreur
      if (this.importedData.themeId) {
        try {
          await db.query('DELETE FROM themes WHERE id = $1', [this.importedData.themeId]);
          console.log('🔄 Rollback effectué');
        } catch (rollbackError) {
          console.error('❌ Erreur lors du rollback:', rollbackError);
        }
      }

      return {
        success: false,
        errors: this.errors
      };
    }
  }

  /**
   * Crée le thème principal
   */
  async createTheme(theme) {
    const result = await db.query(`
      INSERT INTO themes (
        guild_id, theme_id, name, duration_days, required_items,
        final_role_name, final_role_color, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())
      ON CONFLICT (guild_id, theme_id) DO UPDATE SET
        name = EXCLUDED.name,
        duration_days = EXCLUDED.duration_days,
        required_items = EXCLUDED.required_items,
        final_role_name = EXCLUDED.final_role_name,
        final_role_color = EXCLUDED.final_role_color,
        updated_at = NOW()
      RETURNING id
    `, [
      this.guildId,
      theme.theme_id,
      theme.name,
      theme.duration_days,
      theme.required_items,
      theme.final_role_name,
      theme.final_role_color
    ]);

    console.log(`   ✅ Thème créé/mis à jour (ID: ${result[0].id})`);
    return result[0].id;
  }

  /**
   * Crée la configuration du thème
   */
  async createThemeConfig(themeId, config) {
    // Fonction pour convertir les probabilités: accepter les deux formats (0.5 ou 50)
    const convertProba = (val, defaultVal) => {
      if (val === undefined || val === null) return defaultVal;
      // Si valeur décimale (< 1), convertir en pourcentage
      if (val < 1 && val > 0) return Math.round(val * 100);
      return val;
    };

    // Extraire les probabilités de rareté (peuvent être dans un sous-objet)
    const rarityProba = config.rarity_probabilities || {};

    // Préparer les progression_roles (sans discord_role_id qui sera ajouté lors de la première attribution)
    const progressionRoles = (config.progression_roles || []).map(role => ({
      name: role.name,
      color: role.color,
      required_items: role.required_items,
      percentage: role.percentage,
      hoist: role.hoist || false,
      mentionable: role.mentionable || false
    }));

    await db.query(`
      INSERT INTO theme_config (
        guild_id, theme_id,
        probability_collectible, probability_mission, probability_trap, probability_super_bonus,
        collectible_rarity_legendary, collectible_rarity_epic, collectible_rarity_rare, collectible_rarity_common,
        super_bonus_rarity_legendary, super_bonus_rarity_epic, super_bonus_rarity_rare, super_bonus_rarity_common,
        mystery_box_image, mystery_box_title, mystery_box_description,
        mystery_box_winner_message, mystery_box_celebration_gif, mystery_box_celebration_emojis,
        auto_delete_celebration_message, progression_roles
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (guild_id, theme_id) DO UPDATE SET
        probability_collectible = EXCLUDED.probability_collectible,
        probability_mission = EXCLUDED.probability_mission,
        probability_trap = EXCLUDED.probability_trap,
        probability_super_bonus = EXCLUDED.probability_super_bonus,
        collectible_rarity_legendary = EXCLUDED.collectible_rarity_legendary,
        collectible_rarity_epic = EXCLUDED.collectible_rarity_epic,
        collectible_rarity_rare = EXCLUDED.collectible_rarity_rare,
        collectible_rarity_common = EXCLUDED.collectible_rarity_common,
        super_bonus_rarity_legendary = EXCLUDED.super_bonus_rarity_legendary,
        super_bonus_rarity_epic = EXCLUDED.super_bonus_rarity_epic,
        super_bonus_rarity_rare = EXCLUDED.super_bonus_rarity_rare,
        super_bonus_rarity_common = EXCLUDED.super_bonus_rarity_common,
        mystery_box_image = EXCLUDED.mystery_box_image,
        mystery_box_title = EXCLUDED.mystery_box_title,
        mystery_box_description = EXCLUDED.mystery_box_description,
        mystery_box_winner_message = EXCLUDED.mystery_box_winner_message,
        mystery_box_celebration_gif = EXCLUDED.mystery_box_celebration_gif,
        mystery_box_celebration_emojis = EXCLUDED.mystery_box_celebration_emojis,
        auto_delete_celebration_message = EXCLUDED.auto_delete_celebration_message,
        progression_roles = EXCLUDED.progression_roles
    `, [
      this.guildId,
      themeId,
      convertProba(config.probability_collectible || config.mystery_box_probability, 40),
      convertProba(config.probability_mission, 30),
      convertProba(config.probability_trap || config.trap_probability, 20),
      convertProba(config.probability_super_bonus || config.super_bonus_probability, 10),
      rarityProba.legendary || config.collectible_rarity_legendary || 5,
      rarityProba.epic || config.collectible_rarity_epic || 10,
      rarityProba.rare || config.collectible_rarity_rare || 20,
      rarityProba.common || config.collectible_rarity_common || 40,
      config.super_bonus_rarity_legendary || 5,
      config.super_bonus_rarity_epic || 10,
      config.super_bonus_rarity_rare || 20,
      config.super_bonus_rarity_common || 40,
      config.mystery_box_image || null,
      config.mystery_box_title || 'BOITE MYSTERIEUSE',
      config.mystery_box_description || 'Que contient-elle ?',
      config.mystery_box_winner_message || '{player} a ouvert la boite mystere !',
      config.mystery_box_celebration_gif || null,
      config.mystery_box_celebration_emojis || ',,',
      config.auto_delete_celebration_message || false,
      JSON.stringify(progressionRoles)
    ]);

    console.log(`   ✅ Configuration du thème créée`);
  }

  /**
   * Crée une configuration par défaut
   */
  async createDefaultThemeConfig(themeId) {
    await this.createThemeConfig(themeId, {});
  }

  /**
   * Crée les collectibles
   */
  async createCollectibles(themeId, collectibles) {
    for (const collectible of collectibles) {
      await db.query(`
        INSERT INTO collectibles (
          guild_id, theme_id, collectible_id, name, image_url, rarity, reveal_message, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (guild_id, theme_id, collectible_id) DO UPDATE SET
          name = EXCLUDED.name,
          image_url = EXCLUDED.image_url,
          rarity = EXCLUDED.rarity,
          reveal_message = EXCLUDED.reveal_message
      `, [
        this.guildId,
        themeId,
        collectible.collectible_id,
        collectible.name,
        collectible.image_url,
        collectible.rarity,
        collectible.reveal_message || null
      ]);

      this.importedData.collectibles++;
    }

    console.log(`   ✅ ${this.importedData.collectibles} collectible(s) créé(s)`);
  }

  /**
   * Crée les pièges
   */
  async createTraps(themeId, traps) {
    for (const trap of traps) {
      await db.query(`
        INSERT INTO traps (
          guild_id, theme_id, trap_id, name, type, description, image_url,
          cooldown_duration, removes_collectible, shame_message, malus_points,
          is_default, is_active, notif_title, notif_description, notif_color, notif_footer, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
        ON CONFLICT (guild_id, theme_id, trap_id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          description = EXCLUDED.description,
          image_url = EXCLUDED.image_url,
          cooldown_duration = EXCLUDED.cooldown_duration,
          removes_collectible = EXCLUDED.removes_collectible,
          shame_message = EXCLUDED.shame_message,
          malus_points = EXCLUDED.malus_points,
          is_default = EXCLUDED.is_default,
          is_active = EXCLUDED.is_active,
          notif_title = EXCLUDED.notif_title,
          notif_description = EXCLUDED.notif_description,
          notif_color = EXCLUDED.notif_color,
          notif_footer = EXCLUDED.notif_footer
      `, [
        this.guildId,
        themeId,
        trap.trap_id,
        trap.name,
        trap.type,
        trap.description,
        trap.image_url || null,
        trap.cooldown_duration || null,
        trap.removes_collectible || false,
        trap.shame_message || null,
        trap.malus_points || 0,
        trap.is_default || false,
        trap.is_active !== false,
        trap.notif_title || null,
        trap.notif_description || null,
        trap.notif_color || '#e74c3c',
        trap.notif_footer || null
      ]);

      this.importedData.traps++;
    }

    console.log(`   ✅ ${this.importedData.traps} piège(s) créé(s)`);
  }

  /**
   * Crée les missions et leur contenu (keywords, questions)
   */
  async createMissions(themeId, missions) {
    // Missions keyword
    if (missions.keyword && missions.keyword.length > 0) {
      for (const mission of missions.keyword) {
        const missionResult = await db.query(`
          INSERT INTO missions (
            guild_id, theme_id, mission_id, name, type, description,
            validation_type, timeout, image_url, reward_type, created_at
          ) VALUES ($1, $2, $3, $4, 'keyword-message', $5, 'auto', $6, $7, 'random-collectible', NOW())
          ON CONFLICT (guild_id, theme_id, mission_id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            timeout = EXCLUDED.timeout,
            image_url = EXCLUDED.image_url
          RETURNING id
        `, [
          this.guildId,
          themeId,
          mission.mission_id,
          mission.name,
          mission.description,
          mission.timeout || 60,
          mission.image_url || null
        ]);

        const missionDbId = missionResult[0].id;
        this.importedData.missions++;

        // Créer les mots-clés
        for (const keyword of mission.keywords) {
          await db.query(`
            INSERT INTO mission_keywords (
              guild_id, mission_id, keyword, difficulty, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (guild_id, mission_id, keyword) DO UPDATE SET
              difficulty = EXCLUDED.difficulty
          `, [
            this.guildId,
            missionDbId,
            keyword.keyword,
            keyword.difficulty || 'medium'
          ]);

          this.importedData.keywords++;
        }
      }
    }

    // Missions quiz
    if (missions.quiz && missions.quiz.length > 0) {
      for (const mission of missions.quiz) {
        const missionResult = await db.query(`
          INSERT INTO missions (
            guild_id, theme_id, mission_id, name, type, description,
            validation_type, timeout, image_url, reward_type, max_attempts, created_at
          ) VALUES ($1, $2, $3, $4, 'quiz', $5, 'auto', $6, $7, 'random-collectible', $8, NOW())
          ON CONFLICT (guild_id, theme_id, mission_id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            timeout = EXCLUDED.timeout,
            image_url = EXCLUDED.image_url,
            max_attempts = EXCLUDED.max_attempts
          RETURNING id
        `, [
          this.guildId,
          themeId,
          mission.mission_id,
          mission.name,
          mission.description,
          mission.timeout || 60,
          mission.image_url || null,
          mission.max_attempts || null
        ]);

        const missionDbId = missionResult[0].id;
        this.importedData.missions++;

        // Créer les questions en les liant à la mission
        for (const question of mission.questions) {
          await db.query(`
            INSERT INTO quiz_questions (
              guild_id, theme_id, mission_id, question_text, correct_answer, wrong_answers, hint, difficulty, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `, [
            this.guildId,
            themeId,
            missionDbId,
            question.question_text,
            question.correct_answer,
            question.wrong_answers || null,
            question.hint || null,
            question.difficulty || 'medium'
          ]);

          this.importedData.questions++;
        }
      }
    }

    console.log(`   ✅ ${this.importedData.missions} mission(s) créée(s)`);
    console.log(`   ✅ ${this.importedData.keywords} mot(s)-clé(s) créé(s)`);
    console.log(`   ✅ ${this.importedData.questions} question(s) créée(s)`);
  }

  /**
   * Crée les messages personnalisés du thème
   */
  async createThemeMessages(themeId, messages) {
    for (const [key, content] of Object.entries(messages)) {
      await db.query(`
        INSERT INTO theme_messages (guild_id, theme_id, key, content)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guild_id, theme_id, key) DO UPDATE SET
          content = EXCLUDED.content
      `, [this.guildId, themeId, key, content]);
    }

    console.log(`   ✅ ${Object.keys(messages).length} message(s) personnalisé(s) créé(s)`);
  }

  /**
   * Crée les templates d'annonces personnalisés liés au thème
   * Gère le mapping des types génériques JSON vers les types système spécifiques
   * Les templates créés sont liés au thème via theme_id (pas globaux)
   */
  async createAnnouncementTemplates(templates) {
    // Vérifier si guild_config existe (prérequis pour announcement_templates)
    const guildConfig = await db.queryOne(
      'SELECT guild_id FROM guild_config WHERE guild_id = $1',
      [this.guildId]
    );

    if (!guildConfig) {
      console.log(`   ⚠️  guild_config n'existe pas pour ${this.guildId}, skip templates d'annonces`);
      return;
    }

    // S'assurer que les templates globaux (fallback) existent
    const { createDefaultTemplatesForGuild } = require('./announcementDefaults');
    await createDefaultTemplatesForGuild(this.guildId);

    const themeId = this.importedData.themeId;
    if (!themeId) {
      console.log(`   ⚠️  themeId non défini, skip templates d'annonces`);
      return;
    }

    // Traiter chaque template du JSON
    for (const [jsonType, content] of Object.entries(templates)) {
      // Obtenir les types système correspondants
      const systemTypes = TEMPLATE_TYPE_MAPPING[jsonType];

      if (!systemTypes) {
        // Type non reconnu, stocker dans theme_messages comme fallback
        console.log(`   ⏭️  Type d'annonce "${jsonType}" non reconnu, stocké dans theme_messages`);
        await db.query(`
          INSERT INTO theme_messages (guild_id, theme_id, key, content)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (guild_id, theme_id, key) DO UPDATE SET
            content = EXCLUDED.content
        `, [this.guildId, themeId, `announcement_${jsonType}`, content]);
        continue;
      }

      // Appliquer le template à tous les types système correspondants
      for (const systemType of systemTypes) {
        // Le contenu peut être une string simple ou un objet complet
        let title, description, color, footerText, imageUrl, thumbnailUrl;

        if (typeof content === 'string') {
          // Template simple (string) - extraire le titre de la première ligne ou utiliser un titre par défaut
          description = content;
          // Utiliser un titre basé sur le type
          title = this.getDefaultTitleForType(systemType);
          color = this.getDefaultColorForType(systemType);
          footerText = null;
          imageUrl = null;
          thumbnailUrl = null;
        } else if (typeof content === 'object') {
          // Template complet (objet)
          title = content.title || this.getDefaultTitleForType(systemType);
          description = content.description || content.message || '';
          color = content.color || this.getDefaultColorForType(systemType);
          footerText = content.footer_text || content.footer || null;
          imageUrl = content.image_url || null;
          thumbnailUrl = content.thumbnail_url || null;
        } else {
          console.log(`   ⚠️  Format invalide pour le template "${jsonType}"`);
          continue;
        }

        // Créer le template lié au thème (INSERT ou UPDATE si existe déjà)
        await db.query(`
          INSERT INTO announcement_templates (guild_id, type, title, description, color, footer_text, image_url, thumbnail_url, theme_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (guild_id, type, theme_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            color = EXCLUDED.color,
            footer_text = COALESCE(EXCLUDED.footer_text, announcement_templates.footer_text),
            image_url = EXCLUDED.image_url,
            thumbnail_url = EXCLUDED.thumbnail_url,
            updated_at = NOW()
        `, [this.guildId, systemType, title, description, color, footerText, imageUrl, thumbnailUrl, themeId]);

        this.importedData.announcementTemplates++;
      }
    }

    console.log(`   ✅ ${this.importedData.announcementTemplates} template(s) d'annonces créé(s) pour le thème`);
  }

  /**
   * Retourne un titre par défaut basé sur le type système
   */
  getDefaultTitleForType(type) {
    const titles = {
      'legendary_collectible': '⭐ COLLECTIBLE LÉGENDAIRE !',
      'collection_completed': '🎉 COLLECTION COMPLÉTÉE !',
      'collection_traded': '🔄 ÉCHANGE DE COLLECTION !',
      'collection_lost': '💀 COLLECTION PERDUE !',
      'trap_cooldown': '⏱️ PIÈGE TEMPOREL !',
      'trap_lose_collectible': '💀 PIÈGE VOLEUR !',
      'trap_public_shame': '😱 PIÈGE DE LA HONTE !',
      'trap_empty_box': '📦 BOÎTE VIDE !',
      'trap_lose_all_collectibles': '💀 PIÈGE DÉVASTATEUR !',
      'mission_word_guessed': '🎯 MOT DEVINÉ !',
      'mission_started': '⚔️ MISSION LANCÉE !',
      'mission_completed': '✅ MISSION RÉUSSIE !',
      'mission_failed': '❌ MISSION ÉCHOUÉE !',
      'mission_approved': '👍 MISSION APPROUVÉE !',
      'mission_rejected': '⛔ MISSION REFUSÉE !',
      'theme_expired': '🔴 THÈME EXPIRÉ !',
      'theme_expiring_soon': '⏰ THÈME EXPIRE BIENTÔT !',
      'legendary_super_bonus': '🎰 SUPER BONUS OBTENU !'
    };
    return titles[type] || '📢 ANNONCE';
  }

  /**
   * Retourne une couleur par défaut basée sur le type système
   */
  getDefaultColorForType(type) {
    const colors = {
      'legendary_collectible': '#f1c40f',
      'collection_completed': '#2ecc71',
      'collection_traded': '#3498db',
      'collection_lost': '#e74c3c',
      'trap_cooldown': '#f39c12',
      'trap_lose_collectible': '#e74c3c',
      'trap_public_shame': '#9b59b6',
      'trap_empty_box': '#95a5a6',
      'trap_lose_all_collectibles': '#c0392b',
      'mission_word_guessed': '#2ecc71',
      'mission_started': '#3498db',
      'mission_completed': '#2ecc71',
      'mission_failed': '#e74c3c',
      'mission_approved': '#2ecc71',
      'mission_rejected': '#e74c3c',
      'theme_expired': '#e74c3c',
      'theme_expiring_soon': '#f39c12',
      'legendary_super_bonus': '#ff00ff'
    };
    return colors[type] || '#3498db';
  }

  /**
   * Crée le rôle Discord de complétion
   */
  async createDiscordRole(guild, theme) {
    try {
      // Vérifier si un rôle existe déjà avec ce nom
      const existingRole = guild.roles.cache.find(r => r.name === theme.final_role_name);

      if (existingRole) {
        console.log(`   ⏭️  Rôle "${theme.final_role_name}" existe déjà`);

        // Mettre à jour le theme avec l'ID du rôle existant
        await db.query(`
          UPDATE themes SET final_role_discord_id = $1 WHERE id = $2
        `, [existingRole.id, this.importedData.themeId]);

        return { id: existingRole.id, name: existingRole.name, created: false };
      }

      // Créer le nouveau rôle
      const color = parseInt(theme.final_role_color.replace('#', ''), 16);
      const role = await guild.roles.create({
        name: theme.final_role_name,
        color: color,
        hoist: true, // Afficher séparément dans la liste
        mentionable: true,
        reason: `Rôle de complétion pour le thème "${theme.name}"`
      });

      // Mettre à jour le theme avec l'ID du nouveau rôle
      await db.query(`
        UPDATE themes SET final_role_discord_id = $1 WHERE id = $2
      `, [role.id, this.importedData.themeId]);

      console.log(`   ✅ Rôle Discord "${role.name}" créé (ID: ${role.id})`);

      return { id: role.id, name: role.name, created: true };

    } catch (error) {
      console.error(`   ⚠️  Impossible de créer le rôle Discord:`, error.message);
      this.errors.push(`Rôle non créé: ${error.message}`);
      return null;
    }
  }

  /**
   * Installe les super bonus par défaut
   */
  async installSuperBonuses() {
    try {
      // Vérifier si des super bonus existent déjà
      const existing = await db.queryOne(
        'SELECT COUNT(*) as count FROM super_bonuses WHERE guild_id = $1',
        [this.guildId]
      );

      if (existing && parseInt(existing.count) > 0) {
        console.log(`   ⏭️  Super bonus déjà installés (${existing.count} existants)`);
        return;
      }

      // Installer via le script existant ou copier depuis une source
      // Pour l'instant, on log juste un warning
      console.log(`   ⚠️  Installation des super bonus à implémenter séparément`);

    } catch (error) {
      console.error(`   ⚠️  Erreur lors de l'installation des super bonus:`, error.message);
      this.errors.push(`Super bonus non installés: ${error.message}`);
    }
  }

  /**
   * Active le thème importé
   */
  async activateTheme(themeId) {
    try {
      // Désactiver tous les autres thèmes du serveur
      await db.query(`
        UPDATE themes SET is_active = FALSE WHERE guild_id = $1 AND id != $2
      `, [this.guildId, themeId]);

      // Activer ce thème
      await db.query(`
        UPDATE themes SET is_active = TRUE, activated_at = NOW() WHERE id = $1
      `, [themeId]);

      console.log(`   ✅ Thème activé`);

    } catch (error) {
      console.error(`   ⚠️  Erreur lors de l'activation du thème:`, error.message);
      this.errors.push(`Thème non activé: ${error.message}`);
    }
  }
}

module.exports = ThemeImporter;
