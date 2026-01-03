require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
    const guildId = '297309737135898624';
    const theme = await db.getActiveTheme(guildId);
    console.log('Thème actif:', theme?.name, 'ID:', theme?.id);

    const data = await db.queryAll(`
        SELECT day_number, reward_type, reward_rarity, reward_amount, display_name, display_emoji
        FROM daily_rewards_config
        WHERE guild_id = $1 AND theme_id = $2
        ORDER BY day_number
    `, [guildId, theme.id]);

    console.log('\nDonnées (' + data.length + ' entrées):');
    data.forEach(d => {
        console.log('J' + d.day_number + ':', d.reward_type, d.reward_rarity || '-', 'x' + d.reward_amount, '| name:', d.display_name, '| emoji:', d.display_emoji);
    });

    // Vérifier les doublons par day_number
    const duplicates = await db.queryAll(`
        SELECT day_number, COUNT(*) as count
        FROM daily_rewards_config
        WHERE guild_id = $1 AND theme_id = $2
        GROUP BY day_number
        HAVING COUNT(*) > 1
        ORDER BY day_number
    `, [guildId, theme.id]);

    if (duplicates.length > 0) {
        console.log('\n⚠️ DOUBLONS DÉTECTÉS:');
        duplicates.forEach(d => console.log('Jour', d.day_number, ':', d.count, 'entrées'));
    } else {
        console.log('\n✅ Aucun doublon');
    }

    process.exit(0);
}
check();
