/**
 * Utilitaire de diagnostic pour vérifier la configuration d'un serveur
 *
 * Vérifie:
 * - Permissions du bot
 * - Hiérarchie des rôles
 * - Configuration de la base de données
 * - Capacité à attribuer des rôles
 */

const { PermissionFlagsBits } = require('discord.js');
const { REQUIRED_PERMISSIONS, getPermissionDescription } = require('./oauthGenerator');
const db = require('./database-pg');

/**
 * Résultat d'un test de diagnostic
 */
class DiagnosticResult {
  constructor() {
    this.passed = [];
    this.warnings = [];
    this.errors = [];
  }

  pass(message) {
    this.passed.push({ type: 'pass', message });
  }

  warn(message, details = null) {
    this.warnings.push({ type: 'warning', message, details });
  }

  error(message, details = null) {
    this.errors.push({ type: 'error', message, details });
  }

  get isHealthy() {
    return this.errors.length === 0;
  }

  get hasWarnings() {
    return this.warnings.length > 0;
  }

  toEmbed() {
    const { EmbedBuilder } = require('discord.js');

    let color = 0x27AE60; // Vert
    let status = '✅ Tout est configuré correctement';

    if (this.warnings.length > 0) {
      color = 0xF39C12; // Orange
      status = '⚠️ Configuration avec avertissements';
    }

    if (this.errors.length > 0) {
      color = 0xE74C3C; // Rouge
      status = '❌ Problèmes de configuration détectés';
    }

    const embed = new EmbedBuilder()
      .setTitle('🔍 Diagnostic du Serveur')
      .setColor(color)
      .setDescription(status)
      .setTimestamp();

    // Erreurs (critiques)
    if (this.errors.length > 0) {
      const errorText = this.errors
        .map(e => `❌ ${e.message}${e.details ? `\n   └─ ${e.details}` : ''}`)
        .join('\n');
      embed.addFields({ name: '🚨 Erreurs Critiques', value: errorText.substring(0, 1024), inline: false });
    }

    // Avertissements
    if (this.warnings.length > 0) {
      const warnText = this.warnings
        .map(w => `⚠️ ${w.message}${w.details ? `\n   └─ ${w.details}` : ''}`)
        .join('\n');
      embed.addFields({ name: '⚠️ Avertissements', value: warnText.substring(0, 1024), inline: false });
    }

    // Succès (limité à 5 pour éviter l'encombrement)
    if (this.passed.length > 0) {
      const passedText = this.passed
        .slice(0, 5)
        .map(p => `✅ ${p.message}`)
        .join('\n');
      const suffix = this.passed.length > 5 ? `\n... et ${this.passed.length - 5} autres vérifications passées` : '';
      embed.addFields({ name: '✅ Vérifications Réussies', value: passedText + suffix, inline: false });
    }

    return embed;
  }
}

/**
 * Vérifie les permissions du bot sur le serveur
 */
async function checkBotPermissions(guild) {
  const result = new DiagnosticResult();
  const botMember = guild.members.me;

  if (!botMember) {
    result.error('Impossible de récupérer le membre bot');
    return result;
  }

  const botPermissions = botMember.permissions;

  // Vérifier chaque permission requise
  for (const [permName, permValue] of Object.entries(REQUIRED_PERMISSIONS)) {
    if (botPermissions.has(permValue)) {
      result.pass(`Permission ${permName}`);
    } else {
      const desc = getPermissionDescription(permName);
      result.error(`Permission manquante: ${permName}`, desc);
    }
  }

  return result;
}

/**
 * Vérifie la hiérarchie des rôles
 */
async function checkRoleHierarchy(guild) {
  const result = new DiagnosticResult();
  const botMember = guild.members.me;

  if (!botMember) {
    result.error('Impossible de récupérer le membre bot');
    return result;
  }

  // Position du rôle le plus haut du bot
  const botHighestRole = botMember.roles.highest;
  const botPosition = botHighestRole.position;
  const totalRoles = guild.roles.cache.size;

  result.pass(`Rôle le plus haut: ${botHighestRole.name} (position ${botPosition}/${totalRoles})`);

  // Vérifier si le bot peut gérer des rôles
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    result.error('Le bot n\'a pas la permission MANAGE_ROLES', 'Impossible d\'attribuer des rôles aux joueurs');
    return result;
  }

  // Vérifier le thème actif et son rôle de complétion
  try {
    const activeTheme = await db.getActiveTheme(guild.id);

    if (activeTheme && activeTheme.final_role_discord_id) {
      const completionRole = guild.roles.cache.get(activeTheme.final_role_discord_id);

      if (!completionRole) {
        result.warn(`Rôle de complétion configuré mais introuvable`, `ID: ${activeTheme.final_role_discord_id}`);
      } else if (completionRole.position >= botPosition) {
        result.error(
          `Rôle de complétion "${completionRole.name}" est AU-DESSUS du bot`,
          `Le bot ne pourra PAS attribuer ce rôle. Remontez le rôle du bot dans la hiérarchie.`
        );
      } else {
        result.pass(`Rôle de complétion "${completionRole.name}" est attribuable (position ${completionRole.position})`);
      }
    } else if (activeTheme) {
      result.warn('Thème actif sans rôle de complétion configuré');
    }
  } catch (error) {
    result.warn('Impossible de vérifier le thème actif', error.message);
  }

  // Avertir si le bot est très bas dans la hiérarchie
  if (botPosition < 5) {
    result.warn(
      'Le rôle du bot est très bas dans la hiérarchie',
      `Position ${botPosition}/${totalRoles}. Considérez le remonter.`
    );
  }

  return result;
}

/**
 * Vérifie la configuration de la base de données
 */
async function checkDatabaseSetup(guildId) {
  const result = new DiagnosticResult();

  try {
    // Vérifier guild_config
    const guildConfig = await db.getGuildConfig(guildId);
    if (guildConfig) {
      result.pass('Configuration serveur (guild_config) présente');
    } else {
      result.warn('Configuration serveur non initialisée', 'Exécutez /setup');
    }

    // Vérifier le branding
    const branding = await db.getGuildBranding(guildId);
    if (branding && branding.bot_role_id) {
      result.pass(`Rôle bot configuré (ID: ${branding.bot_role_id})`);
    } else {
      result.warn('Rôle de couleur du bot non configuré');
    }

    // Vérifier les rôles admin
    const adminRoles = await db.queryAll(
      'SELECT role_id FROM guild_admin_roles WHERE guild_id = $1',
      [guildId]
    );
    if (adminRoles.length > 0) {
      result.pass(`${adminRoles.length} rôle(s) admin configuré(s)`);
    } else {
      result.warn('Aucun rôle admin configuré', 'Seul le propriétaire peut accéder à /admin-panel');
    }

    // Vérifier le thème
    const activeTheme = await db.getActiveTheme(guildId);
    if (activeTheme) {
      result.pass(`Thème actif: ${activeTheme.name}`);
    } else {
      result.warn('Aucun thème actif');
    }

    // Vérifier les templates d'annonces
    const templates = await db.queryAll(
      'SELECT COUNT(*) as count FROM announcement_templates WHERE guild_id = $1',
      [guildId]
    );
    if (templates[0]?.count > 0) {
      result.pass(`${templates[0].count} template(s) d'annonces configuré(s)`);
    } else {
      result.warn('Aucun template d\'annonces');
    }

  } catch (error) {
    result.error('Erreur de connexion à la base de données', error.message);
  }

  return result;
}

/**
 * Diagnostic complet d'un serveur
 */
async function runFullDiagnostic(guild) {
  const results = {
    permissions: await checkBotPermissions(guild),
    hierarchy: await checkRoleHierarchy(guild),
    database: await checkDatabaseSetup(guild.id)
  };

  // Combiner les résultats
  const combined = new DiagnosticResult();

  for (const [category, result] of Object.entries(results)) {
    for (const item of result.passed) combined.pass(`[${category}] ${item.message}`);
    for (const item of result.warnings) combined.warn(`[${category}] ${item.message}`, item.details);
    for (const item of result.errors) combined.error(`[${category}] ${item.message}`, item.details);
  }

  return {
    combined,
    detailed: results
  };
}

/**
 * Vérifie si le bot peut attribuer un rôle spécifique
 */
function canAssignRole(guild, roleId) {
  const botMember = guild.members.me;
  if (!botMember) return { can: false, reason: 'Bot member not found' };

  const role = guild.roles.cache.get(roleId);
  if (!role) return { can: false, reason: 'Role not found' };

  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { can: false, reason: 'Missing MANAGE_ROLES permission' };
  }

  if (role.position >= botMember.roles.highest.position) {
    return { can: false, reason: `Role "${role.name}" is above bot's highest role` };
  }

  if (role.managed) {
    return { can: false, reason: 'Role is managed by an integration' };
  }

  return { can: true, reason: 'Role can be assigned' };
}

module.exports = {
  DiagnosticResult,
  checkBotPermissions,
  checkRoleHierarchy,
  checkDatabaseSetup,
  runFullDiagnostic,
  canAssignRole
};
