/**
 * Migration: Ajouter les colonnes catchup à theme_config
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function runMigration() {
    console.log('='.repeat(60));
    console.log('MIGRATION: Ajout colonnes catchup à theme_config');
    console.log('='.repeat(60));

    try {
        // 1. Vérifier les colonnes existantes
        console.log('\n1. Vérification des colonnes existantes...');
        const existingCols = await db.queryAll(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'theme_config'
            AND column_name LIKE 'catchup%'
        `);
        console.log('   Colonnes catchup existantes:', existingCols.map(c => c.column_name));

        // 2. Ajouter catchup_enabled
        console.log('\n2. Ajout de catchup_enabled...');
        await db.query(`
            ALTER TABLE theme_config
            ADD COLUMN IF NOT EXISTS catchup_enabled BOOLEAN DEFAULT TRUE
        `);
        console.log('   ✅ catchup_enabled ajouté');

        // 3. Ajouter catchup_base_price
        console.log('\n3. Ajout de catchup_base_price...');
        await db.query(`
            ALTER TABLE theme_config
            ADD COLUMN IF NOT EXISTS catchup_base_price INTEGER DEFAULT 50
        `);
        console.log('   ✅ catchup_base_price ajouté');

        // 4. Ajouter catchup_price_multiplier
        console.log('\n4. Ajout de catchup_price_multiplier...');
        await db.query(`
            ALTER TABLE theme_config
            ADD COLUMN IF NOT EXISTS catchup_price_multiplier DECIMAL(4,2) DEFAULT 1.5
        `);
        console.log('   ✅ catchup_price_multiplier ajouté');

        // 5. Ajouter catchup_max_per_session
        console.log('\n5. Ajout de catchup_max_per_session...');
        await db.query(`
            ALTER TABLE theme_config
            ADD COLUMN IF NOT EXISTS catchup_max_per_session INTEGER DEFAULT 5
        `);
        console.log('   ✅ catchup_max_per_session ajouté');

        // 6. Vérification finale
        console.log('\n6. Vérification finale...');
        const result = await db.queryAll(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'theme_config'
            AND column_name LIKE 'catchup%'
            ORDER BY ordinal_position
        `);

        console.table(result);

        console.log('\n' + '='.repeat(60));
        console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS');
        console.log('='.repeat(60));

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

runMigration();
