/**
 * Handler pour la gestion admin des rôles de progression
 * Permet de configurer les rôles intermédiaires via le panel admin
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../utils/database-pg');
const audit = require('../utils/auditLogger');
const progressionRoleHandler = require('./progressionRoleHandler');

class ProgressionRoleAdminHandler {
  /**
   * Point d'entrée principal pour router les interactions
   */
  async handleInteraction(interaction) {
    const customId = interaction.customId;

    console.log('🏅 [PROGRESSION ADMIN] Interaction:', customId);

    if (customId === 'admin_progression_roles') {
      return this.showProgressionRolesMenu(interaction);
    } else if (customId === 'progression_roles_add') {
      return this.showAddRoleModal(interaction);
    } else if (customId === 'progression_roles_edit') {
      return this.showEditRoleSelect(interaction);
    } else if (customId === 'progression_roles_delete') {
      return this.showDeleteRoleSelect(interaction);
    } else if (customId === 'progression_role_select_edit') {
      return this.handleEditRoleSelect(interaction);
    } else if (customId === 'progression_role_select_delete') {
      return this.handleDeleteRoleSelect(interaction);
    } else if (customId.startsWith('progression_role_delete_confirm:')) {
      return this.handleDeleteConfirm(interaction);
    } else if (customId === 'progression_roles_back') {
      // Retour au menu paramétrage
      const adminPanelHandler = require('./adminPanelHandler');
      return adminPanelHandler.showSettingsMenu(interaction);
    } else if (customId === 'progression_roles_refresh') {
      return this.showProgressionRolesMenu(interaction);
    }

    // Modals
    if (customId === 'modal_add_progression_role') {
      return this.handleAddRoleModalSubmit(interaction);
    } else if (customId.startsWith('modal_edit_progression_role:')) {
      return this.handleEditRoleModalSubmit(interaction);
    }

    console.log('⚠️ [PROGRESSION ADMIN] CustomId non géré:', customId);
  }

  /**
   * Router pour les modals (appelé depuis interactionCreate.js)
   */
  async handleModalSubmit(interaction) {
    const customId = interaction.customId;
    console.log('🏅 [PROGRESSION ADMIN] Modal:', customId);

    if (customId === 'modal_add_progression_role') {
      return this.handleAddRoleModalSubmit(interaction);
    } else if (customId.startsWith('modal_edit_progression_role:')) {
      return this.handleEditRoleModalSubmit(interaction);
    }

    console.log('⚠️ [PROGRESSION ADMIN] Modal non géré:', customId);
  }

  /**
   * Affiche le menu principal des rôles de progression
   * @param {boolean} skipDefer - Si true, ne pas appeler deferUpdate (déjà fait par l'appelant)
   */
  async showProgressionRolesMenu(interaction, skipDefer = false) {
    if (!skipDefer) {
      await interaction.deferUpdate();
    }

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif. Veuillez d\'abord activer un thème.',
        embeds: [],
        components: []
      });
    }

    const progressionRoles = await progressionRoleHandler.getProgressionRoles(guildId, theme.id);

    const embed = new EmbedBuilder()
      .setTitle('🏅 Rôles de Progression')
      .setColor('#9b59b6')
      .setDescription(
        `**Thème actif:** ${theme.name}\n\n` +
        `Les rôles de progression sont attribués automatiquement aux joueurs quand ils atteignent certains seuils de collection.\n\n` +
        `**Note:** Le rôle à 100% est le **rôle final** et est géré séparément dans la configuration du thème.`
      );

    if (progressionRoles.length === 0) {
      embed.addFields({
        name: '📋 Rôles intermédiaires',
        value: '*Aucun rôle de progression configuré*\n\nUtilise le bouton "➕ Ajouter" pour créer des rôles intermédiaires.',
        inline: false
      });
    } else {
      // Trier par pourcentage croissant
      const sortedRoles = [...progressionRoles].sort((a, b) => a.percentage - b.percentage);

      let rolesDisplay = sortedRoles.map(role => {
        const statusEmoji = role.discord_role_id ? '✅' : '⏳';
        const colorSquare = role.color ? `\`${role.color}\`` : '⬜';
        return `${statusEmoji} **${role.name}** - ${role.percentage}% (${role.required_items} items) ${colorSquare}`;
      }).join('\n');

      embed.addFields({
        name: `📋 Rôles intermédiaires (${sortedRoles.length})`,
        value: rolesDisplay,
        inline: false
      });

      embed.addFields({
        name: '💡 Légende',
        value: '✅ = Rôle Discord créé\n⏳ = Rôle sera créé à la première attribution',
        inline: false
      });
    }

    // Afficher le rôle final (100%)
    const finalRoleColor = theme.final_role_color ? `\`${theme.final_role_color}\`` : '⬜';
    embed.addFields({
      name: '🏆 Rôle Final (100%)',
      value: `🎯 **${theme.final_role_name || 'Non défini'}** - 100% (${theme.required_items} items) ${finalRoleColor}\n` +
             `*(Géré dans la configuration du thème)*`,
      inline: false
    });

    // Collection totale pour info
    const totalCollectibles = await db.queryOne(
      'SELECT COUNT(*) as total FROM collectibles WHERE guild_id = $1 AND theme_id = $2',
      [guildId, theme.id]
    );

    embed.setFooter({
      text: `Collection: ${totalCollectibles?.total || 0} collectibles au total • ${theme.required_items} requis pour le rôle final`
    });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('progression_roles_add')
        .setLabel('➕ Ajouter un rôle')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('progression_roles_edit')
        .setLabel('✏️ Modifier')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(progressionRoles.length === 0),
      new ButtonBuilder()
        .setCustomId('progression_roles_delete')
        .setLabel('🗑️ Supprimer')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(progressionRoles.length === 0)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('progression_roles_back')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('progression_roles_refresh')
        .setLabel('🔄 Rafraîchir')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * Affiche le modal pour ajouter un nouveau rôle de progression
   */
  async showAddRoleModal(interaction) {
    // Note: pas de requête DB ici car showModal() doit être appelé immédiatement
    const modal = new ModalBuilder()
      .setCustomId('modal_add_progression_role')
      .setTitle('Ajouter un Rôle de Progression');

    const nameInput = new TextInputBuilder()
      .setCustomId('role_name')
      .setLabel('Nom du rôle')
      .setPlaceholder('Ex: Collectionneur Novice')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const percentageInput = new TextInputBuilder()
      .setCustomId('role_percentage')
      .setLabel('Pourcentage de collection requis (1-99)')
      .setPlaceholder('Ex: 25')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(2);

    const colorInput = new TextInputBuilder()
      .setCustomId('role_color')
      .setLabel('Couleur (code hex)')
      .setPlaceholder('Ex: #3498db')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(7);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(percentageInput),
      new ActionRowBuilder().addComponents(colorInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Gère la soumission du modal d'ajout de rôle
   */
  async handleAddRoleModalSubmit(interaction) {
    await interaction.deferReply({ flags: 64 });

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    if (!theme) {
      return interaction.editReply({ content: '❌ Aucun thème actif.' });
    }

    const name = interaction.fields.getTextInputValue('role_name');
    const percentageStr = interaction.fields.getTextInputValue('role_percentage');
    const color = interaction.fields.getTextInputValue('role_color') || '#3498db';

    // Validation
    const percentage = parseInt(percentageStr);
    if (isNaN(percentage) || percentage < 1 || percentage >= 100) {
      return interaction.editReply({
        content: '❌ Le pourcentage doit être un nombre entre 1 et 99 (100% = rôle final).'
      });
    }

    // Calculer required_items basé sur le pourcentage
    const requiredItems = Math.ceil((percentage / 100) * theme.required_items);

    // Récupérer les rôles existants
    const existingRoles = await progressionRoleHandler.getProgressionRoles(guildId, theme.id);

    // Vérifier si un rôle avec le même seuil existe
    if (existingRoles.some(r => r.required_items === requiredItems || r.percentage === percentage)) {
      return interaction.editReply({
        content: `❌ Un rôle existe déjà pour ${percentage}% (${requiredItems} items).`
      });
    }

    // Créer le rôle Discord IMMÉDIATEMENT
    let discordRole = null;
    try {
      discordRole = await interaction.guild.roles.create({
        name: name,
        color: color,
        hoist: false,
        mentionable: false,
        reason: `Rôle de progression automatique (${percentage}%) - Créé via admin panel`
      });
      console.log(`✅ [PROGRESSION ADMIN] Rôle Discord créé: "${discordRole.name}" (ID: ${discordRole.id})`);
    } catch (error) {
      console.error('❌ [PROGRESSION ADMIN] Erreur création rôle Discord:', error);
      return interaction.editReply({
        content: `❌ Impossible de créer le rôle Discord. Vérifie les permissions du bot.`
      });
    }

    // Ajouter le nouveau rôle avec discord_role_id
    const newRole = {
      name: name,
      color: color,
      required_items: requiredItems,
      percentage: percentage,
      hoist: false,
      mentionable: false,
      discord_role_id: discordRole.id
    };

    const updatedRoles = [...existingRoles, newRole];

    // Sauvegarder
    await progressionRoleHandler.setProgressionRoles(guildId, theme.id, updatedRoles);

    // Logger l'action
    await audit.logAdminAction(
      guildId,
      interaction.user.id,
      'progression_role_added',
      {
        theme_id: theme.id,
        role_name: name,
        percentage: percentage,
        required_items: requiredItems,
        discord_role_id: discordRole.id
      }
    );

    console.log(`✅ [PROGRESSION ADMIN] Rôle "${name}" ajouté (${percentage}%, ${requiredItems} items)`);

    await interaction.editReply({
      content: `✅ Rôle **${name}** créé avec succès !\n\n` +
               `📊 **Seuil:** ${percentage}% de la collection (${requiredItems} items)\n` +
               `🎨 **Couleur:** ${color}\n` +
               `🏷️ **Rôle Discord:** <@&${discordRole.id}>\n\n` +
               `Le rôle sera attribué automatiquement aux joueurs qui atteignent ce seuil.`
    });

    // Rafraîchir l'affichage si possible (via message original)
  }

  /**
   * Affiche le select menu pour modifier un rôle
   */
  async showEditRoleSelect(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const progressionRoles = await progressionRoleHandler.getProgressionRoles(guildId, theme.id);

    if (progressionRoles.length === 0) {
      return interaction.editReply({
        content: '❌ Aucun rôle de progression à modifier.',
        embeds: [],
        components: []
      });
    }

    const sortedRoles = [...progressionRoles].sort((a, b) => a.percentage - b.percentage);

    const options = sortedRoles.map(role => ({
      label: `${role.name} (${role.percentage}%)`,
      description: `${role.required_items} items requis`,
      value: String(role.required_items) // Utiliser required_items comme identifiant unique
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('progression_role_select_edit')
      .setPlaceholder('Sélectionne un rôle à modifier')
      .addOptions(options);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('progression_roles_refresh')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '✏️ **Sélectionne le rôle à modifier:**',
      embeds: [],
      components: [row1, row2]
    });
  }

  /**
   * Gère la sélection d'un rôle à modifier
   */
  async handleEditRoleSelect(interaction) {
    const requiredItems = parseInt(interaction.values[0]);
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const progressionRoles = await progressionRoleHandler.getProgressionRoles(guildId, theme.id);

    const roleToEdit = progressionRoles.find(r => r.required_items === requiredItems);

    if (!roleToEdit) {
      await interaction.deferUpdate();
      return interaction.editReply({ content: '❌ Rôle non trouvé.' });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_edit_progression_role:${requiredItems}`)
      .setTitle(`Modifier: ${roleToEdit.name}`);

    const nameInput = new TextInputBuilder()
      .setCustomId('role_name')
      .setLabel('Nom du rôle')
      .setValue(roleToEdit.name)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const percentageInput = new TextInputBuilder()
      .setCustomId('role_percentage')
      .setLabel('Pourcentage de collection requis (1-99)')
      .setValue(String(roleToEdit.percentage))
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(2);

    const colorInput = new TextInputBuilder()
      .setCustomId('role_color')
      .setLabel('Couleur (code hex)')
      .setValue(roleToEdit.color || '#3498db')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(7);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(percentageInput),
      new ActionRowBuilder().addComponents(colorInput)
    );

    return interaction.showModal(modal);
  }

  /**
   * Gère la soumission du modal de modification
   */
  async handleEditRoleModalSubmit(interaction) {
    await interaction.deferReply({ flags: 64 });

    const requiredItems = parseInt(interaction.customId.split(':')[1]);
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);

    const name = interaction.fields.getTextInputValue('role_name');
    const percentageStr = interaction.fields.getTextInputValue('role_percentage');
    const color = interaction.fields.getTextInputValue('role_color') || '#3498db';

    // Validation du pourcentage
    const newPercentage = parseInt(percentageStr);
    if (isNaN(newPercentage) || newPercentage < 1 || newPercentage >= 100) {
      return interaction.editReply({
        content: '❌ Le pourcentage doit être un nombre entre 1 et 99.'
      });
    }

    // Calculer le nouveau required_items
    const newRequiredItems = Math.ceil((newPercentage / 100) * theme.required_items);

    // Récupérer et mettre à jour les rôles
    const progressionRoles = await progressionRoleHandler.getProgressionRoles(guildId, theme.id);

    // Vérifier si un autre rôle utilise déjà ce seuil
    const conflictRole = progressionRoles.find(r =>
      r.required_items !== requiredItems &&
      (r.required_items === newRequiredItems || r.percentage === newPercentage)
    );
    if (conflictRole) {
      return interaction.editReply({
        content: `❌ Un autre rôle existe déjà pour ${newPercentage}% (${newRequiredItems} items).`
      });
    }

    // Trouver le rôle à modifier
    const roleToEdit = progressionRoles.find(r => r.required_items === requiredItems);
    if (!roleToEdit) {
      return interaction.editReply({ content: '❌ Rôle non trouvé.' });
    }

    // Mettre à jour le rôle Discord s'il existe déjà
    let discordRoleUpdated = false;
    let discordRolePending = false;

    if (roleToEdit.discord_role_id) {
      // Le rôle Discord existe déjà - on le met à jour
      try {
        const discordRole = await interaction.guild.roles.fetch(roleToEdit.discord_role_id);
        if (discordRole) {
          await discordRole.edit({
            name: name,
            color: color,
            reason: `Modification via admin panel (${newPercentage}%)`
          });
          discordRoleUpdated = true;
          console.log(`✅ [PROGRESSION ADMIN] Rôle Discord "${name}" mis à jour`);
        }
      } catch (e) {
        console.log(`⚠️ [PROGRESSION ADMIN] Impossible de mettre à jour le rôle Discord: ${e.message}`);
      }
    } else {
      // Le rôle Discord n'existe pas encore - sera créé quand un joueur l'atteindra (lazy creation)
      discordRolePending = true;
      console.log(`ℹ️ [PROGRESSION ADMIN] Rôle Discord "${name}" sera créé automatiquement quand un joueur atteindra ce palier`);
    }

    // Mettre à jour dans la liste (garder discord_role_id existant si présent)
    const updatedRoles = progressionRoles.map(role => {
      if (role.required_items === requiredItems) {
        return {
          ...role,
          name,
          color,
          percentage: newPercentage,
          required_items: newRequiredItems
          // discord_role_id reste inchangé (lazy creation)
        };
      }
      return role;
    });

    await progressionRoleHandler.setProgressionRoles(guildId, theme.id, updatedRoles);

    // Logger
    await audit.logAdminAction(
      guildId,
      interaction.user.id,
      'progression_role_edited',
      {
        theme_id: theme.id,
        old_required_items: requiredItems,
        new_required_items: newRequiredItems,
        new_percentage: newPercentage,
        new_name: name,
        new_color: color
      }
    );

    console.log(`✅ [PROGRESSION ADMIN] Rôle modifié: ${name} (${newPercentage}%)`);

    // Déterminer le message pour le rôle Discord
    let discordRoleMessage = '⚠️ Erreur mise à jour rôle Discord';
    if (discordRoleUpdated) {
      discordRoleMessage = '🏷️ Rôle Discord mis à jour';
    } else if (discordRolePending) {
      discordRoleMessage = '⏳ Rôle Discord sera créé quand un joueur atteindra ce palier';
    }

    await interaction.editReply({
      content: `✅ Rôle **${name}** modifié avec succès !\n\n` +
               `📊 **Seuil:** ${newPercentage}% (${newRequiredItems} items)\n` +
               `🎨 **Couleur:** ${color}\n` +
               `${discordRoleMessage}`
    });

    // Rafraîchir le selecteur de rôles dans le message original
    try {
      if (interaction.message) {
        const updatedRolesForSelect = await progressionRoleHandler.getProgressionRoles(guildId, theme.id);

        if (updatedRolesForSelect.length > 0) {
          const sortedRoles = [...updatedRolesForSelect].sort((a, b) => a.percentage - b.percentage);

          const options = sortedRoles.map(role => ({
            label: `${role.name} (${role.percentage}%)`,
            description: `${role.required_items} items requis`,
            value: String(role.required_items)
          }));

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('progression_role_select_edit')
            .setPlaceholder('Sélectionne un rôle à modifier')
            .addOptions(options);

          const row1 = new ActionRowBuilder().addComponents(selectMenu);
          const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('progression_roles_refresh')
              .setLabel('◀️ Retour')
              .setStyle(ButtonStyle.Secondary)
          );

          await interaction.message.edit({
            content: '✏️ **Sélectionne le rôle à modifier:**',
            embeds: [],
            components: [row1, row2]
          });
        }
      }
    } catch (e) {
      console.log('⚠️ [PROGRESSION ADMIN] Impossible de rafraîchir le selecteur:', e.message);
    }
  }

  /**
   * Affiche le select menu pour supprimer un rôle
   */
  async showDeleteRoleSelect(interaction) {
    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const progressionRoles = await progressionRoleHandler.getProgressionRoles(guildId, theme.id);

    if (progressionRoles.length === 0) {
      return interaction.editReply({
        content: '❌ Aucun rôle de progression à supprimer.',
        embeds: [],
        components: []
      });
    }

    const sortedRoles = [...progressionRoles].sort((a, b) => a.percentage - b.percentage);

    const options = sortedRoles.map(role => ({
      label: `${role.name} (${role.percentage}%)`,
      description: `${role.required_items} items requis`,
      value: String(role.required_items)
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('progression_role_select_delete')
      .setPlaceholder('Sélectionne un rôle à supprimer')
      .addOptions(options);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('progression_roles_refresh')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '🗑️ **Sélectionne le rôle à supprimer:**\n\n⚠️ **Attention:** La suppression est définitive !',
      embeds: [],
      components: [row1, row2]
    });
  }

  /**
   * Gère la sélection d'un rôle à supprimer (demande confirmation)
   */
  async handleDeleteRoleSelect(interaction) {
    await interaction.deferUpdate();

    const requiredItems = parseInt(interaction.values[0]);
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const progressionRoles = await progressionRoleHandler.getProgressionRoles(guildId, theme.id);

    const roleToDelete = progressionRoles.find(r => r.required_items === requiredItems);

    if (!roleToDelete) {
      return interaction.editReply({ content: '❌ Rôle non trouvé.' });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`progression_role_delete_confirm:${requiredItems}`)
        .setLabel('🗑️ Confirmer la suppression')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('progression_roles_refresh')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: `⚠️ **Confirmation de suppression**\n\n` +
               `Tu vas supprimer le rôle **${roleToDelete.name}** (${roleToDelete.percentage}%).\n\n` +
               `${roleToDelete.discord_role_id ? '⚠️ Le rôle Discord associé sera également supprimé.' : ''}\n\n` +
               `Cette action est **irréversible**.`,
      embeds: [],
      components: [row]
    });
  }

  /**
   * Confirme et exécute la suppression du rôle
   */
  async handleDeleteConfirm(interaction) {
    await interaction.deferUpdate();

    const requiredItems = parseInt(interaction.customId.split(':')[1]);
    const guildId = interaction.guildId;
    const theme = await db.getActiveTheme(guildId);
    const progressionRoles = await progressionRoleHandler.getProgressionRoles(guildId, theme.id);

    const roleToDelete = progressionRoles.find(r => r.required_items === requiredItems);

    if (!roleToDelete) {
      return interaction.editReply({ content: '❌ Rôle non trouvé.' });
    }

    // Supprimer le rôle Discord s'il existe
    if (roleToDelete.discord_role_id) {
      try {
        const discordRole = await interaction.guild.roles.fetch(roleToDelete.discord_role_id);
        if (discordRole) {
          await discordRole.delete('Suppression du rôle de progression via admin panel');
          console.log(`🗑️ [PROGRESSION ADMIN] Rôle Discord "${discordRole.name}" supprimé`);
        }
      } catch (e) {
        console.log(`⚠️ [PROGRESSION ADMIN] Rôle Discord ${roleToDelete.discord_role_id} déjà supprimé ou inaccessible`);
      }
    }

    // Retirer de la liste
    const updatedRoles = progressionRoles.filter(r => r.required_items !== requiredItems);
    await progressionRoleHandler.setProgressionRoles(guildId, theme.id, updatedRoles);

    // Logger
    await audit.logAdminAction(
      guildId,
      interaction.user.id,
      'progression_role_deleted',
      { theme_id: theme.id, role_name: roleToDelete.name, percentage: roleToDelete.percentage }
    );

    console.log(`✅ [PROGRESSION ADMIN] Rôle "${roleToDelete.name}" supprimé`);

    // Rafraîchir le menu (skipDefer=true car deferUpdate déjà fait ligne 524)
    return this.showProgressionRolesMenu(interaction, true);
  }
}

module.exports = new ProgressionRoleAdminHandler();
