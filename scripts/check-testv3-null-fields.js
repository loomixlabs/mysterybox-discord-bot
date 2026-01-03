/**
 * Vérification des champs NULL dans le thème testv3
 * Vérifie que les champs optionnels sont bien NULL et non ''
 */

const db = require('../utils/database-pg');

async function checkTestv3() {
  console.log('🔍 VÉRIFICATION DES CHAMPS NULL - THÈME testv3');
  console.log('='.repeat(80));

  try {
    // 1. Récupérer le thème testv3
    const theme = await db.queryOne(`
      SELECT id, theme_id, name FROM themes WHERE theme_id = 'testv3'
    `);

    if (!theme) {
      console.log('❌ Thème testv3 non trouvé');
      process.exit(1);
    }

    console.log(`\n📋 Thème trouvé: ${theme.name} (ID numérique: ${theme.id})`);
    const themeNumericId = theme.id;

    // 2. Vérifier les collectibles
    console.log('\n' + '='.repeat(80));
    console.log('📦 COLLECTIBLES');
    console.log('-'.repeat(40));

    const collectibles = await db.queryAll(`
      SELECT id, name, image_url, reveal_message
      FROM collectibles WHERE theme_id = $1
    `, [themeNumericId]);

    console.log(`Total: ${collectibles.length} collectibles`);

    let issues = [];
    for (const c of collectibles) {
      if (c.image_url === '') {
        issues.push(`  ❌ ${c.name}: image_url = '' (devrait être NULL)`);
      } else if (c.image_url === null) {
        console.log(`  ✅ ${c.name}: image_url = NULL (correct)`);
      } else {
        console.log(`  ✅ ${c.name}: image_url = "${c.image_url.substring(0, 30)}..."`);
      }

      if (c.reveal_message === '') {
        issues.push(`  ❌ ${c.name}: reveal_message = '' (devrait être NULL)`);
      }
    }

    if (issues.length > 0) {
      console.log('\n⚠️  Problèmes détectés (collectibles):');
      issues.forEach(i => console.log(i));
    }

    // 3. Vérifier les traps
    console.log('\n' + '='.repeat(80));
    console.log('🪤 TRAPS (PIÈGES)');
    console.log('-'.repeat(40));

    const traps = await db.queryAll(`
      SELECT id, name, description, image_url, shame_message
      FROM traps WHERE theme_id = $1
    `, [themeNumericId]);

    console.log(`Total: ${traps.length} pièges`);

    issues = [];
    for (const t of traps) {
      const trapIssues = [];

      if (t.image_url === '') {
        trapIssues.push('image_url=\'\'');
      }
      if (t.description === '') {
        trapIssues.push('description=\'\'');
      }
      if (t.shame_message === '') {
        trapIssues.push('shame_message=\'\'');
      }

      if (trapIssues.length > 0) {
        issues.push(`  ❌ ${t.name}: ${trapIssues.join(', ')} (devrait être NULL)`);
      } else {
        const hasNulls = [];
        if (t.image_url === null) hasNulls.push('image_url=NULL');
        if (t.description === null) hasNulls.push('description=NULL');
        if (t.shame_message === null) hasNulls.push('shame_message=NULL');

        if (hasNulls.length > 0) {
          console.log(`  ✅ ${t.name}: ${hasNulls.join(', ')} (correct)`);
        } else {
          console.log(`  ✅ ${t.name}: Tous les champs remplis`);
        }
      }
    }

    if (issues.length > 0) {
      console.log('\n⚠️  Problèmes détectés (traps):');
      issues.forEach(i => console.log(i));
    }

    // 4. Vérifier les missions
    console.log('\n' + '='.repeat(80));
    console.log('🎯 MISSIONS');
    console.log('-'.repeat(40));

    const missions = await db.queryAll(`
      SELECT id, name, description
      FROM missions WHERE theme_id = $1
    `, [themeNumericId]);

    console.log(`Total: ${missions.length} missions`);

    issues = [];
    for (const m of missions) {
      if (m.description === '') {
        issues.push(`  ❌ ${m.name}: description = '' (devrait être NULL)`);
      } else if (m.description === null) {
        console.log(`  ✅ ${m.name}: description = NULL (correct)`);
      } else {
        console.log(`  ✅ ${m.name}: description remplie`);
      }
    }

    if (issues.length > 0) {
      console.log('\n⚠️  Problèmes détectés (missions):');
      issues.forEach(i => console.log(i));
    }

    // 5. Vérifier les announcement_templates
    console.log('\n' + '='.repeat(80));
    console.log('📢 ANNOUNCEMENT_TEMPLATES');
    console.log('-'.repeat(40));

    const templates = await db.queryAll(`
      SELECT id, type, image_url, thumbnail_url
      FROM announcement_templates WHERE theme_id = $1
    `, [themeNumericId]);

    console.log(`Total: ${templates.length} templates`);

    issues = [];
    for (const t of templates) {
      const templateIssues = [];

      if (t.image_url === '') {
        templateIssues.push('image_url=\'\'');
      }
      if (t.thumbnail_url === '') {
        templateIssues.push('thumbnail_url=\'\'');
      }

      if (templateIssues.length > 0) {
        issues.push(`  ❌ ${t.type}: ${templateIssues.join(', ')} (devrait être NULL)`);
      } else {
        const hasNulls = [];
        if (t.image_url === null) hasNulls.push('image_url=NULL');
        if (t.thumbnail_url === null) hasNulls.push('thumbnail_url=NULL');

        if (hasNulls.length > 0) {
          console.log(`  ✅ ${t.type}: ${hasNulls.join(', ')} (correct)`);
        } else {
          console.log(`  ✅ ${t.type}: Toutes les URLs remplies`);
        }
      }
    }

    if (issues.length > 0) {
      console.log('\n⚠️  Problèmes détectés (templates):');
      issues.forEach(i => console.log(i));
    }

    // RÉSUMÉ FINAL
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ FINAL');
    console.log('='.repeat(80));

    // Compter les problèmes
    const emptyStrings = await db.queryOne(`
      SELECT
        (SELECT COUNT(*) FROM collectibles WHERE theme_id = $1 AND image_url = '') as collectibles_img,
        (SELECT COUNT(*) FROM traps WHERE theme_id = $1 AND image_url = '') as traps_img,
        (SELECT COUNT(*) FROM traps WHERE theme_id = $1 AND description = '') as traps_desc,
        (SELECT COUNT(*) FROM missions WHERE theme_id = $1 AND description = '') as missions_desc,
        (SELECT COUNT(*) FROM announcement_templates WHERE theme_id = $1 AND image_url = '') as templates_img,
        (SELECT COUNT(*) FROM announcement_templates WHERE theme_id = $1 AND thumbnail_url = '') as templates_thumb
    `, [themeNumericId]);

    const totalEmpty = Object.values(emptyStrings).reduce((a, b) => parseInt(a) + parseInt(b), 0);

    if (totalEmpty === 0) {
      console.log('\n✅ SUCCÈS: Aucune chaîne vide \'\' trouvée!');
      console.log('   Les correctifs emptyToNull() fonctionnent correctement.');
    } else {
      console.log('\n❌ PROBLÈMES DÉTECTÉS:');
      if (parseInt(emptyStrings.collectibles_img) > 0) console.log(`   - collectibles.image_url: ${emptyStrings.collectibles_img} vide(s)`);
      if (parseInt(emptyStrings.traps_img) > 0) console.log(`   - traps.image_url: ${emptyStrings.traps_img} vide(s)`);
      if (parseInt(emptyStrings.traps_desc) > 0) console.log(`   - traps.description: ${emptyStrings.traps_desc} vide(s)`);
      if (parseInt(emptyStrings.missions_desc) > 0) console.log(`   - missions.description: ${emptyStrings.missions_desc} vide(s)`);
      if (parseInt(emptyStrings.templates_img) > 0) console.log(`   - announcement_templates.image_url: ${emptyStrings.templates_img} vide(s)`);
      if (parseInt(emptyStrings.templates_thumb) > 0) console.log(`   - announcement_templates.thumbnail_url: ${emptyStrings.templates_thumb} vide(s)`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

checkTestv3();
