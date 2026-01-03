const db = require('../utils/database-pg');

async function fixVisionDivineType() {
  try {
    const guildId = '297309737135898624'; // BON serveur de test

    console.log('🔧 CORRECTION DU TYPE DE VISION DIVINE\\n');
    console.log('='.repeat(80));

    // 1. Afficher la structure de player_active_bonuses
    console.log('📋 STRUCTURE DE player_active_bonuses:');
    console.log('-'.repeat(80));
    const columns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'player_active_bonuses'
      ORDER BY ordinal_position
    `);

    columns.forEach((col, i) => {
      console.log(`   ${i + 1}. ${col.column_name} (${col.data_type})`);
    });

    // 2. Vérifier le bonus Vision Divine AVANT modification
    console.log('\\n\\n📊 VISION DIVINE - AVANT MODIFICATION:');
    console.log('-'.repeat(80));
    const visionDivineBefore = await db.queryOne(`
      SELECT * FROM super_bonuses
      WHERE guild_id = $1 AND name = 'Vision Divine'
    `, [guildId]);

    if (!visionDivineBefore) {
      console.log('❌ Vision Divine introuvable!\\n');
      process.exit(1);
    }

    console.log(`   ID: ${visionDivineBefore.id}`);
    console.log(`   Name: ${visionDivineBefore.name}`);
    console.log(`   Type: ${visionDivineBefore.bonus_type} ❌ (DEVRAIT ÊTRE "reveal")`);
    console.log(`   Effect type: ${visionDivineBefore.effect_type}`);

    // 3. Corriger le type de "boost" à "reveal"
    console.log('\\n\\n🔧 CORRECTION EN COURS...');
    console.log('-'.repeat(80));

    await db.query(`
      UPDATE super_bonuses
      SET bonus_type = 'reveal'
      WHERE guild_id = $1 AND name = 'Vision Divine'
    `, [guildId]);

    console.log('✅ Type modifié: boost → reveal\\n');

    // 4. Vérifier APRÈS modification
    console.log('\\n📊 VISION DIVINE - APRÈS MODIFICATION:');
    console.log('-'.repeat(80));
    const visionDivineAfter = await db.queryOne(`
      SELECT * FROM super_bonuses
      WHERE guild_id = $1 AND name = 'Vision Divine'
    `, [guildId]);

    console.log(`   ID: ${visionDivineAfter.id}`);
    console.log(`   Name: ${visionDivineAfter.name}`);
    console.log(`   Type: ${visionDivineAfter.bonus_type} ✅`);
    console.log(`   Effect type: ${visionDivineAfter.effect_type}\\n`);

    console.log('\\n' + '='.repeat(80));
    console.log('✅ Correction terminée!\\n');
    console.log('💡 La Vision Divine devrait maintenant se déclencher correctement!\\n');

    process.exit(0);
  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

fixVisionDivineType();
