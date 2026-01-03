/**
 * Script d'analyse complète de la structure de la base de données locale
 * Pour comparaison avec le VPS
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function analyzeDatabase() {
    console.log('='.repeat(80));
    console.log('ANALYSE COMPLETE BASE DE DONNEES LOCALE');
    console.log('='.repeat(80));

    try {
        // 1. Lister toutes les tables
        const tables = await db.queryAll(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        console.log('\n📋 TABLES (' + tables.length + '):');
        console.log(JSON.stringify(tables.map(t => t.table_name), null, 2));

        // 2. Structure détaillée de chaque table
        console.log('\n' + '='.repeat(80));
        console.log('STRUCTURE DETAILLEE DES TABLES');
        console.log('='.repeat(80));

        const fullStructure = {};

        for (const table of tables) {
            const cols = await db.queryAll(`
                SELECT column_name, data_type, column_default, is_nullable,
                       character_maximum_length, numeric_precision
                FROM information_schema.columns
                WHERE table_name = $1
                ORDER BY ordinal_position
            `, [table.table_name]);

            fullStructure[table.table_name] = {
                columns: cols.map(c => ({
                    name: c.column_name,
                    type: c.data_type,
                    default: c.column_default,
                    nullable: c.is_nullable === 'YES'
                }))
            };

            console.log('\n📊 ' + table.table_name + ' (' + cols.length + ' colonnes):');
            cols.forEach(c => {
                const defaultVal = c.column_default ? ' DEFAULT ' + c.column_default.substring(0, 40) : '';
                const nullable = c.is_nullable === 'NO' ? ' NOT NULL' : '';
                console.log('  - ' + c.column_name + ': ' + c.data_type + defaultVal + nullable);
            });
        }

        // 3. Contraintes CHECK
        console.log('\n' + '='.repeat(80));
        console.log('CONTRAINTES CHECK');
        console.log('='.repeat(80));

        const checkConstraints = await db.queryAll(`
            SELECT
                tc.table_name,
                tc.constraint_name,
                pg_get_constraintdef(pgc.oid) as definition
            FROM information_schema.table_constraints tc
            JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
            WHERE tc.constraint_type = 'CHECK'
            AND tc.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_name
        `);

        console.log('\nNombre de contraintes CHECK: ' + checkConstraints.length);
        checkConstraints.forEach(c => {
            console.log('\n📌 ' + c.table_name + '.' + c.constraint_name + ':');
            console.log('   ' + c.definition);
        });

        // 4. Index
        console.log('\n' + '='.repeat(80));
        console.log('INDEX');
        console.log('='.repeat(80));

        const indexes = await db.queryAll(`
            SELECT
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname NOT LIKE '%_pkey'
            ORDER BY tablename, indexname
        `);

        console.log('\nNombre d\'index (hors PK): ' + indexes.length);
        indexes.forEach(i => {
            console.log('  - ' + i.tablename + ': ' + i.indexname);
        });

        // 5. Clés étrangères
        console.log('\n' + '='.repeat(80));
        console.log('CLES ETRANGERES');
        console.log('='.repeat(80));

        const foreignKeys = await db.queryAll(`
            SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            ORDER BY tc.table_name
        `);

        console.log('\nNombre de FK: ' + foreignKeys.length);
        foreignKeys.forEach(fk => {
            console.log('  - ' + fk.table_name + '.' + fk.column_name + ' -> ' + fk.foreign_table_name + '.' + fk.foreign_column_name);
        });

        // Exporter en JSON pour comparaison
        const exportData = {
            tables: tables.map(t => t.table_name),
            structure: fullStructure,
            checkConstraints: checkConstraints,
            indexes: indexes,
            foreignKeys: foreignKeys
        };

        require('fs').writeFileSync('local-db-structure.json', JSON.stringify(exportData, null, 2));
        console.log('\n✅ Structure exportée dans local-db-structure.json');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

analyzeDatabase();
