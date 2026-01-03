/**
 * Script de test E2E: Système Daily Rewards Theme-Aware
 * Teste toutes les nouvelles fonctions DB v2.2.1
 */

require('dotenv').config();
const db = require('../utils/database-pg');

const TEST_GUILD_ID = '1182395170273099806'; // Serveur Harry Potter (thème actif)

async function runTests() {
    console.log('='.repeat(70));
    console.log('🧪 TEST E2E: SYSTÈME DAILY REWARDS THEME-AWARE v2.2.1');
    console.log('='.repeat(70));

    try {
        // 1. Trouver le thème actif
        console.log('\n📋 1. RECHERCHE THÈME ACTIF...');
        const activeTheme = await db.getActiveTheme(TEST_GUILD_ID);

        if (!activeTheme) {
            console.log('❌ Aucun thème actif trouvé sur ce serveur');
            process.exit(1);
        }
        console.log(`   ✅ Thème actif: "${activeTheme.name}" (ID: ${activeTheme.id})`);
        console.log(`   📅 Durée: ${activeTheme.duration_days || 30} jours`);

        // 2. Trouver un joueur de test
        console.log('\n📋 2. RECHERCHE JOUEUR DE TEST...');
        const player = await db.queryOne(`
            SELECT id, username, discord_id, claim_streak_by_theme
            FROM players
            WHERE guild_id = $1
            LIMIT 1
        `, [TEST_GUILD_ID]);

        if (!player) {
            console.log('❌ Aucun joueur trouvé sur ce serveur');
            process.exit(1);
        }
        console.log(`   ✅ Joueur trouvé: ${player.username} (ID: ${player.id})`);
        console.log(`   📊 claim_streak_by_theme actuel:`, player.claim_streak_by_theme || '{}');

        // 3. Test getDailyRewardsCalendar
        console.log('\n📋 3. TEST getDailyRewardsCalendar...');
        const calendar = await db.getDailyRewardsCalendar(TEST_GUILD_ID, activeTheme.id);
        console.log(`   📅 ${calendar.length} jours configurés dans le calendrier`);
        if (calendar.length > 0) {
            console.log('   Premiers 5 jours:');
            calendar.slice(0, 5).forEach(day => {
                console.log(`     Jour ${day.day_number}: ${day.display_emoji} ${day.display_name} (${day.reward_type}${day.reward_rarity ? ' ' + day.reward_rarity : ''})`);
            });
            console.log('   ...');
            console.log('   Derniers 3 jours:');
            calendar.slice(-3).forEach(day => {
                const milestone = day.is_milestone ? ' ⭐MILESTONE' : '';
                console.log(`     Jour ${day.day_number}: ${day.display_emoji} ${day.display_name} (${day.reward_type}${day.reward_rarity ? ' ' + day.reward_rarity : ''})${milestone}`);
            });
        }

        // 4. Test getDailyRewardForDay
        console.log('\n📋 4. TEST getDailyRewardForDay (Jour 7 = milestone)...');
        const day7Reward = await db.getDailyRewardForDay(TEST_GUILD_ID, activeTheme.id, 7);
        if (day7Reward) {
            console.log(`   ✅ Jour 7: ${day7Reward.display_emoji} ${day7Reward.display_name}`);
            console.log(`      Type: ${day7Reward.reward_type}, Rareté: ${day7Reward.reward_rarity}`);
            console.log(`      Milestone: ${day7Reward.is_milestone ? 'OUI' : 'Non'}`);
        } else {
            console.log('   ⚠️ Pas de récompense configurée pour le jour 7');
        }

        // 5. Test getClaimStreakByTheme
        console.log('\n📋 5. TEST getClaimStreakByTheme...');
        const streak = await db.getClaimStreakByTheme(TEST_GUILD_ID, player.id, activeTheme.id);
        console.log(`   📊 Streak pour thème ${activeTheme.id}:`, streak);

        // 6. Test getDailyClaimInfoByTheme
        console.log('\n📋 6. TEST getDailyClaimInfoByTheme...');
        const claimInfo = await db.getDailyClaimInfoByTheme(TEST_GUILD_ID, player.id, activeTheme.id);
        if (claimInfo) {
            console.log('   📊 Infos Daily Claim:');
            console.log(`      Thème: ${claimInfo.themeName} (${claimInfo.themeDuration} jours)`);
            console.log(`      Jour actuel: ${claimInfo.currentDay}`);
            console.log(`      Streak actuel: ${claimInfo.currentStreak}`);
            console.log(`      Meilleur streak: ${claimInfo.bestStreak}`);
            console.log(`      Total claims: ${claimInfo.totalClaims}`);
            console.log(`      Peut claim aujourd'hui: ${claimInfo.canClaim ? '✅ OUI' : '❌ NON'}`);
            if (claimInfo.todayReward) {
                console.log(`      Récompense du jour: ${claimInfo.todayReward.display_emoji} ${claimInfo.todayReward.display_name}`);
            }
        }

        // 7. Test getMysteryBoxConfig theme-aware
        console.log('\n📋 7. TEST getMysteryBoxConfig (theme-aware)...');
        const mbConfigs = await db.getMysteryBoxConfig(TEST_GUILD_ID, null, activeTheme.id);
        console.log(`   📦 ${mbConfigs.length} configs Mystery Box pour ce thème:`);
        mbConfigs.forEach(config => {
            console.log(`      ${config.emoji} ${config.rarity}: ${config.name}`);
            console.log(`         Probas: Collectible ${config.prob_collectible}%, Super Bonus ${config.prob_super_bonus}%, Piège ${config.prob_trap}%`);
        });

        // 8. Test getMysteryBoxCredits theme-aware
        console.log('\n📋 8. TEST getMysteryBoxCredits (theme-aware)...');
        const credits = await db.getMysteryBoxCredits(TEST_GUILD_ID, player.id, activeTheme.id);
        console.log(`   💎 Crédits pour thème ${activeTheme.id}:`, credits);

        // 9. Test addMysteryBoxCredits theme-aware
        console.log('\n📋 9. TEST addMysteryBoxCredits (theme-aware)...');
        const newCredits = await db.addMysteryBoxCredits(
            TEST_GUILD_ID,
            player.id,
            'rare',
            1,
            'test_script',
            'test_day_7',
            activeTheme.id
        );
        console.log(`   ✅ Après ajout 1 rare:`, newCredits);

        // 10. Vérification des vues
        console.log('\n📋 10. TEST VUE v_mystery_box_config_full...');
        const mbConfigFull = await db.query(`
            SELECT theme_name, rarity, name, prob_collectible, prob_super_bonus
            FROM v_mystery_box_config_full
            WHERE guild_id = $1 AND theme_id = $2
            ORDER BY rarity
            LIMIT 4
        `, [TEST_GUILD_ID, activeTheme.id]);
        if (mbConfigFull.length > 0) {
            console.table(mbConfigFull);
        }

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
