require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070';
const PLAYER_DISCORD_ID = '1196568636681363507';
const ROLE_ID = '1437539197987852388';
const ANNOUNCEMENT_MESSAGE_ID = '1440722900788314173';

async function analyzeRoleIssue() {
  try {
    console.log('🔍 ANALYSE DU PROBLÈME D\'ATTRIBUTION DE RÔLE\n');
    console.log('='.repeat(80));
    console.log(`Guild ID: ${GUILD_ID}`);
    console.log(`Player Discord ID: ${PLAYER_DISCORD_ID}`);
    console.log(`Role ID: ${ROLE_ID}`);
    console.log(`Annonce Message ID: ${ANNOUNCEMENT_MESSAGE_ID}\n`);

    // =====================================================
    // 1. VÉRIFIER LE THÈME ACTIF ET SON ROLE_ID
    // =====================================================
    console.log('📌 ÉTAPE 1: Vérification du thème actif et role_id');
    console.log('-'.repeat(80));

    const theme = await db.queryOne(`
      SELECT id, name, is_active, final_role_discord_id, final_role_name, final_role_color, created_at
      FROM themes
      WHERE guild_id = $1 AND is_active = TRUE
    `, [GUILD_ID]);

    if (!theme) {
      console.log('❌ Aucun thème actif trouvé');
      process.exit(1);
    }

    console.log('✅ Thème actif trouvé:');
    console.table({
      id: theme.id,
      name: theme.name,
      is_active: theme.is_active,
      final_role_discord_id: theme.final_role_discord_id,
      final_role_name: theme.final_role_name,
      final_role_color: theme.final_role_color,
      created_at: theme.created_at
    });

    if (theme.final_role_discord_id !== ROLE_ID) {
      console.log(`⚠️  ATTENTION: Le final_role_discord_id du thème (${theme.final_role_discord_id}) ne correspond pas au role_id fourni (${ROLE_ID})`);
    }

    // =====================================================
    // 2. VÉRIFIER LE JOUEUR ET SA PROGRESSION
    // =====================================================
    console.log('\n📌 ÉTAPE 2: Vérification du joueur et progression');
    console.log('-'.repeat(80));

    const player = await db.queryOne(`
      SELECT p.*, pp.collected_count, pp.total_count
      FROM players p
      LEFT JOIN player_progress pp ON pp.player_id = p.id AND pp.theme_id = $2
      WHERE p.guild_id = $1 AND p.discord_id = $3
    `, [GUILD_ID, theme.id, PLAYER_DISCORD_ID]);

    if (!player) {
      console.log('❌ Joueur introuvable');
      process.exit(1);
    }

    console.log('✅ Joueur trouvé:');
    console.table({
      id: player.id,
      username: player.username,
      discord_id: player.discord_id,
      collected_count: player.collected_count,
      total_count: player.total_count,
      completed: player.collected_count === player.total_count
    });

    // =====================================================
    // 3. VÉRIFIER LES COLLECTIBLES DU THÈME
    // =====================================================
    console.log('\n📌 ÉTAPE 3: Vérification des collectibles du thème');
    console.log('-'.repeat(80));

    const totalCollectibles = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM collectibles
      WHERE guild_id = $1 AND theme_id = $2
    `, [GUILD_ID, theme.id]);

    console.log(`📦 Total collectibles du thème: ${totalCollectibles.count}`);

    // =====================================================
    // 4. VÉRIFIER LES COLLECTIBLES POSSÉDÉS PAR LE JOUEUR
    // =====================================================
    console.log('\n📌 ÉTAPE 4: Collectibles possédés par le joueur');
    console.log('-'.repeat(80));

    const playerCollectibles = await db.queryAll(`
      SELECT col.name, col.rarity, c.collected_at, c.lost_at
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.guild_id = $1
        AND c.player_id = $2
        AND col.theme_id = $3
      ORDER BY c.collected_at DESC
    `, [GUILD_ID, player.id, theme.id]);

    console.log(`\n✅ Collectibles possédés: ${playerCollectibles.length}/${totalCollectibles.count}`);

    const activesCollectibles = playerCollectibles.filter(c => !c.lost_at);
    console.log(`✅ Collectibles actifs (non perdus): ${activesCollectibles.length}`);

    if (activesCollectibles.length < totalCollectibles.count) {
      console.log('\n⚠️  COLLECTION INCOMPLÈTE:');
      console.table(playerCollectibles.slice(0, 10));

      // Trouver les collectibles manquants
      const allCollectibles = await db.queryAll(`
        SELECT name, rarity FROM collectibles
        WHERE guild_id = $1 AND theme_id = $2
      `, [GUILD_ID, theme.id]);

      const ownedNames = activesCollectibles.map(c => c.name);
      const missing = allCollectibles.filter(c => !ownedNames.includes(c.name));

      if (missing.length > 0) {
        console.log('\n📋 Collectibles manquants:');
        console.table(missing);
      }
    } else {
      console.log('\n✅ COLLECTION COMPLÈTE!');
      console.table(activesCollectibles);
    }

    // =====================================================
    // 5. VÉRIFIER LE MESSAGE D'ANNONCE
    // =====================================================
    console.log('\n📌 ÉTAPE 5: Vérification du message d\'annonce');
    console.log('-'.repeat(80));

    const announcement = await db.queryOne(`
      SELECT * FROM audit_logs
      WHERE guild_id = $1
        AND action = 'collection_completed'
        AND details::text LIKE '%${ANNOUNCEMENT_MESSAGE_ID}%'
      ORDER BY created_at DESC
      LIMIT 1
    `, [GUILD_ID]);

    if (announcement) {
      console.log('✅ Annonce trouvée dans audit_logs:');
      console.table({
        id: announcement.id,
        action: announcement.action,
        admin_id: announcement.admin_id,
        created_at: announcement.created_at
      });
      console.log('\nDétails:');
      console.log(JSON.stringify(announcement.details, null, 2));
    } else {
      console.log('⚠️  Annonce non trouvée dans audit_logs');
    }

    // =====================================================
    // 6. RECHERCHER DANS LE CODE OÙ SE FAIT L'ATTRIBUTION DE RÔLE
    // =====================================================
    console.log('\n📌 ÉTAPE 6: Localisation du code d\'attribution de rôle');
    console.log('-'.repeat(80));
    console.log('🔍 Recherche de "assignRole", "addRole", "roles.add" dans le codebase...');
    console.log('📄 Fichiers à vérifier:');
    console.log('   - handlers/mysteryBoxHandler.js');
    console.log('   - handlers/missionHandler.js');
    console.log('   - utils/announcements.js');
    console.log('   - events/messageCreate.js');

    // =====================================================
    // 7. RÉSUMÉ ET DIAGNOSTIC
    // =====================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSUMÉ DU DIAGNOSTIC\n');

    const hasCompletedCollection = activesCollectibles.length === totalCollectibles.count;
    const hasRoleConfigured = theme.final_role_discord_id !== null;
    const hasAnnouncement = announcement !== null;

    console.table({
      'Collection complétée': hasCompletedCollection ? '✅ OUI' : '❌ NON',
      'Role ID configuré': hasRoleConfigured ? '✅ OUI' : '❌ NON',
      'Annonce publiée': hasAnnouncement ? '✅ OUI' : '❌ NON',
      'Collectibles actifs': `${activesCollectibles.length}/${totalCollectibles.count}`,
      'Role ID thème': theme.final_role_discord_id,
      'Role ID attendu': ROLE_ID
    });

    if (!hasCompletedCollection) {
      console.log('\n⚠️  PROBLÈME IDENTIFIÉ: Collection non complète');
      console.log(`   Il manque ${totalCollectibles.count - activesCollectibles.length} collectible(s)`);
    } else if (!hasRoleConfigured) {
      console.log('\n⚠️  PROBLÈME IDENTIFIÉ: Aucun final_role_discord_id configuré sur le thème');
    } else if (hasAnnouncement) {
      console.log('\n⚠️  PROBLÈME IDENTIFIÉ: Collection complète + Annonce publiée mais rôle non attribué');
      console.log('   → Le code d\'attribution de rôle n\'a probablement pas été exécuté');
      console.log('   → Ou une erreur s\'est produite lors de l\'attribution');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

analyzeRoleIssue();
