/**
 * Debug: Vérifier les templates et pièges HP
 */
const db = require('../utils/database-pg');

const GUILD_ID = '1182395170273099806';
const THEME_ID = 65;

async function main() {
  console.log('\n🔍 DEBUG THÈME HARRY POTTER\n');

  // 1. Vérifier les templates avec theme_id = 65
  console.log('📢 Templates avec theme_id = 65:');
  const templates = await db.queryAll(
    `SELECT id, type, SUBSTRING(title, 1, 40) as title_preview
     FROM announcement_templates
     WHERE guild_id = $1 AND theme_id = $2
     ORDER BY type`,
    [GUILD_ID, THEME_ID]
  );
  console.table(templates);
  console.log(`Total: ${templates.length} templates\n`);

  // 2. Vérifier les pièges avec theme_id = 65
  console.log('🪤 Pièges avec theme_id = 65:');
  const traps = await db.queryAll(
    `SELECT id, name, type, notif_title
     FROM traps
     WHERE guild_id = $1 AND theme_id = $2`,
    [GUILD_ID, THEME_ID]
  );
  console.table(traps);

  // 3. Test UPDATE direct
  console.log('\n🧪 Test UPDATE direct sur legendary_collectible:');
  const testUpdate = await db.query(
    `UPDATE announcement_templates
     SET title = $1
     WHERE guild_id = $2 AND theme_id = $3 AND type = $4
     RETURNING id, type`,
    ['⚡ TEST HARRY POTTER', GUILD_ID, THEME_ID, 'legendary_collectible']
  );
  console.log('Résultat UPDATE:', testUpdate.rows);
  console.log('Rows affected:', testUpdate.rowCount);

  // 4. Vérifier si le UPDATE a fonctionné
  const verify = await db.queryOne(
    `SELECT id, type, title FROM announcement_templates
     WHERE guild_id = $1 AND theme_id = $2 AND type = $3`,
    [GUILD_ID, THEME_ID, 'legendary_collectible']
  );
  console.log('\nVérification après UPDATE:', verify);

  process.exit(0);
}

main().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
