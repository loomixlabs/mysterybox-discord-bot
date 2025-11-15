const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../utils/database-pg');
const { getDynamicColor } = require('../utils/profileHelpers');
const { getLoomixFooter } = require('../utils/footerHelper');

// Réutiliser les palettes de couleurs de serverConfigHandler
const COLOR_PALETTES = {
  basiques: [
    { name: '🔴 Rouge Classique', value: '#FF0000', emoji: '🔴' },
    { name: '🟠 Orange Vibrant', value: '#FFA500', emoji: '🟠' },
    { name: '🟡 Jaune Soleil', value: '#FFD700', emoji: '🟡' },
    { name: '🟢 Vert Émeraude', value: '#00FF00', emoji: '🟢' },
    { name: '🔵 Bleu Ciel', value: '#0099FF', emoji: '🔵' },
    { name: '🟣 Violet Améthyste', value: '#9B59B6', emoji: '🟣' },
    { name: '⚫ Noir Charbon', value: '#2C3E50', emoji: '⚫' },
    { name: '⚪ Blanc Pur', value: '#FFFFFF', emoji: '⚪' }
  ],
  tendances2025: [
    { name: '💎 Bleu Saphir', value: '#3498DB', emoji: '💎' },
    { name: '🌿 Vert Jade', value: '#2ECC71', emoji: '🌿' },
    { name: '🔥 Rouge Cardinal', value: '#E74C3C', emoji: '🔥' },
    { name: '🌸 Rose Sakura', value: '#FF69B4', emoji: '🌸' },
    { name: '🌊 Bleu Océan', value: '#1ABC9C', emoji: '🌊' },
    { name: '🍊 Orange Mandarine', value: '#F39C12', emoji: '🍊' },
    { name: '🌙 Bleu Nuit', value: '#34495E', emoji: '🌙' },
    { name: '☀️ Jaune Doré', value: '#F1C40F', emoji: '☀️' }
  ],
  pastel: [
    { name: '🧁 Rose Pastel', value: '#FFB3D9', emoji: '🧁' },
    { name: '🍰 Bleu Pastel', value: '#AED6F1', emoji: '🍰' },
    { name: '🍡 Violet Pastel', value: '#D7BDE2', emoji: '🍡' },
    { name: '🍃 Vert Pastel', value: '#ABEBC6', emoji: '🍃' },
    { name: '🍑 Pêche Pastel', value: '#FADBD8', emoji: '🍑' },
    { name: '🌈 Lavande Pastel', value: '#E8DAEF', emoji: '🌈' }
  ],
  vives: [
    { name: '⚡ Jaune Électrique', value: '#FFFF00', emoji: '⚡' },
    { name: '💚 Vert Néon', value: '#39FF14', emoji: '💚' },
    { name: '💙 Cyan Néon', value: '#00FFFF', emoji: '💙' },
    { name: '💜 Magenta Vif', value: '#FF00FF', emoji: '💜' },
    { name: '🧡 Orange Fluo', value: '#FF6600', emoji: '🧡' }
  ],
  professionnelles: [
    { name: '💼 Bleu Corporate', value: '#2C3E50', emoji: '💼' },
    { name: '📊 Gris Ardoise', value: '#95A5A6', emoji: '📊' },
    { name: '🎯 Rouge Entreprise', value: '#C0392B', emoji: '🎯' },
    { name: '📈 Vert Business', value: '#27AE60', emoji: '📈' },
    { name: '⭐ Or Premium', value: '#D4AF37', emoji: '⭐' }
  ]
};

/**
 * Trouver le nom d'une couleur à partir de son code hexadécimal
 */
function getColorName(hexColor) {
  const upperHex = hexColor.toUpperCase();

  for (const palette of Object.values(COLOR_PALETTES)) {
    const color = palette.find(c => c.value.toUpperCase() === upperHex);
    if (color) {
      return color.name;
    }
  }

  return `Couleur personnalisée (${hexColor})`;
}

/**
 * Afficher le menu de sélection de couleur pour le profil
 */
async function showProfileColorPalette(interaction, player, theme, progress) {
  const guildId = interaction.guildId;

  // Couleur actuelle (preferred_color ou couleur dynamique)
  const currentColor = player.preferred_color || getDynamicColor(progress.collected_count, theme.required_items);
  const isCustom = player.preferred_color !== null;

  const embed = new EmbedBuilder()
    .setTitle('🎨 Personnaliser la Couleur de ton Profil')
    .setDescription(
      `**Couleur actuelle:** ${isCustom ? getColorName(currentColor) : '🌈 Couleur automatique (basée sur ta progression)'}\n` +
      `**Code:** ${currentColor}\n\n` +
      '**Choisissez une couleur dans les catégories ci-dessous:**\n' +
      '• Couleurs basiques\n' +
      '• Tendances 2025\n' +
      '• Palette pastel\n' +
      '• Couleurs vives\n' +
      '• Couleurs professionnelles\n\n' +
      '*Ou utilisez les boutons ci-dessous pour des options avancées*'
    )
    .setColor(currentColor)
    .setFooter(await getLoomixFooter(guildId));

  // Créer les select menus pour chaque catégorie
  const selectRows = [];

  // Basiques + Tendances 2025
  const basiquesTendancesSelect = new StringSelectMenuBuilder()
    .setCustomId('profile_color_select_basiques_tendances')
    .setPlaceholder('🎨 Basiques | ✨ Tendances 2025')
    .addOptions([
      ...COLOR_PALETTES.basiques.map(color => ({
        label: color.name,
        value: color.value,
        description: color.value,
        emoji: color.emoji
      })),
      ...COLOR_PALETTES.tendances2025.map(color => ({
        label: color.name,
        value: color.value,
        description: color.value,
        emoji: color.emoji
      }))
    ]);
  selectRows.push(new ActionRowBuilder().addComponents(basiquesTendancesSelect));

  // Pastel
  const pastelSelect = new StringSelectMenuBuilder()
    .setCustomId('profile_color_select_pastel')
    .setPlaceholder('🌸 Couleurs pastel')
    .addOptions(COLOR_PALETTES.pastel.map(color => ({
      label: color.name,
      value: color.value,
      description: color.value,
      emoji: color.emoji
    })));
  selectRows.push(new ActionRowBuilder().addComponents(pastelSelect));

  // Vives
  const vivesSelect = new StringSelectMenuBuilder()
    .setCustomId('profile_color_select_vives')
    .setPlaceholder('⚡ Couleurs vives')
    .addOptions(COLOR_PALETTES.vives.map(color => ({
      label: color.name,
      value: color.value,
      description: color.value,
      emoji: color.emoji
    })));
  selectRows.push(new ActionRowBuilder().addComponents(vivesSelect));

  // Professionnelles
  const professionnellesSelect = new StringSelectMenuBuilder()
    .setCustomId('profile_color_select_professionnelles')
    .setPlaceholder('💼 Couleurs professionnelles')
    .addOptions(COLOR_PALETTES.professionnelles.map(color => ({
      label: color.name,
      value: color.value,
      description: color.value,
      emoji: color.emoji
    })));
  selectRows.push(new ActionRowBuilder().addComponents(professionnellesSelect));

  // Boutons (Code custom + Couleur auto + Retour)
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('profile_color_custom')
      .setLabel('Code Hex personnalisé')
      .setEmoji('🔢')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('profile_color_auto')
      .setLabel('Couleur automatique')
      .setEmoji('🌈')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!isCustom), // Désactivé si déjà en mode auto
    new ButtonBuilder()
      .setCustomId('profile_overview')
      .setLabel('Retour au profil')
      .setEmoji('🔙')
      .setStyle(ButtonStyle.Secondary)
  );
  selectRows.push(buttonRow);

  await interaction.editReply({
    embeds: [embed],
    components: selectRows
  });
}

/**
 * Gérer la sélection de couleur via les menus
 */
async function handleProfileColorSelect(interaction) {
  const { values, user } = interaction;
  const guildId = interaction.guildId;
  const selectedColor = values[0];

  // Déférer immédiatement
  await interaction.deferUpdate();

  // Mettre à jour la couleur préférée du joueur
  await db.query(`
    UPDATE players
    SET preferred_color = $1
    WHERE guild_id = $2 AND discord_id = $3
  `, [selectedColor, guildId, user.id]);

  const colorName = getColorName(selectedColor);

  const embed = new EmbedBuilder()
    .setTitle('✅ Couleur de Profil Mise à Jour')
    .setDescription(`**${colorName}**`)
    .setColor(selectedColor)
    .addFields(
      {
        name: 'Code hexadécimal',
        value: `\`${selectedColor}\``,
        inline: true
      },
      {
        name: '📋 Où s\'applique cette couleur ?',
        value: '• Ton profil (`/profile`)\n• Tes partages de profil\n• Toutes tes stats personnelles',
        inline: false
      }
    )
    .setFooter(await getLoomixFooter(guildId, 'Utilise /profile pour voir le résultat !'));

  const backButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_overview')
        .setLabel('Retour au profil')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [backButton]
  });
}

/**
 * Afficher le modal pour entrer un code hex personnalisé
 */
async function showCustomColorModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('profile_color_custom_modal')
    .setTitle('Code Couleur Hexadécimal');

  const hexInput = new TextInputBuilder()
    .setCustomId('hex_color')
    .setLabel('Code hexadécimal (ex: #FF5733)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('#000000')
    .setMinLength(4) // #FFF
    .setMaxLength(7) // #FFFFFF
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(hexInput));

  return interaction.showModal(modal);
}

/**
 * Gérer la soumission du modal de couleur personnalisée
 */
async function handleCustomColorModal(interaction) {
  const { user } = interaction;
  const guildId = interaction.guildId;

  await interaction.deferReply({ flags: 64 }); // Éphémère

  let hexColor = interaction.fields.getTextInputValue('hex_color').trim().toUpperCase();

  // Ajouter # si manquant
  if (!hexColor.startsWith('#')) {
    hexColor = '#' + hexColor;
  }

  // Valider le format hexadécimal
  const hexRegex = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i;
  if (!hexRegex.test(hexColor)) {
    return interaction.editReply({
      content: `❌ Code hexadécimal invalide: \`${hexColor}\`\n\n` +
               '💡 Format attendu: `#FF5733` ou `#F57`\n' +
               'Exemples valides: `#FF0000` (rouge), `#00FF00` (vert), `#0000FF` (bleu)',
      components: []
    });
  }

  // Convertir #FFF en #FFFFFF
  if (hexColor.length === 4) {
    hexColor = '#' + hexColor[1] + hexColor[1] + hexColor[2] + hexColor[2] + hexColor[3] + hexColor[3];
  }

  // Mettre à jour la couleur préférée du joueur
  await db.query(`
    UPDATE players
    SET preferred_color = $1
    WHERE guild_id = $2 AND discord_id = $3
  `, [hexColor, guildId, user.id]);

  const embed = new EmbedBuilder()
    .setTitle('✅ Couleur Personnalisée Appliquée')
    .setDescription(`**${getColorName(hexColor)}**`)
    .setColor(hexColor)
    .addFields(
      {
        name: 'Code hexadécimal',
        value: `\`${hexColor}\``,
        inline: true
      },
      {
        name: '📋 Où s\'applique cette couleur ?',
        value: '• Ton profil (`/profile`)\n• Tes partages de profil\n• Toutes tes stats personnelles',
        inline: false
      }
    )
    .setFooter(await getLoomixFooter(guildId, 'Utilise /profile pour voir le résultat !'));

  const backButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_overview')
        .setLabel('Retour au profil')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [backButton]
  });
}

/**
 * Réinitialiser à la couleur automatique (basée sur la progression)
 * ⚠️ IMPORTANT: Cette fonction est appelée APRÈS deferUpdate() dans profileHandler
 */
async function resetToAutoColor(interaction) {
  const { user } = interaction;
  const guildId = interaction.guildId;

  // ⚠️ NE PAS déférer - déjà fait par handleProfileInteraction()

  // Remettre preferred_color à NULL
  await db.query(`
    UPDATE players
    SET preferred_color = NULL
    WHERE guild_id = $2 AND discord_id = $3
  `, [guildId, user.id]);

  const embed = new EmbedBuilder()
    .setTitle('✅ Couleur Automatique Activée')
    .setDescription(
      '🌈 Ton profil utilisera désormais une couleur dynamique basée sur ta progression !\n\n' +
      '**Comment ça marche ?**\n' +
      '• 🔴 0-25% : Rouge (début de l\'aventure)\n' +
      '• 🟠 25-50% : Orange (en progression)\n' +
      '• 🟡 50-75% : Jaune (bonne avancée)\n' +
      '• 🟢 75-100% : Vert (presque terminé)\n' +
      '• 💚 100% : Vert vif (collection complète !)'
    )
    .setColor('#00BFFF')
    .setFooter(await getLoomixFooter(guildId, 'Ta couleur évoluera automatiquement avec ta progression !'));

  const backButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('profile_overview')
        .setLabel('Retour au profil')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Primary)
    );

  await interaction.editReply({
    embeds: [embed],
    components: [backButton]
  });
}

module.exports = {
  showProfileColorPalette,
  handleProfileColorSelect,
  showCustomColorModal,
  handleCustomColorModal,
  resetToAutoColor
};
