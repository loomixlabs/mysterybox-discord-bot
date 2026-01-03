/**
 * Vérifier les variables utilisées dans les templates d'annonces
 */
const db = require('../utils/database-pg');

async function check() {
  try {
    console.log('🔍 VÉRIFICATION DES VARIABLES DANS LES TEMPLATES\n');
    console.log('='.repeat(80));

    // Templates actuels
    const templates = await db.queryAll(`
      SELECT type, title, description, guild_id
      FROM announcement_templates
      WHERE guild_id = '1248028543389143070'
      ORDER BY type
    `);

    console.log(`\n📋 ${templates.length} templates trouvés\n`);

    // Extraire les variables de chaque template
    templates.forEach(t => {
      const titleVars = t.title.match(/\{[^}]+\}/g) || [];
      const descVars = t.description.match(/\{[^}]+\}/g) || [];
      const allVars = [...new Set([...titleVars, ...descVars])];

      console.log(`\n📌 ${t.type}:`);
      console.log(`   Titre: ${t.title.substring(0, 60)}...`);
      console.log(`   Variables: ${allVars.join(', ') || '(aucune)'}`);
    });

    // Variables attendues par le code
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 VARIABLES ATTENDUES PAR LE CODE (announcements.js):\n');
    const expectedVars = {
      'legendary_collectible': ['userName', 'collectibleName', 'collectibleImage'],
      'collection_completed': ['userName', 'themeName', 'roleName'],
      'collection_traded': ['user1Name', 'user2Name', 'missionName'],
      'collection_lost': ['userName', 'trapName'],
      'mission_word_guessed': ['userName', 'word', 'missionName'],
      'mission_started': ['userName', 'missionName', 'timeLimit'],
      'mission_completed': ['userName', 'missionName', 'rewardName'],
      'mission_failed': ['userName', 'missionName', 'failReason'],
      'mission_approved': ['userName', 'missionName', 'adminName', 'rewardName'],
      'mission_rejected': ['userName', 'missionName', 'adminName'],
      'trap_cooldown': ['userName', 'trapName', 'cooldownMinutes', 'duration'],
      'trap_lose_collectible': ['userName', 'trapName', 'collectibleLost', 'collectible'],
      'trap_public_shame': ['userName', 'trapName', 'shameMessage'],
      'trap_empty_box': ['userName', 'trapName'],
      'trap_lose_all_collectibles': ['userName', 'trapName', 'count'],
      'theme_expired': ['themeName', 'durationDays', 'expirationDate'],
      'theme_expiring_soon': ['themeName', 'daysRemaining', 'expirationDate']
    };

    Object.entries(expectedVars).forEach(([type, vars]) => {
      console.log(`   ${type}: {${vars.join('}, {')}}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
