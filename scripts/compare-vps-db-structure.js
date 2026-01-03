/**
 * Script de comparaison de la structure DB VPS vs Local
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');

const SSH_CMD = 'ssh -i ~/.ssh/id_rsa_vps_hostinger root@72.60.185.62';
const DOCKER_PSQL = 'docker exec bot-mysterybox-db psql -U botuser -d botdb';

async function runVpsQuery(query) {
    const cmd = `${SSH_CMD} "${DOCKER_PSQL} -c \\"${query}\\" -t -A"`;
    try {
        const { stdout } = await execPromise(cmd, { maxBuffer: 10 * 1024 * 1024 });
        return stdout.trim();
    } catch (error) {
        console.error('Erreur VPS:', error.message);
        return null;
    }
}

async function getVpsTableColumns(tableName) {
    const query = `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`;
    const result = await runVpsQuery(query);
    if (!result) return [];

    return result.split('\n').filter(l => l).map(line => {
        const parts = line.split('|');
        return {
            name: parts[0],
            type: parts[1],
            default: parts[2] || null,
            nullable: parts[3] === 'YES'
        };
    });
}

async function getVpsCheckConstraints() {
    const query = `SELECT tc.table_name, tc.constraint_name, pg_get_constraintdef(pgc.oid) FROM information_schema.table_constraints tc JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name WHERE tc.constraint_type = 'CHECK' AND tc.table_schema = 'public' ORDER BY tc.table_name`;
    const result = await runVpsQuery(query);
    if (!result) return [];

    return result.split('\n').filter(l => l).map(line => {
        const parts = line.split('|');
        return {
            table: parts[0],
            name: parts[1],
            definition: parts[2]
        };
    });
}

async function compareStructures() {
    console.log('='.repeat(80));
    console.log('COMPARAISON STRUCTURE DB: VPS vs LOCAL');
    console.log('='.repeat(80));

    // Charger la structure locale
    const localStructure = JSON.parse(fs.readFileSync('local-db-structure.json', 'utf8'));
    const localTables = localStructure.tables;

    // Tables VPS
    const vpsTablesResult = await runVpsQuery("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name");
    const vpsTables = vpsTablesResult.split('\n').filter(l => l);

    console.log('\n📊 RÉSUMÉ:');
    console.log('  - Tables locales: ' + localTables.length);
    console.log('  - Tables VPS: ' + vpsTables.length);

    // Tables manquantes sur VPS
    const missingTables = localTables.filter(t => !vpsTables.includes(t));
    console.log('\n❌ TABLES MANQUANTES SUR VPS (' + missingTables.length + '):');
    missingTables.forEach(t => console.log('  - ' + t));

    // Tables en trop sur VPS
    const extraTables = vpsTables.filter(t => !localTables.includes(t));
    if (extraTables.length > 0) {
        console.log('\n⚠️  TABLES EN TROP SUR VPS:');
        extraTables.forEach(t => console.log('  - ' + t));
    }

    // Comparer les colonnes pour les tables communes
    const commonTables = localTables.filter(t => vpsTables.includes(t));
    const columnDiffs = [];

    console.log('\n🔍 Analyse des colonnes pour ' + commonTables.length + ' tables communes...');

    for (const tableName of commonTables) {
        const localCols = localStructure.structure[tableName].columns.map(c => c.name);
        const vpsCols = await getVpsTableColumns(tableName);
        const vpsColNames = vpsCols.map(c => c.name);

        const missingCols = localCols.filter(c => !vpsColNames.includes(c));
        const extraCols = vpsColNames.filter(c => !localCols.includes(c));

        if (missingCols.length > 0 || extraCols.length > 0) {
            columnDiffs.push({
                table: tableName,
                missing: missingCols,
                extra: extraCols
            });
        }
    }

    if (columnDiffs.length > 0) {
        console.log('\n🔴 DIFFÉRENCES DE COLONNES:');
        columnDiffs.forEach(diff => {
            console.log('\n📋 ' + diff.table + ':');
            if (diff.missing.length > 0) {
                console.log('   ❌ Colonnes manquantes VPS: ' + diff.missing.join(', '));
            }
            if (diff.extra.length > 0) {
                console.log('   ⚠️  Colonnes en trop VPS: ' + diff.extra.join(', '));
            }
        });
    } else {
        console.log('\n✅ Toutes les colonnes sont synchronisées !');
    }

    // Comparer les contraintes CHECK
    console.log('\n🔍 Analyse des contraintes CHECK...');
    const vpsConstraints = await getVpsCheckConstraints();
    const localConstraints = localStructure.checkConstraints;

    const localConstraintNames = localConstraints.map(c => c.constraint_name);
    const vpsConstraintNames = vpsConstraints.map(c => c.name);

    const missingConstraints = localConstraints.filter(c => !vpsConstraintNames.includes(c.constraint_name));
    const extraConstraints = vpsConstraints.filter(c => !localConstraintNames.includes(c.name));

    if (missingConstraints.length > 0) {
        console.log('\n❌ CONTRAINTES CHECK MANQUANTES SUR VPS (' + missingConstraints.length + '):');
        missingConstraints.forEach(c => {
            console.log('  - ' + c.table_name + '.' + c.constraint_name);
        });
    }

    // Exporter le rapport
    const report = {
        summary: {
            localTables: localTables.length,
            vpsTables: vpsTables.length,
            missingTables: missingTables.length,
            columnDifferences: columnDiffs.length,
            missingConstraints: missingConstraints.length
        },
        missingTables,
        columnDiffs,
        missingConstraints: missingConstraints.map(c => ({
            table: c.table_name,
            name: c.constraint_name,
            definition: c.definition
        }))
    };

    fs.writeFileSync('vps-db-comparison-report.json', JSON.stringify(report, null, 2));
    console.log('\n✅ Rapport exporté dans vps-db-comparison-report.json');

    console.log('\n' + '='.repeat(80));
    console.log('FIN DE L\'ANALYSE');
    console.log('='.repeat(80));
}

compareStructures().catch(console.error);
