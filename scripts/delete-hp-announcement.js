require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const CHANNEL_IDS = ['1451672205791334451', '1339571870755717120'];

client.once('ready', async () => {
    console.log(`✅ Bot connecté: ${client.user.tag}`);

    try {
        for (const channelId of CHANNEL_IDS) {
            const channel = await client.channels.fetch(channelId);

            if (!channel) {
                console.error(`❌ Canal ${channelId} introuvable`);
                continue;
            }

            console.log(`🔍 Recherche des messages sur #${channel.name}...`);

            // Récupérer les 20 derniers messages
            const messages = await channel.messages.fetch({ limit: 20 });

            // Filtrer les messages du bot (les 6 embeds récents)
            const botMessages = messages.filter(m => m.author.id === client.user.id);

            console.log(`🗑️ ${botMessages.size} message(s) du bot trouvé(s)`);

            for (const [id, msg] of botMessages) {
                await msg.delete();
                console.log(`   ✅ Message ${id} supprimé`);
                await new Promise(r => setTimeout(r, 500));
            }

            console.log(`✅ Nettoyage terminé sur #${channel.name}\n`);
        }

        console.log('🎉 Tous les messages ont été supprimés !');

    } catch (error) {
        console.error('❌ Erreur:', error);
    }

    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
