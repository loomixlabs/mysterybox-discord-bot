/**
 * Annonce mystérieuse pour le MysteryBox Joker
 * Créer la hype avant distribution de 10 jokers légendaires
 */

const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

  try {
    const guildId = '1248028543389143070';
    const channelId = '1248176835490091110';

    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error('❌ Canal introuvable');
      process.exit(1);
    }

    // Créer l'embed mystérieux
    const embed = new EmbedBuilder()
      .setTitle('```\n✦═══════════════════════════════════════════✦\n         🃏 QUELQUE CHOSE ARRIVE... 🃏         \n✦═══════════════════════════════════════════✦\n```')
      .setDescription(
        `## ⚡ Une force mystérieuse se prépare...\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> *Les étoiles s'alignent...*\n` +
        `> *Le destin murmure...*\n` +
        `> *Un pouvoir **LÉGENDAIRE** est sur le point de se manifester...*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `🌟 **Rumeurs dans les couloirs sombres:**\n\n` +
        `> *"On raconte qu'un artefact ancien permet de...*\n` +
        `> *...choisir son propre destin..."*\n\n` +
        `> *"Les plus chanceux pourront obtenir...*\n` +
        `> *...N'IMPORTE QUEL collectible de leur choix..."*\n\n` +
        `> *"Mais seuls **10 élus** seront touchés par cette grâce..."*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `## 🔮 PRÉPAREZ-VOUS...\n\n` +
        `\`\`\`diff\n` +
        `+ 10 SUPER BONUS ULTRA-LÉGENDAIRES\n` +
        `+ POUVOIR JAMAIS VU AUPARAVANT\n` +
        `+ DISTRIBUTION IMMINENTE...\n` +
        `\`\`\`\n\n` +
        `⏳ **Les MysteryBox détiennent le secret...**\n` +
        `⏳ **Soyez prêts à ouvrir votre destin...**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .setColor('#1a1a2e')
      .setImage('https://media.tenor.com/images/b6a670e8433ae5f1bbb45c771e37e87d/tenor.gif') // Mystery box spinning
      .setFooter({ text: '🃏 ??? • Quelque chose d\'extraordinaire approche...' })
      .setTimestamp();

    // Envoyer l'annonce
    await channel.send({
      content: '||@everyone||',
      embeds: [embed]
    });

    console.log('✅ Annonce mystérieuse envoyée !');
    console.log('🃏 Prêt pour la distribution des 10 MysteryBox Jokers !');

    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
