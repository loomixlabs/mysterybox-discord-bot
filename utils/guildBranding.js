/**
 * Classe helper pour gérer le branding d'une guild
 * Facilite l'accès aux paramètres de personnalisation
 */

const db = require('./database-pg');

class GuildBranding {
  constructor(guildId) {
    this.guildId = guildId;
    this.branding = null;
  }

  /**
   * Charger la configuration de branding
   */
  async load() {
    this.branding = await db.getGuildBranding(this.guildId);
    return this.branding;
  }

  /**
   * Récupérer une valeur de configuration
   */
  get(key, defaultValue = null) {
    return this.branding?.[key] ?? defaultValue;
  }

  /**
   * Mettre à jour une valeur de configuration
   */
  async set(key, value) {
    await db.updateGuildBranding(this.guildId, { [key]: value });
    this.branding[key] = value;
  }

  /**
   * Mettre à jour plusieurs valeurs de configuration
   */
  async update(updates) {
    await db.updateGuildBranding(this.guildId, updates);
    Object.assign(this.branding, updates);
  }

  // ==================== HELPERS POUR EMBEDS ====================

  /**
   * Récupérer la couleur principale pour les embeds
   */
  getEmbedColor() {
    return this.get('primary_color', '#3498db');
  }

  /**
   * Récupérer la couleur secondaire
   */
  getSecondaryColor() {
    return this.get('secondary_color', '#2ecc71');
  }

  /**
   * Récupérer le footer pour les embeds
   * @returns {Object} { text: string, iconURL?: string }
   */
  getEmbedFooter() {
    const footer = {
      text: this.get('embed_footer_text', 'MysteryBox by Loomix')
    };

    const iconURL = this.get('embed_footer_icon_url');
    if (iconURL) {
      footer.iconURL = iconURL;
    }

    return footer;
  }

  /**
   * Récupérer le nom affiché du bot
   */
  getBotDisplayName() {
    return this.get('bot_display_name', 'MysteryBox by Loomix');
  }

  /**
   * Récupérer la langue configurée
   */
  getLanguage() {
    return this.get('language', 'fr');
  }

  /**
   * Récupérer le fuseau horaire configuré
   */
  getTimezone() {
    return this.get('timezone', 'Europe/Paris');
  }

  /**
   * Récupérer les modules activés
   */
  getEnabledModules() {
    return this.get('modules_enabled', ['mysterybox']);
  }

  /**
   * Vérifier si un module est activé
   */
  isModuleEnabled(moduleName) {
    const modules = this.getEnabledModules();
    return modules.includes(moduleName);
  }
}

module.exports = GuildBranding;
