/**
 * Script de migration: Système Mystery Box Credits par Rareté
 * Version: 2.2.0
 *
 * Ce script crée:
 * - player_mystery_box_credits: Crédits par rareté
 * - mystery_box_credit_logs: Historique des opérations
 * - daily_claim_logs: Historique des claims quotidiens
 * - mystery_box_config: Configuration personnalisable
 * - Colonnes daily claim dans players
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
    console.log('🎁 MIGRATION: SYSTÈME MYSTERY BOX CREDITS PAR RARETÉ');
    console.log('='.repeat(70));
    console.log(`📅 Date: ${new Date().toISOString()}`);
    console.log('');

    const client = await pool.connect();

    try {
        // Lire le fichier SQL
        const sqlPath = path.join(__dirname, '../database/migrations/add-mystery-box-credits-system.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 Fichier SQL chargé');
        console.log('🚀 Exécution de la migration...\n');

        // Exécuter la migration dans une transaction
        await client.query('BEGIN');

        // Exécuter le SQL
        await client.query(sql);

        await client.query('COMMIT');
        console.log('✅ Migration SQL exécutée avec succès\n');

        // Insérer les configurations par défaut pour les serveurs existants
        console.log('📦 Insertion des configurations par défaut...\n');
        await insertDefaultConfigs(client);

        // Vérification finale
        console.log('🔍 VÉRIFICATION POST-MIGRATION:\n');
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

async function insertDefaultConfigs(client) {
    // Récupérer tous les guilds existants
    const guilds = await client.query('SELECT guild_id FROM guild_config');

    for (const guild of guilds.rows) {
        const guildId = guild.guild_id;

        // Configuration par défaut pour chaque rareté
        const defaultConfigs = [
            {
                rarity: 'common',
                name: '📦 Mystery Box Commune',
                emoji: '📦',
                color: '#95A5A6',
                prob_collectible: 70,
                prob_super_bonus: 10,
                prob_mission: 15,
                prob_trap: 5,
                guaranteed_min_rarity: 'common',
                rarity_upgrade_epic: 0,
                rarity_upgrade_legendary: 0
            },
            {
                rarity: 'rare',
                name: '💙 Mystery Box Rare',
                emoji: '💎',
                color: '#3498DB',
                prob_collectible: 65,
                prob_super_bonus: 20,
                prob_mission: 10,
                prob_trap: 5,
                guaranteed_min_rarity: 'rare',
                rarity_upgrade_epic: 20,
                rarity_upgrade_legendary: 5
            },
            {
                rarity: 'epic',
                name: '💜 Mystery Box Épique',
                emoji: '🔮',
                color: '#9B59B6',
                prob_collectible: 60,
                prob_super_bonus: 30,
                prob_mission: 8,
                prob_trap: 2,
                guaranteed_min_rarity: 'epic',
                rarity_upgrade_epic: 0,
                rarity_upgrade_legendary: 25
            },
            {
                rarity: 'legendary',
                name: '👑 Coffre Légendaire',
                emoji: '👑',
                color: '#F1C40F',
                prob_collectible: 55,
                prob_super_bonus: 40,
                prob_mission: 5,
                prob_trap: 0,
                guaranteed_min_rarity: 'legendary',
                rarity_upgrade_epic: 0,
                rarity_upgrade_legendary: 0
            }
        ];

        for (const config of defaultConfigs) {
            await client.query(`
                INSERT INTO mystery_box_config (
                    guild_id, rarity, name, emoji, color,
                    prob_collectible, prob_super_bonus, prob_mission, prob_trap,
                    guaranteed_min_rarity, rarity_upgrade_epic, rarity_upgrade_legendary
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT (guild_id, rarity) DO NOTHING
            `, [
                guildId,
                config.rarity,
                config.name,
                config.emoji,
                config.color,
                config.prob_collectible,
                config.prob_super_bonus,
                config.prob_mission,
                config.prob_trap,
                config.guaranteed_min_rarity,
                config.rarity_upgrade_epic,
                config.rarity_upgrade_legendary
            ]);
        }

        console.log(`   ✅ Config créée pour guild ${guildId}`);
    }
}

async function verifyMigration(client) {
    // 1. Vérifier les tables créées
    const tables = ['player_mystery_box_credits', 'mystery_box_credit_logs', 'daily_claim_logs', 'mystery_box_config'];

    console.log('📋 Tables créées:');
    for (const table of tables) {
        const result = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = $1
            ) as exists
        `, [table]);

        const status = result.rows[0].exists ? '✅' : '❌';
        console.log(`   ${status} ${table}`);
    }

    // 2. Vérifier les colonnes ajoutées à players
    console.log('\n📋 Colonnes ajoutées à players:');
    const columns = ['last_daily_claim', 'total_daily_claims', 'current_claim_streak', 'best_claim_streak'];

    for (const col of columns) {
        const result = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'players' AND column_name = $1
            ) as exists
        `, [col]);

        const status = result.rows[0].exists ? '✅' : '❌';
        console.log(`   ${status} ${col}`);
    }

    // 3. Vérifier les configurations
    console.log('\n📋 Configurations mystery_box_config:');
    const configs = await client.query(`
        SELECT guild_id, rarity, name
        FROM mystery_box_config
        ORDER BY guild_id, rarity
    `);

    if (configs.rows.length > 0) {
        console.table(configs.rows);
    } else {
        console.log('   (aucune configuration)');
    }

    // 4. Vérifier la vue
    console.log('\n📋 Vue v_player_mystery_box_totals:');
    const viewResult = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.views
            WHERE table_name = 'v_player_mystery_box_totals'
        ) as exists
    `);
    const viewStatus = viewResult.rows[0].exists ? '✅ Créée' : '❌ Non créée';
    console.log(`   ${viewStatus}`);
}

// Exécuter
runMigration().catch(error => {
    console.error('❌ Migration échouée:', error);
    process.exit(1);
});
