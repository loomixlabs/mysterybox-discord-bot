/**
 * 🔍 AUDIT COMPLET DU SYSTÈME DE BADGES
 *
 * Ce script vérifie pour CHAQUE badge :
 * 1. ✅ Présence en base de données (table badges)
 * 2. ✅ Mapping dans badgeHandler.js (condition_type → code)
 * 3. ✅ Hook existant pour déclencher le badge
 * 4. ✅ Intégration du hook dans les handlers appropriés
 * 5. ✅ Affichage dans le sélecteur de catégories (profileView.js)
 * 6. ✅ Fonctions DB requises (getBadgeByCode, updateBadgeProgress, etc.)
 *
 * Usage: node scripts/audit-badges-complete.js
 */

require('dotenv').config();
const db = require('../utils/database-pg');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION DE L'AUDIT
// ============================================================================

// Fichiers à analyser
const FILES_TO_ANALYZE = {
  badgeHandler: path.join(__dirname, '../handlers/badgeHandler.js'),
  mysteryBoxHandler: path.join(__dirname, '../handlers/mysteryBoxHandler.js'),
  missionHandler: path.join(__dirname, '../handlers/missionHandler.js'),
  profileHandler: path.join(__dirname, '../handlers/profileHandler.js'),
  dailyClaimHandler: path.join(__dirname, '../handlers/dailyClaimHandler.js'),
  craftingHandler: path.join(__dirname, '../handlers/craftingHandler.js'),
  superBonusHandler: path.join(__dirname, '../handlers/superBonusHandler.js'),
  profileView: path.join(__dirname, '../views/profileView.js'),
  databasePg: path.join(__dirname, '../utils/database-pg.js')
};

// Mapping condition_type → hook attendu
const CONDITION_TYPE_TO_HOOK = {
  // Collection
  'collectible_count': 'onCollectibleFound OR onCollectibleFoundWithDetails',
  'rarity_collect': 'onCollectibleFoundWithDetails',

  // Rareté spécifique
  'legendary_count': 'onCollectibleFoundWithDetails',
  'epic_count': 'onCollectibleFoundWithDetails',
  'rare_count': 'onCollectibleFoundWithDetails',

  // Évolution
  'evolution_level': 'onCollectibleEvolution',
  'max_level_count': 'onCollectibleEvolution',

  // Mystery Box
  'mystery_box_open': 'onMysteryBoxOpened OR onMysteryBoxOpenedWithRarity',
  'epic_box_open': 'onMysteryBoxOpenedWithRarity',
  'legendary_box_open': 'onMysteryBoxOpenedWithRarity',
  'all_rarities_opened': 'onMysteryBoxOpenedWithRarity',

  // Pièges
  'trap_survive': 'onTrapSurvived',
  'trap_block': 'onTrapBlocked',
  'trap_triggered': 'onTrapTriggered',
  'survive_lose_all': 'onTrapTriggered',

  // Missions
  'mission_complete': 'onMissionCompleted OR onMissionCompletedWithDetails',
  'fast_mission': 'onMissionCompletedWithDetails',
  'perfect_quiz': 'onMissionCompletedWithDetails',
  'wordle_first_try': 'onMissionCompletedWithDetails',
  'flawless_missions': 'onMissionCompletedWithDetails',
  'comeback_mission': 'onMissionCompletedWithDetails',

  // Économie
  'loomix_spent': 'onLoomixOperation',
  'loomix_earned': 'onLoomixOperation',
  'loomix_balance': 'onLoomixOperation',

  // Ancienneté
  'days_active': 'onPlayerActivity',
  'login_streak': 'onLoginStreak',

  // Social
  'flex_count': 'onFlexUsed',
  'favorites_set': 'onFavoritesSet',

  // Mint
  'mint_first': 'onCollectibleFoundWithDetails',
  'first_mint': 'onCollectibleFoundWithDetails',
  'mint_top_10': 'onCollectibleFoundWithDetails',
  'mint_100': 'onCollectibleFoundWithDetails',

  // Chance
  'legendaries_in_24h': 'onCollectibleFoundWithDetails',
  'win_streak': 'onWinStreak',
  'blocks_in_24h': 'onTrapBlocked',

  // Thème
  'theme_completion': 'checkThemeCompletionBadges',

  // Super Bonus
  'super_bonus_usage': 'onSuperBonusUsed',
  'super_bonus_unlock': 'onSuperBonusUsed',
  'super_bonus_count': 'onSuperBonusReceived',

  // Crafting
  'crafting_upgrades': 'onCrafting',
  'crafting_criticals': 'onCrafting',
  'crafting_recycles': 'onCrafting',
  'critical_streak': 'onCrafting',

  // Custom
  'custom': 'MANUEL - Pas de hook automatique'
};

// Catégories attendues dans le sélecteur
const EXPECTED_CATEGORIES = [
  'super_bonus', 'collection', 'rarity', 'mystery_box', 'trap',
  'mission', 'engagement', 'social', 'special', 'crafting',
  'evolution', 'economy', 'seniority', 'luck', 'mint', 'theme'
];

// ============================================================================
// FONCTIONS D'ANALYSE
// ============================================================================

/**
 * Lit le contenu d'un fichier
 */
function readFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Vérifie si un code de badge est présent dans un mapping du badgeHandler
 */
function checkBadgeInMappings(badgeCode, badgeHandlerContent) {
  // Patterns à chercher
  const patterns = [
    `code: '${badgeCode}'`,
    `'${badgeCode}'`,
    `"${badgeCode}"`,
    `unlockBadge(guildId, playerId, '${badgeCode}'`,
    `updateBadgeProgress(guildId, playerId, '${badgeCode}'`,
    `incrementBadgeProgress(guildId, playerId, '${badgeCode}'`
  ];

  for (const pattern of patterns) {
    if (badgeHandlerContent.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Vérifie si un hook est présent et exporté
 */
function checkHookExists(hookName, badgeHandlerContent) {
  // Vérifier la définition de la fonction
  const functionPattern = new RegExp(`async function ${hookName}\\s*\\(`);
  const hasFunction = functionPattern.test(badgeHandlerContent);

  // Vérifier l'export
  const exportPattern = new RegExp(`\\b${hookName}\\b`);
  const exportsSection = badgeHandlerContent.split('module.exports')[1] || '';
  const isExported = exportPattern.test(exportsSection);

  return { hasFunction, isExported };
}

/**
 * Vérifie si un hook est appelé dans un handler
 */
function checkHookIntegration(hookName, handlerContent) {
  if (!handlerContent) return false;

  const patterns = [
    `badgeHandler.${hookName}`,
    `await badgeHandler.${hookName}`,
    `.${hookName}(`
  ];

  for (const pattern of patterns) {
    if (handlerContent.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Vérifie si une catégorie est dans le sélecteur
 */
function checkCategoryInSelector(category, profileViewContent) {
  if (!profileViewContent) return false;
  return profileViewContent.includes(`value: '${category}'`);
}

/**
 * Trouve où un hook devrait être intégré
 */
function getExpectedHandler(conditionType) {
  const handlerMapping = {
    'collectible_count': 'mysteryBoxHandler',
    'rarity_collect': 'mysteryBoxHandler',
    'legendary_count': 'mysteryBoxHandler',
    'epic_count': 'mysteryBoxHandler',
    'rare_count': 'mysteryBoxHandler',
    'evolution_level': 'mysteryBoxHandler OR craftingHandler',
    'max_level_count': 'mysteryBoxHandler OR craftingHandler',
    'mystery_box_open': 'mysteryBoxHandler',
    'epic_box_open': 'mysteryBoxHandler',
    'legendary_box_open': 'mysteryBoxHandler',
    'all_rarities_opened': 'mysteryBoxHandler',
    'trap_survive': 'mysteryBoxHandler',
    'trap_block': 'mysteryBoxHandler',
    'trap_triggered': 'mysteryBoxHandler',
    'survive_lose_all': 'mysteryBoxHandler',
    'mission_complete': 'missionHandler',
    'fast_mission': 'missionHandler',
    'perfect_quiz': 'missionHandler',
    'wordle_first_try': 'missionHandler',
    'flawless_missions': 'missionHandler',
    'comeback_mission': 'missionHandler',
    'loomix_spent': 'Où Loomix est dépensé (shop, crafting)',
    'loomix_earned': 'Où Loomix est gagné (missions, daily)',
    'loomix_balance': 'Où balance est vérifiée',
    'days_active': 'dailyClaimHandler',
    'login_streak': 'dailyClaimHandler',
    'flex_count': 'profileHandler',
    'favorites_set': 'profileHandler',
    'mint_first': 'mysteryBoxHandler',
    'first_mint': 'mysteryBoxHandler',
    'mint_top_10': 'mysteryBoxHandler',
    'mint_100': 'mysteryBoxHandler',
    'legendaries_in_24h': 'mysteryBoxHandler',
    'win_streak': 'mysteryBoxHandler',
    'blocks_in_24h': 'mysteryBoxHandler',
    'theme_completion': 'mysteryBoxHandler',
    'super_bonus_usage': 'superBonusHandler',
    'super_bonus_unlock': 'superBonusHandler',
    'super_bonus_count': 'superBonusHandler',
    'crafting_upgrades': 'craftingHandler',
    'crafting_criticals': 'craftingHandler',
    'crafting_recycles': 'craftingHandler',
    'critical_streak': 'craftingHandler',
    'custom': 'Manuel'
  };
  return handlerMapping[conditionType] || 'Inconnu';
}

// ============================================================================
// AUDIT PRINCIPAL
// ============================================================================

async function runAudit() {
  console.log('═'.repeat(80));
  console.log('🔍 AUDIT COMPLET DU SYSTÈME DE BADGES');
  console.log('═'.repeat(80));
  console.log();

  // Charger les fichiers
  console.log('📂 Chargement des fichiers...');
  const files = {};
  for (const [key, filePath] of Object.entries(FILES_TO_ANALYZE)) {
    files[key] = readFile(filePath);
    if (files[key]) {
      console.log(`   ✅ ${key}: ${filePath.split('\\').pop()}`);
    } else {
      console.log(`   ❌ ${key}: Fichier non trouvé`);
    }
  }
  console.log();

  // Récupérer tous les badges de la DB
  console.log('📊 Récupération des badges depuis la base de données...');
  const badges = await db.queryAll(`
    SELECT id, code, name, emoji, rarity, category, condition_type, condition_value
    FROM badges
    ORDER BY category, condition_type, code
  `);
  console.log(`   → ${badges.length} badges trouvés\n`);

  // Statistiques
  const stats = {
    total: badges.length,
    complete: 0,
    partial: 0,
    broken: 0,
    byCategory: {},
    issues: []
  };

  // Grouper par catégorie
  const badgesByCategory = {};
  for (const badge of badges) {
    if (!badgesByCategory[badge.category]) {
      badgesByCategory[badge.category] = [];
    }
    badgesByCategory[badge.category].push(badge);
  }

  // Auditer chaque catégorie
  for (const category of Object.keys(badgesByCategory).sort()) {
    console.log('─'.repeat(80));
    console.log(`📁 CATÉGORIE: ${category.toUpperCase()}`);
    console.log('─'.repeat(80));

    stats.byCategory[category] = { total: 0, complete: 0, partial: 0, broken: 0 };

    // Vérifier si la catégorie est dans le sélecteur
    const categoryInSelector = checkCategoryInSelector(category, files.profileView);
    if (!categoryInSelector) {
      console.log(`   ⚠️  ATTENTION: Catégorie "${category}" NON présente dans le sélecteur profileView.js\n`);
      stats.issues.push({
        type: 'CATEGORY_MISSING',
        category,
        message: `Catégorie "${category}" non présente dans le sélecteur de catégories`
      });
    } else {
      console.log(`   ✅ Catégorie présente dans le sélecteur\n`);
    }

    for (const badge of badgesByCategory[category]) {
      stats.byCategory[category].total++;

      const checks = {
        inDb: true, // On sait qu'il est en DB puisqu'on l'a récupéré
        inMapping: false,
        hookExists: false,
        hookExported: false,
        hookIntegrated: false,
        expectedHook: CONDITION_TYPE_TO_HOOK[badge.condition_type] || 'INCONNU',
        expectedHandler: getExpectedHandler(badge.condition_type)
      };

      // Check 1: Badge dans le mapping
      checks.inMapping = checkBadgeInMappings(badge.code, files.badgeHandler || '');

      // Check 2: Hook existe et est exporté
      const hookNames = (checks.expectedHook || '').split(' OR ').map(h => h.trim());
      for (const hookName of hookNames) {
        if (hookName && hookName !== 'MANUEL - Pas de hook automatique' && hookName !== 'INCONNU') {
          const hookCheck = checkHookExists(hookName, files.badgeHandler || '');
          if (hookCheck.hasFunction) {
            checks.hookExists = true;
            checks.hookExported = hookCheck.isExported;

            // Check 3: Hook intégré dans les handlers
            const handlersToCheck = checks.expectedHandler.split(' OR ').map(h => h.trim());
            for (const handlerName of handlersToCheck) {
              if (files[handlerName]) {
                if (checkHookIntegration(hookName, files[handlerName])) {
                  checks.hookIntegrated = true;
                  break;
                }
              }
            }
            break;
          }
        }
      }

      // Déterminer le statut
      let status = '❌';
      let statusText = 'CASSÉ';

      if (badge.condition_type === 'custom') {
        status = '🔧';
        statusText = 'MANUEL';
        stats.byCategory[category].complete++;
        stats.complete++;
      } else if (checks.inMapping && checks.hookExists && checks.hookExported && checks.hookIntegrated) {
        status = '✅';
        statusText = 'COMPLET';
        stats.byCategory[category].complete++;
        stats.complete++;
      } else if (checks.inMapping || checks.hookExists) {
        status = '⚠️';
        statusText = 'PARTIEL';
        stats.byCategory[category].partial++;
        stats.partial++;
      } else {
        stats.byCategory[category].broken++;
        stats.broken++;
      }

      // Afficher le résultat
      console.log(`${status} ${badge.code}`);
      console.log(`   📌 ${badge.emoji} ${badge.name}`);
      console.log(`   🎯 condition_type: ${badge.condition_type} (valeur: ${badge.condition_value})`);
      console.log(`   🔗 Hook attendu: ${checks.expectedHook}`);
      console.log(`   📍 Handler attendu: ${checks.expectedHandler}`);
      console.log(`   ─ DB: ✅ | Mapping: ${checks.inMapping ? '✅' : '❌'} | Hook: ${checks.hookExists ? '✅' : '❌'} | Export: ${checks.hookExported ? '✅' : '❌'} | Intégré: ${checks.hookIntegrated ? '✅' : '❌'}`);

      // Lister les problèmes spécifiques
      if (statusText !== 'COMPLET' && statusText !== 'MANUEL') {
        const issues = [];
        if (!checks.inMapping) issues.push('Pas dans le mapping badgeHandler');
        if (!checks.hookExists) issues.push('Hook non défini');
        if (!checks.hookExported) issues.push('Hook non exporté');
        if (!checks.hookIntegrated) issues.push('Hook non intégré dans handler');

        console.log(`   ⚠️  Problèmes: ${issues.join(', ')}`);

        stats.issues.push({
          type: 'BADGE_INCOMPLETE',
          badge: badge.code,
          category: badge.category,
          conditionType: badge.condition_type,
          issues
        });
      }
      console.log();
    }
  }

  // ============================================================================
  // RAPPORT FINAL
  // ============================================================================

  console.log('\n' + '═'.repeat(80));
  console.log('📊 RAPPORT FINAL');
  console.log('═'.repeat(80));

  console.log(`\n📈 STATISTIQUES GLOBALES:`);
  console.log(`   Total badges: ${stats.total}`);
  console.log(`   ✅ Complets: ${stats.complete} (${Math.round(stats.complete/stats.total*100)}%)`);
  console.log(`   ⚠️  Partiels: ${stats.partial} (${Math.round(stats.partial/stats.total*100)}%)`);
  console.log(`   ❌ Cassés: ${stats.broken} (${Math.round(stats.broken/stats.total*100)}%)`);

  console.log(`\n📁 PAR CATÉGORIE:`);
  for (const [cat, catStats] of Object.entries(stats.byCategory)) {
    const pct = Math.round(catStats.complete / catStats.total * 100);
    const bar = '█'.repeat(Math.round(pct/10)) + '░'.repeat(10 - Math.round(pct/10));
    console.log(`   ${cat.padEnd(15)} [${bar}] ${pct}% (${catStats.complete}/${catStats.total} complets)`);
  }

  // Vérification des catégories manquantes dans le sélecteur
  console.log(`\n🎨 CATÉGORIES DANS LE SÉLECTEUR:`);
  for (const cat of EXPECTED_CATEGORIES) {
    const inSelector = checkCategoryInSelector(cat, files.profileView);
    console.log(`   ${inSelector ? '✅' : '❌'} ${cat}`);
  }

  // Liste des badges problématiques
  if (stats.issues.length > 0) {
    console.log(`\n⚠️  PROBLÈMES À CORRIGER (${stats.issues.length}):`);

    const categoryIssues = stats.issues.filter(i => i.type === 'CATEGORY_MISSING');
    const badgeIssues = stats.issues.filter(i => i.type === 'BADGE_INCOMPLETE');

    if (categoryIssues.length > 0) {
      console.log(`\n   📁 Catégories manquantes dans le sélecteur:`);
      for (const issue of categoryIssues) {
        console.log(`      - ${issue.category}`);
      }
    }

    if (badgeIssues.length > 0) {
      console.log(`\n   🏆 Badges incomplets ou cassés:`);
      for (const issue of badgeIssues) {
        console.log(`      - ${issue.badge} (${issue.category})`);
        for (const problem of issue.issues) {
          console.log(`         └─ ${problem}`);
        }
      }
    }
  }

  // Actions recommandées
  console.log(`\n📋 ACTIONS RECOMMANDÉES:`);
  if (stats.broken > 0) {
    console.log(`   1. Corriger les ${stats.broken} badges cassés (mapping + hooks manquants)`);
  }
  if (stats.partial > 0) {
    console.log(`   2. Compléter les ${stats.partial} badges partiels (intégration hooks)`);
  }
  console.log(`   3. Tester chaque catégorie dans le bot (/profile → Badges)`);
  console.log(`   4. Vérifier les notifications DM de déblocage`);

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Audit terminé');
  console.log('═'.repeat(80));

  // Sauvegarder le rapport en JSON
  const reportPath = path.join(__dirname, '../AUDIT-BADGES-REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    stats,
    badgesByCategory: Object.keys(badgesByCategory).reduce((acc, cat) => {
      acc[cat] = badgesByCategory[cat].map(b => ({
        code: b.code,
        name: b.name,
        conditionType: b.condition_type,
        conditionValue: b.condition_value
      }));
      return acc;
    }, {})
  }, null, 2));
  console.log(`\n📄 Rapport JSON sauvegardé: ${reportPath}`);

  process.exit(0);
}

// Lancer l'audit
runAudit().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
