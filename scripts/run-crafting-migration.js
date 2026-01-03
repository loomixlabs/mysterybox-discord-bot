/**
 * Script d'exécution de la migration Crafting System
 * Crée les tables crafting_config et crafting_stats
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../utils/database-pg');

async function runMigration() {
    console.log('='.repeat(70));
    console.log('MIGRATION: Crafting System');
    console.log('='.repeat(70));
    console.log('');

    try {
        // Lire le fichier SQL
        const sqlPath = path.join(__dirname, '../database/migrations/add-crafting-system.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Exécution de la migration...\n');

        // Exécuter la migration
        await db.query(sql);

        console.log('Migration exécutée avec succès!\n');

        // Vérifier les tables créées
        console.log('Vérification des tables créées:\n');

        const tables = await db.queryAll(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('crafting_config', 'crafting_stats')
            ORDER BY table_name
        `);

        if (tables.length === 2) {
            console.log('✅ crafting_config - CRÉÉE');
            console.log('✅ crafting_stats - CRÉÉE');
        } else {
            console.log('⚠️  Tables trouvées:', tables.map(t => t.table_name).join(', '));
        }

        // Afficher la structure de crafting_config
        console.log('\n📋 Structure de crafting_config:\n');
        const configCols = await db.queryAll(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'crafting_config'
            ORDER BY ordinal_position
        `);

        configCols.forEach(col => {
            const def = col.column_default ? ` [${col.column_default}]` : '';
            console.log(`   - ${col.column_name}: ${col.data_type}${def}`);
        });

        // Afficher la structure de crafting_stats
        console.log('\n📋 Structure de crafting_stats:\n');
        const statsCols = await db.queryAll(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'crafting_stats'
            ORDER BY ordinal_position
        `);

        statsCols.forEach(col => {
            const def = col.column_default ? ` [${col.column_default}]` : '';
            console.log(`   - ${col.column_name}: ${col.data_type}${def}`);
        });

        console.log('\n' + '='.repeat(70));
        console.log('MIGRATION TERMINÉE AVEC SUCCÈS');
        console.log('='.repeat(70));

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

runMigration();
