require('dotenv').config();
const db = require('../utils/database-pg');

async function cleanup() {
    console.log('='.repeat(60));
    console.log('NETTOYAGE COLONNES CATCHUP REDONDANTES');
    console.log('='.repeat(60));

    // 1. Vérifier les colonnes catchup dans theme_config
    console.log('\n📋 Colonnes catchup actuelles dans theme_config:');
    const themeConfigCols = await db.queryAll(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'theme_config'
        AND column_name LIKE 'catchup%'
        ORDER BY ordinal_position
    `);

    if (themeConfigCols.length === 0) {
        console.log('✅ Aucune colonne catchup dans theme_config - Pas de nettoyage nécessaire');
        process.exit(0);
    }

    console.table(themeConfigCols);

    // 2. Vérifier que daily_catchup_config existe et a des données
    console.log('\n📋 Vérification de daily_catchup_config:');
    const catchupData = await db.queryAll(`
        SELECT guild_id, theme_id, enabled, base_price, price_increment, max_catchup_days
        FROM daily_catchup_config
        ORDER BY guild_id, theme_id
    `);
    console.log(`   Entrées dans daily_catchup_config: ${catchupData.length}`);
    if (catchupData.length > 0) {
        console.table(catchupData);
    }

    // 3. Supprimer les colonnes catchup de theme_config
    console.log('\n🧹 Suppression des colonnes redondantes...');

    for (const col of themeConfigCols) {
        try {
            await db.query(`ALTER TABLE theme_config DROP COLUMN IF EXISTS ${col.column_name}`);
            console.log(`   ✅ Colonne ${col.column_name} supprimée`);
        } catch (error) {
            console.error(`   ❌ Erreur suppression ${col.column_name}:`, error.message);
        }
    }

    // 4. Vérifier après nettoyage
    console.log('\n📋 Vérification post-nettoyage:');
    const remaining = await db.queryAll(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'theme_config'
        AND column_name LIKE 'catchup%'
    `);

    if (remaining.length === 0) {
        console.log('✅ Nettoyage terminé - Plus de colonnes catchup dans theme_config');
    } else {
        console.log('⚠️ Colonnes restantes:', remaining.map(c => c.column_name).join(', '));
    }

    process.exit(0);
}

cleanup().catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
});
