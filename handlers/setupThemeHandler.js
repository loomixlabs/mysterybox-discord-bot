/**
 * Handler pour la sélection de thèmes préconfigurés dans /setup
 * Permet d'importer rapidement un thème depuis les presets disponibles
 */

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ThemeValidator = require('../utils/themeValidator');
const ThemeImporter = require('../utils/themeImporter');
const db = require('../utils/database-pg');

// Chemin vers les thèmes préconfigurés
const PRESETS_PATH = path.join(__dirname, '..', 'themes', 'presets');

/**
 * Récupérer la liste des thèmes préconfigurés disponibles
 */
function getAvailablePresets() {
  const presets = [];

  try {
    if (!fs.existsSync(PRESETS_PATH)) {
      console.warn('⚠️ Dossier presets non trouvé:', PRESETS_PATH);
      return presets;
    }

    const files = fs.readdirSync(PRESETS_PATH);

    for (const file of files) {
      if (!file.endsWith('.theme.json')) continue;

      const filePath = path.join(PRESETS_PATH, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const theme = JSON.parse(content);

      presets.push({
        id: file.replace('.theme.json', ''),
        file: file,
        name: theme.metadata?.name || theme.theme?.name || file,
        description: theme.metadata?.description || 'Pas de description',
        collectibles: theme.collectibles?.length || 0,
        traps: theme.traps?.length || 0,
        missions: (theme.missions?.quiz?.length || 0) + (theme.missions?.keyword?.length || 0),
        difficulty: theme.metadata?.difficulty || 'medium',
        tags: theme.metadata?.tags || []
      });
    }
  } catch (error) {
    console.error('❌ Erreur lors de la lecture des presets:', error);
  }

  return presets;
}

/**
 * Afficher l'écran de sélection des thèmes préconfigurés
 */
async function showThemeSelection(interaction) {
  const presets = getAvailablePresets();

  // Vérifier si un thème est déjà actif
  const activeTheme = await db.getActiveTheme(interaction.guildId);

  let description = '# Thèmes Préconfigurés\n\n';

  if (activeTheme) {
    description += `⚠️ **Thème actif:** ${activeTheme.name}\n`;
    description += `L'import d'un nouveau thème désactivera le thème actuel.\n\n`;
  }

  description += 'Sélectionnez un thème préconfigé pour démarrer rapidement !\n';
  description += 'Chaque thème inclut des collectibles, missions et pièges prêts à l\'emploi.\n\n';

  // Afficher les stats des thèmes
  for (const preset of presets) {
    const difficultyEmoji = preset.difficulty === 'easy' ? '🟢' :
                           preset.difficulty === 'medium' ? '🟡' :
                           preset.difficulty === 'hard' ? '🔴' : '⚪';

    description += `**${getThemeEmoji(preset.id)} ${preset.name}**\n`;
    description += `├─ ${preset.collectibles} collectibles | ${preset.missions} missions | ${preset.traps} pièges\n`;
    description += `└─ Difficulté: ${difficultyEmoji} ${preset.difficulty}\n\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎨 Configuration - Choix du Thème')
    .setDescription(description)
    .setColor('#9B59B6')
    .setFooter({ text: 'Vous pouvez créer un thème personnalisé plus tard dans /admin-panel' })
    .setTimestamp();

  // Créer le menu de sélection des thèmes
  const options = presets.map(preset => ({
    label: preset.name,
    value: preset.id,
    description: `${preset.collectibles} items, ${preset.missions} missions`,
    emoji: getThemeEmoji(preset.id)
  }));

  // Ajouter l'option "Pas de thème"
  options.push({
    label: 'Créer mon propre thème',
    value: 'custom',
    description: 'Ignorer les presets et créer manuellement',
    emoji: '✨'
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('setup_theme_select')
    .setPlaceholder('🎨 Choisir un thème préconfigurépour démarrer...')
    .addOptions(options);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_back_to_roles')
      .setLabel('← Retour aux Rôles')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_skip_theme')
      .setLabel('➡️ Passer cette étape')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row1, row2]
  });
}

/**
 * Gérer la sélection d'un thème préconfigurés
 */
async function handleThemeSelect(interaction) {
  await interaction.deferUpdate();

  const selectedTheme = interaction.values[0];

  if (selectedTheme === 'custom') {
    // Passer au checklist sans importer de thème
    const setupCommand = require('../commands/admin/setup');
    return setupCommand.showPrerequisitesChecklist(interaction);
  }

  // Afficher l'écran de confirmation avant import
  await showThemeConfirmation(interaction, selectedTheme);
}

/**
 * Afficher la confirmation avant import du thème
 */
async function showThemeConfirmation(interaction, themeId) {
  const presets = getAvailablePresets();
  const preset = presets.find(p => p.id === themeId);

  if (!preset) {
    return interaction.editReply({
      content: '❌ Thème non trouvé. Veuillez réessayer.',
      embeds: [],
      components: []
    });
  }

  // Lire le fichier pour plus de détails
  const filePath = path.join(PRESETS_PATH, preset.file);
  const content = fs.readFileSync(filePath, 'utf8');
  const themeData = JSON.parse(content);

  // Compter les collectibles par rareté
  const rarityCount = {};
  for (const c of themeData.collectibles || []) {
    rarityCount[c.rarity] = (rarityCount[c.rarity] || 0) + 1;
  }

  let description = `# ${getThemeEmoji(themeId)} ${preset.name}\n\n`;
  description += `${preset.description}\n\n`;
  description += '## Contenu du thème\n\n';
  description += `**Collectibles (${preset.collectibles}):**\n`;

  if (rarityCount.legendary) description += `├─ Légendaires: ${rarityCount.legendary}\n`;
  if (rarityCount.epic) description += `├─ Épiques: ${rarityCount.epic}\n`;
  if (rarityCount.rare) description += `├─ Rares: ${rarityCount.rare}\n`;
  if (rarityCount.common) description += `└─ Communs: ${rarityCount.common}\n`;

  description += `\n**Missions:** ${preset.missions}\n`;
  description += `**Pièges:** ${preset.traps}\n`;

  // Progression roles
  if (themeData.theme_config?.progression_roles) {
    description += `\n**Rôles de progression:** ${themeData.theme_config.progression_roles.length}\n`;
    for (const role of themeData.theme_config.progression_roles) {
      description += `├─ ${role.name} (${role.percentage}%)\n`;
    }
  }

  description += `\n**Durée:** ${themeData.theme?.duration_days || 30} jours\n`;
  description += `**Items requis:** ${themeData.theme?.required_items || 20}\n`;

  const embed = new EmbedBuilder()
    .setTitle('Confirmer l\'import du thème')
    .setDescription(description)
    .setColor('#E74C3C')
    .setFooter({ text: 'Cliquez sur "Importer" pour commencer' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup_import_theme:${themeId}`)
      .setLabel('✅ Importer ce thème')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('setup_theme_back')
      .setLabel('← Choisir un autre thème')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

/**
 * Importer le thème sélectionné
 */
async function handleThemeImport(interaction, themeId) {
  await interaction.deferUpdate();

  const filePath = path.join(PRESETS_PATH, `${themeId}.theme.json`);

  if (!fs.existsSync(filePath)) {
    return interaction.editReply({
      content: `❌ Fichier thème non trouvé: ${themeId}.theme.json`,
      embeds: [],
      components: []
    });
  }

  try {
    // Lire et valider le thème
    const content = fs.readFileSync(filePath, 'utf8');
    const themeData = JSON.parse(content);

    // Afficher le message de progression
    await interaction.editReply({
      content: `⏳ **Import en cours...**\n\nThème: ${themeData.metadata?.name || themeData.theme?.name}\n\nCette opération peut prendre quelques secondes.`,
      embeds: [],
      components: []
    });

    // Valider le thème
    const validator = new ThemeValidator();
    const validation = validator.validate(themeData);

    if (!validation.valid) {
      console.error('❌ Erreurs de validation:', validation.errors);
      return interaction.editReply({
        content: `❌ **Erreur de validation du thème:**\n\n${validation.errors.slice(0, 5).join('\n')}\n\n⚠️ Le fichier theme.json semble corrompu.`,
        embeds: [],
        components: []
      });
    }

    // Vérifier si un thème est déjà actif sur ce serveur
    const existingActiveTheme = await db.getActiveTheme(interaction.guildId);
    const shouldActivate = !existingActiveTheme; // Activer seulement si aucun thème actif

    // Importer le thème
    const importer = new ThemeImporter(interaction.guildId);
    const result = await importer.import(themeData, {
      activateAfterImport: shouldActivate,
      autoCreateRoles: true,
      autoInstallSuperBonuses: true,
      guild: interaction.guild  // Passer l'objet Guild pour créer le rôle Discord
    });

    if (!result.success) {
      return interaction.editReply({
        content: `❌ **Erreur lors de l'import:**\n\n${result.error}`,
        embeds: [],
        components: []
      });
    }

    // Succès ! - Construire un récapitulatif détaillé du thème importé
    const themeName = themeData.metadata?.name || themeData.theme?.name;
    const themeDescription = themeData.metadata?.description || themeData.theme?.description || '';
    const themeDifficulty = themeData.metadata?.difficulty || 'medium';
    const themeDuration = themeData.theme?.duration_days || 30;
    const themeRequiredItems = themeData.theme?.required_items || 20;

    // Compter les collectibles par rareté
    const rarityCount = {};
    for (const c of themeData.collectibles || []) {
      rarityCount[c.rarity] = (rarityCount[c.rarity] || 0) + 1;
    }

    // Difficulté emoji
    const difficultyEmoji = themeDifficulty === 'easy' ? '🟢' :
                           themeDifficulty === 'medium' ? '🟡' :
                           themeDifficulty === 'hard' ? '🔴' : '⚪';

    let successMessage = `# ${getThemeEmoji(themeId)} ${themeName}\n\n`;

    if (themeDescription) {
      successMessage += `*${themeDescription}*\n\n`;
    }

    successMessage += '## 📊 Contenu importé\n\n';

    // Collectibles avec breakdown par rareté
    const totalCollectibles = result.imported?.collectibles || 0;
    successMessage += `**Collectibles (${totalCollectibles}):**\n`;
    if (rarityCount.legendary) successMessage += `├─ 🟡 Légendaires: ${rarityCount.legendary}\n`;
    if (rarityCount.epic) successMessage += `├─ 🟣 Épiques: ${rarityCount.epic}\n`;
    if (rarityCount.rare) successMessage += `├─ 🔵 Rares: ${rarityCount.rare}\n`;
    if (rarityCount.common) successMessage += `└─ ⚪ Communs: ${rarityCount.common}\n`;
    successMessage += '\n';

    // Missions
    const totalMissions = result.imported?.missions || 0;
    const keywords = result.imported?.keywords || 0;
    const questions = result.imported?.questions || 0;
    successMessage += `**Missions (${totalMissions}):**\n`;
    if (keywords > 0) successMessage += `├─ 🔤 Mots-clés: ${keywords}\n`;
    if (questions > 0) successMessage += `├─ ❓ Questions quiz: ${questions}\n`;
    successMessage += `└─ Missions créées: ${totalMissions}\n\n`;

    // Pièges
    const totalTraps = result.imported?.traps || 0;
    if (totalTraps > 0) {
      successMessage += `**Pièges:** ${totalTraps}\n\n`;
    }

    // Rôles de progression
    const progressionRoles = themeData.theme_config?.progression_roles || [];
    if (progressionRoles.length > 0) {
      successMessage += `**Rôles de progression (${progressionRoles.length}):**\n`;
      for (let i = 0; i < progressionRoles.length; i++) {
        const role = progressionRoles[i];
        const isLast = i === progressionRoles.length - 1;
        const prefix = isLast ? '└─' : '├─';
        successMessage += `${prefix} ${role.name} (${role.percentage}%)\n`;
      }
      successMessage += '\n';
    }

    // Rôle final créé
    if (result.roleCreated) {
      successMessage += `**Rôle final:** ${result.roleCreated.name} ${result.roleCreated.created ? '✨ (créé)' : '(existant)'}\n\n`;
    }

    // Configuration du thème
    successMessage += '## ⚙️ Configuration\n\n';
    successMessage += `├─ Difficulté: ${difficultyEmoji} ${themeDifficulty}\n`;
    successMessage += `├─ Durée: ${themeDuration} jours\n`;
    successMessage += `└─ Items requis: ${themeRequiredItems}\n\n`;

    // Statut d'activation
    successMessage += '## 📌 Statut\n\n';
    if (shouldActivate) {
      successMessage += `✅ **Thème activé et prêt à l'emploi !**\n\n`;
    } else {
      successMessage += `⚠️ **Thème importé mais NON activé**\n`;
      successMessage += `Un autre thème est déjà actif sur ce serveur.\n\n`;
      successMessage += `💡 Pour activer ce thème: \`/admin-panel\` → Gestion Thèmes\n\n`;
    }

    // Prochaines étapes
    successMessage += '## ➡️ Prochaines étapes\n\n';
    if (shouldActivate) {
      successMessage += '1. Configurez les canaux de give dans `/admin-panel`\n';
      successMessage += '2. Lancez un Give pour tester le système !\n';
    } else {
      successMessage += '1. Activez ce thème quand vous serez prêt\n';
      successMessage += '2. Configurez les canaux de give dans `/admin-panel`\n';
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 Import réussi !')
      .setDescription(successMessage)
      .setColor('#2ECC71')
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('setup_theme_done')
        .setLabel('✅ Compris')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('setup_add_another_theme')
        .setLabel('➕ Ajouter un autre thème')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('theme_admin_main')
        .setLabel('📋 Gérer les Thèmes')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: null,
      embeds: [embed],
      components: [row]
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'import du thème:', error);
    return interaction.editReply({
      content: `❌ **Erreur inattendue:**\n\n${error.message}`,
      embeds: [],
      components: []
    });
  }
}

/**
 * Retourner à la sélection des thèmes
 */
async function handleThemeBack(interaction) {
  await interaction.deferUpdate();
  await showThemeSelection(interaction);
}

/**
 * Passer l'étape de sélection de thème
 */
async function handleSkipTheme(interaction) {
  await interaction.deferUpdate();
  const setupCommand = require('../commands/admin/setup');
  await setupCommand.showPrerequisitesChecklist(interaction);
}

/**
 * Obtenir l'emoji correspondant au thème
 */
function getThemeEmoji(themeId) {
  const emojis = {
    'monopoly': '🎩',
    'pokemon': '⚡',
    'harry-potter': '🪄',
    'blanche-neige': '🍎'
  };
  return emojis[themeId] || '🎨';
}

module.exports = {
  showThemeSelection,
  handleThemeSelect,
  handleThemeImport,
  handleThemeBack,
  handleSkipTheme,
  getAvailablePresets
};
