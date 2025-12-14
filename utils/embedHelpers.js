/**
 * Helpers pour les embeds Discord
 * Gère les cas où les URLs peuvent être vides ou invalides
 */

/**
 * Valide si une URL est utilisable pour Discord (non vide, non null)
 * @param {string|null|undefined} url - L'URL à valider
 * @returns {boolean} - true si l'URL est valide
 */
function isValidUrl(url) {
  return url && typeof url === 'string' && url.trim().length > 0;
}

/**
 * Applique setThumbnail sur un embed uniquement si l'URL est valide
 * @param {EmbedBuilder} embed - L'embed Discord
 * @param {string|null|undefined} url - L'URL de la thumbnail
 * @returns {EmbedBuilder} - L'embed (pour chaînage)
 */
function safeSetThumbnail(embed, url) {
  if (isValidUrl(url)) {
    embed.setThumbnail(url);
  }
  return embed;
}

/**
 * Applique setImage sur un embed uniquement si l'URL est valide
 * @param {EmbedBuilder} embed - L'embed Discord
 * @param {string|null|undefined} url - L'URL de l'image
 * @returns {EmbedBuilder} - L'embed (pour chaînage)
 */
function safeSetImage(embed, url) {
  if (isValidUrl(url)) {
    embed.setImage(url);
  }
  return embed;
}

module.exports = {
  isValidUrl,
  safeSetThumbnail,
  safeSetImage
};
