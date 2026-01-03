/**
 * Script pour envoyer l'annonce v1.8.0
 * Salon: 1248176835490091110
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const CHANNEL_ID = '1248176835490091110';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`Bot connecte: ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('Canal non trouve');
      process.exit(1);
    }

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('Mise a jour v1.8.0 - Quiz Intelligent')
      .setDescription('Le systeme de quiz a ete entierement repense pour offrir une meilleure experience de jeu !')
      .addFields(
        {
          name: 'Tolerance aux fautes de frappe',
          value: 'Plus besoin d\'ecrire parfaitement ! Une petite faute de frappe ne vous penalisera plus. Le systeme accepte les reponses avec jusqu\'a 80% de similarite.',
          inline: false
        },
        {
          name: 'Articles francais ignores',
          value: 'Vous pouvez repondre "un baiser" ou simplement "baiser", les deux seront acceptes. Les articles (le, la, les, un, une, des, l\', d\', du, au, aux) sont automatiquement ignores.',
          inline: false
        },
        {
          name: 'Reponses multiples flexibles',
          value: 'Pour les questions avec plusieurs reponses, utilisez une virgule, le mot "et", ou meme des espaces pour separer vos reponses.',
          inline: false
        },
        {
          name: 'Nouveau feedback',
          value: 'Si votre reponse est tres proche (60-79% de similarite), vous verrez un emoji special au lieu d\'un simple echec.',
          inline: false
        }
      )
      .setFooter({ text: 'MysteryBox Bot v1.8.0' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    console.log('Annonce envoyee avec succes !');
    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
});

client.login(process.env.BOT_TOKEN);
