const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

async function postAnnouncement() {
  try {
    await client.login(process.env.DISCORD_TOKEN);

    console.log('🤖 Bot connecté !');

    const channelId = '1248176835490091110';
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      console.error('❌ Channel introuvable');
      process.exit(1);
    }

    const embed = new EmbedBuilder()
      .setTitle('🎨 MISE À JOUR v1.3.0 - Personnalisation de Profil')
      .setDescription(
        '**Nouvelles fonctionnalités incroyables pour votre profil !**\n\n' +
        '🌟 Vous pouvez maintenant **personnaliser la couleur** de votre profil !\n\n' +
        '### 🎨 Comment ça marche ?\n' +
        '1. Tape `/profile` pour ouvrir ton profil\n' +
        '2. Clique sur **"🎨 Couleur de l\'embed"**\n' +
        '3. Choisis parmi **32 couleurs** prédéfinies ou entre ton **code hex personnalisé** !\n\n' +
        '### ✨ Choix disponibles :\n' +
        '• 🎨 **Basiques** (Rouge, Orange, Jaune, Vert, Bleu, Violet...)\n' +
        '• ✨ **Tendances 2025** (Saphir, Jade, Sakura, Océan...)\n' +
        '• 🌸 **Pastel** (Rose, Bleu, Violet, Vert...)\n' +
        '• ⚡ **Vives** (Néon, Électrique, Fluo...)\n' +
        '• 💼 **Professionnelles** (Corporate, Business...)\n' +
        '• 🔢 **Code Hex** (N\'importe quelle couleur avec #FFFFFF)\n' +
        '• 🌈 **Automatique** (Couleur dynamique selon ta progression)\n\n' +
        '### 📢 Autres nouveautés :\n' +
        '✅ **Partage de profil amélioré** - Statistiques détaillées par rareté\n' +
        '✅ **Historique récent** - Tes 3 dernières activités affichées\n' +
        '✅ **Classement serveur** - Vois ta position sur le serveur\n' +
        '✅ **Design modernisé** - Interface plus belle et plus complète\n\n' +
        '🎮 **Essaye dès maintenant avec `/profile` !**'
      )
      .setColor('#FF69B4')
      .setImage('https://cdn.discordapp.com/attachments/1423823165062123560/1439362609332621514/8532C48D-D8EA-4925-9587-DAA41BFDFB65.png?ex=691a3e64&is=6918ece4&hm=bef3be317718102da41c304e1bcdead5c8d2c401e1341769c53ee698f4774517&')
      .setFooter({
        text: 'Powered by Loomix Bot',
        iconURL: 'https://avatars.githubusercontent.com/u/241378179?s=400&u=fb81108da6b3639fae0f2a9335d01ca07bb0ddc5&v=4'
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    console.log('✅ Annonce postée avec succès !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

postAnnouncement();
