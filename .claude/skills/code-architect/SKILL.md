---
name: code-architect
description: |
  Expert architecture et patterns du bot Discord multi-serveur.
  ACTIVE AUTOMATIQUEMENT quand:
  - Création d'un nouveau handler
  - Ajout de fonctionnalité majeure
  - Refactoring de code existant
  - Questions sur l'architecture

  Connaît: 25+ handlers, patterns de routing, flows de données.
  Garantit cohérence architecturale et bonnes pratiques.
---

# Code Architect

## Architecture Globale

```
User Interaction (Button/Select/Modal/Command)
        ↓
events/interactionCreate.js (ROUTEUR PRINCIPAL)
        ↓
    ┌───┴───────────────┬─────────────────┐
    ↓                   ↓                 ↓
handlers/           handlers/          handlers/
adminPanel...       missionHandler     mysteryBox...
    ↓                   ↓                 ↓
utils/database-pg.js (WRAPPER DB - guild_id auto)
        ↓
   PostgreSQL
```

## Handlers par Catégorie (25+)

### Core (Give/Mystery Box)
- `mysteryBoxHandler.js` (143KB) - Système principal boxes
- `giveHandler.js` - Gives normaux (legacy)
- `giveUniqueHandler.js` (45KB) - Wizard 4 étapes

### Missions
- `missionHandler.js` (354KB) - 13 types de missions
- Quiz, Wordle, Hangman, TicTacToe intégrés

### Admin
- `adminPanelHandler.js` (399KB) - Routeur admin
- `campaignAdminHandler.js` - Config campagnes
- `framesConfigHandler.js` (126KB) - Config frames

### Joueurs
- `profileHandler.js` (64KB) - Profil complet
- `badgeHandler.js` (79KB) - 50+ badges
- `dailyClaimHandler.js` (63KB) - Rewards quotidiens

## Pattern: Nouveau Handler

### Structure Standard

```javascript
/**
 * [Nom] Handler
 * Responsabilité: [Description]
 */

const db = require('../utils/database-pg');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');

// ========== EXPORTS ==========

module.exports = {
  handleInteraction,
  handleButton,
  handleSelectMenu,
  handleModalSubmit,
  // Fonctions utilitaires exportées si nécessaire
};

// ========== MAIN HANDLER ==========

async function handleInteraction(interaction) {
  const guildId = interaction.guildId;
  const customId = interaction.customId;

  if (interaction.isButton()) {
    return handleButton(interaction, guildId, customId);
  }
  if (interaction.isStringSelectMenu()) {
    return handleSelectMenu(interaction, guildId, customId);
  }
  if (interaction.isModalSubmit()) {
    return handleModalSubmit(interaction, guildId, customId);
  }
}

// ========== BUTTON HANDLERS ==========

async function handleButton(interaction, guildId, customId) {
  await interaction.deferUpdate();

  if (customId.startsWith('prefix_action1')) {
    return handleAction1(interaction, guildId);
  }
  if (customId.startsWith('prefix_action2')) {
    return handleAction2(interaction, guildId);
  }
}

// ========== SELECT HANDLERS ==========

async function handleSelectMenu(interaction, guildId, customId) {
  await interaction.deferUpdate();
  const selected = interaction.values[0];
  // ...
}

// ========== MODAL HANDLERS ==========

async function handleModalSubmit(interaction, guildId, customId) {
  await interaction.deferReply({ flags: 64 });
  const input = interaction.fields.getTextInputValue('input_id');
  // ...
}

// ========== PRIVATE FUNCTIONS ==========

async function handleAction1(interaction, guildId) {
  // Logique métier
}
```

## Pattern: Routing dans interactionCreate

```javascript
// events/interactionCreate.js

// 1. Importer le handler
const myHandler = require('../handlers/myHandler');

// 2. Router dans execute()
if (interaction.isButton()) {
  const customId = interaction.customId;

  // Router vers le handler approprié
  if (customId.startsWith('my_prefix_')) {
    return myHandler.handleInteraction(interaction);
  }
}

// 3. AUSSI pour les select menus
if (interaction.isStringSelectMenu()) {
  const customId = interaction.customId;

  if (customId.startsWith('my_prefix_')) {
    return myHandler.handleInteraction(interaction);
  }
}

// 4. ET pour les modals
if (interaction.isModalSubmit()) {
  const customId = interaction.customId;

  if (customId.startsWith('my_prefix_')) {
    return myHandler.handleInteraction(interaction);
  }
}
```

## Convention CustomIds

```javascript
// Format: prefix_action_id
'give_collectible_123'
'mission_approve_456'
'admin_panel_themes'

// Format Wizard: prefix_step:param1:param2
'give_unique_launch:legendary:item123:random:now'

// Format avec guild (si nécessaire)
'badge_unlock_78_guild_123456789'
```

## Pattern: Wizard Multi-Étapes

```javascript
// État dans le customId
'wizard_step1'           // Étape 1
'wizard_step2:value1'    // Étape 2 avec valeur
'wizard_step3:v1:v2'     // Étape 3 avec 2 valeurs
'wizard_final:v1:v2:v3'  // Final

// Parsing
const [action, ...params] = customId.split(':');
const [param1, param2, param3] = params;
```

## Pattern: Embed Builder

```javascript
const embed = new EmbedBuilder()
  .setColor(theme.embed_color || '#5865F2')
  .setTitle('📦 Titre')
  .setDescription('Description')
  .addFields(
    { name: 'Champ 1', value: 'Valeur 1', inline: true },
    { name: 'Champ 2', value: 'Valeur 2', inline: true }
  )
  .setFooter({ text: `Serveur: ${interaction.guild.name}` })
  .setTimestamp();
```

## Pattern: Action Row

```javascript
const row = new ActionRowBuilder()
  .addComponents(
    new ButtonBuilder()
      .setCustomId('action_primary')
      .setLabel('Action')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId('action_cancel')
      .setLabel('Annuler')
      .setStyle(ButtonStyle.Secondary)
  );
```

## Références

- [handler-templates.md](references/handler-templates.md) - Templates complets
- [routing-patterns.md](references/routing-patterns.md) - Patterns de routing
