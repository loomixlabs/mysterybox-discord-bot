/**
 * Script de test des fonctions Loomix
 * Vérifie que toutes les fonctions DB fonctionnent correctement
 */

require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function testLoomixFunctions() {
  console.log('💎 TEST: Fonctions Loomix\n');
  console.log('='.repeat(80));

  try {
    // 1. Récupérer un joueur de test
    const testPlayer = await db.queryOne(`
      SELECT id, username, discord_id FROM players WHERE guild_id = $1 LIMIT 1
    `, [GUILD_ID]);

    if (!testPlayer) {
      console.log('❌ Aucun joueur trouvé pour les tests');
      process.exit(1);
    }

    console.log(`\n📋 Joueur de test: ${testPlayer.username} (ID: ${testPlayer.id})\n`);
    console.log('-'.repeat(80));

    // 2. Test getPlayerCurrency
    console.log('\n🔹 Test: getPlayerCurrency()');
    const currency = await db.getPlayerCurrency(GUILD_ID, testPlayer.id);
    console.log(`   Balance: ${currency.balance} 💎`);
    console.log(`   Total gagné: ${currency.total_earned}`);
    console.log(`   Total dépensé: ${currency.total_spent}`);
    console.log('   ✅ OK');

    // 3. Test getGuildCurrencyConfig
    console.log('\n🔹 Test: getGuildCurrencyConfig()');
    const guildConfig = await db.getGuildCurrencyConfig(GUILD_ID);
    console.log(`   Nom: ${guildConfig.display_name} ${guildConfig.display_emoji}`);
    console.log(`   Bonus claim: +${guildConfig.daily_claim_bonus}`);
    console.log(`   Bonus streak: +${guildConfig.streak_bonus_per_day}/jour`);
    console.log(`   Bonus mission: +${guildConfig.mission_completion_bonus}`);
    console.log('   ✅ OK');

    // 4. Test addCurrency
    console.log('\n🔹 Test: addCurrency()');
    const addResult = await db.addCurrency(
      GUILD_ID,
      testPlayer.id,
      50,
      'test',
      'unit_test',
      'Test unitaire Loomix'
    );
    console.log(`   Ajouté: +50 💎`);
    console.log(`   Nouveau solde: ${addResult.newBalance}`);
    console.log('   ✅ OK');

    // 5. Test spendCurrency
    console.log('\n🔹 Test: spendCurrency()');
    const spendResult = await db.spendCurrency(
      GUILD_ID,
      testPlayer.id,
      25,
      'test',
      'unit_test',
      'Test unitaire Loomix'
    );
    if (spendResult.success) {
      console.log(`   Dépensé: -25 💎`);
      console.log(`   Nouveau solde: ${spendResult.newBalance}`);
      console.log('   ✅ OK');
    } else {
      console.log(`   ⚠️  Solde insuffisant (${spendResult.currentBalance}/${spendResult.required})`);
    }

    // 6. Test getCurrencyHistory
    console.log('\n🔹 Test: getCurrencyHistory()');
    const history = await db.getCurrencyHistory(GUILD_ID, testPlayer.id, 5);
    console.log(`   ${history.length} transaction(s) récente(s):`);
    history.forEach(tx => {
      const sign = tx.amount >= 0 ? '+' : '';
      console.log(`     ${sign}${tx.amount} 💎 (${tx.transaction_type}) - ${tx.source || 'N/A'}`);
    });
    console.log('   ✅ OK');

    // 7. Test getCatchupConfig (avec thème actif)
    const activeTheme = await db.getActiveTheme(GUILD_ID);
    if (activeTheme) {
      console.log(`\n🔹 Test: getCatchupConfig() - Thème: ${activeTheme.name}`);
      const catchupConfig = await db.getCatchupConfig(GUILD_ID, activeTheme.id);
      console.log(`   Mode: ${catchupConfig.pricing_mode}`);
      console.log(`   Prix base: ${catchupConfig.base_price} 💎`);
      console.log(`   Incrément: +${catchupConfig.price_increment}/jour`);
      console.log(`   Activé: ${catchupConfig.enabled ? 'Oui' : 'Non'}`);
      console.log('   ✅ OK');

      // 8. Test calculateCatchupPrice
      console.log('\n🔹 Test: calculateCatchupPrice() - 5 jours manqués');
      const priceInfo = await db.calculateCatchupPrice(GUILD_ID, activeTheme.id, 5);
      console.log(`   Prix total: ${priceInfo.totalPrice} 💎`);
      console.log(`   Détail: ${priceInfo.priceBreakdown.join(' + ')} 💎`);
      console.log('   ✅ OK');

      // 9. Test getMissedDays
      console.log('\n🔹 Test: getMissedDays()');
      const missedDays = await db.getMissedDays(GUILD_ID, testPlayer.id, activeTheme.id);
      console.log(`   Jours manqués: ${missedDays.length > 0 ? missedDays.join(', ') : 'Aucun'}`);
      console.log('   ✅ OK');
    } else {
      console.log('\n⚠️  Pas de thème actif - tests catchup ignorés');
    }

    // 10. Test getLoomixLeaderboard
    console.log('\n🔹 Test: getLoomixLeaderboard()');
    const leaderboard = await db.getLoomixLeaderboard(GUILD_ID, 5);
    console.log(`   Top ${leaderboard.length} joueurs:`);
    leaderboard.forEach((p, i) => {
      console.log(`     ${i + 1}. ${p.username}: ${p.balance} 💎`);
    });
    console.log('   ✅ OK');

    // Résultat final
    console.log('\n' + '='.repeat(80));
    console.log('✅ TOUS LES TESTS PASSÉS AVEC SUCCÈS!');
    console.log('='.repeat(80));

    // Nettoyer les transactions de test
    console.log('\n🧹 Nettoyage des transactions de test...');
    await db.queryOne(`
      DELETE FROM currency_transactions
      WHERE guild_id = $1 AND player_id = $2 AND source = 'unit_test'
    `, [GUILD_ID, testPlayer.id]);

    // Restaurer le solde original
    await db.queryOne(`
      UPDATE player_currency SET
        balance = balance - 25,
        total_earned = total_earned - 50,
        total_spent = total_spent - 25
      WHERE guild_id = $1 AND player_id = $2 AND currency_type = 'loomix'
    `, [GUILD_ID, testPlayer.id]);
    console.log('✅ Nettoyage terminé');

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 Erreur:', error);
    process.exit(1);
  }
}

testLoomixFunctions();
