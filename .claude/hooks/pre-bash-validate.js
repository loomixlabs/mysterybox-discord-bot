#!/usr/bin/env node
/**
 * Hook PreToolUse: Validation des commandes Bash dangereuses
 * Avertit avant l'exécution de commandes potentiellement destructrices
 */

const dangerousPatterns = [
  { pattern: /rm\s+-rf\s+\/(?!\w)/, message: 'Suppression récursive depuis la racine' },
  { pattern: /rm\s+-rf\s+~/, message: 'Suppression récursive du home' },
  { pattern: />\s*\/dev\/sd[a-z]/, message: 'Écriture directe sur un disque' },
  { pattern: /mkfs\./, message: 'Formatage de disque' },
  { pattern: /dd\s+if=.*of=\/dev\/sd/, message: 'Écriture directe avec dd' },
  { pattern: /:(){ :|:& };:/, message: 'Fork bomb détectée' },
  { pattern: /chmod\s+-R\s+777\s+\//, message: 'Permissions 777 récursives sur /' },
  { pattern: /DROP\s+DATABASE/i, message: 'Suppression de base de données' },
  { pattern: /DROP\s+TABLE/i, message: 'Suppression de table' },
  { pattern: /TRUNCATE\s+TABLE/i, message: 'Vidage de table' },
  { pattern: /--force\s+push|push\s+--force|-f\s+origin/, message: 'Force push Git' }
];

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

    // Vérifier seulement les commandes Bash
    if (data.tool_name !== 'Bash') {
      // Retourner "continue" pour les autres outils
      console.log(JSON.stringify({ decision: 'continue' }));
      process.exit(0);
    }

    const command = data.tool_input?.command || '';

    // Vérifier les patterns dangereux
    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(command)) {
        console.log(JSON.stringify({
          decision: 'block',
          reason: `🛑 Commande bloquée: ${message}\nCommande: ${command.substring(0, 100)}...`
        }));
        process.exit(0);
      }
    }

    // Commande OK
    console.log(JSON.stringify({ decision: 'continue' }));

  } catch (e) {
    // En cas d'erreur, laisser passer
    console.log(JSON.stringify({ decision: 'continue' }));
  }

  process.exit(0);
});
