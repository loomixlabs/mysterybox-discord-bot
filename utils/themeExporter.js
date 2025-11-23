/**
 * Exportateur de thèmes
 * Exporte un thème existant vers un fichier .theme.json
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

      // Construire l'objet exporté
      const exportedTheme = {
        version: '1.0.0',
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
    // Formater les progression_roles (sans discord_role_id qui est spécifique au serveur)
    const progressionRoles = (config.progression_roles || []).map(role => ({
      name: role.name,
      color: role.color,
      required_items: role.required_items,
      percentage: role.percentage,
      hoist: role.hoist || false,
      mentionable: role.mentionable || false
      // discord_role_id est intentionnellement omis car spécifique au serveur source
    }));

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
      mystery_box_image: config.mystery_box_image,
      mystery_box_title: config.mystery_box_title,
      mystery_box_description: config.mystery_box_description,
      mystery_box_winner_message: config.mystery_box_winner_message,
      mystery_box_celebration_gif: config.mystery_box_celebration_gif,
      mystery_box_celebration_emojis: config.mystery_box_celebration_emojis,
      auto_delete_celebration_message: config.auto_delete_celebration_message,
      progression_roles: progressionRoles
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
          keywords: missionKeywords.map(k => ({
            keyword: k.keyword,
            difficulty: k.difficulty || 'medium'
          }))
        });
      } else if (mission.type === 'quiz') {
        // Regrouper les questions quiz
        const questions = quizQuestions.map(q => ({
          question_text: q.question_text,
          correct_answer: q.correct_answer,
          wrong_answers: q.wrong_answers || [],
          hint: q.hint || undefined,
          difficulty: q.difficulty || 'medium'
        }));

        if (questions.length > 0) {
          result.quiz.push({
            mission_id: mission.mission_id,
            name: mission.name,
            description: mission.description,
            timeout: mission.timeout || 60,
            max_attempts: mission.max_attempts || undefined,
            image_url: mission.image_url || undefined,
            questions: questions
          });
        }
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
          (SELECT COUNT(*) FROM collectibles c WHERE c.theme_id = t.id) as collectibles_count,
          (SELECT COUNT(*) FROM missions m WHERE m.theme_id = t.id) as missions_count,
          (SELECT COUNT(*) FROM traps tr WHERE tr.theme_id = t.id) as traps_count
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
        traps_count: parseInt(t.traps_count) || 0
      }));

    } catch (error) {
      console.error('Erreur lors de la liste des thèmes:', error);
      return [];
    }
  }
}

module.exports = ThemeExporter;
