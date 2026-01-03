/**
 * Script de migration: Fix Logging Constraints v2.2.1
 * Corrige les contraintes de logging pour Daily Claim et Mystery Box par rareté
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigration() {
    console.log('='.repeat(70));
    console.log('🔧 MIGRATION: FIX LOGGING CONSTRAINTS v2.2.1');
    console.log('='.repeat(70));
    console.log(`📆 Date: ${new Date().toISOString()}`);
    console.log('');

    const client = await pool.connect();

    try {
        // Lire le fichier SQL
        const sqlPath = path.join(__dirname, '../database/migrations/fix-logging-constraints-v2.2.1.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 Fichier SQL chargé');
        console.log('🚀 Exécution de la migration...\n');

        // Exécuter dans une transaction
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');

        console.log('\n✅ Migration SQL exécutée avec succès');

        // Vérification
        console.log('\n🔍 VÉRIFICATION POST-MIGRATION:\n');

        // 1. Vérifier collections_source_check
        console.log('📋 1. Contrainte collections_source_check:');
        const collectionsCheck = await client.query(`
            SELECT pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conname = 'collections_source_check'
        `);
        if (collectionsCheck.rows.length > 0) {
            console.log('   ✅ ' + collectionsCheck.rows[0].definition);
        }

        // 2. Vérifier mystery_box_credit_logs_source_check
        console.log('\n📋 2. Contrainte mystery_box_credit_logs_source_check:');
        const logsSourceCheck = await client.query(`
            SELECT pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conname = 'mystery_box_credit_logs_source_check'
        `);
        if (logsSourceCheck.rows.length > 0) {
            console.log('   ✅ ' + logsSourceCheck.rows[0].definition);
        }

        // 3. Vérifier give_campaigns_give_type_check
        console.log('\n📋 3. Contrainte give_campaigns_give_type_check:');
        const campaignsTypeCheck = await client.query(`
            SELECT pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conname = 'give_campaigns_give_type_check'
        `);
        if (campaignsTypeCheck.rows.length > 0) {
            console.log('   ✅ ' + campaignsTypeCheck.rows[0].definition);
        }

        // 4. Vérifier give_campaigns_mystery_box_rarity_check
        console.log('\n📋 4. Contrainte give_campaigns_mystery_box_rarity_check:');
        const campaignsRarityCheck = await client.query(`
            SELECT pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conname = 'give_campaigns_mystery_box_rarity_check'
        `);
        if (campaignsRarityCheck.rows.length > 0) {
            console.log('   ✅ ' + campaignsRarityCheck.rows[0].definition);
        }

        // 5. Vérifier give_logs_mystery_box_rarity_check
        console.log('\n📋 5. Contrainte give_logs_mystery_box_rarity_check:');
        const logsRarityCheck = await client.query(`
            SELECT pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conname = 'give_logs_mystery_box_rarity_check'
        `);
        if (logsRarityCheck.rows.length > 0) {
            console.log('   ✅ ' + logsRarityCheck.rows[0].definition);
        }

        // 6. Vérifier daily_rewards_config_reward_type_check
        console.log('\n📋 6. Contrainte daily_rewards_config_reward_type_check:');
        const dailyTypeCheck = await client.query(`
            SELECT pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conname = 'daily_rewards_config_reward_type_check'
        `);
        if (dailyTypeCheck.rows.length > 0) {
            console.log('   ✅ ' + dailyTypeCheck.rows[0].definition);
        }

        // 7. Vérifier daily_rewards_config_reward_rarity_check
        console.log('\n📋 7. Contrainte daily_rewards_config_reward_rarity_check:');
        const dailyRarityCheck = await client.query(`
            SELECT pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conname = 'daily_rewards_config_reward_rarity_check'
        `);
        if (dailyRarityCheck.rows.length > 0) {
            console.log('   ✅ ' + dailyRarityCheck.rows[0].definition);
        }

        // Résumé
        console.log('\n' + '='.repeat(70));
        console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS');
        console.log('='.repeat(70));

        console.log('\n📊 Résumé des contraintes ajoutées/mises à jour:');
        console.log('   • collections_source_check → +daily_claim, +mystery_box_[rarity]');
        console.log('   • mystery_box_credit_logs_source_check → NOUVELLE');
        console.log('   • give_campaigns_give_type_check → NOUVELLE');
        console.log('   • give_campaigns_mystery_box_rarity_check → NOUVELLE');
        console.log('   • give_logs_mystery_box_rarity_check → NOUVELLE');
        console.log('   • daily_rewards_config_reward_type_check → VÉRIFIÉE');
        console.log('   • daily_rewards_config_reward_rarity_check → VÉRIFIÉE');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Erreur lors de la migration:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(error => {
    console.error('❌ Migration échouée:', error);
    process.exit(1);
});
