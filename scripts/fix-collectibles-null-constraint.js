/**
 * Migration: Autoriser NULL pour image_url dans collectibles
 * Nécessaire pour les thèmes créés via Theme Builder sans images
 */

const db = require('../utils/database-pg');

async function fixConstraint() {
  console.log('🔧 Migration: collectibles.image_url DROP NOT NULL');
  console.log('='.repeat(60));

  try {
    // Supprimer la contrainte NOT NULL
    await db.query(`
      ALTER TABLE collectibles ALTER COLUMN image_url DROP NOT NULL
    `);
    console.log('✅ Contrainte NOT NULL supprimée pour collectibles.image_url');

    // Vérifier la modification
    const result = await db.queryOne(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'collectibles' AND column_name = 'image_url'
    `);

    console.log(`\n📋 Vérification: image_url is_nullable = ${result.is_nullable}`);

    if (result.is_nullable === 'YES') {
      console.log('\n✅ Migration réussie! Les collectibles peuvent maintenant avoir image_url = NULL');
    } else {
      console.log('\n❌ La migration a échoué');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }

  process.exit(0);
}

fixConstraint();
