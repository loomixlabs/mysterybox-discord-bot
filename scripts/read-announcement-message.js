require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const GUILD_ID = '1248028543389143070';
const MESSAGE_ID = '1440722900788314173';

async function readMessage() {
  try {
    await client.login(process.env.DISCORD_TOKEN);

    console.log('🔍 LECTURE DU MESSAGE D\'ANNONCE\n');
    console.log('='.repeat(80));
    console.log(`Guild ID: ${GUILD_ID}`);
    console.log(`Message ID: ${MESSAGE_ID}\n`);

    const guild = await client.guilds.fetch(GUILD_ID);
    console.log(`✅ Guild trouvé: ${guild.name}\n`);

    // Chercher le message dans tous les channels
    console.log('🔍 Recherche du message dans tous les canaux...\n');

    let messageFound = null;
    let channelFound = null;

    for (const [channelId, channel] of guild.channels.cache) {
      if (channel.isTextBased()) {
        try {
          const message = await channel.messages.fetch(MESSAGE_ID);
          if (message) {
            messageFound = message;
            channelFound = channel;
            break;
          }
        } catch (e) {
          // Message pas dans ce canal
        }
      }
    }

    if (!messageFound) {
      console.log('❌ Message introuvable dans les canaux en cache');
      console.log('⚠️  Tentative de recherche dans un canal spécifique...\n');

      // Essayer dans le canal d'annonces par défaut
      const announcementChannel = guild.channels.cache.find(c =>
        c.name.includes('annonce') || c.name.includes('général') || c.name.includes('discussion')
      );

      if (announcementChannel && announcementChannel.isTextBased()) {
        try {
          messageFound = await announcementChannel.messages.fetch(MESSAGE_ID);
          channelFound = announcementChannel;
        } catch (e) {
          console.log('❌ Message non trouvé dans le canal d\'annonces');
        }
      }
    }

    if (messageFound) {
      console.log('✅ MESSAGE TROUVÉ!\n');
      console.log('='.repeat(80));
      console.log(`📍 Canal: #${channelFound.name} (${channelFound.id})`);
      console.log(`👤 Auteur: ${messageFound.author.tag} (${messageFound.author.id})`);
      console.log(`📅 Date: ${messageFound.createdAt.toLocaleString('fr-FR')}\n`);

      console.log('📝 CONTENU DU MESSAGE:');
      console.log('-'.repeat(80));
      console.log(messageFound.content || '(Pas de contenu texte)');
      console.log('-'.repeat(80));

      if (messageFound.embeds.length > 0) {
        console.log('\n📋 EMBEDS:');
        messageFound.embeds.forEach((embed, index) => {
          console.log(`\n--- Embed ${index + 1} ---`);
          if (embed.title) console.log(`📌 Titre: ${embed.title}`);
          if (embed.description) console.log(`📝 Description: ${embed.description}`);
          if (embed.footer) console.log(`👣 Footer: ${embed.footer.text}`);
          if (embed.author) console.log(`✍️  Author: ${embed.author.name}`);
          if (embed.fields.length > 0) {
            console.log('📊 Fields:');
            embed.fields.forEach(field => {
              console.log(`   ${field.name}: ${field.value}`);
            });
          }
        });
      }

      if (messageFound.mentions.users.size > 0) {
        console.log('\n👥 MENTIONS:');
        console.log('-'.repeat(80));
        messageFound.mentions.users.forEach(user => {
          console.log(`  @${user.tag} (ID: ${user.id})`);
        });
      }

      if (messageFound.mentions.roles.size > 0) {
        console.log('\n🎭 RÔLES MENTIONNÉS:');
        console.log('-'.repeat(80));
        messageFound.mentions.roles.forEach(role => {
          console.log(`  @${role.name} (ID: ${role.id})`);
        });
      }

      // Extraire les Discord IDs mentionnés dans le contenu
      const idRegex = /<@!?(\d+)>/g;
      const ids = [];
      let match;
      while ((match = idRegex.exec(messageFound.content)) !== null) {
        ids.push(match[1]);
      }

      if (ids.length > 0) {
        console.log('\n🔢 DISCORD IDs EXTRAITS DU CONTENU:');
        console.log('-'.repeat(80));
        ids.forEach(id => {
          console.log(`  ${id}`);
        });
      }

    } else {
      console.log('❌ Impossible de trouver le message');
      console.log('⚠️  Le message a peut-être été supprimé ou l\'ID est incorrect');
    }

    await client.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    await client.destroy();
    process.exit(1);
  }
}

readMessage();
