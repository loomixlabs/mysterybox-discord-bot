/**
 * Super Admin Handler
 *
 * Interface de gestion multi-serveur réservée aux super-admins
 * (développeurs du bot uniquement)
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../utils/database-pg');
const GuildConfig = require('../utils/guildConfig');
const permissions = require('../utils/permissions');

/**
 * Vérifier si un utilisateur est super-admin
 */
async function isSuperAdmin(userId) {
  const result = await db.queryOne(
    'SELECT * FROM super_admins WHERE discord_id = $1',
    [userId]
  );
  return result !== null;
}

/**
 * Logger une action super-admin
 */
async function logSuperAdminAction(adminId, action, targetGuildId = null, details = {}) {
  await db.query(
    `INSERT INTO super_admin_logs (admin_id, action, target_guild_id, details, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [adminId, action, targetGuildId, JSON.stringify(details)]
  );
}

/**
 * Afficher le panneau principal super-admin
 */
async function showMainPanel(interaction) {
  const userId = interaction.user.id;

  // Vérifier les permissions
  if (!await isSuperAdmin(userId)) {
    return interaction.reply({
      content: '❌ Vous n\'avez pas accès à cette fonctionnalité.',
      flags: 64
    });
  }

  // Récupérer toutes les guilds
  const guilds = await GuildConfig.getAll();

  // Calculer les statistiques globales
  const totalGuilds = guilds.length;
  const activeGuilds = guilds.filter(g => g.is_active).length;
  const totalPlayers = guilds.reduce((sum, g) => sum + (g.total_players || 0), 0);
  const totalGives = guilds.reduce((sum, g) => sum + (g.total_gives || 0), 0);

  const embed = new EmbedBuilder()
    .setTitle('🛠️ SUPER ADMIN PANEL')
    .setDescription('Interface de gestion multi-serveur du bot')
    .setColor('#FF6B6B')
    .addFields(
      { name: '📊 Statistiques Globales', value: `\`\`\`
Serveurs totaux    : ${totalGuilds}
Serveurs actifs    : ${activeGuilds}
Joueurs totaux     : ${totalPlayers}
Gives totaux       : ${totalGives}
\`\`\``, inline: false },
      { name: '🔧 Actions Disponibles', value: '• Gérer les serveurs\n• Voir les logs\n• Gérer les super-admins\n• Statistiques détaillées', inline: false }
    )
    .setFooter({ text: `Super Admin: ${interaction.user.username}` })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('superadmin_guilds')
        .setLabel('📋 Gérer les serveurs')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('superadmin_stats')
        .setLabel('📊 Statistiques')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('superadmin_logs')
        .setLabel('📜 Logs')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('superadmin_admins')
        .setLabel('👥 Super Admins')
        .setStyle(ButtonStyle.Danger)
    );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    flags: 64
  });
}

/**
 * Afficher la liste des serveurs
 */
async function showGuildsList(interaction) {
  const guilds = await GuildConfig.getAll();

  if (guilds.length === 0) {
    return interaction.update({
      content: '📭 Aucun serveur enregistré.',
      embeds: [],
      components: []
    });
  }

  // Créer le menu de sélection (max 25 options)
  const options = guilds.slice(0, 25).map(guild => ({
    label: guild.guild_name.substring(0, 100),
    description: `${guild.is_active ? '✅ Actif' : '❌ Inactif'} • ${guild.total_players || 0} joueurs`,
    value: guild.guild_id
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('superadmin_select_guild')
    .setPlaceholder('Sélectionner un serveur')
    .addOptions(options);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('superadmin_back')
        .setLabel('⬅️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

  const embed = new EmbedBuilder()
    .setTitle('📋 Gestion des Serveurs')
    .setDescription(`**${guilds.length}** serveur(s) enregistré(s)\n\nSélectionnez un serveur pour le gérer :`)
    .setColor('#3498db')
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: [row1, row2]
  });
}

/**
 * Afficher les détails d'un serveur
 */
async function showGuildDetails(interaction, guildId) {
  const config = await GuildConfig.getConfig(guildId);
  const stats = await GuildConfig.getStats(guildId);

  if (!config) {
    return interaction.update({
      content: '❌ Serveur introuvable.',
      embeds: [],
      components: []
    });
  }

  const statusEmoji = config.is_active ? '✅' : '❌';
  const trialBadge = config.is_trial ? '🆓 Essai gratuit' : '💎 Version complète';

  const embed = new EmbedBuilder()
    .setTitle(`${statusEmoji} ${config.guild_name}`)
    .setDescription(`**ID:** \`${config.guild_id}\`\n**Statut:** ${config.is_active ? 'Actif' : 'Inactif'}`)
    .setColor(config.is_active ? '#00FF00' : '#FF0000')
    .addFields(
      { name: '📊 Statistiques', value: `\`\`\`
Joueurs       : ${stats?.total_players || 0}
Gives         : ${stats?.total_gives || 0}
Campagnes     : ${stats?.total_campaigns || 0}
Collections   : ${stats?.total_collections || 0}
\`\`\``, inline: true },
      { name: '📅 Dates', value: `\`\`\`
Ajouté le     : ${new Date(config.added_at).toLocaleDateString('fr-FR')}
Dernière act. : ${config.last_activity ? new Date(config.last_activity).toLocaleDateString('fr-FR') : 'Jamais'}
\`\`\``, inline: true },
      { name: '⚙️ Configuration', value: `${trialBadge}\n${config.max_players ? `Limite: ${config.max_players} joueurs` : 'Illimité'}`, inline: false }
    );

  if (config.notes) {
    embed.addFields({ name: '📝 Notes', value: config.notes, inline: false });
  }

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`superadmin_toggle_${guildId}`)
        .setLabel(config.is_active ? 'Désactiver' : 'Activer')
        .setStyle(config.is_active ? ButtonStyle.Danger : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`superadmin_permissions_${guildId}`)
        .setLabel('🔐 Permissions')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`superadmin_reset_${guildId}`)
        .setLabel('🔄 Réinitialiser')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`superadmin_delete_${guildId}`)
        .setLabel('🗑️ Supprimer')
        .setStyle(ButtonStyle.Danger)
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`superadmin_guild_stats_${guildId}`)
        .setLabel('📊 Stats Détaillées')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`superadmin_guild_logs_${guildId}`)
        .setLabel('📜 Logs d\'Actions')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('superadmin_guilds')
        .setLabel('⬅️ Liste des serveurs')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.update({
    embeds: [embed],
    components: [row1, row2]
  });
}

/**
 * Activer/Désactiver un serveur
 */
async function toggleGuild(interaction, guildId) {
  await interaction.deferUpdate(); // PREMIÈRE LIGNE - Éviter timeout

  const config = await GuildConfig.getConfig(guildId);

  if (!config) {
    return interaction.followUp({
      content: '❌ Serveur introuvable.',
      flags: 64
    });
  }

  const newStatus = !config.is_active;

  if (newStatus) {
    await GuildConfig.activate(guildId);
  } else {
    await GuildConfig.deactivate(guildId, 'Désactivé manuellement par super-admin');
  }

  await logSuperAdminAction(
    interaction.user.id,
    newStatus ? 'guild_activated' : 'guild_deactivated',
    guildId,
    { guild_name: config.guild_name }
  );

  await interaction.followUp({
    content: `✅ Serveur **${config.guild_name}** ${newStatus ? 'activé' : 'désactivé'} avec succès.`,
    flags: 64
  });

  // Rafraîchir l'affichage
  await showGuildDetails(interaction, guildId);
}

/**
 * Réinitialiser les données d'un serveur
 */
async function resetGuild(interaction, guildId) {
  await interaction.deferUpdate(); // PREMIÈRE LIGNE - Éviter timeout

  const config = await GuildConfig.getConfig(guildId);

  if (!config) {
    return interaction.followUp({
      content: '❌ Serveur introuvable.',
      flags: 64
    });
  }

  // Demander confirmation
  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ CONFIRMATION REQUISE')
    .setDescription(`Êtes-vous sûr de vouloir **réinitialiser** toutes les données du serveur **${config.guild_name}** ?\n\n**Cette action va supprimer :**\n• Tous les joueurs\n• Toutes les collections\n• Toutes les progressions\n• Tous les logs de gives\n\n**Cette action est IRRÉVERSIBLE !**`)
    .setColor('#FF0000');

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`superadmin_reset_confirm_${guildId}`)
        .setLabel('✅ Confirmer la réinitialisation')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`superadmin_guild_${guildId}`)
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.editReply({
    embeds: [confirmEmbed],
    components: [row]
  });
}

/**
 * Confirmer la réinitialisation d'un serveur
 */
async function confirmResetGuild(interaction, guildId) {
  await interaction.deferUpdate(); // PREMIÈRE LIGNE - Éviter timeout

  const config = await GuildConfig.getConfig(guildId);

  if (!config) {
    return interaction.followUp({
      content: '❌ Serveur introuvable.',
      flags: 64
    });
  }

  try {
    await GuildConfig.resetGuildData(guildId);

    await logSuperAdminAction(
      interaction.user.id,
      'guild_reset',
      guildId,
      { guild_name: config.guild_name }
    );

    await interaction.followUp({
      content: `✅ Serveur **${config.guild_name}** réinitialisé avec succès. Toutes les données ont été supprimées.`,
      flags: 64
    });

    // Rafraîchir l'affichage
    await showGuildDetails(interaction, guildId);
  } catch (error) {
    console.error('Erreur lors de la réinitialisation:', error);
    await interaction.followUp({
      content: `❌ Erreur lors de la réinitialisation : ${error.message}`,
      flags: 64
    });
  }
}

/**
 * Supprimer un serveur
 */
async function deleteGuild(interaction, guildId) {
  await interaction.deferUpdate(); // PREMIÈRE LIGNE - Éviter timeout

  const config = await GuildConfig.getConfig(guildId);

  if (!config) {
    return interaction.followUp({
      content: '❌ Serveur introuvable.',
      flags: 64
    });
  }

  // Demander confirmation
  const confirmEmbed = new EmbedBuilder()
    .setTitle('🚨 CONFIRMATION REQUISE - SUPPRESSION DÉFINITIVE')
    .setDescription(`Êtes-vous sûr de vouloir **SUPPRIMER DÉFINITIVEMENT** le serveur **${config.guild_name}** ?\n\n**Cette action va supprimer :**\n• La configuration du serveur\n• Tous les thèmes\n• Tous les collectibles\n• Tous les joueurs et collections\n• Toutes les campagnes\n• Tous les logs\n\n**⚠️ CETTE ACTION EST TOTALEMENT IRRÉVERSIBLE !**`)
    .setColor('#8B0000');

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`superadmin_delete_confirm_${guildId}`)
        .setLabel('🗑️ SUPPRIMER DÉFINITIVEMENT')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`superadmin_guild_${guildId}`)
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.editReply({
    embeds: [confirmEmbed],
    components: [row]
  });
}

/**
 * Confirmer la suppression d'un serveur
 */
async function confirmDeleteGuild(interaction, guildId) {
  await interaction.deferUpdate(); // PREMIÈRE LIGNE - Éviter timeout

  const config = await GuildConfig.getConfig(guildId);

  if (!config) {
    return interaction.followUp({
      content: '❌ Serveur introuvable.',
      flags: 64
    });
  }

  try {
    await GuildConfig.deleteGuild(guildId);

    await logSuperAdminAction(
      interaction.user.id,
      'guild_deleted',
      guildId,
      { guild_name: config.guild_name }
    );

    await interaction.followUp({
      content: `✅ Serveur **${config.guild_name}** supprimé définitivement.`,
      flags: 64
    });

    // Retour à la liste
    await showGuildsList(interaction);
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    await interaction.followUp({
      content: `❌ Erreur lors de la suppression : ${error.message}`,
      flags: 64
    });
  }
}

/**
 * Afficher les statistiques globales
 */
async function showGlobalStats(interaction) {
  const guilds = await GuildConfig.getAll();

  const totalGuilds = guilds.length;
  const activeGuilds = guilds.filter(g => g.is_active).length;
  const inactiveGuilds = totalGuilds - activeGuilds;
  const totalPlayers = guilds.reduce((sum, g) => sum + (g.total_players || 0), 0);
  const totalGives = guilds.reduce((sum, g) => sum + (g.total_gives || 0), 0);
  const totalCampaigns = guilds.reduce((sum, g) => sum + (g.total_campaigns || 0), 0);
  const totalCollections = guilds.reduce((sum, g) => sum + (g.total_collections || 0), 0);

  // Top 5 serveurs par nombre de joueurs
  const topGuilds = [...guilds]
    .sort((a, b) => (b.total_players || 0) - (a.total_players || 0))
    .slice(0, 5);

  const topGuildsText = topGuilds
    .map((g, i) => `${i + 1}. ${g.guild_name} - ${g.total_players || 0} joueurs`)
    .join('\n') || 'Aucun serveur';

  const embed = new EmbedBuilder()
    .setTitle('📊 Statistiques Globales')
    .setDescription('Vue d\'ensemble de tous les serveurs utilisant le bot')
    .setColor('#00FF00')
    .addFields(
      { name: '🌐 Serveurs', value: `\`\`\`
Total          : ${totalGuilds}
Actifs         : ${activeGuilds}
Inactifs       : ${inactiveGuilds}
\`\`\``, inline: true },
      { name: '👥 Joueurs & Activité', value: `\`\`\`
Joueurs totaux : ${totalPlayers}
Gives lancés   : ${totalGives}
Campagnes      : ${totalCampaigns}
Collections    : ${totalCollections}
\`\`\``, inline: true },
      { name: '🏆 Top 5 Serveurs', value: `\`\`\`\n${topGuildsText}\n\`\`\``, inline: false }
    )
    .setFooter({ text: `Mis à jour le ${new Date().toLocaleString('fr-FR')}` })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('superadmin_back')
        .setLabel('⬅️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.update({
    embeds: [embed],
    components: [row]
  });
}

/**
 * Afficher les logs super-admin
 */
async function showLogs(interaction) {
  const logs = await db.queryAll(
    `SELECT * FROM super_admin_logs
     ORDER BY created_at DESC
     LIMIT 20`
  );

  if (logs.length === 0) {
    return interaction.update({
      content: '📭 Aucun log disponible.',
      embeds: [],
      components: []
    });
  }

  const logsText = logs.map(log => {
    const date = new Date(log.created_at).toLocaleString('fr-FR');
    const action = log.action.replace(/_/g, ' ').toUpperCase();
    return `\`${date}\` - **${action}** par <@${log.admin_id}>`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📜 Logs Super-Admin')
    .setDescription(logsText.substring(0, 4000))
    .setColor('#95A5A6')
    .setFooter({ text: `20 dernières actions` })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('superadmin_back')
        .setLabel('⬅️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.update({
    embeds: [embed],
    components: [row]
  });
}

/**
 * Afficher la liste des super-admins
 */
async function showSuperAdminsList(interaction) {
  const admins = await db.queryAll('SELECT * FROM super_admins ORDER BY added_at');

  const adminsText = admins.map(admin => {
    const roleEmoji = admin.role === 'owner' ? '👑' : '🔧';
    return `${roleEmoji} <@${admin.discord_id}> - ${admin.role}`;
  }).join('\n') || 'Aucun super-admin';

  const embed = new EmbedBuilder()
    .setTitle('👥 Super Administrateurs')
    .setDescription(adminsText)
    .setColor('#9B59B6')
    .setFooter({ text: `${admins.length} super-admin(s)` })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('superadmin_back')
        .setLabel('⬅️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.update({
    embeds: [embed],
    components: [row]
  });
}

/**
 * Afficher la gestion des permissions d'un serveur
 */
async function showGuildPermissions(interaction, guildId) {
  await interaction.deferUpdate();

  const config = await GuildConfig.getConfig(guildId);

  if (!config) {
    return interaction.followUp({
      content: '❌ Serveur introuvable.',
      flags: 64
    });
  }

  // Récupérer les rôles admin configurés
  const adminRoles = await permissions.getAdminRoles(guildId);

  let rolesText = '';
  if (adminRoles.length === 0) {
    rolesText = '📋 **Aucun rôle configuré**\n\n⚠️ Seul le propriétaire du serveur peut accéder à `/admin-panel`.';
  } else {
    rolesText = '📋 **Rôles ayant accès à `/admin-panel`:**\n\n';
    for (const roleData of adminRoles) {
      const addedDate = new Date(roleData.created_at).toLocaleDateString('fr-FR');
      rolesText += `• <@&${roleData.role_id}> (ajouté le ${addedDate})\n`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔐 Permissions - ${config.guild_name}`)
    .setDescription(
      rolesText + '\n\n' +
      '**Hiérarchie des permissions:**\n' +
      '1️⃣ **Super Admins** (vous) → Accès à TOUS les serveurs\n' +
      '2️⃣ **Propriétaire du serveur** → Accès automatique\n' +
      '3️⃣ **Rôles configurés** → Accès selon la liste ci-dessus'
    )
    .setColor('#9B59B6')
    .setFooter({ text: `Guild ID: ${guildId}` })
    .setTimestamp();

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`superadmin_add_role_${guildId}`)
        .setLabel('➕ Ajouter un Rôle')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎭')
    );

  const components = [row1];

  // Si des rôles existent, ajouter bouton pour retirer
  if (adminRoles.length > 0) {
    const removeOptions = adminRoles.slice(0, 25).map(roleData => ({
      label: `Retirer le rôle`,
      description: `ID: ${roleData.role_id}`,
      value: roleData.role_id
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`superadmin_remove_role_${guildId}`)
      .setPlaceholder('🗑️ Retirer un rôle admin')
      .addOptions(removeOptions);

    components.push(new ActionRowBuilder().addComponents(selectMenu));
  }

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`superadmin_guild_${guildId}`)
        .setLabel('⬅️ Retour au serveur')
        .setStyle(ButtonStyle.Secondary)
    );

  components.push(row2);

  await interaction.editReply({
    embeds: [embed],
    components
  });
}

/**
 * Afficher le modal pour ajouter un rôle admin
 */
async function handleAddAdminRoleModal(interaction, guildId) {
  const modal = new ModalBuilder()
    .setCustomId(`superadmin_add_role_modal_${guildId}`)
    .setTitle('➕ Ajouter un Rôle Admin');

  const roleIdInput = new TextInputBuilder()
    .setCustomId('role_id')
    .setLabel('ID du Rôle Discord')
    .setPlaceholder('Ex: 1361023017852862564')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(17)
    .setMaxLength(20);

  const row = new ActionRowBuilder().addComponents(roleIdInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

/**
 * Traiter l'ajout d'un rôle admin
 */
async function handleAddAdminRole(interaction, guildId) {
  await interaction.deferReply({ flags: 64 });

  const roleId = interaction.fields.getTextInputValue('role_id');

  // Vérifier que l'ID est valide
  if (!/^\d{17,20}$/.test(roleId)) {
    return interaction.editReply({
      content: '❌ ID de rôle invalide. L\'ID doit être un nombre de 17 à 20 chiffres.'
    });
  }

  // Vérifier que le rôle existe sur le serveur
  try {
    const guild = interaction.client.guilds.cache.get(guildId);
    if (!guild) {
      return interaction.editReply({
        content: '❌ Serveur introuvable dans le cache du bot.'
      });
    }

    const role = await guild.roles.fetch(roleId);
    if (!role) {
      return interaction.editReply({
        content: '❌ Rôle introuvable sur ce serveur. Vérifiez l\'ID.'
      });
    }

    // Ajouter le rôle
    const success = await permissions.addAdminRole(guildId, roleId, interaction.user.id);

    if (success) {
      await logSuperAdminAction(
        interaction.user.id,
        'admin_role_added',
        guildId,
        { role_id: roleId, role_name: role.name }
      );

      await interaction.editReply({
        content: `✅ Rôle **${role.name}** ajouté aux administrateurs du serveur.`
      });

      // Rafraîchir l'affichage
      await showGuildPermissions(interaction, guildId);
    } else {
      await interaction.editReply({
        content: '❌ Erreur lors de l\'ajout du rôle. Il est peut-être déjà configuré.'
      });
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout du rôle:', error);
    await interaction.editReply({
      content: `❌ Erreur: ${error.message}`
    });
  }
}

/**
 * Retirer un rôle admin
 */
async function handleRemoveAdminRole(interaction, guildId, roleId) {
  await interaction.deferUpdate();

  try {
    const guild = interaction.client.guilds.cache.get(guildId);
    const role = guild ? await guild.roles.fetch(roleId).catch(() => null) : null;
    const roleName = role ? role.name : `ID: ${roleId}`;

    await permissions.removeAdminRole(guildId, roleId);

    await logSuperAdminAction(
      interaction.user.id,
      'admin_role_removed',
      guildId,
      { role_id: roleId, role_name: roleName }
    );

    await interaction.followUp({
      content: `✅ Rôle **${roleName}** retiré des administrateurs du serveur.`,
      flags: 64
    });

    // Rafraîchir l'affichage
    await showGuildPermissions(interaction, guildId);
  } catch (error) {
    console.error('Erreur lors de la suppression du rôle:', error);
    await interaction.followUp({
      content: `❌ Erreur: ${error.message}`,
      flags: 64
    });
  }
}

/**
 * Afficher les statistiques détaillées d'un serveur
 */
async function showGuildStats(interaction, guildId) {
  await interaction.deferUpdate();

  const config = await GuildConfig.getConfig(guildId);
  const stats = await GuildConfig.getStats(guildId);

  if (!config) {
    return interaction.followUp({
      content: '❌ Serveur introuvable.',
      flags: 64
    });
  }

  // Récupérer des stats avancées
  const [
    topPlayers,
    recentGives,
    themeInfo,
    missionsCompleted
  ] = await Promise.all([
    db.queryAll(`
      SELECT
        p.discord_id,
        COUNT(c.id) as collected_items,
        COALESCE(SUM(pm.points), 0) as malus_points,
        COUNT(pab.id) as total_bonus_points
      FROM players p
      LEFT JOIN collections c ON c.player_id = p.id AND c.guild_id = p.guild_id
      LEFT JOIN player_malus_points pm ON pm.player_id = p.id AND pm.guild_id = p.guild_id
      LEFT JOIN player_active_bonuses pab ON pab.user_id = p.discord_id AND pab.guild_id = p.guild_id AND pab.is_active = true
      WHERE p.guild_id = $1
      GROUP BY p.id, p.discord_id
      ORDER BY collected_items DESC
      LIMIT 5
    `, [guildId]),
    db.queryAll(`
      SELECT COUNT(*) as count, DATE(created_at) as date
      FROM give_logs
      WHERE guild_id = $1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 7
    `, [guildId]),
    db.queryOne(`
      SELECT COUNT(*) as total_themes
      FROM themes
      WHERE guild_id = $1
    `, [guildId]),
    db.queryOne(`
      SELECT COUNT(*) as total_completed
      FROM mission_progress
      WHERE guild_id = $1 AND status = 'completed'
    `, [guildId])
  ]);

  const embed = new EmbedBuilder()
    .setTitle(`📊 Statistiques Détaillées - ${config.guild_name}`)
    .setDescription(`**ID:** \`${config.guild_id}\``)
    .setColor('#3498db')
    .addFields(
      {
        name: '👥 Joueurs',
        value: `\`\`\`
Total          : ${stats?.total_players || 0}
Avec collection: ${stats?.total_collections || 0}
\`\`\``,
        inline: true
      },
      {
        name: '🎁 Activité',
        value: `\`\`\`
Gives lancés  : ${stats?.total_gives || 0}
Campagnes     : ${stats?.total_campaigns || 0}
Missions OK   : ${missionsCompleted?.total_completed || 0}
\`\`\``,
        inline: true
      },
      {
        name: '🎨 Thèmes',
        value: `\`\`\`
Total créés   : ${themeInfo?.total_themes || 0}
\`\`\``,
        inline: true
      }
    );

  // Top 5 joueurs
  if (topPlayers && topPlayers.length > 0) {
    const topPlayersText = topPlayers.map((p, i) =>
      `${i + 1}. <@${p.discord_id}> - ${p.collected_items} items`
    ).join('\n');
    embed.addFields({
      name: '🏆 Top 5 Joueurs',
      value: topPlayersText || 'Aucun joueur',
      inline: false
    });
  }

  // Activité des 7 derniers jours
  if (recentGives && recentGives.length > 0) {
    const activityText = recentGives.map(g =>
      `${new Date(g.date).toLocaleDateString('fr-FR')}: ${g.count} gives`
    ).join('\n');
    embed.addFields({
      name: '📈 Activité (7 derniers jours)',
      value: activityText,
      inline: false
    });
  }

  // Dernier give
  if (stats?.last_give_at) {
    const lastGive = new Date(stats.last_give_at);
    const now = new Date();
    const diffDays = Math.floor((now - lastGive) / (24 * 60 * 60 * 1000));

    let lastActivityText = '';
    if (diffDays === 0) {
      lastActivityText = "Aujourd'hui";
    } else if (diffDays === 1) {
      lastActivityText = 'Il y a 1 jour';
    } else {
      lastActivityText = `Il y a ${diffDays} jours`;
    }

    embed.setFooter({ text: `Dernier give: ${lastActivityText}` });
  }

  embed.setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`superadmin_guild_${guildId}`)
        .setLabel('⬅️ Retour au serveur')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

/**
 * Afficher les logs d'actions d'un serveur
 */
async function showGuildLogs(interaction, guildId) {
  await interaction.deferUpdate();

  const config = await GuildConfig.getConfig(guildId);

  if (!config) {
    return interaction.followUp({
      content: '❌ Serveur introuvable.',
      flags: 64
    });
  }

  // Récupérer les logs super-admin pour ce serveur
  const superAdminLogs = await db.queryAll(`
    SELECT sal.*, sa.username
    FROM super_admin_logs sal
    LEFT JOIN super_admins sa ON sal.admin_id = sa.discord_id
    WHERE sal.target_guild_id = $1
    ORDER BY sal.created_at DESC
    LIMIT 20
  `, [guildId]);

  // Récupérer les logs d'audit (actions admin normales)
  const auditLogs = await db.queryAll(`
    SELECT *
    FROM audit_logs
    WHERE guild_id = $1
    ORDER BY created_at DESC
    LIMIT 20
  `, [guildId]);

  const embed = new EmbedBuilder()
    .setTitle(`📜 Logs d'Actions - ${config.guild_name}`)
    .setDescription(`**ID:** \`${config.guild_id}\`\n\n**Dernières 20 actions**`)
    .setColor('#9B59B6');

  // Logs super-admin
  if (superAdminLogs && superAdminLogs.length > 0) {
    const actionEmojis = {
      'guild_activated': '✅',
      'guild_deactivated': '❌',
      'guild_reset': '🔄',
      'guild_deleted': '🗑️',
      'admin_role_added': '➕',
      'admin_role_removed': '➖',
      'super_bonus_granted': '⭐'
    };

    const logsText = superAdminLogs.slice(0, 10).map(log => {
      const emoji = actionEmojis[log.action] || '🔹';
      const date = new Date(log.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      const admin = log.username || 'Unknown';
      return `${emoji} \`${date}\` - **${admin}** : ${log.action}`;
    }).join('\n');

    embed.addFields({
      name: '👑 Actions Super-Admin',
      value: logsText || 'Aucune action',
      inline: false
    });
  } else {
    embed.addFields({
      name: '👑 Actions Super-Admin',
      value: 'Aucune action super-admin enregistrée.',
      inline: false
    });
  }

  // Logs audit (actions admin normales)
  if (auditLogs && auditLogs.length > 0) {
    const logsText = auditLogs.slice(0, 10).map(log => {
      const date = new Date(log.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `\`${date}\` - <@${log.admin_id}> : ${log.action}`;
    }).join('\n');

    embed.addFields({
      name: '⚙️ Actions Admins',
      value: logsText.substring(0, 1024) || 'Aucune action',
      inline: false
    });
  }

  embed.setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`superadmin_guild_${guildId}`)
        .setLabel('⬅️ Retour au serveur')
        .setStyle(ButtonStyle.Secondary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

module.exports = {
  isSuperAdmin,
  showMainPanel,
  showGuildsList,
  showGuildDetails,
  toggleGuild,
  resetGuild,
  confirmResetGuild,
  deleteGuild,
  confirmDeleteGuild,
  showGlobalStats,
  showLogs,
  showSuperAdminsList,
  showGuildPermissions,
  handleAddAdminRoleModal,
  handleAddAdminRole,
  handleRemoveAdminRole,
  showGuildStats,
  showGuildLogs
};
