const db = require('./utils/database-pg');

async function verifyRoles() {
  try {
    console.log('🔍 Vérification des rôles admin configurés...\n');

    // Récupérer tous les rôles admin pour le serveur de test
    const guildId = '1248028543389143070';

    const roles = await db.queryAll(`
      SELECT * FROM guild_admin_roles
      WHERE guild_id = $1
      ORDER BY created_at DESC
    `, [guildId]);

    console.log(`📊 Rôles configurés pour le serveur ${guildId}:\n`);

    if (roles.length === 0) {
      console.log('❌ Aucun rôle configuré pour ce serveur.');
    } else {
      console.log(`✅ ${roles.length} rôle(s) trouvé(s):\n`);
      roles.forEach((role, index) => {
        console.log(`${index + 1}. Role ID: ${role.role_id}`);
        console.log(`   Added by: ${role.added_by}`);
        console.log(`   Created at: ${role.created_at}`);
        console.log('');
      });
    }

    // Afficher aussi tous les serveurs qui ont des rôles configurés
    const allServers = await db.queryAll(`
      SELECT guild_id, COUNT(*) as role_count
      FROM guild_admin_roles
      GROUP BY guild_id
      ORDER BY guild_id
    `);

    console.log('\n📋 Résumé de tous les serveurs:\n');
    allServers.forEach(server => {
      console.log(`  Guild ID: ${server.guild_id} → ${server.role_count} rôle(s)`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifyRoles();
