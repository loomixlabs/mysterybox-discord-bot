require('dotenv').config();
const db = require('../utils/database-pg');

async function addKeys() {
    const discordId = '297307186307006464';

    // Trouver le joueur dans tous les guilds
    const players = await db.queryAll(
        'SELECT id, guild_id, username FROM players WHERE discord_id = $1',
        [discordId]
    );

    console.log('👤 Ajout de 20 clés de chaque rareté pour tous les profils:\n');

    const rarities = ['common', 'rare', 'epic', 'legendary'];

    for (const p of players) {
        console.log(`📍 Guild ${p.guild_id} (Player ID: ${p.id})`);

        for (const rarity of rarities) {
            await db.addMysteryBoxCredits(p.guild_id, p.id, rarity, 20, 'admin', 'Ajout manuel via script');
        }

        // Vérifier le résultat
        const keys = await db.getMysteryBoxCredits(p.guild_id, p.id);
        console.log('   Résultat:', keys);
        console.log('');
    }

    process.exit(0);
}

addKeys().catch(e => { console.error(e); process.exit(1); });
