require('dotenv').config();
const db = require('../utils/database-pg');

async function fixGiveLogsMessageId() {
    try {
        console.log('🔧 Correction de la contrainte message_id dans give_logs...\n');

        // 1. Vérifier la structure actuelle
        const columns = await db.queryAll(`
            SELECT column_name, is_nullable, data_type
            FROM information_schema.columns
            WHERE table_name = 'give_logs'
            ORDER BY ordinal_position
        `);

        console.log('📋 Structure actuelle de give_logs:');
        console.table(columns);

        // 2. Rendre message_id nullable
        console.log('\n🔧 Modification: ALTER TABLE give_logs ALTER COLUMN message_id DROP NOT NULL...');

        await db.query(`
            ALTER TABLE give_logs
            ALTER COLUMN message_id DROP NOT NULL
        `);

        console.log('✅ message_id est maintenant nullable');

        // 3. Vérifier la modification
        const updatedColumns = await db.queryAll(`
            SELECT column_name, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'give_logs' AND column_name = 'message_id'
        `);

        console.log('\n📋 Vérification après modification:');
        console.table(updatedColumns);

        console.log('\n✅ Correction terminée avec succès!');
        console.log('📝 Les mystery boxes par rareté (depuis /profile) peuvent maintenant être loguées sans message_id');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

fixGiveLogsMessageId();
