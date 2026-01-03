/**
 * Script pour envoyer l'annonce des nouvelles missions de Noël
 * Salon: 1248176835490091110
 * Serveur: 1248028543389143070
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const CHANNEL_ID = '1248176835490091110';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel) {
      console.error('❌ Canal non trouvé !');
      process.exit(1);
    }

    const embed = new EmbedBuilder()
      .setColor('#C41E3A') // Rouge Noël
      .setTitle('🎄 Nouvelles Missions de Noël ! 🎅')
      .setDescription(
        `Ho ho ho ! Le Père Noël a déposé **2 nouvelles missions** sous le sapin !\n\n` +
        `Testez vos connaissances sur les traditions de Noël et gagnez des collectibles !`
      )
      .addFields(
        {
          name: '🧩 Énigmes de Noël',
          value:
            `**25 puzzles emoji** à résoudre !\n` +
            `Devinez les mots de Noël cachés derrière les emojis.\n` +
            `• 🟢 8 puzzles faciles\n` +
            `• 🟡 9 puzzles moyens\n` +
            `• 🔴 8 puzzles difficiles\n` +
            `⏱️ 30 secondes | 3 essais`,
          inline: false
        },
        {
          name: '✅❌ Vrai ou Faux de Noël',
          value:
            `**30 questions** sur les secrets de Noël !\n` +
            `Connaissez-vous vraiment toutes les traditions ?\n` +
            `• 🟢 10 questions faciles\n` +
            `• 🟡 12 questions moyennes\n` +
            `• 🔴 8 questions difficiles\n` +
            `⏱️ 20 secondes | 3 essais`,
          inline: false
        },
        {
          name: '🎁 Récompenses',
          value:
            `Chaque bonne réponse = **1 collectible aléatoire** !\n` +
            `Complétez votre collection avant la fin du calendrier !`,
          inline: false
        }
      )
      .setFooter({ text: '🎄 Joyeuses Fêtes ! 🎄' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    console.log('✅ Annonce envoyée avec succès !');
    console.log(`📍 Canal: ${channel.name}`);

    // Attendre un peu avant de fermer
    setTimeout(() => {
      client.destroy();
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    client.destroy();
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
