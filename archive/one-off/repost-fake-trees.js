const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// Canaux avec fausses images d'arbres
const FAKE_CHANNELS = [
  '1428048598997926068',
  '1428022920743092284',
  '1433823258234327121',
  '1390053378163478568',
  '1428022584389271743',
  '1264704154589462679',
  '1428025058894282752',
  '1248656294773129267',
  '1264703299584786484',
  '1367554000437776456',
  '1276241035244077107',
  '1248184319608881194',
  '1250553844937789461',
  '1422598570439213096'
];

// Images d'arbres gratuites (Unsplash - libres de droits)
const FAKE_TREE_IMAGES = [
  'https://images.unsplash.com/photo-1511497584788-876760111969?w=800',
  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800',
  'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800',
  'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800',
  'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=800',
  'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=800',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800',
  'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=800',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800',
  'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=800',
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800',
  'https://images.unsplash.com/photo-1511497584788-876760111969?w=800',
  'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800'
];

async function repostFakeTrees() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  client.once('ready', async () => {
    try {
      console.log(`🤖 Bot connecté: ${client.user.tag}\n`);
      console.log('🌲 Repostage des arbres leurres...\n');

      for (let i = 0; i < FAKE_CHANNELS.length; i++) {
        const channelId = FAKE_CHANNELS[i];
        const imageUrl = FAKE_TREE_IMAGES[i];

        try {
          const channel = await client.channels.fetch(channelId);
          if (channel) {
            await channel.send({ content: imageUrl });
            console.log(`✅ Arbre leurre posté dans: ${channel.name}`);
          }
        } catch (error) {
          console.error(`❌ Erreur pour le canal ${channelId}:`, error.message);
        }

        // Attendre un peu entre chaque post pour éviter le rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('\n✅ Tous les arbres leurres ont été repostés !');
      process.exit(0);

    } catch (error) {
      console.error('❌ Erreur:', error);
      process.exit(1);
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

repostFakeTrees();
