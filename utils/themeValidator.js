/**
 * Validateur de fichiers de thèmes (.theme.json)
 * Utilise le JSON Schema pour valider la structure des fichiers de configuration
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
   * Valide les missions
   */
  validateMissions(missions) {
    // Valider les missions keyword
    if (missions.keyword && Array.isArray(missions.keyword)) {
      missions.keyword.forEach((mission, index) => {
        const prefix = `missions.keyword[${index}]`;

        if (!mission.mission_id) {
          this.errors.push(`${prefix}.mission_id est requis`);
        }
        if (!mission.name) {
          this.errors.push(`${prefix}.name est requis`);
        }
        if (!mission.description) {
          this.errors.push(`${prefix}.description est requis`);
        }
        if (!mission.keywords || mission.keywords.length === 0) {
          this.errors.push(`${prefix}.keywords doit contenir au moins un mot-clé`);
        } else {
          mission.keywords.forEach((kw, kwIndex) => {
            if (!kw.keyword) {
              this.errors.push(`${prefix}.keywords[${kwIndex}].keyword est requis`);
            }
          });
        }
      });
    }

    // Valider les missions quiz
    if (missions.quiz && Array.isArray(missions.quiz)) {
      missions.quiz.forEach((mission, index) => {
        const prefix = `missions.quiz[${index}]`;

        if (!mission.mission_id) {
          this.errors.push(`${prefix}.mission_id est requis`);
        }
        if (!mission.name) {
          this.errors.push(`${prefix}.name est requis`);
        }
        if (!mission.description) {
          this.errors.push(`${prefix}.description est requis`);
        }
        if (!mission.questions || mission.questions.length === 0) {
          this.errors.push(`${prefix}.questions doit contenir au moins une question`);
        } else {
          mission.questions.forEach((q, qIndex) => {
            if (!q.question_text) {
              this.errors.push(`${prefix}.questions[${qIndex}].question_text est requis`);
            }
            if (!q.correct_answer) {
              this.errors.push(`${prefix}.questions[${qIndex}].correct_answer est requis`);
            }
          });
        }
      });
    }
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
   * Liste tous les fichiers de thèmes disponibles
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

            themes.push({
              file: file,
              path: filePath,
              name: data.metadata?.name || data.theme?.name || 'Sans nom',
              description: data.metadata?.description || '',
              author: data.metadata?.author || 'Inconnu',
              tags: data.metadata?.tags || [],
              preview_image: data.metadata?.preview_image || null,
              collectibles_count: data.collectibles?.length || 0,
              missions_count: (data.missions?.keyword?.length || 0) + (data.missions?.quiz?.length || 0),
              traps_count: data.traps?.length || 0
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
