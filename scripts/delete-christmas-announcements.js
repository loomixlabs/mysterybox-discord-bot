require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Canaux des annonces de Noël
const CHANNEL_IDS = ['1339571870755717120', '1248176835490091110'];

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

            // Récupérer les 10 derniers messages
            const messages = await channel.messages.fetch({ limit: 10 });

            // Filtrer les messages du bot (les 2 embeds de Noël)
            const botMessages = messages.filter(m => m.author.id === client.user.id);

            console.log(`🗑️ ${botMessages.size} message(s) du bot trouvé(s)`);

            for (const [id, msg] of botMessages) {
                await msg.delete();
                console.log(`   ✅ Message ${id} supprimé`);
                await new Promise(r => setTimeout(r, 500));
            }

            console.log(`✅ Nettoyage terminé sur #${channel.name}\n`);
        }

        console.log('🎉 Tous les messages de Noël ont été supprimés !');

    } catch (error) {
        console.error('❌ Erreur:', error);
    }

    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
