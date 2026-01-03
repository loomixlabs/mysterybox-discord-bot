/**
 * Script d'exécution de la migration Crafting Images
 * Ajoute les colonnes image_craft_animation et image_craft_critical
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../utils/database-pg');

async function runMigration() {
    console.log('='.repeat(70));
    console.log('MIGRATION: Update Crafting Images');
    console.log('='.repeat(70));
    console.log('');

    try {
        // Lire le fichier SQL
        const sqlPath = path.join(__dirname, '../database/migrations/update-crafting-images.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Exécution de la migration...\n');

        // Exécuter la migration
        await db.query(sql);

        console.log('✅ Migration exécutée avec succès!\n');

        // Vérifier les colonnes ajoutées
        console.log('📋 Vérification des nouvelles colonnes:\n');

        const columns = await db.queryAll(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'crafting_config'
            AND column_name IN ('image_craft_animation', 'image_craft_critical')
            ORDER BY column_name
        `);

        if (columns.length === 2) {
            columns.forEach(col => {
                console.log(`✅ ${col.column_name}: ${col.data_type}`);
            });
        } else {
            console.log('⚠️  Colonnes trouvées:', columns.map(c => c.column_name).join(', ') || 'aucune');
        }

        // Afficher la structure complète de crafting_config
        console.log('\n📋 Structure complète de crafting_config:\n');
        const allCols = await db.queryAll(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'crafting_config'
            ORDER BY ordinal_position
        `);

        allCols.forEach(col => {
            const def = col.column_default ? ` [${col.column_default.substring(0, 30)}${col.column_default.length > 30 ? '...' : ''}]` : '';
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
