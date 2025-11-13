const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../utils/database-pg');
const themeExpirationHandler = require('../../handlers/themeExpirationHandler');
const permissions = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-panel')
    .setDescription('[ADMIN] Panneau d\'administration et configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      // Déférer IMMÉDIATEMENT avant toute autre opération
      await interaction.deferReply({ flags: 64 }); // 64 = EPHEMERAL

      // Vérifier les permissions via le système centralisé
      const hasAccess = await permissions.canAccessAdminPanel(interaction);

      if (!hasAccess) {
        return interaction.editReply({
          content: '❌ Vous n\'avez pas accès au panneau d\'administration.\n\n' +
                   '💡 Le propriétaire du serveur peut configurer les rôles admin via `/setup`.'
        });
      }

      // Récupérer les données en PARALLÈLE pour être plus rapide
      const [theme, allThemes, giveChannels] = await Promise.all([
        db.getActiveTheme(interaction.guildId),
        db.getAllThemes(interaction.guildId),
        db.getAllGiveChannels(interaction.guildId)
      ]);

      // Récupérer la config du thème SI il existe
      const config = theme ? await db.getThemeConfig(interaction.guildId, theme.id) : null;
      const categories = giveChannels.filter(c => c.type === 'category');
      const channels = giveChannels.filter(c => c.type === 'channel');

      // Calculer l'expiration du thème SI il existe
      const expirationInfo = theme ? themeExpirationHandler.calculateExpiration(theme) : null;

      // Créer la barre de progression mini
      const createMiniProgressBar = (percentage) => {
        const totalBars = 15;
        const filledBars = Math.round((percentage / 100) * totalBars);
        const emptyBars = totalBars - filledBars;
        let fillEmoji = percentage >= 70 ? '🟩' : percentage >= 30 ? '🟨' : '🟥';
        return fillEmoji.repeat(filledBars) + '⬜'.repeat(emptyBars);
      };

      // Générer le texte de durée (uniquement si un thème existe)
      let durationText = '';
      let progressBar = '';

      if (theme && expirationInfo) {
        if (expirationInfo.isUnlimited) {
          durationText = '♾️ **Illimitée**';
        } else if (expirationInfo.notActivated) {
          durationText = `⏸️ Non activé (${theme.duration_days}j configurés)`;
        } else if (expirationInfo.isExpired) {
          durationText = '🔴 **EXPIRÉ**';
          progressBar = '\n' + createMiniProgressBar(0);
        } else {
          const daysText = expirationInfo.daysRemaining === 0 ?
            `⏰ ${expirationInfo.hoursRemaining}h restantes` :
            expirationInfo.daysRemaining === 1 ?
            `⚠️ ${expirationInfo.daysRemaining} jour restant` :
            `⏱️ ${expirationInfo.daysRemaining} jours restants`;

          durationText = `${daysText} (${expirationInfo.percentageRemaining}%)`;
          progressBar = '\n' + createMiniProgressBar(expirationInfo.percentageRemaining);
        }
      }

      // Créer l'embed avec un message différent si pas de thème
      const embed = new EmbedBuilder()
        .setTitle('🎨 PANNEAU D\'ADMINISTRATION')
        .setColor(theme ? '#3498db' : '#e74c3c')
        .setTimestamp();

      if (!theme) {
        // Pas de thème : message d'accueil pour nouveau serveur
        embed.setDescription(
          '# 🚀 Bienvenue sur le panneau d\'administration !\n\n' +
          '⚠️ **Aucun thème configuré pour ce serveur**\n\n' +
          'Pour commencer à utiliser le bot, tu dois d\'abord créer un thème.\n' +
          'Un thème définit la collection de cartes/objets que les joueurs pourront collectionner.\n\n' +
          '**Exemples de thèmes:**\n' +
          '• Monopoly Friends\n' +
          '• Pokémon\n' +
          '• Harry Potter\n' +
          '• Marvel/DC Comics\n\n' +
          '👉 **Clique sur "⚙️ Paramétrage" ci-dessous pour créer ton premier thème !**'
        );
      } else {
        // Thème existant : affichage normal
        embed.setDescription(
          `**Thème actif:** ${theme.name}\n` +
          `**Durée:** ${durationText}${progressBar}\n` +
          `**Items requis:** ${theme.required_items}\n` +
          `**Rôle final:** ${theme.final_role_name}\n\n` +
          `**Canaux configurés:**\n` +
          `📂 Catégories: ${categories.length}\n` +
          `📍 Canaux: ${channels.length}\n\n` +
          `Choisis une action ci-dessous :`
        );

        if (config) {
          embed.addFields({
            name: '🎲 Probabilités actuelles',
            value: `🎁 Collectibles: **${config.probability_collectible}%**\n` +
                   `📋 Missions: **${config.probability_mission}%**\n` +
                   `⚠️ Pièges: **${config.probability_trap}%**`,
            inline: true
          });
        }
      }

      // Select menu pour changer de thème (si plusieurs thèmes existent)
      const components = [];

      if (allThemes.length > 1) {
        const themeSelect = new StringSelectMenuBuilder()
          .setCustomId('select_theme')
          .setPlaceholder('🔄 Changer de thème actif')
          .addOptions(
            allThemes.map(t => ({
              label: t.name,
              value: t.id.toString(),
              description: `${t.required_items} items - ${t.duration_days === 0 ? 'Illimité' : `${t.duration_days}j`}`,
              default: t.is_active === 1
            }))
          );

        components.push(new ActionRowBuilder().addComponents(themeSelect));
      }

      // Ligne 1: Give Unique + Lancer Campagne (désactivés si pas de thème)
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_give_unique')
          .setLabel('Lancer un Give Unique')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎁')
          .setDisabled(!theme), // Désactivé si pas de thème
        new ButtonBuilder()
          .setCustomId('admin_launch_campaign')
          .setLabel('Lancer une Campagne')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🚀')
          .setDisabled(!theme) // Désactivé si pas de thème
      );

      // Ligne 2: Paramétrage (toujours actif) + Statistiques (désactivé si pas de thème)
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_settings')
          .setLabel('Paramétrage')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId('admin_stats')
          .setLabel('Statistiques')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
          .setDisabled(!theme), // Désactivé si pas de thème
        new ButtonBuilder()
          .setCustomId('admin_refresh')
          .setLabel('Rafraîchir')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄')
      );

      components.push(row1, row2);

      return interaction.editReply({
        embeds: [embed],
        components: components,
        flags: 64
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'affichage du panneau admin:', error);
      return interaction.editReply({
        content: `❌ Une erreur est survenue: ${error.message}`,
        flags: 64
      });
    }
  }
};
