/**
 * Vérifier la structure de la table announcement_settings
 */
const db = require('../utils/database-pg');

async function check() {
  try {
    console.log('🔍 VÉRIFICATION TABLE announcement_settings\n');
    console.log('='.repeat(80));

    // 1. Structure de la table
    console.log('\n📋 1. COLONNES DE LA TABLE:\n');
    const columns = await db.queryAll(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      ORDER BY ordinal_position
    `);
    console.table(columns);

    // 2. Vérifier les colonnes trap spécifiques
    console.log('\n📋 2. COLONNES TRAP PRÉSENTES:\n');
    const trapColumns = columns.filter(c => c.column_name.startsWith('trap_'));
    console.table(trapColumns);

    // 3. Vérifier si les nouvelles colonnes existent
    console.log('\n📋 3. VÉRIFICATION COLONNES NOUVELLES:\n');
    const requiredColumns = ['trap_empty_box', 'trap_lose_all_collectibles'];
    for (const col of requiredColumns) {
      const exists = columns.find(c => c.column_name === col);
      console.log(`   ${col}: ${exists ? '✅ EXISTE' : '❌ MANQUANTE'}`);
    }

    // 4. Vérifier les colonnes obsolètes
    console.log('\n📋 4. COLONNES OBSOLÈTES À SUPPRIMER:\n');
    const obsoleteColumns = ['trap_curse', 'trap_malus_points'];
    for (const col of obsoleteColumns) {
      const exists = columns.find(c => c.column_name === col);
      console.log(`   ${col}: ${exists ? '⚠️ ENCORE PRÉSENTE - À SUPPRIMER' : '✅ SUPPRIMÉE'}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
