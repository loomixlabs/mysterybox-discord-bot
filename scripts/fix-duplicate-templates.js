/**
 * Script pour supprimer les templates d'annonces dupliqués
 * Garde le plus ancien (plus petit ID) et supprime les doublons
 */

const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624';

async function fix() {
  console.log('='.repeat(80));
  console.log(`🔧 FIX DOUBLONS TEMPLATES - Guild: ${GUILD_ID}`);
  console.log('='.repeat(80));

  try {
    // 1. Trouver les doublons à supprimer
    console.log('\n1. Identification des doublons à supprimer...');
    const duplicatesToDelete = await db.queryAll(`
      SELECT id, type, title, created_at
      FROM announcement_templates t1
      WHERE guild_id = $1
        AND theme_id IS NULL
        AND id NOT IN (
          SELECT MIN(id)
          FROM announcement_templates
          WHERE guild_id = $1
            AND theme_id IS NULL
          GROUP BY type
        )
      ORDER BY type, id
    `, [GUILD_ID]);

    if (duplicatesToDelete.length === 0) {
      console.log('   ✅ Aucun doublon à supprimer');
      process.exit(0);
    }

    console.log(`   ⚠️  ${duplicatesToDelete.length} template(s) doublon(s) à supprimer:`);
    console.table(duplicatesToDelete);

    // 2. Supprimer les doublons
    console.log('\n2. Suppression des doublons...');
    const idsToDelete = duplicatesToDelete.map(t => t.id);

    const result = await db.query(`
      DELETE FROM announcement_templates
      WHERE id = ANY($1)
    `, [idsToDelete]);

    console.log(`   ✅ ${result.rowCount} template(s) supprimé(s)`);

    // 3. Vérification
    console.log('\n3. Vérification finale...');
    const remaining = await db.queryAll(`
      SELECT id, type, title
      FROM announcement_templates
      WHERE guild_id = $1 AND theme_id IS NULL
      ORDER BY type
    `, [GUILD_ID]);

    console.log(`   ✅ ${remaining.length} templates restants (doivent être uniques par type)`);

    // Vérifier qu'il n'y a plus de doublons
    const checkDuplicates = await db.queryAll(`
      SELECT type, COUNT(*) as count
      FROM announcement_templates
      WHERE guild_id = $1 AND theme_id IS NULL
      GROUP BY type
      HAVING COUNT(*) > 1
    `, [GUILD_ID]);

    if (checkDuplicates.length === 0) {
      console.log('   ✅ Aucun doublon restant - problème résolu !');
    } else {
      console.log('   ⚠️  Il reste des doublons:');
      console.table(checkDuplicates);
    }

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error('   Stack:', error.stack);
  }

  process.exit(0);
}

fix();
