/**
 * Exportateur de thèmes v2.0
 * Exporte un thème existant vers un fichier .theme.json
 *
 * Tables exportées:
 * - themes, theme_config, theme_messages
 * - collectibles, traps, missions, quiz_questions, mission_keywords
 * - daily_rewards_config, daily_catchup_config (v2.0)
 * - mystery_box_config (v2.0)
 * - progression_roles (v2.0 - table séparée)
 * - super_bonuses (v2.0)
 * - announcement_templates (v2.0)
 */

const fs = require('fs');
const path = require('path');
const db = require('./database-pg');

class ThemeExporter {
  constructor(guildId) {
    this.guildId = guildId;
  }

  /**
   * Exporte un thème vers un objet JavaScript
   * @param {number} themeDbId - ID de la table themes (pas theme_id)
   * @param {Object} metadata - Métadonnées additionnelles
   * @returns {Promise<Object>} Données du thème exporté
   */
  async export(themeDbId, metadata = {}) {
    try {
      // 1. Récupérer le thème principal
      const theme = await db.queryOne(`
        SELECT * FROM themes WHERE id = $1 AND guild_id = $2
      `, [themeDbId, this.guildId]);

      if (!theme) {
        throw new Error(`Thème ID ${themeDbId} non trouvé pour ce serveur`);
      }

      console.log(`📦 Export du thème "${theme.name}" (ID: ${themeDbId})`);

      // 2. Récupérer la configuration
      const themeConfig = await db.queryOne(`
        SELECT * FROM theme_config WHERE theme_id = $1 AND guild_id = $2
      `, [themeDbId, this.guildId]);

      // 3. Récupérer les collectibles
      const collectibles = await db.queryAll(`
        SELECT * FROM collectibles WHERE theme_id = $1 AND guild_id = $2
        ORDER BY rarity DESC, name ASC
      `, [themeDbId, this.guildId]);

      // 4. Récupérer les pièges
      const traps = await db.queryAll(`
        SELECT * FROM traps WHERE theme_id = $1 AND guild_id = $2
        ORDER BY name ASC
      `, [themeDbId, this.guildId]);

      // 5. Récupérer les missions
      const missions = await db.queryAll(`
        SELECT * FROM missions WHERE theme_id = $1 AND guild_id = $2
        ORDER BY type, name
      `, [themeDbId, this.guildId]);

      // 6. Récupérer les mots-clés pour les missions keyword
      const keywordMissions = missions.filter(m => m.type === 'keyword-message');
      const keywords = {};
      for (const mission of keywordMissions) {
        const missionKeywords = await db.queryAll(`
          SELECT * FROM mission_keywords WHERE mission_id = $1 AND guild_id = $2
        `, [mission.id, this.guildId]);
        keywords[mission.id] = missionKeywords;
      }

      // 7. Récupérer les questions quiz
      const quizQuestions = await db.queryAll(`
        SELECT * FROM quiz_questions WHERE theme_id = $1 AND guild_id = $2
      `, [themeDbId, this.guildId]);

      // 8. Récupérer les messages personnalisés
      const themeMessages = await db.queryAll(`
        SELECT * FROM theme_messages WHERE theme_id = $1 AND guild_id = $2
      `, [themeDbId, this.guildId]);

      // ═══════════════════════════════════════════════════════════
      // NOUVELLES TABLES v2.0
      // ═══════════════════════════════════════════════════════════

      // 9. Récupérer daily_rewards_config (calendrier 28 jours)
      const dailyRewardsConfig = await db.queryAll(`
        SELECT * FROM daily_rewards_config
        WHERE theme_id = $1 AND guild_id = $2
        ORDER BY day_number ASC
      `, [themeDbId, this.guildId]);

      // 10. Récupérer daily_catchup_config
      const dailyCatchupConfig = await db.queryOne(`
        SELECT * FROM daily_catchup_config
        WHERE theme_id = $1 AND guild_id = $2
      `, [themeDbId, this.guildId]);

      // 11. Récupérer mystery_box_config (par rareté)
      const mysteryBoxConfig = await db.queryAll(`
        SELECT * FROM mystery_box_config
        WHERE theme_id = $1 AND guild_id = $2
        ORDER BY rarity ASC
      `, [themeDbId, this.guildId]);

      // 12. Récupérer progression_roles (table séparée)
      const progressionRoles = await db.queryAll(`
        SELECT * FROM progression_roles
        WHERE theme_id = $1 AND guild_id = $2
        ORDER BY percentage ASC
      `, [themeDbId, this.guildId]);

      // 13. Récupérer super_bonuses liés au thème
      const superBonuses = await db.queryAll(`
        SELECT * FROM super_bonuses
        WHERE theme_id = $1 AND guild_id = $2
        ORDER BY rarity DESC, name ASC
      `, [themeDbId, this.guildId]);

      // 14. Récupérer announcement_templates liés au thème
      const announcementTemplates = await db.queryAll(`
        SELECT * FROM announcement_templates
        WHERE theme_id = $1 AND guild_id = $2
      `, [themeDbId, this.guildId]);

      // Construire l'objet exporté
      const exportedTheme = {
        version: '2.0.0',
        metadata: {
          name: metadata.name || theme.name,
          description: metadata.description || `Thème ${theme.name} exporté depuis le serveur`,
          author: metadata.author || 'Bot Discord',
          tags: metadata.tags || [],
          preview_image: metadata.preview_image || null,
          created_at: new Date().toISOString(),
          exported_from: this.guildId
        },
        theme: {
          theme_id: theme.theme_id,
          name: theme.name,
          duration_days: theme.duration_days,
          required_items: theme.required_items,
          final_role_name: theme.final_role_name,
          final_role_color: theme.final_role_color
        },
        theme_config: themeConfig ? this.formatThemeConfig(themeConfig) : null,
        collectibles: collectibles.map(c => this.formatCollectible(c)),
        traps: traps.map(t => this.formatTrap(t)),
        missions: this.formatMissions(missions, keywords, quizQuestions),
        theme_messages: this.formatThemeMessages(themeMessages),

        // ═══════════════════════════════════════════════════════════
        // NOUVELLES SECTIONS v2.0
        // ═══════════════════════════════════════════════════════════
        daily_rewards_config: dailyRewardsConfig.map(d => this.formatDailyReward(d)),
        daily_catchup_config: dailyCatchupConfig ? this.formatDailyCatchup(dailyCatchupConfig) : null,
        mystery_box_config: mysteryBoxConfig.map(m => this.formatMysteryBoxConfig(m)),
        progression_roles: progressionRoles.map(r => this.formatProgressionRole(r)),
        super_bonuses: superBonuses.map(b => this.formatSuperBonus(b)),
        announcement_templates: announcementTemplates.map(t => this.formatAnnouncementTemplate(t)),

        settings: {
          auto_create_roles: true,
          auto_install_super_bonuses: true,
          activate_theme_after_import: false
        }
      };

      console.log(`✅ Export terminé:`);
      console.log(`   - Collectibles: ${collectibles.length}`);
      console.log(`   - Pièges: ${traps.length}`);
      console.log(`   - Missions: ${missions.length}`);
      console.log(`   - Questions quiz: ${quizQuestions.length}`);
      console.log(`   - Daily Rewards: ${dailyRewardsConfig.length} jours`);
      console.log(`   - Daily Catchup: ${dailyCatchupConfig ? 'Oui' : 'Non'}`);
      console.log(`   - Mystery Box Config: ${mysteryBoxConfig.length} raretés`);
      console.log(`   - Progression Roles: ${progressionRoles.length}`);
      console.log(`   - Super Bonuses: ${superBonuses.length}`);
      console.log(`   - Announcement Templates: ${announcementTemplates.length}`);

      return {
        success: true,
        data: exportedTheme
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'export:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Exporte un thème vers un fichier
   * @param {number} themeDbId - ID du thème
   * @param {string} outputPath - Chemin du fichier de sortie
   * @param {Object} metadata - Métadonnées additionnelles
   */
  async exportToFile(themeDbId, outputPath = null, metadata = {}) {
    const result = await this.export(themeDbId, metadata);

    if (!result.success) {
      return result;
    }

    // Générer le nom de fichier si non fourni
    if (!outputPath) {
      const sanitizedName = result.data.theme.theme_id.replace(/[^a-z0-9_-]/gi, '_');
      const timestamp = new Date().toISOString().split('T')[0];
      outputPath = path.join(__dirname, '..', 'themes', 'exports', `${sanitizedName}_${timestamp}.theme.json`);
    }

    try {
      // S'assurer que le dossier existe
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Écrire le fichier
      fs.writeFileSync(outputPath, JSON.stringify(result.data, null, 2), 'utf8');

      console.log(`✅ Fichier exporté: ${outputPath}`);

      return {
        success: true,
        data: result.data,
        filePath: outputPath
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'écriture du fichier:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Formate la configuration du thème
   */
  formatThemeConfig(config) {
    return {
      probability_collectible: config.probability_collectible,
      probability_mission: config.probability_mission,
      probability_trap: config.probability_trap,
      probability_super_bonus: config.probability_super_bonus,
      collectible_rarity_legendary: config.collectible_rarity_legendary,
      collectible_rarity_epic: config.collectible_rarity_epic,
      collectible_rarity_rare: config.collectible_rarity_rare,
      collectible_rarity_common: config.collectible_rarity_common,
      super_bonus_rarity_legendary: config.super_bonus_rarity_legendary,
      super_bonus_rarity_epic: config.super_bonus_rarity_epic,
      super_bonus_rarity_rare: config.super_bonus_rarity_rare,
      super_bonus_rarity_common: config.super_bonus_rarity_common,
      trap_severity_1: config.trap_severity_1,
      trap_severity_2: config.trap_severity_2,
      trap_severity_3: config.trap_severity_3,
      trap_severity_4: config.trap_severity_4,
      trap_severity_5: config.trap_severity_5,
      mystery_box_image: config.mystery_box_image,
      mystery_box_title: config.mystery_box_title,
      mystery_box_description: config.mystery_box_description,
      mystery_box_winner_message: config.mystery_box_winner_message,
      mystery_box_celebration_gif: config.mystery_box_celebration_gif,
      mystery_box_celebration_emojis: config.mystery_box_celebration_emojis,
      auto_delete_celebration_message: config.auto_delete_celebration_message
      // Note: progression_roles JSON est maintenant remplacé par la table progression_roles
    };
  }

  /**
   * Formate un collectible pour l'export
   */
  formatCollectible(c) {
    const formatted = {
      collectible_id: c.collectible_id,
      name: c.name,
      image_url: c.image_url,
      rarity: c.rarity
    };

    if (c.reveal_message) {
      formatted.reveal_message = c.reveal_message;
    }

    return formatted;
  }

  /**
   * Formate un piège pour l'export
   */
  formatTrap(t) {
    const formatted = {
      trap_id: t.trap_id,
      name: t.name,
      type: t.type,
      severity: t.severity || 3,
      description: t.description
    };

    if (t.image_url) formatted.image_url = t.image_url;
    if (t.cooldown_duration) formatted.cooldown_duration = t.cooldown_duration;
    if (t.removes_collectible) formatted.removes_collectible = t.removes_collectible;
    if (t.shame_message) formatted.shame_message = t.shame_message;
    if (t.malus_points) formatted.malus_points = t.malus_points;
    if (t.is_default) formatted.is_default = t.is_default;
    if (t.is_active === false) formatted.is_active = false;
    if (t.notif_title) formatted.notif_title = t.notif_title;
    if (t.notif_description) formatted.notif_description = t.notif_description;
    if (t.notif_color && t.notif_color !== '#e74c3c') formatted.notif_color = t.notif_color;
    if (t.notif_footer) formatted.notif_footer = t.notif_footer;

    return formatted;
  }

  /**
   * Formate les missions pour l'export
   */
  formatMissions(missions, keywords, quizQuestions) {
    const result = {
      keyword: [],
      quiz: []
    };

    for (const mission of missions) {
      if (mission.type === 'keyword-message') {
        const missionKeywords = keywords[mission.id] || [];
        result.keyword.push({
          mission_id: mission.mission_id,
          name: mission.name,
          description: mission.description,
          timeout: mission.timeout || 60,
          image_url: mission.image_url || undefined,
          validation_data: mission.validation_data || undefined,
          reward_data: mission.reward_data || undefined,
          allowed_channels: mission.allowed_channels || undefined,
          keywords: missionKeywords.map(k => ({
            keyword: k.keyword,
            difficulty: k.difficulty || 'medium'
          }))
        });
      } else if (mission.type === 'quiz') {
        const missionQuestions = quizQuestions.filter(q => q.mission_id === mission.id);
        const questions = missionQuestions.map(q => ({
          question_text: q.question_text,
          correct_answer: q.correct_answer,
          wrong_answers: q.wrong_answers || [],
          hint: q.hint || undefined,
          difficulty: q.difficulty || 'medium'
        }));

        result.quiz.push({
          mission_id: mission.mission_id,
          name: mission.name,
          description: mission.description,
          timeout: mission.timeout || 60,
          max_attempts: mission.max_attempts || undefined,
          image_url: mission.image_url || undefined,
          validation_data: mission.validation_data || undefined,
          reward_data: mission.reward_data || undefined,
          allowed_channels: mission.allowed_channels || undefined,
          questions: questions
        });
      }
    }

    // Nettoyer les valeurs undefined
    result.keyword = result.keyword.map(m => JSON.parse(JSON.stringify(m)));
    result.quiz = result.quiz.map(m => JSON.parse(JSON.stringify(m)));

    return result;
  }

  /**
   * Formate les messages personnalisés
   */
  formatThemeMessages(messages) {
    const result = {};
    for (const msg of messages) {
      result[msg.key] = msg.content;
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOUVELLES MÉTHODES v2.0
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Formate une entrée daily_rewards_config
   */
  formatDailyReward(d) {
    return {
      day_number: d.day_number,
      reward_type: d.reward_type,
      reward_rarity: d.reward_rarity,
      reward_amount: d.reward_amount,
      reward_item_id: d.reward_item_id,
      choice_options: d.choice_options,
      display_name: d.display_name,
      display_emoji: d.display_emoji,
      display_description: d.display_description,
      is_milestone: d.is_milestone,
      is_bonus_day: d.is_bonus_day,
      bonus_multiplier: d.bonus_multiplier ? parseFloat(d.bonus_multiplier) : null,
      animation_type: d.animation_type
    };
  }

  /**
   * Formate daily_catchup_config
   */
  formatDailyCatchup(c) {
    return {
      currency_type: c.currency_type,
      base_price: c.base_price,
      price_increment: c.price_increment,
      price_multiplier: c.price_multiplier ? parseFloat(c.price_multiplier) : null,
      pricing_mode: c.pricing_mode,
      max_price: c.max_price,
      max_catchup_days: c.max_catchup_days,
      enabled: c.enabled
    };
  }

  /**
   * Formate mystery_box_config
   */
  formatMysteryBoxConfig(m) {
    return {
      rarity: m.rarity,
      name: m.name,
      emoji: m.emoji,
      color: m.color,
      image_url: m.image_url,
      prob_collectible: m.prob_collectible,
      prob_super_bonus: m.prob_super_bonus,
      guaranteed_min_rarity: m.guaranteed_min_rarity,
      rarity_upgrade_rare: m.rarity_upgrade_rare,
      rarity_upgrade_epic: m.rarity_upgrade_epic,
      rarity_upgrade_legendary: m.rarity_upgrade_legendary,
      image_closed: m.image_closed,
      image_opening: m.image_opening,
      image_opened: m.image_opened,
      image_empty: m.image_empty,
      text_title: m.text_title,
      text_description: m.text_description,
      text_opening: m.text_opening,
      text_success: m.text_success,
      text_empty: m.text_empty,
      sound_open: m.sound_open,
      animation_duration: m.animation_duration,
      specific_collectibles: m.specific_collectibles,
      specific_super_bonuses: m.specific_super_bonuses,
      specific_traps: m.specific_traps,
      specific_missions: m.specific_missions,
      allow_duplicate: m.allow_duplicate,
      pity_system_enabled: m.pity_system_enabled,
      pity_counter_max: m.pity_counter_max,
      is_default: m.is_default,
      is_enabled: m.is_enabled,
      rewards_count: m.rewards_count
    };
  }

  /**
   * Formate progression_roles (table séparée)
   */
  formatProgressionRole(r) {
    return {
      role_name: r.role_name,
      percentage: r.percentage,
      color: r.color
      // discord_role_id est omis car spécifique au serveur
    };
  }

  /**
   * Formate super_bonuses
   */
  formatSuperBonus(b) {
    return {
      bonus_id: b.bonus_id,
      name: b.name,
      description: b.description,
      icon: b.icon,
      bonus_type: b.bonus_type,
      effect_type: b.effect_type,
      effect_config: b.effect_config,
      duration_type: b.duration_type,
      duration_value: b.duration_value,
      image_url: b.image_url,
      color: b.color,
      rarity: b.rarity,
      announcement_message: b.announcement_message,
      activation_mode: b.activation_mode,
      is_enabled: b.is_enabled
    };
  }

  /**
   * Formate announcement_templates
   */
  formatAnnouncementTemplate(t) {
    return {
      type: t.type,
      title: t.title,
      description: t.description,
      color: t.color,
      footer_text: t.footer_text,
      image_url: t.image_url,
      thumbnail_url: t.thumbnail_url
    };
  }

  /**
   * Liste les thèmes exportables pour un serveur
   */
  static async listExportableThemes(guildId) {
    try {
      const themes = await db.queryAll(`
        SELECT
          t.id,
          t.theme_id,
          t.name,
          t.is_active,
          t.created_at,
          (SELECT COUNT(*) FROM collectibles c WHERE c.theme_id = t.id AND c.guild_id = t.guild_id) as collectibles_count,
          (SELECT COUNT(*) FROM missions m WHERE m.theme_id = t.id AND m.guild_id = t.guild_id) as missions_count,
          (SELECT COUNT(*) FROM traps tr WHERE tr.theme_id = t.id AND tr.guild_id = t.guild_id) as traps_count,
          (SELECT COUNT(*) FROM daily_rewards_config dr WHERE dr.theme_id = t.id AND dr.guild_id = t.guild_id) as daily_rewards_count,
          (SELECT COUNT(*) FROM mystery_box_config mb WHERE mb.theme_id = t.id AND mb.guild_id = t.guild_id) as mystery_box_count,
          (SELECT COUNT(*) FROM super_bonuses sb WHERE sb.theme_id = t.id AND sb.guild_id = t.guild_id) as super_bonus_count
        FROM themes t
        WHERE t.guild_id = $1
        ORDER BY t.is_active DESC, t.created_at DESC
      `, [guildId]);

      return themes.map(t => ({
        id: t.id,
        theme_id: t.theme_id,
        name: t.name,
        is_active: t.is_active,
        created_at: t.created_at,
        collectibles_count: parseInt(t.collectibles_count) || 0,
        missions_count: parseInt(t.missions_count) || 0,
        traps_count: parseInt(t.traps_count) || 0,
        daily_rewards_count: parseInt(t.daily_rewards_count) || 0,
        mystery_box_count: parseInt(t.mystery_box_count) || 0,
        super_bonus_count: parseInt(t.super_bonus_count) || 0
      }));

    } catch (error) {
      console.error('Erreur lors de la liste des thèmes:', error);
      return [];
    }
  }
}

module.exports = ThemeExporter;
