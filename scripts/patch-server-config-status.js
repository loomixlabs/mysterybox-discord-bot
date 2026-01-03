// Script pour ajouter les méthodes de statut au serverConfigHandler
// Ce script ajoute le modal et le handler pour modifier le statut du bot

const fs = require('fs');
const path = require('path');

const handlerPath = path.join(__dirname, '../handlers/serverConfigHandler.js');
let content = fs.readFileSync(handlerPath, 'utf8');

// 1. Ajouter le bouton status dans showBrandingMenu
content = content.replace(
  `    const embed = new EmbedBuilder()
      .setTitle('🎨 PERSONNALISATION DU BRANDING')
      .setDescription(
        '**Configurez l\\'apparence visuelle du bot**\\n\\n' +
        'Personnalisez le nom, les couleurs et le footer affichés par le bot.'
      )
      .addFields(
        {
          name: '🏷️ Nom affiché du bot',
          value: \`\\\`\\\`\\\`\${branding.bot_display_name}\\\`\\\`\\\`\`,
          inline: false
        },
        {
          name: '🎨 Couleurs',
          value:
            \`**Principale:** \${branding.primary_color} ■\\n\` +
            \`**Secondaire:** \${branding.secondary_color} ■\`,
          inline: false
        },
        {
          name: '📝 Footer des embeds',
          value: \`\\\`\\\`\\\`\${branding.embed_footer_text}\\\`\\\`\\\`\`,
          inline: false
        }
      )`,
  `    const statusText = branding.bot_status ?
      \`\${branding.bot_status.type || 'Custom'}: \${branding.bot_status.text || 'MysteryBox'}\` :
      'Custom: MysteryBox';

    const embed = new EmbedBuilder()
      .setTitle('🎨 PERSONNALISATION DU BRANDING')
      .setDescription(
        '**Configurez l\\'apparence visuelle du bot**\\n\\n' +
        'Personnalisez le nom, les couleurs, le statut et le footer affichés par le bot.'
      )
      .addFields(
        {
          name: '🏷️ Nom affiché du bot',
          value: \`\\\`\\\`\\\`\${branding.bot_display_name}\\\`\\\`\\\`\`,
          inline: false
        },
        {
          name: '🎭 Statut du bot',
          value: \`\\\`\\\`\\\`\${statusText}\\\`\\\`\\\`\`,
          inline: false
        },
        {
          name: '🎨 Couleurs',
          value:
            \`**Principale:** \${branding.primary_color} ■\\n\` +
            \`**Secondaire:** \${branding.secondary_color} ■\`,
          inline: false
        },
        {
          name: '📝 Footer des embeds',
          value: \`\\\`\\\`\\\`\${branding.embed_footer_text}\\\`\\\`\\\`\`,
          inline: false
        }
      )`
);

// 2. Ajouter le bouton status
content = content.replace(
  `    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_bot_display_name')
        .setLabel('Modifier le nom')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('edit_primary_color')
        .setLabel('Couleur principale')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('edit_secondary_color')
        .setLabel('Couleur secondaire')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_footer_text')
        .setLabel('Modifier le footer')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('server_config_back')
        .setLabel('Retour')
        .setEmoji('🔙')
        .setStyle(ButtonStyle.Secondary)
    );`,
  `    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_bot_display_name')
        .setLabel('Modifier le nom')
        .setEmoji('🏷️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('edit_bot_status')
        .setLabel('Modifier le statut')
        .setEmoji('🎭')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('edit_primary_color')
        .setLabel('Couleur principale')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('edit_secondary_color')
        .setLabel('Couleur secondaire')
        .setEmoji('🎨')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('edit_footer_text')
        .setLabel('Modifier le footer')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('server_config_back')
        .setLabel('Retour')
        .setEmoji('🔙')
        .setStyle(ButtonStyle.Secondary)
    );`
);

// 3. Ajouter le routing du bouton
content = content.replace(
  `      else if (customId === 'edit_bot_display_name') {
        await this.showEditBotNameModal(interaction);
      }
      else if (customId === 'edit_primary_color') {`,
  `      else if (customId === 'edit_bot_display_name') {
        await this.showEditBotNameModal(interaction);
      }
      else if (customId === 'edit_bot_status') {
        await this.showEditBotStatusModal(interaction);
      }
      else if (customId === 'edit_primary_color') {`
);

// 4. Ajouter le modal et le handler avant showEditBotNameModal
const modalAndHandler = `
  async showEditBotStatusModal(interaction) {
    const branding = await db.getGuildBranding(interaction.guildId);
    const currentStatus = branding.bot_status || { type: 'Custom', text: 'MysteryBox' };

    const modal = new ModalBuilder()
      .setCustomId('modal_edit_bot_status')
      .setTitle('🎭 Modifier le statut du bot');

    const typeInput = new TextInputBuilder()
      .setCustomId('status_type_input')
      .setLabel('Type (Playing/Watching/Listening/Custom)')
      .setStyle(TextInputStyle.Short)
      .setValue(currentStatus.type || 'Custom')
      .setPlaceholder('Custom')
      .setRequired(true)
      .setMaxLength(20);

    const textInput = new TextInputBuilder()
      .setCustomId('status_text_input')
      .setLabel('Texte du statut')
      .setStyle(TextInputStyle.Short)
      .setValue(currentStatus.text || 'MysteryBox')
      .setPlaceholder('MysteryBox')
      .setRequired(true)
      .setMaxLength(128);

    modal.addComponents(
      new ActionRowBuilder().addComponents(typeInput),
      new ActionRowBuilder().addComponents(textInput)
    );

    await interaction.showModal(modal);
  }
`;

content = content.replace(
  '  async showEditBotNameModal(interaction) {',
  modalAndHandler + '  async showEditBotNameModal(interaction) {'
);

// 5. Ajouter le handler de modal submit
content = content.replace(
  `      if (customId === 'modal_edit_bot_name') {`,
  `      if (customId === 'modal_edit_bot_status') {
        const newType = interaction.fields.getTextInputValue('status_type_input');
        const newText = interaction.fields.getTextInputValue('status_text_input');

        // Valider le type
        const validTypes = ['Playing', 'Watching', 'Listening', 'Competing', 'Custom'];
        const finalType = validTypes.includes(newType) ? newType : 'Custom';

        await db.updateGuildBranding(interaction.guildId, {
          bot_status: { type: finalType, text: newText }
        });

        // Mettre à jour le statut du bot
        await this.updateBotPresence(interaction.client, finalType, newText);

        await interaction.editReply({
          content: \`✅ Statut du bot mis à jour: **\${finalType}: \${newText}**\`
        });
      }
      else if (customId === 'modal_edit_bot_name') {`
);

// 6. Ajouter la méthode updateBotPresence avant updateBotNickname
const presenceMethod = `
  /**
   * Mettre à jour le statut/présence du bot
   */
  async updateBotPresence(client, type, text) {
    try {
      const activityType = {
        'Playing': 0,
        'Streaming': 1,
        'Listening': 2,
        'Watching': 3,
        'Custom': 4,
        'Competing': 5
      }[type] || 4;

      await client.user.setPresence({
        activities: [{
          name: text,
          type: activityType
        }],
        status: 'online'
      });

      console.log(\`✅ Statut du bot mis à jour: \${type} - \${text}\`);
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du statut:', error.message);
    }
  }
`;

content = content.replace(
  '  /**\n   * Mettre à jour le nickname du bot sur le serveur\n   */',
  presenceMethod + '  /**\n   * Mettre à jour le nickname du bot sur le serveur\n   */'
);

fs.writeFileSync(handlerPath, content);
console.log('✅ serverConfigHandler.js patché avec succès!');
