/**
 * URGENT: Vérifier l'état de TOUS les thèmes en base
 */
const db = require('../utils/database-pg');

async function check() {
  console.log('═'.repeat(80));
  console.log('🚨 VÉRIFICATION URGENTE DE TOUS LES THÈMES');
  console.log('═'.repeat(80));

  // 1. Tous les thèmes
  console.log('\n📋 TOUS LES THÈMES EN BASE:\n');
  const themes = await db.queryAll(`
    SELECT id, guild_id, theme_id, name, is_active, updated_at
    FROM themes
    ORDER BY guild_id, id
  `);

  console.table(themes.map(t => ({
    id: t.id,
    guild_id: t.guild_id,
    theme_id: t.theme_id,
    name: t.name,
    is_active: t.is_active ? '✅' : '❌',
    updated: t.updated_at?.toISOString?.().substring(0, 19) || 'N/A'
  })));

  // 2. Compter combien ont "Mon Nouveau Thème"
  const corrupted = themes.filter(t => t.name === 'Mon Nouveau Thème');
  console.log(`\n🔴 CORROMPUS (name = "Mon Nouveau Thème"): ${corrupted.length}/${themes.length}`);

  if (corrupted.length > 0) {
    console.log('\nDétails des thèmes corrompus:');
    corrupted.forEach(t => {
      console.log(`  - ID ${t.id}: guild=${t.guild_id}, theme_id="${t.theme_id}", updated=${t.updated_at}`);
    });
  }

  process.exit(0);
}

check().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
