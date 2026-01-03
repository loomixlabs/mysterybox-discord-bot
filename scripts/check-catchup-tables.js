require('dotenv').config();
const db = require('../utils/database-pg');

async function check() {
    console.log('='.repeat(60));
    console.log('VÉRIFICATION DES TABLES CATCHUP/DAILY');
    console.log('='.repeat(60));

    // 1. Lister toutes les tables liées à catchup/daily
    const tables = await db.queryAll(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND (table_name LIKE '%catchup%' OR table_name LIKE '%daily%')
        ORDER BY table_name
    `);

    console.log('\n📋 Tables trouvées:');
    tables.forEach(t => console.log('  -', t.table_name));

    // 2. Vérifier les colonnes catchup dans theme_config
    const themeConfigCols = await db.queryAll(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'theme_config'
        AND column_name LIKE 'catchup%'
        ORDER BY ordinal_position
    `);

    console.log('\n📋 Colonnes catchup dans theme_config:');
    if (themeConfigCols.length === 0) {
        console.log('  (aucune)');
    } else {
        console.table(themeConfigCols);
    }

    // 3. Vérifier les colonnes catchup dans guild_config
    const guildConfigCols = await db.queryAll(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'guild_config'
        AND column_name LIKE 'catchup%'
        ORDER BY ordinal_position
    `);

    console.log('\n📋 Colonnes catchup dans guild_config:');
    if (guildConfigCols.length === 0) {
        console.log('  (aucune)');
    } else {
        console.table(guildConfigCols);
    }

    // 4. Vérifier si daily_catchup_config existe et sa structure
    const catchupConfigExists = tables.find(t => t.table_name === 'daily_catchup_config');
    if (catchupConfigExists) {
        console.log('\n📋 Structure de daily_catchup_config:');
        const cols = await db.queryAll(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'daily_catchup_config'
            ORDER BY ordinal_position
        `);
        console.table(cols);
    }

    process.exit(0);
}

check();
