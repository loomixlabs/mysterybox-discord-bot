/**
 * Track Section: THEME (ThemeSection component)
 * Affiche les vrais champs du composant ThemeSection
 *
 * Champs UI:
 * - ID du thème       → theme.theme_id
 * - Nom d'affichage   → theme.name
 * - Durée (jours)     → theme.duration_days
 * - Nom du rôle       → theme.final_role_name
 * - Couleur du rôle   → theme.final_role_color
 */
const db = require('../utils/database-pg');

const THEME_ID = 'test tracking';

async function track() {
  console.log('═'.repeat(80));
  console.log('🎨 TRACKING SECTION: THEME (Composant ThemeSection)');
  console.log('═'.repeat(80));
  console.log(`📍 Theme: "${THEME_ID}"`);
  console.log('');

  const theme = await db.queryOne(`
    SELECT id, theme_id, name, is_draft, visibility, updated_at, theme_data
    FROM themes_library
    WHERE theme_id = $1
  `, [THEME_ID]);

  if (!theme) {
    console.log('❌ Thème non trouvé!');
    process.exit(1);
  }

  const th = theme.theme_data?.theme || {};

  // Section ThemeSection - Paramètres du thème
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 🎨 SECTION: THEME (ThemeSection)                                            │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 🔑 ID du thème (theme_id):      ${(th.theme_id || '(vide)').substring(0, 42).padEnd(42)}│`);
  console.log(`│ ✨ Nom d'affichage (name):      ${(th.name || '(vide)').substring(0, 42).padEnd(42)}│`);
  console.log(`│ 📅 Durée en jours:              ${(th.duration_days?.toString() || '(vide)').padEnd(42)}│`);
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log('│ 👑 RÔLE DE COMPLÉTION                                                       │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 🏆 Nom du rôle (final_role_name):    ${(th.final_role_name || '(vide)').substring(0, 37).padEnd(37)}│`);
  console.log(`│ 🎨 Couleur (final_role_color):       ${(th.final_role_color || '(vide)').padEnd(37)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  // Infos DB
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 💾 INFOS BASE DE DONNÉES                                                    │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ updated_at:    ${(theme.updated_at?.toISOString() || 'N/A').padEnd(59)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  process.exit(0);
}

track().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
