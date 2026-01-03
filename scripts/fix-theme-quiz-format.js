/**
 * Script complet pour corriger le format des fichiers de thèmes
 * Corrige:
 * - final_role → final_role_name + final_role_color
 * - traps: effect_type → type (avec mapping des valeurs)
 * - traps: ajout description si manquante
 * - quiz: question → question_text
 * - quiz: correct_index → correct_answer
 */

const fs = require('fs');
const path = require('path');

const PRESETS_DIR = path.join(__dirname, '..', 'themes', 'presets');

// Mapping des types de pièges anciens vers nouveaux
const TRAP_TYPE_MAPPING = {
  'freeze': 'cooldown',
  'lose_item': 'lose-collectible',
  'lose_all': 'lose-all-collectibles',
  'cooldown_increase': 'cooldown',
  'mystery_box_block': 'empty-box',
  'points_malus': 'points-malus',
  'public_shame': 'public-shame'
};

function fixThemeFormat(filePath) {
  console.log(`\n📁 Traitement de: ${path.basename(filePath)}`);

  const content = fs.readFileSync(filePath, 'utf8');
  const theme = JSON.parse(content);

  let fixCount = 0;

  // 1. Corriger final_role → final_role_name + final_role_color
  if (theme.theme?.final_role && typeof theme.theme.final_role === 'object') {
    console.log('  🔄 Correction final_role...');
    theme.theme.final_role_name = theme.theme.final_role.name;
    theme.theme.final_role_color = theme.theme.final_role.color;
    delete theme.theme.final_role;
    fixCount += 2;
  }

  // 2. Corriger les traps
  if (theme.traps && Array.isArray(theme.traps)) {
    for (const trap of theme.traps) {
      // Renommer effect_type → type avec mapping
      if (trap.effect_type && !trap.type) {
        const mappedType = TRAP_TYPE_MAPPING[trap.effect_type] || trap.effect_type;
        trap.type = mappedType;
        delete trap.effect_type;
        fixCount++;
        console.log(`  🔄 Trap ${trap.trap_id}: effect_type → type (${mappedType})`);
      }

      // Ajouter description si manquante
      if (!trap.description && trap.reveal_message) {
        // Extraire une description courte du reveal_message
        trap.description = trap.reveal_message.replace(/[🚔💰💎📉⚠️⚡🔮🍎❄️👁️🎭💀]/g, '').trim().substring(0, 100);
        fixCount++;
      }

      // Renommer effect_duration → cooldown_duration pour type cooldown
      if (trap.type === 'cooldown' && trap.effect_duration && !trap.cooldown_duration) {
        trap.cooldown_duration = trap.effect_duration;
        delete trap.effect_duration;
        fixCount++;
      }

      // Renommer effect_value → malus_points pour type points-malus
      if (trap.type === 'points-malus' && trap.effect_value && !trap.malus_points) {
        trap.malus_points = trap.effect_value;
        delete trap.effect_value;
        fixCount++;
      }

      // Nettoyer les champs inutiles
      delete trap.effect_value;
      delete trap.probability_weight;
    }
  }

  // 3. Corriger les missions quiz
  if (theme.missions?.quiz) {
    for (const mission of theme.missions.quiz) {
      if (mission.questions) {
        for (const q of mission.questions) {
          // Renommer "question" en "question_text"
          if (q.question && !q.question_text) {
            q.question_text = q.question;
            delete q.question;
            fixCount++;
          }

          // Ajouter correct_answer basé sur correct_index
          if (q.answers && q.correct_index !== undefined && !q.correct_answer) {
            q.correct_answer = q.answers[q.correct_index];
            delete q.correct_index;
            fixCount++;
          }
        }
      }
    }
  }

  // Sauvegarder
  fs.writeFileSync(filePath, JSON.stringify(theme, null, 2), 'utf8');
  console.log(`  ✅ ${fixCount} corrections appliquées`);

  return fixCount;
}

// Traiter tous les fichiers de thèmes
const files = fs.readdirSync(PRESETS_DIR).filter(f => f.endsWith('.theme.json'));

console.log('🔧 Correction complète du format des thèmes\n');
console.log('='.repeat(60));

let totalFixes = 0;

for (const file of files) {
  const filePath = path.join(PRESETS_DIR, file);
  totalFixes += fixThemeFormat(filePath);
}

console.log('\n' + '='.repeat(60));
console.log(`\n✅ Total: ${totalFixes} corrections appliquées sur ${files.length} fichier(s)`);
