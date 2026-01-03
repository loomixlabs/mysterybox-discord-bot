/**
 * Script pour envoyer l'annonce des nouvelles missions de Noël (Version FUN)
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
      .setTitle('HO HO HOOO ! Le Pere Noel a fait des heures sup !')
      .setDescription(
        `Mes chers lutins...euh je veux dire joueurs !\n\n` +
        `Le Pere Noel a tellement mange de cookies cette nuit qu'il n'arrive plus a dormir.\n` +
        `Du coup, il vous a prepare **2 NOUVELLES MISSIONS** pour vous occuper !\n\n` +
        `*(Il parait que Rudolph a aide... mais entre nous, c'est surtout pour eviter qu'on lui pique ses carottes)*`
      )
      .addFields(
        {
          name: '**MISSION 1** : Enigmes de Noel',
          value:
            `*"Mais c'est quoi ces emojis ?!"*\n\n` +
            `Le Pere Noel a cache **25 mots de Noel** derriere des emojis.\n` +
            `Votre mission : les deviner avant qu'il finisse sa tasse de chocolat chaud !\n\n` +
            `Exemple : Sapin de Noel\n` +
            `Difficulte : Facile Medium Difficile\n` +
            `Temps : 30 secondes | 3 essais`,
          inline: false
        },
        {
          name: '**MISSION 2** : Vrai ou Faux de Noel',
          value:
            `*"Tu croyais tout savoir sur Noel ? LOL"*\n\n` +
            `**30 questions** pour tester si vous etes un vrai expert de Noel\n` +
            `ou juste quelqu'un qui aime les chocolats du calendrier de l'Avent.\n\n` +
            `Spoiler : Coca-Cola n'a PAS invente le Pere Noel rouge\n` +
            `Difficulte : Facile Medium Difficile\n` +
            `Temps : 20 secondes | 3 essais`,
          inline: false
        },
        {
          name: 'RECOMPENSES',
          value:
            `**Chaque bonne reponse = 1 collectible aleatoire !**\n\n` +
            `Plus vous jouez, plus vous completez votre collection !\n` +
            `*(Le Pere Noel promet qu'il n'a pas truque les probabilites... cette fois)*`,
          inline: false
        },
        {
          name: 'COMMENT JOUER ?',
          value:
            `Cliquez sur le bouton "Accepter" quand une mission apparait !\n` +
            `Ou demandez gentiment a un admin de lancer une mission pour vous.`,
          inline: false
        }
      )
      .setFooter({ text: 'Joyeuses Fetes et que les collectibles soient avec vous !' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

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
