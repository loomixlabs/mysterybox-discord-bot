const db = require('../utils/database-pg');

/**
 * Corriger le reveal_message du collectible "rete" qui contient "zt"
 */

async function fixReteRevealMessage() {
  try {
    console.log('🔧 CORRECTIF - reveal_message du collectible "rete"\n');
    console.log('='.repeat(80));

    // Vérifier l'état actuel
    const before = await db.query(`
      SELECT id, name, reveal_message
      FROM collectibles
      WHERE name = 'rete'
    `);

    console.log('\n📊 Avant correction:\n');
    before.forEach(c => {
      console.log(`🔹 ${c.name} (ID: ${c.id})`);
      console.log(`   reveal_message: "${c.reveal_message || 'NULL'}"`);
      console.log();
    });

    // Corriger le reveal_message
    await db.query(`
      UPDATE collectibles
      SET reveal_message = NULL
      WHERE name = 'rete'
    `);

    console.log('✅ reveal_message mis à NULL (utilisera le message par défaut)\n');

    // Vérifier l'état après correction
    const after = await db.query(`
      SELECT id, name, reveal_message
      FROM collectibles
      WHERE name = 'rete'
    `);

    console.log('📊 Après correction:\n');
    after.forEach(c => {
      console.log(`🔹 ${c.name} (ID: ${c.id})`);
      console.log(`   reveal_message: "${c.reveal_message || 'NULL'}"`);
      console.log('   Message utilisé: "Félicitations ! Tu as trouvé **rete** !"');
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

fixReteRevealMessage();
