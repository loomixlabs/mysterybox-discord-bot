require('dotenv').config();
const db = require('../utils/database-pg');

async function checkConstraints() {
    try {
        console.log('🔍 Vérification des contraintes source...\n');

        // Check give_logs constraints
        const giveLogsConstraints = await db.queryAll(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'give_logs'::regclass
            AND contype = 'c'
        `);

        console.log('📋 Contraintes give_logs:');
        giveLogsConstraints.forEach(c => {
            console.log(`  - ${c.conname}: ${c.definition}`);
        });

        // Check collections constraints
        const collectionsConstraints = await db.queryAll(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'collections'::regclass
            AND contype = 'c'
        `);

        console.log('\n📋 Contraintes collections:');
        collectionsConstraints.forEach(c => {
            console.log(`  - ${c.conname}: ${c.definition}`);
        });

        // Check current source values in use
        const usedSources = await db.queryAll(`
            SELECT DISTINCT source, COUNT(*) as count
            FROM collections
            GROUP BY source
            ORDER BY count DESC
        `);

        console.log('\n📊 Sources actuellement utilisées dans collections:');
        console.table(usedSources);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

checkConstraints();
