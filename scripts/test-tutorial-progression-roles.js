/**
 * Script pour vérifier l'affichage des rôles de progression dans le tutoriel
 */
require('dotenv').config();
const db = require('../utils/database-pg');

async function test() {
  const guildId = '297309737135898624';

  console.log('='.repeat(60));
  console.log('🔍 TEST AFFICHAGE RÔLES DE PROGRESSION');
  console.log('='.repeat(60));

  // Get active theme
  const theme = await db.getActiveTheme(guildId);
  console.log('\n🎨 Thème actif:', theme?.name, '(ID:', theme?.id, ')');
  console.log('👑 Rôle final:', theme?.final_role_name || 'Non défini');

  // Get progression roles from theme_config
  const config = await db.queryOne(
    'SELECT progression_roles FROM theme_config WHERE guild_id = $1 AND theme_id = $2',
    [guildId, theme?.id]
  );

  console.log('\n📋 Rôles de progression (depuis theme_config):');
  let roles = [];
  if (config?.progression_roles) {
    roles = Array.isArray(config.progression_roles) ? config.progression_roles : [];
    roles.sort((a, b) => a.percentage - b.percentage);
    roles.forEach(r => {
      console.log(`  🎖️ **${r.name}** - ${r.percentage}%`);
    });
  } else {
    console.log('  Aucun rôle de progression');
  }

  // Simuler l'affichage final du tutoriel
  console.log('\n📜 AFFICHAGE FINAL DANS TUTORIEL:');
  console.log('-'.repeat(40));

  let rolesDisplay = '';
  if (roles.length > 0) {
    rolesDisplay = roles.map(r => `🎖️ **${r.name || r.role_name}** - ${r.percentage}%`).join('\n');
  }
  if (theme && theme.final_role_name) {
    rolesDisplay += (rolesDisplay ? '\n' : '') + `👑 **${theme.final_role_name}** - 100% (Collection complète!)`;
  }
  if (!rolesDisplay) {
    rolesDisplay = '*Aucun rôle de progression configuré*';
  }

  console.log(rolesDisplay);
  console.log('-'.repeat(40));

  console.log('\n✅ Test terminé');
  process.exit(0);
}

test().catch(e => {
  console.error('❌ Erreur:', e.message);
  process.exit(1);
});
