/**
 * Script d'annonce - Piège "Shame Nickname" (Pseudo Honteux)
 * Envoie un embed stylisé sur les canaux spécifiés
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Branding Loomix - Assets hébergés sur VPS
const LOOMIX_LOGO = 'http://72.60.185.62:8080/portfolio/thumbnails/mysterybox/thumb.png';
const BANNER_IMAGE = 'http://72.60.185.62:8080/portfolio/banners/mysterybox/banner.png';

// Configuration des canaux cibles (mêmes que Recovery)
const TARGETS = [
  { guildId: '1182395170273099806', channelIds: ['1339571870755717120', '1451672205791334451'] },
  { guildId: '1248028543389143070', channelIds: ['1248176835490091110'] },
  { guildId: '1444016154413764640', channelIds: ['1444016157232205923', '1454878933525987505'] }
];

async function sendAnnouncement() {
  console.log('🎭 Envoi des annonces Shame Nickname...\n');

  const embed = new EmbedBuilder()
    .setColor('#E91E63')
    .setAuthor({
      name: '🎭 NOUVEAU TYPE DE PIÈGE 🎭',
      iconURL: LOOMIX_LOGO
    })
    .setTitle('😱 PSEUDO HONTEUX - LA MALÉDICTION ULTIME 😱')
    .setThumbnail(LOOMIX_LOGO)
    .setDescription(
      `Un nouveau piège maléfique vient d'arriver...\n` +
      `Et il va frapper là où ça fait mal : **ton pseudo** !\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `### 🤡 C'est quoi ce piège ?\n\n` +
      `Quand tu tombes dedans, ton pseudo est **remplacé**\n` +
      `par un surnom ridicule... et tu ne peux PAS le changer !\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `### 🔥 Les effets du piège :\n\n` +
      `🏷️ **Pseudo modifié de force !**\n` +
      `> Tu deviens "🐔 Poulet Piégé" ou pire...\n` +
      `> Tout le serveur peut voir ta honte !\n\n` +
      `🔒 **Impossible de changer !**\n` +
      `> Le bot surveille et remet le pseudo\n` +
      `> honteux à chaque tentative de fuite !\n\n` +
      `⏰ **Durée variable !**\n` +
      `> De 30 minutes à 24 heures...\n` +
      `> Selon ta malchance !\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `### 🏆 Des badges à débloquer !\n\n` +
      `🎭 **Première Honte** - Premier piège subi\n` +
      `🏃 **Fuyard Persistant** - 10 tentatives de fuite\n` +
      `⏰ **Survivant d'un Jour** - 24h cumulées piégé\n` +
      `🤡 **Roi des Clowns** - 10x le pseudo "Clown"\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `### 💀 Bonne chance pour ne pas tomber dedans !`
    )
    .setImage(BANNER_IMAGE)
    .setFooter({
      text: '🎭 Ouvre des Mystery Boxes à tes risques et périls • Powered by Loomix Bot',
      iconURL: LOOMIX_LOGO
    })
    .setTimestamp();

  let successCount = 0;
  let errorCount = 0;

  for (const target of TARGETS) {
    for (const channelId of target.channelIds) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
          await channel.send({ embeds: [embed] });
          console.log(`✅ Envoyé sur #${channel.name} (${target.guildId})`);
          successCount++;
        } else {
          console.log(`❌ Canal introuvable: ${channelId}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Erreur canal ${channelId}:`, error.message);
        errorCount++;
      }
    }
  }

  console.log(`\n📊 Résultat: ${successCount} envoyé(s), ${errorCount} erreur(s)`);

  // Déconnexion après envoi
  setTimeout(() => {
    client.destroy();
    process.exit(0);
  }, 2000);
}

client.once('ready', () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}\n`);
  sendAnnouncement();
});

client.login(process.env.DISCORD_TOKEN);
