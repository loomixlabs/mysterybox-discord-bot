# Wizard Patterns - Guide Complet

## Préférence Utilisateur Absolue

```
❌ MODALS = INTERDIT
✅ WIZARDS ÉTAPE PAR ÉTAPE = OBLIGATOIRE
```

## Structure d'un Wizard

### Pattern Multi-Étapes

```javascript
class DurationWizard {
  // État du wizard stocké dans customId
  // Format: wizard_duration_step{N}_{data}

  async step1_chooseAction(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('⏱️ Modifier la Durée')
      .setDescription(
        '**Étape 1/3** - Choisir l\'action\n\n' +
        '📊 Durée actuelle: **45 jours restants**\n' +
        '━━━━━━━━━━━━━━━━━━━━\n\n' +
        'Que souhaitez-vous faire ?'
      )
      .setColor('#3498db')
      .setFooter({ text: '💡 Sélectionnez une option' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard_duration_step2_add')
        .setLabel('➕ Prolonger')
        .setEmoji('📅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('wizard_duration_step2_reduce')
        .setLabel('➖ Réduire')
        .setEmoji('⏰')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('wizard_duration_step2_set')
        .setLabel('🎯 Définir')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Secondary)
    );

    const cancelRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard_duration_cancel')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.update({
      embeds: [embed],
      components: [row, cancelRow]
    });
  }

  async step2_chooseAmount(interaction, action) {
    const isAdd = action === 'add';
    const isReduce = action === 'reduce';

    const embed = new EmbedBuilder()
      .setTitle(isAdd ? '➕ Prolonger la Durée' : '➖ Réduire la Durée')
      .setDescription(
        '**Étape 2/3** - Choisir la durée\n\n' +
        '📊 Durée actuelle: **45 jours restants**\n' +
        '━━━━━━━━━━━━━━━━━━━━\n\n' +
        `${isAdd ? 'Prolonger' : 'Réduire'} de combien de jours ?`
      )
      .setColor(isAdd ? '#2ecc71' : '#3498db');

    // Boutons prédéfinis
    const amounts = isAdd ? [7, 14, 30, 60] : [7, 14, 30];
    const prefix = isAdd ? '+' : '-';

    const row1 = new ActionRowBuilder().addComponents(
      ...amounts.slice(0, 4).map(days =>
        new ButtonBuilder()
          .setCustomId(`wizard_duration_step3_${action}_${days}`)
          .setLabel(`${prefix}${days} jours`)
          .setStyle(isAdd ? ButtonStyle.Success : ButtonStyle.Primary)
      )
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard_duration_step1')
        .setLabel('◀️ Retour')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard_duration_cancel')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.update({
      embeds: [embed],
      components: [row1, row2]
    });
  }

  async step3_confirm(interaction, action, days) {
    const isAdd = action === 'add';
    const newDuration = isAdd ? 45 + days : 45 - days;

    const embed = new EmbedBuilder()
      .setTitle('✅ Confirmer la Modification')
      .setDescription(
        '**Étape 3/3** - Confirmation\n\n' +
        '━━━━━━━━━━━━━━━━━━━━\n\n' +
        `📊 Durée actuelle: **45 jours**\n` +
        `${isAdd ? '➕' : '➖'} Modification: **${isAdd ? '+' : '-'}${days} jours**\n` +
        `📅 Nouvelle durée: **${newDuration} jours**\n\n` +
        '━━━━━━━━━━━━━━━━━━━━'
      )
      .setColor('#f39c12');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wizard_duration_apply_${action}_${days}`)
        .setLabel('✅ Appliquer')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('wizard_duration_step1')
        .setLabel('◀️ Retour au début')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard_duration_cancel')
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.update({
      embeds: [embed],
      components: [row]
    });
  }
}
```

## Avantages des Wizards vs Modals

| Aspect | Modal | Wizard |
|--------|-------|--------|
| Visibilité | Popup bloquante | Dans le chat |
| Historique | Perdu | Visible |
| Guidage | Minimal | Étape par étape |
| Erreurs | Après submit | Préventif (boutons) |
| UX | Interruptif | Fluide |
| Mobile | Problématique | Optimal |

## Anti-Patterns à Éviter

```javascript
// ❌ INTERDIT - Modal pour choix multiples
async showOptionsModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('options_modal')
    .setTitle('Choisir les options');
  // NE JAMAIS FAIRE ÇA
}

// ✅ CORRECT - Wizard avec select menu
async showOptionsWizard(interaction) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('wizard_options_select')
    .setPlaceholder('Sélectionnez vos options')
    .setMinValues(1)
    .setMaxValues(3)
    .addOptions([...]);

  const row = new ActionRowBuilder().addComponents(select);
  return interaction.update({ components: [row] });
}
```

## Gestion d'État

```javascript
// État encodé dans customId
// Format: {handler}_{wizard}_{step}_{data1}_{data2}...

function parseWizardState(customId) {
  const parts = customId.split('_');
  return {
    handler: parts[0],      // 'wizard'
    wizard: parts[1],       // 'duration'
    step: parts[2],         // 'step1', 'step2', etc.
    data: parts.slice(3)    // Données additionnelles
  };
}
```
