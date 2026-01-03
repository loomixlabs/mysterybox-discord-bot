require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
    console.log('🔍 AUDIT DES MYSTERY BOXES PAR THÈME\n');
    console.log('='.repeat(80));

    const guildId = '297309737135898624';

    // Récupérer tous les thèmes
    const themes = await db.queryAll(`
        SELECT id, name, is_active
        FROM themes
        WHERE guild_id = $1
        ORDER BY is_active DESC, id
    `, [guildId]);

    console.log(`\n📋 ${themes.length} thème(s) trouvé(s) pour guild ${guildId}\n`);

    // Récupérer toutes les boxes
    const allBoxes = await db.queryAll(`
        SELECT
            mbc.id,
            mbc.rarity,
            mbc.theme_id,
            mbc.name,
            t.name as theme_name,
            t.is_active as theme_is_active
        FROM mystery_box_config mbc
        LEFT JOIN themes t ON mbc.theme_id = t.id
        WHERE mbc.guild_id = $1
        ORDER BY mbc.theme_id NULLS FIRST, mbc.rarity
    `, [guildId]);

    console.log(`📦 ${allBoxes.length} mystery box(es) total\n`);

    // Boxes orphelines (sans theme_id)
    const orphans = allBoxes.filter(b => !b.theme_id);
    if (orphans.length > 0) {
        console.log(`⚠️  ${orphans.length} BOX(ES) ORPHELINE(S) (theme_id = NULL):`);
        orphans.forEach(b => console.log(`   - ID: ${b.id} | ${b.rarity} | "${b.name}"`));
        console.log('');
    }

    // Stats par thème
    for (const theme of themes) {
        const themeBoxes = allBoxes.filter(b => b.theme_id === theme.id);
        const activeMarker = theme.is_active ? '🟢 ACTIF' : '⚪';

        console.log(`${activeMarker} Thème #${theme.id}: ${theme.name}`);
        console.log(`   Boxes: ${themeBoxes.length}`);

        const byRarity = {
            common: themeBoxes.filter(b => b.rarity === 'common').length,
            rare: themeBoxes.filter(b => b.rarity === 'rare').length,
            epic: themeBoxes.filter(b => b.rarity === 'epic').length,
            legendary: themeBoxes.filter(b => b.rarity === 'legendary').length
        };

        console.log(`   - common: ${byRarity.common}, rare: ${byRarity.rare}, epic: ${byRarity.epic}, legendary: ${byRarity.legendary}`);

        // Alerter si plus d'1 box par rareté
        for (const [rarity, count] of Object.entries(byRarity)) {
            if (count > 1) {
                console.log(`   ⚠️  DOUBLON: ${count} boxes ${rarity}!`);
            }
        }
        console.log('');
    }

    // Résumé des problèmes
    console.log('='.repeat(80));
    console.log('\n📊 RÉSUMÉ:');
    console.log(`   Total boxes: ${allBoxes.length}`);
    console.log(`   Orphelines: ${orphans.length}`);

    // Check le thème actif
    const activeTheme = themes.find(t => t.is_active);
    if (activeTheme) {
        const activeBoxes = allBoxes.filter(b => b.theme_id === activeTheme.id);
        console.log(`   Boxes du thème actif (#${activeTheme.id}): ${activeBoxes.length}`);
    }

    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
