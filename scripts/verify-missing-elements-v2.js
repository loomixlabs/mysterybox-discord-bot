/**
 * Vérification des éléments manquants signalés - V2
 */

require('dotenv').config();
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

const GUILD_ID = '1248028543389143070'; // Production

async function main() {
  console.log('🔍 VÉRIFICATION DES ÉLÉMENTS SIGNALÉS');
  console.log('='.repeat(70));

  // 1. Vérifier image/gif mystery box dans theme_config DB
  console.log('\n📋 1. COLONNES MYSTERY BOX DANS theme_config');
  console.log('-'.repeat(50));

  const configColumns = await db.queryAll(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'theme_config'
    AND (column_name LIKE '%mystery%' OR column_name LIKE '%celebration%')
    ORDER BY column_name
  `);
  console.log('Colonnes DB:');
  configColumns.forEach(c => console.log(`   ✅ ${c.column_name}`));

  // 2. Vérifier structure announcement_templates
  console.log('\n📋 2. STRUCTURE ANNOUNCEMENT_TEMPLATES');
  console.log('-'.repeat(50));

  const templateColumns = await db.queryAll(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'announcement_templates'
    ORDER BY ordinal_position
  `);
  console.log('Colonnes:');
  templateColumns.forEach(c => console.log(`   - ${c.column_name}`));

  // Compter les templates
  const templateCount = await db.queryOne(`
    SELECT COUNT(*) as count FROM announcement_templates WHERE guild_id = $1
  `, [GUILD_ID]);
  console.log(`\n   Total templates: ${templateCount?.count || 0}`);

  // Lister quelques templates par type
  const templates = await db.queryAll(`
    SELECT type, COUNT(*) as count FROM announcement_templates WHERE guild_id = $1 GROUP BY type ORDER BY type
  `, [GUILD_ID]);
  console.log('\n   Templates par type:');
  templates.forEach(t => console.log(`   - ${t.type}: ${t.count}`));

  // 3. Compter les super bonus
  console.log('\n📋 3. SUPER BONUS');
  console.log('-'.repeat(50));

  const superBonuses = await db.queryAll(`
    SELECT id, name, effect_type, is_active
    FROM super_bonuses
    WHERE guild_id = $1
    ORDER BY id
  `, [GUILD_ID]);

  console.log(`   Total: ${superBonuses.length} super bonus`);
  const active = superBonuses.filter(b => b.is_active);
  console.log(`   Actifs: ${active.length}`);
  console.log('\n   Liste:');
  superBonuses.forEach(b => {
    const status = b.is_active ? '✅' : '❌';
    console.log(`   ${status} ${b.id}. ${b.name} (${b.effect_type})`);
  });

  // 4. Vérifier les types de pièges utilisés
  console.log('\n📋 4. PIÈGES DANS LA DB');
  console.log('-'.repeat(50));

  const trapsInDb = await db.queryAll(`
    SELECT name, type, is_active
    FROM traps
    WHERE guild_id = $1
    ORDER BY type
  `, [GUILD_ID]);

  console.log(`   Total: ${trapsInDb.length} pièges`);
  trapsInDb.forEach(t => {
    const status = t.is_active ? '✅' : '❌';
    console.log(`   ${status} ${t.name} (type: ${t.type})`);
  });

  // 5. Vérifier le fichier Monopoly pour les pièges
  console.log('\n📋 5. PIÈGES DANS MONOPOLY.THEME.JSON');
  console.log('-'.repeat(50));

  const monopolyPath = path.join(__dirname, '..', 'themes', 'presets', 'monopoly.theme.json');
  const monopoly = JSON.parse(fs.readFileSync(monopolyPath, 'utf8'));

  console.log(`   Total pièges: ${monopoly.traps.length}`);
  monopoly.traps.forEach(t => {
    const hasImage = t.image_url ? '📷' : '⚠️ pas d\'image';
    console.log(`   - ${t.name} (type: ${t.type}) ${hasImage}`);
  });

  // 6. Vérifier le plan /setup
  console.log('\n📋 6. VÉRIFICATION PLAN /SETUP');
  console.log('-'.repeat(50));

  const planPath = path.join(__dirname, '..', 'PLAN-SETUP-THEMES-V2.md');
  if (fs.existsSync(planPath)) {
    const planContent = fs.readFileSync(planPath, 'utf8');

    // Vérifier durée en jours
    const hasDuration = planContent.toLowerCase().includes('duration') || planContent.toLowerCase().includes('durée');
    console.log(`   Durée en jours: ${hasDuration ? '✅ Mentionné' : '❌ Non trouvé'}`);

    // Vérifier multi-thèmes
    const hasMultiTheme = planContent.toLowerCase().includes('plusieurs thèmes') || planContent.toLowerCase().includes('multi');
    console.log(`   Multi-thèmes: ${hasMultiTheme ? '✅ Mentionné' : '❌ Non trouvé'}`);

    // Vérifier canaux/catégories
    const hasChannels = planContent.toLowerCase().includes('canal') || planContent.toLowerCase().includes('channel') || planContent.toLowerCase().includes('catégorie');
    console.log(`   Config canaux: ${hasChannels ? '✅ Mentionné' : '❌ Non trouvé'}`);
  } else {
    console.log('   ❌ Fichier PLAN-SETUP-THEMES-V2.md non trouvé');
  }

  // 7. Vérifier images des pièges dans le schema JSON
  console.log('\n📋 7. IMAGE DES PIÈGES DANS LE SCHEMA');
  console.log('-'.repeat(50));

  const schemaPath = path.join(__dirname, '..', 'themes', 'schema', 'theme.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const trapSchema = schema.properties.traps?.items?.properties || {};
  console.log(`   Propriété image_url: ${trapSchema.image_url ? '✅ Présente' : '❌ Absente'}`);

  // 8. Vérifier les probabilités super bonus
  console.log('\n📋 8. SYSTÈME DE PROBABILITÉS');
  console.log('-'.repeat(50));

  const themeConfig = await db.queryOne(`
    SELECT
      probability_collectible, probability_mission, probability_trap, probability_super_bonus,
      super_bonus_rarity_legendary, super_bonus_rarity_epic, super_bonus_rarity_rare, super_bonus_rarity_common
    FROM theme_config
    WHERE guild_id = $1
    LIMIT 1
  `, [GUILD_ID]);

  if (themeConfig) {
    console.log(`   probability_collectible: ${themeConfig.probability_collectible}%`);
    console.log(`   probability_mission: ${themeConfig.probability_mission}%`);
    console.log(`   probability_trap: ${themeConfig.probability_trap}%`);
    console.log(`   probability_super_bonus: ${themeConfig.probability_super_bonus}%`);
    console.log(`\n   Raretés super bonus:`);
    console.log(`   - legendary: ${themeConfig.super_bonus_rarity_legendary}%`);
    console.log(`   - epic: ${themeConfig.super_bonus_rarity_epic}%`);
    console.log(`   - rare: ${themeConfig.super_bonus_rarity_rare}%`);
    console.log(`   - common: ${themeConfig.super_bonus_rarity_common}%`);
  } else {
    console.log('   ❌ Pas de config trouvée');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
