const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

async function postAnnouncement() {
  try {
    const guildId = '1248028543389143070';
    const channelId = '1248176835490091110'; // Canal annonces

    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Bot connecté');

    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);

    if (!channel) {
      console.error('❌ Canal introuvable');
      process.exit(1);
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2') // Bleu Discord
      .setTitle('🎉 MISE À JOUR v1.7.0 - Système de Badges & Corrections Majeures !')
      .setDescription(`Salut à tous ! 👋

Nous sommes ravis de vous annoncer une **mise à jour majeure** qui améliore considérablement votre expérience de jeu ! 🚀`)
      .addFields(
        {
          name: '🏆 **NOUVEAU : Système de Badges Complet**',
          value: `Un tout nouveau système de récompenses est maintenant disponible ! 🎖️

**Ce qui vous attend :**
• 🎯 **13 badges à débloquer** dans 4 catégories différentes
• 📊 **Progression en temps réel** - Suivez vos progrès pour chaque badge
• 🏅 **Raretés variées** : Commun → Mythique
• 📬 **Notifications en MP** quand vous débloquez un badge
• 📈 **Leaderboard** - Comparez-vous aux autres joueurs

**Comment y accéder ?**
Utilisez la commande \`/profile\` puis cliquez sur **🏆 Badges** !

**Les catégories :**
• 👁️ Vision Divine (3 badges)
• 🛡️ Bouclier Anti-Piège (3 badges)
• 💰 Jackpot x2 (3 badges)
• 🧲 Aimant Légendaire (3 badges MYTHIQUES)
• ✨ Badge Spécial Collectionneur`,
          inline: false
        },
        {
          name: '✨ **BONUS : 4ème Super Bonus Débloqué !**',
          value: `L'**Aimant à Légendaires** 🧲 est maintenant disponible !

**Effet :** Force le prochain item à être au minimum **Légendaire** 💎
**Comment l'obtenir ?** Via les Mystery Boxes et missions spéciales

Avec Vision Divine, Bouclier Anti-Piège, Jackpot x2 et maintenant l'Aimant, vous avez **4 super bonus** à votre disposition pour maximiser vos chances ! 🎰`,
          inline: false
        },
        {
          name: '🐛 **12 Bugs Corrigés**',
          value: `Nous avons écouté vos retours et corrigé **12 bugs critiques** :

**Admin Panel :**
• ✅ Création de thèmes (problème de probabilités)
• ✅ Prolongation de thèmes maintenant disponible
• ✅ Configuration Mystery Box (tous les boutons fonctionnent)

**Missions Quiz :**
• ✅ Pagination des questions (>25 questions)
• ✅ Suppression de questions simplifiée
• ✅ Ajout de questions (audit logs corrigés)

**Profile & Navigation :**
• ✅ Pagination inventaire (accès pages 3+)
• ✅ Bouton "Mes Badges" en MP fonctionnel
• ✅ Boutons retour missions mots-clés

**Et bien plus !** Consultez le [CHANGELOG](https://github.com/loomixlabs/mysterybox-discord-bot/releases/tag/v1.7.0) pour la liste complète.`,
          inline: false
        },
        {
          name: '📈 **Améliorations Techniques**',
          value: `• 🔧 **Optimisation** de la gestion des interactions Discord
• 📊 **Nouvelles tables DB** pour le système de badges
• 🚀 **Performance** améliorée sur les requêtes
• 📝 **Audit logs** plus détaillés pour les admins`,
          inline: false
        },
        {
          name: '🎯 **Comment Profiter de Ces Nouveautés ?**',
          value: `1️⃣ Tapez \`/profile\` et explorez l'onglet **🏆 Badges**
2️⃣ Utilisez vos **Super Bonus** pour débloquer des badges plus vite
3️⃣ Complétez des **missions** pour progresser
4️⃣ Ouvrez des **Mystery Boxes** pour tenter l'Aimant Légendaire 🧲

**Bon jeu à tous !** 🎮✨`,
          inline: false
        }
      )
      .setFooter({
        text: 'Version 1.7.0 • 2025-11-20 • Merci pour votre patience durant les corrections ❤️'
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    console.log('✅ Message d\'annonce posté avec succès !');
    console.log(`📍 Canal: ${channel.name} (${channelId})`);
    console.log(`🎯 Version: v1.7.0`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

postAnnouncement();
