/**
 * Script pour poster l'annonce des badges Engagement
 */

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const CHANNEL_ID = '1451672205791334451';

async function postAnnouncement() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté');

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Canal non trouvé');
      process.exit(1);
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 Badges Engagement - Récompenses attribuées !')
      .setDescription('Félicitations à tous les joueurs fidèles ! Vos efforts ont été récompensés avec les **badges Engagement** basés sur votre streak de récompenses quotidiennes !')
      .setColor(0xFFD700)
      .addFields(
        {
          name: '🏆 Badge "Assidu" (7 jours consécutifs)',
          value: '📅⭐ **queen_ali** • **gueretbea** • **steve0010** (11 jours !)\n📅⭐ **purplehaze11** • **mallo.25** • **misterbrasegali** (8 jours)\n📅⭐ **dedel76280** • **joker1.32** • **fabienne0249** (7 jours)',
          inline: false
        },
        {
          name: '✨ Badge "Actif" (3 jours consécutifs)',
          value: '📅✨ **kiragerma** • **phoenixbienveillant** (6 jours)\n📅✨ **virginie0022** • **christelle0048** • **floerin** • **b3lla_16** • **skeeter_92** • **sophiedg0739** (5 jours)\n📅✨ **valerie2603** • **kylakelya** • **eclipseenchanteresse** • **olympe34370** (4 jours)\n📅✨ **arka86** • **camicailgo** • **benji86270** • **xmicordix** (3 jours)',
          inline: false
        },
        {
          name: '🥇 Top 3 Streaks',
          value: '**queen_ali**, **gueretbea**, **steve0010** — 11 jours consécutifs !',
          inline: false
        },
        {
          name: '🎯 Prochains badges à débloquer',
          value: '📅🏅 **Dévoué** — 14 jours consécutifs\n📅👑 **Marathonien** — 30 jours consécutifs\n📅🌟 **Éternel** — 90 jours consécutifs',
          inline: false
        }
      )
      .setFooter({ text: 'Continuez à réclamer vos récompenses quotidiennes pour augmenter votre streak !' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log('✅ Annonce envoyée !');

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

postAnnouncement();
