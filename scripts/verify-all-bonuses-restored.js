const db = require('../utils/database-pg');

async function verifyAllBonusesRestored() {
  try {
    const guildId = '297309737135898624';
    const userId = '297307186307006464';

    console.log('🔍 VÉRIFICATION - BONUS RESTAURÉS\n');
    console.log('='.repeat(80));

    // Utiliser la fonction getActiveBonusesByPlayer
    const activeBonuses = await db.getActiveBonusesByPlayer(guildId, userId);

    console.log(`\n📊 BONUS ACTIFS (via getActiveBonusesByPlayer):`);
    console.log('-'.repeat(80));
    console.log(`   Total: ${activeBonuses.length} bonus actif(s)\n`);

    if (activeBonuses.length === 0) {
      console.log('   ❌ Aucun bonus actif!\n');
      process.exit(1);
    }

    const now = new Date();
    activeBonuses.forEach((bonus, i) => {
      console.log(`   ${i + 1}. ${bonus.name} (ID: ${bonus.id})`);
      console.log(`      bonus_id: ${bonus.bonus_id}`);
      console.log(`      bonus_type: ${bonus.bonus_type}`);
      console.log(`      effect_type: ${bonus.effect_type}`);
      console.log(`      remaining_charges: ${bonus.remaining_charges}`);
      console.log(`      is_active: ${bonus.is_active}`);

      if (bonus.expires_at) {
        const expiresAt = new Date(bonus.expires_at);
        const isExpired = expiresAt <= now;
        console.log(`      expires_at: ${expiresAt.toLocaleString('fr-FR')} ${isExpired ? '❌ EXPIRÉ' : '✅ ACTIF'}`);
      } else {
        console.log(`      expires_at: NULL (permanent)`);
      }
      console.log();
    });

    // Compter par type
    const byType = {};
    activeBonuses.forEach(bonus => {
      byType[bonus.bonus_type] = (byType[bonus.bonus_type] || 0) + 1;
    });

    console.log('\n📊 RÉPARTITION PAR TYPE:');
    console.log('-'.repeat(80));
    Object.keys(byType).sort().forEach(type => {
      console.log(`   ${type}: ${byType[type]}`);
    });

    // Vérifier spécifiquement Vision Divine
    const visionDivines = activeBonuses.filter(b => b.name === 'Vision Divine');
    console.log(`\n\n🔍 VISION DIVINE:`);
    console.log('-'.repeat(80));
    console.log(`   Trouvé: ${visionDivines.length} instance(s)\n`);

    visionDivines.forEach((vd, i) => {
      console.log(`   ${i + 1}. Vision Divine (ID: ${vd.id})`);
      console.log(`      bonus_type: ${vd.bonus_type} ${vd.bonus_type === 'reveal' ? '✅' : '❌'}`);
      console.log(`      remaining_charges: ${vd.remaining_charges}`);
      console.log(`      is_active: ${vd.is_active}\n`);
    });

    console.log('='.repeat(80));
    console.log(`\n✅ ${activeBonuses.length} bonus actifs restaurés!`);
    console.log('📝 Vous pouvez maintenant utiliser /my-bonuses pour les voir et les activer.\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

verifyAllBonusesRestored();
