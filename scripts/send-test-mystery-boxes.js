const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database-pg');
require('dotenv').config();

const GUILD_ID = '297309737135898624'; // Serveur de TEST
const CHANNEL_ID = '1433571359539200001'; // Canal cible
const NUMBER_OF_BOXES = 20;

async function sendTestMysteryBoxes() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  let originalConfig = null;

  try {
    console.log('🤖 Connexion au bot Discord...\n');
    await client.login(process.env.DISCORD_TOKEN);

    console.log('✅ Bot connecté !\n');

    // Attendre que le bot soit prêt
    await new Promise(resolve => {
      client.once('ready', resolve);
    });

    console.log(`✅ Bot prêt: ${client.user.tag}\n`);

    // Récupérer le canal
    const channel = await client.channels.fetch(CHANNEL_ID);
    console.log(`✅ Canal trouvé: ${channel.name}\n`);

    // Récupérer le branding
    const branding = await db.getGuildBranding(GUILD_ID);

    console.log('='.repeat(80));
    console.log(`\n📦 Envoi de ${NUMBER_OF_BOXES} Mystery Boxes (COLLECTIBLES ONLY)\n`);
    console.log('='.repeat(80));

    for (let i = 1; i <= NUMBER_OF_BOXES; i++) {
      console.log(`\n[${i}/${NUMBER_OF_BOXES}] Création de la mystery box...`);

      // Créer l'embed de mystery box
      const embed = new EmbedBuilder()
        .setTitle('🎁 MYSTERY BOX')
        .setDescription(
          '**Une boîte mystère apparaît !**\n\n' +
          'Clique sur le bouton ci-dessous pour découvrir ce qu\'elle contient.\n\n' +
          '⚠️ **Attention**: Cette boîte contient **uniquement un collectible** (pas de mission ni de piège).'
        )
        .setColor('#FFD700')
        .setImage('https://media.giphy.com/media/l0HlR3kHtkgFbYfgQ/giphy.gif')
        .setFooter({
          text: branding.footer_text || 'Loomix - Bot de Giveaway',
          iconURL: branding.logo_url
        })
        .setTimestamp();

      // Créer le bouton
      const button = new ButtonBuilder()
        .setCustomId('open_mystery_box')
        .setLabel('🎁 Ouvrir la Mystery Box')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      // Envoyer le message
      await channel.send({
        embeds: [embed],
        components: [row]
      });

      console.log(`   ✅ Mystery Box ${i} envoyée !`);

      // Attendre 500ms entre chaque envoi pour éviter le rate limit
      if (i < NUMBER_OF_BOXES) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ ${NUMBER_OF_BOXES} Mystery Boxes envoyées avec succès !\n`);
    console.log(`📍 Canal: ${channel.name} (${CHANNEL_ID})`);
    console.log(`🎯 Type: COLLECTIBLES ONLY\n`);
    console.log('='.repeat(80));

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    await client.destroy();
    process.exit(1);
  }
}

sendTestMysteryBoxes();
