#!/usr/bin/env node
/**
 * Script de validation - Détecte les patterns dangereux
 * Usage: node validate-code.js [fichier.js]
 */

const fs = require('fs');
const path = require('path');

const DANGEROUS_PATTERNS = [
  {
    name: 'SQL sans guild_id',
    regex: /(SELECT|UPDATE|DELETE)\s+.*FROM\s+(?!.*guild_id)(?!.*information_schema)/gi,
    severity: 'CRITIQUE',
    fix: 'Ajouter WHERE guild_id = $X dans la requête'
  },
  {
    name: 'INSERT sans guild_id',
    regex: /INSERT\s+INTO\s+\w+\s*\([^)]*\)\s*VALUES(?![^;]*guild_id)/gi,
    severity: 'CRITIQUE',
    fix: 'Ajouter guild_id dans les colonnes INSERT'
  },
  {
    name: 'Handler sans defer',
    regex: /async\s+\w*[Hh]andle\w*\s*\([^)]*interaction[^)]*\)\s*\{[^}]*await\s+(?!interaction\.defer)/,
    severity: 'ÉLEVÉ',
    fix: 'Ajouter await interaction.deferUpdate() en première ligne'
  },
  {
    name: 'update() après defer possible',
    regex: /await\s+interaction\.update\s*\(/g,
    severity: 'ATTENTION',
    fix: 'Si deferUpdate() utilisé avant, remplacer par editReply()'
  },
  {
    name: 'reply() après defer possible',
    regex: /await\s+interaction\.reply\s*\([^)]*\)\s*;?\s*$/gm,
    severity: 'ATTENTION',
    fix: 'Si deferReply() utilisé avant, remplacer par editReply()'
  },
  {
    name: 'Timeout non géré',
    regex: /catch\s*\([^)]*\)\s*\{(?![^}]*10062)/g,
    severity: 'MOYEN',
    fix: 'Ajouter gestion error.code === 10062 dans le catch'
  },
  {
    name: 'queryOne/queryAll sans paramètres',
    regex: /\.(queryOne|queryAll)\s*\(\s*['"`][^'"`]*['"`]\s*\)/g,
    severity: 'ATTENTION',
    fix: 'Vérifier que guild_id est passé en paramètre'
  }
];

function validateFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fichier non trouvé: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const issues = [];

  console.log(`\n🔍 Validation de ${fileName}\n${'='.repeat(50)}`);

  for (const pattern of DANGEROUS_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches) {
      issues.push({
        ...pattern,
        count: matches.length,
        matches: matches.slice(0, 3) // Max 3 exemples
      });
    }
  }

  if (issues.length === 0) {
    console.log('✅ Aucun pattern dangereux détecté!');
    return 0;
  }

  console.log(`\n🔴 ${issues.length} type(s) de problème(s) détecté(s):\n`);

  for (const issue of issues) {
    const icon = issue.severity === 'CRITIQUE' ? '🔴' :
                 issue.severity === 'ÉLEVÉ' ? '🟠' :
                 issue.severity === 'ATTENTION' ? '🟡' : '⚪';

    console.log(`${icon} [${issue.severity}] ${issue.name}`);
    console.log(`   Occurrences: ${issue.count}`);
    console.log(`   Fix: ${issue.fix}`);
    if (issue.matches.length > 0) {
      console.log(`   Exemples:`);
      issue.matches.forEach((m, i) => {
        const truncated = m.substring(0, 80).replace(/\n/g, ' ');
        console.log(`     ${i + 1}. ${truncated}...`);
      });
    }
    console.log('');
  }

  const criticalCount = issues.filter(i => i.severity === 'CRITIQUE').length;
  if (criticalCount > 0) {
    console.log(`\n⛔ ${criticalCount} problème(s) CRITIQUE(S) - NE PAS DÉPLOYER`);
    return 1;
  }

  return 0;
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  // Valider tous les handlers
  const handlersDir = path.join(process.cwd(), 'handlers');
  if (fs.existsSync(handlersDir)) {
    const files = fs.readdirSync(handlersDir).filter(f => f.endsWith('.js'));
    let totalIssues = 0;
    for (const file of files) {
      totalIssues += validateFile(path.join(handlersDir, file));
    }
    process.exit(totalIssues > 0 ? 1 : 0);
  } else {
    console.log('Usage: node validate-code.js [fichier.js]');
    console.log('       ou exécuter depuis le dossier projet pour valider tous les handlers');
  }
} else {
  process.exit(validateFile(args[0]));
}
