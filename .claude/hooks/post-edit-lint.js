#!/usr/bin/env node
/**
 * Hook PostToolUse: Lint automatique après modification de fichiers JS
 * Ce script vérifie la syntaxe des fichiers JavaScript modifiés
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Récupérer les infos depuis stdin (format JSON de Claude Code)
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
    const filePath = data.tool_input?.file_path || data.tool_input?.path;

    if (!filePath) {
      process.exit(0);
    }

    // Vérifier si c'est un fichier JS/TS
    const ext = path.extname(filePath).toLowerCase();
    if (!['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'].includes(ext)) {
      process.exit(0);
    }

    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      process.exit(0);
    }

    // Vérifier la syntaxe avec Node.js
    try {
      execSync(`node --check "${filePath}"`, {
        stdio: 'pipe',
        timeout: 5000
      });
      console.log(`✅ Syntaxe OK: ${path.basename(filePath)}`);
    } catch (syntaxError) {
      console.log(`⚠️  Erreur de syntaxe détectée dans ${path.basename(filePath)}`);
      console.log(syntaxError.stderr?.toString() || syntaxError.message);
    }

  } catch (e) {
    // Pas de JSON valide ou erreur - ignorer silencieusement
  }

  process.exit(0);
});
