/**
 * Script de migration: Daily Rewards Calendar & Personnalisation MB
 * Version: 2.2.1
 *
 * Ce script:
 * - Crée daily_rewards_config (calendrier 30 jours PAR THÈME)
 * - Étend mystery_box_config (personnalisation complète + theme_id)
 * - Ajoute theme_id aux tables existantes
 * - Ajoute colonnes aux give_campaigns et give_logs
 * - Crée mystery_box_pity_counter
 * - Insère les calendriers par défaut pour tous les thèmes existants
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigration() {
    console.log('='.repeat(70));
    console.log('📅 MIGRATION: DAILY REWARDS CALENDAR & PERSONNALISATION MB');
    console.log('   (Liés aux THÈMES - chaque thème a ses propres configs)');
    console.log('='.repeat(70));
    console.log(`📆 Date: ${new Date().toISOString()}`);
    console.log('');

    const client = await pool.connect();

    try {
        // Lire le fichier SQL
        const sqlPath = path.join(__dirname, '../database/migrations/add-daily-rewards-calendar.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 Fichier SQL chargé');
        console.log('🚀 Exécution de la migration...\n');

        // Exécuter la migration dans une transaction
        await client.query('BEGIN');

        // Exécuter le SQL
        await client.query(sql);

        await client.query('COMMIT');
        console.log('✅ Migration SQL exécutée avec succès\n');

        // Insérer les calendriers par défaut pour les thèmes existants
        console.log('📅 Insertion des calendriers par défaut pour les thèmes existants...\n');
        await insertDefaultCalendarsForThemes(client);

        // Insérer les configs Mystery Box par défaut pour les thèmes existants
        console.log('\n📦 Insertion des configs Mystery Box par défaut pour les thèmes...\n');
        await insertDefaultMysteryBoxConfigsForThemes(client);

        // Vérification finale
        console.log('\n🔍 VÉRIFICATION POST-MIGRATION:\n');
        await verifyMigration(client);

        console.log('\n' + '='.repeat(70));
        console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS');
        console.log('='.repeat(70));

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

async function insertDefaultCalendarsForThemes(client) {
    // Récupérer tous les thèmes existants AVEC leur duration_days
    const themes = await client.query(`
        SELECT t.id as theme_id, t.guild_id, t.name, t.duration_days
        FROM themes t
        ORDER BY t.guild_id, t.id
    `);

    console.log(`   📋 ${themes.rows.length} thème(s) trouvé(s)`);

    for (const theme of themes.rows) {
        const durationDays = theme.duration_days || 30; // Fallback à 30 si non défini

        // Utiliser la fonction avec la durée du thème
        await client.query(
            'SELECT insert_default_daily_rewards($1, $2, $3)',
            [theme.guild_id, theme.theme_id, durationDays]
        );

        // Compter les jours insérés
        const count = await client.query(
            'SELECT COUNT(*) as count FROM daily_rewards_config WHERE guild_id = $1 AND theme_id = $2',
            [theme.guild_id, theme.theme_id]
        );

        console.log(`   ✅ Thème "${theme.name}" (ID: ${theme.theme_id}): ${count.rows[0].count}/${durationDays} jours configurés`);
    }
}

async function insertDefaultMysteryBoxConfigsForThemes(client) {
    // Récupérer tous les thèmes existants
    const themes = await client.query(`
        SELECT t.id as theme_id, t.guild_id, t.name
        FROM themes t
        ORDER BY t.guild_id, t.id
    `);

    for (const theme of themes.rows) {
        // Utiliser la fonction pour insérer les configs par défaut
        await client.query('SELECT insert_default_mystery_box_config($1, $2)', [theme.guild_id, theme.theme_id]);

        // Compter les configs insérées
        const count = await client.query(
            'SELECT COUNT(*) as count FROM mystery_box_config WHERE guild_id = $1 AND theme_id = $2',
            [theme.guild_id, theme.theme_id]
        );

        console.log(`   ✅ Thème "${theme.name}": ${count.rows[0].count}/4 configs Mystery Box`);
    }
}

async function verifyMigration(client) {
    // 1. Vérifier la table daily_rewards_config
    console.log('📋 Table daily_rewards_config:');
    const tableExists = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'daily_rewards_config'
        ) as exists
    `);
    console.log(`   ${tableExists.rows[0].exists ? '✅' : '❌'} Table créée`);

    // Vérifier la colonne theme_id
    const themeIdExists = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'daily_rewards_config' AND column_name = 'theme_id'
        ) as exists
    `);
    console.log(`   ${themeIdExists.rows[0].exists ? '✅' : '❌'} Colonne theme_id`);

    // 2. Vérifier les nouvelles colonnes de mystery_box_config
    console.log('\n📋 Nouvelles colonnes mystery_box_config:');
    const newColumns = [
        'theme_id', 'image_closed', 'image_opening', 'image_opened', 'image_empty',
        'text_title', 'text_description', 'text_opening', 'text_success', 'text_empty',
        'specific_collectibles', 'specific_super_bonuses', 'specific_traps',
        'pity_system_enabled', 'pity_counter_max',
        'total_opened', 'last_opened_at'
    ];

    for (const col of newColumns) {
        const result = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'mystery_box_config' AND column_name = $1
            ) as exists
        `, [col]);
        const status = result.rows[0].exists ? '✅' : '❌';
        console.log(`   ${status} ${col}`);
    }

    // 3. Vérifier theme_id dans player_mystery_box_credits
    console.log('\n📋 Colonne theme_id dans player_mystery_box_credits:');
    const creditsThemeId = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'player_mystery_box_credits' AND column_name = 'theme_id'
        ) as exists
    `);
    console.log(`   ${creditsThemeId.rows[0].exists ? '✅' : '❌'} theme_id`);

    // 4. Vérifier theme_id dans mystery_box_credit_logs
    console.log('\n📋 Colonne theme_id dans mystery_box_credit_logs:');
    const logsThemeId = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'mystery_box_credit_logs' AND column_name = 'theme_id'
        ) as exists
    `);
    console.log(`   ${logsThemeId.rows[0].exists ? '✅' : '❌'} theme_id`);

    // 5. Vérifier les colonnes give_campaigns
    console.log('\n📋 Nouvelles colonnes give_campaigns:');
    const campaignCols = ['give_type', 'mystery_box_rarity', 'mystery_box_quantity'];
    for (const col of campaignCols) {
        const result = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'give_campaigns' AND column_name = $1
            ) as exists
        `, [col]);
        const status = result.rows[0].exists ? '✅' : '❌';
        console.log(`   ${status} ${col}`);
    }

    // 6. Vérifier les colonnes give_logs
    console.log('\n📋 Nouvelles colonnes give_logs:');
    const logCols = ['mystery_box_rarity', 'mystery_box_credits_given'];
    for (const col of logCols) {
        const result = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'give_logs' AND column_name = $1
            ) as exists
        `, [col]);
        const status = result.rows[0].exists ? '✅' : '❌';
        console.log(`   ${status} ${col}`);
    }

    // 7. Vérifier la table mystery_box_pity_counter
    console.log('\n📋 Table mystery_box_pity_counter:');
    const pityExists = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'mystery_box_pity_counter'
        ) as exists
    `);
    console.log(`   ${pityExists.rows[0].exists ? '✅' : '❌'} Table créée`);

    // 8. Aperçu du calendrier par thème
    console.log('\n📋 Aperçu calendriers par thème:');
    const calendarStats = await client.query(`
        SELECT
            t.name as theme_name,
            drc.guild_id,
            COUNT(*) as days_configured,
            SUM(CASE WHEN drc.is_milestone THEN 1 ELSE 0 END) as milestones
        FROM daily_rewards_config drc
        JOIN themes t ON drc.theme_id = t.id
        GROUP BY t.name, drc.guild_id
        ORDER BY drc.guild_id, t.name
    `);
    if (calendarStats.rows.length > 0) {
        console.table(calendarStats.rows);
    } else {
        console.log('   (aucun calendrier configuré)');
    }

    // 9. Aperçu des configs Mystery Box par thème
    console.log('\n📋 Configs Mystery Box par thème:');
    const mbConfigStats = await client.query(`
        SELECT
            t.name as theme_name,
            mbc.rarity,
            mbc.name as box_name,
            mbc.prob_collectible || '% coll' as collectible,
            mbc.prob_super_bonus || '% bonus' as bonus
        FROM mystery_box_config mbc
        JOIN themes t ON mbc.theme_id = t.id
        ORDER BY t.name, mbc.rarity
        LIMIT 16
    `);
    if (mbConfigStats.rows.length > 0) {
        console.table(mbConfigStats.rows);
    }

    // 10. Vérifier les vues
    console.log('\n📋 Vues créées:');
    const views = ['v_daily_rewards_calendar', 'v_mystery_box_config_full'];
    for (const view of views) {
        const viewResult = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.views
                WHERE table_name = $1
            ) as exists
        `, [view]);
        console.log(`   ${viewResult.rows[0].exists ? '✅' : '❌'} ${view}`);
    }

    // 11. Vérifier les fonctions
    console.log('\n📋 Fonctions créées:');
    const functions = ['insert_default_daily_rewards', 'insert_default_mystery_box_config'];
    for (const func of functions) {
        const funcResult = await client.query(`
            SELECT EXISTS (
                SELECT FROM pg_proc
                WHERE proname = $1
            ) as exists
        `, [func]);
        console.log(`   ${funcResult.rows[0].exists ? '✅' : '❌'} ${func}()`);
    }

    // 12. Colonne claim_streak_by_theme dans players
    console.log('\n📋 Colonne claim_streak_by_theme dans players:');
    const streakCol = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'players' AND column_name = 'claim_streak_by_theme'
        ) as exists
    `);
    console.log(`   ${streakCol.rows[0].exists ? '✅' : '❌'} claim_streak_by_theme (JSONB)`);
}

// Exécuter
runMigration().catch(error => {
    console.error('❌ Migration échouée:', error);
    process.exit(1);
});
