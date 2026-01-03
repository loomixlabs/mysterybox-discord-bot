/**
 * Script pour envoyer l'annonce mystérieuse du mini-jeu Harry Potter
 * Cette annonce contient des indices cryptiques pour trouver la vraie Baguette de Sureau
 */
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const HP_GUILD_ID = '1182395170273099806';
const ANNOUNCEMENT_CHANNEL_ID = '1339571870755717120'; // Annonces officielles

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🪄 ENVOI DE L\'ANNONCE MYSTÉRIEUSE HARRY POTTER');
  console.log('='.repeat(60));

  try {
    const guild = await client.guilds.fetch(HP_GUILD_ID);
    console.log(`\n✅ Connecté au serveur: ${guild.name}`);

    const channel = await guild.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Canal des annonces introuvable');
      process.exit(1);
    }

    // Créer l'embed de l'annonce mystérieuse
    const mysteryEmbed = new EmbedBuilder()
      .setTitle('⚡ UNE RELIQUE DE LA MORT A ÉTÉ CACHÉE... ⚡')
      .setDescription(
        '*« Les Reliques de la Mort... Trois objets légendaires qui, ensemble, feraient de leur possesseur le Maître de la Mort. »*\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '🪄 **La Baguette de Sureau** a été dissimulée sur ce serveur...\n\n' +
        'Parmi **13 baguettes** dispersées dans Poudlard, **une seule** est authentique. Les 12 autres ne sont que des leurres.\n\n' +
        '✨ **Le sorcier qui la découvrira** obtiendra le titre de **« Sorcier Perspicace »** et sera initié à un **mystère bien plus grand**...'
      )
      .setColor('#9B59B6')
      .addFields(
        {
          name: '🔮 PROPHÉTIE DE TRELAWNEY',
          value: '```\n' +
                 '« Cherche là où le hasard distribue ses cartes... »\n' +
                 '« Le joker cache parfois le plus grand trésor... »\n' +
                 '« Seul l\'œil attentif verra au-delà du voile... »\n' +
                 '```',
          inline: false
        },
        {
          name: '⚠️ AVERTISSEMENT',
          value: '12 illusions. 1 vérité.\nSaurez-vous distinguer l\'authentique des contrefaçons ?',
          inline: false
        },
        {
          name: '🎁 CE QUI ATTEND LE VAINQUEUR',
          value: '⭐ Le rôle exclusif **« Sorcier Perspicace »**\n' +
                 '📜 La révélation d\'un **jeu secret** à venir\n' +
                 '🏆 Une longueur d\'avance sur tous les autres...',
          inline: false
        }
      )
      .setFooter({ text: '⚡ « Il ne faut pas avoir peur d\'appeler les choses par leur nom. » - Albus Dumbledore' })
      .setTimestamp();

    // Envoyer l'annonce
    const message = await channel.send({
      content: '@everyone',
      embeds: [mysteryEmbed]
    });

    console.log(`\n✅ Annonce envoyée dans #${channel.name}`);
    console.log(`📝 ID du message: ${message.id}`);
    console.log('\n✅ Annonce mystérieuse envoyée avec succès !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
