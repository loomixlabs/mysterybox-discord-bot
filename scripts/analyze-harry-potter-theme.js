/**
 * Analyse complète du thème Harry Potter (VPS)
 * Serveur: 1182395170273099806
 */

const db = require('../utils/database-pg');

async function analyze() {
  console.log('\n' + '='.repeat(80));
  console.log('🧙 ANALYSE COMPLÈTE DU THÈME HARRY POTTER');
  console.log('='.repeat(80));

  const guildId = '1182395170273099806';

  try {
    // 1. Informations du thème
    console.log('\n📋 1. INFORMATIONS DU THÈME');
    console.log('─'.repeat(60));
    const themes = await db.queryAll(
      `SELECT id, name, is_active, created_at
       FROM themes WHERE guild_id = $1 ORDER BY id`,
      [guildId]
    );
    console.table(themes);

    const activeTheme = themes.find(t => t.is_active);
    if (!activeTheme) {
      console.log('❌ Aucun thème actif trouvé!');
      process.exit(1);
    }
    const themeId = activeTheme.id;
    console.log(`\n✅ Thème actif: "${activeTheme.name}" (ID: ${themeId})`);

    // 2. Collectibles
    console.log('\n📦 2. COLLECTIBLES');
    console.log('─'.repeat(60));
    const collectibles = await db.queryAll(
      `SELECT id, name, rarity, image_url, reveal_message
       FROM collectibles
       WHERE guild_id = $1 AND theme_id = $2
       ORDER BY
         CASE rarity
           WHEN 'legendary' THEN 1
           WHEN 'epic' THEN 2
           WHEN 'rare' THEN 3
           WHEN 'common' THEN 4
         END, name`,
      [guildId, themeId]
    );

    const collectiblesByRarity = {
      legendary: collectibles.filter(c => c.rarity === 'legendary'),
      epic: collectibles.filter(c => c.rarity === 'epic'),
      rare: collectibles.filter(c => c.rarity === 'rare'),
      common: collectibles.filter(c => c.rarity === 'common')
    };

    console.log(`\n📊 Répartition par rareté:`);
    console.log(`   🌟 Légendaires: ${collectiblesByRarity.legendary.length}`);
    collectiblesByRarity.legendary.forEach(c => console.log(`      - ${c.name}`));
    console.log(`   💜 Épiques: ${collectiblesByRarity.epic.length}`);
    collectiblesByRarity.epic.forEach(c => console.log(`      - ${c.name}`));
    console.log(`   💙 Rares: ${collectiblesByRarity.rare.length}`);
    collectiblesByRarity.rare.forEach(c => console.log(`      - ${c.name}`));
    console.log(`   ⚪ Communs: ${collectiblesByRarity.common.length}`);
    collectiblesByRarity.common.forEach(c => console.log(`      - ${c.name}`));
    console.log(`   📦 TOTAL: ${collectibles.length}`);

    const withoutImage = collectibles.filter(c => !c.image_url);
    if (withoutImage.length > 0) {
      console.log(`\n⚠️  Collectibles SANS image (${withoutImage.length}):`);
      withoutImage.forEach(c => console.log(`   - ${c.name} (${c.rarity})`));
    }

    const withoutReveal = collectibles.filter(c => !c.reveal_message);
    if (withoutReveal.length > 0) {
      console.log(`\n⚠️  Collectibles SANS message de révélation (${withoutReveal.length}):`);
      withoutReveal.slice(0, 5).forEach(c => console.log(`   - ${c.name} (${c.rarity})`));
      if (withoutReveal.length > 5) console.log(`   ... et ${withoutReveal.length - 5} autres`);
    }

    // 3. Pièges
    console.log('\n🪤 3. PIÈGES');
    console.log('─'.repeat(60));
    const traps = await db.queryAll(
      `SELECT id, name, type, severity, cooldown_duration, description, is_active,
              notif_title, notif_description
       FROM traps
       WHERE guild_id = $1 AND theme_id = $2
       ORDER BY severity DESC, name`,
      [guildId, themeId]
    );

    if (traps.length === 0) {
      console.log('❌ AUCUN PIÈGE configuré pour ce thème!');
    } else {
      console.log(`\n📊 ${traps.length} pièges configurés:`);
      traps.forEach(t => {
        const active = t.is_active ? '✅' : '❌';
        const severity = '⚠️'.repeat(t.severity || 3);
        const cooldown = t.cooldown_duration ? `${t.cooldown_duration} min` : 'N/A';
        const themed = (t.notif_title && t.notif_title.toLowerCase().includes('harry')) ||
                      (t.notif_title && t.notif_title.toLowerCase().includes('poudlard')) ||
                      (t.notif_title && t.notif_title.toLowerCase().includes('maléfice')) ? '🧙' : '⚪';
        console.log(`   ${active} ${themed} ${t.name}`);
        console.log(`      Type: ${t.type} | Sévérité: ${severity} (${t.severity}/5) | Cooldown: ${cooldown}`);
        if (t.notif_title) console.log(`      Titre: "${t.notif_title}"`);
      });
    }

    // 4. Missions
    console.log('\n🎯 4. MISSIONS');
    console.log('─'.repeat(60));
    const missions = await db.queryAll(
      `SELECT id, name, type, description, timeout, validation_type
       FROM missions
       WHERE guild_id = $1 AND theme_id = $2
       ORDER BY type, name`,
      [guildId, themeId]
    );

    if (missions.length === 0) {
      console.log('❌ AUCUNE MISSION configurée pour ce thème!');
    } else {
      const missionsByType = {};
      missions.forEach(m => {
        if (!missionsByType[m.type]) missionsByType[m.type] = [];
        missionsByType[m.type].push(m);
      });

      console.log(`\n📊 ${missions.length} missions configurées:`);
      Object.entries(missionsByType).forEach(([type, list]) => {
        console.log(`\n   📌 Type "${type}" (${list.length}):`);
        list.forEach(m => {
          const timeout = m.timeout ? `${m.timeout} min` : '∞';
          const themed = m.description && (
            m.description.toLowerCase().includes('harry') ||
            m.description.toLowerCase().includes('poudlard') ||
            m.description.toLowerCase().includes('magie') ||
            m.description.toLowerCase().includes('sortilège')
          ) ? '🧙' : '⚪';
          console.log(`      ${themed} ${m.name} (${timeout}) [${m.validation_type}]`);
        });
      });
    }

    // 5. Questions de Quiz
    console.log('\n❓ 5. QUESTIONS DE QUIZ');
    console.log('─'.repeat(60));
    const quizQuestions = await db.queryAll(
      `SELECT qq.id, qq.question, qq.type, m.name as mission_name
       FROM quiz_questions qq
       LEFT JOIN missions m ON qq.mission_id = m.id
       WHERE qq.guild_id = $1 AND qq.theme_id = $2
       ORDER BY qq.type, qq.id`,
      [guildId, themeId]
    );

    if (quizQuestions.length === 0) {
      console.log('❌ AUCUNE QUESTION DE QUIZ pour ce thème!');
    } else {
      console.log(`✅ ${quizQuestions.length} questions de quiz configurées`);

      // Par type
      const byType = {};
      quizQuestions.forEach(q => {
        if (!byType[q.type]) byType[q.type] = [];
        byType[q.type].push(q);
      });

      Object.entries(byType).forEach(([type, list]) => {
        console.log(`\n   📝 Type "${type}" (${list.length}):`);
        list.slice(0, 3).forEach(q => {
          const themed = q.question.toLowerCase().includes('harry') ||
                        q.question.toLowerCase().includes('poudlard') ||
                        q.question.toLowerCase().includes('voldemort') ? '🧙' : '⚪';
          console.log(`      ${themed} "${q.question.substring(0, 60)}..."`);
        });
        if (list.length > 3) console.log(`      ... et ${list.length - 3} autres`);
      });
    }

    // 6. Templates d'annonces
    console.log('\n📢 6. TEMPLATES D\'ANNONCES');
    console.log('─'.repeat(60));
    const templates = await db.queryAll(
      `SELECT type, title, description, theme_id, image_url, thumbnail_url
       FROM announcement_templates
       WHERE guild_id = $1 AND (theme_id = $2 OR theme_id IS NULL)
       ORDER BY theme_id NULLS FIRST, type`,
      [guildId, themeId]
    );

    const themeTemplates = templates.filter(t => t.theme_id === themeId);
    const globalTemplates = templates.filter(t => t.theme_id === null);

    console.log(`\n📊 Templates pour ce thème (ID ${themeId}): ${themeTemplates.length}`);
    console.log(`📊 Templates globaux (fallback): ${globalTemplates.length}`);

    if (themeTemplates.length === 0) {
      console.log('\n⚠️  AUCUN TEMPLATE spécifique au thème Harry Potter!');
      console.log('   → Le système utilise les templates globaux (génériques)');
    } else {
      console.log('\n✅ Templates spécifiques au thème:');
      themeTemplates.forEach(t => {
        const themed = t.title.toLowerCase().includes('harry') ||
                      t.title.toLowerCase().includes('poudlard') ||
                      t.title.toLowerCase().includes('maléfice') ||
                      t.title.toLowerCase().includes('sortilège') ||
                      t.title.toLowerCase().includes('magie') ? '🧙' : '⚪';
        const hasImage = t.image_url ? '🖼️' : '';
        console.log(`   ${themed} ${t.type}: "${t.title}" ${hasImage}`);
      });
    }

    // 7. Messages du thème
    console.log('\n💬 7. MESSAGES DU THÈME');
    console.log('─'.repeat(60));
    const messages = await db.queryAll(
      `SELECT message_type, title, content, button_text
       FROM theme_messages
       WHERE guild_id = $1 AND theme_id = $2
       ORDER BY message_type`,
      [guildId, themeId]
    );

    if (messages.length === 0) {
      console.log('❌ AUCUN MESSAGE personnalisé pour ce thème!');
    } else {
      console.log(`\n📊 ${messages.length} messages configurés:`);
      messages.forEach(m => {
        const themed = (m.title && m.title.toLowerCase().includes('harry')) ||
                      (m.title && m.title.toLowerCase().includes('poudlard')) ? '🧙' : '⚪';
        console.log(`   ${themed} ${m.message_type}: "${m.title || 'Sans titre'}"`);
        if (m.button_text) console.log(`      Bouton: "${m.button_text}"`);
      });
    }

    // 8. Configuration du thème
    console.log('\n⚙️ 8. CONFIGURATION DU THÈME');
    console.log('─'.repeat(60));
    const config = await db.queryOne(
      `SELECT * FROM theme_config WHERE guild_id = $1 AND theme_id = $2`,
      [guildId, themeId]
    );

    if (!config) {
      console.log('❌ AUCUNE CONFIGURATION trouvée pour ce thème!');
    } else {
      console.log('✅ Configuration trouvée:');
      console.log(`   📊 Probabilités: ${config.rarity_probabilities ? JSON.stringify(config.rarity_probabilities) : 'Non définies'}`);
      console.log(`   🎨 Couleur embed: ${config.embed_color || 'Non définie'}`);
    }

    // 9. Rôles de progression
    console.log('\n👑 9. RÔLES DE PROGRESSION');
    console.log('─'.repeat(60));
    const roles = await db.queryAll(
      `SELECT id, name, role_discord_id, required_items, color
       FROM progression_roles
       WHERE guild_id = $1 AND theme_id = $2
       ORDER BY required_items`,
      [guildId, themeId]
    );

    if (roles.length === 0) {
      console.log('❌ AUCUN RÔLE DE PROGRESSION configuré!');
    } else {
      console.log(`\n📊 ${roles.length} rôles configurés:`);
      roles.forEach(r => {
        const discordId = r.role_discord_id ? `✅ <@&${r.role_discord_id}>` : '❌ MANQUE ID DISCORD';
        console.log(`   🎖️ ${r.name} (${r.required_items} items) - ${discordId}`);
      });
    }

    // 10. RÉSUMÉ FINAL
    console.log('\n' + '='.repeat(80));
    console.log('📋 RÉSUMÉ - CE QUI MANQUE POUR COMPLÉTER LE THÈME HARRY POTTER');
    console.log('='.repeat(80));

    const issues = [];
    const recommendations = [];

    // Collectibles
    if (collectibles.length < 10) {
      issues.push(`❌ Seulement ${collectibles.length} collectibles (minimum recommandé: 10-20)`);
    }
    if (collectiblesByRarity.legendary.length === 0) {
      issues.push('❌ Aucun collectible LÉGENDAIRE');
    }
    if (withoutReveal.length > collectibles.length / 2) {
      recommendations.push(`💡 ${withoutReveal.length}/${collectibles.length} collectibles sans message de révélation thématique`);
    }

    // Pièges
    if (traps.length === 0) {
      issues.push('❌ Aucun piège configuré');
    } else if (traps.length < 3) {
      recommendations.push(`💡 Seulement ${traps.length} pièges - ajouter plus de variété?`);
    }

    // Missions
    if (missions.length === 0) {
      issues.push('❌ Aucune mission configurée');
    } else if (missions.length < 5) {
      recommendations.push(`💡 Seulement ${missions.length} missions - ajouter plus?`);
    }

    // Quiz
    if (quizQuestions.length === 0) {
      recommendations.push('💡 Pas de questions de quiz Harry Potter');
    }

    // Templates
    if (themeTemplates.length === 0) {
      issues.push('⚠️  Pas de templates d\'annonces personnalisés Harry Potter');
    }

    // Messages
    if (messages.length === 0) {
      recommendations.push('💡 Pas de messages personnalisés Harry Potter');
    }

    // Config
    if (!config) {
      issues.push('❌ Pas de configuration de thème');
    }

    // Rôles
    if (roles.length === 0) {
      issues.push('❌ Pas de rôles de progression');
    }

    if (issues.length === 0 && recommendations.length === 0) {
      console.log('\n🎉 Le thème Harry Potter est COMPLET!');
    } else {
      if (issues.length > 0) {
        console.log(`\n🔴 ${issues.length} PROBLÈMES CRITIQUES:\n`);
        issues.forEach(issue => console.log(`   ${issue}`));
      }
      if (recommendations.length > 0) {
        console.log(`\n🟡 ${recommendations.length} RECOMMANDATIONS:\n`);
        recommendations.forEach(rec => console.log(`   ${rec}`));
      }
    }

    console.log('\n' + '='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyze();
