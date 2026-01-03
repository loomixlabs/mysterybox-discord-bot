const db = require('../utils/database-pg');

async function verifyProductionRoleConfig() {
  try {
    const GUILD_ID = '1248028543389143070'; // Serveur de PRODUCTION

    console.log('🔍 VÉRIFICATION - Configuration rôle serveur PRODUCTION\n');
    console.log('='.repeat(80));
    console.log(`\n🎯 Guild ID: ${GUILD_ID}\n`);

    // 1. Vérifier le thème actif
    console.log('📋 ÉTAPE 1: Thème actif\n');

    const theme = await db.query(`
      SELECT id, name, is_active, required_items,
             final_role_name, final_role_color, final_role_discord_id
      FROM themes
      WHERE guild_id = $1
      AND is_active = TRUE
      LIMIT 1
    `, [GUILD_ID]);

    if (theme.length === 0) {
      console.log('❌ Aucun thème actif trouvé sur ce serveur\n');
      process.exit(0);
    }

    console.log('✅ Thème actif trouvé:\n');
    console.table(theme);

    const activeTheme = theme[0];

    // 2. Analyser la configuration du rôle
    console.log('\n' + '='.repeat(80));
    console.log('\n🎭 ÉTAPE 2: Analyse de la configuration du rôle\n');

    console.log(`Nom du rôle: ${activeTheme.final_role_name || 'NON DÉFINI ❌'}`);
    console.log(`Couleur du rôle: ${activeTheme.final_role_color || 'NON DÉFINI ❌'}`);
    console.log(`Discord Role ID: ${activeTheme.final_role_discord_id || 'NULL ❌'}\n`);

    if (!activeTheme.final_role_discord_id) {
      console.log('⚠️  PROBLÈME IDENTIFIÉ:');
      console.log('   final_role_discord_id est NULL');
      console.log('   Le rôle Discord n\'a pas été enregistré en base de données\n');
      console.log('💡 CONSÉQUENCE:');
      console.log('   Le système cherchera le rôle par son NOM uniquement');
      console.log('   Si le rôle n\'existe pas ou a été renommé → PAS D\'ATTRIBUTION\n');
    } else {
      console.log('✅ Un Role ID est défini en base de données');
      console.log('   Le système devrait pouvoir attribuer le rôle automatiquement\n');
    }

    // 3. Vérifier les joueurs ayant complété la collection
    console.log('='.repeat(80));
    console.log('\n👥 ÉTAPE 3: Joueurs ayant complété la collection\n');

    const completedPlayers = await db.query(`
      SELECT p.username, p.discord_id, pp.collected_count, pp.has_completed, pp.role_attributed
      FROM player_progress pp
      JOIN players p ON pp.player_id = p.id AND pp.guild_id = p.guild_id
      WHERE pp.guild_id = $1
      AND pp.theme_id = $2
      AND pp.has_completed = TRUE
      ORDER BY p.username
    `, [GUILD_ID, activeTheme.id]);

    if (completedPlayers.length === 0) {
      console.log('ℹ️  Aucun joueur n\'a encore complété la collection\n');
    } else {
      console.log(`${completedPlayers.length} joueur(s) ont complété la collection:\n`);
      console.table(completedPlayers.map(p => ({
        'Username': p.username,
        'Collectés': p.collected_count,
        'Complété': p.has_completed ? '✅' : '❌',
        'Rôle attribué': p.role_attributed ? '✅' : '❌'
      })));

      // Compter combien n'ont PAS le rôle
      const withoutRole = completedPlayers.filter(p => !p.role_attributed).length;
      if (withoutRole > 0) {
        console.log(`\n⚠️  ${withoutRole} joueur(s) ont complété MAIS n'ont PAS le rôle attribué !`);
      }
    }

    // 4. Résumé et recommandations
    console.log('\n' + '='.repeat(80));
    console.log('\n🎯 RÉSUMÉ\n');

    if (!activeTheme.final_role_discord_id) {
      console.log('❌ PROBLÈME: final_role_discord_id est NULL');
      console.log('\n📌 ACTIONS REQUISES:');
      console.log('   1. Vérifier si le rôle "' + activeTheme.final_role_name + '" existe sur Discord');
      console.log('   2. Si OUI: Le système devrait fonctionner (recherche par nom)');
      console.log('   3. Si NON: Créer le rôle manuellement sur Discord');
      console.log('   4. RECOMMANDÉ: Mettre à jour final_role_discord_id en DB avec l\'ID du rôle Discord\n');
    } else {
      console.log('✅ Configuration correcte: Role ID enregistré en base');
      console.log('\n💡 Le système devrait attribuer automatiquement le rôle');
      console.log('   Si un joueur complète et ne reçoit pas le rôle:');
      console.log('   - Vérifier que le rôle ID ' + activeTheme.final_role_discord_id + ' existe toujours');
      console.log('   - Vérifier les permissions du bot\n');
    }

    console.log('='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifyProductionRoleConfig();
