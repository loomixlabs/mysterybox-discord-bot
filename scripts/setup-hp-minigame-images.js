/**
 * Script pour envoyer les images du mini-jeu Harry Potter
 * - 12 fausses images (leurres) dans différents canaux
 * - 1 vraie image dans le canal qui déclenche le jeu
 *
 * IMPORTANT: Les images sont hébergées sur le VPS via nginx (port 8080)
 */
const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const HP_GUILD_ID = '1182395170273099806';
const BASE_URL = 'http://72.60.185.62:8080/hp-images';

// Canal de la vraie image (déclenche le mini-jeu)
const REAL_IMAGE_CHANNEL = '1189233124064895096';

// Images des collectibles HP (URLs VPS)
const IMAGES = {
  baguette_sureau: `${BASE_URL}/Gemini_Generated_Image_iv93dwiv93dwiv93.png`,
  pierre_resurrection: `${BASE_URL}/Gemini_Generated_Image_uhpkuwuhpkuwuhpk.png`,
  cape_invisibilite: `${BASE_URL}/Gemini_Generated_Image_fxd6y9fxd6y9fxd6.png`,
  carte_maraudeur: `${BASE_URL}/Gemini_Generated_Image_a1oyxba1oyxba1oy.png`,
  eclair_feu: `${BASE_URL}/Gemini_Generated_Image_dnfeykdnfeykdnfe.png`,
  choixpeau: `${BASE_URL}/Gemini_Generated_Image_2814ve2814ve2814.png`,
  pensine: `${BASE_URL}/Gemini_Generated_Image_joh5tqjoh5tqjoh5.png`,
  retourneur_temps: `${BASE_URL}/Gemini_Generated_Image_iq9ohciq9ohciq9o.png`,
  baguette_phoenix: `${BASE_URL}/Gemini_Generated_Image_b0mjh3b0mjh3b0mj.png`,
  nimbus: `${BASE_URL}/Gemini_Generated_Image_pp23x8pp23x8pp23.png`,
  vif_or: `${BASE_URL}/Gemini_Generated_Image_1xagb31xagb31xag.png`,
  deluminateur: `${BASE_URL}/Gemini_Generated_Image_rxu8icrxu8icrxu8.png`,
  miroir_rised: `${BASE_URL}/Gemini_Generated_Image_k1yep9k1yep9k1ye.png`
};

// 12 canaux leurres avec leurs images
const LEURRES = [
  { channelId: '1182395170273099809', name: 'général-discussion', image: IMAGES.pierre_resurrection },
  { channelId: '1195847910416470216', name: 'jeu-discussion', image: IMAGES.cape_invisibilite },
  { channelId: '1196132861904953435', name: 'actu-monopoly-go', image: IMAGES.carte_maraudeur },
  { channelId: '1204520488227962911', name: 'live', image: IMAGES.eclair_feu },
  { channelId: '1209781283807559741', name: 'commandes-bots', image: IMAGES.choixpeau },
  { channelId: '1234113729059225691', name: 'invitations', image: IMAGES.pensine },
  { channelId: '1253742188974571603', name: 'blabla-animateur', image: IMAGES.retourneur_temps },
  { channelId: '1339571780796289064', name: 'étoile-mystérieuse', image: IMAGES.baguette_phoenix },
  { channelId: '1365773475800678411', name: 'giveaway', image: IMAGES.nimbus },
  { channelId: '1418876276634292254', name: 'résultat-loto', image: IMAGES.vif_or },
  { channelId: '1434461695946002533', name: 'les-100', image: IMAGES.deluminateur },
  { channelId: '1189546578139152434', name: 'arnaqueur', image: IMAGES.miroir_rised }
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🪄 ENVOI DES IMAGES MINI-JEU HARRY POTTER');
  console.log('='.repeat(60));
  console.log(`\n📍 Images hébergées sur: ${BASE_URL}`);

  try {
    const guild = await client.guilds.fetch(HP_GUILD_ID);
    console.log(`✅ Connecté au serveur: ${guild.name}`);

    // 1. Envoyer les 12 images leurres
    console.log('\n📸 1. ENVOI DES 12 IMAGES LEURRES...\n');

    for (const leurre of LEURRES) {
      try {
        const channel = await guild.channels.fetch(leurre.channelId);
        if (channel) {
          await channel.send({ content: leurre.image });
          console.log(`   ✅ Image envoyée dans #${leurre.name}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Pause 1s
        } else {
          console.log(`   ❌ Canal ${leurre.name} introuvable`);
        }
      } catch (err) {
        console.log(`   ❌ Erreur ${leurre.name}: ${err.message}`);
      }
    }

    // 2. Envoyer la vraie image
    console.log('\n🎯 2. ENVOI DE LA VRAIE IMAGE (Baguette de Sureau)...\n');

    const realChannel = await guild.channels.fetch(REAL_IMAGE_CHANNEL);
    if (realChannel) {
      const realMessage = await realChannel.send({ content: IMAGES.baguette_sureau });
      console.log(`   ✅ Image envoyée dans #${realChannel.name}`);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎯 ID DU MESSAGE DE LA VRAIE IMAGE: ${realMessage.id}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`\n📝 À mettre dans index.js:`);
      console.log(`   reactionHandler.setHPGameMessageId('${realMessage.id}');`);
    } else {
      console.log(`   ❌ Canal de la vraie image introuvable`);
    }

    console.log('\n✅ Setup terminé !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
