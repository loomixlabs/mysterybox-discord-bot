const db = require('../utils/database-pg');

/**
 * Supprimer tous les reveal_message personnalisés des collectibles
 * pour utiliser le message par défaut partout
 */

async function fixAllRevealMessages() {
  try {
    console.log('🔧 CORRECTIF - Suppression de tous les reveal_message personnalisés\n');
    console.log('='.repeat(80));

    // Vérifier l'état actuel
    const before = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN reveal_message IS NOT NULL THEN 1 END) as with_custom_message
      FROM collectibles
    `);

    console.log('\n📊 État actuel:\n');
    console.log(`   Total collectibles: ${before[0].total}`);
    console.log(`   Avec reveal_message personnalisé: ${before[0].with_custom_message}`);
    console.log(`   Avec message par défaut: ${before[0].total - before[0].with_custom_message}\n`);

    // Liste des collectibles avec reveal_message personnalisé
    const customMessages = await db.query(`
      SELECT id, name, reveal_message
      FROM collectibles
      WHERE reveal_message IS NOT NULL
      ORDER BY id
    `);

    if (customMessages.length > 0) {
      console.log('📝 Collectibles avec reveal_message personnalisé:\n');
      customMessages.forEach(c => {
        console.log(`   🔹 ${c.name} (ID: ${c.id}): "${c.reveal_message}"`);
      });
      console.log();
    }

    // Supprimer tous les reveal_message
    const result = await db.query(`
      UPDATE collectibles
      SET reveal_message = NULL
      WHERE reveal_message IS NOT NULL
    `);

    console.log(`✅ ${customMessages.length} reveal_message supprimé(s)\n`);

    // Vérifier l'état après correction
    const after = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN reveal_message IS NOT NULL THEN 1 END) as with_custom_message
      FROM collectibles
    `);

    console.log('📊 État après correction:\n');
    console.log(`   Total collectibles: ${after[0].total}`);
    console.log(`   Avec reveal_message personnalisé: ${after[0].with_custom_message}`);
    console.log(`   Avec message par défaut: ${after[0].total - after[0].with_custom_message}`);
    console.log(`\n   Message utilisé: "Félicitations ! Tu as trouvé **[nom du collectible]** !"\n`);

    console.log('='.repeat(80));
    console.log('✅ Correctif terminé!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixAllRevealMessages();
