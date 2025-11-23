const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const db = require('../utils/database-pg');
const audit = require('../utils/auditLogger');

/**
 * Handler dédié à la gestion des pièges
 * Gère la création, modification et suppression des pièges avec personnalisation complète
 */
class TrapAdminHandler {

  constructor() {
    // Cache pour stocker les données d'upload d'images
    this.imageUploadCache = new Map();
  }

  /**
   * Afficher le menu principal des pièges
   */
  async showTrapsMenu(interaction) {
    // Déférer immédiatement pour éviter l'expiration
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }

    const theme = await db.getActiveTheme(interaction.guildId);

    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif. Crée d\'abord un thème.',
        embeds: [],
        components: []
      });
    }

    const traps = await db.getAllTrapsByTheme(interaction.guildId, theme.id);

    const embed = new EmbedBuilder()
      .setTitle('⚠️ GESTION DES PIÈGES')
      .setDescription(
        `**Thème actuel:** ${theme.name}\n` +
        `**Pièges configurés:** ${traps.length}\n\n` +
        `Ajoute, modifie ou supprime des pièges pour ton jeu.\n\n` +
        `**Légende:**\n` +
        `✅ Actif | ❌ Inactif | \`[DÉFAUT]\` Piège par défaut\n\n` +
        `**Types de pièges disponibles:**\n` +
        `⏱️ **Cooldown** - Empêche l'ouverture de boîtes pendant X minutes\n` +
        `💀 **Perte collectible** - Fait perdre un collectible aléatoire\n` +
        `😱 **Shame public** - Message de honte dans un salon\n` +
        `📦 **Coffre vide** - Le joueur n'obtient rien\n` +
        `☠️ **Perte totale** - Fait perdre TOUS les collectibles`
      )
      .setColor('#e74c3c')
      .setFooter({ text: `Thème: ${theme.name}`, iconURL: interaction.guild.iconURL() })
      .setTimestamp();

    // Afficher la liste des pièges
    if (traps.length > 0) {
      const trapTypes = {
        'cooldown': '⏱️ Cooldown',
        'lose-collectible': '💀 Perte collectible',
        'public-shame': '😱 Shame public',
        'empty-box': '📦 Coffre vide',
        'lose-all-collectibles': '☠️ Perte totale'
      };

      // Grouper par type
      const trapsByType = {};
      traps.forEach(trap => {
        if (!trapsByType[trap.type]) {
          trapsByType[trap.type] = [];
        }
        trapsByType[trap.type].push(trap);
      });

      // Afficher par type
      for (const [type, typedTraps] of Object.entries(trapsByType)) {
        const typeLabel = trapTypes[type] || type;
        const trapsList = typedTraps.map(trap => {
          // Indicateurs de statut
          const statusIcon = trap.is_active ? '✅' : '❌';
          const defaultBadge = trap.is_default ? ' `[DÉFAUT]`' : '';

          let details = `${statusIcon} **${trap.name}**${defaultBadge} (\`${trap.trap_id}\`)`;

          // Ajouter les détails selon le type
          if (trap.type === 'cooldown' && trap.cooldown_duration) {
            details += `\n└─ Durée: ${trap.cooldown_duration} min`;
          } else if (trap.type === 'public-shame' && trap.shame_message) {
            details += `\n└─ ${trap.shame_message.substring(0, 50)}${trap.shame_message.length > 50 ? '...' : ''}`;
          }

          return details;
        }).join('\n\n');

        embed.addFields({
          name: typeLabel,
          value: trapsList || 'Aucun',
          inline: false
        });
      }
    } else {
      embed.addFields({
        name: 'Aucun piège',
        value: 'Clique sur "➕ Ajouter" pour créer ton premier piège !'
      });
    }

    const components = [];

    // Bouton d'ajout
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('trap_add')
        .setLabel('➕ Ajouter un piège')
        .setStyle(ButtonStyle.Danger)
    );

    components.push(actionRow);

    // Si des pièges existent, afficher le select menu
    if (traps.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_trap')
        .setPlaceholder('Sélectionne un piège à modifier/supprimer')
        .addOptions(
          traps.map(trap => {
            const typeEmojis = {
              'cooldown': '⏱️',
              'lose-collectible': '💀',
              'public-shame': '😱',
              'empty-box': '📦',
              'lose-all-collectibles': '☠️'
            };

            return {
              label: trap.name.substring(0, 100),
              value: trap.id.toString(),
              description: `${trap.type} - ${trap.trap_id}`.substring(0, 100),
              emoji: typeEmojis[trap.type] || '⚠️'
            };
          })
        );

      components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    // Bouton retour
    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_settings')
        .setLabel('🔙 Retour au Paramétrage')
        .setStyle(ButtonStyle.Secondary)
    );

    components.push(backRow);

    return interaction.editReply({
      embeds: [embed],
      components,
      content: null
    });
  }

  /**
   * Gérer l'upload d'image pour un piège existant (via thread simple)
   */
  async handleTrapImageUpload(interaction) {
    await interaction.deferUpdate();

    try {
      // Extraire l'ID du piège depuis le customId
      const trapId = parseInt(interaction.customId.replace('trap_upload_image_', ''));

      // Récupérer le piège
      const trap = await db.queryOne(
        'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
        [interaction.guildId, trapId]
      );

      if (!trap) {
        return interaction.followUp({
          content: '❌ Piège introuvable.',
          flags: 64
        });
      }

      // Créer le thread pour l'upload d'image
      const channel = interaction.channel;
      const thread = await channel.threads.create({
        name: `📷 Changer Image - ${trap.name}`,
        autoArchiveDuration: 60,
        type: 12, // PRIVATE_THREAD
        reason: `Upload d'image pour le piège ${trap.name}`
      });

      await thread.members.add(interaction.user.id);

      // Envoyer les instructions dans le thread
      await thread.send({
        content: `📷 **CHANGER L'IMAGE DU PIÈGE**\n\n` +
          `**Piège:** ${trap.name}\n` +
          `**Type:** ${this.getTrapTypeLabel(trap.type)}\n\n` +
          `🎯 **Instructions:**\n` +
          `• Drag & drop ton image ici\n` +
          `• Ou colle un screenshot (Ctrl+V)\n` +
          `• Formats acceptés: PNG, JPG, GIF, WEBP\n\n` +
          `⏱️ Tu as **2 minutes**\n\n` +
          `💡 L'image sera automatiquement mise à jour dans la configuration du piège.`
      });

      // Créer le collector pour l'upload d'image
      const filter = (m) => m.author.id === interaction.user.id && m.attachments.size > 0;
      const collector = thread.createMessageCollector({
        filter,
        time: 120000, // 2 minutes
        max: 1
      });

      collector.on('collect', async (message) => {
        const attachment = message.attachments.first();
        const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

        if (!validImageTypes.includes(attachment.contentType)) {
          await thread.send('❌ Le fichier doit être une image (PNG, JPG, GIF, WEBP).');
          return;
        }

        const imageUrl = attachment.url;

        // Mettre à jour directement dans la base de données
        await db.query(
          'UPDATE traps SET image_url = $1 WHERE guild_id = $2 AND id = $3',
          [imageUrl, interaction.guildId, trapId]
        );

        console.log(`✅ Image du piège ${trap.name} mise à jour: ${imageUrl}`);

        // Bouton pour retourner au piège
        const backButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`trap_back_from_upload_${trapId}`)
            .setLabel('🔙 Retour au Piège')
            .setStyle(ButtonStyle.Primary)
        );

        await thread.send({
          content: `✅ **Image mise à jour avec succès!**\n\n` +
            `📷 **Nouvelle URL:** ${imageUrl}\n\n` +
            `Clique sur le bouton ci-dessous pour retourner au piège, ou ce thread sera archivé dans 30 secondes.`,
          components: [backButton]
        });

        // Auto-archiver après 30 secondes
        setTimeout(async () => {
          try {
            if (thread && !thread.archived) {
              await thread.setArchived(true);
            }
          } catch (error) {
            console.warn('⚠️ Impossible d\'archiver le thread:', error);
          }
        }, 30000);
      });

      collector.on('end', async (collected) => {
        if (collected.size === 0) {
          await thread.send('⏱️ **Temps écoulé.** Aucune image reçue.\n\n🔒 Ce thread sera archivé dans 5 secondes...');
          setTimeout(async () => {
            try {
              await thread.setArchived(true);
            } catch (error) {
              console.warn('⚠️ Impossible d\'archiver le thread:', error);
            }
          }, 5000);
        }
      });

    } catch (error) {
      console.error('❌ Erreur lors de la création du thread d\'upload:', error);
      await interaction.followUp({
        content: '❌ Une erreur est survenue lors de la création du thread.',
        flags: 64
      });
    }
  }

  /**
   * Afficher le sélecteur de type de piège
   */
  async showTrapTypeSelector(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('⚠️ SÉLECTIONNER LE TYPE DE PIÈGE')
      .setDescription(
        `Choisis le type de piège que tu veux créer:\n\n` +
        `⏱️ **Cooldown**\n` +
        `└─ Empêche le joueur d'ouvrir des boîtes pendant X minutes\n\n` +
        `💀 **Perte de collectible**\n` +
        `└─ Fait perdre un collectible aléatoire au joueur\n\n` +
        `😱 **Shame public**\n` +
        `└─ Annonce publiquement que le joueur est tombé dans un piège\n\n` +
        `📦 **Coffre vide**\n` +
        `└─ Le joueur n'obtient rien de sa mystery box\n\n` +
        `☠️ **Perte totale**\n` +
        `└─ Fait perdre TOUS les collectibles du joueur`
      )
      .setColor('#e74c3c');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_trap_type')
      .setPlaceholder('Sélectionne un type de piège...')
      .addOptions(
        {
          label: 'Cooldown',
          value: 'cooldown',
          description: 'Empêche l\'ouverture de boîtes pendant X minutes',
          emoji: '⏱️'
        },
        {
          label: 'Perte de collectible',
          value: 'lose-collectible',
          description: 'Fait perdre un collectible aléatoire',
          emoji: '💀'
        },
        {
          label: 'Shame public',
          value: 'public-shame',
          description: 'Message de honte dans un salon',
          emoji: '😱'
        },
        {
          label: 'Coffre vide',
          value: 'empty-box',
          description: 'Le joueur n\'obtient rien de la mystery box',
          emoji: '📦'
        },
        {
          label: 'Perte totale',
          value: 'lose-all-collectibles',
          description: 'Fait perdre TOUS les collectibles',
          emoji: '☠️'
        }
      );

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_traps')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(selectMenu),
        backRow
      ]
    });
  }


  /**
   * Gérer la sélection du type de piège (affiche le modal de création)
   */
  async handleTrapTypeSelection(interaction) {
    const trapType = interaction.values[0];

    // Créer le modal selon le type
    const modal = new ModalBuilder()
      .setCustomId(`modal_trap_add_${trapType}`)
      .setTitle(`Créer un piège: ${this.getTrapTypeLabel(trapType)}`);

    // Champs communs à tous les types
    const trapIdInput = new TextInputBuilder()
      .setCustomId('trap_id')
      .setLabel('ID unique du piège')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: pomme-empoisonnee')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(100);

    const nameInput = new TextInputBuilder()
      .setCustomId('trap_name')
      .setLabel('Nom du piège')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Pomme Empoisonnée')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('trap_description')
      .setLabel('Description (pour admins)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex: Piège qui empêche l\'ouverture de boîtes pendant 30 min')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500);

    const notifTitleInput = new TextInputBuilder()
      .setCustomId('trap_notif_title')
      .setLabel('Titre notification joueur')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: ⚠️ Piège Activé !')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(100);

    const notifDescInput = new TextInputBuilder()
      .setCustomId('trap_notif_description')
      .setLabel('Description notif (vars dynamiques)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex: Tu es tombé dans un piège ! +{duration} min de cooldown')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1000);

    // Ajouter les champs communs (5 maximum par modal)
    modal.addComponents(
      new ActionRowBuilder().addComponents(trapIdInput),
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(descriptionInput),
      new ActionRowBuilder().addComponents(notifTitleInput),
      new ActionRowBuilder().addComponents(notifDescInput)
    );

    // Note: Les champs spécifiques (durée, points, message de honte) utilisent des valeurs par défaut
    // L'utilisateur peut les modifier après création via le bouton "Modifier"

    return interaction.showModal(modal);
  }

  /**
   * Gérer la soumission du modal d'ajout de piège
   */
  async handleAddTrap(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const trapType = interaction.customId.replace('modal_trap_add_', '');
      const theme = await db.getActiveTheme(interaction.guildId);

      if (!theme) {
        return interaction.editReply({
          content: '❌ Aucun thème actif trouvé.',
          flags: 64
        });
      }

      // Récupérer les champs communs
      const trapId = interaction.fields.getTextInputValue('trap_id').trim();
      const name = interaction.fields.getTextInputValue('trap_name').trim();
      const description = interaction.fields.getTextInputValue('trap_description').trim();

      // L'image sera null au départ, l'utilisateur pourra l'uploader après création
      const imageUrl = null;

      // Récupérer les champs de notification
      const notifTitle = interaction.fields.getTextInputValue('trap_notif_title')?.trim() || null;
      const notifDescription = interaction.fields.getTextInputValue('trap_notif_description')?.trim() || null;

      // Définir les couleurs par défaut selon le type
      const defaultColors = {
        'cooldown': '#f39c12',
        'lose-collectible': '#e74c3c',
        'public-shame': '#9b59b6',
        'empty-box': '#95a5a6',
        'lose-all-collectibles': '#c0392b'
      };
      const notifColor = defaultColors[trapType] || '#e74c3c';

      // Footer par défaut selon le type
      const defaultFooters = {
        'cooldown': 'Le piège se désactivera automatiquement',
        'lose-collectible': 'L\'objet a été retiré de ta collection',
        'public-shame': 'Ta maladresse a été annoncée publiquement',
        'empty-box': 'Pas de chance, le coffre était vide',
        'lose-all-collectibles': 'Tous tes collectibles ont été perdus'
      };
      const notifFooter = defaultFooters[trapType] || 'Tu as déclenché un piège';

      // Vérifier si l'ID existe déjà
      const existing = await db.queryOne(
        'SELECT * FROM traps WHERE guild_id = $1 AND theme_id = $2 AND trap_id = $3',
        [interaction.guildId, theme.id, trapId]
      );

      if (existing) {
        return interaction.editReply({
          content: `❌ Un piège avec l'ID **${trapId}** existe déjà dans ce thème.`,
          flags: 64
        });
      }

      // Préparer les données spécifiques au type avec valeurs par défaut
      let typeData = {
        cooldown_duration: null,
        shame_message: null,
        shame_channel_id: null,
        malus_points: null,
        removes_collectible: trapType === 'lose-collectible'
      };

      // Valeurs par défaut selon le type
      if (trapType === 'cooldown') {
        typeData.cooldown_duration = 30; // 30 minutes par défaut
      }
      else if (trapType === 'public-shame') {
        typeData.shame_message = `🤡 {user} est tombé dans un piège !`; // Message par défaut
        typeData.shame_channel_id = process.env.ANNOUNCE_CHANNEL_ID || null;
      }

      // Insérer le piège dans la base de données avec les champs de notification
      await db.query(
        `INSERT INTO traps (
          guild_id, theme_id, trap_id, name, type, description, image_url,
          cooldown_duration, shame_message, shame_channel_id, malus_points, removes_collectible,
          notif_title, notif_description, notif_color, notif_footer
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          interaction.guildId,
          theme.id,
          trapId,
          name,
          trapType,
          description,
          imageUrl,
          typeData.cooldown_duration,
          typeData.shame_message,
          typeData.shame_channel_id,
          typeData.malus_points,
          typeData.removes_collectible,
          notifTitle,
          notifDescription,
          notifColor,
          notifFooter
        ]
      );

      // Logger l'action
      try {
        await audit.logTrapAdded(
          interaction.guildId,
          interaction.user.id,
          {
            trap_id: trapId,
            name: name,
            type: trapType
          }
        );
      } catch (logError) {
        console.error('⚠️ Erreur de logging (non-bloquante):', logError.message);
      }

      // Créer l'embed de confirmation
      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Piège créé avec succès !')
        .setDescription(
          `**${this.getTrapTypeLabel(trapType)}** créé\n\n` +
          `**Nom:** ${name}\n` +
          `**ID:** \`${trapId}\`\n` +
          `**Description:** ${description}\n\n` +
          `${this.getTrapDetailsText(trapType, typeData)}`
        )
        .setColor('#2ecc71')
        .setThumbnail(imageUrl || null)
        .setFooter({ text: `Thème: ${theme.name}` })
        .setTimestamp();

      await interaction.editReply({
        embeds: [confirmEmbed],
        flags: 64
      });

      console.log(`✅ Piège créé: ${name} (${trapType}) par ${interaction.user.username}`);

      // Retourner au menu pièges après 2 secondes
      setTimeout(async () => {
        try {
          await this.showTrapsMenu(interaction);
        } catch (error) {
          console.error('⚠️ Impossible de revenir au menu:', error.message);
        }
      }, 2000);

    } catch (error) {
      console.error('❌ Erreur lors de la création du piège:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Gérer la sélection d'un piège (pour modification/suppression)
   */
  async handleTrapSelection(interaction) {
    const trapId = parseInt(interaction.values[0]);
    const trap = await db.queryOne(
      'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
      [interaction.guildId, trapId]
    );

    if (!trap) {
      return interaction.update({
        content: '❌ Piège introuvable.',
        embeds: [],
        components: []
      });
    }

    // Indicateurs de statut
    const statusIcon = trap.is_active ? '✅' : '❌';
    const statusText = trap.is_active ? 'Actif' : 'Inactif';
    const defaultBadge = trap.is_default ? ' `[PIÈGE PAR DÉFAUT]`' : '';

    // Créer l'embed de détails
    const embed = new EmbedBuilder()
      .setTitle(`${this.getTrapTypeEmoji(trap.type)} ${trap.name}${defaultBadge}`)
      .setDescription(
        `**Statut:** ${statusIcon} ${statusText}\n` +
        `**Type:** ${this.getTrapTypeLabel(trap.type)}\n` +
        `**ID:** \`${trap.trap_id}\`\n\n` +
        `**Description:**\n${trap.description}\n\n` +
        `${this.getTrapDetailsText(trap.type, trap)}`
      )
      .setColor(trap.is_active ? '#2ecc71' : '#95a5a6')
      .setThumbnail(trap.image_url || null)
      .setFooter({ text: `ID: ${trap.id}` })
      .setTimestamp();

    // Boutons d'action
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`trap_modify_${trapId}`)
        .setLabel('✏️ Modifier')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`trap_upload_image_${trapId}`)
        .setLabel('📷 Changer Image')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`trap_toggle_${trapId}`)
        .setLabel(trap.is_active ? '❌ Désactiver' : '✅ Activer')
        .setStyle(trap.is_active ? ButtonStyle.Secondary : ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`trap_delete_${trapId}`)
        .setLabel('🗑️ Supprimer')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(trap.is_default) // Désactiver si piège par défaut
    );

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_traps')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      embeds: [embed],
      components: [actionRow, backRow]
    });
  }

  /**
   * Activer/Désactiver un piège
   */
  async handleToggleTrap(interaction) {
    await interaction.deferUpdate();

    const trapId = parseInt(interaction.customId.replace('trap_toggle_', ''));

    try {
      // Toggle le statut
      await db.toggleTrapActive(interaction.guildId, trapId);

      // Récupérer le piège mis à jour
      const trap = await db.queryOne(
        'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
        [interaction.guildId, trapId]
      );

      // Loguer l'action
      try {
        const theme = await db.getActiveTheme(interaction.guildId);
        await db.logAction(
          interaction.guildId,
          interaction.user.id,
          trap.is_active ? 'trap_activated' : 'trap_deactivated',
          {
            trap_id: trap.id,
            trap_name: trap.name,
            theme_id: theme.id,
            theme_name: theme.name
          }
        );
      } catch (logError) {
        console.error('⚠️ Erreur de logging (non-bloquante):', logError.message);
      }

      // Re-afficher le menu du piège
      interaction.values = [trapId.toString()];
      await this.handleTrapSelection(interaction);

    } catch (error) {
      console.error('❌ Erreur lors du toggle du piège:', error);
      return interaction.editReply({
        content: `❌ Erreur: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  /**
   * Afficher le modal de modification d'un piège
   */
  async showTrapModifyModal(interaction) {
    const trapId = parseInt(interaction.customId.replace('trap_modify_', ''));
    const trap = await db.queryOne(
      'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
      [interaction.guildId, trapId]
    );

    if (!trap) {
      return interaction.reply({
        content: '❌ Piège introuvable.',
        flags: 64
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_trap_modify_${trapId}`)
      .setTitle(`Modifier: ${(trap.name || 'Piège').substring(0, 35)}`);

    // Champs communs
    const nameInput = new TextInputBuilder()
      .setCustomId('trap_name')
      .setLabel('Nom du piège')
      .setStyle(TextInputStyle.Short)
      .setValue((trap.name || '').substring(0, 100))
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('trap_description')
      .setLabel('Description (pour admins)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue((trap.description || '').substring(0, 500))
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500);

    // Valeurs par défaut pour éviter l'erreur minLength si les champs sont vides en DB
    const defaultNotifTitle = trap.notif_title || '⚠️ Piège activé !';
    const defaultNotifDesc = trap.notif_description || 'Vous avez déclenché un piège ! Effet: ' + trap.name;

    const notifTitleInput = new TextInputBuilder()
      .setCustomId('trap_notif_title')
      .setLabel('Titre notification joueur')
      .setStyle(TextInputStyle.Short)
      .setValue(defaultNotifTitle.substring(0, 100))
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(100);

    const notifDescInput = new TextInputBuilder()
      .setCustomId('trap_notif_description')
      .setLabel('Description notif (vars dynamiques)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(defaultNotifDesc.substring(0, 1000))
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1000);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(descriptionInput),
      new ActionRowBuilder().addComponents(notifTitleInput),
      new ActionRowBuilder().addComponents(notifDescInput)
    );

    // Champ spécifique selon le type
    if (trap.type === 'cooldown') {
      const durationInput = new TextInputBuilder()
        .setCustomId('trap_cooldown_duration')
        .setLabel('Durée du cooldown (minutes)')
        .setStyle(TextInputStyle.Short)
        .setValue(trap.cooldown_duration?.toString() || '30')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(5);

      modal.addComponents(new ActionRowBuilder().addComponents(durationInput));
    }
    else if (trap.type === 'public-shame') {
      const shameMessageInput = new TextInputBuilder()
        .setCustomId('trap_shame_message')
        .setLabel('Message de honte (utilise {player})')
        .setStyle(TextInputStyle.Paragraph)
        .setValue((trap.shame_message || '').substring(0, 500))
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(500);

      modal.addComponents(new ActionRowBuilder().addComponents(shameMessageInput));
    }

    return interaction.showModal(modal);
  }

  /**
   * Gérer la soumission du modal de modification
   */
  async handleModifyTrap(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const trapId = parseInt(interaction.customId.replace('modal_trap_modify_', ''));

      // Récupérer le piège existant
      const trap = await db.queryOne(
        'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
        [interaction.guildId, trapId]
      );

      if (!trap) {
        return interaction.editReply({
          content: '❌ Piège introuvable.',
          flags: 64
        });
      }

      // Récupérer les champs modifiés
      const name = interaction.fields.getTextInputValue('trap_name').trim();
      const description = interaction.fields.getTextInputValue('trap_description').trim();
      const notifTitle = interaction.fields.getTextInputValue('trap_notif_title')?.trim() || null;
      const notifDescription = interaction.fields.getTextInputValue('trap_notif_description')?.trim() || null;

      // Préparer les données spécifiques au type
      let updateData = {
        name,
        description,
        notif_title: notifTitle,
        notif_description: notifDescription
      };

      if (trap.type === 'cooldown') {
        const duration = parseInt(interaction.fields.getTextInputValue('trap_cooldown_duration'));
        if (isNaN(duration) || duration < 1) {
          return interaction.editReply({
            content: '❌ La durée du cooldown doit être un nombre positif.',
            flags: 64
          });
        }
        updateData.cooldown_duration = duration;
      }
      else if (trap.type === 'public-shame') {
        const message = interaction.fields.getTextInputValue('trap_shame_message').trim();
        updateData.shame_message = message;
      }

      // Construire la requête UPDATE dynamiquement
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      }

      updateValues.push(interaction.guildId);
      updateValues.push(trapId);

      await db.query(
        `UPDATE traps SET ${updateFields.join(', ')} WHERE guild_id = $${paramIndex} AND id = $${paramIndex + 1}`,
        updateValues
      );

      // Logger l'action
      try {
        await audit.logAction(
          interaction.guildId,
          interaction.user.id,
          'trap_modified',
          {
            trap_id: trap.trap_id,
            name: name,
            old_values: {
              name: trap.name,
              description: trap.description
            },
            new_values: updateData
          }
        );
      } catch (logError) {
        console.error('⚠️ Erreur de logging (non-bloquante):', logError.message);
      }

      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Piège modifié avec succès !')
        .setDescription(
          `**${name}** a été mis à jour\n\n` +
          `**Type:** ${this.getTrapTypeLabel(trap.type)}\n` +
          `**Description:** ${description}\n\n` +
          `**Notification:** ${notifTitle}`
        )
        .setColor('#2ecc71')
        .setThumbnail(trap.image_url || null)
        .setTimestamp();

      await interaction.editReply({
        embeds: [confirmEmbed],
        flags: 64
      });

      console.log(`✅ Piège modifié: ${name} par ${interaction.user.username}`);

      // Retourner au menu pièges
      setTimeout(async () => {
        try {
          await this.showTrapsMenu(interaction);
        } catch (error) {
          console.error('⚠️ Impossible de revenir au menu:', error.message);
        }
      }, 2000);

    } catch (error) {
      console.error('❌ Erreur lors de la modification du piège:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Afficher la confirmation de suppression
   */
  async showDeleteConfirmation(interaction) {
    const trapId = parseInt(interaction.customId.replace('trap_delete_', ''));
    const trap = await db.queryOne(
      'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
      [interaction.guildId, trapId]
    );

    if (!trap) {
      return interaction.update({
        content: '❌ Piège introuvable.',
        embeds: [],
        components: []
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('⚠️ CONFIRMATION DE SUPPRESSION')
      .setDescription(
        `Es-tu sûr de vouloir supprimer ce piège ?\n\n` +
        `**${trap.name}**\n` +
        `Type: ${this.getTrapTypeLabel(trap.type)}\n` +
        `ID: \`${trap.trap_id}\`\n\n` +
        `⚠️ **Cette action est irréversible !**`
      )
      .setColor('#e74c3c')
      .setThumbnail(trap.image_url || null);

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`trap_delete_confirm_${trapId}`)
        .setLabel('✅ Confirmer la suppression')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`select_trap_cancel_${trapId}`)
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.update({
      embeds: [embed],
      components: [confirmRow]
    });
  }

  /**
   * Gérer la suppression confirmée d'un piège
   */
  async handleDeleteTrap(interaction) {
    await interaction.deferUpdate();

    try {
      const trapId = parseInt(interaction.customId.replace('trap_delete_confirm_', ''));

      const trap = await db.queryOne(
        'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
        [interaction.guildId, trapId]
      );

      if (!trap) {
        return interaction.followUp({
          content: '❌ Piège introuvable.',
          flags: 64
        });
      }

      // Supprimer le piège
      await db.query(
        'DELETE FROM traps WHERE guild_id = $1 AND id = $2',
        [interaction.guildId, trapId]
      );

      // Logger l'action
      try {
        await audit.logAction(
          interaction.guildId,
          interaction.user.id,
          'trap_deleted',
          {
            trap_id: trap.trap_id,
            name: trap.name,
            type: trap.type
          }
        );
      } catch (logError) {
        console.error('⚠️ Erreur de logging (non-bloquante):', logError.message);
      }

      await interaction.followUp({
        content: `✅ Le piège **${trap.name}** a été supprimé avec succès.`,
        flags: 64
      });

      console.log(`✅ Piège supprimé: ${trap.name} par ${interaction.user.username}`);

      // Retourner au menu pièges
      setTimeout(async () => {
        try {
          await this.showTrapsMenu(interaction);
        } catch (error) {
          console.error('⚠️ Impossible de revenir au menu:', error.message);
        }
      }, 1500);

    } catch (error) {
      console.error('❌ Erreur lors de la suppression du piège:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Annuler la sélection (retour au détail du piège)
   */
  async handleCancelSelection(interaction) {
    const trapId = parseInt(interaction.customId.replace('select_trap_cancel_', ''));

    // Re-sélectionner le piège pour afficher ses détails
    interaction.values = [trapId.toString()];
    await this.handleTrapSelection(interaction);
  }

  /**
   * Retourner au piège depuis le thread d'upload
   */
  async handleBackFromUpload(interaction) {
    try {
      // Archiver immédiatement le thread pour retourner au salon
      const thread = interaction.channel;
      if (thread && thread.isThread()) {
        await interaction.reply({
          content: '✅ Retour au salon...',
          flags: 64
        });

        // Archiver après 2 secondes
        setTimeout(async () => {
          try {
            await thread.setArchived(true);
          } catch (error) {
            console.warn('⚠️ Impossible d\'archiver le thread:', error);
          }
        }, 2000);
      } else {
        await interaction.reply({
          content: '❌ Erreur: ceci n\'est pas un thread.',
          flags: 64
        });
      }
    } catch (error) {
      console.error('❌ Erreur lors du retour:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Une erreur est survenue.',
          flags: 64
        });
      }
    }
  }

  /**
   * Gérer l'annulation depuis le thread d'upload
   */
  async handleThreadCancel(interaction) {
    await interaction.deferUpdate();

    try {
      // Nettoyer le cache
      this.imageUploadCache.delete(interaction.user.id);

      // Archiver le thread
      const thread = interaction.channel;
      if (thread && thread.isThread()) {
        await thread.send('❌ **Création annulée.**\n\n🔒 Ce thread sera archivé dans 3 secondes...');
        setTimeout(async () => {
          try {
            await thread.setArchived(true);
          } catch (error) {
            console.warn('⚠️ Impossible d\'archiver le thread:', error);
          }
        }, 3000);
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'annulation:', error);
    }
  }

  // ============================================
  // MÉTHODES UTILITAIRES
  // ============================================

  /**
   * Obtenir le label d'un type de piège
   */
  getTrapTypeLabel(type) {
    const labels = {
      'cooldown': 'Cooldown',
      'lose-collectible': 'Perte de collectible',
      'public-shame': 'Shame public',
      'empty-box': 'Coffre vide',
      'lose-all-collectibles': 'Perte totale'
    };
    return labels[type] || type;
  }

  /**
   * Obtenir l'emoji d'un type de piège
   */
  getTrapTypeEmoji(type) {
    const emojis = {
      'cooldown': '⏱️',
      'lose-collectible': '💀',
      'public-shame': '😱',
      'empty-box': '📦',
      'lose-all-collectibles': '☠️'
    };
    return emojis[type] || '⚠️';
  }

  /**
   * Obtenir le texte de détails d'un piège
   */
  getTrapDetailsText(type, data) {
    if (type === 'cooldown' && data.cooldown_duration) {
      return `⏱️ **Durée:** ${data.cooldown_duration} minute${data.cooldown_duration > 1 ? 's' : ''}`;
    } else if (type === 'public-shame' && data.shame_message) {
      return `😱 **Message:**\n${data.shame_message}`;
    } else if (type === 'lose-collectible') {
      return `💀 **Effet:** Retire un collectible aléatoire du joueur`;
    } else if (type === 'empty-box') {
      return `📦 **Effet:** Le joueur n'obtient rien de la mystery box`;
    } else if (type === 'lose-all-collectibles') {
      return `☠️ **Effet:** Retire TOUS les collectibles du joueur`;
    }
    return '';
  }

  /**
   * Gérer les interactions (router principal)
   */
  async handleInteraction(interaction) {
    const customId = interaction.customId;

    try {
      // Menu principal
      if (customId === 'admin_traps') {
        return this.showTrapsMenu(interaction);
      }
      // Boutons
      else if (customId === 'trap_add') {
        await this.showTrapTypeSelector(interaction);
      }
      else if (customId.startsWith('trap_modify_')) {
        await this.showTrapModifyModal(interaction);
      }
      else if (customId.startsWith('trap_upload_image_')) {
        await this.handleTrapImageUpload(interaction);
      }
      else if (customId.startsWith('trap_back_from_upload_')) {
        await this.handleBackFromUpload(interaction);
      }
      else if (customId.startsWith('trap_toggle_')) {
        await this.handleToggleTrap(interaction);
      }
      else if (customId.startsWith('trap_delete_') && !customId.includes('confirm')) {
        await this.showDeleteConfirmation(interaction);
      }
      else if (customId.startsWith('trap_delete_confirm_')) {
        await this.handleDeleteTrap(interaction);
      }
      else if (customId.startsWith('select_trap_cancel_')) {
        await this.handleCancelSelection(interaction);
      }
      else if (customId === 'thread_cancel_trap') {
        await this.handleThreadCancel(interaction);
      }
      // Select menus
      else if (customId === 'select_trap') {
        await this.handleTrapSelection(interaction);
      }
      else if (customId === 'select_trap_type') {
        await this.handleTrapTypeSelection(interaction);
      }
      // Modals
      else if (customId.startsWith('modal_trap_add_')) {
        await this.handleAddTrap(interaction);
      }
      else if (customId.startsWith('modal_trap_modify_')) {
        await this.handleModifyTrap(interaction);
      }
    } catch (error) {
      console.error('❌ Erreur dans trapAdminHandler:', error);

      const errorMessage = {
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      };

      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else if (!interaction.replied) {
        await interaction.reply(errorMessage);
      }
    }
  }
}

module.exports = new TrapAdminHandler();
