const db = require('./utils/database-pg');
require('dotenv').config();

async function verifyIntegration() {
  try {
    const guildId = '1248028543389143070';
    const themeId = 23;

    console.log('🔍 Vérification de l\'intégration complète...\n');

    // 1. Vérifier que getTrapsByTheme inclut le nouveau piège
    console.log('1️⃣ Vérification de getTrapsByTheme:');
    const traps = await db.getTrapsByTheme(guildId, themeId);
    const emptyBoxTrap = traps.find(t => t.type === 'empty-box');

    if (emptyBoxTrap) {
      console.log(`   ✅ Piège "Boîte Vide" trouvé dans getTrapsByTheme`);
      console.log(`      - ID: ${emptyBoxTrap.id}`);
      console.log(`      - Nom: ${emptyBoxTrap.name}`);
      console.log(`      - Actif: ${emptyBoxTrap.is_active}`);
    } else {
      console.log('   ❌ Piège "Boîte Vide" NON trouvé dans getTrapsByTheme!');
    }

    console.log(`   📊 Total pièges actifs: ${traps.length}`);

    // 2. Vérifier le toggle d'annonce
    console.log('\n2️⃣ Vérification du toggle trap_empty_box:');
    const settings = await db.queryOne(`
      SELECT trap_empty_box FROM announcement_settings
      WHERE guild_id = $1
    `, [guildId]);

    if (settings && settings.trap_empty_box !== undefined) {
      console.log(`   ✅ Toggle existe: ${settings.trap_empty_box ? 'ACTIVÉ ✓' : 'DÉSACTIVÉ ✗'}`);
    } else {
      console.log('   ❌ Toggle trap_empty_box n\'existe pas!');
    }

    // 3. Vérifier tous les templates d'annonces
    console.log('\n3️⃣ Liste de tous les templates:');
    const templates = await db.queryAll(`
      SELECT type, title FROM announcement_templates
      WHERE guild_id = $1
      ORDER BY type
    `, [guildId]);

    console.log(`   📊 Total templates: ${templates.length}`);
    templates.forEach(t => {
      const highlight = t.type === 'trap_empty_box' ? ' ← NOUVEAU' : '';
      console.log(`   - ${t.type}: "${t.title}"${highlight}`);
    });

    // 4. Vérifier tous les toggles
    console.log('\n4️⃣ Liste de tous les toggles d\'annonces:');
    const allSettings = await db.queryOne(`
      SELECT * FROM announcement_settings
      WHERE guild_id = $1
    `, [guildId]);

    if (allSettings) {
      const toggleKeys = Object.keys(allSettings).filter(k =>
        !['id', 'guild_id', 'created_at', 'updated_at'].includes(k)
      );

      console.log(`   📊 Total toggles: ${toggleKeys.length}`);
      toggleKeys.forEach(key => {
        const status = allSettings[key] ? '✓' : '✗';
        const highlight = key === 'trap_empty_box' ? ' ← NOUVEAU' : '';
        console.log(`   ${status} ${key}${highlight}`);
      });
    }

    // 5. Simuler le tirage aléatoire
    console.log('\n5️⃣ Simulation de tirages aléatoires (100 essais):');
    let emptyBoxCount = 0;
    const trapCounts = {};

    for (let i = 0; i < 100; i++) {
      const randomTrap = traps[Math.floor(Math.random() * traps.length)];
      trapCounts[randomTrap.name] = (trapCounts[randomTrap.name] || 0) + 1;
      if (randomTrap.type === 'empty-box') emptyBoxCount++;
    }

    console.log('   Distribution des pièges:');
    Object.entries(trapCounts).forEach(([name, count]) => {
      const highlight = name === 'La Boîte Vide' ? ' ← NOUVEAU' : '';
      console.log(`   - ${name}: ${count}/100${highlight}`);
    });

    // 6. Résumé
    console.log('\n📊 RÉSUMÉ:');
    const allGood = emptyBoxTrap && settings && settings.trap_empty_box;

    if (allGood) {
      console.log('   ✅ Le piège est bien intégré aux mystery boxes aléatoires');
      console.log('   ✅ Le toggle existe et est activé');
      console.log(`   ✅ ${emptyBoxCount}/100 tirages ont donné la Boîte Vide`);
    } else {
      console.log('   ⚠️ Problème d\'intégration détecté!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifyIntegration();
