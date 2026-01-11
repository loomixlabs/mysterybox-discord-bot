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
        `☠️ **Perte totale** - Fait perdre TOUS les collectibles\n` +
        `🎭 **Pseudo Honteux** - Change le pseudo du joueur temporairement`
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
        'lose-all-collectibles': '☠️ Perte totale',
        'shame-nickname': '🎭 Pseudo Honteux'
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

          // Indicateur de sévérité (1-5 étoiles)
          const severityStars = '⭐'.repeat(trap.severity || 3);
          const severityLabels = { 1: 'Minor', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Extreme' };
          const severityLabel = severityLabels[trap.severity] || 'Medium';

          let details = `${statusIcon} **${trap.name}**${defaultBadge} (\`${trap.trap_id}\`)`;
          details += `\n└─ Sévérité: ${severityStars} (${severityLabel})`;

          // Ajouter les détails selon le type
          if (trap.type === 'cooldown' && trap.cooldown_duration) {
            details += `\n└─ Durée: ${trap.cooldown_duration} min`;
          } else if (trap.type === 'public-shame' && trap.shame_message) {
            details += `\n└─ ${trap.shame_message.substring(0, 50)}${trap.shame_message.length > 50 ? '...' : ''}`;
          } else if (trap.type === 'shame-nickname' && trap.cooldown_duration) {
            const nicknames = trap.shame_nicknames || [];
            details += `\n└─ Durée: ${trap.cooldown_duration} min`;
            details += `\n└─ ${nicknames.length} pseudo(s) configuré(s)`;
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
              'lose-all-collectibles': '☠️',
              'shame-nickname': '🎭'
            };

            // Afficher la sévérité dans la description
            const severityStars = '⭐'.repeat(trap.severity || 3);

            return {
              label: trap.name.substring(0, 100),
              value: trap.id.toString(),
              description: `${severityStars} | ${trap.type} - ${trap.trap_id}`.substring(0, 100),
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
          `• Ou colle une **URL d'image** (https://...)\n` +
          `• Formats acceptés: PNG, JPG, GIF, WEBP\n\n` +
          `⏱️ Tu as **2 minutes**\n\n` +
          `💡 L'image sera automatiquement mise à jour dans la configuration du piège.`
      });

      // Créer le collector pour l'upload d'image (attachment OU URL)
      const filter = (m) => {
        if (m.author.id !== interaction.user.id) return false;
        if (m.attachments.size > 0) return true;
        const urlPattern = /https?:\/\/[^\s]+/i;
        if (urlPattern.test(m.content)) return true;
        return false;
      };
      const collector = thread.createMessageCollector({
        filter,
        time: 120000, // 2 minutes
        max: 1
      });

      collector.on('collect', async (message) => {
        let imageUrl;

        // Cas 1: Attachment (fichier uploadé)
        if (message.attachments.size > 0) {
          const attachment = message.attachments.first();
          const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

          if (!validImageTypes.includes(attachment.contentType)) {
            await thread.send('❌ Le fichier doit être une image (PNG, JPG, GIF, WEBP).');
            return;
          }

          imageUrl = attachment.url;
        }
        // Cas 2: URL collée
        else {
          const urlPattern = /https?:\/\/[^\s]+/i;
          const match = message.content.match(urlPattern);
          if (match) {
            imageUrl = match[0].replace(/[<>)}\]]+$/, '');
          } else {
            await thread.send('❌ URL invalide. Colle une URL commençant par http:// ou https://');
            return;
          }
        }

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
        `└─ Fait perdre TOUS les collectibles du joueur\n\n` +
        `🎭 **Pseudo Honteux**\n` +
        `└─ Change le pseudo du joueur temporairement (durée configurable)`
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
        },
        {
          label: 'Pseudo Honteux',
          value: 'shame-nickname',
          description: 'Change le pseudo du joueur temporairement',
          emoji: '🎭'
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
   * Gérer la sélection du type de piège (affiche le sélecteur de sévérité)
   */
  async handleTrapTypeSelection(interaction) {
    const trapType = interaction.values[0];

    // Afficher le sélecteur de sévérité (étape intermédiaire)
    await this.showSeveritySelector(interaction, trapType);
  }

  /**
   * Afficher le sélecteur de sévérité pour un piège
   */
  async showSeveritySelector(interaction, trapType) {
    const embed = new EmbedBuilder()
      .setTitle(`⚠️ SÉLECTIONNER LA SÉVÉRITÉ`)
      .setDescription(
        `**Type de piège:** ${this.getTrapTypeEmoji(trapType)} ${this.getTrapTypeLabel(trapType)}\n\n` +
        `Choisis le niveau de sévérité du piège:\n\n` +
        `⭐ **Minor (1)** - 45% de chance\n` +
        `└─ Effets mineurs, aucune perte réelle\n\n` +
        `⭐⭐ **Low (2)** - 30% de chance\n` +
        `└─ Inconvénients temporaires (cooldown)\n\n` +
        `⭐⭐⭐ **Medium (3)** - 15% de chance\n` +
        `└─ Perte modérée (1 collectible)\n\n` +
        `⭐⭐⭐⭐ **High (4)** - 8% de chance\n` +
        `└─ Pertes multiples + effets sociaux\n\n` +
        `⭐⭐⭐⭐⭐ **Extreme (5)** - 2% de chance\n` +
        `└─ Catastrophe totale (perte complète)`
      )
      .setColor('#e74c3c');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_trap_severity_${trapType}`)
      .setPlaceholder('Sélectionne la sévérité...')
      .addOptions([
        {
          label: 'Minor (⭐)',
          value: '1',
          description: 'Effets mineurs, aucune perte - 45% de chance',
          emoji: '1️⃣'
        },
        {
          label: 'Low (⭐⭐)',
          value: '2',
          description: 'Inconvénients temporaires - 30% de chance',
          emoji: '2️⃣'
        },
        {
          label: 'Medium (⭐⭐⭐)',
          value: '3',
          description: 'Perte modérée - 15% de chance',
          emoji: '3️⃣'
        },
        {
          label: 'High (⭐⭐⭐⭐)',
          value: '4',
          description: 'Pertes multiples - 8% de chance',
          emoji: '4️⃣'
        },
        {
          label: 'Extreme (⭐⭐⭐⭐⭐)',
          value: '5',
          description: 'Catastrophe totale - 2% de chance',
          emoji: '5️⃣'
        }
      ]);

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('trap_add')
        .setLabel('🔙 Retour au choix du type')
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
   * Gérer la sélection de la sévérité (affiche le modal de création)
   */
  async handleSeveritySelection(interaction) {
    // Format: select_trap_severity_TYPE
    const trapType = interaction.customId.replace('select_trap_severity_', '');
    const severity = parseInt(interaction.values[0]);

    // Valeurs pré-remplies selon le type de piège
    const defaultValues = {
      'cooldown': {
        description: 'Un piège qui bloque temporairement l\'ouverture de boîtes mystère pendant une durée déterminée.',
        notifTitle: '⏱️ Piège Temporel !',
        notifDesc: '**Oups !** Tu es tombé dans un piège temporel !\n\nTu ne peux plus ouvrir de boîtes mystère pendant **{duration} minutes**.\n\n💡 Utilise ce temps pour préparer ta prochaine ouverture !'
      },
      'lose-collectible': {
        description: 'Un piège vicieux qui vole un collectible aléatoire de la collection du joueur.',
        notifTitle: '💀 Piège Voleur !',
        notifDesc: '**Oh non !** Un piège vicieux t\'a volé un objet !\n\n🎁 **Objet perdu:** {collectible}\n\n⚠️ Sois plus prudent la prochaine fois !'
      },
      'public-shame': {
        description: 'Un piège qui expose publiquement l\'échec du joueur devant tout le serveur.',
        notifTitle: '😱 Piège de la Honte !',
        notifDesc: '**Aïe !** Tu as déclenché le piège de la honte publique !\n\n🤡 Tout le monde va savoir que tu es tombé dans ce piège ridicule.\n\n💡 Essaye de mieux faire la prochaine fois !'
      },
      'empty-box': {
        description: 'Un piège frustrant où le joueur n\'obtient absolument rien. La boîte est vide !',
        notifTitle: '📦 BOÎTE VIDE !',
        notifDesc: '**Sérieusement ?** Tu as ouvert une boîte... complètement vide !\n\n🤷 Pas de collectible, pas de mission, rien du tout. Juste le néant.\n\n💡 Au moins tu n\'as rien perdu !'
      },
      'lose-all-collectibles': {
        description: 'Un piège catastrophique et dévastateur qui fait perdre TOUS les collectibles du joueur d\'un seul coup.',
        notifTitle: '💥 PIÈGE DÉVASTATEUR !',
        notifDesc: '**CATASTROPHE TOTALE !** Ce piège apocalyptique a effacé **TOUS TES COLLECTIBLES** !\n\n💔 **{count} objet(s) perdu(s)** d\'un seul coup...\n\n⚠️ Ta collection a été complètement anéantie !'
      },
      'shame-nickname': {
        description: 'Un piège humiliant qui change temporairement le pseudo du joueur par un pseudo honteux. Impossible de le changer jusqu\'à expiration !',
        notifTitle: '🎭 PSEUDO HONTEUX !',
        notifDesc: '**Oh non !** Tu es victime du piège du Pseudo Honteux !\n\n🏷️ Ton nouveau pseudo: **{nickname}**\n⏰ Durée: **{duration} minutes**\n\n💡 Impossible de changer ton pseudo pendant la durée du piège !'
      }
    };

    const defaults = defaultValues[trapType] || {
      description: 'Description du piège personnalisé',
      notifTitle: '⚠️ Piège Activé !',
      notifDesc: 'Tu es tombé dans un piège !'
    };

    // Créer le modal avec type ET severity dans le customId
    const modal = new ModalBuilder()
      .setCustomId(`modal_trap_add_${trapType}_${severity}`)
      .setTitle(`Créer: ${this.getTrapTypeLabel(trapType)} (S${severity})`);

    // Champs communs à tous les types
    const trapIdInput = new TextInputBuilder()
      .setCustomId('trap_id')
      .setLabel('ID unique du piège')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: pomme-empoisonnee, piege-temporel-2')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(100);

    const nameInput = new TextInputBuilder()
      .setCustomId('trap_name')
      .setLabel('Nom du piège')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Pomme Empoisonnée, Coffre Maudit')
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(100);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('trap_description')
      .setLabel('Description (pour admins)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(defaults.description)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(500);

    const notifTitleInput = new TextInputBuilder()
      .setCustomId('trap_notif_title')
      .setLabel('Titre notification joueur')
      .setStyle(TextInputStyle.Short)
      .setValue(defaults.notifTitle)
      .setRequired(true)
      .setMinLength(3)
      .setMaxLength(100);

    const notifDescInput = new TextInputBuilder()
      .setCustomId('trap_notif_description')
      .setLabel('Description notification')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Vars: {duration}, {collectible}, {count}')
      .setValue(defaults.notifDesc)
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
      // Format: modal_trap_add_TYPE_SEVERITY (ex: modal_trap_add_cooldown_2)
      const customIdParts = interaction.customId.replace('modal_trap_add_', '').split('_');
      // Le dernier élément est la sévérité (si présente), le reste est le type
      let trapType, severity;

      if (customIdParts.length >= 2 && !isNaN(parseInt(customIdParts[customIdParts.length - 1]))) {
        // Nouveau format avec sévérité
        severity = parseInt(customIdParts.pop());
        trapType = customIdParts.join('-'); // Reconstituer le type (ex: lose-collectible)
      } else {
        // Ancien format sans sévérité (fallback)
        trapType = customIdParts.join('-');
        severity = 3; // Default: Medium
      }

      console.log(`📋 Création piège: type=${trapType}, severity=${severity}`);

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
      else if (trapType === 'shame-nickname') {
        typeData.cooldown_duration = 60; // 60 minutes par défaut
        typeData.shame_nicknames = [
          '🐔 Poulet Piégé',
          '🤡 Clown du Serveur',
          '💩 Victime du Jour',
          '🐌 Escargot Lent',
          '🦆 Canard Malchanceux'
        ];
      }

      // Insérer le piège dans la base de données avec les champs de notification ET sévérité
      await db.query(
        `INSERT INTO traps (
          guild_id, theme_id, trap_id, name, type, severity, description, image_url,
          cooldown_duration, shame_message, shame_channel_id, malus_points, removes_collectible,
          notif_title, notif_description, notif_color, notif_footer, shame_nicknames
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          interaction.guildId,
          theme.id,
          trapId,
          name,
          trapType,
          severity, // Nouvelle colonne sévérité
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
          notifFooter,
          typeData.shame_nicknames ? JSON.stringify(typeData.shame_nicknames) : null
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

      // Créer l'embed de confirmation avec sévérité
      const severityStars = '⭐'.repeat(severity);
      const severityLabels = { 1: 'Minor', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Extreme' };
      const severityLabel = severityLabels[severity] || 'Medium';

      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Piège créé avec succès !')
        .setDescription(
          `**${this.getTrapTypeLabel(trapType)}** créé\n\n` +
          `**Nom:** ${name}\n` +
          `**ID:** \`${trapId}\`\n` +
          `**Sévérité:** ${severityStars} (${severityLabel})\n` +
          `**Description:** ${description}\n\n` +
          `${this.getTrapDetailsText(trapType, typeData)}`
        )
        .setColor('#2ecc71')
        .setThumbnail(imageUrl || null)
        .setFooter({ text: `Thème: ${theme.name} | Sévérité: ${severity}/5` })
        .setTimestamp();

      await interaction.editReply({
        embeds: [confirmEmbed],
        flags: 64
      });

      console.log(`✅ Piège créé: ${name} (${trapType}, S${severity}) par ${interaction.user.username}`);

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

    // Indicateur de sévérité
    const severityStars = '⭐'.repeat(trap.severity || 3);
    const severityLabels = { 1: 'Minor', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Extreme' };
    const severityLabel = severityLabels[trap.severity] || 'Medium';

    // Créer l'embed de détails
    const embed = new EmbedBuilder()
      .setTitle(`${this.getTrapTypeEmoji(trap.type)} ${trap.name}${defaultBadge}`)
      .setDescription(
        `**Statut:** ${statusIcon} ${statusText}\n` +
        `**Type:** ${this.getTrapTypeLabel(trap.type)}\n` +
        `**Sévérité:** ${severityStars} (${severityLabel})\n` +
        `**ID:** \`${trap.trap_id}\`\n\n` +
        `**Description:**\n${trap.description}\n\n` +
        `${this.getTrapDetailsText(trap.type, trap)}`
      )
      .setColor(trap.is_active ? '#2ecc71' : '#95a5a6')
      .setThumbnail(trap.image_url || null)
      .setFooter({ text: `ID: ${trap.id} | Sévérité: ${trap.severity || 3}/5` })
      .setTimestamp();

    // Boutons d'action - Ligne 1
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`trap_modify_${trapId}`)
        .setLabel('✏️ Modifier')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`trap_change_severity_${trapId}`)
        .setLabel(`⚠️ Sévérité (${trap.severity || 3})`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`trap_upload_image_${trapId}`)
        .setLabel('📷 Image')
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

    const components = [actionRow];

    // Ajouter une ligne spéciale pour shame-nickname (gestion des pseudos + durée)
    if (trap.type === 'shame-nickname') {
      const nicknameRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trap_manage_nicknames_${trapId}`)
          .setLabel('🏷️ Gérer les Pseudos')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`trap_change_duration_${trapId}`)
          .setLabel(`⏱️ Durée (${trap.cooldown_duration || 60} min)`)
          .setStyle(ButtonStyle.Secondary)
      );
      components.push(nicknameRow);
    }

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_traps')
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );
    components.push(backRow);

    return interaction.update({
      embeds: [embed],
      components
    });
  }

  /**
   * Afficher le sélecteur de sévérité pour modifier un piège existant
   */
  async showChangeSeveritySelector(interaction) {
    const trapId = parseInt(interaction.customId.replace('trap_change_severity_', ''));
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

    const currentSeverity = trap.severity || 3;
    const currentStars = '⭐'.repeat(currentSeverity);

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ MODIFIER LA SÉVÉRITÉ`)
      .setDescription(
        `**Piège:** ${trap.name}\n` +
        `**Type:** ${this.getTrapTypeEmoji(trap.type)} ${this.getTrapTypeLabel(trap.type)}\n\n` +
        `**Sévérité actuelle:** ${currentStars} (${currentSeverity}/5)\n\n` +
        `Choisis le nouveau niveau de sévérité:\n\n` +
        `⭐ **Minor (1)** - 45% de chance\n` +
        `⭐⭐ **Low (2)** - 30% de chance\n` +
        `⭐⭐⭐ **Medium (3)** - 15% de chance\n` +
        `⭐⭐⭐⭐ **High (4)** - 8% de chance\n` +
        `⭐⭐⭐⭐⭐ **Extreme (5)** - 2% de chance`
      )
      .setColor('#f39c12')
      .setThumbnail(trap.image_url || null);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_change_trap_severity_${trapId}`)
      .setPlaceholder('Sélectionne la nouvelle sévérité...')
      .addOptions([
        {
          label: 'Minor (⭐)',
          value: '1',
          description: 'Effets mineurs, aucune perte - 45% de chance',
          emoji: '1️⃣',
          default: currentSeverity === 1
        },
        {
          label: 'Low (⭐⭐)',
          value: '2',
          description: 'Inconvénients temporaires - 30% de chance',
          emoji: '2️⃣',
          default: currentSeverity === 2
        },
        {
          label: 'Medium (⭐⭐⭐)',
          value: '3',
          description: 'Perte modérée - 15% de chance',
          emoji: '3️⃣',
          default: currentSeverity === 3
        },
        {
          label: 'High (⭐⭐⭐⭐)',
          value: '4',
          description: 'Pertes multiples - 8% de chance',
          emoji: '4️⃣',
          default: currentSeverity === 4
        },
        {
          label: 'Extreme (⭐⭐⭐⭐⭐)',
          value: '5',
          description: 'Catastrophe totale - 2% de chance',
          emoji: '5️⃣',
          default: currentSeverity === 5
        }
      ]);

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`select_trap_cancel_${trapId}`)
        .setLabel('🔙 Annuler')
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
   * Gérer le changement de sévérité d'un piège existant
   */
  async handleChangeSeverity(interaction) {
    await interaction.deferUpdate();

    // Format: select_change_trap_severity_ID
    const trapId = parseInt(interaction.customId.replace('select_change_trap_severity_', ''));
    const newSeverity = parseInt(interaction.values[0]);

    try {
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

      const oldSeverity = trap.severity || 3;

      // Mettre à jour la sévérité
      await db.query(
        'UPDATE traps SET severity = $1 WHERE guild_id = $2 AND id = $3',
        [newSeverity, interaction.guildId, trapId]
      );

      // Logger l'action
      try {
        await audit.logAction(
          interaction.guildId,
          interaction.user.id,
          'trap_severity_changed',
          {
            trap_id: trap.trap_id,
            name: trap.name,
            old_severity: oldSeverity,
            new_severity: newSeverity
          }
        );
      } catch (logError) {
        console.error('⚠️ Erreur de logging (non-bloquante):', logError.message);
      }

      const severityLabels = { 1: 'Minor', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Extreme' };
      const newStars = '⭐'.repeat(newSeverity);
      const oldStars = '⭐'.repeat(oldSeverity);

      await interaction.followUp({
        content: `✅ **Sévérité modifiée!**\n\n` +
          `**Piège:** ${trap.name}\n` +
          `**Avant:** ${oldStars} (${severityLabels[oldSeverity]})\n` +
          `**Après:** ${newStars} (${severityLabels[newSeverity]})`,
        flags: 64
      });

      console.log(`✅ Sévérité modifiée: ${trap.name} (${oldSeverity} → ${newSeverity}) par ${interaction.user.username}`);

      // Retourner au détail du piège
      setTimeout(async () => {
        try {
          interaction.values = [trapId.toString()];
          await this.handleTrapSelection(interaction);
        } catch (error) {
          console.error('⚠️ Impossible de revenir au détail:', error.message);
        }
      }, 1500);

    } catch (error) {
      console.error('❌ Erreur lors du changement de sévérité:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Activer/Désactiver un piège
   */
  async handleToggleTrap(interaction) {
    // Ne pas deferUpdate ici car handleTrapSelection fait déjà un update()
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

      // Re-afficher le menu du piège (cette fonction fait son propre update())
      interaction.values = [trapId.toString()];
      await this.handleTrapSelection(interaction);

    } catch (error) {
      console.error('❌ Erreur lors du toggle du piège:', error);
      return interaction.update({
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
    // Note: Pour shame-nickname, la durée se modifie via le bouton "⏱️ Durée" (pas dans le modal)

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
      // Note: Pour shame-nickname, la durée se modifie via le bouton "⏱️ Durée" séparément

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
  // GESTION DES PSEUDOS HONTEUX
  // ============================================

  /**
   * Afficher l'interface de gestion des pseudos honteux
   */
  async showNicknameManager(interaction) {
    await interaction.deferUpdate();

    const trapId = parseInt(interaction.customId.replace('trap_manage_nicknames_', ''));
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

    // Parser les nicknames existants
    let nicknames = [];
    if (trap.shame_nicknames) {
      nicknames = Array.isArray(trap.shame_nicknames)
        ? trap.shame_nicknames
        : (typeof trap.shame_nicknames === 'string' ? JSON.parse(trap.shame_nicknames) : []);
    }

    const embed = new EmbedBuilder()
      .setTitle('🏷️ GESTION DES PSEUDOS HONTEUX')
      .setDescription(
        `**Piège:** ${trap.name}\n` +
        `**Durée:** ${trap.cooldown_duration || 60} minutes\n\n` +
        `**Pseudos configurés (${nicknames.length}):**\n` +
        (nicknames.length > 0
          ? nicknames.map((n, i) => `${i + 1}. ${n}`).join('\n')
          : '_Aucun pseudo configuré_'
        ) +
        `\n\n💡 **Astuce:** Un pseudo sera choisi aléatoirement dans cette liste quand le piège se déclenche.`
      )
      .setColor('#9b59b6')
      .setThumbnail(trap.image_url || null)
      .setFooter({ text: `Max: 20 pseudos | ${nicknames.length}/20` });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`trap_add_nickname_${trapId}`)
        .setLabel('➕ Ajouter')
        .setStyle(ButtonStyle.Success)
        .setDisabled(nicknames.length >= 20),
      new ButtonBuilder()
        .setCustomId(`trap_remove_nickname_${trapId}`)
        .setLabel('➖ Supprimer un')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(nicknames.length === 0),
      new ButtonBuilder()
        .setCustomId(`trap_clear_nicknames_${trapId}`)
        .setLabel('🗑️ Tout vider')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(nicknames.length === 0),
      new ButtonBuilder()
        .setCustomId(`trap_reset_nicknames_${trapId}`)
        .setLabel('🔄 Défauts')
        .setStyle(ButtonStyle.Secondary)
    );

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`select_trap_cancel_${trapId}`)
        .setLabel('🔙 Retour au piège')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, backRow]
    });
  }

  /**
   * Demander l'ajout d'un pseudo via le chat
   */
  async promptAddNicknameViaChat(interaction) {
    await interaction.deferUpdate();

    const trapId = parseInt(interaction.customId.replace('trap_add_nickname_', ''));

    // Récupérer le piège pour vérifier le nombre de pseudos
    const trap = await db.queryOne(
      'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
      [interaction.guildId, trapId]
    );

    if (!trap) {
      return interaction.followUp({ content: '❌ Piège introuvable.', flags: 64 });
    }

    let nicknames = [];
    if (trap.shame_nicknames) {
      nicknames = Array.isArray(trap.shame_nicknames)
        ? trap.shame_nicknames
        : (typeof trap.shame_nicknames === 'string' ? JSON.parse(trap.shame_nicknames) : []);
    }

    if (nicknames.length >= 20) {
      return interaction.followUp({ content: '❌ Maximum 20 pseudos atteint.', flags: 64 });
    }

    // Envoyer le message de demande
    const promptMsg = await interaction.followUp({
      content: `🏷️ **Ajouter un pseudo honteux**\n\n` +
        `Écris le pseudo dans le chat (max 32 caractères).\n` +
        `Tu peux utiliser des emojis ! Ex: \`🐔 Poulet Piégé\`\n\n` +
        `⏱️ Tu as **2 minutes** pour répondre.\n` +
        `📊 Pseudos actuels: ${nicknames.length}/20`,
      flags: 64
    });

    // Créer un collecteur de messages
    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 120000, // 2 minutes
      max: 1
    });

    collector.on('collect', async (message) => {
      const newNickname = message.content.trim().substring(0, 32);

      // Supprimer le message de l'utilisateur
      try {
        await message.delete();
      } catch (e) {
        // Ignorer si pas les permissions
      }

      if (newNickname.length < 3) {
        return interaction.followUp({
          content: '❌ Le pseudo doit faire au moins 3 caractères.',
          flags: 64
        });
      }

      // Vérifier les doublons
      if (nicknames.includes(newNickname)) {
        return interaction.followUp({
          content: '❌ Ce pseudo existe déjà dans la liste.',
          flags: 64
        });
      }

      // Ajouter le pseudo
      nicknames.push(newNickname);

      try {
        await db.query(
          'UPDATE traps SET shame_nicknames = $1 WHERE guild_id = $2 AND id = $3',
          [JSON.stringify(nicknames), interaction.guildId, trapId]
        );

        await interaction.followUp({
          content: `✅ Pseudo ajouté: **${newNickname}**\n📊 Total: ${nicknames.length}/20`,
          flags: 64
        });

        // Rafraîchir l'interface
        setTimeout(async () => {
          try {
            // Créer une fausse interaction pour rafraîchir
            const fakeInteraction = {
              ...interaction,
              customId: `trap_manage_nicknames_${trapId}`,
              deferUpdate: async () => {},
              editReply: interaction.editReply.bind(interaction),
              followUp: interaction.followUp.bind(interaction),
              guildId: interaction.guildId,
              guild: interaction.guild
            };
            await this.showNicknameManager(fakeInteraction);
          } catch (e) {
            console.warn('⚠️ Impossible de rafraîchir:', e.message);
          }
        }, 1000);

      } catch (error) {
        console.error('❌ Erreur ajout pseudo:', error);
        return interaction.followUp({
          content: `❌ Erreur: ${error.message}`,
          flags: 64
        });
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        interaction.followUp({
          content: '⏱️ Temps écoulé. Aucun pseudo ajouté.',
          flags: 64
        }).catch(() => {});
      }
    });
  }

  /**
   * Demander le changement de durée via le chat
   */
  async promptChangeDurationViaChat(interaction) {
    await interaction.deferUpdate();

    const trapId = parseInt(interaction.customId.replace('trap_change_duration_', ''));

    const trap = await db.queryOne(
      'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
      [interaction.guildId, trapId]
    );

    if (!trap) {
      return interaction.followUp({ content: '❌ Piège introuvable.', flags: 64 });
    }

    // Envoyer le message de demande
    await interaction.followUp({
      content: `⏱️ **Modifier la durée du piège**\n\n` +
        `**Piège:** ${trap.name}\n` +
        `**Durée actuelle:** ${trap.cooldown_duration || 60} minutes\n\n` +
        `📝 Écris la nouvelle durée en **minutes** dans le chat.\n` +
        `Exemples: \`30\`, \`60\`, \`120\`, \`1440\` (24h)\n\n` +
        `⏱️ Tu as **2 minutes** pour répondre.`,
      flags: 64
    });

    // Créer un collecteur de messages
    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 120000, // 2 minutes
      max: 1
    });

    collector.on('collect', async (message) => {
      const input = message.content.trim();

      // Supprimer le message de l'utilisateur
      try {
        await message.delete();
      } catch (e) {
        // Ignorer si pas les permissions
      }

      const newDuration = parseInt(input);

      if (isNaN(newDuration) || newDuration < 1) {
        return interaction.followUp({
          content: '❌ La durée doit être un nombre positif (en minutes).',
          flags: 64
        });
      }

      if (newDuration > 43200) { // Max 30 jours
        return interaction.followUp({
          content: '❌ La durée maximale est de 43200 minutes (30 jours).',
          flags: 64
        });
      }

      try {
        await db.query(
          'UPDATE traps SET cooldown_duration = $1 WHERE guild_id = $2 AND id = $3',
          [newDuration, interaction.guildId, trapId]
        );

        // Formater la durée pour l'affichage
        let durationText = `${newDuration} minute(s)`;
        if (newDuration >= 1440) {
          const days = Math.floor(newDuration / 1440);
          const hours = Math.floor((newDuration % 1440) / 60);
          durationText = `${days}j ${hours}h (${newDuration} min)`;
        } else if (newDuration >= 60) {
          const hours = Math.floor(newDuration / 60);
          const mins = newDuration % 60;
          durationText = `${hours}h ${mins}min`;
        }

        await interaction.followUp({
          content: `✅ Durée modifiée: **${durationText}**`,
          flags: 64
        });

      } catch (error) {
        console.error('❌ Erreur modification durée:', error);
        return interaction.followUp({
          content: `❌ Erreur: ${error.message}`,
          flags: 64
        });
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        interaction.followUp({
          content: '⏱️ Temps écoulé. Durée non modifiée.',
          flags: 64
        }).catch(() => {});
      }
    });
  }

  /**
   * Afficher le select menu pour supprimer un pseudo
   */
  async showRemoveNicknameSelector(interaction) {
    await interaction.deferUpdate();

    const trapId = parseInt(interaction.customId.replace('trap_remove_nickname_', ''));
    const trap = await db.queryOne(
      'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
      [interaction.guildId, trapId]
    );

    if (!trap) {
      return interaction.followUp({ content: '❌ Piège introuvable.', flags: 64 });
    }

    let nicknames = [];
    if (trap.shame_nicknames) {
      nicknames = Array.isArray(trap.shame_nicknames)
        ? trap.shame_nicknames
        : (typeof trap.shame_nicknames === 'string' ? JSON.parse(trap.shame_nicknames) : []);
    }

    if (nicknames.length === 0) {
      return interaction.followUp({ content: '❌ Aucun pseudo à supprimer.', flags: 64 });
    }

    // Créer le select menu avec les pseudos (max 25 options)
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`trap_delete_nickname_${trapId}`)
      .setPlaceholder('Sélectionne un pseudo à supprimer...')
      .addOptions(
        nicknames.slice(0, 25).map((nickname, index) => ({
          label: nickname.substring(0, 100),
          value: index.toString(),
          description: `Pseudo #${index + 1}`,
          emoji: '🗑️'
        }))
      );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const backRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`trap_manage_nicknames_${trapId}`)
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      content: '🗑️ **Sélectionne le pseudo à supprimer:**',
      embeds: [],
      components: [selectRow, backRow]
    });
  }

  /**
   * Supprimer un pseudo spécifique
   */
  async handleDeleteSingleNickname(interaction) {
    await interaction.deferUpdate();

    const trapId = parseInt(interaction.customId.replace('trap_delete_nickname_', ''));
    const nicknameIndex = parseInt(interaction.values[0]);

    const trap = await db.queryOne(
      'SELECT * FROM traps WHERE guild_id = $1 AND id = $2',
      [interaction.guildId, trapId]
    );

    if (!trap) {
      return interaction.followUp({ content: '❌ Piège introuvable.', flags: 64 });
    }

    let nicknames = [];
    if (trap.shame_nicknames) {
      nicknames = Array.isArray(trap.shame_nicknames)
        ? trap.shame_nicknames
        : (typeof trap.shame_nicknames === 'string' ? JSON.parse(trap.shame_nicknames) : []);
    }

    if (nicknameIndex < 0 || nicknameIndex >= nicknames.length) {
      return interaction.followUp({ content: '❌ Index invalide.', flags: 64 });
    }

    const deletedNickname = nicknames[nicknameIndex];
    nicknames.splice(nicknameIndex, 1);

    try {
      await db.query(
        'UPDATE traps SET shame_nicknames = $1 WHERE guild_id = $2 AND id = $3',
        [JSON.stringify(nicknames), interaction.guildId, trapId]
      );

      await interaction.followUp({
        content: `✅ Pseudo supprimé: **${deletedNickname}**\n📊 Restants: ${nicknames.length}/20`,
        flags: 64
      });

      // Rafraîchir l'interface
      setTimeout(async () => {
        try {
          interaction.customId = `trap_manage_nicknames_${trapId}`;
          await this.showNicknameManager(interaction);
        } catch (e) {
          console.warn('⚠️ Impossible de rafraîchir:', e.message);
        }
      }, 1000);

    } catch (error) {
      console.error('❌ Erreur suppression pseudo:', error);
      return interaction.followUp({ content: `❌ Erreur: ${error.message}`, flags: 64 });
    }
  }

  /**
   * Supprimer tous les pseudos
   */
  async handleClearNicknames(interaction) {
    await interaction.deferUpdate();

    const trapId = parseInt(interaction.customId.replace('trap_clear_nicknames_', ''));

    try {
      await db.query(
        'UPDATE traps SET shame_nicknames = $1 WHERE guild_id = $2 AND id = $3',
        [JSON.stringify([]), interaction.guildId, trapId]
      );

      await interaction.followUp({
        content: '✅ Tous les pseudos ont été supprimés.',
        flags: 64
      });

      // Rafraîchir l'interface
      setTimeout(async () => {
        try {
          interaction.customId = `trap_manage_nicknames_${trapId}`;
          await this.showNicknameManager(interaction);
        } catch (e) {
          console.warn('⚠️ Impossible de rafraîchir:', e.message);
        }
      }, 1500);

    } catch (error) {
      console.error('❌ Erreur suppression pseudos:', error);
      return interaction.followUp({ content: `❌ Erreur: ${error.message}`, flags: 64 });
    }
  }

  /**
   * Réinitialiser aux pseudos par défaut
   */
  async handleResetNicknames(interaction) {
    await interaction.deferUpdate();

    const trapId = parseInt(interaction.customId.replace('trap_reset_nicknames_', ''));

    const defaultNicknames = [
      '🐔 Poulet Piégé',
      '🤡 Clown du Serveur',
      '💩 Victime du Jour',
      '🐌 Escargot Lent',
      '🦆 Canard Malchanceux',
      '🐷 Petit Cochon',
      '🐸 Grenouille Piégée',
      '🦝 Raton Râleur'
    ];

    try {
      await db.query(
        'UPDATE traps SET shame_nicknames = $1 WHERE guild_id = $2 AND id = $3',
        [JSON.stringify(defaultNicknames), interaction.guildId, trapId]
      );

      await interaction.followUp({
        content: `✅ Pseudos réinitialisés aux valeurs par défaut (${defaultNicknames.length} pseudos).`,
        flags: 64
      });

      // Rafraîchir l'interface
      setTimeout(async () => {
        try {
          interaction.customId = `trap_manage_nicknames_${trapId}`;
          await this.showNicknameManager(interaction);
        } catch (e) {
          console.warn('⚠️ Impossible de rafraîchir:', e.message);
        }
      }, 1500);

    } catch (error) {
      console.error('❌ Erreur reset pseudos:', error);
      return interaction.followUp({ content: `❌ Erreur: ${error.message}`, flags: 64 });
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
      'lose-all-collectibles': 'Perte totale',
      'shame-nickname': 'Pseudo Honteux'
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
      'lose-all-collectibles': '☠️',
      'shame-nickname': '🎭'
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
    } else if (type === 'shame-nickname') {
      const nicknames = data.shame_nicknames || [];
      const nicknamesList = Array.isArray(nicknames) ? nicknames : (typeof nicknames === 'string' ? JSON.parse(nicknames) : []);
      let text = `🎭 **Durée:** ${data.cooldown_duration || 60} minute${(data.cooldown_duration || 60) > 1 ? 's' : ''}`;
      text += `\n🏷️ **Pseudos (${nicknamesList.length}):**`;
      if (nicknamesList.length > 0) {
        text += `\n${nicknamesList.slice(0, 5).map(n => `└─ ${n}`).join('\n')}`;
        if (nicknamesList.length > 5) {
          text += `\n└─ _... et ${nicknamesList.length - 5} autres_`;
        }
      } else {
        text += `\n└─ _Aucun (utilise les défauts du serveur)_`;
      }
      return text;
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
      else if (customId.startsWith('trap_change_severity_')) {
        await this.showChangeSeveritySelector(interaction);
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
      // Gestion des pseudos honteux (shame-nickname)
      else if (customId.startsWith('trap_manage_nicknames_')) {
        await this.showNicknameManager(interaction);
      }
      else if (customId.startsWith('trap_add_nickname_')) {
        await this.promptAddNicknameViaChat(interaction);
      }
      else if (customId.startsWith('trap_clear_nicknames_')) {
        await this.handleClearNicknames(interaction);
      }
      else if (customId.startsWith('trap_reset_nicknames_')) {
        await this.handleResetNicknames(interaction);
      }
      else if (customId.startsWith('trap_remove_nickname_')) {
        await this.showRemoveNicknameSelector(interaction);
      }
      else if (customId.startsWith('trap_change_duration_')) {
        await this.promptChangeDurationViaChat(interaction);
      }
      // Select menus
      else if (customId.startsWith('trap_delete_nickname_')) {
        await this.handleDeleteSingleNickname(interaction);
      }
      else if (customId === 'select_trap') {
        await this.handleTrapSelection(interaction);
      }
      else if (customId === 'select_trap_type') {
        await this.handleTrapTypeSelection(interaction);
      }
      else if (customId.startsWith('select_trap_severity_')) {
        await this.handleSeveritySelection(interaction);
      }
      else if (customId.startsWith('select_change_trap_severity_')) {
        await this.handleChangeSeverity(interaction);
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
