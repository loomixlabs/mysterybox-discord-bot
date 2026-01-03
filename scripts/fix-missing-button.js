require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MESSAGE_ID = '1438655639265087528';
const CHANNEL_ID = '1264703299584786484';
const ITEM_TYPE = 'trap';
const ITEM_ID = 11;

async function fixMissingButton() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  try {
    console.log('🔧 Connexion au bot...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    console.log(`🔍 Récupération du canal ${CHANNEL_ID}...`);
    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel) {
      console.error('❌ Canal introuvable');
      process.exit(1);
    }
    console.log(`✅ Canal trouvé: ${channel.name}\n`);

    console.log(`📦 Récupération du message ${MESSAGE_ID}...`);
    const message = await channel.messages.fetch(MESSAGE_ID);

    if (!message) {
      console.error('❌ Message introuvable');
      process.exit(1);
    }
    console.log(`✅ Message trouvé\n`);

    // Recréer le bouton
    console.log('🔧 Création du nouveau bouton...');
    const button = new ButtonBuilder()
      .setCustomId(`mystery_open_${ITEM_TYPE}_${ITEM_ID}`)
      .setLabel('🎯 Ouvrir la boîte')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    // Éditer le message pour rajouter le bouton
    console.log('💾 Édition du message...');
    await message.edit({
      components: [row]
    });

    console.log('✅ Bouton ajouté avec succès !');
    console.log(`   customId: mystery_open_${ITEM_TYPE}_${ITEM_ID}`);
    console.log(`   Type: ${ITEM_TYPE} (Piège - La Sorcière Voleuse)`);
    console.log('');
    console.log('🎉 La boîte mystère est maintenant réparée !');

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

fixMissingButton();
