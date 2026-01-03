require('dotenv').config();
const db = require('../utils/database-pg');

async function dropMissionTrapColumns() {
    try {
        console.log('🗑️  SUPPRESSION COLONNES prob_mission et prob_trap\n');
        console.log('='.repeat(60));

        // 1. Vérifier l'existence des colonnes
        console.log('\n1️⃣ Vérification des colonnes existantes...');
        const columns = await db.queryAll(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'mystery_box_config'
            AND column_name IN ('prob_mission', 'prob_trap')
        `);

        if (columns.length === 0) {
            console.log('   ✅ Colonnes déjà supprimées');
            process.exit(0);
            return;
        }

        console.log(`   📋 Colonnes trouvées: ${columns.map(c => c.column_name).join(', ')}`);

        // 2. Supprimer les contraintes CHECK liées si elles existent
        console.log('\n2️⃣ Suppression des contraintes CHECK obsolètes...');
        const constraints = await db.queryAll(`
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'mystery_box_config'::regclass
            AND contype = 'c'
            AND (
                pg_get_constraintdef(oid) LIKE '%prob_mission%'
                OR pg_get_constraintdef(oid) LIKE '%prob_trap%'
            )
        `);

        for (const constraint of constraints) {
            try {
                await db.query(`
                    ALTER TABLE mystery_box_config
                    DROP CONSTRAINT IF EXISTS ${constraint.conname}
                `);
                console.log(`   ✅ Contrainte ${constraint.conname} supprimée`);
            } catch (e) {
                console.log(`   ⚠️ Erreur contrainte ${constraint.conname}: ${e.message}`);
            }
        }

        // 3. Supprimer colonne prob_mission
        console.log('\n3️⃣ Suppression colonne prob_mission...');
        try {
            await db.query(`
                ALTER TABLE mystery_box_config
                DROP COLUMN IF EXISTS prob_mission
            `);
            console.log('   ✅ prob_mission supprimée');
        } catch (e) {
            console.log(`   ⚠️ Erreur: ${e.message}`);
        }

        // 4. Supprimer colonne prob_trap
        console.log('\n4️⃣ Suppression colonne prob_trap...');
        try {
            await db.query(`
                ALTER TABLE mystery_box_config
                DROP COLUMN IF EXISTS prob_trap
            `);
            console.log('   ✅ prob_trap supprimée');
        } catch (e) {
            console.log(`   ⚠️ Erreur: ${e.message}`);
        }

        // 5. Ajouter/Modifier la contrainte pour prob_collectible + prob_super_bonus = 100
        console.log('\n5️⃣ Ajout contrainte prob_collectible + prob_super_bonus = 100...');
        try {
            // D'abord supprimer l'ancienne contrainte si elle existe
            await db.query(`
                ALTER TABLE mystery_box_config
                DROP CONSTRAINT IF EXISTS mystery_box_config_prob_check
            `);

            // Ajouter la nouvelle contrainte
            await db.query(`
                ALTER TABLE mystery_box_config
                ADD CONSTRAINT mystery_box_config_prob_100_check
                CHECK ((prob_collectible + prob_super_bonus) = 100)
            `);
            console.log('   ✅ Contrainte ajoutée: prob_collectible + prob_super_bonus = 100');
        } catch (e) {
            console.log(`   ⚠️ Erreur: ${e.message}`);
        }

        // 6. Vérification finale
        console.log('\n' + '='.repeat(60));
        console.log('📋 VÉRIFICATION FINALE\n');

        const remainingColumns = await db.queryAll(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'mystery_box_config'
            AND column_name LIKE 'prob_%'
            ORDER BY column_name
        `);

        console.log('Colonnes prob_* restantes:');
        remainingColumns.forEach(c => console.log(`  ✅ ${c.column_name}: ${c.data_type}`));

        const newConstraints = await db.queryAll(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'mystery_box_config'::regclass
            AND contype = 'c'
        `);

        console.log('\nContraintes CHECK:');
        newConstraints.forEach(c => console.log(`  ✅ ${c.conname}: ${c.definition}`));

        console.log('\n✅ MIGRATION TERMINÉE AVEC SUCCÈS!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur migration:', error);
        process.exit(1);
    }
}

dropMissionTrapColumns();
