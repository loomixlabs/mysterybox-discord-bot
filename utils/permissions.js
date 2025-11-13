const db = require('./database-pg');

/**
 * 🔐 SYSTÈME DE PERMISSIONS À 3 NIVEAUX
 *
 * Niveau 1: Super Admins (accès TOUS serveurs)
 *   - Toi: 297307186307006464
 *   - Associé: 340981911281205248
 *
 * Niveau 2: Propriétaire du serveur
 *   - Vérifié via interaction.guild.ownerId
 *
 * Niveau 3: Rôles configurés (table guild_admin_roles)
 *   - Configurés via /setup par le propriétaire ou super-admins
 */

// Super Admins (accès tous serveurs)
const SUPER_ADMINS = ['297307186307006464', '340981911281205248'];

/**
 * 🔍 Vérifier si un utilisateur est un super admin
 * @param {string} userId - Discord ID de l'utilisateur
 * @returns {boolean}
 */
function isSuperAdmin(userId) {
  return SUPER_ADMINS.includes(userId);
}

/**
 * 🔍 Vérifier si un utilisateur est le propriétaire du serveur
 * @param {Interaction} interaction - L'interaction Discord
 * @returns {boolean}
 */
function isGuildOwner(interaction) {
  return interaction.guild && interaction.guild.ownerId === interaction.user.id;
}

/**
 * 🔍 Vérifier si un utilisateur a un rôle admin configuré
 * @param {Interaction} interaction - L'interaction Discord
 * @returns {Promise<boolean>}
 */
async function hasAdminRole(interaction) {
  try {
    const guildId = interaction.guildId;
    const userRoles = interaction.member?.roles?.cache;

    if (!userRoles) return false;

    // Récupérer tous les rôles admin configurés pour ce serveur
    const adminRoles = await db.queryAll(
      'SELECT role_id FROM guild_admin_roles WHERE guild_id = $1',
      [guildId]
    );

    // Vérifier si l'utilisateur a au moins un de ces rôles
    return adminRoles.some(row => userRoles.has(row.role_id));
  } catch (error) {
    console.error('🔴 Erreur hasAdminRole:', error);
    return false;
  }
}

/**
 * ✅ Vérifier si un utilisateur a accès à l'admin panel
 * @param {Interaction} interaction - L'interaction Discord
 * @returns {Promise<boolean>}
 */
async function canAccessAdminPanel(interaction) {
  // Niveau 1: Super Admin
  if (isSuperAdmin(interaction.user.id)) {
    return true;
  }

  // Niveau 2: Propriétaire du serveur
  if (isGuildOwner(interaction)) {
    return true;
  }

  // Niveau 3: Rôle configuré
  if (await hasAdminRole(interaction)) {
    return true;
  }

  return false;
}

/**
 * 📋 Récupérer tous les rôles admin configurés pour un serveur
 * @param {string} guildId - ID du serveur
 * @returns {Promise<Array>}
 */
async function getAdminRoles(guildId) {
  try {
    return await db.queryAll(
      'SELECT * FROM guild_admin_roles WHERE guild_id = $1',
      [guildId]
    );
  } catch (error) {
    console.error('🔴 Erreur getAdminRoles:', error);
    return [];
  }
}

/**
 * 🗑️ Réinitialiser tous les rôles admin d'un serveur
 * @param {string} guildId - ID du serveur
 * @returns {Promise<void>}
 */
async function resetAdminRoles(guildId) {
  try {
    await db.query(
      'DELETE FROM guild_admin_roles WHERE guild_id = $1',
      [guildId]
    );
  } catch (error) {
    console.error('🔴 Erreur resetAdminRoles:', error);
  }
}

/**
 * ➕ Ajouter un rôle admin pour un serveur
 * @param {string} guildId - ID du serveur
 * @param {string} roleId - ID du rôle
 * @param {string} addedBy - Discord ID de celui qui ajoute
 * @returns {Promise<void>}
 */
async function addAdminRole(guildId, roleId, addedBy) {
  try {
    await db.query(
      `INSERT INTO guild_admin_roles (guild_id, role_id, added_by, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (guild_id, role_id) DO NOTHING`,
      [guildId, roleId, addedBy]
    );
  } catch (error) {
    console.error('🔴 Erreur addAdminRole:', error);
  }
}

module.exports = {
  SUPER_ADMINS,
  isSuperAdmin,
  isGuildOwner,
  hasAdminRole,
  canAccessAdminPanel,
  getAdminRoles,
  resetAdminRoles,
  addAdminRole
};
