const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const db = require('../utils/database-pg');
const audit = require('../utils/auditLogger');

/**
 * Handler pour la gestion des give unique
 * Extrait depuis adminPanelHandler.js pour une meilleure organisation
 */
class GiveUniqueHandler {
  constructor() {
    // Map pour stocker les tâches programmées
    this.giveScheduledTasks = new Map();

    // Map pour stocker temporairement les sélections de canaux
    this.channelSelections = new Map();
  }

  /**
   * Menu principal Give Unique - Étape 1: Choix du mode
   */
  async showGiveUniqueMenu(interaction) {
    // Déférer immédiatement pour éviter l'expiration de l'interaction
    await interaction.deferUpdate();

    console.log('🔍 [DEBUG] showGiveUniqueMenu APPELÉE');
    console.log('🔍 [DEBUG] GuildId:', interaction.guildId);

    const theme = await db.getActiveTheme(interaction.guildId);
    console.log('🔍 [DEBUG] Thème récupéré:', theme ? theme.name : 'aucun');

    if (!theme) {
      console.log('❌ [DEBUG] Aucun thème actif, affichage message erreur');
      return interaction.editReply({
        content: '❌ Aucun thème actif. Crée un thème d\'abord.',
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('admin_back')
              .setLabel('🔙 Retour')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    console.log('✅ [DEBUG] Affichage du menu de sélection du mode');

    const embed = new EmbedBuilder()
      .setTitle('🎁 LANCER UN GIVE UNIQUE')
      .setDescription(
        `**Thème:** ${theme.name}\n\n` +
        `**ÉTAPE 1/4 - CHOIX DU MODE**\n\n` +
        `Choisis le type de contenu que tu veux envoyer aux joueurs :\n\n` +
        `🎲 **Mystery Box Classique** - Probabilités normales (aléatoire)\n` +
        `📋 **Mission** - Envoyer une mission spécifique\n` +
        `⚠️ **Piège** - Envoyer un piège spécifique\n` +
        `✨ **Super Bonus** - Envoyer un super bonus spécifique\n` +
        `🎭 **Collectible** - Envoyer un collectible spécifique\n\n` +
        `⚠️ **Note:** Seule la Mystery Box classique utilise les probabilités. Les autres modes sont des envois ciblés.`
      )
      .setColor('#3498db');

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('give_unique_mode_select')
      .setPlaceholder('📋 Sélectionne le mode d\'envoi...')
      .addOptions([
        {
          label: 'Mystery Box Classique',
          description: 'Probabilités normales (aléatoire)',
          value: 'mystery_box',
          emoji: '🎲'
        },
        {
          label: 'Envoyer une Mission',
          description: 'Choisir une mission à envoyer',
          value: 'mission',
          emoji: '📋'
        },
        {
          label: 'Envoyer un Piège',
          description: 'Choisir un piège à envoyer',
          value: 'trap',
          emoji: '⚠️'
        },
        {
          label: 'Envoyer un Super Bonus',
          description: 'Choisir un super bonus à envoyer',
          value: 'super_bonus',
          emoji: '✨'
        },
        {
          label: 'Envoyer un Collectible',
          description: 'Choisir un collectible à envoyer',
          value: 'collectible',
          emoji: '🎭'
        }
      ]);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_back')
        .setLabel('🔙 Retour au Menu Principal')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * ÉTAPE 1 - Handler: Gestion de la sélection du mode
   */
  async handleGiveUniqueModeSelect(interaction) {
    // Déférer immédiatement pour éviter l'expiration de l'interaction
    await interaction.deferUpdate();

    console.log('🔍 [DEBUG] handleGiveUniqueModeSelect APPELÉE');
    const selectedMode = interaction.values[0];
    console.log('🔍 [DEBUG] Mode sélectionné:', selectedMode);

    // Passer à l'étape 2: Sélection de l'item
    console.log('✅ [DEBUG] Appel de showGiveUniqueItemSelection');
    await this.showGiveUniqueItemSelection(interaction, selectedMode);
    console.log('✅ [DEBUG] showGiveUniqueItemSelection terminée');
  }

  /**
   * ÉTAPE 2 - Afficher la sélection d'items selon le mode
   */
  async showGiveUniqueItemSelection(interaction, mode) {
    console.log('🔍 [DEBUG] showGiveUniqueItemSelection APPELÉE');
    console.log('🔍 [DEBUG] Mode:', mode);

    const theme = await db.getActiveTheme(interaction.guildId);
    console.log('🔍 [DEBUG] Thème:', theme ? theme.name : 'aucun');

    if (!theme) {
      console.log('❌ [DEBUG] Aucun thème actif');
      return interaction.editReply({
        content: '❌ Aucun thème actif.',
        embeds: [],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('admin_back')
              .setLabel('🔙 Retour')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    let embed;
    let selectMenu;
    let items = [];

    // Mode Mystery Box classique - passe directement à la sélection du canal
    if (mode === 'mystery_box') {
      console.log('✅ [DEBUG] Mode mystery_box - passage direct à la sélection du canal');
      return this.showGiveUniqueChannelSelection(interaction, mode, null);
    }

    // Mode Mission
    else if (mode === 'mission') {
      // Récupérer toutes les missions du thème actif
      const missions = await db.getMissionsByTheme(interaction.guildId, theme.id);

      if (missions.length === 0) {
        return interaction.editReply({
          content: '❌ Aucune mission disponible dans ce thème.',
          embeds: [],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_give_unique')
                .setLabel('🔙 Retour')
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
      }

      items = missions;
      embed = new EmbedBuilder()
        .setTitle('📋 SÉLECTIONNER UNE MISSION')
        .setDescription(
          `**Thème:** ${theme.name}\n\n` +
          `**ÉTAPE 2/4 - SÉLECTION DE L'ITEM**\n\n` +
          `Choisis la mission à envoyer aux joueurs:\n\n` +
          `📋 **Missions disponibles:** ${missions.length}`
        )
        .setColor('#e67e22');

      selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`give_unique_item_select:mission`)
        .setPlaceholder('📋 Sélectionne une mission...')
        .addOptions(
          missions.slice(0, 25).map(mission => ({
            label: mission.name.substring(0, 100),
            description: `Type: ${mission.type} - Timeout: ${mission.timeout}s`,
            value: `${mission.id}`
          }))
        );
    }

    // Mode Piège
    else if (mode === 'trap') {
      // Récupérer TOUS les pièges (actifs ET inactifs) pour l'envoi manuel
      const traps = await db.getAllTrapsByTheme(interaction.guildId, theme.id);

      if (traps.length === 0) {
        return interaction.editReply({
          content: '❌ Aucun piège disponible dans ce thème.',
          embeds: [],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_give_unique')
                .setLabel('🔙 Retour')
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
      }

      const activeTraps = traps.filter(t => t.is_active).length;
      const inactiveTraps = traps.length - activeTraps;

      items = traps;
      embed = new EmbedBuilder()
        .setTitle('⚠️ SÉLECTIONNER UN PIÈGE')
        .setDescription(
          `**Thème:** ${theme.name}\n\n` +
          `**ÉTAPE 2/4 - SÉLECTION DE L'ITEM**\n\n` +
          `Choisis le piège à envoyer aux joueurs:\n\n` +
          `⚠️ **Pièges disponibles:** ${traps.length}\n` +
          `✅ **Actifs (Mystery Box):** ${activeTraps}\n` +
          `⬜ **Inactifs (Envoi manuel uniquement):** ${inactiveTraps}`
        )
        .setColor('#e74c3c');

      selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`give_unique_item_select:trap`)
        .setPlaceholder('⚠️ Sélectionne un piège...')
        .addOptions(
          traps.slice(0, 25).map(trap => ({
            label: `${trap.is_active ? '✅' : '⬜'} ${trap.name.substring(0, 97)}`,
            description: trap.description?.substring(0, 100) || 'Piège',
            value: `${trap.id}`
          }))
        );
    }

    // Mode Super Bonus
    else if (mode === 'super_bonus') {
      // Récupérer UNIQUEMENT les super bonus actifs (is_enabled = TRUE)
      const bonuses = await db.getAllSuperBonuses(interaction.guildId, null, true);

      if (bonuses.length === 0) {
        return interaction.editReply({
          content: '❌ Aucun super bonus actif disponible.\n\n💡 **Astuce:** Active des super bonus dans le panneau Super Admin pour pouvoir les envoyer.',
          embeds: [],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_give_unique')
                .setLabel('🔙 Retour')
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
      }

      items = bonuses;
      embed = new EmbedBuilder()
        .setTitle('✨ SÉLECTIONNER UN SUPER BONUS')
        .setDescription(
          `**Thème:** ${theme.name}\n\n` +
          `**ÉTAPE 2/4 - SÉLECTION DE L'ITEM**\n\n` +
          `Choisis le super bonus à envoyer aux joueurs:\n\n` +
          `✨ **Super bonus actifs:** ${bonuses.length}\n` +
          `💡 *Seuls les super bonus activés sont affichés*`
        )
        .setColor('#9b59b6');

      selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`give_unique_item_select:super_bonus`)
        .setPlaceholder('✨ Sélectionne un super bonus...')
        .addOptions(
          bonuses.slice(0, 25).map(bonus => ({
            label: `${bonus.icon} ${bonus.name}`.substring(0, 100),
            description: `${bonus.rarity.toUpperCase()} • ${bonus.description?.substring(0, 80) || 'Super Bonus'}`,
            value: `${bonus.id}`
          }))
        );
    }

    // Mode Collectible
    else if (mode === 'collectible') {
      const collectibles = await db.getCollectiblesByTheme(interaction.guildId, theme.id);

      if (collectibles.length === 0) {
        return interaction.editReply({
          content: '❌ Aucun collectible disponible dans ce thème.',
          embeds: [],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('admin_give_unique')
                .setLabel('🔙 Retour')
                .setStyle(ButtonStyle.Secondary)
            )
          ]
        });
      }

      items = collectibles;
      embed = new EmbedBuilder()
        .setTitle('🎭 SÉLECTIONNER UN COLLECTIBLE')
        .setDescription(
          `**Thème:** ${theme.name}\n\n` +
          `**ÉTAPE 2/4 - SÉLECTION DE L'ITEM**\n\n` +
          `Choisis le collectible à envoyer aux joueurs:\n\n` +
          `🎭 **Collectibles disponibles:** ${collectibles.length}`
        )
        .setColor('#1abc9c');

      selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`give_unique_item_select:collectible`)
        .setPlaceholder('🎭 Sélectionne un collectible...')
        .addOptions(
          collectibles.slice(0, 25).map(coll => ({
            label: coll.name.substring(0, 100),
            description: `Rareté: ${coll.rarity || 'Inconnue'}`,
            value: `${coll.id}`
          }))
        );
    }

    const row1 = new ActionRowBuilder().addComponents(selectMenu);

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_give_unique')
        .setLabel('🔙 Retour au Mode')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * ÉTAPE 2 - Handler: Gestion de la sélection d'item
   */
  async handleGiveUniqueItemSelect(interaction) {
    // Déférer immédiatement pour éviter l'expiration de l'interaction
    await interaction.deferUpdate();

    const [_, mode] = interaction.customId.split(':');
    const itemId = interaction.values[0];

    // Passer à l'étape 3: Choix du salon
    await this.showGiveUniqueChannelSelection(interaction, mode, itemId);
  }

  /**
   * ÉTAPE 3 - Afficher la sélection du canal
   */
  async showGiveUniqueChannelSelection(interaction, mode, itemId) {
    console.log('🔍 [DEBUG] showGiveUniqueChannelSelection APPELÉE');
    console.log('🔍 [DEBUG] Mode:', mode, 'ItemId:', itemId);

    // Requêtes en PARALLÈLE
    const [theme, giveChannels] = await Promise.all([
      db.getActiveTheme(interaction.guildId),
      db.getAllGiveChannels(interaction.guildId)
    ]);

    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif.',
        embeds: [],
        components: []
      });
    }
    const categories = giveChannels.filter(c => c.type === 'category');
    const channels = giveChannels.filter(c => c.type === 'channel');

    const modeLabels = {
      mystery_box: '🎲 Mystery Box Classique',
      mission: '📋 Mission',
      trap: '⚠️ Piège',
      super_bonus: '✨ Super Bonus',
      collectible: '🎭 Collectible'
    };

    const embed = new EmbedBuilder()
      .setTitle('🎁 CHOISIR LE SALON')
      .setDescription(
        `**Thème:** ${theme.name}\n` +
        `**Mode:** ${modeLabels[mode]}\n\n` +
        `**ÉTAPE 3/4 - CHOIX DU SALON**\n\n` +
        `Choisis où lancer la boîte mystère :\n\n` +
        `⚙️ **Canaux Prédéfinis**\n` +
        `• Utilise les canaux/catégories configurés dans **Paramétrage**\n` +
        `• Canaux disponibles: ${categories.length} catégories + ${channels.length} canaux\n\n` +
        `📍 **Canaux Spécifiques**\n` +
        `• Sélectionne manuellement les canaux pour ce give unique`
      )
      .setColor('#2ecc71');

    console.log('🔍 [DEBUG] Création des boutons avec labels:');
    console.log('🔍 [DEBUG] Bouton 1: "⚙️ Canaux Prédéfinis"');
    console.log('🔍 [DEBUG] Bouton 2: "📍 Canaux Spécifiques"');

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`give_unique_channel_random:${mode}:${itemId || 'none'}`)
        .setLabel('⚙️ Canaux Prédéfinis')
        .setStyle(ButtonStyle.Success)
        .setDisabled(categories.length === 0 && channels.length === 0),
      new ButtonBuilder()
        .setCustomId(`give_unique_channel_specific:${mode}:${itemId || 'none'}`)
        .setLabel('📍 Canaux Spécifiques')
        .setStyle(ButtonStyle.Primary)
    );

    console.log('✅ [DEBUG] Boutons créés, envoi interaction.editReply()');

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_give_unique')
        .setLabel('🔙 Retour au Mode')
        .setStyle(ButtonStyle.Secondary)
    );

    let content = '';
    if (categories.length === 0 && channels.length === 0) {
      content = '⚠️ **Aucun canal configuré.** Configure des canaux dans Paramétrage > Gérer Canaux/Catégories.';
    }

    return interaction.editReply({
      content,
      embeds: [embed],
      components: [row1, row2]
    });
  }

  /**
   * ÉTAPE 3 - Handler: Canaux Prédéfinis (aléatoire)
   */
  async handleGiveUniqueChannelRandom(interaction) {
    // Déférer immédiatement pour éviter l'expiration de l'interaction
    await interaction.deferUpdate();

    const [_, mode, itemId] = interaction.customId.split(':');

    // Passer à l'étape 4: Options supplémentaires (programmation + annonce)
    return this.showGiveUniqueOptions(interaction, mode, itemId, 'random');
  }

  /**
   * ÉTAPE 3 - Handler: Canaux Spécifiques (sélection multiple)
   */
  async handleGiveUniqueChannelSpecific(interaction) {
    // Déférer immédiatement pour éviter l'expiration de l'interaction
    await interaction.deferUpdate();

    const [_, mode, itemId] = interaction.customId.split(':');

    // Afficher le sélecteur multi-canaux
    return this.showChannelSelector(interaction, mode, itemId);
  }

  /**
   * Afficher le sélecteur de canaux spécifiques (multi-sélection)
   */
  async showChannelSelector(interaction, mode, itemId) {
    // Utiliser ChannelSelectMenuBuilder pour permettre la recherche et accéder à tous les canaux
    const selectMenu = new ChannelSelectMenuBuilder()
      .setCustomId(`give_unique_channels_select:${mode}:${itemId}`)
      .setPlaceholder('🔍 Recherche et sélectionne les canaux...')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(25);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle('📍 SÉLECTION DES CANAUX')
      .setDescription(
        'Sélectionnez les canaux où les boîtes mystères seront lancées.\n\n' +
        'Les boîtes apparaîtront **aléatoirement** parmi les canaux sélectionnés.\n\n' +
        '💡 **Tu peux taper le nom d\'un canal pour le rechercher directement !**\n' +
        '📌 **Sélection multiple:** Minimum 1 canal, maximum 25 canaux'
      )
      .setColor('#3498db')
      .setFooter({ text: 'Tape pour rechercher | Sélectionne 1-25 canaux' });

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`give_unique_channel_back:${mode}:${itemId}`)
        .setLabel('🔙 Retour')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row, row2]
    });
  }

  /**
   * Handler pour la sélection des canaux spécifiques
   */
  async handleGiveUniqueChannelsSelect(interaction) {
    // Déférer immédiatement pour éviter l'expiration de l'interaction
    await interaction.deferUpdate();

    const selectedChannels = interaction.values;
    const [_, mode, itemId] = interaction.customId.split(':');

    console.log('🔧 [AUDIT] Canaux sélectionnés:', selectedChannels);

    // Stocker temporairement les canaux sélectionnés
    this.channelSelections.set(interaction.user.id, {
      mode,
      itemId,
      channels: selectedChannels
    });

    // Passer à l'étape 4: Options supplémentaires
    return this.showGiveUniqueOptions(interaction, mode, itemId, 'specific', selectedChannels);
  }

  /**
   * ÉTAPE 4 - Afficher les options supplémentaires (programmation + annonce)
   */
  async showGiveUniqueOptions(interaction, mode, itemId, channelType, selectedChannels = null) {
    const theme = await db.getActiveTheme(interaction.guildId);

    if (!theme) {
      return interaction.editReply({
        content: '❌ Aucun thème actif.',
        embeds: [],
        components: []
      });
    }

    const modeLabels = {
      mystery_box: '🎲 Mystery Box Classique',
      mission: '📋 Mission',
      trap: '⚠️ Piège',
      super_bonus: '✨ Super Bonus',
      collectible: '🎭 Collectible'
    };

    const channelLabels = {
      random: '⚙️ Canaux Prédéfinis',
      specific: '📍 Canaux Spécifiques'
    };

    let description = `**Thème:** ${theme.name}\n` +
      `**Mode:** ${modeLabels[mode]}\n` +
      `**Canal:** ${channelLabels[channelType]}\n`;

    // Afficher les canaux sélectionnés si c'est spécifique
    if (channelType === 'specific' && selectedChannels && selectedChannels.length > 0) {
      description += `\n**Canaux sélectionnés:** ${selectedChannels.length}\n`;
      for (const channelId of selectedChannels.slice(0, 5)) {
        const channel = interaction.guild.channels.cache.get(channelId);
        if (channel) {
          description += `• # ${channel.name}\n`;
        }
      }
      if (selectedChannels.length > 5) {
        description += `• ... et ${selectedChannels.length - 5} autre(s)\n`;
      }
    }

    description += `\n**ÉTAPE 4/4 - CONFIGURATION**\n\n` +
      `Choisis comment tu veux lancer cette boîte mystère :`;

    const embed = new EmbedBuilder()
      .setTitle('⚙️ OPTIONS DE LANCEMENT')
      .setDescription(description)
      .setColor('#9b59b6')
      .addFields([
        {
          name: '⚡ Lancer Maintenant + Message par Défaut',
          value: 'Lance immédiatement avec le message standard',
          inline: false
        },
        {
          name: '✏️ Lancer Maintenant + Message Personnalisé',
          value: 'Lance immédiatement avec un message d\'annonce personnalisé',
          inline: false
        },
        {
          name: '⏰ Programmer + Message par Défaut',
          value: 'Programme le lancement à une heure précise avec le message standard',
          inline: false
        },
        {
          name: '🎨 Programmer + Message Personnalisé',
          value: 'Programme le lancement à une heure précise avec un message personnalisé',
          inline: false
        }
      ]);

    // Encoder les canaux sélectionnés dans le customId (utiliser un hash ou un ID de session)
    const channelsParam = selectedChannels ? selectedChannels.join(',') : 'none';

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`give_unique_launch:${mode}:${itemId}:${channelType}:now:default:${channelsParam}`)
        .setLabel('⚡ Maintenant + Défaut')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`give_unique_launch:${mode}:${itemId}:${channelType}:now:custom:${channelsParam}`)
        .setLabel('✏️ Maintenant + Personnalisé')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`give_unique_launch:${mode}:${itemId}:${channelType}:scheduled:default:${channelsParam}`)
        .setLabel('⏰ Programmer + Défaut')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`give_unique_launch:${mode}:${itemId}:${channelType}:scheduled:custom:${channelsParam}`)
        .setLabel('🎨 Programmer + Personnalisé')
        .setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`give_unique_channel_back:${mode}:${itemId}`)
        .setLabel('🔙 Retour au Salon')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_back')
        .setLabel('🏠 Menu Principal')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.editReply({
      embeds: [embed],
      components: [row1, row2, row3]
    });
  }

  /**
   * ÉTAPE 4 - Handler: Gestion du lancement
   */
  async handleGiveUniqueLaunch(interaction) {
    const parts = interaction.customId.split(':');
    // Format: give_unique_launch:mode:itemId:channelType:timing:announcement:channelsParam
    const mode = parts[1];
    const itemId = parts[2];
    const channelType = parts[3];
    const timing = parts[4]; // 'now' or 'scheduled'
    const announcement = parts[5]; // 'default' or 'custom'
    const channelsParam = parts[6] || 'none'; // Liste des canaux séparés par des virgules

    // Parser les canaux sélectionnés
    const selectedChannels = channelsParam !== 'none' ? channelsParam.split(',') : null;

    // CAS 1: Lancer maintenant + Message par défaut
    if (timing === 'now' && announcement === 'default') {
      // Déférer UNIQUEMENT pour ce cas (pas pour les modals)
      await interaction.deferUpdate();
      return this.launchGiveUniqueNow(interaction, mode, itemId, channelType, null, selectedChannels);
    }

    // CAS 2: Lancer maintenant + Message personnalisé
    else if (timing === 'now' && announcement === 'custom') {
      // Les modals ne nécessitent pas de defer - showModal() répond immédiatement
      return this.showCustomAnnouncementModal(interaction, mode, itemId, channelType, 'now', selectedChannels);
    }

    // CAS 3: Programmer + Message par défaut
    else if (timing === 'scheduled' && announcement === 'default') {
      // Les modals ne nécessitent pas de defer - showModal() répond immédiatement
      return this.showScheduleModal(interaction, mode, itemId, channelType, null, selectedChannels);
    }

    // CAS 4: Programmer + Message personnalisé
    else if (timing === 'scheduled' && announcement === 'custom') {
      // Les modals ne nécessitent pas de defer - showModal() répond immédiatement
      return this.showScheduleModal(interaction, mode, itemId, channelType, 'custom', selectedChannels);
    }
  }

  /**
   * Lancer un Give Unique immédiatement
   * NOTE: Cette fonction est appelée par des handlers qui ont déjà déféré l'interaction
   */
  async launchGiveUniqueNow(interaction, mode, itemId, channelType, customMessage, selectedChannels = null) {
    // PAS de deferUpdate() ici - déjà fait par le handler appelant

    try {
      const mysteryBoxHandler = require('./mysteryBoxHandler');

      // Déterminer le canal cible
      let targetChannel;

      if (channelType === 'random') {
        // Canaux prédéfinis - Queries en parallèle pour éviter les timeouts
        const [theme, categories, channels] = await Promise.all([
          db.getActiveTheme(interaction.guildId),
          db.getGiveCategories(interaction.guildId),
          db.getGiveChannelsList(interaction.guildId)
        ]);

        if (categories.length > 0) {
          const randomCategory = categories[Math.floor(Math.random() * categories.length)];
          const category = await interaction.guild.channels.fetch(randomCategory.discord_id);

          if (category && category.type === 4) {
            const textChannels = category.children.cache.filter(ch => ch.isTextBased());
            if (textChannels.size > 0) {
              const channelsArray = Array.from(textChannels.values());
              targetChannel = channelsArray[Math.floor(Math.random() * channelsArray.length)];
            }
          }
        }

        if (!targetChannel && channels.length > 0) {
          const randomChannel = channels[Math.floor(Math.random() * channels.length)];
          targetChannel = await interaction.guild.channels.fetch(randomChannel.discord_id);
        }

        if (!targetChannel) {
          return interaction.followUp({
            content: '❌ Aucun canal valide trouvé.',
            flags: 64
          });
        }

        // Créer la boîte mystère avec le mode spécifié
        const message = await mysteryBoxHandler.createMysteryBox(targetChannel, theme.id, mode, itemId, interaction.guildId);

        // Logger l'action
        await audit.logGiveUniqueLaunched(
          interaction.guildId,
          interaction.user.id,
          {
            mode: mode,
            item_id: itemId,
            channel_type: channelType,
            channel_id: targetChannel.id,
            channel_name: targetChannel.name
          }
        );

        // Envoyer le message d'annonce personnalisé dans le canal d'annonce si fourni
        if (customMessage) {
          const announcementChannelConfig = await db.getAnnouncementChannel(interaction.guildId);
          if (announcementChannelConfig && announcementChannelConfig.channel_id) {
            try {
              const announcementChannel = await interaction.guild.channels.fetch(announcementChannelConfig.channel_id);
              if (announcementChannel) {
                await announcementChannel.send(customMessage);
              }
            } catch (error) {
              console.error('❌ Erreur lors de l\'envoi du message d\'annonce:', error);
            }
          }
        }

        return interaction.followUp({
          content: `✅ Boîte mystère lancée dans ${targetChannel} !\n\n🔗 [Aller au message](${message.url})`,
          flags: 64
        });
      } else if (channelType === 'specific') {
        // Canaux spécifiques sélectionnés
        const theme = await db.getActiveTheme(interaction.guildId);

        if (!selectedChannels || selectedChannels.length === 0) {
          return interaction.followUp({
            content: '❌ Aucun canal sélectionné.',
            flags: 64
          });
        }

        // Choisir un canal aléatoire parmi les canaux sélectionnés
        const randomChannelId = selectedChannels[Math.floor(Math.random() * selectedChannels.length)];
        targetChannel = await interaction.guild.channels.fetch(randomChannelId);

        if (!targetChannel) {
          return interaction.followUp({
            content: '❌ Canal invalide ou introuvable.',
            flags: 64
          });
        }

        // Créer la boîte mystère avec le mode spécifié
        const message = await mysteryBoxHandler.createMysteryBox(targetChannel, theme.id, mode, itemId, interaction.guildId);

        // Logger l'action
        await audit.logGiveUniqueLaunched(
          interaction.guildId,
          interaction.user.id,
          {
            mode: mode,
            item_id: itemId,
            channel_type: channelType,
            channel_id: targetChannel.id,
            channel_name: targetChannel.name,
            selected_channels_count: selectedChannels.length
          }
        );

        // Envoyer le message d'annonce personnalisé dans le canal d'annonce si fourni
        if (customMessage) {
          const announcementChannelConfig = await db.getAnnouncementChannel(interaction.guildId);
          if (announcementChannelConfig && announcementChannelConfig.channel_id) {
            try {
              const announcementChannel = await interaction.guild.channels.fetch(announcementChannelConfig.channel_id);
              if (announcementChannel) {
                await announcementChannel.send(customMessage);
              }
            } catch (error) {
              console.error('❌ Erreur lors de l\'envoi du message d\'annonce:', error);
            }
          }
        }

        return interaction.followUp({
          content: `✅ Boîte mystère lancée dans ${targetChannel} !\n\n🔗 [Aller au message](${message.url})`,
          flags: 64
        });
      }

    } catch (error) {
      console.error('❌ Erreur lors du lancement du give:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Afficher le modal pour le message d'annonce personnalisé
   */
  async showCustomAnnouncementModal(interaction, mode, itemId, channelType, timing, selectedChannels = null) {
    const channelsParam = selectedChannels ? selectedChannels.join(',') : 'none';

    const modal = new ModalBuilder()
      .setCustomId(`give_unique_announcement_modal:${mode}:${itemId}:${channelType}:${timing}:${channelsParam}`)
      .setTitle('📢 Message d\'Annonce Personnalisé');

    const messageInput = new TextInputBuilder()
      .setCustomId('announcement_message')
      .setLabel('Message d\'annonce')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Écris ton message d\'annonce personnalisé ici...')
      .setRequired(true)
      .setMaxLength(2000);

    const row = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(row);

    return interaction.showModal(modal);
  }

  /**
   * Afficher le modal pour la programmation horaire
   */
  async showScheduleModal(interaction, mode, itemId, channelType, announcementType, selectedChannels = null) {
    const channelsParam = selectedChannels ? selectedChannels.join(',') : 'none';

    const modal = new ModalBuilder()
      .setCustomId(`give_unique_schedule_modal:${mode}:${itemId}:${channelType}:${announcementType || 'default'}:${channelsParam}`)
      .setTitle('⏰ Programmation Horaire');

    const dateInput = new TextInputBuilder()
      .setCustomId('schedule_date')
      .setLabel('Date (JJ/MM/AAAA)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('01/11/2025')
      .setRequired(true)
      .setMaxLength(10);

    const timeInput = new TextInputBuilder()
      .setCustomId('schedule_time')
      .setLabel('Heure (HH:MM)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('14:30')
      .setRequired(true)
      .setMaxLength(5);

    const row1 = new ActionRowBuilder().addComponents(dateInput);
    const row2 = new ActionRowBuilder().addComponents(timeInput);

    modal.addComponents(row1, row2);

    return interaction.showModal(modal);
  }

  /**
   * Handler pour le modal d'annonce personnalisée
   */
  async handleGiveUniqueAnnouncementModal(interaction) {
    // Déférer immédiatement pour éviter l'expiration de l'interaction (modal submit)
    await interaction.deferReply({ flags: 64 });

    try {
      // Parser le customId
      // Format: give_unique_announcement_modal:mode:itemId:channelType:timing:channelsParam
      const parts = interaction.customId.split(':');
      const mode = parts[1];
      const itemId = parts[2] === 'none' ? null : parts[2];
      const channelType = parts[3];
      const timing = parts[4];
      const channelsParam = parts[5] || 'none';

      // Parser les canaux sélectionnés
      const selectedChannels = channelsParam !== 'none' ? channelsParam.split(',') : null;

      // Récupérer le message personnalisé
      const customMessage = interaction.fields.getTextInputValue('announcement_message');

      if (!customMessage || customMessage.trim().length === 0) {
        return interaction.editReply({
          content: '❌ Le message d\'annonce ne peut pas être vide.'
        });
      }

      // Si timing === 'now', lancer immédiatement avec le message personnalisé
      if (timing === 'now') {
        return this.launchGiveUniqueNow(interaction, mode, itemId, channelType, customMessage, selectedChannels);
      }

      // Pour d'autres timings futurs
      return interaction.editReply({
        content: '❌ Type de timing non supporté actuellement.'
      });

    } catch (error) {
      console.error('❌ Erreur lors du traitement du modal d\'annonce:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`
      });
    }
  }

  /**
   * Handler pour le modal de programmation horaire
   */
  async handleGiveUniqueScheduleModal(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      // Parser le customId
      // Format: give_unique_schedule_modal:mode:itemId:channelType:announcementType:channelsParam
      const parts = interaction.customId.split(':');
      const mode = parts[1];
      const itemId = parts[2] === 'none' ? null : parts[2];
      const channelType = parts[3];
      const announcementType = parts[4];
      const channelsParam = parts[5] || 'none';

      // Parser les canaux sélectionnés
      const selectedChannels = channelsParam !== 'none' ? channelsParam.split(',') : null;

      // Récupérer les valeurs du modal
      const dateInput = interaction.fields.getTextInputValue('schedule_date');
      const timeInput = interaction.fields.getTextInputValue('schedule_time');

      // Valider le format de la date (JJ/MM/AAAA)
      const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      const dateMatch = dateInput.match(dateRegex);

      if (!dateMatch) {
        return interaction.editReply({
          content: '❌ Format de date invalide. Utilise le format **JJ/MM/AAAA** (ex: 01/11/2025)',
          flags: 64
        });
      }

      // Valider le format de l'heure (HH:MM)
      const timeRegex = /^(\d{2}):(\d{2})$/;
      const timeMatch = timeInput.match(timeRegex);

      if (!timeMatch) {
        return interaction.editReply({
          content: '❌ Format d\'heure invalide. Utilise le format **HH:MM** (ex: 14:30)',
          flags: 64
        });
      }

      // Construire la date complète
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1; // Les mois en JS commencent à 0
      const year = parseInt(dateMatch[3]);
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);

      // Validation des valeurs
      if (day < 1 || day > 31) {
        return interaction.editReply({
          content: '❌ Jour invalide (doit être entre 1 et 31)',
          flags: 64
        });
      }

      if (month < 0 || month > 11) {
        return interaction.editReply({
          content: '❌ Mois invalide (doit être entre 1 et 12)',
          flags: 64
        });
      }

      if (hours < 0 || hours > 23) {
        return interaction.editReply({
          content: '❌ Heure invalide (doit être entre 0 et 23)',
          flags: 64
        });
      }

      if (minutes < 0 || minutes > 59) {
        return interaction.editReply({
          content: '❌ Minutes invalides (doivent être entre 0 et 59)',
          flags: 64
        });
      }

      // Créer la date
      const scheduledDate = new Date(year, month, day, hours, minutes);

      // Vérifier que la date est dans le futur
      const now = new Date();
      if (scheduledDate <= now) {
        return interaction.editReply({
          content: '❌ La date programmée doit être dans le futur !',
          flags: 64
        });
      }

      // Si announcementType === 'custom', afficher un avertissement
      if (announcementType === 'custom') {
        return interaction.editReply({
          content: '⚠️ **Fonctionnalité en développement**\n\n' +
            'La programmation avec message personnalisé n\'est pas encore implémentée.\n' +
            'Utilise plutôt **Programmer + Message par Défaut** pour le moment.',
          flags: 64
        });
      }

      // Pour l'instant, simplement confirmer la programmation
      return interaction.editReply({
        content: '⚠️ **Fonctionnalité en développement**\n\n' +
          `La programmation pour le **${dateInput} à ${timeInput}** a été enregistrée mais n'est pas encore fonctionnelle.\n\n` +
          `Cette fonctionnalité sera implémentée prochainement avec un système de tâches programmées.\n\n` +
          `Pour le moment, utilise **Lancer Maintenant** pour envoyer immédiatement.`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors du traitement du modal de programmation:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Lancer un give dans un salon aléatoire (ancien workflow - conservé pour compatibilité)
   */
  async handleGiveUniqueRandom(interaction) {
    await interaction.deferUpdate();

    try {
      const theme = await db.getActiveTheme(interaction.guildId);
      const mysteryBoxHandler = require('./mysteryBoxHandler');

      // Récupérer tous les canaux/catégories configurés
      const categories = await db.getGiveCategories(interaction.guildId);
      const channels = await db.getGiveChannelsList(interaction.guildId);

      let targetChannel;

      // Si on a des catégories, choisir aléatoirement une catégorie puis un canal dedans
      if (categories.length > 0) {
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const category = await interaction.guild.channels.fetch(randomCategory.discord_id);

        if (category && category.type === 4) { // GuildCategory
          const textChannels = category.children.cache.filter(ch => ch.isTextBased());

          if (textChannels.size > 0) {
            const channelsArray = Array.from(textChannels.values());
            targetChannel = channelsArray[Math.floor(Math.random() * channelsArray.length)];
          }
        }
      }

      // Sinon prendre un canal de la liste
      if (!targetChannel && channels.length > 0) {
        const randomChannel = channels[Math.floor(Math.random() * channels.length)];
        targetChannel = await interaction.guild.channels.fetch(randomChannel.discord_id);
      }

      if (!targetChannel) {
        return interaction.followUp({
          content: '❌ Aucun canal valide trouvé.',
          flags: 64
        });
      }

      // Créer la boîte mystère
      const message = await mysteryBoxHandler.createMysteryBox(interaction.guildId, targetChannel, theme.id);

      return interaction.followUp({
        content: `✅ Boîte mystère lancée dans ${targetChannel} !\n\n🔗 [Aller au message](${message.url})`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors du lancement du give:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Lancer un give dans le salon actuel (ancien workflow - conservé pour compatibilité)
   */
  async handleGiveUniqueHere(interaction) {
    await interaction.deferUpdate();

    try {
      const theme = await db.getActiveTheme(interaction.guildId);
      const mysteryBoxHandler = require('./mysteryBoxHandler');

      // Créer la boîte mystère dans le salon actuel
      const message = await mysteryBoxHandler.createMysteryBox(interaction.guildId, interaction.channel, theme.id);

      return interaction.followUp({
        content: `✅ Boîte mystère lancée dans ce salon !\n\n🔗 [Aller au message](${message.url})`,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors du lancement du give:', error);
      return interaction.followUp({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }

  /**
   * Gérer les interactions (appelé depuis adminPanelHandler ou interactionCreate)
   */
  async handleInteraction(interaction) {
    const customId = interaction.customId;
    console.log('🔍 [DEBUG] giveUniqueHandler.handleInteraction appelé');
    console.log('🔍 [DEBUG] customId:', customId);
    console.log('🔍 [DEBUG] interaction type:', interaction.type);

    // Menu principal Give Unique
    if (customId === 'admin_give_unique') {
      console.log('✅ [DEBUG] Routage vers showGiveUniqueMenu');
      return this.showGiveUniqueMenu(interaction);
    }

    // Sélection du mode
    if (customId === 'give_unique_mode_select') {
      console.log('✅ [DEBUG] Routage vers handleGiveUniqueModeSelect');
      return this.handleGiveUniqueModeSelect(interaction);
    }

    // Sélection d'item
    if (customId.startsWith('give_unique_item_select:')) {
      return this.handleGiveUniqueItemSelect(interaction);
    }

    // Choix du canal
    if (customId.startsWith('give_unique_channel_random:')) {
      return this.handleGiveUniqueChannelRandom(interaction);
    }

    if (customId.startsWith('give_unique_channel_specific:')) {
      return this.handleGiveUniqueChannelSpecific(interaction);
    }

    // Sélection des canaux spécifiques (multi-select)
    if (customId.startsWith('give_unique_channels_select:')) {
      return this.handleGiveUniqueChannelsSelect(interaction);
    }

    // Lancement
    if (customId.startsWith('give_unique_launch:')) {
      return this.handleGiveUniqueLaunch(interaction);
    }

    // Retour au choix du salon
    if (customId.startsWith('give_unique_channel_back:')) {
      await interaction.deferUpdate();
      const [mode, itemId] = customId.replace('give_unique_channel_back:', '').split(':');
      return this.showGiveUniqueChannelSelection(interaction, mode, itemId);
    }

    // Ancien workflow (compatibilité)
    if (customId === 'give_unique_random') {
      return this.handleGiveUniqueRandom(interaction);
    }

    if (customId === 'give_unique_here') {
      return this.handleGiveUniqueHere(interaction);
    }
  }

  /**
   * Gérer les modals (appelé depuis modalHandler)
   */
  async handleModalSubmit(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('give_unique_announcement_modal:')) {
      return this.handleGiveUniqueAnnouncementModal(interaction);
    }

    if (customId.startsWith('give_unique_schedule_modal:')) {
      return this.handleGiveUniqueScheduleModal(interaction);
    }
  }
}

module.exports = new GiveUniqueHandler();
