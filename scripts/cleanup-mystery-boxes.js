require('dotenv').config();
const db = require('../utils/database-pg');

async function cleanupMysteryBoxes() {
    try {
        console.log('🧹 NETTOYAGE MYSTERY BOXES\n');
        console.log('='.repeat(60));

        // Voir tous les thèmes
        const themes = await db.queryAll('SELECT id, guild_id, name, is_active FROM themes ORDER BY guild_id, is_active DESC');
        console.log('\n📋 Thèmes:');
        themes.forEach(t => {
            const status = t.is_active ? '✅' : '  ';
            console.log(`  ${status} Guild ${t.guild_id.substring(0,12)}... - ${t.name} (ID: ${t.id})`);
        });

        // Voir toutes les boxes
        const boxes = await db.queryAll(`
            SELECT mb.id, mb.guild_id, mb.theme_id, mb.rarity, mb.name, mb.is_default, mb.is_enabled, t.name as theme_name
            FROM mystery_box_config mb
            LEFT JOIN themes t ON mb.theme_id = t.id
            ORDER BY mb.guild_id, mb.theme_id, mb.rarity, mb.is_default DESC
        `);

        console.log('\n📦 Boxes par thème:');
        let currentTheme = null;
        let toDelete = [];
        boxes.forEach(b => {
            if (b.theme_id !== currentTheme) {
                currentTheme = b.theme_id;
                console.log(`\n  🎨 Thème: ${b.theme_name || 'NULL'} (ID: ${b.theme_id})`);
            }
            const def = b.is_default ? '🌟' : '  ';
            const status = b.is_enabled ? '🟢' : '🔴';
            console.log(`    ${def} ${status} #${b.id} ${b.rarity} - ${b.name}`);

            if (!b.is_default) {
                toDelete.push(b.id);
            }
        });

        console.log('\n' + '='.repeat(60));
        console.log(`\n🗑️ ${toDelete.length} box(es) NON-DEFAULT à supprimer:`);
        console.log(`   IDs: ${toDelete.join(', ')}`);

        if (toDelete.length > 0) {
            // Supprimer les boxes non-default
            const result = await db.query(`
                DELETE FROM mystery_box_config
                WHERE id = ANY($1::int[])
            `, [toDelete]);

            console.log(`\n✅ ${result.rowCount} box(es) supprimée(s)`);
        } else {
            console.log('\n✅ Aucune box à supprimer');
        }

        // Vérification finale
        const remaining = await db.queryAll(`
            SELECT rarity, COUNT(*) as count
            FROM mystery_box_config
            GROUP BY rarity
            ORDER BY CASE rarity
                WHEN 'common' THEN 1
                WHEN 'rare' THEN 2
                WHEN 'epic' THEN 3
                WHEN 'legendary' THEN 4
            END
        `);

        console.log('\n📊 Boxes restantes:');
        remaining.forEach(r => console.log(`   ${r.rarity}: ${r.count}`));

        console.log('\n✅ NETTOYAGE TERMINÉ!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

cleanupMysteryBoxes();
