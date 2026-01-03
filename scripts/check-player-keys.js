require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
    const discordId = '297307186307006464';

    // Trouver le joueur dans tous les guilds
    const players = await db.queryAll(
        'SELECT id, guild_id, username FROM players WHERE discord_id = $1',
        [discordId]
    );

    console.log('👤 Joueurs trouvés pour discord_id', discordId + ':');
    for (const p of players) {
        console.log('   - Player ID:', p.id, '| Guild:', p.guild_id, '| Username:', p.username);

        // Vérifier les clés pour ce joueur
        const keys = await db.queryAll(
            'SELECT rarity, credits FROM player_mystery_box_credits WHERE player_id = $1 AND guild_id = $2',
            [p.id, p.guild_id]
        );
        if (keys.length > 0) {
            console.log('     Clés:', keys.map(k => k.rarity + '=' + k.credits).join(', '));
        } else {
            console.log('     Clés: AUCUNE');
        }
    }

    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
