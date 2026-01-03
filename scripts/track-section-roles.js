/**
 * Track Section: ROLES (RolesSection component)
 * Affiche les vrais champs du composant RolesSection
 *
 * Champs UI:
 * - theme_config.progression_roles[] → array de rôles
 *   - name: string
 *   - color: string (hex)
 *   - percentage: number
 *   - hoist: boolean
 *   - mentionable: boolean
 * - theme.required_items → pour calculer les items requis
 */
const db = require('../utils/database-pg');

const THEME_ID = 'test tracking';

async function track() {
  console.log('═'.repeat(80));
  console.log('👑 TRACKING SECTION: ROLES (Composant RolesSection)');
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

  const cfg = theme.theme_data?.theme_config || {};
  const th = theme.theme_data?.theme || {};
  const roles = cfg.progression_roles || [];
  const requiredItems = th.required_items || 10;

  // Helper pour calculer les items depuis pourcentage
  const calcItems = (pct) => Math.ceil((pct / 100) * requiredItems);

  // Info générale
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ 👑 SECTION: ROLES DE PROGRESSION                                            │');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');
  console.log(`│ 📦 Items requis (collection):  ${requiredItems.toString().padEnd(44)}│`);
  console.log(`│ 🎯 Nombre de rôles:             ${roles.length.toString().padEnd(44)}│`);
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  if (roles.length === 0) {
    console.log('');
    console.log('⚠️  Aucun rôle de progression configuré.');
  } else {
    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ 📊 LISTE DES RÔLES                                                          │');
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');

    // Trier par pourcentage
    const sortedRoles = [...roles].sort((a, b) => a.percentage - b.percentage);

    sortedRoles.forEach((role, i) => {
      const items = calcItems(role.percentage);
      console.log(`│ ${(i + 1).toString().padStart(2)}. ${(role.name || '(sans nom)').substring(0, 25).padEnd(25)} │ ${(role.percentage + '%').padEnd(5)} │ ${(items + ' items').padEnd(10)} │ ${role.color || '(vide)'.padEnd(8)}│`);
    });

    console.log('├─────────────────────────────────────────────────────────────────────────────┤');
    console.log('│ DÉTAILS COMPLETS:                                                           │');
    console.log('├─────────────────────────────────────────────────────────────────────────────┤');

    sortedRoles.forEach((role, i) => {
      console.log(`│ Rôle #${i + 1}:                                                                 │`);
      console.log(`│   • name:        ${(role.name || '(vide)').substring(0, 55).padEnd(55)}│`);
      console.log(`│   • color:       ${(role.color || '(vide)').padEnd(55)}│`);
      console.log(`│   • percentage:  ${(role.percentage?.toString() || '(vide)').padEnd(55)}│`);
      console.log(`│   • hoist:       ${(role.hoist !== undefined ? role.hoist.toString() : '(non défini)').padEnd(55)}│`);
      console.log(`│   • mentionable: ${(role.mentionable !== undefined ? role.mentionable.toString() : '(non défini)').padEnd(55)}│`);
      if (i < sortedRoles.length - 1) {
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
