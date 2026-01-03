const db = require('../utils/database-pg');

async function checkReteCollectible() {
  try {
    console.log('🔍 VÉRIFICATION - Collectible "rete"\n');
    console.log('='.repeat(80));

    const collectibles = await db.query(`
      SELECT id, name, reveal_message, rarity
      FROM collectibles
      WHERE name ILIKE '%rete%'
      ORDER BY id
    `);

    console.log(`\n📊 ${collectibles.length} collectible(s) trouvé(s):\n`);

    collectibles.forEach(c => {
      console.log(`🔹 ${c.name} (ID: ${c.id}):` );
      console.log(`   Rarity: ${c.rarity}`);
      console.log(`   reveal_message: "${c.reveal_message || 'NULL'}"`);
      console.log();
    });

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkReteCollectible();
