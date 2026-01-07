/**
 * Validateur de fichiers de thèmes (.theme.json) v2.1
 * Supporte les versions 1.x, 2.0 et 2.1 du format
 *
 * Sections v2.0:
 * - daily_rewards_config (calendrier 28 jours)
 * - daily_catchup_config (configuration rattrapage)
 * - mystery_box_config (configuration par rareté)
 * - progression_roles (table séparée)
 * - super_bonuses (bonus liés au thème)
 * - announcement_templates (templates liés au thème)
 *
 * Nouvelles sections v2.1:
 * - theme_profile_frames (frames de profil personnalisés)
 * - theme_collectible_frames (frames de collectibles par rareté)
 *
 * Types de missions supportés v2.1:
 * - keyword-message, quiz, true-false, emoji-puzzle, wordle, hangman, unscramble
 */

const fs = require('fs');
const path = require('path');

// Charger le schema JSON
const schemaPath = path.join(__dirname, '..', 'themes', 'schema', 'theme.schema.json');
let schema = null;

/**
 * Charge le schema JSON depuis le fichier
 */
function loadSchema() {
  if (!schema) {
    try {
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      schema = JSON.parse(schemaContent);
    } catch (error) {
      console.error('Erreur lors du chargement du schema:', error);
      throw new Error('Impossible de charger le schema de validation');
    }
  }
  return schema;
}

/**
 * Classe de validation de thèmes
 */
class ThemeValidator {
  constructor() {
    this.schema = loadSchema();
    this.errors = [];
  }

  /**
   * Valide un objet thème contre le schema
   * @param {Object} themeData - Données du thème à valider
   * @returns {Object} Résultat de la validation { valid: boolean, errors: Array }
   */
  validate(themeData) {
    this.errors = [];

    // Vérifier les champs requis au niveau racine
    const requiredRoot = ['version', 'metadata', 'theme'];
    for (const field of requiredRoot) {
      if (!themeData[field]) {
        this.errors.push(`Champ requis manquant: ${field}`);
      }
    }

    if (this.errors.length > 0) {
      return { valid: false, errors: this.errors };
    }

    // Valider la version
    this.validateVersion(themeData.version);

    // Valider les métadonnées
    this.validateMetadata(themeData.metadata);

    // Valider le thème principal
    this.validateThemeCore(themeData.theme);

    // Valider theme_config si présent
    if (themeData.theme_config) {
      this.validateThemeConfig(themeData.theme_config);
    }

    // Valider les collectibles (requis)
    if (themeData.collectibles && themeData.collectibles.length > 0) {
      this.validateCollectibles(themeData.collectibles);
    } else {
      this.errors.push('Au moins un collectible est requis');
    }

    // Valider les pièges si présents
    if (themeData.traps && themeData.traps.length > 0) {
      this.validateTraps(themeData.traps);
    }

    // Valider les missions si présentes
    if (themeData.missions) {
      this.validateMissions(themeData.missions);
    }

    // ═══════════════════════════════════════════════════════════
    // NOUVELLES VALIDATIONS v2.0
    // ═══════════════════════════════════════════════════════════

    // Valider daily_rewards_config si présent
    if (themeData.daily_rewards_config && themeData.daily_rewards_config.length > 0) {
      this.validateDailyRewardsConfig(themeData.daily_rewards_config);
    }

    // Valider daily_catchup_config si présent
    if (themeData.daily_catchup_config) {
      this.validateDailyCatchupConfig(themeData.daily_catchup_config);
    }

    // Valider mystery_box_config si présent
    if (themeData.mystery_box_config && themeData.mystery_box_config.length > 0) {
      this.validateMysteryBoxConfig(themeData.mystery_box_config);
    }

    // Valider progression_roles si présent
    if (themeData.progression_roles && themeData.progression_roles.length > 0) {
      this.validateProgressionRoles(themeData.progression_roles);
    }

    // Valider super_bonuses si présent
    if (themeData.super_bonuses && themeData.super_bonuses.length > 0) {
      this.validateSuperBonuses(themeData.super_bonuses);
    }

    // Valider announcement_templates si présent
    if (themeData.announcement_templates && themeData.announcement_templates.length > 0) {
      this.validateAnnouncementTemplates(themeData.announcement_templates);
    }

    // ═══════════════════════════════════════════════════════════
    // NOUVELLES VALIDATIONS v2.1 - FRAMES
    // ═══════════════════════════════════════════════════════════

    // Valider theme_profile_frames si présent
    if (themeData.theme_profile_frames && themeData.theme_profile_frames.length > 0) {
      this.validateProfileFrames(themeData.theme_profile_frames);
    }

    // Valider theme_collectible_frames si présent
    if (themeData.theme_collectible_frames && themeData.theme_collectible_frames.length > 0) {
      this.validateCollectibleFrames(themeData.theme_collectible_frames);
    }

    // Vérifications de cohérence
    this.validateCoherence(themeData);

    return {
      valid: this.errors.length === 0,
      errors: this.errors
    };
  }

  /**
   * Valide la version du format
   */
  validateVersion(version) {
    if (typeof version !== 'string') {
      this.errors.push('La version doit être une chaîne de caractères');
      return;
    }

    const semverPattern = /^\d+\.\d+\.\d+$/;
    if (!semverPattern.test(version)) {
      this.errors.push(`Version invalide: ${version} (format attendu: X.Y.Z)`);
    }
  }

  /**
   * Valide les métadonnées
   */
  validateMetadata(metadata) {
    if (!metadata.name || metadata.name.length < 3) {
      this.errors.push('metadata.name doit avoir au moins 3 caractères');
    }
    if (metadata.name && metadata.name.length > 50) {
      this.errors.push('metadata.name ne peut pas dépasser 50 caractères');
    }
    if (!metadata.description) {
      this.errors.push('metadata.description est requis');
    }
    if (!metadata.author) {
      this.errors.push('metadata.author est requis');
    }
  }

  /**
   * Valide le coeur du thème
   */
  validateThemeCore(theme) {
    // theme_id
    if (!theme.theme_id) {
      this.errors.push('theme.theme_id est requis');
    } else {
      const idPattern = /^[a-z0-9_-]+$/;
      if (!idPattern.test(theme.theme_id)) {
        this.errors.push('theme.theme_id doit contenir uniquement des lettres minuscules, chiffres, tirets et underscores');
      }
    }

    // name
    if (!theme.name || theme.name.length < 3) {
      this.errors.push('theme.name doit avoir au moins 3 caractères');
    }

    // duration_days
    if (!Number.isInteger(theme.duration_days) || theme.duration_days < 1 || theme.duration_days > 365) {
      this.errors.push('theme.duration_days doit être un entier entre 1 et 365');
    }

    // required_items
    if (!Number.isInteger(theme.required_items) || theme.required_items < 1) {
      this.errors.push('theme.required_items doit être un entier >= 1');
    }

    // final_role_name
    if (!theme.final_role_name) {
      this.errors.push('theme.final_role_name est requis');
    }

    // final_role_color
    const colorPattern = /^#[0-9A-Fa-f]{6}$/;
    if (!theme.final_role_color || !colorPattern.test(theme.final_role_color)) {
      this.errors.push('theme.final_role_color doit être une couleur hexadécimale (#RRGGBB)');
    }
  }

  /**
   * Valide la configuration du thème
   */
  validateThemeConfig(config) {
    // Vérifier que les probabilités sont des entiers 0-100
    const probFields = [
      'probability_collectible', 'probability_mission', 'probability_trap', 'probability_super_bonus',
      'collectible_rarity_legendary', 'collectible_rarity_epic', 'collectible_rarity_rare', 'collectible_rarity_common'
    ];

    for (const field of probFields) {
      if (config[field] !== undefined) {
        if (!Number.isInteger(config[field]) || config[field] < 0 || config[field] > 100) {
          this.errors.push(`theme_config.${field} doit être un entier entre 0 et 100`);
        }
      }
    }

    // Vérifier que probability_collectible + probability_mission + probability_trap + probability_super_bonus = 100
    const probSum = (config.probability_collectible || 40) +
                    (config.probability_mission || 30) +
                    (config.probability_trap || 20) +
                    (config.probability_super_bonus || 10);

    if (probSum !== 100) {
      this.errors.push(`La somme des probabilités (collectible + mission + trap + super_bonus) doit être 100 (actuellement: ${probSum})`);
    }
  }

  /**
   * Valide les collectibles
   */
  validateCollectibles(collectibles) {
    const validRarities = ['common', 'rare', 'epic', 'legendary'];
    const seenIds = new Set();

    collectibles.forEach((collectible, index) => {
      const prefix = `collectibles[${index}]`;

      // collectible_id
      if (!collectible.collectible_id) {
        this.errors.push(`${prefix}.collectible_id est requis`);
      } else {
        if (seenIds.has(collectible.collectible_id)) {
          this.errors.push(`${prefix}.collectible_id "${collectible.collectible_id}" est dupliqué`);
        }
        seenIds.add(collectible.collectible_id);
      }

      // name
      if (!collectible.name) {
        this.errors.push(`${prefix}.name est requis`);
      }

      // image_url
      if (!collectible.image_url) {
        this.errors.push(`${prefix}.image_url est requis`);
      }

      // rarity
      if (!collectible.rarity || !validRarities.includes(collectible.rarity)) {
        this.errors.push(`${prefix}.rarity doit être: ${validRarities.join(', ')}`);
      }
    });
  }

  /**
   * Valide les pièges
   */
  validateTraps(traps) {
    const validTypes = ['cooldown', 'lose-collectible', 'lose-all-collectibles', 'public-shame', 'empty-box'];
    const seenIds = new Set();

    traps.forEach((trap, index) => {
      const prefix = `traps[${index}]`;

      // trap_id
      if (!trap.trap_id) {
        this.errors.push(`${prefix}.trap_id est requis`);
      } else {
        if (seenIds.has(trap.trap_id)) {
          this.errors.push(`${prefix}.trap_id "${trap.trap_id}" est dupliqué`);
        }
        seenIds.add(trap.trap_id);
      }

      // name
      if (!trap.name) {
        this.errors.push(`${prefix}.name est requis`);
      }

      // type
      if (!trap.type || !validTypes.includes(trap.type)) {
        this.errors.push(`${prefix}.type doit être: ${validTypes.join(', ')}`);
      }

      // description
      if (!trap.description) {
        this.errors.push(`${prefix}.description est requis`);
      }

      // Validations spécifiques au type
      if (trap.type === 'cooldown' && (!trap.cooldown_duration || trap.cooldown_duration < 1)) {
        this.errors.push(`${prefix}.cooldown_duration est requis pour le type cooldown`);
      }
    });
  }

  /**
   * Valide les missions v2.1
   * Supporte: keyword-message, quiz, true-false, emoji-puzzle, wordle, hangman, unscramble
   * Note: Les missions exportées peuvent avoir keywords/questions vides si elles n'ont pas encore été configurées
   */
  validateMissions(missions) {
    // ═══════════════════════════════════════════════════════════
    // TYPE 1: keyword-message (stocke dans mission_keywords)
    // ═══════════════════════════════════════════════════════════
    if (missions.keyword && Array.isArray(missions.keyword)) {
      missions.keyword.forEach((mission, index) => {
        this.validateMissionBase(mission, `missions.keyword[${index}]`);

        // Warning au lieu d'erreur pour missions sans keywords (peuvent être configurées après import)
        if (!mission.keywords || mission.keywords.length === 0) {
          console.warn(`missions.keyword[${index}]: aucun mot-clé défini (peut être configuré après import)`);
        } else {
          mission.keywords.forEach((kw, kwIndex) => {
            if (!kw.keyword) {
              this.errors.push(`missions.keyword[${index}].keywords[${kwIndex}].keyword est requis`);
            }
          });
        }
      });
    }

    // ═══════════════════════════════════════════════════════════
    // TYPE 2: quiz (stocke dans quiz_questions avec wrong_answers)
    // ═══════════════════════════════════════════════════════════
    if (missions.quiz && Array.isArray(missions.quiz)) {
      missions.quiz.forEach((mission, index) => {
        this.validateMissionBase(mission, `missions.quiz[${index}]`);
        this.validateMissionQuestions(mission.questions, `missions.quiz[${index}]`, {
          requireWrongAnswers: true
        });
      });
    }

    // ═══════════════════════════════════════════════════════════
    // TYPE 3: true-false (stocke dans quiz_questions)
    // correct_answer doit être "vrai" ou "faux"
    // ═══════════════════════════════════════════════════════════
    if (missions['true-false'] && Array.isArray(missions['true-false'])) {
      missions['true-false'].forEach((mission, index) => {
        this.validateMissionBase(mission, `missions.true-false[${index}]`);
        this.validateMissionQuestions(mission.questions, `missions.true-false[${index}]`, {
          validAnswers: ['vrai', 'faux', 'true', 'false']
        });
      });
    }

    // ═══════════════════════════════════════════════════════════
    // TYPE 4: emoji-puzzle (stocke dans quiz_questions)
    // question_text = emojis, correct_answer = réponse
    // ═══════════════════════════════════════════════════════════
    if (missions['emoji-puzzle'] && Array.isArray(missions['emoji-puzzle'])) {
      missions['emoji-puzzle'].forEach((mission, index) => {
        this.validateMissionBase(mission, `missions.emoji-puzzle[${index}]`);
        this.validateMissionQuestions(mission.questions, `missions.emoji-puzzle[${index}]`, {
          questionFieldName: 'question_text'  // Contient les emojis
        });
      });
    }

    // ═══════════════════════════════════════════════════════════
    // TYPE 5: wordle (stocke dans quiz_questions)
    // question_text = "Wordle: MOT" ou juste le mot
    // ═══════════════════════════════════════════════════════════
    if (missions.wordle && Array.isArray(missions.wordle)) {
      missions.wordle.forEach((mission, index) => {
        this.validateMissionBase(mission, `missions.wordle[${index}]`);
        this.validateMissionQuestions(mission.questions, `missions.wordle[${index}]`, {
          minWordLength: 4,
          maxWordLength: 8
        });
      });
    }

    // ═══════════════════════════════════════════════════════════
    // TYPE 6: hangman (stocke dans quiz_questions)
    // question_text = "Mot à deviner" ou indice
    // correct_answer = le mot
    // ═══════════════════════════════════════════════════════════
    if (missions.hangman && Array.isArray(missions.hangman)) {
      missions.hangman.forEach((mission, index) => {
        this.validateMissionBase(mission, `missions.hangman[${index}]`);
        this.validateMissionQuestions(mission.questions, `missions.hangman[${index}]`);
      });
    }

    // ═══════════════════════════════════════════════════════════
    // TYPE 7: unscramble (stocke dans quiz_questions)
    // correct_answer = le mot à reconstituer
    // ═══════════════════════════════════════════════════════════
    if (missions.unscramble && Array.isArray(missions.unscramble)) {
      missions.unscramble.forEach((mission, index) => {
        this.validateMissionBase(mission, `missions.unscramble[${index}]`);
        this.validateMissionQuestions(mission.questions, `missions.unscramble[${index}]`);
      });
    }
  }

  /**
   * Valide la structure de base d'une mission
   * @param {Object} mission - La mission à valider
   * @param {string} prefix - Préfixe pour les messages d'erreur
   */
  validateMissionBase(mission, prefix) {
    if (!mission.mission_id) {
      this.errors.push(`${prefix}.mission_id est requis`);
    }
    if (!mission.name) {
      this.errors.push(`${prefix}.name est requis`);
    }
    if (!mission.description) {
      this.errors.push(`${prefix}.description est requis`);
    }
    // timeout optionnel mais doit être positif si présent
    if (mission.timeout !== undefined && mission.timeout !== null) {
      if (!Number.isInteger(mission.timeout) || mission.timeout < 1) {
        this.errors.push(`${prefix}.timeout doit être un entier >= 1 seconde`);
      }
    }
    // max_attempts optionnel mais doit être positif si présent
    if (mission.max_attempts !== undefined && mission.max_attempts !== null) {
      if (!Number.isInteger(mission.max_attempts) || mission.max_attempts < 1) {
        this.errors.push(`${prefix}.max_attempts doit être un entier >= 1`);
      }
    }
    // validation_data optionnel - doit être un objet si présent
    if (mission.validation_data !== undefined && mission.validation_data !== null) {
      if (typeof mission.validation_data !== 'object') {
        this.errors.push(`${prefix}.validation_data doit être un objet`);
      }
    }
    // reward_data optionnel - doit être un objet si présent
    if (mission.reward_data !== undefined && mission.reward_data !== null) {
      if (typeof mission.reward_data !== 'object') {
        this.errors.push(`${prefix}.reward_data doit être un objet`);
      }
    }
  }

  /**
   * Valide les questions d'une mission
   * @param {Array} questions - Tableau de questions
   * @param {string} prefix - Préfixe pour les messages d'erreur
   * @param {Object} options - Options de validation spécifiques au type
   */
  validateMissionQuestions(questions, prefix, options = {}) {
    const {
      requireWrongAnswers = false,
      validAnswers = null,
      minWordLength = null,
      maxWordLength = null,
      questionFieldName = 'question_text'
    } = options;

    // Warning au lieu d'erreur pour missions sans questions
    if (!questions || questions.length === 0) {
      console.warn(`${prefix}: aucune question définie (peut être configurée après import)`);
      return;
    }

    questions.forEach((q, qIndex) => {
      const qPrefix = `${prefix}.questions[${qIndex}]`;

      // question_text requis (sauf si optionnel pour certains types)
      if (!q[questionFieldName] && questionFieldName === 'question_text') {
        // Pour hangman/wordle/unscramble, question_text peut être optionnel
        // (peut être généré à partir de correct_answer)
      }

      // correct_answer toujours requis
      if (!q.correct_answer) {
        this.errors.push(`${qPrefix}.correct_answer est requis`);
      } else {
        // Validation des réponses valides (true-false)
        if (validAnswers && !validAnswers.includes(q.correct_answer.toLowerCase())) {
          this.errors.push(`${qPrefix}.correct_answer doit être: ${validAnswers.join(' ou ')}`);
        }

        // Validation longueur mot (wordle)
        if (minWordLength || maxWordLength) {
          const wordLength = q.correct_answer.length;
          if (minWordLength && wordLength < minWordLength) {
            console.warn(`${qPrefix}: mot trop court (${wordLength} < ${minWordLength})`);
          }
          if (maxWordLength && wordLength > maxWordLength) {
            console.warn(`${qPrefix}: mot trop long (${wordLength} > ${maxWordLength})`);
          }
        }
      }

      // wrong_answers requis pour quiz
      if (requireWrongAnswers) {
        if (!q.wrong_answers || !Array.isArray(q.wrong_answers) || q.wrong_answers.length === 0) {
          console.warn(`${qPrefix}: wrong_answers recommandé pour les quiz`);
        }
      }

      // difficulty optionnel mais doit être valide si présent
      if (q.difficulty !== undefined && q.difficulty !== null) {
        const validDifficulties = ['easy', 'medium', 'hard', 1, 2, 3];
        if (!validDifficulties.includes(q.difficulty)) {
          console.warn(`${qPrefix}: difficulty "${q.difficulty}" non standard`);
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOUVELLES MÉTHODES DE VALIDATION v2.0
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Valide daily_rewards_config (calendrier jusqu'à 60 jours)
   */
  validateDailyRewardsConfig(rewards) {
    // Types étendus pour supporter tous les cas réels
    const validRewardTypes = [
      'currency', 'mystery_box_key', 'super_bonus', 'collectible', 'choice',
      'mystery_box', 'key', 'loomix', 'bonus', 'trap_immunity', 'random'
    ];
    const validRarities = ['common', 'rare', 'epic', 'legendary'];
    const seenDays = new Set();

    rewards.forEach((reward, index) => {
      const prefix = `daily_rewards_config[${index}]`;

      // day_number (1-60 pour supporter calendriers étendus)
      if (!Number.isInteger(reward.day_number) || reward.day_number < 1 || reward.day_number > 60) {
        this.errors.push(`${prefix}.day_number doit être un entier entre 1 et 60`);
      } else {
        if (seenDays.has(reward.day_number)) {
          // Warning au lieu d'erreur pour les doublons
          console.warn(`${prefix}.day_number ${reward.day_number} est dupliqué`);
        }
        seenDays.add(reward.day_number);
      }

      // reward_type - warning au lieu d'erreur pour types inconnus
      if (reward.reward_type && !validRewardTypes.includes(reward.reward_type)) {
        console.warn(`${prefix}: reward_type "${reward.reward_type}" non standard (peut être personnalisé)`);
      }

      // reward_rarity si applicable
      if (reward.reward_rarity && !validRarities.includes(reward.reward_rarity)) {
        this.errors.push(`${prefix}.reward_rarity doit être: ${validRarities.join(', ')}`);
      }

      // Validations spécifiques au type
      if (reward.reward_type === 'currency' && (!reward.reward_amount || reward.reward_amount < 1)) {
        console.warn(`${prefix}: reward_amount recommandé pour le type currency`);
      }
    });
  }

  /**
   * Valide daily_catchup_config
   */
  validateDailyCatchupConfig(config) {
    // 'increment' est un alias de 'linear' (valeur par défaut DB)
    const validPricingModes = ['linear', 'exponential', 'fixed', 'increment'];

    // pricing_mode
    if (config.pricing_mode && !validPricingModes.includes(config.pricing_mode)) {
      this.errors.push(`daily_catchup_config.pricing_mode doit être: ${validPricingModes.join(', ')}`);
    }

    // base_price
    if (config.base_price !== undefined && (!Number.isInteger(config.base_price) || config.base_price < 0)) {
      this.errors.push('daily_catchup_config.base_price doit être un entier >= 0');
    }

    // max_catchup_days (0 = pas de limite, donc >= 0)
    if (config.max_catchup_days !== undefined && (!Number.isInteger(config.max_catchup_days) || config.max_catchup_days < 0)) {
      this.errors.push('daily_catchup_config.max_catchup_days doit être un entier >= 0');
    }
  }

  /**
   * Valide mystery_box_config (par rareté)
   */
  validateMysteryBoxConfig(configs) {
    const validRarities = ['common', 'rare', 'epic', 'legendary'];
    const seenRarities = new Set();

    configs.forEach((config, index) => {
      const prefix = `mystery_box_config[${index}]`;

      // rarity (obligatoire)
      if (!config.rarity || !validRarities.includes(config.rarity)) {
        this.errors.push(`${prefix}.rarity doit être: ${validRarities.join(', ')}`);
      } else {
        if (seenRarities.has(config.rarity)) {
          this.errors.push(`${prefix}.rarity "${config.rarity}" est dupliquée`);
        }
        seenRarities.add(config.rarity);
      }

      // Probabilités (0-100)
      const probFields = ['prob_collectible', 'prob_super_bonus', 'rarity_upgrade_rare', 'rarity_upgrade_epic', 'rarity_upgrade_legendary'];
      for (const field of probFields) {
        if (config[field] !== undefined && config[field] !== null) {
          if (typeof config[field] !== 'number' || config[field] < 0 || config[field] > 100) {
            this.errors.push(`${prefix}.${field} doit être un nombre entre 0 et 100`);
          }
        }
      }

      // animation_duration
      if (config.animation_duration !== undefined && (!Number.isInteger(config.animation_duration) || config.animation_duration < 0)) {
        this.errors.push(`${prefix}.animation_duration doit être un entier >= 0`);
      }
    });
  }

  /**
   * Valide progression_roles (table séparée)
   */
  validateProgressionRoles(roles) {
    const seenPercentages = new Set();
    const colorPattern = /^#[0-9A-Fa-f]{6}$/;

    roles.forEach((role, index) => {
      const prefix = `progression_roles[${index}]`;

      // role_name
      if (!role.role_name || role.role_name.length < 1) {
        this.errors.push(`${prefix}.role_name est requis`);
      }

      // percentage (1-100)
      if (!Number.isInteger(role.percentage) || role.percentage < 1 || role.percentage > 100) {
        this.errors.push(`${prefix}.percentage doit être un entier entre 1 et 100`);
      } else {
        if (seenPercentages.has(role.percentage)) {
          this.errors.push(`${prefix}.percentage ${role.percentage} est dupliqué`);
        }
        seenPercentages.add(role.percentage);
      }

      // color (format hexadécimal)
      if (role.color && !colorPattern.test(role.color)) {
        this.errors.push(`${prefix}.color doit être une couleur hexadécimale (#RRGGBB)`);
      }
    });

    // Vérifier qu'il y a un rôle à 100%
    if (!seenPercentages.has(100)) {
      console.warn('Attention: Aucun rôle de progression à 100% (rôle final)');
    }
  }

  /**
   * Valide super_bonuses
   */
  validateSuperBonuses(bonuses) {
    const validBonusTypes = ['instant', 'duration', 'permanent', 'consumable'];
    const validEffectTypes = [
      'double_chances', 'jackpot', 'bouclier_anti_piege', 'vision_divine',
      'aimant_legendaires', 'reroll_mission', 'joker', 'multiplicateur_loomix',
      'super_bouclier', 'chance_legendaire'
    ];
    const validRarities = ['common', 'rare', 'epic', 'legendary'];
    const validActivationModes = ['instant', 'manual', 'random'];
    const seenIds = new Set();

    bonuses.forEach((bonus, index) => {
      const prefix = `super_bonuses[${index}]`;

      // bonus_id
      if (!bonus.bonus_id) {
        this.errors.push(`${prefix}.bonus_id est requis`);
      } else {
        if (seenIds.has(bonus.bonus_id)) {
          this.errors.push(`${prefix}.bonus_id "${bonus.bonus_id}" est dupliqué`);
        }
        seenIds.add(bonus.bonus_id);
      }

      // name
      if (!bonus.name) {
        this.errors.push(`${prefix}.name est requis`);
      }

      // effect_type
      if (!bonus.effect_type) {
        this.errors.push(`${prefix}.effect_type est requis`);
      }
      // Note: On ne valide pas contre validEffectTypes pour permettre des types personnalisés

      // bonus_type
      if (bonus.bonus_type && !validBonusTypes.includes(bonus.bonus_type)) {
        this.errors.push(`${prefix}.bonus_type doit être: ${validBonusTypes.join(', ')}`);
      }

      // rarity
      if (bonus.rarity && !validRarities.includes(bonus.rarity)) {
        this.errors.push(`${prefix}.rarity doit être: ${validRarities.join(', ')}`);
      }

      // activation_mode
      if (bonus.activation_mode && !validActivationModes.includes(bonus.activation_mode)) {
        this.errors.push(`${prefix}.activation_mode doit être: ${validActivationModes.join(', ')}`);
      }

      // duration_value si duration_type est présent
      if (bonus.duration_type && bonus.duration_type !== 'instant' && !bonus.duration_value) {
        console.warn(`${prefix}: duration_value recommandé pour duration_type "${bonus.duration_type}"`);
      }
    });
  }

  /**
   * Valide announcement_templates
   */
  validateAnnouncementTemplates(templates) {
    const validTypes = [
      'legendary_collectible', 'collection_completed', 'collection_traded', 'collection_lost',
      'trap_cooldown', 'trap_lose_collectible', 'trap_public_shame', 'trap_empty_box', 'trap_lose_all_collectibles',
      'mission_word_guessed', 'mission_started', 'mission_completed', 'mission_failed', 'mission_approved', 'mission_rejected',
      'theme_expired', 'theme_expiring_soon', 'legendary_super_bonus'
    ];
    const colorPattern = /^#[0-9A-Fa-f]{6}$/;
    const seenTypes = new Set();

    templates.forEach((template, index) => {
      const prefix = `announcement_templates[${index}]`;

      // type
      if (!template.type) {
        this.errors.push(`${prefix}.type est requis`);
      } else {
        if (!validTypes.includes(template.type)) {
          console.warn(`${prefix}: type "${template.type}" non standard (peut être personnalisé)`);
        }
        if (seenTypes.has(template.type)) {
          this.errors.push(`${prefix}.type "${template.type}" est dupliqué`);
        }
        seenTypes.add(template.type);
      }

      // title
      if (!template.title) {
        this.errors.push(`${prefix}.title est requis`);
      }

      // description
      if (!template.description) {
        this.errors.push(`${prefix}.description est requis`);
      }

      // color (format hexadécimal)
      if (template.color && !colorPattern.test(template.color)) {
        this.errors.push(`${prefix}.color doit être une couleur hexadécimale (#RRGGBB)`);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOUVELLES MÉTHODES DE VALIDATION v2.1 - FRAMES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Valide theme_profile_frames
   * Structure: frame_number, name, description, frame_url, unlock_condition, bonus_type, bonus_value
   */
  validateProfileFrames(frames) {
    const seenFrameNumbers = new Set();
    const validUnlockTypes = ['collectibles_level', 'legendary_level', 'epic_level', 'rare_level', 'missions_completed', 'days_played'];
    const validBonusTypes = ['xp_multiplier', 'currency_multiplier', 'luck_bonus', 'cooldown_reduction'];

    frames.forEach((frame, index) => {
      const prefix = `theme_profile_frames[${index}]`;

      // frame_number (requis, 1-10)
      if (!Number.isInteger(frame.frame_number) || frame.frame_number < 1 || frame.frame_number > 10) {
        this.errors.push(`${prefix}.frame_number doit être un entier entre 1 et 10`);
      } else {
        if (seenFrameNumbers.has(frame.frame_number)) {
          this.errors.push(`${prefix}.frame_number ${frame.frame_number} est dupliqué`);
        }
        seenFrameNumbers.add(frame.frame_number);
      }

      // name (requis)
      if (!frame.name || frame.name.length < 1) {
        this.errors.push(`${prefix}.name est requis`);
      }

      // frame_url (requis, doit être une URL valide)
      if (!frame.frame_url) {
        this.errors.push(`${prefix}.frame_url est requis`);
      } else {
        const urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(frame.frame_url)) {
          this.errors.push(`${prefix}.frame_url doit être une URL valide (http:// ou https://)`);
        }
      }

      // unlock_condition (optionnel mais doit être un objet valide)
      if (frame.unlock_condition) {
        if (typeof frame.unlock_condition !== 'object') {
          this.errors.push(`${prefix}.unlock_condition doit être un objet`);
        } else {
          // Valider le type de condition
          if (frame.unlock_condition.type && !validUnlockTypes.includes(frame.unlock_condition.type)) {
            console.warn(`${prefix}: unlock_condition.type "${frame.unlock_condition.type}" non standard`);
          }
          // Valider count si présent
          if (frame.unlock_condition.count !== undefined) {
            if (!Number.isInteger(frame.unlock_condition.count) || frame.unlock_condition.count < 1) {
              this.errors.push(`${prefix}.unlock_condition.count doit être un entier >= 1`);
            }
          }
        }
      }

      // bonus_type (optionnel)
      if (frame.bonus_type && !validBonusTypes.includes(frame.bonus_type)) {
        console.warn(`${prefix}: bonus_type "${frame.bonus_type}" non standard (peut être personnalisé)`);
      }

      // bonus_value (optionnel mais doit être un nombre si présent)
      if (frame.bonus_value !== undefined && frame.bonus_value !== null) {
        if (typeof frame.bonus_value !== 'number') {
          this.errors.push(`${prefix}.bonus_value doit être un nombre`);
        }
      }
    });
  }

  /**
   * Valide theme_collectible_frames
   * Structure: rarity, frame_url
   */
  validateCollectibleFrames(frames) {
    const validRarities = ['common', 'rare', 'epic', 'legendary'];
    const seenRarities = new Set();

    frames.forEach((frame, index) => {
      const prefix = `theme_collectible_frames[${index}]`;

      // rarity (requis)
      if (!frame.rarity || !validRarities.includes(frame.rarity)) {
        this.errors.push(`${prefix}.rarity doit être: ${validRarities.join(', ')}`);
      } else {
        if (seenRarities.has(frame.rarity)) {
          this.errors.push(`${prefix}.rarity "${frame.rarity}" est dupliquée`);
        }
        seenRarities.add(frame.rarity);
      }

      // frame_url (requis, doit être une URL valide)
      if (!frame.frame_url) {
        this.errors.push(`${prefix}.frame_url est requis`);
      } else {
        const urlPattern = /^https?:\/\/.+/i;
        if (!urlPattern.test(frame.frame_url)) {
          this.errors.push(`${prefix}.frame_url doit être une URL valide (http:// ou https://)`);
        }
      }
    });
  }

  /**
   * Validations de cohérence globales
   */
  validateCoherence(themeData) {
    // Vérifier que required_items <= nombre de collectibles
    if (themeData.theme && themeData.collectibles) {
      if (themeData.theme.required_items > themeData.collectibles.length) {
        this.errors.push(
          `required_items (${themeData.theme.required_items}) ne peut pas être supérieur ` +
          `au nombre de collectibles (${themeData.collectibles.length})`
        );
      }
    }

    // Vérifier distribution des raretés
    if (themeData.collectibles && themeData.collectibles.length > 0) {
      const rarityCount = {
        common: 0,
        rare: 0,
        epic: 0,
        legendary: 0
      };

      themeData.collectibles.forEach(c => {
        if (c.rarity) {
          rarityCount[c.rarity]++;
        }
      });

      // Warning si aucun collectible commun (mais pas une erreur)
      if (rarityCount.common === 0) {
        console.warn('Attention: Aucun collectible de rareté "common" - Les joueurs auront du mal à progresser');
      }
    }
  }

  /**
   * Valide un fichier JSON
   * @param {string} filePath - Chemin vers le fichier .theme.json
   * @returns {Object} Résultat de la validation
   */
  validateFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      return this.validate(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { valid: false, errors: [`Fichier non trouvé: ${filePath}`] };
      }
      if (error instanceof SyntaxError) {
        return { valid: false, errors: [`JSON invalide: ${error.message}`] };
      }
      return { valid: false, errors: [`Erreur: ${error.message}`] };
    }
  }

  /**
   * Liste tous les fichiers de thèmes disponibles v2.1
   * Inclut les compteurs pour tous les types de missions et frames
   * @returns {Array} Liste des fichiers avec leurs métadonnées
   */
  static listAvailableThemes() {
    const presetsDir = path.join(__dirname, '..', 'themes', 'presets');
    const themes = [];

    try {
      if (!fs.existsSync(presetsDir)) {
        return themes;
      }

      const files = fs.readdirSync(presetsDir);

      for (const file of files) {
        if (file.endsWith('.theme.json')) {
          const filePath = path.join(presetsDir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);

            // Compter les missions par type (v2.1)
            const missions = data.missions || {};
            const missionsCount = {
              keyword: missions.keyword?.length || 0,
              quiz: missions.quiz?.length || 0,
              'true-false': missions['true-false']?.length || 0,
              'emoji-puzzle': missions['emoji-puzzle']?.length || 0,
              wordle: missions.wordle?.length || 0,
              hangman: missions.hangman?.length || 0,
              unscramble: missions.unscramble?.length || 0
            };
            const totalMissions = Object.values(missionsCount).reduce((a, b) => a + b, 0);

            // Compter les questions par type de mission
            let totalQuestions = 0;
            for (const type of ['quiz', 'true-false', 'emoji-puzzle', 'wordle', 'hangman', 'unscramble']) {
              if (missions[type]) {
                for (const m of missions[type]) {
                  totalQuestions += m.questions?.length || 0;
                }
              }
            }

            // Compter les keywords
            let totalKeywords = 0;
            if (missions.keyword) {
              for (const m of missions.keyword) {
                totalKeywords += m.keywords?.length || 0;
              }
            }

            themes.push({
              file: file,
              path: filePath,
              version: data.version || '1.0.0',
              name: data.metadata?.name || data.theme?.name || 'Sans nom',
              description: data.metadata?.description || '',
              author: data.metadata?.author || 'Inconnu',
              tags: data.metadata?.tags || [],
              preview_image: data.metadata?.preview_image || null,
              collectibles_count: data.collectibles?.length || 0,
              traps_count: data.traps?.length || 0,
              // Missions v2.1 - détail par type
              missions_count: totalMissions,
              missions_by_type: missionsCount,
              questions_count: totalQuestions,
              keywords_count: totalKeywords,
              // Données v2.0
              daily_rewards_count: data.daily_rewards_config?.length || 0,
              mystery_box_config_count: data.mystery_box_config?.length || 0,
              progression_roles_count: data.progression_roles?.length || 0,
              super_bonuses_count: data.super_bonuses?.length || 0,
              has_daily_catchup: !!data.daily_catchup_config,
              has_announcement_templates: !!(data.announcement_templates?.length),
              announcement_templates_count: data.announcement_templates?.length || 0,
              // Frames v2.1
              profile_frames_count: data.theme_profile_frames?.length || 0,
              collectible_frames_count: data.theme_collectible_frames?.length || 0
            });
          } catch (err) {
            console.warn(`Impossible de lire ${file}: ${err.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de la lecture du dossier presets:', error);
    }

    return themes;
  }
}

module.exports = ThemeValidator;
