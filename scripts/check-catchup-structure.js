require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
    console.log('🔍 Vérification structure daily_catchup_history...\n');

    // Vérifier si la table existe
    const tableExists = await db.queryOne(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'daily_catchup_history'
        ) as exists
    `);

    if (!tableExists?.exists) {
        console.log('❌ Table daily_catchup_history n\'existe PAS!');
        process.exit(1);
    }

    console.log('✅ Table existe\n');

    // Lister les colonnes
    const columns = await db.queryAll(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'daily_catchup_history'
        ORDER BY ordinal_position
    `);
    console.log('📋 Colonnes:');
    console.table(columns);

    // Vérifier les données existantes
    const count = await db.queryOne(`
        SELECT COUNT(*) as total FROM daily_catchup_history
    `);
    console.log(`\n📊 ${count.total} enregistrements dans daily_catchup_history`);

    // Exemple de données
    if (parseInt(count.total) > 0) {
        const samples = await db.queryAll(`
            SELECT * FROM daily_catchup_history
            ORDER BY purchased_at DESC
            LIMIT 5
        `);
        console.log('\n📋 Échantillon:');
        console.table(samples);
    }

    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
