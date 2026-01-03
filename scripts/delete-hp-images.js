/**
 * Script pour supprimer les images du mini-jeu Harry Potter
 */
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const HP_GUILD_ID = '1182395170273099806';

// Tous les canaux où des images ont été envoyées
const CHANNELS_WITH_IMAGES = [
  '1182395170273099809', // général-discussion
  '1195847910416470216', // jeu-discussion
  '1196132861904953435', // actu-monopoly-go
  '1204520488227962911', // live
  '1209781283807559741', // commandes-bots
  '1234113729059225691', // invitations
  '1253742188974571603', // blabla-animateur
  '1339571780796289064', // étoile-mystérieuse
  '1365773475800678411', // giveaway
  '1418876276634292254', // résultat-loto
  '1434461695946002533', // les-100
  '1189546578139152434', // arnaqueur
  '1189233124064895096'  // dons (vraie image)
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🗑️ SUPPRESSION DES IMAGES HP');
  console.log('='.repeat(60));

  try {
    const guild = await client.guilds.fetch(HP_GUILD_ID);
    console.log(`\n✅ Connecté au serveur: ${guild.name}`);

    for (const channelId of CHANNELS_WITH_IMAGES) {
      try {
        const channel = await guild.channels.fetch(channelId);
        if (!channel) {
          console.log(`   ⚠️ Canal ${channelId} introuvable`);
          continue;
        }

        // Récupérer les 10 derniers messages
        const messages = await channel.messages.fetch({ limit: 10 });

        // Filtrer les messages du bot contenant des liens Google
        const botMessages = messages.filter(m =>
          m.author.id === client.user.id &&
          m.content.includes('googleusercontent.com')
        );

        if (botMessages.size > 0) {
          for (const [msgId, msg] of botMessages) {
            await msg.delete();
            console.log(`   ✅ Message supprimé dans #${channel.name}`);
          }
        } else {
          console.log(`   ℹ️ Aucune image à supprimer dans #${channel.name}`);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.log(`   ❌ Erreur canal ${channelId}: ${err.message}`);
      }
    }

    console.log('\n✅ Suppression terminée !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
