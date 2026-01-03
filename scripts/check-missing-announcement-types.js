/**
 * Vérifier les types d'annonces manquants
 * Compare les colonnes announcement_settings avec les types de templates
 */
const db = require('../utils/database-pg');

// Types actuels dans la liste des 17 templates
const CURRENT_TEMPLATES = [
  'legendary_collectible',
  'collection_completed',
  'collection_traded',
  'collection_lost',
  'trap_cooldown',
  'trap_lose_collectible',
  'trap_public_shame',
  'trap_empty_box',
  'trap_lose_all_collectibles',
  'mission_word_guessed',
  'mission_started',
  'mission_completed',
  'mission_failed',
  'mission_approved',
  'mission_rejected',
  'theme_expired',
  'theme_expiring_soon'
];

// Types utilisés dans sendAnnouncement dans le code
const CODE_ANNOUNCEMENT_TYPES = [
  'legendary_collectible',
  'collection_completed',
  'collection_traded',
  'collection_lost',
  'trap_empty_box',
  'trap_lose_collectible',
  'trap_lose_all_collectibles',
  'mission_word_guessed',
  'theme_expired',
  'theme_expiring_soon',
  'mission_started',
  'mission_completed',
  'mission_failed',
  'mission_approved',
  'mission_rejected',
  'trap_cooldown',
  'trap_public_shame',
  'legendary_super_bonus'  // NOUVEAU trouvé dans announcements.js:279
];

async function check() {
  try {
    console.log('🔍 ANALYSE DES TYPES D\'ANNONCES MANQUANTS\n');
    console.log('='.repeat(80));

    // 1. Récupérer les colonnes de announcement_settings
    console.log('\n📋 1. COLONNES DE announcement_settings:\n');
    const columns = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'announcement_settings'
      ORDER BY ordinal_position
    `);

    const toggleColumns = columns
      .filter(c => c.data_type === 'boolean' && c.column_name !== 'id')
      .map(c => c.column_name);

    console.log('   Colonnes toggle (boolean):');
    toggleColumns.forEach(col => console.log(`   - ${col}`));

    // 2. Récupérer les types de templates existants
    console.log('\n📋 2. TYPES DE TEMPLATES EN DB:\n');
    const dbTypes = await db.queryAll(`
      SELECT DISTINCT type FROM announcement_templates ORDER BY type
    `);
    const templateTypes = dbTypes.map(t => t.type);
    console.log('   Types:', templateTypes.join(', '));

    // 3. Comparaison: types dans le code mais pas dans les templates
    console.log('\n📋 3. TYPES MANQUANTS DANS LES TEMPLATES:\n');
    const missingFromTemplates = CODE_ANNOUNCEMENT_TYPES.filter(t => !templateTypes.includes(t));
    if (missingFromTemplates.length === 0) {
      console.log('   ✅ Tous les types du code ont un template');
    } else {
      console.log('   ❌ Types utilisés dans le code mais SANS template:');
      missingFromTemplates.forEach(t => console.log(`      - ${t}`));
    }

    // 4. Comparaison: toggles vs templates
    console.log('\n📋 4. TOGGLES SANS TEMPLATE CORRESPONDANT:\n');
    const togglesNoTemplate = toggleColumns.filter(col => !templateTypes.includes(col));
    if (togglesNoTemplate.length === 0) {
      console.log('   ✅ Tous les toggles ont un template');
    } else {
      console.log('   ⚠️ Toggles sans template:');
      togglesNoTemplate.forEach(t => console.log(`      - ${t}`));
    }

    // 5. Comparaison: templates vs toggles
    console.log('\n📋 5. TEMPLATES SANS TOGGLE CORRESPONDANT:\n');
    const templatesNoToggle = templateTypes.filter(t => !toggleColumns.includes(t));
    if (templatesNoToggle.length === 0) {
      console.log('   ✅ Tous les templates ont un toggle');
    } else {
      console.log('   ⚠️ Templates sans toggle:');
      templatesNoToggle.forEach(t => console.log(`      - ${t}`));
    }

    // 6. Résumé
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RÉSUMÉ:\n');
    console.log(`   Templates actuels:    ${templateTypes.length} types`);
    console.log(`   Toggles DB:           ${toggleColumns.length} colonnes`);
    console.log(`   Types dans le code:   ${CODE_ANNOUNCEMENT_TYPES.length} types`);
    console.log(`   Manquants templates:  ${missingFromTemplates.length}`);
    console.log(`   Toggles sans template: ${togglesNoTemplate.length}`);
    console.log(`   Templates sans toggle: ${templatesNoToggle.length}`);

    if (missingFromTemplates.length > 0) {
      console.log('\n⚠️  ACTION REQUISE: Créer les templates pour:');
      missingFromTemplates.forEach(t => console.log(`   - ${t}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
