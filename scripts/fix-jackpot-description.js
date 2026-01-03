const db = require('../utils/database-pg');

/**
 * Corriger la description du Jackpot x2 dans la base de données
 */

async function fixJackpotDescription() {
  try {
    console.log('🔧 CORRECTIF - Description Jackpot x2\n');
    console.log('='.repeat(80));

    // Vérifier l'état actuel
    const before = await db.query(`
      SELECT id, guild_id, name, description
      FROM super_bonuses
      WHERE name = 'Jackpot x2'
      ORDER BY guild_id, id
    `);

    console.log('\n📊 Avant correction:\n');
    before.forEach(bonus => {
      console.log(`🔹 ${bonus.name} (ID: ${bonus.id}, Guild: ${bonus.guild_id})`);
      console.log(`   Description: "${bonus.description}"`);
      console.log();
    });

    // Corriger la description
    const result = await db.query(`
      UPDATE super_bonuses
      SET description = 'La prochaine mystery box donnera DOUBLE récompense si collectible !'
      WHERE name = 'Jackpot x2'
      AND description LIKE '%Les 5 prochaines%'
      RETURNING id, guild_id, name, description
    `);

    console.log(`✅ ${result.length} bonus mis à jour\n`);

    // Vérifier l'état après correction
    const after = await db.query(`
      SELECT id, guild_id, name, description
      FROM super_bonuses
      WHERE name = 'Jackpot x2'
      ORDER BY guild_id, id
    `);

    console.log('📊 Après correction:\n');
    after.forEach(bonus => {
      console.log(`🔹 ${bonus.name} (ID: ${bonus.id}, Guild: ${bonus.guild_id})`);
      console.log(`   Description: "${bonus.description}"`);
      console.log();
    });

    console.log('='.repeat(80));
    console.log('✅ Correctif terminé!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixJackpotDescription();
