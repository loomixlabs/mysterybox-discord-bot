/**
 * Handler pour la sélection de thèmes préconfigurés dans /setup
 * Permet d'importer rapidement un thème depuis les presets disponibles
 *
 * v2.3 - Ajout des catégories, tags et prévisualisation détaillée
 */

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ThemeValidator = require('../utils/themeValidator');
const ThemeImporter = require('../utils/themeImporter');
const BotRoleManager = require('../utils/botRoleManager');
const db = require('../utils/database-pg');

// Chemins vers les thèmes (presets, templates exportés, exports)
const PRESETS_PATH = path.join(__dirname, '..', 'themes', 'presets');
const TEMPLATES_PATH = path.join(__dirname, '..', 'themes', 'templates');
const EXPORTS_PATH = path.join(__dirname, '..', 'themes', 'exports');

// Catégories prédéfinies avec emojis
const CATEGORIES = {
  'all': { emoji: '📚', label: 'Tous les thèmes', description: 'Afficher tous les thèmes disponibles' },
  'cinema': { emoji: '🎬', label: 'Cinéma & Films', description: 'Thèmes basés sur des films' },
  'gaming': { emoji: '🎮', label: 'Jeux Vidéo', description: 'Thèmes basés sur des jeux' },
  'anime': { emoji: '🎌', label: 'Anime & Manga', description: 'Thèmes basés sur des animes' },
  'fantasy': { emoji: '🧙', label: 'Fantasy & Magie', description: 'Thèmes fantastiques' },
  'scifi': { emoji: '🚀', label: 'Science-Fiction', description: 'Thèmes futuristes' },
  'boardgames': { emoji: '🎲', label: 'Jeux de société', description: 'Monopoly, etc.' },
  'holiday': { emoji: '🎄', label: 'Fêtes & Événements', description: 'Noël, Halloween, etc.' },
  'custom': { emoji: '✨', label: 'Personnalisés', description: 'Thèmes créés par la communauté' }
};

// Mapping de mots-clés vers catégories (pour auto-détection)
const CATEGORY_KEYWORDS = {
  'cinema': ['harry', 'potter', 'disney', 'marvel', 'star wars', 'film', 'movie', 'avengers', 'blanche-neige', 'frozen'],
  'gaming': ['pokemon', 'zelda', 'mario', 'minecraft', 'fortnite', 'league', 'valorant', 'gta', 'gaming'],
  'anime': ['naruto', 'dragon ball', 'one piece', 'demon slayer', 'attack on titan', 'anime', 'manga', 'jujutsu'],
  'fantasy': ['magic', 'wizard', 'dragon', 'medieval', 'fantasy', 'sorcerer', 'reliques', 'magie'],
  'scifi': ['space', 'alien', 'robot', 'future', 'cyber', 'sci-fi', 'scifi'],
  'boardgames': ['monopoly', 'catan', 'uno', 'board', 'dice', 'card game'],
  'holiday': ['christmas', 'halloween', 'easter', 'noel', 'noël', 'valentine', 'new year']
};

/**
 * Détecter automatiquement la catégorie d'un thème basé sur son nom et tags
 * Version SYNCHRONE locale (pour getAvailablePresets qui est sync)
 */
function detectCategorySync(themeName, tags = []) {
  const searchText = `${themeName} ${tags.join(' ')}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }

  return 'custom'; // Catégorie par défaut
}

/**
 * Détecter automatiquement la catégorie d'un thème basé sur son nom et tags
 * Version ASYNC qui utilise les keywords de la DB si disponibles
 */
async function detectCategory(themeName, tags = []) {
  // Essayer d'utiliser la fonction DB (qui lit les keywords dynamiques)
  try {
    const dbCategory = await db.detectThemeCategory(themeName, tags);
    if (dbCategory && dbCategory !== 'custom') {
      return dbCategory;
    }
  } catch (error) {
    console.warn('⚠️ Fallback sur détection locale des catégories:', error.message);
  }

  // Fallback sur les keywords locaux
  return detectCategorySync(themeName, tags);
}

/**
 * Récupérer la liste des thèmes disponibles depuis tous les dossiers
 * (presets/, templates/, exports/)
 */
function getAvailablePresets() {
  const presets = [];
  const seenNames = new Set(); // Éviter les doublons par nom

  // Fonction helper pour lire un dossier
  const readThemesFromPath = (dirPath, source) => {
    try {
      if (!fs.existsSync(dirPath)) {
        console.log(`ℹ️ Dossier ${source} non trouvé:`, dirPath);
        return;
      }

      const files = fs.readdirSync(dirPath);

      for (const file of files) {
        if (!file.endsWith('.theme.json')) continue;

        const filePath = path.join(dirPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const theme = JSON.parse(content);

          const themeName = theme.metadata?.name || theme.theme?.name || file;

          // Éviter les doublons (garder la version la plus récente par fichier modifié)
          // On utilise le nom + source pour identifier
          const uniqueKey = `${themeName}_${source}`;
          if (seenNames.has(themeName)) {
            // Un thème avec le même nom existe déjà, on skip
            // sauf si c'est un export plus récent (garder le templates sur presets)
            continue;
          }
          seenNames.add(themeName);

          // Compter les missions (tous les types v2.1)
          let missionCount = 0;
          const missions = theme.missions || {};
          for (const type of Object.keys(missions)) {
            missionCount += Array.isArray(missions[type]) ? missions[type].length : 0;
          }

          // Extraire les tags existants ou en créer depuis les métadonnées
          const existingTags = theme.metadata?.tags || [];
          // Utiliser la catégorie définie dans le fichier, sinon détection locale synchrone
          const detectedCategory = theme.metadata?.category || detectCategorySync(themeName, existingTags);

          presets.push({
            id: file.replace('.theme.json', ''),
            file: file,
            path: dirPath, // Stocker le chemin pour l'import
            source: source, // presets, templates ou exports
            name: themeName,
            description: theme.metadata?.description || theme.theme?.description || 'Pas de description',
            emoji: theme.metadata?.emoji || null, // Emoji personnalisé depuis le fichier
            collectibles: theme.collectibles?.length || 0,
            traps: theme.traps?.length || 0,
            missions: missionCount,
            difficulty: theme.metadata?.difficulty || 'medium',
            tags: existingTags,
            category: detectedCategory, // Catégorie détectée ou définie
            version: theme.version || '1.0.0',
            exportedAt: theme.metadata?.exported_at || theme.metadata?.created_at || null
          });
        } catch (parseError) {
          console.warn(`⚠️ Erreur parsing ${file}:`, parseError.message);
        }
      }
    } catch (error) {
      console.error(`❌ Erreur lecture dossier ${source}:`, error);
    }
  };

  // Lire les 3 dossiers (ordre de priorité: templates > presets > exports)
  // Templates d'abord car c'est là que vont les exports depuis super-admin-panel
  readThemesFromPath(TEMPLATES_PATH, 'templates');
  readThemesFromPath(PRESETS_PATH, 'presets');
  readThemesFromPath(EXPORTS_PATH, 'exports');

  // Trier par date d'export (plus récent en premier) puis par nom
  presets.sort((a, b) => {
    if (a.exportedAt && b.exportedAt) {
      return new Date(b.exportedAt) - new Date(a.exportedAt);
    }
    if (a.exportedAt) return -1;
    if (b.exportedAt) return 1;
    return a.name.localeCompare(b.name);
  });

  console.log(`✅ ${presets.length} thèmes trouvés (templates: ${presets.filter(p => p.source === 'templates').length}, presets: ${presets.filter(p => p.source === 'presets').length}, exports: ${presets.filter(p => p.source === 'exports').length})`);

  return presets;

}

/**
 * Récupérer les catégories disponibles avec leur compte de thèmes
 * Version ASYNC qui charge les catégories depuis la DB
 */
async function getAvailableCategoriesAsync() {
  const presets = getAvailablePresets();
  const categoryCounts = {};

  // Compter les thèmes par catégorie
  for (const preset of presets) {
    const cat = preset.category || 'custom';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  // Essayer de charger les catégories depuis la DB
  let dbCategories = [];
  try {
    dbCategories = await db.getThemeCategories();
  } catch (error) {
    console.warn('⚠️ Fallback sur catégories locales:', error.message);
  }

  // Si on a des catégories DB, les utiliser
  if (dbCategories && dbCategories.length > 0) {
    const availableCategories = [];

    for (const dbCat of dbCategories) {
      const count = dbCat.code === 'all' ? presets.length : (categoryCounts[dbCat.code] || 0);
      // N'inclure que les catégories avec au moins 1 thème (ou 'all')
      if (count > 0 || dbCat.code === 'all') {
        availableCategories.push({
          id: dbCat.code,
          emoji: dbCat.emoji,
          label: dbCat.label,
          description: dbCat.description,
          count: count
        });
      }
    }

    return availableCategories;
  }

  // Fallback sur les catégories locales
  return getAvailableCategories();
}

/**
 * Récupérer les catégories disponibles avec leur compte de thèmes
 * Version SYNCHRONE (fallback)
 */
function getAvailableCategories() {
  const presets = getAvailablePresets();
  const categoryCounts = {};

  // Compter les thèmes par catégorie
  for (const preset of presets) {
    const cat = preset.category || 'custom';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  // Construire la liste des catégories avec au moins 1 thème
  const availableCategories = [
    { id: 'all', ...CATEGORIES['all'], count: presets.length }
  ];

  for (const [catId, catInfo] of Object.entries(CATEGORIES)) {
    if (catId === 'all') continue;
    if (categoryCounts[catId] && categoryCounts[catId] > 0) {
      availableCategories.push({
        id: catId,
        ...catInfo,
        count: categoryCounts[catId]
      });
    }
  }

  return availableCategories;
}

/**
 * Afficher l'écran de sélection des thèmes préconfigurés
 * Avec navigation par catégorie
 */
async function showThemeSelection(interaction, categoryFilter = 'all') {
  const allPresets = getAvailablePresets();

  // Filtrer par catégorie si nécessaire
  const presets = categoryFilter === 'all'
    ? allPresets
    : allPresets.filter(p => p.category === categoryFilter);

  // Vérifier si un thème est déjà actif
  const activeTheme = await db.getActiveTheme(interaction.guildId);

  // Récupérer les catégories disponibles (async pour DB)
  const categories = await getAvailableCategoriesAsync();
  // Chercher la catégorie actuelle dans la liste, fallback sur les constantes
  const currentCategory = categories.find(c => c.id === categoryFilter) || CATEGORIES[categoryFilter] || CATEGORIES['all'];

  let description = `# ${currentCategory.emoji} ${currentCategory.label}\n\n`;

  if (activeTheme) {
    description += `⚠️ **Thème actif:** ${activeTheme.name}\n`;
    description += `L'import d'un nouveau thème désactivera le thème actuel.\n\n`;
  }

  if (categoryFilter === 'all') {
    description += '📂 Sélectionnez une catégorie ou choisissez directement un thème.\n\n';
  } else {
    description += `📁 ${presets.length} thème(s) dans cette catégorie\n\n`;
  }

  // Afficher les stats des thèmes avec leur source (max 6 pour éviter trop de texte)
  const displayPresets = presets.slice(0, 6);
  for (const preset of displayPresets) {
    const difficultyEmoji = preset.difficulty === 'easy' ? '🟢' :
                           preset.difficulty === 'medium' ? '🟡' :
                           preset.difficulty === 'hard' ? '🔴' : '⚪';

    // Indicateur de source
    const sourceEmoji = preset.source === 'templates' ? '📂' :
                        preset.source === 'exports' ? '💾' : '📦';

    // Catégorie depuis la liste chargée ou fallback
    const presetCat = categories.find(c => c.id === preset.category) || CATEGORIES[preset.category];
    const catEmoji = presetCat?.emoji || '✨';
    const catLabel = presetCat?.label || 'Personnalisé';

    description += `**${getThemeEmoji(preset.id, preset.emoji)} ${preset.name}** ${sourceEmoji}\n`;
    description += `├─ ${preset.collectibles} collectibles | ${preset.missions} missions | ${preset.traps} pièges\n`;
    description += `├─ ${catEmoji} ${catLabel}\n`;
    description += `└─ ${difficultyEmoji} ${preset.difficulty} | v${preset.version}\n\n`;
  }

  if (presets.length > 6) {
    description += `_... et ${presets.length - 6} autre(s) thème(s)_\n\n`;
  }

  if (presets.length === 0) {
    description += `_Aucun thème dans cette catégorie._\n\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎨 Configuration - Choix du Thème')
    .setDescription(description)
    .setColor('#9B59B6')
    .setFooter({ text: '💡 Cliquez sur "👁️ Prévisualiser" après avoir sélectionné un thème' })
    .setTimestamp();

  const components = [];

  // Row 1: Menu de sélection des catégories (si plus de 2 catégories)
  if (categories.length > 2) {
    const categoryOptions = categories.map(cat => ({
      label: `${cat.label} (${cat.count})`,
      value: cat.id,
      description: cat.description,
      emoji: cat.emoji,
      default: cat.id === categoryFilter
    }));

    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId('setup_theme_category')
      .setPlaceholder('📁 Filtrer par catégorie...')
      .addOptions(categoryOptions);

    components.push(new ActionRowBuilder().addComponents(categorySelect));
  }

  // Row 2: Menu de sélection des thèmes
  if (presets.length > 0) {
    const themeOptions = presets.slice(0, 25).map(preset => { // Max 25 options
      const sourceLabel = preset.source === 'templates' ? '[T]' :
                          preset.source === 'exports' ? '[E]' : '[P]';
      const catEmoji = CATEGORIES[preset.category]?.emoji || '✨';
      return {
        label: `${preset.name} ${sourceLabel}`.slice(0, 100),
        value: preset.id,
        description: `${catEmoji} ${preset.collectibles} items, ${preset.missions} missions`.slice(0, 100),
        emoji: getThemeEmoji(preset.id, preset.emoji)
      };
    });

    // Ajouter l'option "Pas de thème"
    themeOptions.push({
      label: 'Créer mon propre thème',
      value: 'custom',
      description: 'Ignorer les presets et créer manuellement',
      emoji: '✨'
    });

    const themeSelect = new StringSelectMenuBuilder()
      .setCustomId('setup_theme_select')
      .setPlaceholder('🎨 Choisir un thème pour voir la prévisualisation...')
      .addOptions(themeOptions);

    components.push(new ActionRowBuilder().addComponents(themeSelect));
  }

  // Row 3: Boutons de navigation
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_back_to_roles')
      .setLabel('← Retour aux Rôles')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_skip_theme')
      .setLabel('➡️ Passer cette étape')
      .setStyle(ButtonStyle.Secondary)
  );
  components.push(navRow);

  await interaction.editReply({
    embeds: [embed],
    components
  });
}

/**
 * Gérer le changement de catégorie
 */
async function handleCategorySelect(interaction) {
  await interaction.deferUpdate();
  const selectedCategory = interaction.values[0];
  await showThemeSelection(interaction, selectedCategory);
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
 * Prévisualisation détaillée v2.3 avec collectibles, missions par type, pièges
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

  // Lire le fichier pour plus de détails (utiliser le path stocké)
  const filePath = path.join(preset.path, preset.file);
  const content = fs.readFileSync(filePath, 'utf8');
  const themeData = JSON.parse(content);

  // Compter les collectibles par rareté
  const rarityCount = { legendary: [], epic: [], rare: [], common: [] };
  for (const c of themeData.collectibles || []) {
    if (rarityCount[c.rarity]) {
      rarityCount[c.rarity].push(c);
    }
  }

  // Catégorie et tags
  const catEmoji = CATEGORIES[preset.category]?.emoji || '✨';
  const catLabel = CATEGORIES[preset.category]?.label || 'Personnalisé';
  const tags = preset.tags?.length > 0 ? preset.tags.join(', ') : 'Aucun tag';

  // Difficulté
  const difficultyEmoji = preset.difficulty === 'easy' ? '🟢' :
                          preset.difficulty === 'medium' ? '🟡' :
                          preset.difficulty === 'hard' ? '🔴' : '⚪';

  let description = `# ${getThemeEmoji(themeId, preset.emoji)} ${preset.name}\n\n`;
  description += `*${preset.description}*\n\n`;
  description += `${catEmoji} **Catégorie:** ${catLabel}\n`;
  description += `🏷️ **Tags:** ${tags}\n`;
  description += `${difficultyEmoji} **Difficulté:** ${preset.difficulty}\n\n`;

  // === COLLECTIBLES DÉTAILLÉS ===
  description += '## 📦 Collectibles\n\n';

  // Légendaires
  if (rarityCount.legendary.length > 0) {
    description += `**🟡 Légendaires (${rarityCount.legendary.length}):**\n`;
    const legendaryList = rarityCount.legendary.slice(0, 4).map(c => `${c.emoji || '🔶'} ${c.name}`).join(' • ');
    description += `${legendaryList}`;
    if (rarityCount.legendary.length > 4) description += ` _+${rarityCount.legendary.length - 4}_`;
    description += '\n\n';
  }

  // Épiques
  if (rarityCount.epic.length > 0) {
    description += `**🟣 Épiques (${rarityCount.epic.length}):**\n`;
    const epicList = rarityCount.epic.slice(0, 4).map(c => `${c.emoji || '🔷'} ${c.name}`).join(' • ');
    description += `${epicList}`;
    if (rarityCount.epic.length > 4) description += ` _+${rarityCount.epic.length - 4}_`;
    description += '\n\n';
  }

  // Rares
  if (rarityCount.rare.length > 0) {
    description += `**🔵 Rares (${rarityCount.rare.length}):**\n`;
    const rareList = rarityCount.rare.slice(0, 5).map(c => `${c.emoji || '🔹'} ${c.name}`).join(' • ');
    description += `${rareList}`;
    if (rarityCount.rare.length > 5) description += ` _+${rarityCount.rare.length - 5}_`;
    description += '\n\n';
  }

  // Communs
  if (rarityCount.common.length > 0) {
    description += `**⚪ Communs (${rarityCount.common.length}):**\n`;
    const commonList = rarityCount.common.slice(0, 5).map(c => `${c.emoji || '⬜'} ${c.name}`).join(' • ');
    description += `${commonList}`;
    if (rarityCount.common.length > 5) description += ` _+${rarityCount.common.length - 5}_`;
    description += '\n\n';
  }

  // === MISSIONS DÉTAILLÉES ===
  const missions = themeData.missions || {};
  const missionTypes = Object.keys(missions).filter(type => Array.isArray(missions[type]) && missions[type].length > 0);

  if (missionTypes.length > 0) {
    description += '## 🎯 Missions\n\n';

    const missionLabels = {
      quiz: { emoji: '❓', label: 'Quiz' },
      keyword: { emoji: '🔤', label: 'Mots-clés' },
      truefalse: { emoji: '✅', label: 'Vrai/Faux' },
      emoji_puzzle: { emoji: '🧩', label: 'Puzzle Emoji' },
      unscramble: { emoji: '🔀', label: 'Lettres mélangées' },
      hangman: { emoji: '💀', label: 'Le Pendu' },
      wordle: { emoji: '🟩', label: 'Wordle' }
    };

    for (const type of missionTypes) {
      const count = missions[type].length;
      const info = missionLabels[type] || { emoji: '📋', label: type };
      description += `${info.emoji} **${info.label}:** ${count} question(s)\n`;
    }
    description += '\n';
  }

  // === PIÈGES ===
  const traps = themeData.traps || [];
  if (traps.length > 0) {
    description += '## ⚠️ Pièges\n\n';
    const trapList = traps.slice(0, 4).map(t => `${t.emoji || '💣'} ${t.name}`).join(' • ');
    description += `${trapList}`;
    if (traps.length > 4) description += ` _+${traps.length - 4}_`;
    description += '\n\n';
  }

  // === RÔLES DE PROGRESSION ===
  if (themeData.theme_config?.progression_roles?.length > 0) {
    description += '## 🏅 Rôles de progression\n\n';
    for (const role of themeData.theme_config.progression_roles) {
      description += `├─ **${role.name}** (${role.percentage}%)\n`;
    }
    description += '\n';
  }

  // === CONFIGURATION ===
  description += '## ⚙️ Configuration\n\n';
  description += `├─ **Durée:** ${themeData.theme?.duration_days || 30} jours\n`;
  description += `├─ **Items requis:** ${themeData.theme?.required_items || 20}\n`;
  description += `└─ **Version:** v${preset.version}\n`;

  // Source du fichier
  const sourceLabel = preset.source === 'templates' ? '📂 Templates' :
                      preset.source === 'exports' ? '💾 Exports' : '📦 Presets';
  description += `\n_Source: ${sourceLabel}_`;

  const embed = new EmbedBuilder()
    .setTitle('👁️ Prévisualisation du thème')
    .setDescription(description)
    .setColor('#9B59B6')
    .setFooter({ text: '💡 Cliquez sur "Importer" pour installer ce thème' })
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

  // Chercher le fichier dans les 3 dossiers possibles
  const fileName = `${themeId}.theme.json`;
  let filePath = null;

  // Ordre de priorité: templates > presets > exports
  for (const dir of [TEMPLATES_PATH, PRESETS_PATH, EXPORTS_PATH]) {
    const testPath = path.join(dir, fileName);
    if (fs.existsSync(testPath)) {
      filePath = testPath;
      break;
    }
  }

  if (!filePath) {
    return interaction.editReply({
      content: `❌ Fichier thème non trouvé: ${fileName}\n\nRecherche effectuée dans:\n• templates/\n• presets/\n• exports/`,
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
      // result.errors est un tableau, pas result.error
      const errorMessage = Array.isArray(result.errors)
        ? result.errors.join('\n')
        : (result.errors || 'Erreur inconnue');
      return interaction.editReply({
        content: `❌ **Erreur lors de l'import:**\n\n${errorMessage}`,
        embeds: [],
        components: []
      });
    }

    // Créer le rôle bot pour les couleurs (si pas déjà existant)
    let botRoleInfo = null;
    try {
      const branding = await db.getGuildBranding(interaction.guildId);
      const botRole = await BotRoleManager.createOrGetBotRole(
        interaction.guild,
        branding.bot_display_name,
        branding.primary_color
      );
      botRoleInfo = { name: botRole.name, color: botRole.hexColor, created: botRole.created };
      console.log(`✅ Setup: Rôle bot créé/récupéré: ${botRole.name}`);
    } catch (error) {
      console.error('⚠️ Erreur lors de la création du rôle bot:', error);
      // Non bloquant - on continue
    }

    // Succès ! - Construire un récapitulatif détaillé du thème importé
    const themeName = themeData.metadata?.name || themeData.theme?.name;
    const themeDescription = themeData.metadata?.description || themeData.theme?.description || '';
    const themeDifficulty = themeData.metadata?.difficulty || 'medium';
    const themeDuration = themeData.theme?.duration_days || 30;
    const themeRequiredItems = themeData.theme?.required_items || 20;
    const themeEmoji = themeData.metadata?.emoji || null;

    // Compter les collectibles par rareté
    const rarityCount = {};
    for (const c of themeData.collectibles || []) {
      rarityCount[c.rarity] = (rarityCount[c.rarity] || 0) + 1;
    }

    // Difficulté emoji
    const difficultyEmoji = themeDifficulty === 'easy' ? '🟢' :
                           themeDifficulty === 'medium' ? '🟡' :
                           themeDifficulty === 'hard' ? '🔴' : '⚪';

    let successMessage = `# ${getThemeEmoji(themeId, themeEmoji)} ${themeName}\n\n`;

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
      successMessage += `**Rôle final:** ${result.roleCreated.name} ${result.roleCreated.created ? '✨ (créé)' : '(existant)'}\n`;
    }

    // Rôle bot pour les couleurs
    if (botRoleInfo) {
      successMessage += `**Rôle bot:** ${botRoleInfo.name} (${botRoleInfo.color})\n`;
    }
    successMessage += '\n';

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

    // Vérifier le positionnement des rôles
    const botMember = interaction.guild.members.me;
    const botHighestRole = botMember.roles.highest;
    const colorRoleNeedsPosition = botRoleInfo && botRoleInfo.name;

    // Vérifier si on doit afficher l'avertissement de positionnement
    let needsRolePositionWarning = false;

    // Vérifier si le rôle couleur est bien positionné (au-dessus d'au moins un rôle à attribuer)
    if (botRoleInfo) {
      const colorRole = interaction.guild.roles.cache.find(r => r.name === botRoleInfo.name);
      if (colorRole) {
        // Le rôle couleur doit être au-dessus des rôles de complétion/progression
        const completionRoles = [];
        if (result.roleCreated?.id) {
          const completionRole = interaction.guild.roles.cache.get(result.roleCreated.id);
          if (completionRole && colorRole.position <= completionRole.position) {
            needsRolePositionWarning = true;
          }
        }
        // Si le rôle couleur est tout en bas de la hiérarchie
        if (colorRole.position <= 1) {
          needsRolePositionWarning = true;
        }
      } else {
        needsRolePositionWarning = true;
      }
    } else {
      needsRolePositionWarning = true;
    }

    if (needsRolePositionWarning) {
      const botUsername = interaction.client.user.username;
      const completionRoleName = result.roleCreated?.name || '🏆 Rôle de complétion';

      successMessage += '### 🔴 Configuration détectée incorrecte\n';
      successMessage += '**Action requise:** Repositionnez les rôles du bot dans la hiérarchie.\n\n';
      successMessage += '```\n';
      successMessage += 'Paramètres serveur → Rôles\n';
      successMessage += '─────────────────────────────\n';
      successMessage += '@Fondateur         ← peut rester ici\n';
      successMessage += '@Administrateur    ← peut rester ici\n';
      successMessage += '─────────────────────────────\n';
      successMessage += `@${botUsername}    ← REMONTER ICI\n`;
      if (botRoleInfo) {
        successMessage += `@${botRoleInfo.name.replace('🤖 ', '')} ← sous le principal\n`;
      }
      successMessage += '─────────────────────────────\n';
      successMessage += `@${completionRoleName}  ← doit être EN DESSOUS\n`;
      successMessage += '─────────────────────────────\n';
      successMessage += '```\n';
      successMessage += '> 💡 Vos rôles admin/fondateur peuvent rester au-dessus du bot.\n\n';
    }

    if (shouldActivate) {
      if (needsRolePositionWarning) {
        successMessage += '1. **Remontez les rôles du bot** dans la hiérarchie\n';
        successMessage += '2. Configurez les canaux de give dans `/admin-panel`\n';
        successMessage += '3. Lancez un Give pour tester !\n';
      } else {
        successMessage += '1. Configurez les canaux de give dans `/admin-panel`\n';
        successMessage += '2. Lancez un Give pour tester !\n';
      }
    } else {
      if (needsRolePositionWarning) {
        successMessage += '1. **Remontez les rôles du bot** dans la hiérarchie\n';
        successMessage += '2. Activez ce thème quand vous serez prêt\n';
        successMessage += '3. Configurez les canaux de give dans `/admin-panel`\n';
      } else {
        successMessage += '1. Activez ce thème quand vous serez prêt\n';
        successMessage += '2. Configurez les canaux de give dans `/admin-panel`\n';
      }
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
 * Priorité: emoji du preset > mapping hardcodé > emoji par défaut
 */
function getThemeEmoji(themeId, presetEmoji = null) {
  // Priorité 1: Emoji personnalisé depuis les métadonnées du fichier
  if (presetEmoji) {
    return presetEmoji;
  }

  // Priorité 2: Mapping hardcodé pour les thèmes connus
  const emojis = {
    'monopoly': '🎩',
    'pokemon': '⚡',
    'harry-potter': '🪄',
    'harry_potter': '🪄',
    'harry_potter_reliques': '🪄',
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
  handleCategorySelect,
  getAvailablePresets,
  getAvailableCategories,
  getAvailableCategoriesAsync,
  CATEGORIES
};
