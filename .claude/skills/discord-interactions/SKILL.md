---
name: discord-interactions
description: |
  Expert Discord.js v14 interactions (buttons, selects, modals).
  ACTIVE AUTOMATIQUEMENT quand:
  - Création de boutons, select menus, modals
  - Gestion de réponses aux interactions
  - Problèmes de timeout (10062)
  - Questions sur deferUpdate, editReply, etc.

  Maîtrise: defer patterns, routing, components, embeds.
  Évite les erreurs 10062, 10008, 50001.
---

# Discord Interactions Expert

## Types d'Interactions

| Type | Méthode | Defer | Réponse |
|------|---------|-------|---------|
| Button | `isButton()` | `deferUpdate()` | `editReply()` |
| Select Menu | `isStringSelectMenu()` | `deferUpdate()` | `editReply()` |
| Modal Submit | `isModalSubmit()` | `deferReply()` | `editReply()` |
| Slash Command | `isChatInputCommand()` | `deferReply()` | `editReply()` |

## Pattern Universel

```javascript
async function handleInteraction(interaction) {
  // 1. EXTRAIRE guild_id IMMÉDIATEMENT
  const guildId = interaction.guildId;

  // 2. DEFER selon le type
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    await interaction.deferUpdate();
  } else if (interaction.isModalSubmit()) {
    await interaction.deferReply({ flags: 64 }); // Ephemeral
  }

  // 3. LOGIQUE MÉTIER (peut prendre du temps)
  const data = await fetchData();

  // 4. RÉPONDRE avec editReply
  await interaction.editReply({
    content: 'Résultat',
    embeds: [embed],
    components: [row]
  });
}
```

## Defer: Quand et Comment

### deferUpdate() - Pour Button/Select

```javascript
// Garde le message original, juste met "thinking"
await interaction.deferUpdate();

// Puis modifier avec editReply
await interaction.editReply({ content: 'Nouveau contenu' });
```

### deferReply() - Pour Modal/Command

```javascript
// Crée une nouvelle réponse "thinking"
await interaction.deferReply({ flags: 64 }); // 64 = Ephemeral

// Puis répondre avec editReply
await interaction.editReply({ content: 'Réponse' });
```

### showModal() - SANS defer

```javascript
// ⚠️ Modal = réponse immédiate, PAS de defer avant
if (action === 'open_form') {
  const modal = new ModalBuilder()
    .setCustomId('form_submit')
    .setTitle('Formulaire');

  // Ajouter inputs...

  return interaction.showModal(modal); // Return direct, pas de defer
}

// Defer pour les autres actions
await interaction.deferUpdate();
```

## Composants Discord.js

### ButtonBuilder

```javascript
const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const button = new ButtonBuilder()
  .setCustomId('action_id')      // ID unique
  .setLabel('Cliquer')           // Texte
  .setStyle(ButtonStyle.Primary) // Primary, Secondary, Success, Danger, Link
  .setEmoji('✅')                // Optionnel
  .setDisabled(false);           // Optionnel

const row = new ActionRowBuilder().addComponents(button);
```

### Styles de Boutons

| Style | Couleur | Usage |
|-------|---------|-------|
| `Primary` | Bleu | Action principale |
| `Secondary` | Gris | Action secondaire |
| `Success` | Vert | Confirmation |
| `Danger` | Rouge | Suppression/Annulation |
| `Link` | Gris + lien | URL externe |

### StringSelectMenuBuilder

```javascript
const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

const select = new StringSelectMenuBuilder()
  .setCustomId('select_id')
  .setPlaceholder('Choisir une option')
  .setMinValues(1)
  .setMaxValues(1)
  .addOptions([
    {
      label: 'Option 1',
      description: 'Description option 1',
      value: 'value_1',
      emoji: '1️⃣'
    },
    {
      label: 'Option 2',
      value: 'value_2',
      default: true  // Pré-sélectionné
    }
  ]);

const row = new ActionRowBuilder().addComponents(select);

// Récupérer la valeur sélectionnée
const selected = interaction.values[0]; // ou values pour multi-select
```

### ModalBuilder

```javascript
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const modal = new ModalBuilder()
  .setCustomId('modal_id')
  .setTitle('Titre du Modal');

const input1 = new TextInputBuilder()
  .setCustomId('input_1')
  .setLabel('Champ 1')
  .setStyle(TextInputStyle.Short)    // Short ou Paragraph
  .setPlaceholder('Placeholder...')
  .setRequired(true)
  .setMinLength(1)
  .setMaxLength(100);

const input2 = new TextInputBuilder()
  .setCustomId('input_2')
  .setLabel('Champ 2')
  .setStyle(TextInputStyle.Paragraph)
  .setRequired(false);

modal.addComponents(
  new ActionRowBuilder().addComponents(input1),
  new ActionRowBuilder().addComponents(input2)
);

// Afficher le modal
await interaction.showModal(modal);

// Récupérer les valeurs (dans handleModalSubmit)
const value1 = interaction.fields.getTextInputValue('input_1');
const value2 = interaction.fields.getTextInputValue('input_2');
```

### EmbedBuilder

```javascript
const { EmbedBuilder } = require('discord.js');

const embed = new EmbedBuilder()
  .setColor('#5865F2')           // Couleur barre gauche
  .setTitle('📦 Titre')
  .setURL('https://example.com') // Titre cliquable
  .setDescription('Description du embed')
  .setThumbnail('https://url/thumb.png')
  .setImage('https://url/image.png')
  .addFields(
    { name: 'Champ 1', value: 'Valeur 1', inline: true },
    { name: 'Champ 2', value: 'Valeur 2', inline: true },
    { name: '\u200B', value: '\u200B' }, // Ligne vide
    { name: 'Champ 3', value: 'Valeur 3' }
  )
  .setFooter({
    text: 'Footer text',
    iconURL: 'https://url/icon.png'
  })
  .setTimestamp();
```

## Erreurs Courantes

### 10062 - Unknown Interaction

```javascript
// Cause: Plus de 3 secondes sans réponse
// Solution: defer IMMÉDIATEMENT

async handle(interaction) {
  await interaction.deferUpdate(); // LIGNE 1
  // ... reste du code
}
```

### 10008 - Unknown Message

```javascript
// Cause: Message supprimé/expiré
// Solution: Try-catch

try {
  await message.edit({ ... });
} catch (e) {
  if (e.code === 10008) return; // Ignorer
  throw e;
}
```

### Already Replied/Acknowledged

```javascript
// Cause: Double defer ou reply après defer
// Solution: Vérifier état

if (!interaction.deferred && !interaction.replied) {
  await interaction.deferUpdate();
}

// Utiliser editReply après defer
await interaction.editReply({ content: 'OK' });
```

## Flags Utiles

```javascript
// Ephemeral (visible uniquement par l'utilisateur)
await interaction.reply({ content: 'Privé', flags: 64 });
await interaction.deferReply({ flags: 64 });

// Supprimer le message original (button/select)
await interaction.update({ content: 'Supprimé', components: [] });
```

## Références

- [components-guide.md](references/components-guide.md) - Guide composants
- [Discord.js Guide](https://discordjs.guide/)
