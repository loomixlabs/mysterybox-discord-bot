require('dotenv').config();
const db = require('../utils/database-pg');

async function analyzeOpeningSystem() {
    console.log('='.repeat(80));
    console.log('🔍 ANALYSE SYSTÈME D\'OUVERTURE MYSTERY BOX PAR RARETÉ');
    console.log('='.repeat(80));

    // 1. Structure de la table
    console.log('\n📋 1. STRUCTURE DE LA TABLE mystery_box_config\n');
    const cols = await db.queryAll(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'mystery_box_config'
        ORDER BY ordinal_position
    `);

    cols.forEach(c => {
        const nullable = c.is_nullable === 'YES' ? '✓' : '✗';
        const def = c.column_default ? c.column_default.substring(0, 30) : 'NULL';
        console.log(`  ${c.column_name.padEnd(30)} | ${c.data_type.padEnd(15)} | nullable: ${nullable} | default: ${def}`);
    });

    // 2. Exemple de données actuelles (une box par rareté)
    console.log('\n📦 2. DONNÉES ACTUELLES (exemple par rareté)\n');
    const boxes = await db.queryAll(`
        SELECT *
        FROM mystery_box_config
        WHERE guild_id = '1248028543389143070' AND is_default = true
        ORDER BY
            CASE rarity
                WHEN 'common' THEN 1
                WHEN 'rare' THEN 2
                WHEN 'epic' THEN 3
                WHEN 'legendary' THEN 4
            END
        LIMIT 4
    `);

    for (const box of boxes) {
        console.log(`\n  📦 ${box.rarity.toUpperCase()} (ID: ${box.id})`);
        console.log(`  ${'─'.repeat(60)}`);

        // Grouper par catégorie
        const appearance = {
            name: box.name,
            emoji: box.emoji,
            color: box.color,
            image_closed: box.image_closed,
            image_opening: box.image_opening,
            image_opened: box.image_opened,
            image_empty: box.image_empty
        };

        const texts = {
            text_title: box.text_title,
            text_description: box.text_description,
            text_intro: box.text_intro,
            text_success: box.text_success,
            text_empty: box.text_empty
        };

        const animation = {
            animation_type: box.animation_type,
            animation_duration: box.animation_duration
        };

        const probabilities = {
            prob_collectible: box.prob_collectible,
            prob_super_bonus: box.prob_super_bonus
        };

        const upgrade = {
            rarity_upgrade_rare: box.rarity_upgrade_rare,
            rarity_upgrade_epic: box.rarity_upgrade_epic,
            rarity_upgrade_legendary: box.rarity_upgrade_legendary
        };

        const pity = {
            pity_enabled: box.pity_enabled,
            pity_max_count: box.pity_max_count
        };

        const other = {
            rewards_count: box.rewards_count,
            is_enabled: box.is_enabled,
            is_default: box.is_default
        };

        console.log(`  🎨 APPARENCE:`);
        Object.entries(appearance).forEach(([k, v]) => {
            const status = v === null ? '❌ NULL' : (v ? '✅' : '⚠️ vide');
            const val = v ? (typeof v === 'string' && v.length > 40 ? v.substring(0, 40) + '...' : v) : '';
            console.log(`     ${k.padEnd(20)}: ${status} ${val}`);
        });

        console.log(`  📝 TEXTES:`);
        Object.entries(texts).forEach(([k, v]) => {
            const status = v === null ? '❌ NULL' : (v ? '✅' : '⚠️ vide');
            const val = v ? (typeof v === 'string' && v.length > 35 ? v.substring(0, 35) + '...' : v) : '';
            console.log(`     ${k.padEnd(20)}: ${status} ${val}`);
        });

        console.log(`  🎬 ANIMATION:`);
        Object.entries(animation).forEach(([k, v]) => {
            const status = v === null ? '❌ NULL' : '✅';
            console.log(`     ${k.padEnd(20)}: ${status} ${v || ''}`);
        });

        console.log(`  📊 PROBABILITÉS:`);
        Object.entries(probabilities).forEach(([k, v]) => {
            console.log(`     ${k.padEnd(20)}: ${v}%`);
        });

        console.log(`  ⬆️ UPGRADE:`);
        Object.entries(upgrade).forEach(([k, v]) => {
            console.log(`     ${k.padEnd(25)}: ${v || 0}%`);
        });

        console.log(`  🎰 PITY SYSTEM:`);
        Object.entries(pity).forEach(([k, v]) => {
            console.log(`     ${k.padEnd(20)}: ${v === null ? 'NULL' : v}`);
        });

        console.log(`  ⚙️ AUTRES:`);
        Object.entries(other).forEach(([k, v]) => {
            console.log(`     ${k.padEnd(20)}: ${v}`);
        });
    }

    // 3. Résumé des NULL
    console.log('\n\n⚠️ 3. RÉSUMÉ DES VALEURS NULL PAR COLONNE\n');
    const nullCounts = await db.queryAll(`
        SELECT
            COUNT(*) FILTER (WHERE name IS NULL) as name_null,
            COUNT(*) FILTER (WHERE emoji IS NULL) as emoji_null,
            COUNT(*) FILTER (WHERE color IS NULL) as color_null,
            COUNT(*) FILTER (WHERE image_closed IS NULL) as image_closed_null,
            COUNT(*) FILTER (WHERE image_opening IS NULL) as image_opening_null,
            COUNT(*) FILTER (WHERE image_opened IS NULL) as image_opened_null,
            COUNT(*) FILTER (WHERE image_empty IS NULL) as image_empty_null,
            COUNT(*) FILTER (WHERE text_title IS NULL) as text_title_null,
            COUNT(*) FILTER (WHERE text_description IS NULL) as text_description_null,
            COUNT(*) FILTER (WHERE text_intro IS NULL) as text_intro_null,
            COUNT(*) FILTER (WHERE text_success IS NULL) as text_success_null,
            COUNT(*) FILTER (WHERE text_empty IS NULL) as text_empty_null,
            COUNT(*) FILTER (WHERE animation_type IS NULL) as animation_type_null,
            COUNT(*) FILTER (WHERE animation_duration IS NULL) as animation_duration_null,
            COUNT(*) as total
        FROM mystery_box_config
    `);

    const nc = nullCounts[0];
    console.log(`  Total boxes: ${nc.total}`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  name:              ${nc.name_null} NULL`);
    console.log(`  emoji:             ${nc.emoji_null} NULL`);
    console.log(`  color:             ${nc.color_null} NULL`);
    console.log(`  image_closed:      ${nc.image_closed_null} NULL`);
    console.log(`  image_opening:     ${nc.image_opening_null} NULL`);
    console.log(`  image_opened:      ${nc.image_opened_null} NULL`);
    console.log(`  image_empty:       ${nc.image_empty_null} NULL`);
    console.log(`  text_title:        ${nc.text_title_null} NULL`);
    console.log(`  text_description:  ${nc.text_description_null} NULL`);
    console.log(`  text_intro:        ${nc.text_intro_null} NULL`);
    console.log(`  text_success:      ${nc.text_success_null} NULL`);
    console.log(`  text_empty:        ${nc.text_empty_null} NULL`);
    console.log(`  animation_type:    ${nc.animation_type_null} NULL`);
    console.log(`  animation_duration: ${nc.animation_duration_null} NULL`);

    process.exit(0);
}

analyzeOpeningSystem().catch(e => {
    console.error('Erreur:', e);
    process.exit(1);
});
