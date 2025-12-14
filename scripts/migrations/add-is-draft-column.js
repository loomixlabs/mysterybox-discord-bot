/**
 * Migration: Ajouter colonne is_draft à themes_library
 *
 * is_draft (boolean):
 * - true = brouillon en cours de création (non déployé)
 * - false = thème finalisé/déployé
 *
 * Les thèmes existants sont considérés comme déployés (is_draft = false)
 */
const db = require('../../utils/database-pg');

async function migrate() {
  console.log('═'.repeat(80));
  console.log('🔄 MIGRATION: Ajout colonne is_draft à themes_library');
  console.log('═'.repeat(80));

  try {
    // 1. Vérifier si la colonne existe déjà
    console.log('\n📋 1. Vérification de la colonne is_draft...\n');
    const checkCol = await db.queryOne(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'themes_library' AND column_name = 'is_draft'
    `);

    if (checkCol) {
      console.log('✅ La colonne is_draft existe déjà');
    } else {
      // 2. Ajouter la colonne is_draft
      console.log('📝 Ajout de la colonne is_draft...');
      await db.query(`
        ALTER TABLE themes_library
        ADD COLUMN is_draft BOOLEAN DEFAULT true
      `);
      console.log('✅ Colonne is_draft ajoutée (default: true)');

      // 3. Mettre à jour les thèmes existants comme non-brouillons
      console.log('\n📋 2. Mise à jour des thèmes existants...\n');
      const result = await db.query(`
        UPDATE themes_library
        SET is_draft = false
        WHERE is_draft IS NULL OR is_draft = true
      `);
      console.log(`✅ ${result.rowCount} thèmes existants marqués comme déployés (is_draft = false)`);
    }

    // 4. Nettoyer les valeurs visibility='draft' si présentes
    console.log('\n📋 3. Nettoyage des visibility="draft"...\n');
    const cleanupResult = await db.query(`
      UPDATE themes_library
      SET visibility = 'private'
      WHERE visibility = 'draft'
    `);
    console.log(`✅ ${cleanupResult.rowCount} thèmes avec visibility='draft' convertis en 'private'`);

    // 5. Vérification finale
    console.log('\n📋 4. Vérification finale...\n');
    const verification = await db.queryAll(`
      SELECT
        is_draft,
        visibility,
        COUNT(*) as count
      FROM themes_library
      GROUP BY is_draft, visibility
      ORDER BY is_draft, visibility
    `);
    console.table(verification);

    console.log('\n' + '═'.repeat(80));
    console.log('✅ MIGRATION TERMINÉE AVEC SUCCÈS');
    console.log('═'.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur de migration:', error.message);
    console.error(error);
    process.exit(1);
  }
}

migrate();
