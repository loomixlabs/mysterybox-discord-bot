/**
 * Script pour générer l'URL d'invitation OAuth2 du bot
 *
 * Usage: node scripts/generate-invite-url.js [--full]
 *   --full: Inclure les permissions optionnelles
 */

require('dotenv').config();
const oauthGenerator = require('../utils/oauthGenerator');

const APPLICATION_ID = process.env.APPLICATION_ID;
const includeOptional = process.argv.includes('--full');

if (!APPLICATION_ID) {
  console.error('❌ APPLICATION_ID non trouvé dans .env');
  process.exit(1);
}

console.log('='.repeat(80));
console.log('🔗 GÉNÉRATEUR D\'URL D\'INVITATION OAUTH2');
console.log('='.repeat(80));

// Générer l'URL
const inviteUrl = oauthGenerator.generateInviteUrl(APPLICATION_ID, {
  includeOptional
});

console.log('\n📋 APPLICATION ID:', APPLICATION_ID);
console.log('📦 Mode:', includeOptional ? 'COMPLET (permissions optionnelles incluses)' : 'STANDARD (permissions requises uniquement)');

console.log('\n' + '─'.repeat(80));
console.log('🔗 URL D\'INVITATION:');
console.log('─'.repeat(80));
console.log('\n' + inviteUrl);

// Afficher le rapport des permissions
const report = oauthGenerator.getPermissionsReport(includeOptional);

console.log('\n' + '─'.repeat(80));
console.log('📊 PERMISSIONS REQUISES:');
console.log('─'.repeat(80));

for (const perm of report.required) {
  console.log(`  ✅ ${perm.name}`);
  console.log(`     └─ ${perm.description}`);
}

if (includeOptional && report.optional.length > 0) {
  console.log('\n' + '─'.repeat(80));
  console.log('📊 PERMISSIONS OPTIONNELLES:');
  console.log('─'.repeat(80));

  for (const perm of report.optional) {
    console.log(`  ➕ ${perm.name}`);
    console.log(`     └─ ${perm.description}`);
  }
}

console.log('\n' + '─'.repeat(80));
console.log('📝 BITFIELD TOTAL:', report.totalBitfield);
console.log('─'.repeat(80));

console.log('\n💡 INSTRUCTIONS:');
console.log('   1. Copie l\'URL ci-dessus');
console.log('   2. Ouvre-la dans un navigateur');
console.log('   3. Sélectionne le serveur cible');
console.log('   4. Autorise les permissions');
console.log('   5. Exécute /setup sur le serveur');

console.log('\n⚠️  IMPORTANT APRÈS INSTALLATION:');
console.log('   → Remonte le rôle du bot dans la hiérarchie des rôles');
console.log('   → Le bot doit être AU-DESSUS des rôles qu\'il peut attribuer');

console.log('\n' + '='.repeat(80));
