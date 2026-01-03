/**
 * Script de tracking - Section announcement_templates
 *
 * Ce script documente les champs de la section Messages d'annonce
 * LECTURE SEULE - Ne modifie aucun fichier
 *
 * Objectif: Vérifier l'alignement entre:
 * - TemplatesSection.js (composant UI mode DB)
 * - getBaseTemplateData() (template de base pour mode JSON)
 * - announcements.js (vraies variables utilisées par le bot)
 */

console.log('='.repeat(80));
console.log('TRACKING - SECTION MESSAGES D\'ANNONCE (announcement_templates)');
console.log('='.repeat(80));

// ============================================================================
// VARIABLES RÉELLES UTILISÉES PAR LE BOT (announcements.js)
// Source de vérité pour les noms de variables
// ============================================================================

const botVariables = {
  // Collectibles (4)
  legendary_collectible: ['userName', 'collectibleName', 'collectibleImage'],
  collection_completed: ['userName', 'themeName', 'roleName'],
  collection_traded: ['user1Name', 'user2Name', 'missionName'],
  collection_lost: ['userName', 'trapName'],

  // Traps (5)
  trap_cooldown: ['userName', 'trapName', 'cooldownMinutes', 'duration'],
  trap_lose_collectible: ['userName', 'trapName', 'collectibleLost', 'collectible'],
  trap_public_shame: ['userName', 'trapName', 'shameMessage'],
  trap_empty_box: ['userName', 'trapName'],
  trap_lose_all_collectibles: ['userName', 'trapName', 'count'],

  // Missions (6)
  mission_started: ['userName', 'missionName', 'timeLimit'],
  mission_completed: ['userName', 'missionName', 'rewardName'],
  mission_failed: ['userName', 'missionName', 'failReason'],
  mission_approved: ['userName', 'missionName', 'adminName', 'rewardName'],
  mission_rejected: ['userName', 'missionName', 'adminName'],
  mission_word_guessed: ['userName', 'word', 'missionName'],

  // Theme (2)
  theme_expiring_soon: ['themeName', 'daysRemaining', 'expirationDate'],
  theme_expired: ['themeName', 'durationDays', 'expirationDate'],

  // Super Bonus (1)
  legendary_super_bonus: ['userName', 'bonusName', 'bonusIcon', 'bonusImage']
};

// ============================================================================
// VARIABLES UI (TemplatesSection.js)
// ============================================================================

const uiVariables = {
  // Collectibles (4)
  legendary_collectible: ['userName', 'collectibleName', 'collectibleImage'],
  collection_completed: ['userName', 'themeName', 'roleName'],
  collection_traded: ['user1Name', 'user2Name', 'missionName'],
  collection_lost: ['userName', 'collectibleName', 'collectibleLost', 'trapName'],

  // Traps (5)
  trap_cooldown: ['userName', 'trapName', 'cooldownMinutes', 'duration'],
  trap_lose_collectible: ['userName', 'trapName', 'collectibleLost', 'collectibleName', 'collectible'],
  trap_public_shame: ['userName', 'trapName', 'shameMessage'],
  trap_empty_box: ['userName', 'trapName'],
  trap_lose_all_collectibles: ['userName', 'trapName', 'count'],

  // Missions (6)
  mission_started: ['userName', 'missionName', 'timeLimit'],
  mission_completed: ['userName', 'missionName', 'rewardName'],
  mission_failed: ['userName', 'missionName', 'failReason'],
  mission_approved: ['userName', 'missionName', 'adminName', 'rewardName'],
  mission_rejected: ['userName', 'missionName', 'adminName'],
  mission_word_guessed: ['userName', 'word', 'keyword', 'missionName'],

  // Theme (2)
  theme_expiring_soon: ['themeName', 'daysRemaining', 'expirationDate', 'daysLeft'],
  theme_expired: ['themeName', 'durationDays', 'expirationDate'],

  // Super Bonus (1)
  legendary_super_bonus: ['userName', 'bonusName', 'bonusIcon', 'bonusImage']
};

// ============================================================================
// TEMPLATES DE BASE ACTUELS (getBaseTemplateData - lignes 827-848)
// ============================================================================

const currentBaseTemplates = {
  // Collectibles (4)
  legendary_collectible: '🌟 **{player}** a obtenu un collectible **LÉGENDAIRE** : {collectible} !',
  collection_completed: '👑 **{player}** a complété sa collection et obtient le rôle **{role}** !',
  collection_traded: '🔄 **{player}** a échangé un collectible avec **{target}** !',
  collection_lost: '💔 **{player}** a perdu le collectible **{collectible}** !',

  // Traps (5)
  trap_cooldown: '⏱️ **{player}** est piégé pour {duration} !',
  trap_lose_collectible: '💔 **{player}** a perdu un collectible à cause d\'un piège !',
  trap_public_shame: '🔔 **{player}** s\'est fait piéger !',
  trap_empty_box: '📭 **{player}** a ouvert une boîte vide...',
  trap_lose_all_collectibles: '💀 **{player}** a perdu tous ses collectibles !',

  // Missions (6)
  mission_started: '🎮 **{player}** a commencé une mission : {mission}',
  mission_completed: '✅ **{player}** a réussi la mission : {mission}',
  mission_failed: '❌ **{player}** a échoué la mission : {mission}',
  mission_approved: '👍 La mission de **{player}** a été approuvée !',
  mission_rejected: '👎 La mission de **{player}** a été rejetée',
  mission_word_guessed: '🎯 **{player}** a trouvé le mot secret !',

  // Theme (2)
  theme_expiring_soon: '⚠️ Le thème expire bientôt ! Plus que {days} jours.',
  theme_expired: '🔚 Le thème est terminé ! Merci à tous les participants.',

  // Super Bonus (1)
  legendary_super_bonus: '⚡ **{player}** a obtenu un super bonus **LÉGENDAIRE** !'
};

// ============================================================================
// TEMPLATES CORRIGÉS (avec les bonnes variables du bot)
// ============================================================================

const correctedBaseTemplates = {
  // Collectibles (4)
  legendary_collectible: '🌟 **{userName}** a obtenu un collectible **LÉGENDAIRE** : **{collectibleName}** !',
  collection_completed: '👑 **{userName}** a complété la collection **{themeName}** et obtient le rôle **{roleName}** !',
  collection_traded: '🔄 **{user1Name}** a échangé un collectible avec **{user2Name}** !',
  collection_lost: '💔 **{userName}** a perdu un collectible à cause de **{trapName}** !',

  // Traps (5)
  trap_cooldown: '⏱️ **{userName}** a déclenché **{trapName}** et est bloqué pendant **{cooldownMinutes} minutes** !',
  trap_lose_collectible: '💔 **{userName}** a déclenché **{trapName}** et a perdu **{collectibleLost}** !',
  trap_public_shame: '🔔 **{userName}** a déclenché **{trapName}** ! {shameMessage}',
  trap_empty_box: '📭 **{userName}** a déclenché **{trapName}** et n\'a rien obtenu...',
  trap_lose_all_collectibles: '💀 **{userName}** a déclenché **{trapName}** et a perdu **{count}** collectibles !',

  // Missions (6)
  mission_started: '🎮 **{userName}** a commencé la mission **{missionName}** ! Temps limite: {timeLimit}',
  mission_completed: '✅ **{userName}** a réussi la mission **{missionName}** et gagne **{rewardName}** !',
  mission_failed: '❌ **{userName}** a échoué la mission **{missionName}**... Raison: {failReason}',
  mission_approved: '👍 La mission **{missionName}** de **{userName}** a été approuvée par {adminName} ! Récompense: **{rewardName}**',
  mission_rejected: '👎 La mission **{missionName}** de **{userName}** a été rejetée par {adminName}',
  mission_word_guessed: '🎯 **{userName}** a trouvé le mot secret **{word}** dans la mission **{missionName}** !',

  // Theme (2)
  theme_expiring_soon: '⚠️ Le thème **{themeName}** expire bientôt ! Plus que **{daysRemaining} jours**. Date: {expirationDate}',
  theme_expired: '🔚 Le thème **{themeName}** est terminé après **{durationDays} jours** ! Date: {expirationDate}',

  // Super Bonus (1)
  legendary_super_bonus: '⚡ **{userName}** a obtenu le super bonus **{bonusName}** {bonusIcon} !'
};

// ============================================================================
// ANALYSE DES PROBLÈMES
// ============================================================================

console.log('\n📋 TEMPLATES DANS LE BOT (announcements.js)\n');
console.log('Fichier: bot discord/utils/announcements.js');
console.log('-'.repeat(80));

console.log('\n| Clé | Variables utilisées |');
console.log('|-----|---------------------|');
Object.entries(botVariables).forEach(([key, vars]) => {
  console.log(`| ${key.padEnd(30)} | {${vars.join('}, {')}} |`);
});

console.log('\n\n❌ PROBLÈMES IDENTIFIÉS - Templates de base actuels');
console.log('-'.repeat(80));

const problems = [];

// Comparer les variables actuelles vs les vraies variables
Object.entries(currentBaseTemplates).forEach(([key, template]) => {
  const realVars = botVariables[key];

  // Extraire les variables du template actuel
  const usedVars = [];
  const matches = template.match(/\{(\w+)\}/g);
  if (matches) {
    matches.forEach(m => {
      const varName = m.slice(1, -1);
      if (!usedVars.includes(varName)) usedVars.push(varName);
    });
  }

  // Vérifier les incohérences
  const wrongVars = usedVars.filter(v => !realVars.includes(v));
  const missingVars = realVars.filter(v => !usedVars.includes(v));

  if (wrongVars.length > 0 || missingVars.length > 0) {
    problems.push({
      key,
      current: template,
      wrongVars,
      missingVars,
      realVars
    });

    console.log(`\n❌ ${key}`);
    if (wrongVars.length > 0) {
      console.log(`   Variables incorrectes: {${wrongVars.join('}, {')}} (n'existent pas dans le bot)`);
    }
    if (missingVars.length > 0) {
      console.log(`   Variables manquantes: {${missingVars.join('}, {')}} (existent dans le bot)`);
    }
  }
});

if (problems.length === 0) {
  console.log('\n✅ Aucun problème détecté ! Tous les templates utilisent les bonnes variables.');
} else {
  console.log(`\n\n⚠️  ${problems.length} templates avec des variables incorrectes!\n`);
}

// ============================================================================
// TEMPLATES CORRIGÉS À APPLIQUER
// ============================================================================

console.log('\n\n✅ TEMPLATES CORRIGÉS À APPLIQUER');
console.log('-'.repeat(80));
console.log('\nCopier ce bloc dans getBaseTemplateData() (theme-builder.js lignes 827-848):\n');

console.log('announcement_templates: {');
console.log('  // Collectibles (4)');
console.log(`  legendary_collectible: '${correctedBaseTemplates.legendary_collectible}',`);
console.log(`  collection_completed: '${correctedBaseTemplates.collection_completed}',`);
console.log(`  collection_traded: '${correctedBaseTemplates.collection_traded}',`);
console.log(`  collection_lost: '${correctedBaseTemplates.collection_lost}',`);
console.log('  // Traps (5)');
console.log(`  trap_cooldown: '${correctedBaseTemplates.trap_cooldown}',`);
console.log(`  trap_lose_collectible: '${correctedBaseTemplates.trap_lose_collectible}',`);
console.log(`  trap_public_shame: '${correctedBaseTemplates.trap_public_shame}',`);
console.log(`  trap_empty_box: '${correctedBaseTemplates.trap_empty_box}',`);
console.log(`  trap_lose_all_collectibles: '${correctedBaseTemplates.trap_lose_all_collectibles}',`);
console.log('  // Missions (6)');
console.log(`  mission_started: '${correctedBaseTemplates.mission_started}',`);
console.log(`  mission_completed: '${correctedBaseTemplates.mission_completed}',`);
console.log(`  mission_failed: '${correctedBaseTemplates.mission_failed}',`);
console.log(`  mission_approved: '${correctedBaseTemplates.mission_approved}',`);
console.log(`  mission_rejected: '${correctedBaseTemplates.mission_rejected}',`);
console.log(`  mission_word_guessed: '${correctedBaseTemplates.mission_word_guessed}',`);
console.log('  // Theme (2)');
console.log(`  theme_expiring_soon: '${correctedBaseTemplates.theme_expiring_soon}',`);
console.log(`  theme_expired: '${correctedBaseTemplates.theme_expired}',`);
console.log('  // Super Bonus (1)');
console.log(`  legendary_super_bonus: '${correctedBaseTemplates.legendary_super_bonus}'`);
console.log('},');

// ============================================================================
// RÉCAPITULATIF
// ============================================================================

console.log('\n\n' + '='.repeat(80));
console.log('RÉCAPITULATIF SECTION MESSAGES D\'ANNONCE');
console.log('='.repeat(80));
console.log(`
📁 FICHIERS:
   - Composant UI:     TemplatesSection.js (18 templates, 5 catégories)
   - Template base:    theme-builder.js lignes 827-848
   - Bot variables:    announcements.js (source de vérité)

📊 STATISTIQUES:
   - Total templates: 18
   - Catégories: 5 (Collectibles: 4, Traps: 5, Missions: 6, Theme: 2, Super Bonus: 1)
   - Templates avec problèmes: ${problems.length}

🔧 PROBLÈME PRINCIPAL:
   Les templates de base utilisent {player} au lieu de {userName}
   Le bot attend les vraies variables comme: userName, missionName, trapName, etc.

✅ ACTION REQUISE:
   1. Mettre à jour getBaseTemplateData() avec les templates corrigés
   2. Les nouvelles variables seront automatiquement utilisées
   3. L'UI (TemplatesSection.js) propose déjà les bonnes variables
`);

console.log('='.repeat(80));
