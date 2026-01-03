require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const GUILD_ID = '1182395170273099806';
const CHANNEL_IDS = ['1451672205791334451', '1339571870755717120'];

// Couleurs des maisons Harry Potter
const COLORS = {
    GOLD: 0xFFD700,           // Or - Lancement
    GRYFFINDOR: 0xAE0001,     // Rouge Gryffondor
    SLYTHERIN: 0x1A472A,      // Vert Serpentard
    RAVENCLAW: 0x0E1A40,      // Bleu Serdaigle
    HUFFLEPUFF: 0xECAB53,     // Jaune Poufsouffle
    MAGIC_PURPLE: 0x7B68EE    // Violet magique
};

async function postAnnouncement(channel) {
    // ═══════════════════════════════════════════════════════════════
    // EMBED 1 - LANCEMENT ÉPIQUE
    // ═══════════════════════════════════════════════════════════════
    const embed1 = new EmbedBuilder()
        .setColor(COLORS.GOLD)
        .setTitle('⚡ LANCEMENT OFFICIEL ⚡')
        .setDescription(
            `# 🏰 MYSTERYBOX HARRY POTTER\n\n` +
            `> *« Ce sont nos choix qui montrent ce que nous sommes vraiment,*\n` +
            `> *bien plus que nos aptitudes. »* — Albus Dumbledore\n\n` +
            `Les portes de **Poudlard** s'ouvrent enfin pour vous !\n\n` +
            `Le système **MysteryBox** arrive avec un thème exclusif **Harry Potter** ✨\n\n` +
            `🎯 **Collectionnez** des objets magiques légendaires\n` +
            `⚡ **Débloquez** des pouvoirs spéciaux\n` +
            `🏆 **Devenez** le sorcier ultime de votre génération !`
        )
        .setImage('http://72.60.185.62:8080/mysterybox-launch.gif')
        .setFooter({ text: '✨ Votre aventure magique commence maintenant...' });

    // ═══════════════════════════════════════════════════════════════
    // EMBED 2 - RÉCOMPENSES QUOTIDIENNES
    // ═══════════════════════════════════════════════════════════════
    const embed2 = new EmbedBuilder()
        .setColor(COLORS.RAVENCLAW)
        .setTitle('📅 Récompenses Quotidiennes')
        .setDescription(`*Chaque jour à Poudlard apporte son lot de surprises...*`)
        .addFields(
            {
                name: '🎁 Le Hibou du Matin',
                value:
                    `Chaque jour, réclame **1 récompense gratuite** !\n` +
                    `• Clés magiques 🔑\n` +
                    `• Loomix 💎\n` +
                    `• Super Bonus ⚡\n` +
                    `• Et plus encore...`,
                inline: true
            },
            {
                name: '⭐ Jours Milestone',
                value:
                    `Certains jours sont **spéciaux** !\n` +
                    `Des récompenses exceptionnelles\n` +
                    `t'attendent aux Milestones.\n` +
                    `Ne les manque pas !`,
                inline: true
            },
            {
                name: '\u200B',
                value: '\u200B',
                inline: true
            },
            {
                name: '🔥 Système de Streak',
                value:
                    `> Enchaîne les jours pour augmenter ton streak !\n` +
                    `> ⚠️ **Attention** : Un jour manqué = streak perdu\n` +
                    `> 🏆 Ton meilleur streak est sauvegardé pour toujours`,
                inline: false
            },
            {
                name: '🔓 Rattrapage avec Loomix',
                value:
                    `Tu as manqué des jours ? Pas de panique !\n` +
                    `Rattrape-les avec tes **Loomix** 💎 (prix progressif)`,
                inline: false
            }
        );

    // ═══════════════════════════════════════════════════════════════
    // EMBED 3 - MYSTERYBOX / COFFRES MAGIQUES
    // ═══════════════════════════════════════════════════════════════
    const embed3 = new EmbedBuilder()
        .setColor(COLORS.GRYFFINDOR)
        .setTitle('📦 Coffres Magiques - MysteryBox')
        .setDescription(`*Ouvre des coffres enchantés et découvre les trésors de Poudlard !*`)
        .addFields(
            {
                name: '🔑 Les 4 Clés Magiques',
                value:
                    `🔑 **Commune** — Coffre de Première Année\n` +
                    `🔑💎 **Rare** — Coffre de la Salle sur Demande\n` +
                    `🔑✨ **Épique** — Coffre de Gringotts\n` +
                    `🗝️👑 **Légendaire** — Coffre des Reliques`,
                inline: false
            },
            {
                name: '⚡ GARANTIE DE RARETÉ',
                value:
                    `>>> **Une clé te garantit un gain AU MINIMUM de sa rareté !**\n` +
                    `Une clé Épique 🔑✨ = gain **Épique ou Légendaire** garanti !`,
                inline: false
            },
            {
                name: '✨ Upgrade Automatique',
                value:
                    `Ta box peut **s'améliorer spontanément** !\n` +
                    `Une clé Commune peut devenir Rare... Épique... ou même **Légendaire** ! 🍀`,
                inline: true
            },
            {
                name: '🛡️ Protection',
                value:
                    `Si ton coffre est vide,\n` +
                    `ta clé est **remboursée** !\n` +
                    `Aucun risque de perte.`,
                inline: true
            },
            {
                name: '🎁 Gains Possibles',
                value:
                    `• **Collectibles** Harry Potter\n` +
                    `• **Super Bonus** magiques`,
                inline: true
            }
        );

    // ═══════════════════════════════════════════════════════════════
    // EMBED 4 - CRAFTING
    // ═══════════════════════════════════════════════════════════════
    const embed4 = new EmbedBuilder()
        .setColor(COLORS.SLYTHERIN)
        .setTitle('⚗️ Crafting - L\'Art des Potions')
        .setDescription(`*Tel Severus Rogue, maîtrise l'art de transformer tes ingrédients...*`)
        .addFields(
            {
                name: '⬆️ UPGRADE — Améliorer',
                value:
                    `Combine tes clés pour en créer une plus puissante :\n` +
                    `\`\`\`\n` +
                    `3 🔑 Communes    →  1 🔑💎 Rare\n` +
                    `3 🔑💎 Rares     →  1 🔑✨ Épique\n` +
                    `3 🔑✨ Épiques   →  1 🗝️👑 Légendaire\n` +
                    `\`\`\``,
                inline: false
            },
            {
                name: '♻️ RECYCLE — Recycler',
                value:
                    `Transforme une clé en plusieurs de rareté inférieure :\n` +
                    `\`\`\`\n` +
                    `1 🔑💎 Rare       →  2 🔑 Communes\n` +
                    `1 🔑✨ Épique     →  2 🔑💎 Rares\n` +
                    `1 🗝️👑 Légendaire →  2 🔑✨ Épiques\n` +
                    `\`\`\``,
                inline: false
            },
            {
                name: '🍀 Chance Critique — Felix Felicis',
                value: `À chaque craft, tu as une chance d'obtenir **+1 clé bonus** ! Regarde bien l'animation...`,
                inline: true
            },
            {
                name: '💎 Loomix',
                value: `Pas assez de clés ?\nComplète avec des **Loomix** !`,
                inline: true
            }
        );

    // ═══════════════════════════════════════════════════════════════
    // EMBED 5 - CONSEILS & PERSISTANCE
    // ═══════════════════════════════════════════════════════════════
    const embed5 = new EmbedBuilder()
        .setColor(COLORS.HUFFLEPUFF)
        .setTitle('🎩 Les Conseils du Choixpeau Magique')
        .addFields(
            {
                name: '🔮 Persistance entre Thèmes',
                value:
                    `>>> 🔑 **Tes clés** et 💎 **tes Loomix** sont **CONSERVÉS** d'un thème à l'autre !\n` +
                    `Quand ce thème se terminera, tes ressources te suivront dans la prochaine aventure !`,
                inline: false
            },
            {
                name: '⚠️ Conseil de Sagesse',
                value:
                    `**Soyez économes, jeunes sorciers !**\n` +
                    `• Gardez des réserves pour les futurs thèmes\n` +
                    `• Anticipez les événements spéciaux\n` +
                    `• Ne négligez pas les Milestones importants`,
                inline: false
            },
            {
                name: '💡 Stratégies de Pro',
                value:
                    `1️⃣ **Claim tous les jours** — Ton streak est précieux\n` +
                    `2️⃣ **Garde tes clés Légendaires** — Pour les meilleurs gains\n` +
                    `3️⃣ **Utilise le Crafting** — Convertis selon tes besoins\n` +
                    `4️⃣ **Économise tes Loomix** — Pour les Milestones\n` +
                    `5️⃣ **Pense long terme** — Tes ressources serviront encore !`,
                inline: false
            }
        )
        .setFooter({ text: '⚡ « Après tout, pour un esprit équilibré, la mort n\'est qu\'une grande aventure de plus. »' });

    // ═══════════════════════════════════════════════════════════════
    // EMBED 6 - CALL TO ACTION
    // ═══════════════════════════════════════════════════════════════
    const embed6 = new EmbedBuilder()
        .setColor(COLORS.MAGIC_PURPLE)
        .setTitle('🪄 Prêt à commencer ton aventure ?')
        .setDescription(
            `\n` +
            `## ✨ Tape \`/profile\` pour accéder à Poudlard ! ✨\n\n` +
            `> 📅 **Récompenses Quotidiennes** — Réclame ton dû chaque jour\n` +
            `> 📦 **Mes MysteryBox** — Ouvre tes coffres magiques\n` +
            `> ⚗️ **Crafting** — Transforme tes clés\n\n` +
            `*Que la magie soit avec vous !* 🧙‍♂️`
        )
        .setImage('https://avatars.githubusercontent.com/u/241378179?v=4')
        .setTimestamp()
        .setFooter({ text: 'MysteryBox Harry Potter — Poudlard vous attend' });

    // Envoyer tous les embeds
    await channel.send({ embeds: [embed1] });
    await new Promise(r => setTimeout(r, 800));

    await channel.send({ embeds: [embed2] });
    await new Promise(r => setTimeout(r, 800));

    await channel.send({ embeds: [embed3] });
    await new Promise(r => setTimeout(r, 800));

    await channel.send({ embeds: [embed4] });
    await new Promise(r => setTimeout(r, 800));

    await channel.send({ embeds: [embed5] });
    await new Promise(r => setTimeout(r, 800));

    await channel.send({ embeds: [embed6] });
}

client.once('ready', async () => {
    console.log(`✅ Bot connecté: ${client.user.tag}`);

    try {
        for (const channelId of CHANNEL_IDS) {
            const channel = await client.channels.fetch(channelId);

            if (!channel) {
                console.error(`❌ Canal ${channelId} introuvable`);
                continue;
            }

            console.log(`📤 Envoi sur #${channel.name} (${channelId})...`);
            await postAnnouncement(channel);
            console.log(`✅ Annonce postée sur #${channel.name}`);

            // Pause entre les canaux
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log('\n🎉 Toutes les annonces ont été postées avec succès !');

    } catch (error) {
        console.error('❌ Erreur:', error);
    }

    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
