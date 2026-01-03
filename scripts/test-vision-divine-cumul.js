const db = require('../utils/database-pg');

async function testVisionDivineCumul() {
  try {
    const guildId = '1248028543389143070'; // Serveur de test
    const userId = '692649463805640724'; // CharlotteGND

    console.log('🧪 TEST DE CUMUL VISION DIVINE\n');
    console.log('='.repeat(80));

    // 1. Récupérer Vision Divine dans super_bonuses
    const bonus = await db.queryOne(
      `SELECT * FROM super_bonuses WHERE name = 'Vision Divine' AND guild_id = $1`,
      [guildId]
    );

    if (!bonus) {
      console.log('❌ Vision Divine introuvable\n');
      process.exit(1);
    }

    console.log(`✅ Vision Divine trouvé (ID: ${bonus.id})\n`);

    // 2. Vérifier si le joueur a déjà ce bonus
    const existingBonus = await db.queryOne(`
      SELECT * FROM player_active_bonuses
      WHERE user_id = $1
      AND guild_id = $2
      AND bonus_id = $3
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    `, [userId, guildId, bonus.id]);

    if (!existingBonus) {
      console.log('❌ Aucun bonus existant trouvé - Le cumul ne peut pas être testé\n');
      console.log('💡 Le joueur doit avoir au moins 1 Vision Divine avant de tester le cumul\n');
      process.exit(0);
    }

    console.log(`✅ Bonus existant trouvé (ID dans player_active_bonuses: ${existingBonus.id})\n`);
    console.log('📊 État AVANT cumul:');
    console.log(`   - Charges actuelles: ${existingBonus.remaining_charges || 0}`);
    console.log(`   - Activé le: ${existingBonus.activated_at ? new Date(existingBonus.activated_at).toLocaleString('fr-FR') : 'NON ACTIVÉ'}\n`);

    // 3. Simuler le cumul
    if (bonus.duration_type === 'charges') {
      const currentCharges = existingBonus.remaining_charges || 0;
      const newCharges = currentCharges + bonus.duration_value;

      console.log('🔄 Simulation du cumul:');
      console.log(`   - currentCharges: ${currentCharges}`);
      console.log(`   - bonus.duration_value: ${bonus.duration_value}`);
      console.log(`   - newCharges: ${newCharges}\n`);

      console.log('⚠️  ATTENTION: Ce script va RÉELLEMENT modifier la base de données !');
      console.log('   Il va ajouter 1 charge à Vision Divine.');
      console.log('   Appuie sur Ctrl+C dans les 3 secondes pour annuler...\n');

      // Attendre 3 secondes
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Effectuer l'UPDATE
      await db.query(`
        UPDATE player_active_bonuses
        SET remaining_charges = $1
        WHERE id = $2
      `, [newCharges, existingBonus.id]);

      console.log('✅ UPDATE exécuté\n');

      // Vérifier le résultat
      const updatedBonus = await db.queryOne(
        `SELECT remaining_charges FROM player_active_bonuses WHERE id = $1`,
        [existingBonus.id]
      );

      console.log('📊 État APRÈS cumul:');
      console.log(`   - Charges: ${updatedBonus.remaining_charges}\n`);

      if (updatedBonus.remaining_charges === newCharges) {
        console.log('✅ CUMUL RÉUSSI ! Les charges ont été correctement mises à jour.\n');
      } else {
        console.log(`❌ ERREUR ! Les charges ne correspondent pas.`);
        console.log(`   Attendu: ${newCharges}`);
        console.log(`   Réel: ${updatedBonus.remaining_charges}\n`);
      }
    } else {
      console.log('⚠️  Vision Divine n\'est pas un bonus à charges, le cumul ne peut pas être testé\n');
    }

    console.log('='.repeat(80));
    console.log('✅ Test terminé\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

testVisionDivineCumul();
