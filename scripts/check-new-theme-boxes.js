require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
    console.log('🔍 VÉRIFICATION DES MYSTERY BOXES\n');

    // Boxes du thème 141 (ezgezgrezge)
    const boxes = await db.queryAll(`
        SELECT id, theme_id, rarity, name, text_title, text_success, is_default
        FROM mystery_box_config
        WHERE theme_id = 141
        ORDER BY rarity, id
    `);

    console.log(`📦 BOXES DU THÈME 141 (${boxes.length} boxes):\n`);
    boxes.forEach(b => {
        console.log(`  #${b.id} | ${b.rarity.padEnd(10)} | ${(b.name || 'NULL').padEnd(25)} | default=${b.is_default}`);
        console.log(`         title: ${b.text_title || 'NULL'}`);
        console.log(`         success: ${b.text_success || 'NULL'}`);
        console.log('');
    });

    // Count par rareté
    console.log('\n📊 COUNT PAR RARETÉ POUR THÈME 141:');
    const counts = await db.queryAll(`
        SELECT rarity, COUNT(*) as cnt
        FROM mystery_box_config
        WHERE theme_id = 141
        GROUP BY rarity
        ORDER BY CASE rarity WHEN 'common' THEN 1 WHEN 'rare' THEN 2 WHEN 'epic' THEN 3 WHEN 'legendary' THEN 4 END
    `);
    counts.forEach(c => console.log(`  ${c.rarity}: ${c.cnt} box(es)`));

    // Voir s'il y a des boxes sans theme_id pour ce guild
    const orphans = await db.queryAll(`
        SELECT id, rarity, name, theme_id
        FROM mystery_box_config
        WHERE guild_id = '297309737135898624' AND theme_id IS NULL
    `);

    if (orphans.length > 0) {
        console.log(`\n⚠️ BOXES ORPHELINES (sans theme_id): ${orphans.length}`);
        orphans.forEach(b => console.log(`  #${b.id} | ${b.rarity} | ${b.name}`));
    }

    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
