require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const GUILD_ID = '1248028543389143070';
const CHANNEL_ID = '1248176835490091110';

client.once('ready', async () => {
    console.log(`✅ Bot connecté: ${client.user.tag}`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        if (!channel) {
            console.error('❌ Canal introuvable');
            process.exit(1);
        }

        // Message principal
        const announcement = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎮 **NOUVEAUTÉS DANS /PROFILE - GUIDE COMPLET**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Trois nouvelles fonctionnalités sont disponibles dans ton profil ! Voici comment les utiliser :

═══════════════════════════════════════════
📅 **RÉCOMPENSES QUOTIDIENNES**
═══════════════════════════════════════════

Chaque jour, tu peux réclamer UNE récompense gratuite !

🎁 **Comment ça marche ?**
• Clique sur « Réclamer » une fois par jour
• Chaque jour offre une récompense différente (clés, Loomix, bonus...)
• Les jours ⭐ **Milestone** offrent des récompenses exceptionnelles !

🔥 **Système de Streak**
• Plus tu réclames de jours d'affilée, plus ton streak augmente
• ⚠️ Si tu manques un jour, ton streak repart à zéro !
• Ton meilleur streak est sauvegardé pour toujours

🔓 **Tu as manqué des jours ?**
Pas de panique ! Tu peux les **rattraper avec tes Loomix** 💎
• Le prix augmente progressivement
• Tu récupères les récompenses dans l'ordre

📅 **Calendrier**
Consulte le calendrier pour voir :
• ✅ Jours réclamés
• 🔒 Jours manqués (rattrapables)
• 🎁 Jour disponible
• ⬜ Jours à venir`;

        const announcement2 = `═══════════════════════════════════════════
📦 **MES MYSTERYBOX (Clés)**
═══════════════════════════════════════════

Tes clés te permettent d'ouvrir des MysteryBox depuis ton profil !

🔑 **Les 4 types de clés :**
• 🔑 **Commune** - La plus facile à obtenir
• 🔑💎 **Rare** - Meilleurs gains
• 🔑✨ **Épique** - Gains exceptionnels
• 🗝️👑 **Légendaire** - Le graal ultime !

✨ **Système d'Upgrade Automatique !**
Quand tu ouvres une box, elle peut **s'améliorer spontanément** !
• Une clé Commune peut devenir Rare, voire plus...
• Une clé Rare peut devenir Épique ou Légendaire...
• Plus la rareté est haute, plus les gains sont précieux !

🎁 **Ce que tu peux gagner :**
• Des **Collectibles** du thème actif
• Des **Super Bonus** puissants

🛡️ **Protection :** Si ta box est vide, ta clé t'est **remboursée** !`;

        const announcement3 = `═══════════════════════════════════════════
⚒️ **CRAFTING (Fabrication)**
═══════════════════════════════════════════

Transforme tes clés pour optimiser ta collection !

⬆️ **UPGRADE (Améliorer)**
Combine plusieurs clés pour en créer une de rareté supérieure :
• 3 🔑 Communes → 1 🔑💎 Rare
• 3 🔑💎 Rares → 1 🔑✨ Épique
• 3 🔑✨ Épiques → 1 🗝️👑 Légendaire

♻️ **RECYCLE (Recycler)**
Transforme une clé en plusieurs clés de rareté inférieure :
• 1 🔑💎 Rare → 2 🔑 Communes
• 1 🔑✨ Épique → 2 🔑💎 Rares
• 1 🗝️👑 Légendaire → 2 🔑✨ Épiques

⚡ **CHANCE CRITIQUE !**
À chaque craft, tu as une chance d'obtenir **+1 clé bonus** !
Regarde bien l'animation... 🎰

💎 **Pas assez de clés ?**
Tu peux payer la différence en **Loomix** pour compléter un craft !`;

        const announcement4 = `═══════════════════════════════════════════
💰 **IMPORTANT : PERSISTANCE ENTRE THÈMES**
═══════════════════════════════════════════

🔑 **Tes clés** et 💎 **tes Loomix** sont **CONSERVÉS** d'un thème à l'autre !

Quand un thème se termine et qu'un nouveau commence :
• Tes clés restent dans ton inventaire
• Ton solde Loomix est préservé
• Tu peux les utiliser sur le prochain thème !

⚠️ **CONSEIL : Soyez économes !**
Ne dépensez pas tout d'un coup. Gardez des réserves pour :
• Les futurs thèmes avec des collectibles rares
• Les événements spéciaux
• Les Milestones importants à rattraper

═══════════════════════════════════════════
💡 **CONSEILS PRO**
═══════════════════════════════════════════

1️⃣ **Claim tous les jours** pour maximiser ton streak et tes récompenses
2️⃣ **Garde tes clés Légendaires** pour les meilleurs gains
3️⃣ **Utilise le Crafting** pour convertir tes clés selon tes besoins
4️⃣ **Économise tes Loomix** pour rattraper les jours importants (Milestones)
5️⃣ **Profite des Upgrades automatiques** - une clé Commune peut devenir Légendaire !
6️⃣ **Pense au long terme** - tes ressources serviront sur plusieurs thèmes !

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tape **/profile** pour accéder à toutes ces fonctionnalités !
Bonne chance et bonnes récompenses ! 🍀
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        // Envoyer les messages
        console.log('📤 Envoi de l\'annonce...');

        await channel.send(announcement);
        await new Promise(r => setTimeout(r, 500));

        await channel.send(announcement2);
        await new Promise(r => setTimeout(r, 500));

        await channel.send(announcement3);
        await new Promise(r => setTimeout(r, 500));

        await channel.send(announcement4);

        console.log('✅ Annonce postée avec succès !');

    } catch (error) {
        console.error('❌ Erreur:', error);
    }

    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
