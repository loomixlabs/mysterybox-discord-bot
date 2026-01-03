/**
 * Vérifie si auto_delete_celebration_message existe dans la DB du bot
 */
const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 Recherche de auto_delete_celebration_message dans la DB...\n');

  // 1. Vérifier dans theme_config
  console.log('=== TABLE theme_config ===');
  const themeConfigCols = await db.queryAll(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'theme_config'
    ORDER BY ordinal_position
  `);
  console.log('Colonnes:');
  themeConfigCols.forEach(c => console.log(`  - ${c.column_name} (${c.data_type})`));

  // 2. Chercher dans toutes les tables
  console.log('\n=== RECHERCHE auto_delete / celebration DANS TOUTES LES TABLES ===');
  const allCols = await db.queryAll(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (column_name LIKE '%auto_delete%' OR column_name LIKE '%celebration%')
    ORDER BY table_name
  `);

  if (allCols.length === 0) {
    console.log('❌ Aucune colonne auto_delete ou celebration trouvée dans la DB');
  } else {
    allCols.forEach(c => console.log(`  ${c.table_name}.${c.column_name} (${c.data_type})`));
  }

  // 3. Vérifier le contenu actuel de theme_config pour le thème actif
  console.log('\n=== VALEURS ACTUELLES theme_config (thème actif) ===');
  const activeThemeConfig = await db.queryOne(`
    SELECT tc.*
    FROM theme_config tc
    JOIN themes t ON tc.theme_id = t.id
    WHERE t.is_active = true
    LIMIT 1
  `);

  if (activeThemeConfig) {
    console.log('Colonnes mystery_box dans theme_config:');
    Object.keys(activeThemeConfig).filter(k => k.includes('mystery') || k.includes('celebration') || k.includes('auto_delete')).forEach(k => {
      console.log(`  ${k}: ${activeThemeConfig[k]}`);
    });
  } else {
    console.log('Pas de thème actif trouvé');
  }

  process.exit(0);
}

check().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
