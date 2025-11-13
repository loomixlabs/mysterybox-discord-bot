#!/usr/bin/env node

/**
 * Script pour incrémenter la version du bot
 * Usage: node scripts/bump-version.js <type>
 * Types: major, minor, patch
 *
 * Exemples:
 *   node scripts/bump-version.js patch  (1.0.0 → 1.0.1)
 *   node scripts/bump-version.js minor  (1.0.0 → 1.1.0)
 *   node scripts/bump-version.js major  (1.0.0 → 2.0.0)
 */

const fs = require('fs');
const path = require('path');

const VALID_TYPES = ['major', 'minor', 'patch'];

function parseVersion(versionString) {
  const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Format de version invalide: ${versionString}`);
  }
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3])
  };
}

function bumpVersion(version, type) {
  const v = parseVersion(version);

  switch (type) {
    case 'major':
      v.major += 1;
      v.minor = 0;
      v.patch = 0;
      break;
    case 'minor':
      v.minor += 1;
      v.patch = 0;
      break;
    case 'patch':
      v.patch += 1;
      break;
    default:
      throw new Error(`Type invalide: ${type}. Utilisez: major, minor, ou patch`);
  }

  return `${v.major}.${v.minor}.${v.patch}`;
}

function updatePackageJson(newVersion) {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(`✅ package.json mis à jour: ${newVersion}`);
}

function updateVersionFile(newVersion) {
  const versionPath = path.join(__dirname, '..', 'VERSION');
  fs.writeFileSync(versionPath, newVersion, 'utf8');
  console.log(`✅ VERSION mis à jour: ${newVersion}`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Erreur: Type de version manquant');
    console.log('\nUsage: node scripts/bump-version.js <type>');
    console.log('Types disponibles: major, minor, patch');
    console.log('\nExemples:');
    console.log('  node scripts/bump-version.js patch  # 1.0.0 → 1.0.1');
    console.log('  node scripts/bump-version.js minor  # 1.0.0 → 1.1.0');
    console.log('  node scripts/bump-version.js major  # 1.0.0 → 2.0.0');
    process.exit(1);
  }

  const type = args[0].toLowerCase();

  if (!VALID_TYPES.includes(type)) {
    console.error(`❌ Erreur: Type invalide "${type}"`);
    console.log(`Types valides: ${VALID_TYPES.join(', ')}`);
    process.exit(1);
  }

  try {
    // Lire la version actuelle
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const currentVersion = packageJson.version;

    console.log(`\n📦 Version actuelle: ${currentVersion}`);

    // Calculer la nouvelle version
    const newVersion = bumpVersion(currentVersion, type);

    console.log(`📦 Nouvelle version: ${newVersion}`);
    console.log(`\n🔄 Type de mise à jour: ${type.toUpperCase()}\n`);

    // Afficher ce qui va être fait
    console.log('Les fichiers suivants seront mis à jour:');
    console.log('  - package.json');
    console.log('  - VERSION');
    console.log('\n⚠️  N\'oubliez pas de:');
    console.log('  1. Mettre à jour CHANGELOG.md');
    console.log('  2. Commiter les changements');
    console.log('  3. Créer un tag git: git tag -a v' + newVersion + ' -m "Release v' + newVersion + '"');
    console.log('  4. Pousser le tag: git push origin v' + newVersion);
    console.log();

    // Demander confirmation (en production, on ajouterait une vraie confirmation)
    // Pour l'instant, on procède directement

    // Mettre à jour les fichiers
    updatePackageJson(newVersion);
    updateVersionFile(newVersion);

    console.log('\n✅ Mise à jour terminée !');
    console.log(`\n📋 Prochaines étapes:`);
    console.log(`   1. Vérifier les changements: git status`);
    console.log(`   2. Mettre à jour CHANGELOG.md avec les nouveautés`);
    console.log(`   3. Commiter: git add . && git commit -m "chore: bump version to ${newVersion}"`);
    console.log(`   4. Créer le tag: git tag -a v${newVersion} -m "Release v${newVersion}"`);
    console.log(`   5. Pousser: git push && git push origin v${newVersion}`);
    console.log();

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
