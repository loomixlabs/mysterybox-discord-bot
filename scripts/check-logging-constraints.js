/**
 * Script de vérification: Contraintes de logging pour v2.2.1
 * Vérifie que toutes les sources incluent les nouvelles mystery box par rareté
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkLoggingConstraints() {
    console.log('='.repeat(70));
    console.log('🔍 VÉRIFICATION DES CONTRAINTES DE LOGGING v2.2.1');
    console.log('='.repeat(70));
    console.log('');

    const client = await pool.connect();

    try {
        // 1. Vérifier contrainte source dans collections
        console.log('📋 1. CONTRAINTE SOURCE DANS COLLECTIONS:');
        console.log('-'.repeat(50));
        const collectionsConstraint = await client.query(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'collections'::regclass
            AND contype = 'c'
            AND conname LIKE '%source%'
        `);

        if (collectionsConstraint.rows.length > 0) {
            for (const row of collectionsConstraint.rows) {
                console.log(`   Contrainte: ${row.conname}`);
                console.log(`   Définition: ${row.definition}`);
            }
        } else {
            console.log('   ⚠️ Aucune contrainte source trouvée');
        }

        // 2. Vérifier contrainte source dans mystery_box_credit_logs
        console.log('\n📋 2. CONTRAINTE SOURCE DANS MYSTERY_BOX_CREDIT_LOGS:');
        console.log('-'.repeat(50));
        const creditLogsConstraint = await client.query(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'mystery_box_credit_logs'::regclass
            AND contype = 'c'
        `);

        if (creditLogsConstraint.rows.length > 0) {
            for (const row of creditLogsConstraint.rows) {
                console.log(`   Contrainte: ${row.conname}`);
                console.log(`   Définition: ${row.definition}`);
            }
        } else {
            console.log('   ⚠️ Aucune contrainte trouvée');
        }

        // 3. Vérifier contrainte rarity dans mystery_box_credit_logs
        console.log('\n📋 3. CONTRAINTE RARITY DANS MYSTERY_BOX_CREDIT_LOGS:');
        console.log('-'.repeat(50));
        const rarityConstraint = await client.query(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'mystery_box_credit_logs'::regclass
            AND contype = 'c'
            AND conname LIKE '%rarity%'
        `);

        if (rarityConstraint.rows.length > 0) {
            for (const row of rarityConstraint.rows) {
                console.log(`   Contrainte: ${row.conname}`);
                console.log(`   Définition: ${row.definition}`);
            }
        } else {
            console.log('   ⚠️ Aucune contrainte rarity trouvée');
        }

        // 4. Vérifier contrainte action dans mystery_box_credit_logs
        console.log('\n📋 4. CONTRAINTE ACTION DANS MYSTERY_BOX_CREDIT_LOGS:');
        console.log('-'.repeat(50));
        const actionConstraint = await client.query(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'mystery_box_credit_logs'::regclass
            AND contype = 'c'
            AND conname LIKE '%action%'
        `);

        if (actionConstraint.rows.length > 0) {
            for (const row of actionConstraint.rows) {
                console.log(`   Contrainte: ${row.conname}`);
                console.log(`   Définition: ${row.definition}`);
            }
        } else {
            console.log('   ⚠️ Aucune contrainte action trouvée');
        }

        // 5. Vérifier la structure complète de mystery_box_credit_logs
        console.log('\n📋 5. STRUCTURE COMPLÈTE MYSTERY_BOX_CREDIT_LOGS:');
        console.log('-'.repeat(50));
        const logsStructure = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'mystery_box_credit_logs'
            ORDER BY ordinal_position
        `);
        console.table(logsStructure.rows);

        // 6. Vérifier toutes les contraintes CHECK sur mystery_box_credit_logs
        console.log('\n📋 6. TOUTES LES CONTRAINTES CHECK SUR MYSTERY_BOX_CREDIT_LOGS:');
        console.log('-'.repeat(50));
        const allConstraints = await client.query(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'mystery_box_credit_logs'::regclass
            AND contype = 'c'
        `);

        if (allConstraints.rows.length > 0) {
            for (const row of allConstraints.rows) {
                console.log(`\n   📌 ${row.conname}:`);
                console.log(`      ${row.definition}`);
            }
        } else {
            console.log('   ⚠️ Aucune contrainte CHECK trouvée');
        }

        // 7. Vérifier give_logs structure
        console.log('\n📋 7. STRUCTURE GIVE_LOGS (nouvelles colonnes mystery_box):');
        console.log('-'.repeat(50));
        const giveLogsStructure = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'give_logs'
            AND column_name LIKE '%mystery%'
            ORDER BY ordinal_position
        `);

        if (giveLogsStructure.rows.length > 0) {
            console.table(giveLogsStructure.rows);
        } else {
            console.log('   ⚠️ Aucune colonne mystery_box trouvée');
        }

        // 8. Vérifier give_campaigns structure
        console.log('\n📋 8. STRUCTURE GIVE_CAMPAIGNS (nouvelles colonnes mystery_box):');
        console.log('-'.repeat(50));
        const campaignsStructure = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'give_campaigns'
            AND (column_name LIKE '%mystery%' OR column_name = 'give_type')
            ORDER BY ordinal_position
        `);

        if (campaignsStructure.rows.length > 0) {
            console.table(campaignsStructure.rows);
        } else {
            console.log('   ⚠️ Aucune colonne mystery_box/give_type trouvée');
        }

        // 9. Vérifier les valeurs sources existantes dans collections
        console.log('\n📋 9. SOURCES EXISTANTES DANS COLLECTIONS:');
        console.log('-'.repeat(50));
        const existingSources = await client.query(`
            SELECT DISTINCT source, COUNT(*) as count
            FROM collections
            WHERE source IS NOT NULL
            GROUP BY source
            ORDER BY count DESC
        `);

        if (existingSources.rows.length > 0) {
            console.table(existingSources.rows);
        } else {
            console.log('   (aucune donnée)');
        }

        // 10. Vérifier les sources dans mystery_box_credit_logs
        console.log('\n📋 10. SOURCES EXISTANTES DANS MYSTERY_BOX_CREDIT_LOGS:');
        console.log('-'.repeat(50));
        const mbSources = await client.query(`
            SELECT DISTINCT source, COUNT(*) as count
            FROM mystery_box_credit_logs
            WHERE source IS NOT NULL
            GROUP BY source
            ORDER BY count DESC
        `);

        if (mbSources.rows.length > 0) {
            console.table(mbSources.rows);
        } else {
            console.log('   (aucune donnée)');
        }

        console.log('\n' + '='.repeat(70));
        console.log('✅ VÉRIFICATION TERMINÉE');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('❌ Erreur:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

checkLoggingConstraints();
