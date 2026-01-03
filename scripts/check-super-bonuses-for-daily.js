require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
    const guildId = '297309737135898624';

    console.log('='.repeat(60));
    console.log('VÉRIFICATION SUPER BONUSES POUR DAILY REWARDS');
    console.log('='.repeat(60));

    // 1. Thème actif
    const theme = await db.getActiveTheme(guildId);
    console.log('\n📋 Thème actif:', theme?.name, '| ID:', theme?.id);

    // 2. Tous les super bonuses du guild
    const allBonuses = await db.queryAll(`
        SELECT id, name, effect_type, icon, is_enabled, theme_id
        FROM super_bonuses
        WHERE guild_id = $1
        ORDER BY name
    `, [guildId]);

    console.log('\n📋 Tous les super bonuses du guild (' + allBonuses.length + '):');
    allBonuses.forEach(b => {
        console.log(`  - ID ${b.id}: ${b.name} | enabled=${b.is_enabled} | theme_id=${b.theme_id} | effect=${b.effect_type}`);
    });

    // 3. Super bonuses du thème actif
    const themeBonuses = await db.queryAll(`
        SELECT id, name, effect_type, icon, is_enabled
        FROM super_bonuses
        WHERE guild_id = $1 AND theme_id = $2
        ORDER BY name
    `, [guildId, theme?.id]);

    console.log('\n📋 Super bonuses du thème actif (' + themeBonuses.length + '):');
    themeBonuses.forEach(b => {
        console.log(`  - ID ${b.id}: ${b.name} | enabled=${b.is_enabled}`);
    });

    // 4. Super bonuses activés du thème actif
    const enabledBonuses = await db.queryAll(`
        SELECT id, name, effect_type, icon, is_enabled
        FROM super_bonuses
        WHERE guild_id = $1 AND theme_id = $2 AND is_enabled = true
        ORDER BY name
    `, [guildId, theme?.id]);

    console.log('\n📋 Super bonuses ACTIVÉS du thème actif (' + enabledBonuses.length + '):');
    enabledBonuses.forEach(b => {
        console.log(`  - ID ${b.id}: ${b.name}`);
    });

    // 5. Vérifier la structure de la table
    const columns = await db.queryAll(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'super_bonuses'
        ORDER BY ordinal_position
    `);

    console.log('\n📋 Structure de super_bonuses:');
    columns.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));

    process.exit(0);
}

check().catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
});
