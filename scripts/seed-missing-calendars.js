/**
 * Script pour insérer les calendriers manquants
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function seedMissingCalendars() {
    console.log('📅 Insertion des calendriers manquants...\n');

    // Thèmes sans calendrier
    const missingThemes = await db.query(`
        SELECT t.id as theme_id, t.guild_id, t.name, t.duration_days,
               (SELECT COUNT(*) FROM daily_rewards_config drc WHERE drc.theme_id = t.id) as days_count
        FROM themes t
        ORDER BY t.id
    `);

    let added = 0;
    for (const theme of missingThemes) {
        if (parseInt(theme.days_count) === 0) {
            const duration = theme.duration_days || 30;
            console.log(`  Ajout calendrier pour "${theme.name}" (${duration} jours)...`);

            await db.query('SELECT insert_default_daily_rewards($1, $2, $3)', [
                theme.guild_id, theme.theme_id, duration
            ]);

            const count = await db.queryOne('SELECT COUNT(*) as count FROM daily_rewards_config WHERE theme_id = $1', [theme.theme_id]);
            console.log(`    ✅ ${count.count} jours créés`);
            added++;
        }
    }

    if (added === 0) {
        console.log('  ✅ Tous les thèmes ont déjà un calendrier');
    }

    console.log('\n✅ Terminé!');
    process.exit(0);
}

seedMissingCalendars().catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
});
