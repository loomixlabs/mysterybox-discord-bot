require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
    const guildId = '297309737135898624';
    const theme = await db.getActiveTheme(guildId);
    console.log('Theme:', theme?.name, 'ID:', theme?.id);

    const calendar = await db.queryAll(`
        SELECT day_number, reward_type, reward_rarity, reward_amount, display_name, display_emoji
        FROM daily_rewards_config
        WHERE guild_id = $1 AND theme_id = $2
        ORDER BY day_number
        LIMIT 15
    `, [guildId, theme.id]);

    console.log('\nPremiers 15 jours:');
    calendar.forEach(c => {
        console.log('J' + c.day_number + ':', c.reward_type, c.reward_rarity || '-', 'x' + c.reward_amount, '| emoji:', c.display_emoji || '-');
    });

    // Compter les entrées par jour
    const countByDay = await db.queryAll(`
        SELECT day_number, COUNT(*) as count
        FROM daily_rewards_config
        WHERE guild_id = $1 AND theme_id = $2
        GROUP BY day_number
        HAVING COUNT(*) > 1
        ORDER BY day_number
    `, [guildId, theme.id]);

    if (countByDay.length > 0) {
        console.log('\n⚠️ Jours avec plusieurs entrées:');
        countByDay.forEach(c => console.log('J' + c.day_number + ':', c.count, 'entrées'));
    } else {
        console.log('\n✅ Aucun doublon détecté');
    }

    process.exit(0);
}
check();
