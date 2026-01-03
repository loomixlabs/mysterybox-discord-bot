require('dotenv').config();
const db = require('../utils/database-pg');

async function dropMissionTrapColumns() {
    try {
        console.log('🗑️  SUPPRESSION COLONNES prob_mission et prob_trap\n');
        console.log('='.repeat(60));

        // 1. Supprimer la vue dépendante
        console.log('\n1️⃣ Suppression de la vue v_mystery_box_config_full...');
        try {
            await db.query('DROP VIEW IF EXISTS v_mystery_box_config_full CASCADE');
            console.log('   ✅ Vue supprimée');
        } catch (e) {
            console.log(`   ⚠️ ${e.message}`);
        }

        // 2. Mettre à jour les données pour que prob_collectible + prob_super_bonus = 100
        console.log('\n2️⃣ Mise à jour des données pour respecter prob = 100%...');
        const updated = await db.query(`
            UPDATE mystery_box_config
            SET prob_super_bonus = 100 - prob_collectible
            WHERE prob_collectible + prob_super_bonus != 100
        `);
        console.log(`   ✅ ${updated.rowCount || 0} ligne(s) mise(s) à jour`);

        // 3. Supprimer les colonnes avec CASCADE
        console.log('\n3️⃣ Suppression colonne prob_mission (CASCADE)...');
        try {
            await db.query('ALTER TABLE mystery_box_config DROP COLUMN IF EXISTS prob_mission CASCADE');
            console.log('   ✅ prob_mission supprimée');
        } catch (e) {
            console.log(`   ⚠️ ${e.message}`);
        }

        console.log('\n4️⃣ Suppression colonne prob_trap (CASCADE)...');
        try {
            await db.query('ALTER TABLE mystery_box_config DROP COLUMN IF EXISTS prob_trap CASCADE');
            console.log('   ✅ prob_trap supprimée');
        } catch (e) {
            console.log(`   ⚠️ ${e.message}`);
        }

        // 5. Ajouter contrainte prob = 100
        console.log('\n5️⃣ Ajout contrainte prob_collectible + prob_super_bonus = 100...');
        try {
            await db.query(`
                ALTER TABLE mystery_box_config
                DROP CONSTRAINT IF EXISTS mystery_box_config_prob_100_check
            `);
            await db.query(`
                ALTER TABLE mystery_box_config
                ADD CONSTRAINT mystery_box_config_prob_100_check
                CHECK ((prob_collectible + prob_super_bonus) = 100)
            `);
            console.log('   ✅ Contrainte ajoutée');
        } catch (e) {
            console.log(`   ⚠️ ${e.message}`);
        }

        // 6. Vérification finale
        console.log('\n' + '='.repeat(60));
        console.log('📋 VÉRIFICATION FINALE\n');

        const columns = await db.queryAll(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'mystery_box_config'
            AND column_name LIKE 'prob_%'
            ORDER BY column_name
        `);

        console.log('Colonnes prob_* restantes:');
        columns.forEach(c => console.log(`  ✅ ${c.column_name}: ${c.data_type}`));

        const constraints = await db.queryAll(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'mystery_box_config'::regclass
            AND contype = 'c'
        `);

        console.log('\nContraintes CHECK:');
        constraints.forEach(c => console.log(`  ✅ ${c.conname}`));

        // Vérifier les données
        const boxes = await db.queryAll(`
            SELECT rarity, prob_collectible, prob_super_bonus,
                   prob_collectible + prob_super_bonus as total
            FROM mystery_box_config
            LIMIT 10
        `);
        console.log('\nBoxes existantes:');
        boxes.forEach(b => console.log(`  📦 ${b.rarity}: ${b.prob_collectible}% collectible + ${b.prob_super_bonus}% super_bonus = ${b.total}%`));

        console.log('\n✅ MIGRATION TERMINÉE!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

dropMissionTrapColumns();
