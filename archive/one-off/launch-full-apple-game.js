const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const GUILD_ID = '1248028543389143070';

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

// Canal pour l'annonce
const ANNOUNCEMENT_CHANNEL = '1248176835490091110';

// Canal pour la VRAIE image (mini-jeu actif)
const REAL_CHANNEL = '1428022811078688904';
const REAL_TREE_IMAGE = 'https://popcinema.fr/wp-content/uploads/2025/05/Disney-vs-Pixar-Quel-studio-a-vraiment-le-meilleur-film-.png';

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

// Message d'annonce
const ANNOUNCEMENT_MESSAGE = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍎 **ANNONCE SPÉCIALE - MINI-JEU** 🍎
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Chers membres du serveur,**

Dans quelques jours débutera un **événement thématique unique** sur notre serveur : **Blanche-Neige et les 7 Nains** !

Mais avant de vous dévoiler tous les secrets de cet événement magique, nous vous proposons un **mini-jeu exclusif** pour les plus observateurs d'entre vous...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌲 **LE DÉFI DE LA POMME ENCHANTÉE** 🌲
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Une image d'arbre mystérieux** a été postée quelque part sur le serveur...

🔍 **Votre mission :**
Trouvez cet arbre caché parmi tous les canaux du serveur et réagissez avec l'émoji 🍎 pour découvrir un **secret exclusif** sur le prochain événement !

⚠️ **Attention :** Plusieurs arbres ont été postés sur le serveur, mais **un seul est le bon** ! À vous de trouver lequel...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎁 **RÉCOMPENSE**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Les premiers à trouver le bon arbre recevront un **message privé exclusif** contenant :
• 📖 Toutes les informations sur l'événement Blanche-Neige
• 🎯 Les mécaniques de jeu détaillées
• 🏆 Les récompenses à gagner
• ⚡ Un avantage pour débuter l'événement

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Bonne chance à tous !** 🍀

*"Miroir, mon beau miroir, qui trouvera l'arbre en premier ?"*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

async function launchFullAppleGame() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
  });

  client.once('ready', async () => {
    try {
      console.log(`🤖 Bot connecté: ${client.user.tag}\n`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🍎 LANCEMENT DU MINI-JEU DE LA POMME');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // 1. Poster les fausses images d'arbres
      console.log('🌲 ÉTAPE 1: Envoi des arbres leurres...\n');

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

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // 2. Poster le message d'annonce
      console.log('📢 ÉTAPE 2: Envoi du message d\'annonce...\n');

      try {
        const announcementChannel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL);
        if (announcementChannel) {
          await announcementChannel.send({ content: ANNOUNCEMENT_MESSAGE });
          console.log(`✅ Message d'annonce posté dans: ${announcementChannel.name}`);
        }
      } catch (error) {
        console.error('❌ Erreur lors de l\'envoi de l\'annonce:', error.message);
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // 3. Poster la VRAIE image avec le mini-jeu actif
      console.log('🍎 ÉTAPE 3: Envoi de l\'arbre RÉEL (mini-jeu actif)...\n');

      try {
        const realChannel = await client.channels.fetch(REAL_CHANNEL);
        if (realChannel) {
          const message = await realChannel.send({ content: REAL_TREE_IMAGE });
          console.log(`✅ Arbre RÉEL posté dans: ${realChannel.name}`);
          console.log(`🆔 Message ID: ${message.id}`);
          console.log(`🔗 Lien: https://discord.com/channels/${GUILD_ID}/${REAL_CHANNEL}/${message.id}`);

          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✅ MINI-JEU LANCÉ AVEC SUCCÈS !');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

          console.log('📝 INSTRUCTIONS POUR ACTIVER LE MINI-JEU:');
          console.log('1. Copie le Message ID ci-dessus');
          console.log('2. Ouvre index.js');
          console.log('3. Après le chargement des événements, modifie la ligne:');
          console.log('');
          console.log('   const reactionHandler = require(\'./events/messageReactionAdd\');');
          console.log(`   reactionHandler.setAppleGameMessageId('${message.id}');`);
          console.log('');
          console.log('4. Redémarre le bot');
          console.log('5. Les joueurs qui réagissent avec 🍎 sur ce message recevront le MP !');
          console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
      } catch (error) {
        console.error('❌ Erreur lors de l\'envoi de l\'arbre réel:', error.message);
      }

      process.exit(0);

    } catch (error) {
      console.error('❌ Erreur:', error);
      process.exit(1);
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

launchFullAppleGame();
