/**
 * Script pour envoyer l'annonce des nouvelles missions de Noël (Version EPIC)
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
  console.log(`Connecte en tant que ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel) {
      console.error('Canal non trouve !');
      process.exit(1);
    }

    const embed = new EmbedBuilder()
      .setColor('#C41E3A') // Rouge Noel
      .setTitle('🎅 HO HO HOOOOO ! 🎄✨ ALERTE MISSIONS DE NOËL ! ✨🎄')
      .setDescription(
        `🔔 **DING DONG !** 🔔\n\n` +
        `Le Père Noël a tellement mangé de cookies cette nuit 🍪🥛 qu'il n'arrive plus à dormir... 😴💤\n\n` +
        `Du coup, il vous a préparé **2 NOUVELLES MISSIONS ÉPIQUES** ! 🎁🎁\n\n` +
        `*Rudolph a aidé... mais surtout pour protéger ses carottes 🥕🦌*`
      )
      .addFields(
        {
          name: '🧩 ═══════════════════════════ 🧩',
          value: `**MISSION 1 : ÉNIGMES DE NOËL**`,
          inline: false
        },
        {
          name: '🎯 Le Défi',
          value:
            `Le Père Noël a caché **25 mots de Noël** derrière des emojis !\n` +
            `Arriverez-vous à tous les deviner ? 🤔💭\n\n` +
            `**Exemple :** ✨⭐🎄 = ???`,
          inline: false
        },
        {
          name: '📊 Difficultés',
          value:
            `🟢 **8 puzzles faciles** - Pour s'échauffer !\n` +
            `🟡 **9 puzzles moyens** - Ça se corse... 😏\n` +
            `🔴 **8 puzzles difficiles** - Mode expert ! 🧠🔥`,
          inline: true
        },
        {
          name: '⏱️ Règles',
          value:
            `⏰ **30 secondes** pour répondre\n` +
            `🔄 **3 essais** maximum\n` +
            `💡 **1 indice** disponible`,
          inline: true
        },
        {
          name: '✅❌ ═══════════════════════════ ✅❌',
          value: `**MISSION 2 : VRAI OU FAUX DE NOËL**`,
          inline: false
        },
        {
          name: '🎯 Le Défi',
          value:
            `**30 questions** pour prouver que vous êtes un VRAI expert de Noël ! 🎓\n` +
            `Ou juste quelqu'un qui aime les chocolats du calendrier... 🍫📅\n\n` +
            `**Fun fact :** Coca-Cola n'a PAS inventé le Père Noël rouge ! 🤯`,
          inline: false
        },
        {
          name: '📊 Difficultés',
          value:
            `🟢 **10 questions faciles**\n` +
            `🟡 **12 questions moyennes**\n` +
            `🔴 **8 questions difficiles**`,
          inline: true
        },
        {
          name: '⏱️ Règles',
          value:
            `⏰ **20 secondes** pour répondre\n` +
            `🔄 **3 essais** maximum\n` +
            `💡 **1 indice** disponible`,
          inline: true
        },
        {
          name: '🎁 ═══════ RÉCOMPENSES ═══════ 🎁',
          value:
            `✨ **Chaque bonne réponse = 1 collectible aléatoire !** ✨\n\n` +
            `🏆 Plus vous jouez, plus vous complétez votre collection !\n` +
            `🍀 *Le Père Noël promet qu'il n'a pas truqué les probas... cette fois* 😇`,
          inline: false
        },
        {
          name: '🚀 COMMENT JOUER ?',
          value:
            `1️⃣ Attendez qu'une mission apparaisse\n` +
            `2️⃣ Cliquez sur **"Accepter"** 🎮\n` +
            `3️⃣ Répondez le plus vite possible ! ⚡\n` +
            `4️⃣ Récupérez vos récompenses ! 🎁`,
          inline: false
        }
      )
      .setFooter({ text: '🎄 Joyeuses Fêtes ! Que les collectibles soient avec vous ! 🎅✨' })
      .setTimestamp();

    // Message d'accroche avant l'embed
    await channel.send({
      content: `# 🎄🎅 NOUVELLES MISSIONS DE NOËL 🎅🎄\n\n@everyone\n\n❄️ *Le traîneau vient de se poser...* ❄️`,
      embeds: [embed]
    });

    console.log('Annonce envoyee avec succes !');
    console.log(`Canal: ${channel.name}`);

    // Attendre un peu avant de fermer
    setTimeout(() => {
      client.destroy();
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('Erreur:', error);
    client.destroy();
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
