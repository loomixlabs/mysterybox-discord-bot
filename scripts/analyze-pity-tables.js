require('dotenv').config();
const db = require('../utils/database-pg');

async function analyzePityTables() {
    try {
        // Structure pity counter
        const pity = await db.queryAll(`
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'mystery_box_pity_counter'
            ORDER BY ordinal_position
        `);
        console.log('📊 Structure mystery_box_pity_counter:');
        pity.forEach(c => console.log(`  ${c.column_name.padEnd(25)}: ${c.data_type.padEnd(15)} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${c.column_default || ''}`));

        // Contraintes pity
        const constraints = await db.queryAll(`
            SELECT conname, pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'mystery_box_pity_counter'::regclass
        `);
        console.log('\n🔒 Contraintes:');
        constraints.forEach(c => console.log(`  ${c.conname}: ${c.definition}`));

        // Données existantes
        const data = await db.queryAll('SELECT * FROM mystery_box_pity_counter LIMIT 5');
        console.log('\n📦 Données pity existantes:', data.length);
        if (data.length > 0) console.table(data);

        // Vérifier les vues
        console.log('\n\n📊 Vérification des vues:');

        try {
            const configView = await db.queryAll(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'v_mystery_box_config_full'
            `);
            console.log('\nv_mystery_box_config_full colonnes:', configView.map(c => c.column_name).join(', '));
        } catch (e) {
            console.log('Vue v_mystery_box_config_full: non disponible');
        }

        try {
            const totalsView = await db.queryAll(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'v_player_mystery_box_totals'
            `);
            console.log('\nv_player_mystery_box_totals colonnes:', totalsView.map(c => c.column_name).join(', '));
        } catch (e) {
            console.log('Vue v_player_mystery_box_totals: non disponible');
        }

        // Vérifier mystery_box_credit_logs
        const creditLogs = await db.queryAll(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'mystery_box_credit_logs'
            ORDER BY ordinal_position
        `);
        console.log('\n\n📊 Structure mystery_box_credit_logs:');
        creditLogs.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

analyzePityTables();
