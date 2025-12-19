const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database-pg');
const { getLoomixFooter, LOOMIX_BRANDING } = require('../utils/footerHelper');

// Couleurs par section
const COLORS = {
  home: '#9b59b6',      // Violet
  mysterybox: '#e91e63', // Rose
  collectibles: '#f39c12', // Orange
  traps: '#e74c3c',     // Rouge
  missions: '#3498db',   // Bleu
  bonus: '#2ecc71',      // Vert
  profile: '#9b59b6',   // Violet
  faq: '#95a5a6'        // Gris
};

/**
 * Créer les boutons de navigation (communs à toutes les vues)
 */
function createNavigationButtons(currentView) {
  const views = [
    { id: 'tutorial_home', label: 'Accueil', emoji: '🏠' },
    { id: 'tutorial_mysterybox', label: 'MysteryBox', emoji: '🎁' },
    { id: 'tutorial_collectibles', label: 'Collectibles', emoji: '⭐' },
    { id: 'tutorial_traps', label: 'Pièges', emoji: '⚠️' }
  ];

  const views2 = [
    { id: 'tutorial_missions', label: 'Missions', emoji: '🎯' },
    { id: 'tutorial_bonus', label: 'Super Bonus', emoji: '✨' },
    { id: 'tutorial_profile', label: 'Profile', emoji: '👤' },
    { id: 'tutorial_faq', label: 'FAQ', emoji: '❓' }
  ];

  const row1 = new ActionRowBuilder().addComponents(
    views.map(v => new ButtonBuilder()
      .setCustomId(v.id)
      .setLabel(v.label)
      .setEmoji(v.emoji)
      .setStyle(v.id === currentView ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(v.id === currentView)
    )
  );

  const row2 = new ActionRowBuilder().addComponents(
    views2.map(v => new ButtonBuilder()
      .setCustomId(v.id)
      .setLabel(v.label)
      .setEmoji(v.emoji)
      .setStyle(v.id === currentView ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(v.id === currentView)
    )
  );

  return [row1, row2];
}

/**
 * 🏠 VUE ACCUEIL - Présentation générale du jeu
 */
async function showTutorialHome(interaction) {
  const guildId = interaction.guildId;
  const theme = await db.getActiveTheme(guildId);

  const embed = new EmbedBuilder()
    .setTitle('📚 GUIDE MYSTERYBOX')
    .setColor(COLORS.home)
    .setDescription(
      '> *Bienvenue dans le guide interactif du jeu MysteryBox !*\n\n' +
      '**Utilise les boutons ci-dessous pour naviguer entre les sections.**\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '🎮 Le Concept',
        value:
          'Le bot fait apparaître des **MysteryBox** dans les canaux du serveur.\n' +
          'Clique dessus pour découvrir ce qu\'elles contiennent !\n' +
          '• 🎁 **Collectibles** - Items à collectionner\n' +
          '• ⚠️ **Pièges** - Malus temporaires\n' +
          '• 🎯 **Missions** - Défis pour gagner des récompenses\n' +
          '• ✨ **Super Bonus** - Pouvoirs spéciaux',
        inline: false
      },
      {
        name: '🎯 L\'Objectif',
        value:
          `Collecte **tous les items** du thème actif pour compléter ta collection !\n` +
          `${theme ? `📍 **Thème actuel:** ${theme.name} (${theme.required_items} items)` : '📍 Aucun thème actif'}`,
        inline: false
      },
      {
        name: '⌨️ Commandes Essentielles',
        value:
          '`/profile` → Voir ta progression, inventaire et **activer tes bonus**\n' +
          '`/leaderboard` → Classement des meilleurs joueurs\n' +
          '`/tutoriel` → Ce guide (tu y es !)',
        inline: false
      },
      {
        name: '📋 Sommaire du Guide',
        value:
          '🎁 **MysteryBox** - Comment ça marche\n' +
          '⭐ **Collectibles** - Raretés et probabilités\n' +
          '⚠️ **Pièges** - Types et effets\n' +
          '🎯 **Missions** - Comment les valider\n' +
          '✨ **Super Bonus** - Obtenir et activer ses bonus\n' +
          '👤 **Profile** - Utiliser /profile et /leaderboard\n' +
          '❓ **FAQ** - Questions fréquentes',
        inline: false
      }
    )
    .setFooter(await getLoomixFooter(guildId))
    .setTimestamp();

  const [row1, row2] = createNavigationButtons('tutorial_home');

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

/**
 * 🎁 VUE MYSTERYBOX - Comment fonctionnent les boîtes
 */
async function showTutorialMysteryBox(interaction) {
  const guildId = interaction.guildId;

  const embed = new EmbedBuilder()
    .setTitle('🎁 LES MYSTERYBOX')
    .setColor(COLORS.mysterybox)
    .setDescription(
      '> *Les MysteryBox sont le cœur du jeu !*\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '📍 Où les trouver ?',
        value:
          'Les MysteryBox apparaissent **aléatoirement** dans les canaux configurés.\n' +
          'Quand une boîte apparaît, tu verras un message avec un **bouton à cliquer**.',
        inline: false
      },
      {
        name: '🖱️ Comment ouvrir ?',
        value:
          '**1.** Clique sur le bouton de la MysteryBox\n' +
          '**2.** Une animation de révélation se lance\n' +
          '**3.** Tu découvres ton contenu (collectible, piège ou mission)',
        inline: false
      },
      {
        name: '📦 Contenu possible',
        value:
          '```\n' +
          '🎁 Collectible    │ Tu obtiens un item pour ta collection\n' +
          '⚠️ Piège          │ Un malus temporaire s\'applique\n' +
          '🎯 Mission        │ Un défi à relever pour une récompense\n' +
          '✨ Super Bonus    │ Un pouvoir spécial temporaire (rare)\n' +
          '```',
        inline: false
      },
      {
        name: '⏱️ Cooldown',
        value:
          'Après avoir ouvert une boîte, tu as un **petit cooldown** avant de pouvoir en ouvrir une autre.\n' +
          'Cela permet à tout le monde d\'avoir une chance !',
        inline: false
      },
      {
        name: '💡 Astuce',
        value:
          '> Sois rapide mais pas trop ! Les pièges sont aussi dans les boîtes...\n' +
          '> Avoir un **Bouclier Anti-Piège** actif te protège !',
        inline: false
      }
    )
    .setFooter(await getLoomixFooter(guildId))
    .setTimestamp();

  const [row1, row2] = createNavigationButtons('tutorial_mysterybox');

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

/**
 * ⭐ VUE COLLECTIBLES - Raretés et probabilités
 */
async function showTutorialCollectibles(interaction) {
  const guildId = interaction.guildId;
  const theme = await db.getActiveTheme(guildId);

  // Récupérer les probabilités actuelles (avec gestion d'erreur)
  let probabilities = null;
  if (theme) {
    try {
      probabilities = await db.queryOne(
        'SELECT * FROM rarity_probabilities WHERE guild_id = $1 AND theme_id = $2',
        [guildId, theme.id]
      );
    } catch (e) {
      // Table peut ne pas exister sur certains serveurs
      probabilities = null;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('⭐ LES COLLECTIBLES')
    .setColor(COLORS.collectibles)
    .setDescription(
      '> *Les items à collectionner pour compléter le thème !*\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '🎨 Les 4 Raretés',
        value:
          '```\n' +
          '⚪ COMMUN     │ Items de base, faciles à obtenir\n' +
          '🔵 RARE       │ Items moins fréquents\n' +
          '🟣 ÉPIQUE     │ Items difficiles à trouver\n' +
          '🟡 LÉGENDAIRE │ Items très rares et précieux\n' +
          '```',
        inline: false
      },
      {
        name: '📊 Probabilités Actuelles',
        value: probabilities
          ? `\`\`\`\n` +
            `⚪ Commun     : ${probabilities.common_chance}%\n` +
            `🔵 Rare       : ${probabilities.rare_chance}%\n` +
            `🟣 Épique     : ${probabilities.epic_chance}%\n` +
            `🟡 Légendaire : ${probabilities.legendary_chance}%\n` +
            `\`\`\``
          : '*Aucun thème actif - Probabilités non disponibles*',
        inline: false
      },
      {
        name: '🔄 Doublons',
        value:
          'Si tu obtiens un collectible que tu as **déjà**, tu le gardes quand même !\n' +
          'Les doublons comptent dans tes statistiques mais pas dans ta progression.',
        inline: false
      },
      {
        name: '💀 Perte de Collectible',
        value:
          '> ⚠️ **Attention !** Certains pièges peuvent te faire **perdre** un collectible.\n' +
          '> Le collectible perdu peut être n\'importe lequel de ta collection.',
        inline: false
      },
      {
        name: '👀 Voir ta Collection',
        value:
          'Utilise la commande `/profile` puis clique sur **🎒 Inventaire**\n' +
          'pour voir tous tes collectibles organisés par rareté.',
        inline: false
      }
    )
    .setFooter(await getLoomixFooter(guildId))
    .setTimestamp();

  const [row1, row2] = createNavigationButtons('tutorial_collectibles');

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

/**
 * ⚠️ VUE PIÈGES - Types et effets
 */
async function showTutorialTraps(interaction) {
  const guildId = interaction.guildId;
  const theme = await db.getActiveTheme(guildId);

  // Récupérer les pièges du thème actif (avec gestion d'erreur)
  let traps = [];
  if (theme) {
    try {
      traps = await db.queryAll(
        'SELECT name, type, description FROM traps WHERE guild_id = $1 AND theme_id = $2 AND is_active = true ORDER BY type',
        [guildId, theme.id]
      );
    } catch (e) {
      // Colonnes peuvent varier selon les serveurs
      traps = [];
    }
  }

  const trapTypeEmojis = {
    'cooldown': '⏱️',
    'lose-collectible': '💀',
    'lose-all-collectibles': '☠️',
    'public-shame': '😱',
    'empty-box': '📦'
  };

  const trapTypeDescriptions = {
    'cooldown': 'Bloque l\'ouverture de boîtes pendant un temps',
    'lose-collectible': 'Tu perds un collectible aléatoire',
    'lose-all-collectibles': 'Tu perds TOUS tes collectibles!',
    'public-shame': 'Message public annonçant ton piège',
    'empty-box': 'Boîte vide, pas de gain'
  };

  let trapsDisplay = '';
  if (traps.length > 0) {
    trapsDisplay = traps.slice(0, 8).map(t => {
      const emoji = trapTypeEmojis[t.type] || '⚠️';
      return `${emoji} **${t.name}**\n└ ${t.description || trapTypeDescriptions[t.type] || 'Effet spécial'}`;
    }).join('\n\n');
  } else {
    trapsDisplay = '*Aucun piège configuré pour ce thème*';
  }

  const embed = new EmbedBuilder()
    .setTitle('⚠️ LES PIÈGES')
    .setColor(COLORS.traps)
    .setDescription(
      '> *Attention où tu cliques ! Les pièges rôdent...*\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '🎭 Les 5 Types de Pièges',
        value:
          '```\n' +
          '⏱️ COOLDOWN        │ Bloqué pendant X minutes\n' +
          '💀 VOLEUR          │ Perd UN collectible\n' +
          '☠️ DÉVASTATEUR     │ Perd TOUS tes collectibles!\n' +
          '😱 HONTE PUBLIQUE  │ Annonce publique du piège\n' +
          '📦 BOÎTE VIDE      │ Rien dedans, pas de gain\n' +
          '```',
        inline: false
      },
      {
        name: `📋 Pièges du Thème Actif (${theme?.name || 'Aucun'})`,
        value: trapsDisplay,
        inline: false
      },
      {
        name: '🛡️ Le Bouclier Anti-Piège',
        value:
          '> C\'est un **Super Bonus** qui te protège !\n' +
          '> Quand tu as un bouclier actif et que tu tombes sur un piège,\n' +
          '> le piège est **annulé** et tu perds juste une charge de bouclier.',
        inline: false
      },
      {
        name: '💡 Conseils',
        value:
          '• Les pièges sont **temporaires** - attends que l\'effet passe\n' +
          '• Vérifie tes bonus actifs avec `/profile` → **💫 Mes Bonus**\n' +
          '• Un bouclier peut te sauver d\'un piège dévastateur !',
        inline: false
      }
    )
    .setFooter(await getLoomixFooter(guildId))
    .setTimestamp();

  const [row1, row2] = createNavigationButtons('tutorial_traps');

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

/**
 * 🎯 VUE MISSIONS - Types et validation
 */
async function showTutorialMissions(interaction) {
  const guildId = interaction.guildId;

  const embed = new EmbedBuilder()
    .setTitle('🎯 LES MISSIONS')
    .setColor(COLORS.missions)
    .setDescription(
      '> *Des défis pour gagner des récompenses garanties !*\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '🎲 Les 4 Types de Missions',
        value:
          '```\n' +
          '❓ QUIZ         │ Écris la bonne réponse\n' +
          '✅ VRAI/FAUX    │ Choisis VRAI ou FAUX\n' +
          '🧩 EMOJI PUZZLE │ Déchiffre les emojis\n' +
          '🔑 MOT-CLÉ      │ Fais deviner un mot (social)\n' +
          '```',
        inline: false
      },
      {
        name: '📝 Comment ça marche ?',
        value:
          '**1.** Tu ouvres une MysteryBox et obtiens une mission\n' +
          '**2.** Un **thread privé** s\'ouvre pour toi\n' +
          '**3.** Tu as un **temps limité** pour répondre\n' +
          '**4.** Si tu réussis → **Récompense garantie** !\n' +
          '**5.** Si tu échoues → Pas de pénalité, juste pas de récompense',
        inline: false
      },
      {
        name: '🎁 Récompenses',
        value:
          'Les missions donnent des **collectibles garantis** !\n' +
          'La rareté dépend de la difficulté de la mission.\n' +
          '> 💡 C\'est le meilleur moyen d\'obtenir des items **sans risque de piège**.',
        inline: false
      },
      {
        name: '⏱️ Temps Limite',
        value:
          'Chaque mission a un **timer** (généralement quelques minutes).\n' +
          'Si le temps expire, la mission est considérée comme échouée.\n' +
          '> ⚠️ Ne quitte pas le thread sans répondre !',
        inline: false
      },
      {
        name: '🔑 Missions Mots-Clés (Social)',
        value:
          '**C\'est une mission collaborative !**\n' +
          '```diff\n' +
          '+ Tu connais le MOT SECRET à faire deviner\n' +
          '+ Tu dois faire en sorte qu\'un AUTRE joueur\n' +
          '  écrive ce mot dans le thread\n' +
          '- ⚠️ Si TU écris le mot, tu PERDS la mission!\n' +
          '```\n' +
          '> 💡 Donne des indices, pose des questions, sois créatif !',
        inline: false
      }
    )
    .setFooter(await getLoomixFooter(guildId))
    .setTimestamp();

  const [row1, row2] = createNavigationButtons('tutorial_missions');

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

/**
 * ✨ VUE SUPER BONUS - Pouvoirs spéciaux (COMPLET)
 */
async function showTutorialBonus(interaction) {
  const guildId = interaction.guildId;

  // Récupérer les super bonus actifs (avec gestion d'erreur)
  let bonuses = [];
  try {
    bonuses = await db.queryAll(
      'SELECT name, description, effect_type FROM super_bonuses WHERE guild_id = $1 AND is_active = true ORDER BY effect_type, name',
      [guildId]
    );
  } catch (e) {
    // Colonnes peuvent varier selon les serveurs
    bonuses = [];
  }

  const bonusEffectEmojis = {
    'joker': '🃏',
    'double_collectible': '✨',
    'shield': '🛡️',
    'cooldown_reduction': '⚡',
    'rarity_boost': '🌟',
    'mystery_reveal': '👁️',
    'extra_life': '❤️',
    'magnet': '🧲',
    'jackpot': '💰'
  };

  // Afficher les bonus disponibles (sans distinction durée/charges car colonnes variables)
  let bonusDisplay = bonuses.length > 0
    ? bonuses.slice(0, 8).map(b => {
        const emoji = bonusEffectEmojis[b.effect_type] || '✨';
        return `${emoji} **${b.name}**`;
      }).join('\n')
    : '*Aucun bonus configuré*';

  const embed = new EmbedBuilder()
    .setTitle('✨ LES SUPER BONUS')
    .setColor(COLORS.bonus)
    .setDescription(
      '> *Des pouvoirs spéciaux pour booster ta chance !*\n\n' +
      'Les Super Bonus sont des **avantages temporaires** que tu peux obtenir\n' +
      'en ouvrant des MysteryBox. Ils t\'aident à progresser plus vite !\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '🎁 Comment Obtenir un Super Bonus ?',
        value:
          '**1.** Ouvre une MysteryBox (clique sur le bouton)\n' +
          '**2.** Si tu as de la chance, tu obtiens un Super Bonus !\n' +
          '**3.** Le bonus s\'ajoute à ton inventaire **en attente**\n' +
          '**4.** Tu dois l\'**activer manuellement** via `/profile`',
        inline: false
      },
      {
        name: '🚀 Comment ACTIVER un Super Bonus ?',
        value:
          '```\n' +
          '1. Tape /profile\n' +
          '2. Clique sur 💫 Mes Bonus\n' +
          '3. Tes bonus EN ATTENTE apparaissent\n' +
          '4. Clique sur le bouton du bonus à activer\n' +
          '5. Le bonus est maintenant ACTIF !\n' +
          '```\n' +
          '> ⚠️ **Important** : Un bonus en attente ne fait **RIEN** tant qu\'il n\'est pas activé !',
        inline: false
      },
      {
        name: '📋 Super Bonus Disponibles',
        value: bonusDisplay,
        inline: false
      },
      {
        name: '⏱️ Bonus à DURÉE vs 🔢 Bonus à CHARGES',
        value:
          '**⏱️ DURÉE** : Actif pendant X heures (expire même hors-ligne)\n' +
          '**🔢 CHARGES** : S\'utilise X fois (ne s\'épuise qu\'en jouant)\n\n' +
          '```diff\n' +
          '+ Durée : Idéal pour jouer longtemps d\'affilée\n' +
          '+ Charges : Idéal pour sessions espacées\n' +
          '```',
        inline: false
      },
      {
        name: '🎭 Types d\'Effets',
        value:
          '🃏 **JOKER** → **LE PLUS RARE !** Choisis et débloque un collectible instantanément\n' +
          '🛡️ **Bouclier** → Bloque les pièges (consomme 1 charge par piège bloqué)\n' +
          '👁️ **Vision Divine** → Révèle le contenu AVANT d\'ouvrir\n' +
          '🧲 **Aimant** → Augmente tes chances de rareté élevée\n' +
          '💰 **Jackpot X2** → Gagne 2 collectibles au lieu d\'un seul !',
        inline: false
      },
      {
        name: '💡 Conseils Stratégiques',
        value:
          '• **Bouclier** : Active-le AVANT une session de jeu intensive\n' +
          '• **Vision Divine** : Parfait pour éviter les pièges ciblés\n' +
          '• **Aimant/Jackpot** : Garde-les pour les moments importants\n' +
          '• Tu peux avoir **plusieurs bonus actifs** en même temps !',
        inline: false
      }
    )
    .setFooter(await getLoomixFooter(guildId))
    .setTimestamp();

  const [row1, row2] = createNavigationButtons('tutorial_bonus');

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

/**
 * 👤 VUE PROFILE - Commande /profile complète
 */
async function showTutorialProfile(interaction) {
  const guildId = interaction.guildId;
  const theme = await db.getActiveTheme(guildId);

  // Récupérer les rôles de progression depuis theme_config (JSON)
  let roles = [];
  if (theme) {
    try {
      // Les rôles de progression sont stockés dans theme_config.progression_roles (JSON)
      const config = await db.queryOne(
        'SELECT progression_roles FROM theme_config WHERE guild_id = $1 AND theme_id = $2',
        [guildId, theme.id]
      );
      if (config && config.progression_roles) {
        // progression_roles est un tableau JSON [{name, percentage, role_id}, ...]
        roles = Array.isArray(config.progression_roles)
          ? config.progression_roles
          : [];
        // Trier par pourcentage croissant
        roles.sort((a, b) => (a.percentage || 0) - (b.percentage || 0));
      }
    } catch (e) {
      // Fallback: essayer l'ancienne table progression_roles
      try {
        roles = await db.queryAll(
          'SELECT role_name as name, percentage FROM progression_roles WHERE guild_id = $1 AND theme_id = $2 ORDER BY percentage ASC',
          [guildId, theme.id]
        );
      } catch (e2) {
        roles = [];
      }
    }
  }

  // Construire l'affichage des rôles (progression + rôle final)
  let rolesDisplay = '';
  if (roles.length > 0) {
    rolesDisplay = roles.map(r => `🎖️ **${r.name || r.role_name}** - ${r.percentage}%`).join('\n');
  }
  // Ajouter le rôle final (100%) depuis le thème
  if (theme && theme.final_role_name) {
    rolesDisplay += (rolesDisplay ? '\n' : '') + `👑 **${theme.final_role_name}** - 100% (Collection complète!)`;
  }
  if (!rolesDisplay) {
    rolesDisplay = '*Aucun rôle de progression configuré*';
  }

  const embed = new EmbedBuilder()
    .setTitle('👤 LA COMMANDE /PROFILE')
    .setColor(COLORS.profile)
    .setDescription(
      '> *Ton tableau de bord personnel !*\n\n' +
      'La commande `/profile` est **essentielle** pour suivre ta progression\n' +
      'et gérer tes bonus. Voici tout ce que tu peux y faire :\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '📊 Vue Principale (Accueil)',
        value:
          'Quand tu tapes `/profile`, tu vois :\n' +
          '```\n' +
          '• Ta barre de progression (X/Y items)\n' +
          '• Ton classement actuel sur le serveur\n' +
          '• Le thème en cours et ta collection\n' +
          '• Tes statistiques globales\n' +
          '```',
        inline: false
      },
      {
        name: '🎒 Bouton "Inventaire"',
        value:
          'Affiche **tous tes collectibles** organisés par rareté :\n' +
          '• 🟡 Légendaires\n' +
          '• 🟣 Épiques\n' +
          '• 🔵 Rares\n' +
          '• ⚪ Communs\n\n' +
          '> Tu peux naviguer entre les pages si tu as beaucoup d\'items.',
        inline: false
      },
      {
        name: '💫 Bouton "Mes Bonus" ⭐',
        value:
          'C\'est ici que tu **gères tes Super Bonus** !\n' +
          '```diff\n' +
          '+ BONUS ACTIFS : Ceux qui sont en cours\n' +
          '  → Voir le temps/charges restantes\n' +
          '\n' +
          '+ BONUS EN ATTENTE : À activer !\n' +
          '  → Clique sur le bouton pour activer\n' +
          '```\n' +
          '> ⚠️ Un bonus en attente ne sert à **RIEN** tant qu\'il n\'est pas activé !',
        inline: false
      },
      {
        name: '🏅 Bouton "Badges"',
        value:
          'Affiche tes **badges débloqués** et ta progression vers les suivants.\n' +
          'Les badges sont des récompenses permanentes pour tes accomplissements !',
        inline: false
      },
      {
        name: '🏆 Commande /leaderboard',
        value:
          'Tape `/leaderboard` pour voir le **classement du serveur** !\n' +
          '```\n' +
          '🥇 1er - Le meilleur chasseur\n' +
          '🥈 2ème - Juste derrière\n' +
          '🥉 3ème - Sur le podium\n' +
          '... et les autres joueurs\n' +
          '```\n' +
          'Le classement est basé sur le **nombre de collectibles uniques**.',
        inline: false
      },
      {
        name: `🎖️ Rôles à Débloquer (${theme?.name || 'Aucun thème'})`,
        value:
          rolesDisplay + '\n\n' +
          '> Quand tu atteins un palier, tu obtiens automatiquement le rôle !',
        inline: false
      },
      {
        name: '🎯 Compléter la Collection',
        value:
          'Quand tu as **TOUS** les items du thème :\n' +
          '🎉 Annonce publique de ta victoire\n' +
          '👑 Rôle spécial de complétion\n' +
          '🏆 Badge permanent sur ton profil',
        inline: false
      }
    )
    .setFooter(await getLoomixFooter(guildId))
    .setTimestamp();

  const [row1, row2] = createNavigationButtons('tutorial_profile');

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

/**
 * ❓ VUE FAQ - Questions fréquentes
 */
async function showTutorialFAQ(interaction) {
  const guildId = interaction.guildId;

  const embed = new EmbedBuilder()
    .setTitle('❓ QUESTIONS FRÉQUENTES')
    .setColor(COLORS.faq)
    .setDescription(
      '> *Réponses aux questions les plus posées !*\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '💬 "J\'ai perdu un collectible, pourquoi ?"',
        value:
          'Tu es probablement tombé dans un **piège Voleur** (💀).\n' +
          'Ce piège retire aléatoirement un de tes collectibles.\n' +
          '> 💡 Utilise un **Bouclier** pour te protéger !',
        inline: false
      },
      {
        name: '💬 "Je ne peux plus ouvrir de boîtes !"',
        value:
          'Deux possibilités :\n' +
          '• Tu as un **cooldown** normal (quelques secondes)\n' +
          '• Tu es tombé dans un **piège Cooldown** (plusieurs minutes)\n' +
          '> Vérifie ton statut avec `/profile` → Mes Bonus',
        inline: false
      },
      {
        name: '💬 "Comment voir ma collection ?"',
        value:
          'Tape `/profile` puis clique sur **🎒 Inventaire**.\n' +
          'Tu verras tous tes collectibles organisés par rareté.',
        inline: false
      },
      {
        name: '💬 "C\'est quoi le truc qui brille/clignote ?"',
        value:
          'C\'est une **MysteryBox** ! Clique dessus vite pour l\'ouvrir.\n' +
          'D\'autres joueurs peuvent aussi cliquer dessus !',
        inline: false
      },
      {
        name: '💬 "Mon bonus a disparu ?"',
        value:
          'Les bonus ont une **durée limitée** ou un **nombre de charges**.\n' +
          'Quand ils expirent, ils disparaissent automatiquement.',
        inline: false
      },
      {
        name: '💬 "Comment obtenir des items légendaires ?"',
        value:
          '• **Chance pure** : Ouvrir beaucoup de MysteryBox\n' +
          '• **Missions** : Certaines donnent des items rares\n' +
          '• **Bonus Rareté** : Augmente tes chances temporairement\n' +
          '• **Aimant** : Attire spécifiquement les items rares',
        inline: false
      },
      {
        name: '🆘 Besoin d\'aide ?',
        value:
          'Si tu as une question non listée ici, contacte un membre du **Staff** !\n' +
          'Ils sont là pour t\'aider.',
        inline: false
      }
    )
    .setFooter(await getLoomixFooter(guildId))
    .setTimestamp();

  const [row1, row2] = createNavigationButtons('tutorial_faq');

  return {
    embeds: [embed],
    components: [row1, row2]
  };
}

module.exports = {
  showTutorialHome,
  showTutorialMysteryBox,
  showTutorialCollectibles,
  showTutorialTraps,
  showTutorialMissions,
  showTutorialBonus,
  showTutorialProfile,
  showTutorialFAQ,
  // Export pour le handler
  VIEWS: {
    'tutorial_home': showTutorialHome,
    'tutorial_mysterybox': showTutorialMysteryBox,
    'tutorial_collectibles': showTutorialCollectibles,
    'tutorial_traps': showTutorialTraps,
    'tutorial_missions': showTutorialMissions,
    'tutorial_bonus': showTutorialBonus,
    'tutorial_profile': showTutorialProfile,
    'tutorial_faq': showTutorialFAQ
  }
};
