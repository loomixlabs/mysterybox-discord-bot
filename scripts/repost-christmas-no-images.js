require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Configuration des serveurs
const SERVERS = [
    {
        guildId: '1182395170273099806',
        channelId: '1339571870755717120',
        theme: 'harry_potter'
    },
    {
        guildId: '1248028543389143070',
        channelId: '1248176835490091110',
        theme: 'classic'
    }
];

// Couleurs de Noël
const COLORS = {
    CHRISTMAS_RED: 0xC41E3A,
    CHRISTMAS_GREEN: 0x228B22,
    CHRISTMAS_GOLD: 0xFFD700,
    GRYFFINDOR: 0xAE0001
};

async function postHarryPotterChristmas(channel) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.GRYFFINDOR)
        .setTitle('🎄⚡ JOYEUX NOËL À POUDLARD ⚡🎄')
        .setDescription(
            `*La Grande Salle brille de mille chandelles flottantes...*\n` +
            `*Les fantômes chantent des cantiques ancestraux...*\n` +
            `*Et sous le sapin enchanté, des cadeaux vous attendent !*\n\n` +
            `───────────────────────────────\n\n` +
            `Chers sorciers et sorcières,\n\n` +
            `En cette **Nuit de Noël magique**, Dumbledore et le Père Noël\n` +
            `se sont associés pour vous offrir des présents enchantés !\n\n` +
            `Merci d'avoir parcouru les couloirs de Poudlard avec nous.\n` +
            `Votre magie illumine notre communauté chaque jour. ✨`
        )
        .addFields(
            {
                name: '🎁 Vos Cadeaux de Noël',
                value:
                    `\`\`\`\n` +
                    `🔑    Clé Commune       × 1\n` +
                    `🔑💎  Clé Rare          × 1\n` +
                    `🔑✨  Clé Épique        × 1\n` +
                    `🗝️👑  Clé Légendaire    × 1\n` +
                    `💎    Loomix           777\n` +
                    `\`\`\``,
                inline: false
            },
            {
                name: '✨ Comment récupérer vos cadeaux ?',
                value: `Tapez **\`/profile\`** puis **"Mes MysteryBox"** pour voir vos clés !`,
                inline: false
            }
        )
        .setFooter({ text: '⚡ « Noël est la seule magie que même les Moldus peuvent ressentir. » — Albus Dumbledore' })
        .setTimestamp();

    const embed2 = new EmbedBuilder()
        .setColor(COLORS.CHRISTMAS_GOLD)
        .setDescription(
            `## 🥂 Joyeux Réveillon de Noël ! 🥂\n\n` +
            `Que cette nuit soit remplie de **joie**, de **rires**\n` +
            `et de **moments précieux** avec ceux que vous aimez.\n\n` +
            `*Que la magie de Noël vous accompagne...*\n\n` +
            `🎄 **L'équipe Loomix Labs** 🎄`
        );

    await channel.send({ embeds: [embed] });
    await new Promise(r => setTimeout(r, 1000));
    await channel.send({ embeds: [embed2] });
}

async function postClassicChristmas(channel) {
    const embed = new EmbedBuilder()
        .setColor(COLORS.CHRISTMAS_RED)
        .setTitle('🎄✨ JOYEUX NOËL ! ✨🎄')
        .setDescription(
            `**Ho Ho Ho !** 🎅\n\n` +
            `Le Père Noël a pensé à chacun d'entre vous !\n\n` +
            `En cette **veille de Noël**, nous tenons à vous remercier\n` +
            `pour votre **fidélité** et votre **enthousiasme** tout au long de l'année.\n\n` +
            `Vous êtes une communauté exceptionnelle et nous sommes\n` +
            `fiers de partager cette aventure avec vous ! 💖`
        )
        .addFields(
            {
                name: '🎁 Vos Cadeaux de Noël',
                value:
                    `\`\`\`\n` +
                    `🔑    Clé Commune       × 1\n` +
                    `🔑💎  Clé Rare          × 1\n` +
                    `🔑✨  Clé Épique        × 1\n` +
                    `🗝️👑  Clé Légendaire    × 1\n` +
                    `💎    Loomix           777\n` +
                    `\`\`\``,
                inline: false
            },
            {
                name: '🔓 Comment les utiliser ?',
                value: `Tapez **\`/profile\`** → **"Mes MysteryBox"** pour ouvrir vos coffres !`,
                inline: false
            }
        )
        .setFooter({ text: '777 — Le chiffre porte-bonheur pour une année magique !' })
        .setTimestamp();

    const embed2 = new EmbedBuilder()
        .setColor(COLORS.CHRISTMAS_GREEN)
        .setDescription(
            `## 🥂 Joyeux Réveillon ! 🥂\n\n` +
            `Passez une **merveilleuse soirée** entourés de ceux que vous aimez.\n\n` +
            `Que Noël vous apporte **bonheur**, **santé** et **prospérité** !\n\n` +
            `🎄🎁 **L'équipe Loomix Labs** 🎁🎄`
        );

    await channel.send({ embeds: [embed] });
    await new Promise(r => setTimeout(r, 1000));
    await channel.send({ embeds: [embed2] });
}

client.once('ready', async () => {
    console.log(`✅ Bot connecté: ${client.user.tag}\n`);

    try {
        for (const server of SERVERS) {
            const channel = await client.channels.fetch(server.channelId);

            if (!channel) {
                console.error(`❌ Canal ${server.channelId} introuvable`);
                continue;
            }

            console.log(`📤 Envoi sur #${channel.name}...`);

            if (server.theme === 'harry_potter') {
                await postHarryPotterChristmas(channel);
            } else {
                await postClassicChristmas(channel);
            }

            console.log(`✅ Annonce postée sur #${channel.name}`);
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log('\n🎄🎁 ANNONCES DE NOËL REPOSTÉES (sans images) ! 🎁🎄');

    } catch (error) {
        console.error('❌ Erreur:', error);
    }

    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
