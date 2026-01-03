const db = require('../utils/database-pg');

async function checkVisionDivineDefinition() {
  try {
    const guildId = '297309737135898624';

    console.log('🔍 VÉRIFICATION DÉFINITION VISION DIVINE\n');
    console.log('='.repeat(80));

    // Récupérer Vision Divine de super_bonuses
    const visionDivine = await db.queryOne(`
      SELECT * FROM super_bonuses
      WHERE guild_id = $1 AND name = 'Vision Divine'
    `, [guildId]);

    if (!visionDivine) {
      console.log('❌ Vision Divine introuvable!\n');
      process.exit(1);
    }

    console.log('📋 DÉFINITION Vision Divine:');
    console.log('-'.repeat(80));
    Object.keys(visionDivine).forEach(key => {
      console.log(`   ${key}: ${visionDivine[key]}`);
    });

    console.log('\n\n🔍 ANALYSE:');
    console.log('-'.repeat(80));
    console.log(`   bonus_type: ${visionDivine.bonus_type}`);
    console.log(`   effect_type: ${visionDivine.effect_type}`);
    console.log(`   duration_type: ${visionDivine.duration_type}`);
    console.log(`   duration_value: ${visionDivine.duration_value} ${visionDivine.duration_value === null ? '❌ NULL!' : '✅'}`);

    if (visionDivine.duration_type === 'charges' && visionDivine.duration_value === null) {
      console.log('\n❌ PROBLÈME IDENTIFIÉ:');
      console.log('   Vision Divine a duration_type = "charges" mais duration_value = NULL');
      console.log('   Cela signifie que remaining_charges sera toujours NULL lors de l\'activation!\n');
      console.log('💡 SOLUTION:');
      console.log('   Mettre à jour duration_value avec le nombre de charges (ex: 3)\n');
    }

    console.log('\n='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

checkVisionDivineDefinition();
