const db = require('../utils/database-pg');

async function debugVisionDivineDetection() {
  try {
    const guildId = '297309737135898624';
    const userId = '297307186307006464';

    console.log('🔍 DEBUG - DÉTECTION VISION DIVINE\n');
    console.log('='.repeat(80));

    // 1. Récupérer les bonus via getActiveBonusesByPlayer (fonction utilisée par le handler)
    console.log('\n📋 1. RÉSULTAT de db.getActiveBonusesByPlayer():');
    console.log('-'.repeat(80));
    const activeBonuses = await db.getActiveBonusesByPlayer(guildId, userId);

    console.log(`   Total: ${activeBonuses.length} bonus\n`);

    activeBonuses.forEach((bonus, i) => {
      console.log(`   ${i + 1}. ${bonus.name}`);
      console.log(`      id: ${bonus.id}`);
      console.log(`      bonus_id: ${bonus.bonus_id}`);
      console.log(`      effect_type: ${bonus.effect_type}`);
      console.log(`      duration_type: ${bonus.duration_type}`);
      console.log(`      remaining_charges: ${bonus.remaining_charges}`);
      console.log(`      is_active: ${bonus.is_active}`);
      console.log(`      expires_at: ${bonus.expires_at}\n`);
    });

    // 2. Simuler hasRevealBonus
    console.log('\n📊 2. SIMULATION hasRevealBonus():');
    console.log('-'.repeat(80));

    const revealBonuses = activeBonuses.filter(bonus => {
      const isRevealType = bonus.effect_type === 'reveal';
      const hasCharges = bonus.remaining_charges > 0;
      const notChargesType = bonus.duration_type !== 'charges';
      const finalCheck = hasCharges || notChargesType;

      console.log(`   Vérification ${bonus.name}:`);
      console.log(`      effect_type === 'reveal': ${isRevealType}`);
      console.log(`      remaining_charges > 0: ${hasCharges} (valeur: ${bonus.remaining_charges})`);
      console.log(`      duration_type !== 'charges': ${notChargesType} (valeur: ${bonus.duration_type})`);
      console.log(`      (hasCharges || notChargesType): ${finalCheck}`);
      console.log(`      >>> RÉSULTAT FINAL: ${isRevealType && finalCheck ? '✅ DÉTECTÉ' : '❌ NON DÉTECTÉ'}\n`);

      return isRevealType && finalCheck;
    });

    console.log(`   Total bonus "reveal" détectés: ${revealBonuses.length}`);

    if (revealBonuses.length > 0) {
      console.log('\n   Bonus détecté:');
      revealBonuses.forEach((bonus, i) => {
        console.log(`   ${i + 1}. ${bonus.name} (ID: ${bonus.id})`);
        console.log(`      remaining_charges: ${bonus.remaining_charges}`);
        console.log(`      duration_type: ${bonus.duration_type}\n`);
      });
    } else {
      console.log('\n   ❌ AUCUN BONUS DE RÉVÉLATION DÉTECTÉ!\n');
    }

    // 3. Vérifier le bonus Vision Divine spécifiquement
    console.log('\n📋 3. VISION DIVINE SPÉCIFIQUE:');
    console.log('-'.repeat(80));
    const visionDivines = activeBonuses.filter(b => b.name === 'Vision Divine');

    if (visionDivines.length === 0) {
      console.log('   ❌ Aucune Vision Divine trouvée!\n');
    } else {
      visionDivines.forEach((vd, i) => {
        console.log(`   ${i + 1}. Vision Divine (ID: ${vd.id})`);
        console.log(`      bonus_id: ${vd.bonus_id}`);
        console.log(`      effect_type: ${vd.effect_type}`);
        console.log(`      duration_type: ${vd.duration_type}`);
        console.log(`      remaining_charges: ${vd.remaining_charges}`);
        console.log(`      typeof remaining_charges: ${typeof vd.remaining_charges}`);
        console.log(`      is_active: ${vd.is_active}`);

        // Tests détaillés
        console.log(`\n      Tests de détection:`);
        console.log(`      - effect_type === 'reveal': ${vd.effect_type === 'reveal'}`);
        console.log(`      - remaining_charges > 0: ${vd.remaining_charges > 0}`);
        console.log(`      - duration_type !== 'charges': ${vd.duration_type !== 'charges'}`);

        const willBeDetected = (vd.effect_type === 'reveal') &&
                               (vd.remaining_charges > 0 || vd.duration_type !== 'charges');
        console.log(`      >>> Sera détecté: ${willBeDetected ? '✅ OUI' : '❌ NON'}\n`);
      });
    }

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

debugVisionDivineDetection();
