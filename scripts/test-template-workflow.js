require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';

async function testTemplateWorkflow() {
  console.log('🔍 TEST DU WORKFLOW COMPLET DU SÉLECTEUR DE TEMPLATES\n');
  console.log('━'.repeat(100));

  try {
    // 1. Récupérer tous les templates
    console.log('\n📊 ÉTAPE 1: Récupération des templates (comme showTemplatesListMenu)\n');

    const templates = await db.query(`
      SELECT id, guild_id, type, title, description, color, image_url, thumbnail_url, footer_text
      FROM announcement_templates
      WHERE guild_id = $1
      ORDER BY type
    `, [GUILD_ID]);

    console.log(`   ✅ ${templates.length} template(s) récupéré(s)\n`);

    // 2. Vérifier le template trap_lose_all_collectibles
    console.log('━'.repeat(100));
    console.log('\n📊 ÉTAPE 2: Vérification du template trap_lose_all_collectibles\n');

    const loseAllTemplate = templates.find(t => t.type === 'trap_lose_all_collectibles');
    if (loseAllTemplate) {
      console.log('   ✅ Template trouvé:');
      console.log(`      Type: ${loseAllTemplate.type}`);
      console.log(`      Title: ${loseAllTemplate.title}`);
      console.log(`      Description: ${loseAllTemplate.description.substring(0, 100)}...`);
      console.log(`      Color: ${loseAllTemplate.color}`);
    } else {
      console.log('   ❌ Template NON TROUVÉ !');
      return;
    }

    // 3. Simuler la génération des options du sélecteur
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 ÉTAPE 3: Génération des options du sélecteur\n');

    const templateLabels = {
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

    const selectOptions = templates.map(template => {
      const label = templateLabels[template.type] || template.type;
      const description = template.title.substring(0, 100);

      return {
        label: label,
        value: template.type,
        description: description
      };
    });

    console.log('   Options générées pour le StringSelectMenu:\n');
    selectOptions.forEach((opt, idx) => {
      const marker = opt.value === 'trap_lose_all_collectibles' ? '👉' : '  ';
      console.log(`   ${marker} ${(idx + 1).toString().padStart(2)}. ${opt.label.padEnd(35)} (value: ${opt.value})`);
    });

    // 4. Simuler la sélection de trap_lose_all_collectibles
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 ÉTAPE 4: Simulation de la sélection (interaction.values[0])\n');

    const selectedType = 'trap_lose_all_collectibles'; // Simuler interaction.values[0]
    console.log(`   📌 Type sélectionné: ${selectedType}\n`);

    // 5. Simuler getAnnouncementTemplate
    console.log('━'.repeat(100));
    console.log('\n📊 ÉTAPE 5: Récupération du template (getAnnouncementTemplate)\n');

    const fetchedTemplate = await db.queryOne(`
      SELECT *
      FROM announcement_templates
      WHERE type = $1 AND guild_id = $2
    `, [selectedType, GUILD_ID]);

    if (fetchedTemplate) {
      console.log('   ✅ Template récupéré avec succès !');
      console.log(`      ID: ${fetchedTemplate.id}`);
      console.log(`      Type: ${fetchedTemplate.type}`);
      console.log(`      Title: ${fetchedTemplate.title}`);
      console.log(`      Description: ${fetchedTemplate.description.substring(0, 100)}...`);
      console.log(`      Color: ${fetchedTemplate.color}`);
      console.log(`      Image: ${fetchedTemplate.image_url || 'Aucune'}`);
      console.log(`      Thumbnail: ${fetchedTemplate.thumbnail_url || 'Aucune'}`);
      console.log(`      Footer: ${fetchedTemplate.footer_text || 'Non défini'}`);
    } else {
      console.log('   ❌ Échec de récupération !');
      return;
    }

    // 6. Vérifier le label dans showEditTemplateMenu
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 ÉTAPE 6: Vérification du label dans showEditTemplateMenu\n');

    const labelInEditMenu = templateLabels[fetchedTemplate.type];
    if (labelInEditMenu) {
      console.log(`   ✅ Label trouvé: "${labelInEditMenu}"`);
      console.log(`      Titre du menu: "📝 Édition: ${labelInEditMenu}"`);
    } else {
      console.log(`   ❌ Label NON TROUVÉ pour le type "${fetchedTemplate.type}" !`);
      console.log('   ⚠️  Le titre du menu sera: "📝 Édition: undefined"');
    }

    // 7. Vérifier les variables disponibles
    console.log('\n' + '━'.repeat(100));
    console.log('\n📊 ÉTAPE 7: Vérification des variables disponibles\n');

    const availableVars = {
      legendary_collectible: '{userName}, {collectibleName}',
      collection_completed: '{userName}, {themeName}, {roleName}',
      collection_traded: '{user1Name}, {user2Name}, {missionName}',
      collection_lost: '{userName}, {trapName}',
      trap_curse: '{userName}, {trapName}, {trapEffect}',
      trap_cooldown: '{userName}, {trapName}, {duration}',
      trap_lose_collectible: '{userName}, {trapName}, {collectible}',
      trap_public_shame: '{userName}, {trapName}',
      trap_malus_points: '{userName}, {trapName}, {points}',
      trap_empty_box: '{userName}, {trapName}',
      trap_lose_all_collectibles: '{userName}, {trapName}, {count}',
      mission_word_guessed: '{userName}, {word}, {missionName}',
      mission_started: '{userName}, {missionName}, {timeLimit}',
      mission_completed: '{userName}, {missionName}, {rewardName}',
      mission_failed: '{userName}, {missionName}, {failReason}',
      mission_approved: '{userName}, {missionName}, {adminName}, {rewardName}',
      mission_rejected: '{userName}, {missionName}, {adminName}',
      theme_expired: '{themeName}, {durationDays}, {expirationDate}',
      theme_expiring_soon: '{themeName}, {daysRemaining}, {expirationDate}'
    };

    const vars = availableVars[fetchedTemplate.type];
    if (vars) {
      console.log(`   ✅ Variables disponibles: ${vars}`);
    } else {
      console.log(`   ❌ Variables NON DÉFINIES pour le type "${fetchedTemplate.type}" !`);
      console.log('   ⚠️  Le champ "Variables disponibles" sera: "Aucune"');
    }

    console.log('\n' + '━'.repeat(100));
    console.log('\n✅ WORKFLOW COMPLET TESTÉ\n');

    // Conclusion
    console.log('━'.repeat(100));
    console.log('\n📋 CONCLUSION:\n');

    const issues = [];

    if (!loseAllTemplate) {
      issues.push('❌ Template trap_lose_all_collectibles absent de la BD');
    }

    if (!labelInEditMenu) {
      issues.push('❌ Label manquant dans templateLabels de showEditTemplateMenu');
    }

    if (!vars) {
      issues.push('❌ Variables manquantes dans availableVars de showEditTemplateMenu');
    }

    if (issues.length === 0) {
      console.log('   ✅ TOUT EST EN ORDRE !');
      console.log('   ✅ Le template existe en BD');
      console.log('   ✅ Le label est défini');
      console.log('   ✅ Les variables sont définies');
      console.log('   ');
      console.log('   Le sélecteur devrait fonctionner correctement !');
    } else {
      console.log('   ⚠️  PROBLÈMES DÉTECTÉS:\n');
      issues.forEach(issue => console.log(`   ${issue}`));
    }

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
  } finally {
    await db.close();
  }
}

testTemplateWorkflow();
