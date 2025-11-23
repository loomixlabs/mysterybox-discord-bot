const db = require('./database-pg');

/**
 * Configuration du branding Loomix (imposé à tous les serveurs)
 */
const LOOMIX_BRANDING = {
  logo: 'https://avatars.githubusercontent.com/u/241378179?s=400&u=fb81108da6b3639fae0f2a9335d01ca07bb0ddc5&v=4',
  suffix: 'Powered by Loomix Bot',
  discordInvite: 'https://discord.gg/CMfGeQ2Z',
  website: 'https://loomix.bot' // Optionnel - à configurer plus tard
};

/**
 * Génère un footer d'embed avec le branding Loomix imposé
 * @param {string} guildId - ID du serveur Discord
 * @param {string|null} customText - Texte personnalisé optionnel à ajouter avant le branding
 * @returns {Promise<Object>} Objet footer pour Discord.js { text, iconURL }
 */
async function getLoomixFooter(guildId, customText = null) {
  try {
    // Récupérer le branding du serveur
    const branding = await db.getGuildBranding(guildId);

    // Construire le texte du footer
    let footerText;

    if (customText) {
      // Combiner le texte personnalisé avec le branding Loomix
      footerText = `${customText} • ${LOOMIX_BRANDING.suffix}`;
    } else if (branding.embed_footer_text) {
      // Utiliser le texte du serveur s'il existe
      footerText = `${branding.embed_footer_text} • ${LOOMIX_BRANDING.suffix}`;
    } else {
      // Seulement le branding Loomix si pas de texte custom
      footerText = LOOMIX_BRANDING.suffix;
    }

    return {
      text: footerText,
      iconURL: LOOMIX_BRANDING.logo
    };
  } catch (error) {
    console.error('❌ Erreur lors de la génération du footer Loomix:', error);
    // Fallback en cas d'erreur
    return {
      text: LOOMIX_BRANDING.suffix,
      iconURL: LOOMIX_BRANDING.logo
    };
  }
}

/**
 * Génère un footer avec SEULEMENT le texte personnalisé (pas de branding du serveur)
 * Utile pour les footers dynamiques comme "Rareté: Légendaire"
 * @param {string} customText - Texte à afficher
 * @returns {Object} Objet footer pour Discord.js { text, iconURL }
 */
function getLoomixFooterWithCustomText(customText) {
  return {
    text: `${customText} • ${LOOMIX_BRANDING.suffix}`,
    iconURL: LOOMIX_BRANDING.logo
  };
}

/**
 * Génère un footer avec SEULEMENT le branding Loomix (sans texte serveur)
 * @returns {Object} Objet footer pour Discord.js { text, iconURL }
 */
function getLoomixFooterOnly() {
  return {
    text: LOOMIX_BRANDING.suffix,
    iconURL: LOOMIX_BRANDING.logo
  };
}

module.exports = {
  getLoomixFooter,
  getLoomixFooterWithCustomText,
  getLoomixFooterOnly,
  LOOMIX_BRANDING
};
