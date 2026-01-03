/**
 * Analyse complète des champs vides du thème testv22
 */

const db = require('../utils/database-pg');

async function analyzeTestv22() {
  console.log('🔍 ANALYSE COMPLÈTE DU THÈME testv22');
  console.log('='.repeat(80));

  try {
    // 1. THÈME PRINCIPAL - Récupérer l'ID numérique
    console.log('\n📋 1. THÈME PRINCIPAL (themes)');
    console.log('-'.repeat(40));
    const theme = await db.queryOne(`
      SELECT * FROM themes WHERE theme_id = 'testv22'
    `);
    if (!theme) {
      console.log('  ❌ Thème non trouvé');
      process.exit(1);
    }

    const themeNumericId = theme.id;
    console.log(`  📌 ID numérique du thème: ${themeNumericId}`);

    for (const [key, value] of Object.entries(theme)) {
      const isEmpty = value === '' || value === null;
      const icon = isEmpty ? '❌' : '✅';
      console.log(`  ${icon} ${key}: ${isEmpty ? '(VIDE)' : JSON.stringify(value).substring(0, 50)}`);
    }

    // 2. COLLECTIBLES
    console.log('\n📦 2. COLLECTIBLES');
    console.log('-'.repeat(40));
    const collectibles = await db.queryAll(`
      SELECT * FROM collectibles WHERE theme_id = $1 ORDER BY id
    `, [themeNumericId]);
    console.log(`  Total: ${collectibles.length} collectibles`);

    const collectibleEmptyFields = {};
    for (const c of collectibles) {
      for (const [key, value] of Object.entries(c)) {
        if (value === '' || value === null) {
          if (!collectibleEmptyFields[key]) collectibleEmptyFields[key] = [];
          collectibleEmptyFields[key].push(c.name || c.id);
        }
      }
    }

    if (Object.keys(collectibleEmptyFields).length > 0) {
      console.log('\n  Champs vides trouvés:');
      for (const [field, items] of Object.entries(collectibleEmptyFields)) {
        console.log(`  ❌ ${field}: ${items.length} collectible(s) - ${items.join(', ')}`);
      }
    } else {
      console.log('  ✅ Aucun champ vide');
    }

    // 3. TRAPS
    console.log('\n🪤 3. TRAPS (PIÈGES)');
    console.log('-'.repeat(40));
    const traps = await db.queryAll(`
      SELECT * FROM traps WHERE theme_id = $1 ORDER BY id
    `, [themeNumericId]);
    console.log(`  Total: ${traps.length} pièges`);

    const trapEmptyFields = {};
    for (const t of traps) {
      for (const [key, value] of Object.entries(t)) {
        if (value === '' || value === null) {
          if (!trapEmptyFields[key]) trapEmptyFields[key] = [];
          trapEmptyFields[key].push(t.name || t.id);
        }
      }
    }

    if (Object.keys(trapEmptyFields).length > 0) {
      console.log('\n  Champs vides trouvés:');
      for (const [field, items] of Object.entries(trapEmptyFields)) {
        console.log(`  ❌ ${field}: ${items.length} piège(s) - ${items.join(', ')}`);
      }
    } else {
      console.log('  ✅ Aucun champ vide');
    }

    // 4. THEME_MESSAGES
    console.log('\n💬 4. THEME_MESSAGES');
    console.log('-'.repeat(40));
    const messages = await db.queryOne(`
      SELECT * FROM theme_messages WHERE theme_id = $1
    `, [themeNumericId]);
    if (messages) {
      for (const [key, value] of Object.entries(messages)) {
        const isEmpty = value === '' || value === null;
        const icon = isEmpty ? '❌' : '✅';
        console.log(`  ${icon} ${key}: ${isEmpty ? '(VIDE)' : JSON.stringify(value).substring(0, 50)}`);
      }
    } else {
      console.log('  ⚠️ Pas de messages personnalisés');
    }

    // 5. THEME_CONFIG
    console.log('\n⚙️ 5. THEME_CONFIG');
    console.log('-'.repeat(40));
    const config = await db.queryOne(`
      SELECT * FROM theme_config WHERE theme_id = $1
    `, [themeNumericId]);
    if (config) {
      for (const [key, value] of Object.entries(config)) {
        const isEmpty = value === '' || value === null;
        const icon = isEmpty ? '❌' : '✅';
        console.log(`  ${icon} ${key}: ${isEmpty ? '(VIDE)' : JSON.stringify(value).substring(0, 50)}`);
      }
    } else {
      console.log('  ⚠️ Pas de config personnalisée');
    }

    // 6. MISSIONS
    console.log('\n🎯 6. MISSIONS');
    console.log('-'.repeat(40));
    const missions = await db.queryAll(`
      SELECT * FROM missions WHERE theme_id = $1 ORDER BY id
    `, [themeNumericId]);
    console.log(`  Total: ${missions.length} missions`);

    const missionEmptyFields = {};
    for (const m of missions) {
      for (const [key, value] of Object.entries(m)) {
        if (value === '' || value === null) {
          if (!missionEmptyFields[key]) missionEmptyFields[key] = [];
          missionEmptyFields[key].push(m.name || m.id);
        }
      }
    }

    if (Object.keys(missionEmptyFields).length > 0) {
      console.log('\n  Champs vides trouvés:');
      for (const [field, items] of Object.entries(missionEmptyFields)) {
        console.log(`  ❌ ${field}: ${items.length} mission(s) - ${items.slice(0, 5).join(', ')}${items.length > 5 ? '...' : ''}`);
      }
    } else {
      console.log('  ✅ Aucun champ vide');
    }

    // 7. PROGRESSION_ROLES
    console.log('\n🏆 7. PROGRESSION_ROLES');
    console.log('-'.repeat(40));
    const roles = await db.queryAll(`
      SELECT * FROM progression_roles WHERE theme_id = $1 ORDER BY percentage
    `, [themeNumericId]);
    console.log(`  Total: ${roles.length} rôles de progression`);

    const roleEmptyFields = {};
    for (const r of roles) {
      for (const [key, value] of Object.entries(r)) {
        if (value === '' || value === null) {
          if (!roleEmptyFields[key]) roleEmptyFields[key] = [];
          roleEmptyFields[key].push(r.role_name || `${r.percentage}%`);
        }
      }
    }

    if (Object.keys(roleEmptyFields).length > 0) {
      console.log('\n  Champs vides trouvés:');
      for (const [field, items] of Object.entries(roleEmptyFields)) {
        console.log(`  ❌ ${field}: ${items.length} rôle(s) - ${items.join(', ')}`);
      }
    } else {
      console.log('  ✅ Aucun champ vide');
    }

    // 8. ANNOUNCEMENT_TEMPLATES
    console.log('\n📢 8. ANNOUNCEMENT_TEMPLATES');
    console.log('-'.repeat(40));
    const templates = await db.queryAll(`
      SELECT * FROM announcement_templates WHERE theme_id = $1 ORDER BY template_type
    `, [themeNumericId]);
    console.log(`  Total: ${templates.length} templates`);

    const templateEmptyFields = {};
    for (const t of templates) {
      for (const [key, value] of Object.entries(t)) {
        if (value === '' || value === null) {
          if (!templateEmptyFields[key]) templateEmptyFields[key] = [];
          templateEmptyFields[key].push(t.template_type);
        }
      }
    }

    if (Object.keys(templateEmptyFields).length > 0) {
      console.log('\n  Champs vides trouvés:');
      for (const [field, items] of Object.entries(templateEmptyFields)) {
        console.log(`  ❌ ${field}: ${items.length} template(s) - ${items.slice(0, 5).join(', ')}${items.length > 5 ? '...' : ''}`);
      }
    } else {
      console.log('  ✅ Aucun champ vide');
    }

    // 9. RARITY_PROBABILITIES
    console.log('\n🎲 9. RARITY_PROBABILITIES');
    console.log('-'.repeat(40));
    const rarities = await db.queryAll(`
      SELECT * FROM rarity_probabilities WHERE theme_id = $1 ORDER BY rarity
    `, [themeNumericId]);
    console.log(`  Total: ${rarities.length} raretés configurées`);

    if (rarities.length > 0) {
      for (const r of rarities) {
        console.log(`  ✅ ${r.rarity}: ${r.percentage}%`);
      }
    }

    // 10. SUMMARY
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ DES CHAMPS VIDES À RISQUE');
    console.log('='.repeat(80));

    const riskyFields = [
      { table: 'themes', field: 'final_role_discord_id', items: theme.final_role_discord_id === '' || theme.final_role_discord_id === null ? ['testv22'] : [] },
      { table: 'collectibles', field: 'image_url', items: collectibleEmptyFields['image_url'] || [] },
      { table: 'collectibles', field: 'reveal_message', items: collectibleEmptyFields['reveal_message'] || [] },
      { table: 'collectibles', field: 'role_color', items: collectibleEmptyFields['role_color'] || [] },
      { table: 'traps', field: 'image_url', items: trapEmptyFields['image_url'] || [] },
      { table: 'traps', field: 'description', items: trapEmptyFields['description'] || [] },
      { table: 'missions', field: 'description', items: missionEmptyFields['description'] || [] },
      { table: 'templates', field: 'image_url', items: templateEmptyFields['image_url'] || [] },
      { table: 'templates', field: 'thumbnail_url', items: templateEmptyFields['thumbnail_url'] || [] },
      { table: 'progression_roles', field: 'discord_role_id', items: roleEmptyFields['discord_role_id'] || [] },
    ];

    let hasRisks = false;
    for (const { table, field, items } of riskyFields) {
      if (items.length > 0) {
        hasRisks = true;
        console.log(`\n⚠️  ${table}.${field} VIDE:`);
        console.log(`   ${items.slice(0, 5).join(', ')}${items.length > 5 ? ` (et ${items.length - 5} autres)` : ''}`);
      }
    }

    if (!hasRisks) {
      console.log('\n✅ Aucun champ à risque détecté!');
    }

    // 11. CHECK BOT COMPATIBILITY
    console.log('\n' + '='.repeat(80));
    console.log('🔧 VÉRIFICATION COMPATIBILITÉ BOT');
    console.log('='.repeat(80));

    const compatibilityIssues = [];

    // Vérifier image_url vides (déjà corrigé)
    if ((collectibleEmptyFields['image_url'] || []).length > 0) {
      compatibilityIssues.push('✅ collectibles.image_url vide - CORRIGÉ dans mysteryBoxHandler, missionHandler');
    }
    if ((trapEmptyFields['image_url'] || []).length > 0) {
      compatibilityIssues.push('✅ traps.image_url vide - CORRIGÉ dans mysteryBoxHandler, giveHandler');
    }
    if ((templateEmptyFields['image_url'] || []).length > 0) {
      compatibilityIssues.push('✅ templates.image_url vide - CORRIGÉ dans adminPanelHandler');
    }
    if ((templateEmptyFields['thumbnail_url'] || []).length > 0) {
      compatibilityIssues.push('✅ templates.thumbnail_url vide - CORRIGÉ dans adminPanelHandler');
    }

    // Vérifier reveal_message vide
    if ((collectibleEmptyFields['reveal_message'] || []).length > 0) {
      compatibilityIssues.push('⚠️ collectibles.reveal_message vide - À VÉRIFIER dans les handlers');
    }

    // Vérifier role_color vide
    if ((collectibleEmptyFields['role_color'] || []).length > 0) {
      compatibilityIssues.push('⚠️ collectibles.role_color vide - À VÉRIFIER (utilise couleur par défaut?)');
    }

    // Vérifier description piège vide
    if ((trapEmptyFields['description'] || []).length > 0) {
      compatibilityIssues.push('⚠️ traps.description vide - À VÉRIFIER dans mysteryBoxHandler');
    }

    if (compatibilityIssues.length > 0) {
      console.log('\n' + compatibilityIssues.join('\n'));
    } else {
      console.log('\n✅ Aucun problème de compatibilité détecté!');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

analyzeTestv22();
