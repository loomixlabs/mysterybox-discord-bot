#!/usr/bin/env node
/**
 * Hook Stop: Résumé de session et rappels
 * Affiche un récapitulatif à la fin de chaque tâche
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Récupérer les infos depuis stdin
let input = '';
process.stdin.setEncoding('utf8');

process.stdin.on('readable', () => {
  let chunk;
  while (chunk = process.stdin.read()) {
    input += chunk;
  }
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const stopReason = data.stop_hook_active ? 'stop' : 'unknown';

    console.log('\n' + '═'.repeat(60));
    console.log('📋 RAPPELS DE FIN DE SESSION');
    console.log('═'.repeat(60));

    // Vérifier s'il y a des modifications git non commitées
    try {
      const gitStatus = execSync('git status --porcelain 2>/dev/null', {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (gitStatus.trim()) {
        const lines = gitStatus.trim().split('\n');
        const modified = lines.filter(l => l.startsWith(' M') || l.startsWith('M ')).length;
        const added = lines.filter(l => l.startsWith('??')).length;

        if (modified > 0 || added > 0) {
          console.log(`\n⚠️  Fichiers non commités:`);
          if (modified > 0) console.log(`   📝 ${modified} modifié(s)`);
          if (added > 0) console.log(`   ➕ ${added} nouveau(x)`);
          console.log(`\n💡 Pense à: git add . && git commit -m "..."`);
        }
      }
    } catch (e) {
      // Pas un repo git ou erreur - ignorer
    }

    // Rappels standards
    console.log('\n📌 Checklist:');
    console.log('   □ CHANGELOG.md mis à jour ?');
    console.log('   □ Tests effectués ?');
    console.log('   □ Documentation mise à jour ?');
    console.log('═'.repeat(60) + '\n');

  } catch (e) {
    // Erreur de parsing - ignorer
  }

  process.exit(0);
});
