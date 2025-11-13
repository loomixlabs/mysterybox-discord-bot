const db = require('./utils/database-pg');
require('dotenv').config();

async function verifySetup() {
  try {
    const guildId = '1248028543389143070';
    const themeId = 23;

    console.log('🔍 Vérification complète de la configuration "Boîte Vide"...\n');

    // 1. Vérifier le piège
    console.log('1️⃣ Vérification du piège:');
    const trap = await db.queryOne(`
      SELECT * FROM traps
      WHERE guild_id = $1 AND type = 'empty-box' AND theme_id = $2
    `, [guildId, themeId]);

    if (trap) {
      console.log(`   ✅ Piège trouvé (ID: ${trap.id})`);
      console.log(`      - Nom: ${trap.name}`);
      console.log(`      - Type: ${trap.type}`);
      console.log(`      - Actif: ${trap.is_active}`);
      console.log(`      - Par défaut: ${trap.is_default}`);
    } else {
      console.log('   ❌ Piège introuvable!');
    }

    // 2. Vérifier le template d'annonce
    console.log('\n2️⃣ Vérification du template d\'annonce:');
    const template = await db.queryOne(`
      SELECT * FROM announcement_templates
      WHERE guild_id = $1 AND type = 'trap_empty_box'
    `, [guildId]);

    if (template) {
      console.log(`   ✅ Template trouvé (ID: ${template.id})`);
      console.log(`      - Title: ${template.title}`);
      console.log(`      - Color: ${template.color}`);
    } else {
      console.log('   ❌ Template introuvable!');
    }

    // 3. Vérifier le toggle d'annonce
    console.log('\n3️⃣ Vérification du toggle d\'annonce:');
    const settings = await db.queryOne(`
      SELECT trap_empty_box FROM announcement_settings
      WHERE guild_id = $1
    `, [guildId]);

    if (settings) {
      console.log(`   ✅ Toggle trouvé: ${settings.trap_empty_box ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    } else {
      console.log('   ❌ Settings introuvables!');
    }

    // 4. Vérifier la contrainte CHECK
    console.log('\n4️⃣ Vérification de la contrainte BDD:');
    const constraint = await db.queryOne(`
      SELECT pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'traps' AND con.conname = 'traps_type_check'
    `);

    if (constraint && constraint.definition.includes('empty-box')) {
      console.log('   ✅ Contrainte contient "empty-box"');
    } else {
      console.log('   ❌ Contrainte ne contient pas "empty-box"!');
    }

    // 5. Résumé
    console.log('\n📊 RÉSUMÉ:');
    const allGood = trap && template && settings && settings.trap_empty_box && constraint;

    if (allGood) {
      console.log('   ✅ TOUT EST PRÊT!');
      console.log('\n🎯 Pour tester:');
      console.log(`   /give unique mode:trap item_id:${trap.id}`);
      console.log('\n📣 Pour l\'annonce publique:');
      console.log('   node post-empty-box-announcement.js');
    } else {
      console.log('   ⚠️ Il manque des éléments!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifySetup();
