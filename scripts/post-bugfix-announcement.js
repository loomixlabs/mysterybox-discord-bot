require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const CHANNEL_ID = '1248176835490091110'; // #discussion-blabla

async function postBugfixAnnouncement() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  try {
    console.log('🔧 Connexion au bot...');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté\n');

    console.log('📍 Récupération du canal...');
    const channel = await client.channels.fetch(CHANNEL_ID);

    if (!channel) {
      console.error('❌ Canal introuvable');
      process.exit(1);
    }

    console.log(`✅ Canal trouvé: ${channel.name}\n`);

    // Créer l'annonce
    const announcementEmbed = new EmbedBuilder()
      .setTitle('🛠️ Mise à jour v1.1.2 - Correctifs Critiques')
      .setDescription(
        `**3 bugs critiques ont été découverts et corrigés dans le système de missions !**\n\n` +
        `**🐛 Bug #1 : Collectibles non attribués**\n` +
        `❌ Problème : Les missions complétées ne donnaient aucune récompense\n` +
        `✅ Solution : Paramètre manquant ajouté dans le code\n` +
        `💰 Impact : 59 missions affectées - 3 joueurs compensés\n\n` +

        `**🐛 Bug #2 : Messages dans les mauvais threads**\n` +
        `❌ Problème : Les notifications de succès allaient dans le mauvais thread\n` +
        `✅ Solution : Utilisation directe de l'ID du thread au lieu de recherche par nom\n` +
        `🎯 Bénéfice : Code simplifié et 100% fiable\n\n` +

        `**🐛 Bug #3 : Missions multiples validées**\n` +
        `❌ Problème : Si un joueur avait plusieurs missions avec le même mot, toutes se validaient\n` +
        `✅ Solution : Limitation à UNE mission par mot-clé prononcé\n` +
        `⚡ Résultat : Plus de conflits ni d'états incohérents\n\n` +

        `**💰 Compensations effectuées :**\n` +
        `• joris0237 → Grincheux (common)\n` +
        `• pop_corn.1203 → Simplet (common)\n` +
        `• mimie34110 → Timide (rare)\n\n` +

        `**✨ Le système de missions fonctionne maintenant parfaitement !**\n` +
        `Toutes les nouvelles missions distribuées donneront bien leurs récompenses. 🎁`
      )
      .setColor('#2ecc71')
      .setFooter({ text: 'Désolé pour les désagréments causés par ces bugs 🙏' })
      .setTimestamp();

    await channel.send({ embeds: [announcementEmbed] });
    console.log('✅ Annonce publiée dans #discussion-blabla\n');

    await client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

postBugfixAnnouncement();
