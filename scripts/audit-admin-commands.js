/**
 * AUDIT: Commandes Admin et leurs fonctionnalités
 *
 * Analyse les commandes pour identifier les features configurables
 */

const fs = require('fs');
const path = require('path');

function analyzeAdminCommands() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT: COMMANDES ADMIN & FONCTIONNALITÉS                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  const commandsDir = path.join(__dirname, '..', 'commands');

  // Analyser chaque dossier de commandes
  const categories = ['admin', 'player'];

  for (const category of categories) {
    const categoryPath = path.join(commandsDir, category);

    if (!fs.existsSync(categoryPath)) continue;

    console.log(`\n📁 CATÉGORIE: ${category.toUpperCase()}`);
    console.log('═'.repeat(70));

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf8');

      console.log(`\n   📄 ${file}`);
      console.log('   ' + '─'.repeat(60));

      // Extraire le nom de la commande
      const nameMatch = content.match(/\.setName\(['"]([^'"]+)['"]\)/);
      const descMatch = content.match(/\.setDescription\(['"]([^'"]+)['"]\)/);

      if (nameMatch) console.log(`      Commande: /${nameMatch[1]}`);
      if (descMatch) console.log(`      Description: ${descMatch[1].substring(0, 60)}`);

      // Analyser les subcommands
      const subcommandMatches = content.matchAll(/\.addSubcommand\([^)]*\.setName\(['"]([^'"]+)['"]\)[^)]*\.setDescription\(['"]([^'"]+)['"]\)/g);
      const subcommands = [...subcommandMatches];

      if (subcommands.length > 0) {
        console.log('      Sous-commandes:');
        subcommands.forEach(match => {
          console.log(`         - ${match[1]}: ${match[2].substring(0, 50)}`);
        });
      }

      // Chercher les tables DB utilisées
      const dbTables = new Set();
      const tablePatterns = [
        /FROM\s+(\w+)/gi,
        /INTO\s+(\w+)/gi,
        /UPDATE\s+(\w+)/gi,
        /DELETE\s+FROM\s+(\w+)/gi,
        /db\.(get|query|update|insert|delete).*?['"](\w+)['"]/gi
      ];

      for (const pattern of tablePatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const table = match[2] || match[1];
          if (table && !['SELECT', 'VALUES', 'SET', 'WHERE'].includes(table.toUpperCase())) {
            dbTables.add(table.toLowerCase());
          }
        }
      }

      if (dbTables.size > 0) {
        console.log('      Tables DB: ' + [...dbTables].join(', '));
      }

      // Chercher des features spécifiques
      const features = [];
      if (content.includes('channel') && content.includes('setChannel')) features.push('Config canal');
      if (content.includes('role')) features.push('Gestion rôles');
      if (content.includes('cooldown')) features.push('Cooldowns');
      if (content.includes('campaign')) features.push('Campagnes');
      if (content.includes('announcement')) features.push('Annonces');
      if (content.includes('player')) features.push('Joueurs');
      if (content.includes('reset')) features.push('Reset');
      if (content.includes('ban')) features.push('Ban');
      if (content.includes('stats')) features.push('Stats');
      if (content.includes('theme')) features.push('Thèmes');
      if (content.includes('bonus')) features.push('Bonus');
      if (content.includes('trap')) features.push('Pièges');
      if (content.includes('mission')) features.push('Missions');
      if (content.includes('give')) features.push('Gives');

      if (features.length > 0) {
        console.log('      Features: ' + features.join(', '));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Analyser admin-panel.js en détail
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  ANALYSE DÉTAILLÉE: ADMIN-PANEL.JS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const adminPanelPath = path.join(commandsDir, 'admin', 'admin-panel.js');
  if (fs.existsSync(adminPanelPath)) {
    const content = fs.readFileSync(adminPanelPath, 'utf8');

    // Chercher les boutons
    const buttonMatches = content.matchAll(/customId:\s*['"]([^'"]+)['"]/g);
    const buttons = [...buttonMatches].map(m => m[1]);

    console.log('   🔘 Boutons/Actions identifiés:');
    const uniqueButtons = [...new Set(buttons)];
    uniqueButtons.forEach(btn => {
      console.log(`      - ${btn}`);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Analyser server-config.js
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  ANALYSE DÉTAILLÉE: SERVER-CONFIG.JS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const serverConfigPath = path.join(commandsDir, 'admin', 'server-config.js');
  if (fs.existsSync(serverConfigPath)) {
    const content = fs.readFileSync(serverConfigPath, 'utf8');

    // Chercher les options configurables
    const optionMatches = content.matchAll(/addStringOption|addChannelOption|addRoleOption|addBooleanOption/g);
    const options = [...optionMatches];

    console.log(`   📝 Nombre d'options: ${options.length}`);

    // Chercher les choices
    const choiceMatches = content.matchAll(/\.addChoices\(\s*\{[^}]+name:\s*['"]([^'"]+)['"]/g);
    const choices = [...choiceMatches];
    if (choices.length > 0) {
      console.log('   Choices trouvés:');
      choices.forEach(c => console.log(`      - ${c[1]}`));
    }
  }

  console.log('\n');
}

analyzeAdminCommands();
