require('dotenv').config();
const db = require('../utils/database-pg');

async function migrateMysteryBoxConfig() {
    try {
        console.log('🔧 MIGRATION: mystery_box_config\n');
        console.log('='.repeat(60));

        // 1. Ajouter colonne rarity_upgrade_rare (Common → Rare)
        console.log('\n1️⃣ Ajout colonne rarity_upgrade_rare...');
        try {
            await db.query(`
                ALTER TABLE mystery_box_config
                ADD COLUMN IF NOT EXISTS rarity_upgrade_rare INTEGER DEFAULT 0
            `);
            console.log('   ✅ rarity_upgrade_rare ajoutée');
        } catch (e) {
            if (e.code === '42701') {
                console.log('   ⏭️  rarity_upgrade_rare existe déjà');
            } else throw e;
        }

        // 2. Ajouter colonne is_default
        console.log('\n2️⃣ Ajout colonne is_default...');
        try {
            await db.query(`
                ALTER TABLE mystery_box_config
                ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE
            `);
            console.log('   ✅ is_default ajoutée');
        } catch (e) {
            if (e.code === '42701') {
                console.log('   ⏭️  is_default existe déjà');
            } else throw e;
        }

        // 3. Ajouter colonne is_enabled pour activer/désactiver une box
        console.log('\n3️⃣ Ajout colonne is_enabled...');
        try {
            await db.query(`
                ALTER TABLE mystery_box_config
                ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE
            `);
            console.log('   ✅ is_enabled ajoutée');
        } catch (e) {
            if (e.code === '42701') {
                console.log('   ⏭️  is_enabled existe déjà');
            } else throw e;
        }

        // 4. Supprimer la contrainte UNIQUE sur (guild_id, theme_id, rarity)
        // pour permettre plusieurs boxes par rareté
        console.log('\n4️⃣ Modification contrainte UNIQUE...');
        try {
            // D'abord vérifier si la contrainte existe
            const constraint = await db.queryOne(`
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'mystery_box_config'::regclass
                AND conname = 'mystery_box_config_guild_theme_rarity_key'
            `);

            if (constraint) {
                await db.query(`
                    ALTER TABLE mystery_box_config
                    DROP CONSTRAINT mystery_box_config_guild_theme_rarity_key
                `);
                console.log('   ✅ Contrainte UNIQUE supprimée (plusieurs boxes par rareté maintenant possibles)');
            } else {
                console.log('   ⏭️  Contrainte déjà supprimée');
            }
        } catch (e) {
            console.log('   ⚠️  Erreur contrainte:', e.message);
        }

        // 5. Modifier la contrainte CHECK pour permettre seulement collectible + super_bonus
        console.log('\n5️⃣ Modification contrainte CHECK (prob = 100)...');
        try {
            // Supprimer l'ancienne contrainte
            await db.query(`
                ALTER TABLE mystery_box_config
                DROP CONSTRAINT IF EXISTS mystery_box_config_check
            `);

            // Ajouter nouvelle contrainte (seulement collectible + super_bonus = 100)
            await db.query(`
                ALTER TABLE mystery_box_config
                ADD CONSTRAINT mystery_box_config_prob_check
                CHECK ((prob_collectible + prob_super_bonus) <= 100)
            `);
            console.log('   ✅ Nouvelle contrainte: prob_collectible + prob_super_bonus <= 100');
        } catch (e) {
            console.log('   ⚠️  Erreur contrainte CHECK:', e.message);
        }

        // 6. Mettre prob_mission et prob_trap à 0 pour toutes les boxes existantes
        console.log('\n6️⃣ Reset prob_mission et prob_trap à 0...');
        const updated = await db.query(`
            UPDATE mystery_box_config
            SET prob_mission = 0, prob_trap = 0
            WHERE prob_mission > 0 OR prob_trap > 0
        `);
        console.log(`   ✅ ${updated.rowCount || 0} box(es) mise(s) à jour`);

        // 7. Marquer une box par défaut par rareté par guild (la première trouvée)
        console.log('\n7️⃣ Marquage des boxes par défaut...');
        const guilds = await db.queryAll(`
            SELECT DISTINCT guild_id FROM mystery_box_config
        `);

        for (const guild of guilds) {
            for (const rarity of ['common', 'rare', 'epic', 'legendary']) {
                // Vérifier s'il y a déjà une box par défaut
                const hasDefault = await db.queryOne(`
                    SELECT id FROM mystery_box_config
                    WHERE guild_id = $1 AND rarity = $2 AND is_default = TRUE
                `, [guild.guild_id, rarity]);

                if (!hasDefault) {
                    // Marquer la première box comme défaut
                    await db.query(`
                        UPDATE mystery_box_config
                        SET is_default = TRUE
                        WHERE id = (
                            SELECT id FROM mystery_box_config
                            WHERE guild_id = $1 AND rarity = $2
                            ORDER BY id ASC
                            LIMIT 1
                        )
                    `, [guild.guild_id, rarity]);
                }
            }
        }
        console.log(`   ✅ Boxes par défaut marquées pour ${guilds.length} guild(s)`);

        // 8. Vérification finale
        console.log('\n' + '='.repeat(60));
        console.log('📋 VÉRIFICATION FINALE\n');

        const columns = await db.queryAll(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'mystery_box_config'
            AND column_name IN ('rarity_upgrade_rare', 'rarity_upgrade_epic', 'rarity_upgrade_legendary', 'is_default', 'is_enabled')
            ORDER BY column_name
        `);
        console.log('Colonnes upgrade/config:');
        columns.forEach(c => console.log(`  ✅ ${c.column_name}: ${c.data_type} = ${c.column_default}`));

        const boxCount = await db.queryOne(`
            SELECT COUNT(*) as total,
                   COUNT(*) FILTER (WHERE is_default = TRUE) as defaults,
                   COUNT(*) FILTER (WHERE is_enabled = TRUE) as enabled
            FROM mystery_box_config
        `);
        console.log(`\n📦 Boxes: ${boxCount.total} total | ${boxCount.defaults} par défaut | ${boxCount.enabled} activées`);

        console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur migration:', error);
        process.exit(1);
    }
}

migrateMysteryBoxConfig();
