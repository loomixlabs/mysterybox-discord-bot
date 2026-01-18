---
name: graphiques-discord
description: |
  Expert en design graphique Discord de niveau supérieur.
  ACTIVE AUTOMATIQUEMENT quand:
  - Création d'embeds, boutons, menus
  - Design d'interface utilisateur bot
  - Amélioration visuelle de messages
  - Création de wizards interactifs

  Exploite: Components V2, containers, séparateurs, progress bars ASCII.
  Surpasse la concurrence avec des designs uniques et modernes.
---

# Graphiques Discord - Excellence Visuelle

## Philosophie

> **Nous faisons ce qu'il y a de MIEUX en matière de graphismes Discord.**
> Exploiter au maximum l'API Discord. Surpasser la concurrence.

## RÈGLE ABSOLUE - Préférence Utilisateur

```
❌ JAMAIS de modals pour les interactions complexes
✅ TOUJOURS des wizards étape par étape avec boutons dans le chat
```

**Raison**: Les modals interrompent le flow, les wizards guident l'utilisateur visuellement.

## Components V2 (2025-2026)

Discord a introduit Components V2 avec de nouvelles possibilités:

### Nouveaux Composants

| Composant | Usage |
|-----------|-------|
| **Containers** | Regrouper éléments avec style moderne |
| **Separators** | Séparer visuellement les sections |
| **Text Display** | Placement flexible du texte |
| **Media Gallery** | Affichage d'images amélioré |

### Activation Components V2

```javascript
// Flag requis pour le rendu V2
const message = {
  components: [...],
  flags: MessageFlags.IsComponentsV2
};
```

## Patterns de Design

### 1. Wizard Étape par Étape (PRÉFÉRÉ)

```javascript
// ✅ CORRECT - Wizard avec boutons
async showDurationWizard(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('⏱️ Modifier la Durée du Thème')
    .setDescription(
      '**Étape 1/2** - Choisir l\'action\n\n' +
      '📊 Durée actuelle: **45 jours**\n' +
      '━━━━━━━━━━━━━━━━━━━━'
    )
    .setColor('#3498db');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('duration_add')
      .setLabel('➕ Prolonger')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('duration_reduce')
      .setLabel('➖ Réduire')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('duration_set')
      .setLabel('🎯 Définir exactement')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.update({ embeds: [embed], components: [row] });
}

// ❌ INTERDIT - Modal
async showDurationModal(interaction) {
  const modal = new ModalBuilder()... // NE PAS FAIRE
}
```

### 2. Progress Bars ASCII

```javascript
// Barre de progression visuelle
function createProgressBar(percentage, length = 10) {
  const filled = Math.round(percentage / 100 * length);
  const empty = length - filled;

  // Style moderne avec gradient
  const fillChar = '█';
  const emptyChar = '░';

  return fillChar.repeat(filled) + emptyChar.repeat(empty) + ` ${percentage}%`;
}

// Exemple: █████████░ 90%
```

### 3. Séparateurs Visuels

```javascript
// Séparateurs élégants
const SEPARATORS = {
  thin: '─'.repeat(20),
  thick: '━'.repeat(20),
  double: '═'.repeat(20),
  dotted: '┄'.repeat(20),
  fancy: '◆━━━━━━━━━━━━━━━◆'
};
```

### 4. Indicateurs de Statut

```javascript
// Statuts avec émojis composés
const STATUS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  loading: '⏳',
  locked: '🔒',
  unlocked: '🔓',
  premium: '👑',
  new: '🆕',
  hot: '🔥'
};
```

## Styles de Boutons

| Style | Couleur | Usage |
|-------|---------|-------|
| `Primary` | Bleu | Action principale |
| `Secondary` | Gris | Navigation, retour |
| `Success` | Vert | Confirmation positive |
| `Danger` | Rouge | Suppression, annulation |
| `Link` | Gris + lien | URL externe |

### Règle des Boutons

```javascript
// Rangée type pour wizard
const navigationRow = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('back')
    .setLabel('◀️ Retour')
    .setStyle(ButtonStyle.Secondary),
  new ButtonBuilder()
    .setCustomId('confirm')
    .setLabel('✅ Confirmer')
    .setStyle(ButtonStyle.Success),
  new ButtonBuilder()
    .setCustomId('cancel')
    .setLabel('❌ Annuler')
    .setStyle(ButtonStyle.Danger)
);
```

## Palettes de Couleurs

```javascript
// Couleurs cohérentes par contexte
const COLORS = {
  // Actions
  success: '#2ecc71',
  error: '#e74c3c',
  warning: '#f39c12',
  info: '#3498db',

  // Thématique
  primary: '#5865F2',    // Discord blurple
  premium: '#FFD700',    // Or
  dark: '#2c2f33',
  light: '#99aab5',

  // Raretés
  common: '#95a5a6',
  rare: '#3498db',
  epic: '#9b59b6',
  legendary: '#f1c40f'
};
```

## Template Embed Moderne

```javascript
const embed = new EmbedBuilder()
  .setColor(COLORS.primary)
  .setTitle('📦 Titre avec Emoji')
  .setDescription(
    '**Section principale**\n' +
    'Description claire et concise.\n\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    '📊 **Statistiques**\n' +
    `> Progression: ${createProgressBar(75)}\n` +
    `> Statut: ${STATUS.success} Actif`
  )
  .addFields(
    { name: '🎯 Champ 1', value: 'Valeur', inline: true },
    { name: '⚡ Champ 2', value: 'Valeur', inline: true },
    { name: '\u200B', value: '\u200B', inline: true } // Espaceur
  )
  .setFooter({ text: '💡 Astuce: Utilise les boutons ci-dessous' })
  .setTimestamp();
```

## Références

- [components-v2.md](references/components-v2.md) - Guide Components V2 complet
- [color-palettes.md](references/color-palettes.md) - Palettes thématiques
- [wizard-patterns.md](references/wizard-patterns.md) - Patterns de wizards

## Sources

- [Discord Components V2](https://cybrancee.com/blog/the-future-of-discord-components-v2/)
- [discord.js Guide](https://discordjs.guide/)
- [Embed Generator](https://message.style/)
