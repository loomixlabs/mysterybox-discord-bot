/**
 * Image Generator - Système de génération d'images avec frames
 *
 * Ce module gère:
 * - Superposition de frames sur les collectibles (par rareté)
 * - Superposition de frames sur les avatars de profil
 * - Cache local pour éviter les régénérations
 * - Téléchargement et validation des images
 *
 * Utilise Sharp pour le traitement d'images haute performance
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./database-pg');

// Configuration
const CONFIG = {
  // Dimensions des images générées
  collectible: {
    width: 256,
    height: 256
  },
  avatar: {
    width: 128,
    height: 128
  },
  // Cache
  cacheDir: path.join(__dirname, '../temp_images/cache'),
  cacheTTL: 24 * 60 * 60 * 1000, // 24 heures en ms
  // Timeouts
  fetchTimeout: 10000, // 10 secondes
  // Frames par défaut intégrées (couleurs si pas d'image)
  defaultFrameColors: {
    rare: '#3498DB',      // Bleu
    epic: '#9B59B6',      // Violet
    legendary: '#F1C40F'  // Doré
  },
  // Épaisseur de bordure par défaut (si pas de frame image)
  defaultBorderWidth: 8
};

// Créer le dossier cache s'il n'existe pas
if (!fs.existsSync(CONFIG.cacheDir)) {
  fs.mkdirSync(CONFIG.cacheDir, { recursive: true });
}

/**
 * Génère une clé de cache unique basée sur les paramètres
 */
function generateCacheKey(type, ...params) {
  const hash = crypto.createHash('md5')
    .update(`${type}_${params.join('_')}`)
    .digest('hex');
  return `${type}_${hash}`;
}

/**
 * Vérifie si une image est en cache et valide
 */
function getCachedImage(cacheKey) {
  const cachePath = path.join(CONFIG.cacheDir, `${cacheKey}.png`);

  if (fs.existsSync(cachePath)) {
    const stats = fs.statSync(cachePath);
    const age = Date.now() - stats.mtimeMs;

    if (age < CONFIG.cacheTTL) {
      return fs.readFileSync(cachePath);
    } else {
      // Cache expiré, supprimer
      fs.unlinkSync(cachePath);
    }
  }

  return null;
}

/**
 * Sauvegarde une image dans le cache
 */
function cacheImage(cacheKey, buffer) {
  const cachePath = path.join(CONFIG.cacheDir, `${cacheKey}.png`);
  fs.writeFileSync(cachePath, buffer);
  return cachePath;
}

// Référence au client Discord (sera définie par setDiscordClient)
let discordClient = null;

/**
 * Définit le client Discord pour permettre le rafraîchissement des URLs
 * @param {Client} client - Instance du client Discord.js
 */
function setDiscordClient(client) {
  discordClient = client;
  console.log('🖼️ [ImageGenerator] Client Discord configuré pour rafraîchissement URLs');
}

/**
 * Extrait les IDs channel et message d'une URL Discord CDN
 * @param {string} url - URL Discord CDN
 * @returns {Object|null} { channelId, messageId, filename } ou null
 */
function parseDiscordCdnUrl(url) {
  // Format: https://cdn.discordapp.com/attachments/CHANNEL_ID/MESSAGE_ID/filename.ext?...
  const match = url.match(/cdn\.discordapp\.com\/attachments\/(\d+)\/(\d+)\/([^?]+)/);
  if (match) {
    return {
      channelId: match[1],
      messageId: match[2],
      filename: match[3]
    };
  }
  return null;
}

/**
 * Rafraîchit une URL Discord expirée en récupérant le message original
 * @param {string} url - URL Discord expirée
 * @returns {Promise<string|null>} Nouvelle URL ou null si échec
 */
async function refreshDiscordUrl(url) {
  if (!discordClient) {
    console.log('⚠️ [ImageGenerator] Client Discord non configuré, impossible de rafraîchir l\'URL');
    return null;
  }

  const parsed = parseDiscordCdnUrl(url);
  if (!parsed) {
    return null;
  }

  try {
    const channel = await discordClient.channels.fetch(parsed.channelId);
    if (!channel) {
      console.log(`⚠️ [ImageGenerator] Channel ${parsed.channelId} non trouvé`);
      return null;
    }

    const message = await channel.messages.fetch(parsed.messageId);
    if (!message) {
      console.log(`⚠️ [ImageGenerator] Message ${parsed.messageId} non trouvé`);
      return null;
    }

    // Chercher l'attachment correspondant
    const attachment = message.attachments.find(a => a.name === parsed.filename || a.url.includes(parsed.filename));
    if (attachment) {
      console.log(`✅ [ImageGenerator] URL rafraîchie: ${parsed.filename}`);
      return attachment.url;
    }

    // Sinon prendre le premier attachment
    if (message.attachments.size > 0) {
      const firstAttachment = message.attachments.first();
      console.log(`✅ [ImageGenerator] URL rafraîchie (premier attachment): ${firstAttachment.name}`);
      return firstAttachment.url;
    }

    return null;
  } catch (error) {
    console.log(`⚠️ [ImageGenerator] Erreur rafraîchissement URL: ${error.message}`);
    return null;
  }
}

/**
 * Télécharge une image depuis une URL
 * @param {string} url - URL de l'image
 * @param {boolean} allowRefresh - Tenter de rafraîchir les URLs Discord expirées
 * @returns {Promise<Buffer>} Buffer de l'image
 */
async function fetchImage(url, allowRefresh = true) {
  try {
    // Vérifier si c'est un fichier local
    if (url.startsWith('/') || url.startsWith('./') || url.match(/^[A-Z]:\\/i)) {
      if (fs.existsSync(url)) {
        return fs.readFileSync(url);
      }
      throw new Error(`Fichier local non trouvé: ${url}`);
    }

    // Télécharger depuis URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.fetchTimeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'DiscordBot/2.0'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      // Si 404 sur une URL Discord, tenter de la rafraîchir
      if (response.status === 404 && allowRefresh && url.includes('cdn.discordapp.com')) {
        console.log('🔄 [ImageGenerator] URL Discord expirée, tentative de rafraîchissement...');
        const refreshedUrl = await refreshDiscordUrl(url);
        if (refreshedUrl) {
          // Réessayer avec la nouvelle URL (sans permettre un nouveau refresh pour éviter boucle infinie)
          return fetchImage(refreshedUrl, false);
        }
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout: Image non téléchargée en ${CONFIG.fetchTimeout}ms`);
    }
    throw error;
  }
}

/**
 * Génère une image de collectible avec sa frame superposée
 *
 * @param {string} collectibleUrl - URL de l'image du collectible
 * @param {string|null} frameUrl - URL de la frame (null = utiliser bordure par défaut)
 * @param {string} rarity - Rareté du collectible (rare, epic, legendary)
 * @param {Object} options - Options supplémentaires
 * @param {number} options.level - Niveau du collectible (1-4) pour overlay étoiles
 * @param {number} options.mintNumber - Numéro de mint pour affichage
 * @param {boolean} options.useCache - Utiliser le cache (défaut: true)
 * @returns {Promise<Buffer>} Buffer PNG de l'image composée
 */
async function generateCollectibleWithFrame(collectibleUrl, frameUrl, rarity, options = {}) {
  const { level = 1, mintNumber = null, useCache = true } = options;

  // Vérifier le cache
  const cacheKey = generateCacheKey('collectible', collectibleUrl, frameUrl, rarity, level, mintNumber);
  if (useCache) {
    const cached = getCachedImage(cacheKey);
    if (cached) {
      console.log(`🖼️ Cache hit: ${cacheKey.substring(0, 20)}...`);
      return cached;
    }
  }

  try {
    // 1. Télécharger l'image du collectible
    const collectibleBuffer = await fetchImage(collectibleUrl);

    // 2. Redimensionner le collectible
    let baseImage = sharp(collectibleBuffer)
      .resize(CONFIG.collectible.width, CONFIG.collectible.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      });

    // 3. Ajouter la frame
    let compositeOperations = [];

    if (frameUrl) {
      // Frame personnalisée
      try {
        const frameBuffer = await fetchImage(frameUrl);
        const frameResized = await sharp(frameBuffer)
          .resize(CONFIG.collectible.width, CONFIG.collectible.height, {
            fit: 'cover'
          })
          .toBuffer();

        compositeOperations.push({
          input: frameResized,
          blend: 'over'
        });
      } catch (frameError) {
        console.warn(`⚠️ Frame non chargée, utilisation bordure par défaut: ${frameError.message}`);
        // Fallback: bordure colorée
        baseImage = await addColoredBorder(baseImage, rarity);
      }
    } else if (rarity && rarity !== 'common') {
      // Pas de frame URL mais rareté non-commune: bordure colorée
      baseImage = await addColoredBorder(baseImage, rarity);
    }

    // 4. Ajouter indicateur de niveau (étoiles)
    if (level > 1) {
      const levelOverlay = await generateLevelOverlay(level);
      compositeOperations.push({
        input: levelOverlay,
        gravity: 'southwest',
        blend: 'over'
      });
    }

    // 5. Ajouter numéro de mint
    if (mintNumber !== null && mintNumber <= 100) {
      const mintOverlay = await generateMintOverlay(mintNumber);
      compositeOperations.push({
        input: mintOverlay,
        gravity: 'northeast',
        blend: 'over'
      });
    }

    // 6. Composer l'image finale
    let finalImage = baseImage;
    if (compositeOperations.length > 0) {
      finalImage = baseImage.composite(compositeOperations);
    }

    const resultBuffer = await finalImage.png().toBuffer();

    // 7. Mettre en cache
    if (useCache) {
      cacheImage(cacheKey, resultBuffer);
    }

    return resultBuffer;

  } catch (error) {
    console.error(`🔴 Erreur génération image collectible:`, error);
    throw error;
  }
}

/**
 * Ajoute une bordure colorée selon la rareté
 */
async function addColoredBorder(sharpInstance, rarity) {
  const color = CONFIG.defaultFrameColors[rarity] || '#FFFFFF';
  const borderWidth = CONFIG.defaultBorderWidth;

  // Créer une bordure avec extend
  return sharpInstance
    .extend({
      top: borderWidth,
      bottom: borderWidth,
      left: borderWidth,
      right: borderWidth,
      background: color
    })
    .resize(CONFIG.collectible.width, CONFIG.collectible.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    });
}

/**
 * Génère l'overlay des étoiles de niveau
 */
async function generateLevelOverlay(level) {
  const stars = '★'.repeat(level);
  const width = 80;
  const height = 24;

  // Créer un SVG avec les étoiles
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="4" fill="rgba(0,0,0,0.7)"/>
      <text x="${width/2}" y="${height/2 + 5}" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#FFD700" text-anchor="middle">${stars}</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Génère l'overlay du numéro de mint
 */
async function generateMintOverlay(mintNumber) {
  const text = `#${mintNumber}`;
  const width = 50;
  const height = 20;

  // Couleur selon la rareté du numéro
  let bgColor = 'rgba(0,0,0,0.7)';
  let textColor = '#FFFFFF';

  if (mintNumber === 1) {
    bgColor = 'rgba(241,196,15,0.9)'; // Or pour #1
    textColor = '#000000';
  } else if (mintNumber <= 10) {
    bgColor = 'rgba(155,89,182,0.9)'; // Violet pour top 10
  } else if (mintNumber <= 50) {
    bgColor = 'rgba(52,152,219,0.9)'; // Bleu pour top 50
  }

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="4" fill="${bgColor}"/>
      <text x="${width/2}" y="${height/2 + 4}" font-family="DejaVu Sans, Arial, sans-serif" font-size="11" font-weight="bold" fill="${textColor}" text-anchor="middle">${text}</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Génère une image de profil avec frame superposée
 *
 * @param {string} avatarUrl - URL de l'avatar Discord
 * @param {string|null} frameUrl - URL de la frame de profil
 * @param {Object} options - Options supplémentaires
 * @param {boolean} options.useCache - Utiliser le cache (défaut: true)
 * @returns {Promise<Buffer>} Buffer PNG de l'image composée
 */
async function generateProfileWithFrame(avatarUrl, frameUrl, options = {}) {
  const { useCache = true } = options;

  // Vérifier le cache
  const cacheKey = generateCacheKey('profile', avatarUrl, frameUrl);
  if (useCache) {
    const cached = getCachedImage(cacheKey);
    if (cached) {
      console.log(`🖼️ Cache hit profile: ${cacheKey.substring(0, 20)}...`);
      return cached;
    }
  }

  try {
    // 1. Télécharger l'avatar
    const avatarBuffer = await fetchImage(avatarUrl);

    // 2. Redimensionner et arrondir l'avatar
    const avatarSize = CONFIG.avatar.width - 16; // Laisser de la place pour la frame
    const roundedAvatar = await sharp(avatarBuffer)
      .resize(avatarSize, avatarSize, { fit: 'cover' })
      .composite([{
        input: Buffer.from(`
          <svg width="${avatarSize}" height="${avatarSize}">
            <circle cx="${avatarSize/2}" cy="${avatarSize/2}" r="${avatarSize/2}" fill="white"/>
          </svg>
        `),
        blend: 'dest-in'
      }])
      .toBuffer();

    // 3. Créer le canvas de base
    let baseCanvas = sharp({
      create: {
        width: CONFIG.avatar.width,
        height: CONFIG.avatar.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    const compositeOperations = [];

    // 4. Ajouter l'avatar centré
    compositeOperations.push({
      input: roundedAvatar,
      left: 8,
      top: 8
    });

    // 5. Ajouter la frame si disponible
    if (frameUrl) {
      try {
        const frameBuffer = await fetchImage(frameUrl);
        const frameResized = await sharp(frameBuffer)
          .resize(CONFIG.avatar.width, CONFIG.avatar.height, { fit: 'contain' })
          .toBuffer();

        compositeOperations.push({
          input: frameResized,
          blend: 'over'
        });
      } catch (frameError) {
        console.warn(`⚠️ Frame profil non chargée: ${frameError.message}`);
      }
    }

    // 6. Composer l'image finale
    const resultBuffer = await baseCanvas
      .composite(compositeOperations)
      .png()
      .toBuffer();

    // 7. Mettre en cache
    if (useCache) {
      cacheImage(cacheKey, resultBuffer);
    }

    return resultBuffer;

  } catch (error) {
    console.error(`🔴 Erreur génération image profil:`, error);
    throw error;
  }
}

/**
 * Génère une image de fusion (niveau up)
 * Montre l'ancien et le nouveau niveau côte à côte avec flèche
 *
 * @param {string} collectibleUrl - URL de l'image du collectible
 * @param {Object} options - Options de génération
 * @param {string|null} options.oldFrameUrl - URL de la frame pour l'ancien niveau
 * @param {string|null} options.newFrameUrl - URL de la frame pour le nouveau niveau
 * @param {string} options.oldRarity - Rareté de frame pour l'ancien niveau (pour fallback)
 * @param {string} options.newRarity - Rareté de frame pour le nouveau niveau (pour fallback)
 * @param {number} options.oldLevel - Ancien niveau
 * @param {number} options.newLevel - Nouveau niveau
 * @returns {Promise<Buffer>} Buffer PNG
 */
async function generateLevelUpImage(collectibleUrl, options = {}) {
  const {
    oldFrameUrl = null,
    newFrameUrl = null,
    oldRarity = null,
    newRarity = null,
    oldLevel = 1,
    newLevel = 2,
    mintNumber = null  // Ajout du mint number
  } = options;

  const singleWidth = 200;
  const singleHeight = 200;
  const arrowWidth = 60;
  const totalWidth = singleWidth * 2 + arrowWidth;
  const totalHeight = singleHeight + 40; // Espace pour texte

  try {
    // Générer les deux images du collectible avec leurs frames respectives
    // Le mintNumber est passé pour s'afficher sur les deux images
    const [oldImage, newImage] = await Promise.all([
      generateCollectibleWithFrame(collectibleUrl, oldFrameUrl, oldRarity, { level: oldLevel, mintNumber, useCache: false }),
      generateCollectibleWithFrame(collectibleUrl, newFrameUrl, newRarity, { level: newLevel, mintNumber, useCache: false })
    ]);

    // Redimensionner
    const oldResized = await sharp(oldImage).resize(singleWidth, singleHeight).toBuffer();
    const newResized = await sharp(newImage).resize(singleWidth, singleHeight).toBuffer();

    // Créer la flèche
    const arrowSvg = `
      <svg width="${arrowWidth}" height="${singleHeight}" xmlns="http://www.w3.org/2000/svg">
        <text x="${arrowWidth/2}" y="${singleHeight/2}" font-family="Arial" font-size="40" fill="#FFD700" text-anchor="middle">→</text>
      </svg>
    `;
    const arrowBuffer = await sharp(Buffer.from(arrowSvg)).png().toBuffer();

    // Créer le texte "LEVEL UP!"
    const textSvg = `
      <svg width="${totalWidth}" height="40" xmlns="http://www.w3.org/2000/svg">
        <text x="${totalWidth/2}" y="30" font-family="Arial" font-size="24" font-weight="bold" fill="#FFD700" text-anchor="middle">✨ LEVEL UP! ✨</text>
      </svg>
    `;
    const textBuffer = await sharp(Buffer.from(textSvg)).png().toBuffer();

    // Composer l'image finale
    const result = await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 32, g: 34, b: 37, alpha: 255 } // Couleur Discord dark
      }
    })
    .composite([
      { input: oldResized, left: 0, top: 40 },
      { input: arrowBuffer, left: singleWidth, top: 40 },
      { input: newResized, left: singleWidth + arrowWidth, top: 40 },
      { input: textBuffer, left: 0, top: 0 }
    ])
    .png()
    .toBuffer();

    return result;

  } catch (error) {
    console.error(`🔴 Erreur génération image level up:`, error);
    throw error;
  }
}

/**
 * Nettoie le cache des images expirées
 */
function cleanCache() {
  if (!fs.existsSync(CONFIG.cacheDir)) return;

  const files = fs.readdirSync(CONFIG.cacheDir);
  let cleaned = 0;

  for (const file of files) {
    const filePath = path.join(CONFIG.cacheDir, file);
    const stats = fs.statSync(filePath);
    const age = Date.now() - stats.mtimeMs;

    if (age > CONFIG.cacheTTL) {
      fs.unlinkSync(filePath);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cache nettoyé: ${cleaned} fichier(s) supprimé(s)`);
  }

  return cleaned;
}

/**
 * Retourne les statistiques du cache
 */
function getCacheStats() {
  if (!fs.existsSync(CONFIG.cacheDir)) {
    return { files: 0, size: 0, oldestAge: 0 };
  }

  const files = fs.readdirSync(CONFIG.cacheDir);
  let totalSize = 0;
  let oldestAge = 0;

  for (const file of files) {
    const filePath = path.join(CONFIG.cacheDir, file);
    const stats = fs.statSync(filePath);
    totalSize += stats.size;
    const age = Date.now() - stats.mtimeMs;
    if (age > oldestAge) oldestAge = age;
  }

  return {
    files: files.length,
    size: Math.round(totalSize / 1024), // KB
    oldestAge: Math.round(oldestAge / 1000 / 60) // minutes
  };
}

/**
 * 🎴 Génère une carte "FLEX" moderne et impressionnante
 * Affiche: Avatar avec frame, 3 favoris, stats, rang, progression
 *
 * @param {Object} options - Options de génération
 * @param {string} options.guildId - ID du serveur (pour récupérer les frames)
 * @param {string} options.username - Nom du joueur
 * @param {string} options.avatarUrl - URL de l'avatar
 * @param {string|null} options.frameUrl - URL de la frame de profil
 * @param {Object[]} options.favorites - 3 collectibles favoris [{name, rarity, imageUrl, level, mintNumber, themeId}]
 * @param {Object} options.stats - Statistiques {rank, totalPlayers, collected, total, percentage, legendaryCount}
 * @param {string} options.themeName - Nom du thème actif
 * @param {string} options.themeColor - Couleur du thème (hex)
 * @param {Object} options.badges - Badges à afficher
 * @param {boolean} options.isCompleted - Collection complète ?
 * @returns {Promise<Buffer>} Buffer PNG de la carte
 */
async function generateFlexCard(options) {
  const {
    guildId,
    username,
    avatarUrl,
    frameUrl = null,
    favorites = [],
    stats = {},
    themeName = 'Thème',
    themeColor = '#5865F2',
    badges = [],
    isCompleted = false
  } = options;

  // Dimensions de la carte (format vertical moderne)
  const cardWidth = 600;
  const cardHeight = 800;

  // Convertir la couleur hex en RGB pour les gradients
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 88, g: 101, b: 242 };
  };

  const rgb = hexToRgb(themeColor);
  const glowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
  const accentColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const lighterAccent = `rgb(${Math.min(255, rgb.r + 60)}, ${Math.min(255, rgb.g + 60)}, ${Math.min(255, rgb.b + 60)})`;

  // Générer la progression bar SVG
  const progressPercentage = stats.percentage || 0;
  const progressWidth = 500;
  const progressFilled = Math.round((progressPercentage / 100) * progressWidth);

  // Symboles de rank (sans emojis pour éviter problèmes SVG)
  const getRankSymbol = (rank) => {
    if (rank === 1) return { symbol: '#1', color: '#FFD700' };
    if (rank === 2) return { symbol: '#2', color: '#C0C0C0' };
    if (rank === 3) return { symbol: '#3', color: '#CD7F32' };
    if (rank <= 10) return { symbol: `#${rank}`, color: '#00FFCC' };
    return { symbol: `#${rank}`, color: '#FFFFFF' };
  };

  const rankInfo = getRankSymbol(stats.rank || 999);

  // SVG de la carte MODERNE avec FOND SOMBRE et effets couleur thème
  const cardSvg = `
    <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Fond sombre avec subtil gradient -->
        <linearGradient id="darkBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0d0d1a;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#1a1a2e;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0d0d1a;stop-opacity:1" />
        </linearGradient>

        <!-- Gradient de couleur thème pour accents -->
        <linearGradient id="themeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${accentColor};stop-opacity:1" />
          <stop offset="50%" style="stop-color:${lighterAccent};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${accentColor};stop-opacity:1" />
        </linearGradient>

        <!-- Gradient vertical pour bordure -->
        <linearGradient id="borderGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${lighterAccent};stop-opacity:0.8" />
          <stop offset="50%" style="stop-color:${accentColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${lighterAccent};stop-opacity:0.8" />
        </linearGradient>

        <!-- Gradient pour la barre de progression -->
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${accentColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${lighterAccent};stop-opacity:1" />
        </linearGradient>

        <!-- Glow effect couleur thème -->
        <filter id="themeGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feFlood flood-color="${accentColor}" flood-opacity="0.5"/>
          <feComposite in2="coloredBlur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <!-- Glow blanc pour texte -->
        <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <!-- Shadow effect -->
        <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="rgba(0,0,0,0.8)"/>
        </filter>

        <!-- Pattern hexagonal subtil -->
        <pattern id="hexPattern" patternUnits="userSpaceOnUse" width="30" height="52" patternTransform="scale(1.5)">
          <polygon points="15,0 30,8.66 30,26 15,34.64 0,26 0,8.66" fill="none" stroke="rgba(${rgb.r},${rgb.g},${rgb.b},0.05)" stroke-width="1"/>
          <polygon points="15,17.32 30,26 30,43.3 15,52 0,43.3 0,26" fill="none" stroke="rgba(${rgb.r},${rgb.g},${rgb.b},0.05)" stroke-width="1"/>
        </pattern>

        <!-- Clip pour coins arrondis -->
        <clipPath id="cardClip">
          <rect width="${cardWidth}" height="${cardHeight}" rx="20"/>
        </clipPath>
      </defs>

      <!-- Fond sombre principal -->
      <rect width="${cardWidth}" height="${cardHeight}" rx="20" fill="url(#darkBg)"/>

      <!-- Pattern overlay subtil -->
      <rect width="${cardWidth}" height="${cardHeight}" rx="20" fill="url(#hexPattern)"/>

      <!-- Ligne lumineuse en haut -->
      <rect x="50" y="0" width="${cardWidth - 100}" height="3" fill="url(#themeGradient)" opacity="0.8"/>

      <!-- Bordure externe lumineuse -->
      <rect x="2" y="2" width="${cardWidth - 4}" height="${cardHeight - 4}" rx="18"
            fill="none" stroke="url(#borderGradient)" stroke-width="2" opacity="0.7"/>

      <!-- Effet de lueur sur les coins -->
      <circle cx="20" cy="20" r="60" fill="${glowColor}" opacity="0.15"/>
      <circle cx="${cardWidth - 20}" cy="20" r="60" fill="${glowColor}" opacity="0.15"/>
      <circle cx="20" cy="${cardHeight - 20}" r="60" fill="${glowColor}" opacity="0.1"/>
      <circle cx="${cardWidth - 20}" cy="${cardHeight - 20}" r="60" fill="${glowColor}" opacity="0.1"/>

      <!-- Header avec nom -->
      <rect x="30" y="25" width="${cardWidth - 60}" height="55" rx="12" fill="rgba(0,0,0,0.5)" stroke="${accentColor}" stroke-width="1" opacity="0.8"/>
      <text x="${cardWidth / 2}" y="62" font-family="Arial, sans-serif" font-size="26" font-weight="bold"
            fill="white" text-anchor="middle" filter="url(#textGlow)">${escapeXml(username)}</text>

      <!-- Badge FLEX stylisé -->
      <rect x="${cardWidth / 2 - 35}" y="85" width="70" height="24" rx="12" fill="${accentColor}" opacity="0.9"/>
      <text x="${cardWidth / 2}" y="102" font-family="Arial, sans-serif" font-size="12" font-weight="bold"
            fill="white" text-anchor="middle">FLEX</text>

      <!-- Thème actif -->
      <text x="${cardWidth / 2}" y="130" font-family="Arial, sans-serif" font-size="14"
            fill="${lighterAccent}" text-anchor="middle">${escapeXml(themeName)}</text>

      <!-- Zone avatar avec bordure lumineuse -->
      <circle cx="${cardWidth / 2}" cy="220" r="78" fill="rgba(0,0,0,0.4)"/>
      <circle cx="${cardWidth / 2}" cy="220" r="80" fill="none" stroke="url(#themeGradient)" stroke-width="3" filter="url(#themeGlow)"/>

      <!-- Section STATS avec design moderne -->
      <!-- RANG -->
      <rect x="25" y="325" width="170" height="85" rx="12" fill="rgba(0,0,0,0.5)" stroke="${accentColor}" stroke-width="1" stroke-opacity="0.5"/>
      <text x="110" y="352" font-family="Arial, sans-serif" font-size="11" fill="rgba(255,255,255,0.6)" text-anchor="middle" letter-spacing="2">CLASSEMENT</text>
      <text x="110" y="390" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="${rankInfo.color}" text-anchor="middle" filter="url(#textGlow)">
        ${rankInfo.symbol}
      </text>

      <!-- COLLECTIBLES -->
      <rect x="215" y="325" width="170" height="85" rx="12" fill="rgba(0,0,0,0.5)" stroke="${accentColor}" stroke-width="1" stroke-opacity="0.5"/>
      <text x="300" y="352" font-family="Arial, sans-serif" font-size="11" fill="rgba(255,255,255,0.6)" text-anchor="middle" letter-spacing="2">COLLECTION</text>
      <text x="300" y="390" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">
        ${stats.collected || 0}<tspan fill="rgba(255,255,255,0.5)" font-size="18">/${stats.total || 0}</tspan>
      </text>

      <!-- LEGENDAIRES -->
      <rect x="405" y="325" width="170" height="85" rx="12" fill="rgba(0,0,0,0.5)" stroke="#FFD700" stroke-width="1" stroke-opacity="0.5"/>
      <text x="490" y="352" font-family="Arial, sans-serif" font-size="11" fill="rgba(255,215,0,0.7)" text-anchor="middle" letter-spacing="2">LEGENDAIRES</text>
      <text x="490" y="390" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#FFD700" text-anchor="middle" filter="url(#textGlow)">
        ${stats.legendaryCount || 0}
      </text>

      <!-- Barre de progression moderne -->
      <rect x="50" y="430" width="${progressWidth}" height="20" rx="10" fill="rgba(0,0,0,0.6)"/>
      <rect x="50" y="430" width="${progressWidth}" height="20" rx="10" fill="none" stroke="${accentColor}" stroke-width="1" stroke-opacity="0.3"/>
      <rect x="50" y="430" width="${progressFilled}" height="20" rx="10" fill="url(#progressGradient)"/>
      <text x="${cardWidth / 2}" y="445" font-family="Arial, sans-serif" font-size="12" font-weight="bold"
            fill="white" text-anchor="middle">${progressPercentage}%${isCompleted ? ' COMPLETE' : ''}</text>

      <!-- Section FAVORIS -->
      <text x="${cardWidth / 2}" y="480" font-family="Arial, sans-serif" font-size="14" font-weight="bold"
            fill="${lighterAccent}" text-anchor="middle" letter-spacing="3">MES FAVORIS</text>

      <!-- Ligne décorative sous titre -->
      <line x1="200" y1="490" x2="400" y2="490" stroke="url(#themeGradient)" stroke-width="2" opacity="0.6"/>

      <!-- Cadres favoris avec glow - hauteur réduite pour laisser place aux noms -->
      <!-- 2eme (gauche) -->
      <rect x="35" y="505" width="155" height="150" rx="12" fill="rgba(0,0,0,0.5)"/>
      <rect x="35" y="505" width="155" height="150" rx="12" fill="none" stroke="${accentColor}" stroke-width="2" stroke-opacity="0.4"/>

      <!-- 1er (centre - plus grand, plus lumineux) - CENTRÉ correctement -->
      <rect x="215" y="500" width="170" height="165" rx="14" fill="rgba(0,0,0,0.5)"/>
      <rect x="215" y="500" width="170" height="165" rx="14" fill="none" stroke="url(#themeGradient)" stroke-width="3" filter="url(#themeGlow)"/>

      <!-- 3eme (droite) -->
      <rect x="410" y="505" width="155" height="150" rx="12" fill="rgba(0,0,0,0.5)"/>
      <rect x="410" y="505" width="155" height="150" rx="12" fill="none" stroke="${accentColor}" stroke-width="2" stroke-opacity="0.4"/>

      <!-- Footer avec branding -->
      <rect x="100" y="${cardHeight - 50}" width="${cardWidth - 200}" height="35" rx="8" fill="rgba(0,0,0,0.4)"/>
      <text x="${cardWidth / 2}" y="${cardHeight - 27}" font-family="Arial, sans-serif" font-size="12"
            fill="rgba(255,255,255,0.6)" text-anchor="middle">Powered by Loomix</text>

      <!-- Ligne lumineuse en bas -->
      <rect x="50" y="${cardHeight - 3}" width="${cardWidth - 100}" height="3" fill="url(#themeGradient)" opacity="0.6"/>
    </svg>
  `;

  try {
    // 1. Créer la carte de base à partir du SVG
    let cardBuffer = await sharp(Buffer.from(cardSvg)).png().toBuffer();

    // 2. Préparer les opérations de composition
    const compositeOperations = [];

    // 3. Ajouter l'avatar avec frame au centre
    try {
      let avatarImage;
      if (frameUrl) {
        avatarImage = await generateProfileWithFrame(avatarUrl, frameUrl, { useCache: true });
      } else {
        // Avatar simple arrondi
        const avatarBuffer = await fetchImage(avatarUrl);
        avatarImage = await sharp(avatarBuffer)
          .resize(150, 150, { fit: 'cover' })
          .composite([{
            input: Buffer.from(`
              <svg width="150" height="150">
                <circle cx="75" cy="75" r="75" fill="white"/>
              </svg>
            `),
            blend: 'dest-in'
          }])
          .png()
          .toBuffer();
      }

      // Redimensionner à la bonne taille pour la carte
      const avatarResized = await sharp(avatarImage)
        .resize(150, 150, { fit: 'contain' })
        .png()
        .toBuffer();

      compositeOperations.push({
        input: avatarResized,
        left: Math.round(cardWidth / 2 - 75),
        top: 145
      });
    } catch (avatarError) {
      console.warn('⚠️ Erreur avatar flex:', avatarError.message);
    }

    // 4. Ajouter les 3 favoris avec leurs frames (positions ajustées pour nouveau design)
    // Positions: image plus petite pour laisser de l'espace au nom en dessous
    const favoritePositions = [
      { x: 52, y: 520, width: 120, height: 120, position: 2, boxX: 35, boxWidth: 155 },   // 2ème (gauche)
      { x: 230, y: 515, width: 140, height: 140, position: 1, boxX: 215, boxWidth: 170 },  // 1er (centre, plus grand) - CENTRÉ
      { x: 428, y: 520, width: 120, height: 120, position: 3, boxX: 410, boxWidth: 155 }   // 3ème (droite)
    ];

    // Trier les favoris par position
    const sortedFavorites = [...favorites].sort((a, b) => (a.position || 0) - (b.position || 0));

    for (let i = 0; i < 3; i++) {
      const pos = favoritePositions[i];
      const fav = sortedFavorites.find(f => f.position === pos.position) || sortedFavorites[i];

      if (fav && fav.imageUrl) {
        try {
          // Générer l'image du collectible avec sa frame selon le niveau
          const level = fav.level || 1;

          // TOUJOURS générer avec frame si niveau > 1
          let collectibleImage;
          if (level > 1) {
            // Utiliser la frame correspondant au niveau - récupérer depuis le thème
            const frameRarity = LEVEL_TO_FRAME_RARITY[level] || null;

            // Récupérer l'URL de la frame du thème (comme dans l'inventaire)
            let collectibleFrameUrl = null;
            if (guildId && fav.themeId && frameRarity) {
              collectibleFrameUrl = await db.getCollectibleFrameUrl(guildId, fav.themeId, frameRarity);
            }

            collectibleImage = await generateCollectibleWithFrame(
              fav.imageUrl,
              collectibleFrameUrl,  // Frame du thème ou fallback
              frameRarity,
              { level, mintNumber: fav.mintNumber, useCache: true }
            );
          } else {
            // Niveau 1 : image simple sans frame
            const imgBuffer = await fetchImage(fav.imageUrl);
            collectibleImage = await sharp(imgBuffer)
              .resize(pos.width, pos.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
              .png()
              .toBuffer();
          }

          const resized = await sharp(collectibleImage)
            .resize(pos.width, pos.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();

          compositeOperations.push({
            input: resized,
            left: pos.x,
            top: pos.y
          });

          // Ajouter le nom du collectible SOUS la box (pas superposé)
          const displayName = fav.name?.substring(0, 14) || 'Favori';
          const nameWidth = pos.boxWidth;
          const nameY = pos.y + pos.height + 15; // Position bien en dessous de l'image

          const nameSvg = `
            <svg width="${nameWidth}" height="32">
              <rect x="3" y="0" width="${nameWidth - 6}" height="28" rx="8" fill="rgba(0,0,0,0.85)"/>
              <rect x="3" y="0" width="${nameWidth - 6}" height="28" rx="8" fill="none" stroke="${accentColor}" stroke-width="1" stroke-opacity="0.4"/>
              <text x="${nameWidth / 2}" y="19" font-family="Arial, sans-serif" font-size="12" font-weight="bold"
                    fill="white" text-anchor="middle">${escapeXml(displayName)}</text>
            </svg>
          `;
          const nameBuffer = await sharp(Buffer.from(nameSvg)).png().toBuffer();

          compositeOperations.push({
            input: nameBuffer,
            left: pos.boxX,
            top: nameY
          });

        } catch (favError) {
          console.warn(`⚠️ Erreur favori ${i}:`, favError.message);
        }
      } else {
        // Placeholder moderne si pas de favori
        const placeholderSvg = `
          <svg width="${pos.width}" height="${pos.height}">
            <rect x="10" y="10" width="${pos.width - 20}" height="${pos.height - 20}" rx="10" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
            <text x="${pos.width/2}" y="${pos.height/2 + 5}" font-family="Arial" font-size="32"
                  fill="rgba(255,255,255,0.2)" text-anchor="middle" dominant-baseline="middle">?</text>
          </svg>
        `;
        const placeholder = await sharp(Buffer.from(placeholderSvg)).png().toBuffer();
        compositeOperations.push({
          input: placeholder,
          left: pos.x,
          top: pos.y
        });
      }
    }

    // 5. Composer l'image finale
    if (compositeOperations.length > 0) {
      cardBuffer = await sharp(cardBuffer)
        .composite(compositeOperations)
        .png()
        .toBuffer();
    }

    return cardBuffer;

  } catch (error) {
    console.error('🔴 Erreur génération Flex Card:', error);
    throw error;
  }
}

// Mapping niveau -> frame rarity pour les collectibles
const LEVEL_TO_FRAME_RARITY = {
  1: null,
  2: 'rare',
  3: 'epic',
  4: 'legendary'
};

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  generateCollectibleWithFrame,
  generateProfileWithFrame,
  generateLevelUpImage,
  generateFlexCard,
  cleanCache,
  getCacheStats,
  fetchImage,
  setDiscordClient,
  CONFIG
};
