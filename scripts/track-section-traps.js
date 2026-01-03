/**
 * Track Section: TRAPS (TrapsSection component)
 * Affiche les vrais champs du composant TrapsSection
 *
 * Champs par trap (16 colonnes DB):
 * OBLIGATOIRES:
 *   - trap_id: string (unique ID)
 *   - name: string
 *   - type: 'cooldown' | 'lose-collectible' | 'lose-all-collectibles' | 'public-shame' | 'empty-box'
 *
 * OPTIONNELS (avec défauts):
 *   - description: string (admin notes)
 *   - image_url: string
 *   - cooldown_duration: number (default: 30, pour type cooldown)
 *   - shame_message: string (pour type public-shame)
 *   - shame_channel_id: string (pour type public-shame)
 *   - malus_points: number (default: 0)
 *   - removes_collectible: boolean (default: true, pour lose types)
 *   - is_active: boolean (default: true)
 *   - is_default: boolean (default: false)
 *   - notif_title: string
 *   - notif_description: string
 *   - notif_color: string (default: '#e74c3c')
 *   - notif_footer: string
 */
const db = require('../utils/database-pg');

const THEME_ID = 'test tracking';

async function track() {
  console.log('═'.repeat(80));
  console.log('⚠️ TRACKING SECTION: TRAPS (Composant TrapsSection)');
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

  const traps = theme.theme_data?.traps || [];

  // Stats par type
  const types = ['cooldown', 'lose-collectible', 'lose-all-collectibles', 'public-shame', 'empty-box'];
  const stats = {};
  types.forEach(t => {
    stats[t] = traps.filter(trap => trap.type === t).length;
  });

  const activeCount = traps.filter(t => t.is_active !== false).length;

  // Info générale
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ ⚠️ SECTION: TRAPS (Pièges)                                                  │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 📦 Total pièges:       ${traps.length.toString().padEnd(50)}│`);
  console.log(`│ ✅ Actifs:             ${activeCount.toString().padEnd(50)}│`);
  console.log(`│ ⏸️  Inactifs:           ${(traps.length - activeCount).toString().padEnd(50)}│`);
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log('│ 📊 RÉPARTITION PAR TYPE                                                     │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ ⏱️  Cooldown:                ${stats['cooldown'].toString().padEnd(45)}│`);
  console.log(`│ 💔 Perte item:               ${stats['lose-collectible'].toString().padEnd(45)}│`);
  console.log(`│ 💀 Perte tout:               ${stats['lose-all-collectibles'].toString().padEnd(45)}│`);
  console.log(`│ 🔔 Honte publique:           ${stats['public-shame'].toString().padEnd(45)}│`);
  console.log(`│ 📦 Boîte vide:               ${stats['empty-box'].toString().padEnd(45)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  if (traps.length === 0) {
    console.log('');
    console.log('⚠️  Aucun piège configuré.');
  } else {
    // Liste détaillée
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ 📋 DÉTAILS DES PIÈGES                                                       │');
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');

    traps.forEach((trap, i) => {
      const emoji = {
        'cooldown': '⏱️',
        'lose-collectible': '💔',
        'lose-all-collectibles': '💀',
        'public-shame': '🔔',
        'empty-box': '📦'
      }[trap.type] || '⚠️';

      const status = trap.is_active !== false ? '✅' : '⏸️';

      console.log(`│ Piège #${i + 1}: ${status}                                                             │`);
      console.log('│ ─────────────────────────────────────────────────────────────────────────── │');
      console.log(`│   • trap_id:           ${(trap.trap_id || '(vide)').substring(0, 50).padEnd(50)}│`);
      console.log(`│   • name:              ${(trap.name || '(vide)').substring(0, 50).padEnd(50)}│`);
      console.log(`│   • type:              ${emoji} ${(trap.type || '(vide)').padEnd(47)}│`);
      console.log(`│   • description:       ${(trap.description || '(vide)').substring(0, 50).padEnd(50)}│`);
      console.log(`│   • image_url:         ${(trap.image_url ? '✅ Définie' : '(vide)').padEnd(50)}│`);
      console.log(`│   • is_active:         ${(trap.is_active !== false ? 'true' : 'false').padEnd(50)}│`);
      console.log(`│   • is_default:        ${(trap.is_default ? 'true' : 'false').padEnd(50)}│`);

      // Champs spécifiques par type
      if (trap.type === 'cooldown') {
        console.log(`│   • cooldown_duration: ${((trap.cooldown_duration || 30) + ' min').padEnd(50)}│`);
      }
      if (trap.type === 'public-shame') {
        console.log(`│   • shame_message:     ${(trap.shame_message || '(vide)').substring(0, 50).padEnd(50)}│`);
        console.log(`│   • shame_channel_id:  ${(trap.shame_channel_id || '(vide)').padEnd(50)}│`);
      }
      if (['lose-collectible', 'lose-all-collectibles'].includes(trap.type)) {
        console.log(`│   • removes_collectib: ${(trap.removes_collectible !== false ? 'true' : 'false').padEnd(50)}│`);
      }

      // Notification fields
      console.log(`│   • notif_title:       ${(trap.notif_title || '(vide)').substring(0, 50).padEnd(50)}│`);
      console.log(`│   • notif_description: ${(trap.notif_description || '(vide)').substring(0, 50).padEnd(50)}│`);
      console.log(`│   • notif_color:       ${(trap.notif_color || '#e74c3c').padEnd(50)}│`);
      console.log(`│   • notif_footer:      ${(trap.notif_footer || '(vide)').substring(0, 50).padEnd(50)}│`);

      if (i < traps.length - 1) {
        console.log('│                                                                             │');
      }
    });

    console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  }

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
