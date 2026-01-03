const db = require('../utils/database-pg');

/**
 * MIGRATION: Installer les super bonus sur TOUS les serveurs existants
 *
 * ⚠️ SÉCURITÉ:
 * - Utilise ON CONFLICT DO NOTHING pour éviter les doublons
 * - Ne modifie AUCUNE donnée existante
 * - Logs détaillés pour traçabilité
 *
 * Usage: node scripts/install-bonuses-existing-guilds.js
 */

async function installBonusesOnAllGuilds() {
  console.log('\n🎁 MIGRATION: Installation super bonus sur serveurs existants\n');
  console.log('='.repeat(100));

  try {
    // 1. Récupérer tous les serveurs (guilds) via la table themes
    console.log('\n📋 1. Récupération des guilds existantes...');

    const guilds = await db.query(`
      SELECT DISTINCT guild_id, name
      FROM themes
      ORDER BY guild_id
    `);

    if (guilds.length === 0) {
      console.log('⚠️  Aucune guild trouvée dans la base de données.');
      console.log('   Le bot n\'a peut-être pas encore été invité sur des serveurs.');
      process.exit(0);
    }

    console.log(`✅ ${guilds.length} guild(s) trouvée(s):\n`);
    guilds.forEach((guild, index) => {
      console.log(`   ${index + 1}. ${guild.name || 'Sans nom'} (ID: ${guild.guild_id})`);
    });

    // 2. Installer les super bonus sur chaque guild
    console.log('\n\n📦 2. Installation des super bonus...\n');
    console.log('-'.repeat(100));

    let totalInstalled = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const guild of guilds) {
      console.log(`\n🔄 Guild: ${guild.name || guild.guild_id}`);
      console.log('-'.repeat(100));

      try {
        const result = await db.installSuperBonusesForGuild(guild.guild_id);

        totalInstalled += result.installed;
        totalSkipped += result.skipped;

        console.log(`   ✅ Terminé: ${result.installed} installés, ${result.skipped} déjà existants`);

      } catch (error) {
        totalErrors++;
        console.error(`   ❌ Erreur pour guild ${guild.guild_id}:`, error.message);
      }
    }

    // 3. Résumé final
    console.log('\n\n' + '='.repeat(100));
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(100));
    console.log(`\n✅ Guilds traitées: ${guilds.length}`);
    console.log(`✅ Super bonus installés: ${totalInstalled}`);
    console.log(`⏭️  Super bonus déjà existants: ${totalSkipped}`);
    console.log(`❌ Erreurs: ${totalErrors}`);

    // 4. Vérification finale
    console.log('\n\n🔍 4. Vérification finale...\n');

    const verification = await db.query(`
      SELECT
        guild_id,
        COUNT(*) as bonus_count
      FROM super_bonuses
      GROUP BY guild_id
      ORDER BY guild_id
    `);

    console.log('📋 Super bonus par guild:');
    verification.forEach(row => {
      const guildName = guilds.find(g => g.guild_id === row.guild_id)?.name || 'Inconnu';
      const status = row.bonus_count === 11 ? '✅' : '⚠️ ';
      console.log(`   ${status} ${guildName} (${row.guild_id}): ${row.bonus_count}/11 bonus`);
    });

    if (verification.every(row => row.bonus_count === 11)) {
      console.log('\n✅ MIGRATION RÉUSSIE: Tous les serveurs ont les 11 super bonus !');
    } else {
      console.log('\n⚠️  ATTENTION: Certains serveurs n\'ont pas les 11 bonus complets.');
      console.log('   Vérifier les erreurs ci-dessus.');
    }

    console.log('\n' + '='.repeat(100));
    console.log('✅ Migration terminée\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE lors de la migration:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécution
installBonusesOnAllGuilds();
