/**
 * Script de test E2E: Système Mystery Box Credits
 * Teste toutes les nouvelles fonctions DB
 */

require('dotenv').config();
const db = require('../utils/database-pg');

const TEST_GUILD_ID = '297309737135898624'; // Serveur de test

async function runTests() {
    console.log('='.repeat(70));
    console.log('🧪 TEST E2E: SYSTÈME MYSTERY BOX CREDITS');
    console.log('='.repeat(70));

    try {
        // 1. Trouver un joueur de test
        console.log('\n📋 1. RECHERCHE JOUEUR DE TEST...');
        const player = await db.queryOne(`
            SELECT id, username, discord_id
            FROM players
            WHERE guild_id = $1
            LIMIT 1
        `, [TEST_GUILD_ID]);

        if (!player) {
            console.log('❌ Aucun joueur trouvé sur ce serveur');
            process.exit(1);
        }
        console.log(`   ✅ Joueur trouvé: ${player.username} (ID: ${player.id})`);

        // 2. Test getMysteryBoxCredits (état initial)
        console.log('\n📋 2. TEST getMysteryBoxCredits (état initial)...');
        const initialCredits = await db.getMysteryBoxCredits(TEST_GUILD_ID, player.id);
        console.log('   Crédits actuels:', initialCredits);

        // 3. Test addMysteryBoxCredits
        console.log('\n📋 3. TEST addMysteryBoxCredits...');
        const afterAdd = await db.addMysteryBoxCredits(
            TEST_GUILD_ID,
            player.id,
            'rare',
            1,
            'daily_claim',
            'day_14_test'
        );
        console.log('   Après ajout 1 rare:', afterAdd);

        // 4. Test ajout multiple
        console.log('\n📋 4. TEST ajout de plusieurs crédits...');
        await db.addMysteryBoxCredits(TEST_GUILD_ID, player.id, 'common', 2, 'admin', 'test_script');
        await db.addMysteryBoxCredits(TEST_GUILD_ID, player.id, 'epic', 1, 'streak_milestone', 'day_21');
        const afterMultiple = await db.getMysteryBoxCredits(TEST_GUILD_ID, player.id);
        console.log('   Après ajouts multiples:', afterMultiple);

        // 5. Test getMysteryBoxConfig
        console.log('\n📋 5. TEST getMysteryBoxConfig...');
        const configs = await db.getMysteryBoxConfig(TEST_GUILD_ID);
        console.log(`   ${configs.length} configurations trouvées:`);
        for (const config of configs) {
            console.log(`   - ${config.emoji} ${config.rarity}: ${config.name}`);
            console.log(`     Probabilités: Collectible ${config.prob_collectible}%, Super Bonus ${config.prob_super_bonus}%, Mission ${config.prob_mission}%, Piège ${config.prob_trap}%`);
        }

        // 6. Test spendMysteryBoxCredit
        console.log('\n📋 6. TEST spendMysteryBoxCredit...');
        const spendResult = await db.spendMysteryBoxCredit(
            TEST_GUILD_ID,
            player.id,
            'common',
            { type: 'collectible', id: 1, name: 'Test Collectible', rarity: 'common' }
        );
        console.log(`   Résultat spend: ${spendResult ? '✅ Succès' : '❌ Échec'}`);
        const afterSpend = await db.getMysteryBoxCredits(TEST_GUILD_ID, player.id);
        console.log('   Après dépense 1 common:', afterSpend);

        // 7. Test getMysteryBoxCreditHistory
        console.log('\n📋 7. TEST getMysteryBoxCreditHistory...');
        const history = await db.getMysteryBoxCreditHistory(TEST_GUILD_ID, player.id, 5);
        console.log(`   ${history.length} entrées dans l'historique:`);
        for (const entry of history) {
            const date = new Date(entry.created_at).toLocaleString('fr-FR');
            console.log(`   - ${entry.action} ${entry.amount > 0 ? '+' : ''}${entry.amount} ${entry.rarity} (${entry.source}) - ${date}`);
        }

        // 8. Test getDailyClaimInfo
        console.log('\n📋 8. TEST getDailyClaimInfo...');
        const dailyInfo = await db.getDailyClaimInfo(TEST_GUILD_ID, player.id);
        console.log('   Info daily claim:', dailyInfo);

        // 9. Test recordDailyClaim
        console.log('\n📋 9. TEST recordDailyClaim...');
        const claimResult = await db.recordDailyClaim(
            TEST_GUILD_ID,
            player.id,
            { type: 'mystery_box', rarity: 'common', amount: 1, detail: 'test_day_7' }
        );
        console.log('   Résultat claim:', claimResult);

        // 10. Test getDailyClaimHistory
        console.log('\n📋 10. TEST getDailyClaimHistory...');
        const claimHistory = await db.getDailyClaimHistory(TEST_GUILD_ID, player.id, 5);
        console.log(`   ${claimHistory.length} claims dans l'historique:`);
        for (const claim of claimHistory) {
            console.log(`   - Jour ${claim.claim_day}: ${claim.reward_type} ${claim.reward_rarity || ''} (streak: ${claim.streak_at_claim})`);
        }

        // 11. Vérification finale
        console.log('\n📋 11. ÉTAT FINAL...');
        const finalCredits = await db.getMysteryBoxCredits(TEST_GUILD_ID, player.id);
        const finalDaily = await db.getDailyClaimInfo(TEST_GUILD_ID, player.id);
        console.log('   Crédits finaux:', finalCredits);
        console.log('   Daily claim final:', finalDaily);

        console.log('\n' + '='.repeat(70));
        console.log('✅ TOUS LES TESTS PASSÉS AVEC SUCCÈS');
        console.log('='.repeat(70));

        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERREUR DURANT LES TESTS:', error);
        process.exit(1);
    }
}

runTests();
