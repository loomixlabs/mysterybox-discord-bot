const db = require('../utils/database-pg');

async function fixRoleAttributionBothServers() {
  try {
    console.log('🔧 CORRECTIF - Système d\'attribution automatique des rôles\n');
    console.log('='.repeat(80));
    console.log('\n🎯 PROBLÈME IDENTIFIÉ:');
    console.log('   - modalHandler.js passe final_role_id');
    console.log('   - database-pg.js attend final_role_discord_id');
    console.log('   - Résultat: final_role_discord_id = NULL en DB\n');

    console.log('='.repeat(80));
    console.log('\n📋 ÉTAPE 1: Vérification des deux serveurs\n');

    const servers = [
      { id: '297309737135898624', name: 'Serveur TEST' },
      { id: '1248028543389143070', name: 'Serveur PRODUCTION' }
    ];

    const themesToFix = [];

    for (const server of servers) {
      console.log(`\n🔍 ${server.name} (${server.id}):\n`);

      // Récupérer tous les thèmes de ce serveur
      const themes = await db.query(
        `SELECT id, name, final_role_name, final_role_color, final_role_discord_id
         FROM themes
         WHERE guild_id = $1`,
        [server.id]
      );

      if (themes.length === 0) {
        console.log('   ℹ️  Aucun thème trouvé sur ce serveur\n');
        continue;
      }

      console.log(`   Thèmes trouvés: ${themes.length}\n`);

      for (const theme of themes) {
        console.log(`   📦 Thème: ${theme.name}`);
        console.log(`      - ID: ${theme.id}`);
        console.log(`      - Rôle: ${theme.final_role_name || 'NON DÉFINI'}`);
        console.log(`      - Couleur: ${theme.final_role_color || 'NON DÉFINI'}`);
        console.log(`      - Discord Role ID: ${theme.final_role_discord_id || 'NULL ❌'}\n`);

        if (!theme.final_role_discord_id && theme.final_role_name) {
          themesToFix.push({
            serverId: server.id,
            serverName: server.name,
            themeId: theme.id,
            themeName: theme.name,
            roleName: theme.final_role_name
          });
        }
      }
    }

    // Résumé
    console.log('='.repeat(80));
    console.log(`\n📊 RÉSUMÉ: ${themesToFix.length} thème(s) à corriger\n`);

    if (themesToFix.length === 0) {
      console.log('✅ Tous les thèmes ont déjà un role_id enregistré!\n');
      console.log('='.repeat(80));
      process.exit(0);
    }

    console.table(themesToFix.map(t => ({
      'Serveur': t.serverName,
      'Thème': t.themeName,
      'Rôle': t.roleName,
      'Status': '⚠️  À corriger'
    })));

    console.log('\n='.repeat(80));
    console.log('\n🔧 ÉTAPE 2: Correction manuelle requise\n');
    console.log('⚠️  IMPORTANT: Ce script NE PEUT PAS créer les rôles Discord automatiquement.');
    console.log('   Les rôles Discord doivent exister sur chaque serveur.\n');

    console.log('📝 ACTIONS MANUELLES REQUISES:\n');

    for (const theme of themesToFix) {
      console.log(`${theme.serverName} - Thème "${theme.themeName}":`);
      console.log(`   1. Rejoins le serveur Discord ${theme.serverId}`);
      console.log(`   2. Vérifie si le rôle "${theme.roleName}" existe`);
      console.log(`      - Si OUI: Note son ID (Clic droit → Copier l'ID)`);
      console.log(`      - Si NON: Crée-le manuellement avec la couleur souhaitée`);
      console.log(`   3. Exécute cette commande SQL:\n`);
      console.log(`      UPDATE themes`);
      console.log(`      SET final_role_discord_id = 'ROLE_ID_ICI'`);
      console.log(`      WHERE id = ${theme.themeId};\n`);
    }

    console.log('='.repeat(80));
    console.log('\n💡 ALTERNATIVE: Utiliser l\'Admin Panel\n');
    console.log('Sur Discord, utilise /admin-panel:');
    console.log('   1. Ouvrir le panneau admin');
    console.log('   2. Aller dans "Thèmes"');
    console.log('   3. Supprimer l\'ancien thème');
    console.log('   4. Créer un nouveau thème (le rôle sera créé automatiquement avec le FIX)\n');

    console.log('='.repeat(80));
    console.log('\n🔨 ÉTAPE 3: Correctif du code\n');
    console.log('Le bug se situe dans handlers/modalHandler.js ligne 726\n');
    console.log('AVANT:');
    console.log('   final_role_id: role.id  // ❌ MAUVAIS NOM\n');
    console.log('APRÈS:');
    console.log('   final_role_discord_id: role.id  // ✅ BON NOM\n');

    console.log('='.repeat(80));
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixRoleAttributionBothServers();
