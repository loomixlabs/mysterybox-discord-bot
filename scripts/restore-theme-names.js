/**
 * URGENT: Restaurer les noms de thèmes corrompus
 */
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

// Noms originaux basés sur les theme_id et le backup
const RESTORATIONS = [
  { id: 23, theme_id: 'blanche neige', correct_name: 'Blanche neige' },
  { id: 47, theme_id: 'calendrier de noël 🧑‍🎄', correct_name: 'CALENDRIER DE NOËL 🎅' }
];

async function restore() {
  console.log('═'.repeat(80));
  console.log('🔧 RESTAURATION DES NOMS DE THÈMES CORROMPUS');
  console.log('═'.repeat(80));

  // 1. État avant
  console.log('\n📋 État AVANT restauration:\n');
  const before = await db.queryAll(`
    SELECT id, theme_id, name, is_active
    FROM themes
    WHERE guild_id = $1
    ORDER BY id
  `, [GUILD_ID]);
  console.table(before.map(t => ({
    id: t.id,
    theme_id: t.theme_id,
    name: t.name,
    is_active: t.is_active ? '✅' : '❌'
  })));

  // 2. Restaurer chaque thème
  console.log('\n📝 Restauration en cours...\n');
  for (const r of RESTORATIONS) {
    const result = await db.query(`
      UPDATE themes
      SET name = $1, updated_at = NOW()
      WHERE guild_id = $2 AND id = $3
    `, [r.correct_name, GUILD_ID, r.id]);

    if (result.rowCount > 0) {
      console.log(`✅ ID ${r.id}: "${r.theme_id}" → nom restauré à "${r.correct_name}"`);
    } else {
      console.log(`⚠️  ID ${r.id}: Non trouvé ou déjà correct`);
    }
  }

  // 3. État après
  console.log('\n📋 État APRÈS restauration:\n');
  const after = await db.queryAll(`
    SELECT id, theme_id, name, is_active
    FROM themes
    WHERE guild_id = $1
    ORDER BY id
  `, [GUILD_ID]);
  console.table(after.map(t => ({
    id: t.id,
    theme_id: t.theme_id,
    name: t.name,
    is_active: t.is_active ? '✅' : '❌'
  })));

  console.log('\n✅ RESTAURATION TERMINÉE');
  process.exit(0);
}

restore().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
