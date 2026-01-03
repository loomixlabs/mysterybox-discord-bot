/**
 * Script pour poster l'annonce de fin du mini-jeu Baguette de Sureau (VERSION EMBED)
 *
 * IMPORTANT: Exécuter dans le conteneur Docker VPS pour utiliser le bon bot
 * docker exec bot-mysterybox node scripts/post-minigame-announcement.js
 */

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const CONFIG = {
  GUILD_ID: '1182395170273099806',
  CHANNEL_ID: '1339571870755717120',
  OLD_MESSAGE_ID: '1450908073081311304', // Message à supprimer
  OWNER_ID: '297307186307006464' // xmicordiw - à exclure de la liste
};

// Liste des gagnants (sans le owner)
const WINNERS = [
  '680580079612592227',
  '692649463805640724',
  '397172909333807104',
  '1248027211689234535',
  '287627991691821076',
  '918254330107265064',
  '1176956283518201917',
  '1207300650371653663',
  '923264519394951208',
  '1358874922440458451',
  '1245817485572440165',
  '1325719496731918377'
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que: ${client.user.tag}`);

  // Vérifier que c'est le bon bot
  if (!client.user.tag.includes('Loomix')) {
    console.error('❌ ERREUR: Ce n\'est pas le bot Loomix Labs !');
    client.destroy();
    process.exit(1);
  }

  try {
    const channel = await client.channels.fetch(CONFIG.CHANNEL_ID);

    if (!channel) {
      console.error('❌ Channel introuvable:', CONFIG.CHANNEL_ID);
      client.destroy();
      process.exit(1);
    }

    // Supprimer l'ancien message
    try {
      const oldMessage = await channel.messages.fetch(CONFIG.OLD_MESSAGE_ID);
      await oldMessage.delete();
      console.log('🗑️  Ancien message supprimé');
    } catch (e) {
      console.log('⚠️  Ancien message déjà supprimé ou introuvable');
    }

    // Construire la liste des mentions
    const winnerMentions = WINNERS.map(id => `⚡ <@${id}>`).join('\n');

    // Créer l'embed principal
    const embed = new EmbedBuilder()
      .setColor(0xFFD700) // Or - couleur de la Baguette de Sureau
      .setTitle('⚡ 𝗟𝗔 𝗕𝗔𝗚𝗨𝗘𝗧𝗧𝗘 𝗗𝗘 𝗦𝗨𝗥𝗘𝗔𝗨 𝗔 𝗥𝗘́𝗣𝗢𝗡𝗗𝗨 𝗔̀ 𝗟\'𝗔𝗣𝗣𝗘𝗟 ! ⚡')
      .setDescription(
        `📜 *Une chouette vient de délivrer ce parchemin...*\n\n` +
        `La relique la plus puissante des **Trois Reliques de la Mort** était cachée quelque part sur ce serveur...\n` +
        `**12 sorciers perspicaces** ont su l'invoquer !`
      )
      .addFields(
        {
          name: '🏆✨ 𝐋𝐄𝐒 𝐌𝐀𝐈̂𝐓𝐑𝐄𝐒 𝐃𝐄 𝐋𝐀 𝐌𝐎𝐑𝐓 ✨🏆',
          value: winnerMentions,
          inline: false
        },
        {
          name: '🃏 𝐋𝐄𝐔𝐑 𝐑𝐄́𝐂𝐎𝐌𝐏𝐄𝐍𝐒𝐄 ?',
          value:
            `Le mythique **MysteryBox Joker** — un pouvoir LÉGENDAIRE qui leur permet de choisir **N'IMPORTE QUEL** collectible du jeu ! 👑\n\n` +
            `*Ils ont désormais une longueur d'avance...*`,
          inline: false
        }
      )
      .setFooter({ text: '🧙‍♂️ Le Ministère de la Magie vous observe... ⚡' })
      .setTimestamp();

    // Créer un second embed pour le tutoriel (plus visible)
    const tutorialEmbed = new EmbedBuilder()
      .setColor(0x9B59B6) // Violet magique
      .setTitle('🔮 𝐔𝐍𝐄 𝐍𝐎𝐔𝐕𝐄𝐋𝐋𝐄 𝐀𝐕𝐄𝐍𝐓𝐔𝐑𝐄 𝐂𝐎𝐌𝐌𝐄𝐍𝐂𝐄...')
      .setDescription(
        `**MysteryBox** — le jeu de collection magique — arrive **TRÈS BIENTÔT** sur ce serveur !\n\n` +
        `🎁 Mystery Boxes à ouvrir\n` +
        `🎯 Collectibles à chasser\n` +
        `⚠️ Pièges à éviter\n` +
        `🏅 Missions à accomplir\n` +
        `👑 Rôles exclusifs à débloquer`
      )
      .addFields(
        {
          name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          value: '\u200B',
          inline: false
        },
        {
          name: '📚 𝐏𝐑𝐄́𝐏𝐀𝐑𝐄-𝐓𝐎𝐈 𝐃𝐄̀𝐒 𝐌𝐀𝐈𝐍𝐓𝐄𝐍𝐀𝐍𝐓 !',
          value:
            `Découvre **TOUT** ce qu'il faut savoir sur le jeu avant son lancement !\n\n` +
            `**⬇️⬇️⬇️ TAPE CETTE COMMANDE ⬇️⬇️⬇️**`,
          inline: false
        },
        {
          name: '🎮 COMMANDE',
          value: '```/tutoriel```',
          inline: false
        },
        {
          name: '\u200B',
          value: `*Les sorciers les mieux préparés auront l'avantage...* 🧙‍♂️`,
          inline: false
        }
      );

    console.log('\n📤 Envoi des embeds...');
    const message = await channel.send({ embeds: [embed, tutorialEmbed] });

    console.log('✅ Embed posté avec succès !');
    console.log(`   Message ID: ${message.id}`);
    console.log(`   Channel: #${channel.name}`);
    console.log(`   Bot: ${client.user.tag}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
