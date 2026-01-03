require('dotenv').config();
const db = require('../utils/database-pg');

async function analyzeMysteryBoxConfig() {
    try {
        console.log('📊 ANALYSE COMPLÈTE DE mystery_box_config\n');
        console.log('='.repeat(80));

        // 1. Structure de la table
        const columns = await db.queryAll(`
            SELECT
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'mystery_box_config'
            ORDER BY ordinal_position
        `);

        console.log('\n📋 COLONNES DE LA TABLE:\n');
        columns.forEach((col, i) => {
            const nullable = col.is_nullable === 'YES' ? '✅ NULL' : '❌ NOT NULL';
            const defaultVal = col.column_default ? `= ${col.column_default}` : '';
            const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
            console.log(`${String(i+1).padStart(2)}. ${col.column_name.padEnd(35)} ${col.data_type}${maxLen.padEnd(10)} ${nullable} ${defaultVal}`);
        });

        // 2. Données actuelles
        const configs = await db.queryAll(`
            SELECT * FROM mystery_box_config
            ORDER BY guild_id, rarity
        `);

        console.log(`\n\n📦 CONFIGURATIONS EXISTANTES: ${configs.length}\n`);

        if (configs.length > 0) {
            // Grouper par guild
            const byGuild = {};
            configs.forEach(c => {
                if (!byGuild[c.guild_id]) byGuild[c.guild_id] = [];
                byGuild[c.guild_id].push(c);
            });

            for (const [guildId, guildConfigs] of Object.entries(byGuild)) {
                console.log(`\n🏠 Guild: ${guildId}`);
                console.log('-'.repeat(60));
                guildConfigs.forEach(c => {
                    console.log(`  📦 [${c.rarity.toUpperCase()}] ${c.name || 'Sans nom'}`);
                    console.log(`     - Probabilités: Collectible ${c.prob_collectible}% | Super Bonus ${c.prob_super_bonus}%`);
                    console.log(`     - Animation: ${c.animation_duration}ms`);
                    console.log(`     - Pity: enabled=${c.pity_enabled}, threshold=${c.pity_threshold}, boost=${c.pity_boost_percentage}%`);
                    console.log(`     - Images: opening=${c.opening_image ? '✅' : '❌'}, reveal=${c.reveal_image ? '✅' : '❌'}`);
                });
            }
        }

        // 3. Contraintes
        const constraints = await db.queryAll(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'mystery_box_config'::regclass
        `);

        console.log(`\n\n🔒 CONTRAINTES:\n`);
        constraints.forEach(c => {
            console.log(`  • ${c.conname}:`);
            console.log(`    ${c.definition}`);
        });

        // 4. Afficher un exemple complet d'une config
        if (configs.length > 0) {
            console.log('\n\n📋 EXEMPLE COMPLET D\'UNE CONFIG (première trouvée):\n');
            const example = configs[0];
            Object.entries(example).forEach(([key, value]) => {
                const displayValue = value === null ? 'NULL' :
                                   typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' :
                                   value;
                console.log(`  ${key.padEnd(30)}: ${displayValue}`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

analyzeMysteryBoxConfig();
