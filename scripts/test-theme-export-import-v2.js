/**
 * Script de test pour le système export/import de thèmes v2.0
 * Teste les nouvelles tables: daily_rewards_config, daily_catchup_config,
 * mystery_box_config, progression_roles, super_bonuses, announcement_templates
 */

require('dotenv').config();
const ThemeExporter = require('../utils/themeExporter');
const ThemeImporter = require('../utils/themeImporter');
const ThemeValidator = require('../utils/themeValidator');
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_GUILD_ID = process.env.GUILD_ID || '1248028543389143070';
const OUTPUT_DIR = path.join(__dirname, '..', 'themes', 'exports');

async function main() {
  console.log('═'.repeat(80));
  console.log('🧪 TEST SYSTÈME EXPORT/IMPORT THÈMES v2.0');
  console.log('═'.repeat(80));
  console.log(`\n📍 Guild ID: ${TEST_GUILD_ID}\n`);

  try {
    // 1. Lister les thèmes disponibles
    console.log('📋 Étape 1: Liste des thèmes exportables...\n');
    const themes = await ThemeExporter.listExportableThemes(TEST_GUILD_ID);

    if (themes.length === 0) {
      console.log('❌ Aucun thème trouvé pour ce serveur');
      process.exit(1);
    }

    console.table(themes.map(t => ({
      ID: t.id,
      Theme_ID: t.theme_id,
      Nom: t.name,
      Actif: t.is_active ? '✅' : '❌',
      Collectibles: t.collectibles_count,
      Missions: t.missions_count,
      Pièges: t.traps_count,
      DailyRewards: t.daily_rewards_count,
      MysteryBox: t.mystery_box_count,
      SuperBonuses: t.super_bonus_count
    })));

    // Prendre le thème actif ou le premier
    const themeToExport = themes.find(t => t.is_active) || themes[0];
    console.log(`\n✅ Thème sélectionné: "${themeToExport.name}" (ID: ${themeToExport.id})\n`);

    // 2. Exporter le thème
    console.log('═'.repeat(80));
    console.log('📦 Étape 2: Export du thème...\n');

    const exporter = new ThemeExporter(TEST_GUILD_ID);
    const exportResult = await exporter.export(themeToExport.id, {
      name: themeToExport.name,
      description: `Export de test v2.0 - ${new Date().toISOString()}`,
      author: 'Test Script'
    });

    if (!exportResult.success) {
      console.error('❌ Erreur export:', exportResult.error);
      process.exit(1);
    }

    const exportedData = exportResult.data;
    console.log('\n📊 Données exportées:');
    console.log(`   - Version: ${exportedData.version}`);
    console.log(`   - Collectibles: ${exportedData.collectibles.length}`);
    console.log(`   - Pièges: ${exportedData.traps.length}`);
    console.log(`   - Missions keyword: ${exportedData.missions.keyword.length}`);
    console.log(`   - Missions quiz: ${exportedData.missions.quiz.length}`);
    console.log(`   - Daily Rewards: ${exportedData.daily_rewards_config.length} jours`);
    console.log(`   - Daily Catchup: ${exportedData.daily_catchup_config ? 'Oui' : 'Non'}`);
    console.log(`   - Mystery Box Config: ${exportedData.mystery_box_config.length} raretés`);
    console.log(`   - Progression Roles: ${exportedData.progression_roles.length}`);
    console.log(`   - Super Bonuses: ${exportedData.super_bonuses.length}`);
    console.log(`   - Announcement Templates: ${exportedData.announcement_templates.length}`);

    // 3. Valider le JSON exporté
    console.log('\n═'.repeat(80));
    console.log('✅ Étape 3: Validation du format v2.0...\n');

    const validator = new ThemeValidator();
    const validationResult = validator.validate(exportedData);

    if (validationResult.valid) {
      console.log('✅ Validation réussie! Le format v2.0 est valide.');
    } else {
      console.log('❌ Erreurs de validation:');
      validationResult.errors.forEach(err => console.log(`   - ${err}`));
    }

    // 4. Sauvegarder le fichier exporté
    console.log('\n═'.repeat(80));
    console.log('💾 Étape 4: Sauvegarde du fichier...\n');

    // Créer le dossier si nécessaire
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${themeToExport.theme_id}_v2_test_${timestamp}.theme.json`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(outputPath, JSON.stringify(exportedData, null, 2), 'utf8');
    console.log(`✅ Fichier sauvegardé: ${outputPath}`);

    // 5. Vérifier la structure des nouvelles sections
    console.log('\n═'.repeat(80));
    console.log('🔍 Étape 5: Vérification des nouvelles sections v2.0...\n');

    // daily_rewards_config
    if (exportedData.daily_rewards_config.length > 0) {
      console.log('📅 daily_rewards_config:');
      const sample = exportedData.daily_rewards_config[0];
      console.log(`   Champs présents: ${Object.keys(sample).join(', ')}`);
      console.log(`   Exemple Jour 1: type=${sample.reward_type}, rarity=${sample.reward_rarity || 'N/A'}`);
    } else {
      console.log('⚠️  daily_rewards_config: Vide');
    }

    // daily_catchup_config
    if (exportedData.daily_catchup_config) {
      console.log('\n💰 daily_catchup_config:');
      const cc = exportedData.daily_catchup_config;
      console.log(`   Champs présents: ${Object.keys(cc).join(', ')}`);
      console.log(`   Base price: ${cc.base_price}, Mode: ${cc.pricing_mode}, Enabled: ${cc.enabled}`);
    } else {
      console.log('\n⚠️  daily_catchup_config: Non configuré');
    }

    // mystery_box_config
    if (exportedData.mystery_box_config.length > 0) {
      console.log('\n📦 mystery_box_config:');
      exportedData.mystery_box_config.forEach(mbc => {
        console.log(`   ${mbc.rarity}: prob_collectible=${mbc.prob_collectible}%, prob_super_bonus=${mbc.prob_super_bonus}%`);
      });
    } else {
      console.log('\n⚠️  mystery_box_config: Vide');
    }

    // progression_roles
    if (exportedData.progression_roles.length > 0) {
      console.log('\n🎭 progression_roles:');
      exportedData.progression_roles.forEach(pr => {
        console.log(`   ${pr.percentage}%: ${pr.role_name} (${pr.color})`);
      });
    } else {
      console.log('\n⚠️  progression_roles: Vide');
    }

    // super_bonuses
    if (exportedData.super_bonuses.length > 0) {
      console.log('\n⭐ super_bonuses:');
      exportedData.super_bonuses.slice(0, 5).forEach(sb => {
        console.log(`   ${sb.name} (${sb.rarity}): ${sb.effect_type}`);
      });
      if (exportedData.super_bonuses.length > 5) {
        console.log(`   ... et ${exportedData.super_bonuses.length - 5} de plus`);
      }
    } else {
      console.log('\n⚠️  super_bonuses: Vide');
    }

    // announcement_templates
    if (exportedData.announcement_templates.length > 0) {
      console.log('\n📢 announcement_templates:');
      exportedData.announcement_templates.slice(0, 5).forEach(at => {
        console.log(`   ${at.type}: "${at.title}"`);
      });
      if (exportedData.announcement_templates.length > 5) {
        console.log(`   ... et ${exportedData.announcement_templates.length - 5} de plus`);
      }
    } else {
      console.log('\n⚠️  announcement_templates: Vide');
    }

    // 6. Résumé
    console.log('\n═'.repeat(80));
    console.log('📊 RÉSUMÉ DU TEST');
    console.log('═'.repeat(80));

    const coverage = {
      'themes': '✅',
      'theme_config': '✅',
      'collectibles': exportedData.collectibles.length > 0 ? '✅' : '⚠️',
      'traps': exportedData.traps.length > 0 ? '✅' : '⚠️',
      'missions': (exportedData.missions.keyword.length + exportedData.missions.quiz.length) > 0 ? '✅' : '⚠️',
      'theme_messages': Object.keys(exportedData.theme_messages || {}).length > 0 ? '✅' : '⚠️',
      'daily_rewards_config': exportedData.daily_rewards_config.length > 0 ? '✅' : '⚠️',
      'daily_catchup_config': exportedData.daily_catchup_config ? '✅' : '⚠️',
      'mystery_box_config': exportedData.mystery_box_config.length > 0 ? '✅' : '⚠️',
      'progression_roles': exportedData.progression_roles.length > 0 ? '✅' : '⚠️',
      'super_bonuses': exportedData.super_bonuses.length > 0 ? '✅' : '⚠️',
      'announcement_templates': exportedData.announcement_templates.length > 0 ? '✅' : '⚠️'
    };

    console.log('\nCouverture des tables:');
    Object.entries(coverage).forEach(([table, status]) => {
      console.log(`   ${status} ${table}`);
    });

    const validCount = Object.values(coverage).filter(v => v === '✅').length;
    const totalCount = Object.keys(coverage).length;
    console.log(`\n📈 Score: ${validCount}/${totalCount} tables couvertes`);

    if (validationResult.valid && validCount === totalCount) {
      console.log('\n🎉 TOUS LES TESTS PASSÉS! Le système v2.0 fonctionne correctement.');
    } else if (validationResult.valid) {
      console.log('\n⚠️  Format valide mais certaines tables sont vides (normal si le thème n\'a pas toutes les features).');
    } else {
      console.log('\n❌ Des erreurs ont été détectées. Vérifiez les logs ci-dessus.');
    }

    console.log('\n═'.repeat(80));

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await db.close();
    process.exit(0);
  }
}

main();
