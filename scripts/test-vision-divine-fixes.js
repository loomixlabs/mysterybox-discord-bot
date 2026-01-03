const db = require('../utils/database-pg');

/**
 * Tester les corrections Vision Divine:
 * 1. Vérifier que la charge est correctement déduite
 * 2. Vérifier le mécanisme de tracking (via logs)
 */
async function testVisionDivineFixes() {
  try {
    const guildId = '1248028543389143070'; // Serveur de test
    const userId = '692649463805640724'; // CharlotteGND

    console.log('🧪 TEST DES CORRECTIONS VISION DIVINE\n');
    console.log('='.repeat(80));

    // 1. Récupérer Vision Divine dans super_bonuses
    const visionDivine = await db.queryOne(
      `SELECT * FROM super_bonuses WHERE name = 'Vision Divine' AND guild_id = $1`,
      [guildId]
    );

    if (!visionDivine) {
      console.log('❌ Vision Divine introuvable dans super_bonuses\n');
      process.exit(1);
    }

    console.log(`✅ Vision Divine trouvé (ID: ${visionDivine.id})\n`);

    // 2. Récupérer l'état actuel du bonus du joueur
    const currentBonus = await db.queryOne(`
      SELECT * FROM player_active_bonuses
      WHERE user_id = $1
      AND guild_id = $2
      AND bonus_id = $3
      ORDER BY id DESC
      LIMIT 1
    `, [userId, guildId, visionDivine.id]);

    if (!currentBonus) {
      console.log('❌ CharlotteGND n\'a pas Vision Divine active\n');
      console.log('💡 Donne-lui d\'abord Vision Divine via /super-admin-panel\n');
      process.exit(0);
    }

    console.log('📊 État actuel de Vision Divine:');
    console.log(`   - ID dans player_active_bonuses: ${currentBonus.id}`);
    console.log(`   - Charges restantes: ${currentBonus.remaining_charges}`);
    console.log(`   - Actif: ${currentBonus.is_active ? '✅' : '❌'}`);
    console.log(`   - Activé le: ${currentBonus.activated_at ? new Date(currentBonus.activated_at).toLocaleString('fr-FR') : 'NON ACTIVÉ'}\n`);

    // 3. Tester decrementBonusCharge avec guildId
    console.log('🧪 TEST 1: Déduction de charge avec guildId\n');

    const chargesBefore = currentBonus.remaining_charges;
    console.log(`   Charges AVANT: ${chargesBefore}`);

    // Simuler la déduction (ne PAS vraiment déduire, juste vérifier la syntaxe)
    console.log(`   ⚠️  Pour tester réellement, le bot doit consommer une charge via Vision Divine`);
    console.log(`   La fonction db.decrementBonusCharge(guildId, activeBonusId) attend maintenant 2 paramètres\n`);

    // 4. Vérifier les logs récents pour voir si Vision Divine a été utilisé
    console.log('🧪 TEST 2: Vérification des logs de give\n');

    const recentGives = await db.query(`
      SELECT gl.*,
             CASE
               WHEN gl.winner_id IS NULL THEN 'Disponible'
               ELSE 'Attribué à ' || gl.winner_username
             END as status
      FROM give_logs gl
      WHERE gl.guild_id = $1
      ORDER BY gl.created_at DESC
      LIMIT 5
    `, [guildId]);

    console.log(`   Dernières mystery boxes / gives:`);
    recentGives.forEach((give, index) => {
      console.log(`   ${index + 1}. Message ${give.message_id} - ${give.status} - ${new Date(give.created_at).toLocaleString('fr-FR')}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Tests terminés\n');
    console.log('💡 INSTRUCTIONS DE TEST MANUEL:\n');
    console.log('1. Va sur Discord et clique "Ouvrir" sur une mystery box');
    console.log('2. Si tu as Vision Divine, tu devrais voir le contenu révélé');
    console.log('3. Clique "Passer" pour décliner');
    console.log('4. Vérifie que la charge a été déduite via /profile');
    console.log('5. Re-clique "Ouvrir" sur la MÊME boîte');
    console.log('6. Vision Divine NE DOIT PAS se déclencher à nouveau');
    console.log('7. La boîte doit s\'ouvrir normalement');
    console.log('8. Clique "Accepter" pour tester le flow complet\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

testVisionDivineFixes();
