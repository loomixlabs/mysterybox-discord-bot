/**
 * Track Section: MYSTERY BOX (MysteryBoxSection component)
 */
const db = require('../utils/database-pg');

const THEME_ID = 'test tracking';

async function track() {
  console.log('═'.repeat(80));
  console.log('🎁 TRACKING SECTION: MYSTERY BOX');
  console.log('═'.repeat(80));

  const theme = await db.queryOne(`
    SELECT theme_data FROM themes_library WHERE theme_id = $1
  `, [THEME_ID]);

  if (!theme) {
    console.log('❌ Thème non trouvé!');
    process.exit(1);
  }

  const cfg = theme.theme_data?.theme_config || {};
  const msg = theme.theme_data?.theme_messages || {};

  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 🎁 MYSTERY BOX                                                              │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 🖼️  Image:             ${(cfg.mystery_box_image || '(vide)').substring(0, 50).padEnd(50)}│`);
  console.log(`│ ✨ Titre:              ${(cfg.mystery_box_title || '(vide)').substring(0, 50).padEnd(50)}│`);
  console.log(`│ 📝 Description:        ${(cfg.mystery_box_description || '(vide)').substring(0, 50).padEnd(50)}│`);
  console.log(`│ 🔘 Label bouton:       ${(msg.mystery_box_button_label || '(vide)').substring(0, 50).padEnd(50)}│`);
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 🎉 Message gagnant:    ${(cfg.mystery_box_winner_message || '(vide)').substring(0, 50).padEnd(50)}│`);
  console.log(`│ 🎬 GIF célébration:    ${(cfg.mystery_box_celebration_gif || '(vide)').substring(0, 50).padEnd(50)}│`);
  console.log(`│ 🎊 Emojis:             ${(cfg.mystery_box_celebration_emojis || '(vide)').substring(0, 50).padEnd(50)}│`);
  console.log(`│ 🗑️  Auto-delete:        ${String(cfg.auto_delete_celebration_message ?? '(vide)').padEnd(50)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  process.exit(0);
}

track().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
