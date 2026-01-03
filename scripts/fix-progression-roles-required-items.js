/**
 * Script de correction: required_items manquant dans progression_roles
 *
 * Problème: Les thèmes créés sans modifier manuellement les rôles de progression
 * ont required_items = undefined, ce qui bloque l'attribution des rôles.
 *
 * Solution: Recalculer required_items à partir du pourcentage et du nombre
 * total de collectibles du thème.
 *
 * Usage: node scripts/fix-progression-roles-required-items.js
 */

const db = require('../utils/database-pg');

async function fixProgressionRolesRequiredItems() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  FIX: required_items manquant dans progression_roles');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    // 1. Récupérer tous les theme_config avec progression_roles
    const configs = await db.queryAll(`
      SELECT
        tc.id,
        tc.guild_id,
        tc.theme_id,
        tc.progression_roles,
        t.name as theme_name,
        (SELECT COUNT(*) FROM collectibles c WHERE c.guild_id = tc.guild_id AND c.theme_id = tc.theme_id) as total_collectibles
      FROM theme_config tc
      JOIN themes t ON t.id = tc.theme_id AND t.guild_id = tc.guild_id
      WHERE tc.progression_roles IS NOT NULL
        AND tc.progression_roles != '[]'::jsonb
      ORDER BY tc.guild_id, tc.theme_id
    `);

    console.log(`📋 ${configs.length} configuration(s) de thème trouvée(s) avec des rôles de progression\n`);

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const config of configs) {
      const { id, guild_id, theme_id, progression_roles, theme_name, total_collectibles } = config;

      console.log(`\n🎨 Thème: "${theme_name}" (ID: ${theme_id}, Guild: ${guild_id})`);
      console.log(`   Collectibles: ${total_collectibles}`);

      if (!progression_roles || !Array.isArray(progression_roles) || progression_roles.length === 0) {
        console.log('   ⏭️  Pas de rôles de progression, ignoré');
        skippedCount++;
        continue;
      }

      if (total_collectibles === 0) {
        console.log('   ⚠️  Aucun collectible, impossible de calculer required_items');
        skippedCount++;
        continue;
      }

      let needsUpdate = false;
      const fixedRoles = progression_roles.map((role, index) => {
        const hasValidRequiredItems = role.required_items !== undefined &&
                                       role.required_items !== null &&
                                       role.required_items > 0;

        if (hasValidRequiredItems) {
          console.log(`   ✅ ${role.name}: required_items=${role.required_items} (OK)`);
          return role;
        }

        // Recalculer à partir du pourcentage
        const percentage = role.percentage || 25;
        const calculatedItems = Math.max(1, Math.ceil((percentage / 100) * total_collectibles));

        console.log(`   🔧 ${role.name}: ${percentage}% → required_items=${calculatedItems} (CORRIGÉ)`);
        needsUpdate = true;

        return {
          ...role,
          required_items: calculatedItems
        };
      });

      if (needsUpdate) {
        try {
          await db.query(`
            UPDATE theme_config
            SET progression_roles = $1
            WHERE id = $2
          `, [JSON.stringify(fixedRoles), id]);

          console.log(`   💾 Sauvegardé avec succès`);
          fixedCount++;
        } catch (err) {
          console.error(`   ❌ Erreur lors de la sauvegarde:`, err.message);
          errorCount++;
        }
      } else {
        console.log(`   ✅ Tous les rôles ont déjà required_items`);
        skippedCount++;
      }
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('  RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`  ✅ Thèmes corrigés:    ${fixedCount}`);
    console.log(`  ⏭️  Thèmes ignorés:     ${skippedCount}`);
    console.log(`  ❌ Erreurs:            ${errorCount}`);
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('');

    process.exit(errorCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

fixProgressionRolesRequiredItems();
