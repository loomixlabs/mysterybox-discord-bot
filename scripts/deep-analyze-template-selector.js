require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function analyzeTemplateSelector() {
  console.log('🔍 ANALYSE APPROFONDIE DU SÉLECTEUR DE TEMPLATES\n');
  console.log('━'.repeat(100));

  try {
    // 1. Vérifier tous les templates en base de données
    console.log('\n📊 1. TEMPLATES EN BASE DE DONNÉES\n');

    const templates = await db.query(`
      SELECT id, guild_id, type, title, description, enable_toggle
      FROM announcement_templates
      WHERE guild_id = $1
      ORDER BY type
    `, [GUILD_ID]);

    console.log(`   ${templates.length} template(s) trouvé(s):\n`);
    templates.forEach(t => {
      console.log(`   ${t.type.padEnd(30)} | ${t.title.substring(0, 50)} | Toggle: ${t.enable_toggle}`);
    });

    // 2. Vérifier spécifiquement le template trap_lose_all_collectibles
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 2. TEMPLATE trap_lose_all_collectibles\n');

    const loseAllTemplate = templates.find(t => t.type === 'trap_lose_all_collectibles');
    if (loseAllTemplate) {
      console.log('   ✅ Template trouvé en base de données:');
      console.log(`      ID: ${loseAllTemplate.id}`);
      console.log(`      Type: ${loseAllTemplate.type}`);
      console.log(`      Title: ${loseAllTemplate.title}`);
      console.log(`      Description: ${loseAllTemplate.description}`);
      console.log(`      Enable Toggle: ${loseAllTemplate.enable_toggle}`);
    } else {
      console.log('   ❌ Template trap_lose_all_collectibles NON TROUVÉ en base de données');
      console.log('   ⚠️  PROBLÈME: Le template doit exister pour apparaître dans le sélecteur');
    }

    // 3. Vérifier le mapping templateLabels dans le code
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 3. MAPPING templateLabels DANS LE CODE\n');

    const templateLabelsInCode = {
      legendary_collectible: '⭐ Collectible Légendaire',
      collection_completed: '🎉 Collection Complétée',
      collection_traded: '🔄 Échange de Collection',
      collection_lost: '💀 Collection Perdue',
      trap_curse: '😈 Malédiction',
      trap_cooldown: '⏱️ Piège Cooldown',
      trap_lose_collectible: '💀 Piège Voleur',
      trap_public_shame: '😱 Piège de la Honte',
      trap_malus_points: '⚠️ Piège Maudit',
      trap_empty_box: '📦 Boîte Vide',
      trap_lose_all_collectibles: '💥 Piège Dévastateur',
      mission_word_guessed: '🎯 Mot Deviné',
      mission_started: '⚔️ Mission Lancée',
      mission_completed: '✅ Mission Réussie',
      mission_failed: '❌ Mission Échouée',
      mission_approved: '👍 Mission Approuvée',
      mission_rejected: '⛔ Mission Refusée',
      theme_expired: '🔴 Thème Expiré',
      theme_expiring_soon: '⏰ Expiration Prochaine'
    };

    console.log('   Labels définis dans le code:');
    Object.keys(templateLabelsInCode).forEach(key => {
      if (key.startsWith('trap_')) {
        const inDb = templates.find(t => t.type === key);
        const status = inDb ? '✅' : '❌';
        console.log(`   ${status} ${key.padEnd(30)} = ${templateLabelsInCode[key]}`);
      }
    });

    // 4. Simuler la génération des options du sélecteur
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 4. SIMULATION DU SÉLECTEUR\n');

    console.log('   Options qui seront générées pour le StringSelectMenu:\n');

    const selectOptions = templates.map(template => {
      const label = templateLabelsInCode[template.type] || template.type;
      const description = template.title.substring(0, 100);

      return {
        label: label,
        value: template.type,
        description: description
      };
    });

    selectOptions.forEach((opt, idx) => {
      console.log(`   ${(idx + 1).toString().padStart(2)}. Label: ${opt.label.padEnd(30)} | Value: ${opt.value}`);
    });

    // 5. Vérifier le workflow complet
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 5. WORKFLOW COMPLET\n');

    console.log('   Étape 1: Utilisateur clique sur "Éditer Templates"');
    console.log('            → showTemplatesListMenu() est appelé\n');

    console.log('   Étape 2: Génération du sélecteur');
    console.log(`            → ${templates.length} options créées à partir de la BD\n`);

    console.log('   Étape 3: Utilisateur sélectionne une option');
    console.log('            → interaction.values[0] contient le type sélectionné\n');

    console.log('   Étape 4: Handler "select_template_to_edit"');
    console.log('            → showEditTemplateMenu(interaction) est appelé\n');

    console.log('   Étape 5: Chargement du template depuis la BD');
    console.log('            → db.getAnnouncementTemplate(templateType, guildId)\n');

    // 6. Vérifier la méthode getAnnouncementTemplate
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 6. TEST DE getAnnouncementTemplate\n');

    if (loseAllTemplate) {
      console.log('   Test de récupération du template trap_lose_all_collectibles:');
      const fetchedTemplate = await db.queryOne(`
        SELECT * FROM announcement_templates
        WHERE type = $1 AND guild_id = $2
      `, ['trap_lose_all_collectibles', GUILD_ID]);

      if (fetchedTemplate) {
        console.log('   ✅ Template récupéré avec succès');
        console.log(`      Type: ${fetchedTemplate.type}`);
        console.log(`      Title: ${fetchedTemplate.title}`);
      } else {
        console.log('   ❌ Échec de récupération du template');
      }
    }

    console.log('\n' + '━'.repeat(100));
    console.log('\n✅ ANALYSE TERMINÉE\n');

    // Conclusion
    console.log('📋 CONCLUSION:\n');
    if (!loseAllTemplate) {
      console.log('   ❌ PROBLÈME CRITIQUE: Le template trap_lose_all_collectibles');
      console.log('      n\'existe pas en base de données pour ce serveur !');
      console.log('   ');
      console.log('   💡 SOLUTION: Exécuter la migration pour créer le template:');
      console.log('      node scripts/migrations/add-trap-lose-all-template.js');
    } else {
      console.log('   ✅ Le template existe en base de données');
      console.log('   ✅ Le label est défini dans le code');
      console.log('   ✅ Le sélecteur devrait fonctionner correctement');
      console.log('   ');
      console.log('   📝 Si le problème persiste, vérifier:');
      console.log('      - Les logs de la console lors de la sélection');
      console.log('      - La méthode getAnnouncementTemplate() dans database-pg.js');
      console.log('      - Le handler de "select_template_to_edit" dans adminPanelHandler.js');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

analyzeTemplateSelector();
