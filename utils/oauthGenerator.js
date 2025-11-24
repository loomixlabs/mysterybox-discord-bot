/**
 * Générateur d'URL OAuth2 pour inviter le bot
 *
 * Ce module génère l'URL d'invitation avec les permissions optimales
 * pour le déploiement sur de nouveaux serveurs.
 */

const { PermissionFlagsBits } = require('discord.js');

// Permissions requises par le bot
const REQUIRED_PERMISSIONS = {
  // === BASIQUES (Communication) ===
  ViewChannel: PermissionFlagsBits.ViewChannel,
  SendMessages: PermissionFlagsBits.SendMessages,
  EmbedLinks: PermissionFlagsBits.EmbedLinks,
  AttachFiles: PermissionFlagsBits.AttachFiles,
  ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
  UseExternalEmojis: PermissionFlagsBits.UseExternalEmojis,
  AddReactions: PermissionFlagsBits.AddReactions,

  // === THREADS (Pour les missions) ===
  CreatePublicThreads: PermissionFlagsBits.CreatePublicThreads,
  SendMessagesInThreads: PermissionFlagsBits.SendMessagesInThreads,
  ManageThreads: PermissionFlagsBits.ManageThreads,

  // === RÔLES (CRITIQUE pour les récompenses) ===
  ManageRoles: PermissionFlagsBits.ManageRoles,

  // === UTILITAIRES ===
  MentionEveryone: PermissionFlagsBits.MentionEveryone, // Pour les annonces
  UseApplicationCommands: PermissionFlagsBits.UseApplicationCommands
};

// Permissions optionnelles (nice-to-have)
const OPTIONAL_PERMISSIONS = {
  ManageMessages: PermissionFlagsBits.ManageMessages, // Pour supprimer des messages
  ManageChannels: PermissionFlagsBits.ManageChannels  // Pour créer des canaux dédiés
};

/**
 * Calcule le bitfield total des permissions
 * @param {boolean} includeOptional - Inclure les permissions optionnelles
 * @returns {bigint} - Bitfield des permissions
 */
function calculatePermissionBitfield(includeOptional = false) {
  let permissions = BigInt(0);

  // Ajouter les permissions requises
  for (const perm of Object.values(REQUIRED_PERMISSIONS)) {
    permissions |= perm;
  }

  // Ajouter les permissions optionnelles si demandé
  if (includeOptional) {
    for (const perm of Object.values(OPTIONAL_PERMISSIONS)) {
      permissions |= perm;
    }
  }

  return permissions;
}

/**
 * Génère l'URL OAuth2 d'invitation
 * @param {string} clientId - ID de l'application Discord
 * @param {Object} options - Options de génération
 * @returns {string} - URL d'invitation complète
 */
function generateInviteUrl(clientId, options = {}) {
  const {
    includeOptional = false,
    guildId = null // Si fourni, pré-sélectionne le serveur
  } = options;

  const permissions = calculatePermissionBitfield(includeOptional);

  // Scopes requis
  const scopes = [
    'bot',
    'applications.commands'
  ].join('%20');

  let url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scopes}`;

  // Ajouter le guild_id si spécifié
  if (guildId) {
    url += `&guild_id=${guildId}&disable_guild_select=true`;
  }

  return url;
}

/**
 * Génère un rapport détaillé des permissions
 * @param {boolean} includeOptional - Inclure les permissions optionnelles
 * @returns {Object} - Rapport des permissions
 */
function getPermissionsReport(includeOptional = false) {
  const report = {
    required: [],
    optional: [],
    totalBitfield: calculatePermissionBitfield(includeOptional).toString()
  };

  for (const [name, value] of Object.entries(REQUIRED_PERMISSIONS)) {
    report.required.push({
      name,
      value: value.toString(),
      description: getPermissionDescription(name)
    });
  }

  if (includeOptional) {
    for (const [name, value] of Object.entries(OPTIONAL_PERMISSIONS)) {
      report.optional.push({
        name,
        value: value.toString(),
        description: getPermissionDescription(name)
      });
    }
  }

  return report;
}

/**
 * Description humaine des permissions
 */
function getPermissionDescription(permName) {
  const descriptions = {
    ViewChannel: 'Voir les salons',
    SendMessages: 'Envoyer des messages',
    EmbedLinks: 'Intégrer des liens (embeds)',
    AttachFiles: 'Joindre des fichiers',
    ReadMessageHistory: 'Lire l\'historique des messages',
    UseExternalEmojis: 'Utiliser des emojis externes',
    AddReactions: 'Ajouter des réactions',
    CreatePublicThreads: 'Créer des threads publics (missions)',
    SendMessagesInThreads: 'Envoyer des messages dans les threads',
    ManageThreads: 'Gérer les threads (archiver)',
    ManageRoles: 'Gérer les rôles (CRITIQUE: donner les rôles de complétion)',
    MentionEveryone: 'Mentionner @everyone (annonces)',
    UseApplicationCommands: 'Utiliser les slash commands',
    ManageMessages: 'Gérer les messages (supprimer)',
    ManageChannels: 'Gérer les salons (créer des canaux dédiés)'
  };

  return descriptions[permName] || 'Permission Discord';
}

module.exports = {
  REQUIRED_PERMISSIONS,
  OPTIONAL_PERMISSIONS,
  calculatePermissionBitfield,
  generateInviteUrl,
  getPermissionsReport,
  getPermissionDescription
};
