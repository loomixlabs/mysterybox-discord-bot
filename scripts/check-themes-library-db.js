/**
 * Vérification de la structure de themes_library
 */
const db = require('../utils/database-pg');

async function check() {
  console.log('═'.repeat(80));
  console.log('🔍 VÉRIFICATION DE LA TABLE themes_library');
  console.log('═'.repeat(80));

  // 1. Structure
  console.log('\n📋 1. STRUCTURE DE LA TABLE\n');
  const cols = await db.queryAll(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'themes_library'
    ORDER BY ordinal_position
  `);

  if (cols.length === 0) {
    console.log('❌ Table themes_library non trouvée!');
    process.exit(1);
  }

  console.table(cols.map(r => ({
    colonne: r.column_name,
    type: r.data_type,
    nullable: r.is_nullable,
    default: (r.column_default || '-').substring(0, 35)
  })));

  // 2. Contraintes CHECK
  console.log('\n📋 2. CONTRAINTES CHECK\n');
  const cons = await db.queryAll(`
    SELECT con.conname, pg_get_constraintdef(con.oid) as def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'themes_library' AND con.contype = 'c'
  `);

  if (cons.length > 0) {
    cons.forEach(c => console.log('  ' + c.conname + ': ' + c.def));
  } else {
    console.log('  Aucune contrainte CHECK');
  }

  // 3. Valeurs visibility existantes
  console.log('\n📋 3. VALEURS VISIBILITY\n');
  const vis = await db.queryAll(`
    SELECT visibility, COUNT(*) as count
    FROM themes_library GROUP BY visibility ORDER BY count DESC
  `);

  if (vis.length > 0) {
    console.table(vis);
  } else {
    console.log('  Aucun thème');
  }

  // 4. Versions
  console.log('\n📋 4. VERSIONING ACTUEL\n');
  const ver = await db.queryAll(`
    SELECT name, version, visibility, created_at::date as created
    FROM themes_library ORDER BY updated_at DESC NULLS LAST LIMIT 5
  `);

  if (ver.length > 0) {
    console.table(ver.map(r => ({
      name: (r.name || '-').substring(0, 30),
      version: r.version || '1',
      visibility: r.visibility,
      created: r.created
    })));
  } else {
    console.log('  Aucun thème');
  }

  // 5. Résumé
  console.log('\n' + '═'.repeat(80));
  console.log('📊 RÉSUMÉ');
  console.log('═'.repeat(80));

  const hasVis = cols.some(c => c.column_name === 'visibility');
  const hasVer = cols.some(c => c.column_name === 'version');
  console.log('  Colonne visibility:', hasVis ? '✅ EXISTE' : '❌ MANQUE');
  console.log('  Colonne version:', hasVer ? '✅ EXISTE' : '❌ MANQUE');

  const visCons = cons.find(c => c.def && c.def.includes('visibility'));
  if (visCons) {
    console.log('  Contrainte visibility:', visCons.def);
    console.log('  Permet draft:', visCons.def.includes('draft') ? '✅ OUI' : '❌ NON - À AJOUTER');
  } else {
    console.log('  Pas de contrainte visibility (toutes valeurs acceptées)');
  }

  process.exit(0);
}

check().catch(e => {
  console.error('❌ Erreur:', e.message);
  process.exit(1);
});
