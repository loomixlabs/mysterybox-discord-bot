/**
 * Vérification des éléments manquants signalés
 */

require('dotenv').config();
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🔍 VÉRIFICATION DES ÉLÉMENTS SIGNALÉS');
  console.log('='.repeat(70));

  // 1. Vérifier image/gif mystery box dans theme_config DB
  console.log('\n📋 1. COLONNES MYSTERY BOX DANS theme_config');
  console.log('-'.repeat(50));

  const configColumns = await db.queryAll(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'theme_config'
    AND column_name LIKE '%mystery%' OR column_name LIKE '%celebration%'
    ORDER BY column_name
  `);
  console.log('Colonnes trouvées:');
  configColumns.forEach(c => console.log(`   - ${c.column_name}`));

  // Vérifier si ces colonnes sont dans le schema JSON
  const schemaPath = path.join(__dirname, '..', 'themes', 'schema', 'theme.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const schemaConfigProps = Object.keys(schema.properties.theme_config?.properties || {});

  const mysterySchemaProps = schemaConfigProps.filter(p => p.includes('mystery') || p.includes('celebration'));
  console.log('\nDans le schema JSON:');
  mysterySchemaProps.forEach(p => console.log(`   - ${p}`));

  // 2. Compter les templates d'annonces
  console.log('\n📋 2. TEMPLATES D\'ANNONCES PAR CATÉGORIE');
  console.log('-'.repeat(50));

  const templates = await db.queryAll(`
    SELECT category, COUNT(*) as count
    FROM announcement_templates
    WHERE guild_id = $1
    GROUP BY category
    ORDER BY category
  `, [process.env.GUILD_ID || '1248028543389143070']);

  if (templates.length > 0) {
    templates.forEach(t => console.log(`   ${t.category}: ${t.count}`));
  } else {
    console.log('   ❌ Aucun template trouvé');
  }

  // 3. Compter les super bonus
  console.log('\n📋 3. SUPER BONUS');
  console.log('-'.repeat(50));

  const superBonuses = await db.queryAll(`
    SELECT id, name, effect_type, is_active
    FROM super_bonuses
    WHERE guild_id = $1
    ORDER BY id
  `, [process.env.GUILD_ID || '1248028543389143070']);

  console.log(`   Total: ${superBonuses.length} super bonus`);
  const active = superBonuses.filter(b => b.is_active);
  console.log(`   Actifs: ${active.length}`);
  console.log('\n   Liste:');
  superBonuses.forEach(b => {
    const status = b.is_active ? '✅' : '❌';
    console.log(`   ${status} ${b.id}. ${b.name} (${b.effect_type})`);
  });

  // 4. Vérifier les types de pièges dans la DB
  console.log('\n📋 4. TYPES DE PIÈGES DANS LA DB');
  console.log('-'.repeat(50));

  const trapConstraint = await db.queryOne(`
    SELECT pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'traps'::regclass AND conname = 'traps_type_check'
  `);
  console.log(`   Contrainte: ${trapConstraint?.definition || 'Non trouvée'}`);

  const trapsInDb = await db.queryAll(`
    SELECT type, COUNT(*) as count
    FROM traps
    WHERE guild_id = $1
    GROUP BY type
    ORDER BY type
  `, [process.env.GUILD_ID || '1248028543389143070']);

  console.log('\n   Types utilisés actuellement:');
  trapsInDb.forEach(t => console.log(`   - ${t.type}: ${t.count}`));

  // 5. Vérifier le fichier Monopoly pour les pièges
  console.log('\n📋 5. PIÈGES DANS MONOPOLY.THEME.JSON');
  console.log('-'.repeat(50));

  const monopolyPath = path.join(__dirname, '..', 'themes', 'presets', 'monopoly.theme.json');
  const monopoly = JSON.parse(fs.readFileSync(monopolyPath, 'utf8'));

  console.log(`   Total pièges: ${monopoly.traps.length}`);
  monopoly.traps.forEach(t => {
    console.log(`   - ${t.name} (type: ${t.type})`);
  });

  // 6. Vérifier le plan /setup
  console.log('\n📋 6. VÉRIFICATION PLAN /SETUP');
  console.log('-'.repeat(50));

  const planPath = path.join(__dirname, '..', 'PLAN-SETUP-THEMES-V2.md');
  if (fs.existsSync(planPath)) {
    const planContent = fs.readFileSync(planPath, 'utf8');

    // Vérifier durée en jours
    const hasDuration = planContent.includes('duration') || planContent.includes('durée');
    console.log(`   Durée en jours: ${hasDuration ? '✅ Mentionné' : '❌ Non trouvé'}`);

    // Vérifier multi-thèmes
    const hasMultiTheme = planContent.includes('plusieurs') || planContent.includes('multi');
    console.log(`   Multi-thèmes: ${hasMultiTheme ? '✅ Mentionné' : '❌ Non trouvé'}`);

    // Vérifier canaux/catégories
    const hasChannels = planContent.includes('canal') || planContent.includes('channel') || planContent.includes('catégorie');
    console.log(`   Config canaux: ${hasChannels ? '✅ Mentionné' : '❌ Non trouvé'}`);
  } else {
    console.log('   ❌ Fichier PLAN-SETUP-THEMES-V2.md non trouvé');
  }

  // 7. Vérifier images des pièges dans le schema
  console.log('\n📋 7. IMAGE DES PIÈGES DANS LE SCHEMA');
  console.log('-'.repeat(50));

  const trapSchema = schema.properties.traps?.items?.properties || {};
  console.log(`   Propriété image_url: ${trapSchema.image_url ? '✅ Présente' : '❌ Absente'}`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
