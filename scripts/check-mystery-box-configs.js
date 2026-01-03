require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
    console.log('🔍 AUDIT DES CONFIGURATIONS MYSTERY BOX PAR THÈME\n');
    console.log('='.repeat(80));

    // Récupérer tous les thèmes
    const themes = await db.queryAll(`
        SELECT id, name, guild_id, is_active
        FROM themes
        ORDER BY guild_id, id
    `);

    console.log(`\n📋 ${themes.length} thème(s) trouvé(s)\n`);

    const rarities = ['common', 'rare', 'epic', 'legendary'];
    const missingConfigs = [];

    for (const theme of themes) {
        // Compter les boxes configurées pour ce thème
        const boxes = await db.queryAll(`
            SELECT rarity, COUNT(*) as count
            FROM mystery_box_config
            WHERE theme_id = $1
            GROUP BY rarity
        `, [theme.id]);

        const boxMap = {};
        boxes.forEach(b => boxMap[b.rarity] = parseInt(b.count));

        const missing = rarities.filter(r => !boxMap[r]);
        const status = missing.length === 0 ? '✅' : '❌';

        console.log(`${status} Thème #${theme.id}: ${theme.name}`);
        console.log(`   Guild: ${theme.guild_id} | Actif: ${theme.is_active ? 'Oui' : 'Non'}`);
        console.log(`   Boxes: common=${boxMap.common || 0}, rare=${boxMap.rare || 0}, epic=${boxMap.epic || 0}, legendary=${boxMap.legendary || 0}`);

        if (missing.length > 0) {
            console.log(`   ⚠️  MANQUANT: ${missing.join(', ')}`);
            missingConfigs.push({
                themeId: theme.id,
                themeName: theme.name,
                guildId: theme.guild_id,
                missing: missing
            });
        }
        console.log('');
    }

    console.log('='.repeat(80));
    console.log(`\n📊 RÉSUMÉ:`);
    console.log(`   Thèmes complets: ${themes.length - missingConfigs.length}/${themes.length}`);
    console.log(`   Thèmes incomplets: ${missingConfigs.length}`);

    if (missingConfigs.length > 0) {
        console.log(`\n❌ THÈMES À CONFIGURER:`);
        missingConfigs.forEach(t => {
            console.log(`   - #${t.themeId} "${t.themeName}" → manque: ${t.missing.join(', ')}`);
        });
    }

    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
