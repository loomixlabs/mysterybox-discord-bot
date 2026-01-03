/**
 * Script de vérification pour le système Mystery Box Credits par rareté
 * Vérifie la structure DB actuelle et prépare la migration
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function verify() {
    console.log('='.repeat(70));
    console.log('🎁 VÉRIFICATION STRUCTURE DB POUR MYSTERY BOX CREDITS');
    console.log('='.repeat(70));

    try {
        // 1. Vérifier les raretés existantes dans collectibles
        console.log('\n📦 1. RARETÉS DES COLLECTIBLES:');
        const collectibleRarities = await pool.query(`
            SELECT rarity, COUNT(*) as count
            FROM collectibles
            GROUP BY rarity
            ORDER BY
                CASE rarity
                    WHEN 'legendary' THEN 1
                    WHEN 'epic' THEN 2
                    WHEN 'rare' THEN 3
                    WHEN 'common' THEN 4
                END
        `);
        console.table(collectibleRarities.rows);

        // 2. Vérifier les raretés dans super_bonuses
        console.log('\n⭐ 2. RARETÉS DES SUPER BONUS:');
        const bonusRarities = await pool.query(`
            SELECT rarity, COUNT(*) as count
            FROM super_bonuses
            GROUP BY rarity
            ORDER BY rarity
        `);
        console.table(bonusRarities.rows);

        // 3. Structure table players (colonnes existantes)
        console.log('\n👤 3. COLONNES TABLE PLAYERS:');
        const playerCols = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'players'
            ORDER BY ordinal_position
        `);
        console.table(playerCols.rows);

        // 4. Vérifier si la table player_mystery_box_credits existe déjà
        console.log('\n🔍 4. TABLE player_mystery_box_credits EXISTANTE ?');
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'player_mystery_box_credits'
            ) as exists
        `);
        console.log(`   Existe: ${tableExists.rows[0].exists ? '✅ OUI' : '❌ NON'}`);

        // 5. Vérifier la table give_logs (pour le logging)
        console.log('\n📝 5. STRUCTURE TABLE GIVE_LOGS:');
        const giveLogsCols = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'give_logs'
            ORDER BY ordinal_position
        `);
        console.table(giveLogsCols.rows);

        // 6. Vérifier les tables de log existantes
        console.log('\n📋 6. TABLES DE LOGS DISPONIBLES:');
        const logTables = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name LIKE '%log%'
            ORDER BY table_name
        `);
        console.table(logTables.rows);

        // 7. Colonnes streak/daily dans players
        console.log('\n📅 7. COLONNES DAILY/STREAK DANS PLAYERS:');
        const dailyCols = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'players'
            AND (column_name LIKE '%login%' OR column_name LIKE '%streak%' OR column_name LIKE '%daily%')
            ORDER BY column_name
        `);
        if (dailyCols.rows.length > 0) {
            console.table(dailyCols.rows);
        } else {
            console.log('   Aucune colonne daily/streak trouvée');
        }

        // 8. Nombre de joueurs par serveur
        console.log('\n👥 8. JOUEURS PAR SERVEUR:');
        const playersByGuild = await pool.query(`
            SELECT guild_id, COUNT(*) as players_count
            FROM players
            GROUP BY guild_id
            ORDER BY players_count DESC
        `);
        console.table(playersByGuild.rows);

        console.log('\n' + '='.repeat(70));
        console.log('✅ VÉRIFICATION TERMINÉE');
        console.log('='.repeat(70));

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

verify();
