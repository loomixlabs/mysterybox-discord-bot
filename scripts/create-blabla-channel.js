/**
 * Script pour créer le canal "bla-bla MysteryBox" sur le nouveau serveur
 */

require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const GUILD_ID = '1182395170273099806';
const CATEGORY_ID = '1182441697683193937';
const CHANNEL_NAME = 'bla-bla-mysterybox';

async function createChannel() {
  try {
    console.log('🔧 Création du canal bla-bla MysteryBox...\n');

    // Attendre que le bot soit prêt
    await new Promise(resolve => client.once('ready', resolve));
    console.log(`✅ Bot connecté: ${client.user.tag}`);

    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) {
      console.error('❌ Serveur non trouvé');
      process.exit(1);
    }
    console.log(`📍 Serveur: ${guild.name}`);

    // Vérifier la catégorie
    const category = await guild.channels.fetch(CATEGORY_ID);
    if (!category) {
      console.error('❌ Catégorie non trouvée');
      process.exit(1);
    }
    console.log(`📁 Catégorie: ${category.name}`);

    // Lister les canaux existants dans la catégorie pour voir la position
    const channelsInCategory = guild.channels.cache
      .filter(c => c.parentId === CATEGORY_ID)
      .sort((a, b) => a.position - b.position);

    console.log('\n📋 Canaux existants dans la catégorie:');
    channelsInCategory.forEach((c, i) => {
      console.log(`   ${i + 1}. #${c.name} (position: ${c.position})`);
    });

    // Trouver le canal "recap-mysterybox" pour positionner après
    const recapChannel = channelsInCategory.find(c => c.name.includes('recap'));
    let position = recapChannel ? recapChannel.position + 1 : channelsInCategory.size;

    // Créer le canal
    const newChannel = await guild.channels.create({
      name: CHANNEL_NAME,
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      position: position,
      topic: '💬 Discussion autour du jeu MysteryBox - Posez vos questions, partagez vos stratégies !',
      reason: 'Canal de discussion pour le jeu MysteryBox'
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ CANAL CRÉÉ AVEC SUCCÈS !');
    console.log('='.repeat(60));
    console.log(`📍 Nom: #${newChannel.name}`);
    console.log(`🆔 ID: ${newChannel.id}`);
    console.log(`📁 Catégorie: ${category.name}`);
    console.log(`📝 Topic: ${newChannel.topic}`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

client.login(process.env.DISCORD_TOKEN);
createChannel();
