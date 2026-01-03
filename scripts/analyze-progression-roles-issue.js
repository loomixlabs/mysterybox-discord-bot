/**
 * Analyse approfondie du problème de rôles de progression
 * Ton cas: testv3 → testv4, 1er collectible OK, 2ème collectible n'a pas donné "explorateur"
 */

const db = require('../utils/database-pg');

async function analyze() {
  console.log('🔍 ANALYSE APPROFONDIE - RÔLES DE PROGRESSION\n');
  console.log('='.repeat(80));

  const guildId = '297309737135898624'; // Serveur de test

  try {
    // 1. Récupérer TOUS les joueurs du serveur
    console.log('\n📋 1. TOUS LES JOUEURS DU SERVEUR');
    console.log('-'.repeat(40));
    const allPlayers = await db.queryAll(
      'SELECT id, discord_id, username FROM players WHERE guild_id = $1 ORDER BY id',
      [guildId]
    );
    console.table(allPlayers);

    // Prendre le premier joueur ou un joueur spécifique
    const player = allPlayers[0];
    if (!player) {
      console.log('❌ Aucun joueur trouvé!');
      process.exit(1);
    }
    console.log('\nPlayer sélectionné:', player.username, `(ID: ${player.id})`);
    const userId = player.discord_id;

    // 2. Récupérer le thème actif
    console.log('\n📋 2. THÈME ACTIF');
    console.log('-'.repeat(40));
    const activeTheme = await db.queryOne(
      'SELECT id, theme_id, name FROM themes WHERE guild_id = $1 AND is_active = true',
      [guildId]
    );
    console.log('Thème actif:', activeTheme?.name, `(ID: ${activeTheme?.id}, theme_id: "${activeTheme?.theme_id}")`);

    // 3. Lister TOUS les thèmes du serveur
    console.log('\n📋 3. TOUS LES THÈMES DU SERVEUR');
    console.log('-'.repeat(40));
    const allThemes = await db.queryAll(
      'SELECT id, theme_id, name, is_active FROM themes WHERE guild_id = $1 ORDER BY name',
      [guildId]
    );
    console.table(allThemes);

    // 4. Progression du joueur sur TOUS les thèmes
    console.log('\n📋 4. PLAYER_PROGRESS SUR TOUS LES THÈMES');
    console.log('-'.repeat(40));
    const allProgress = await db.queryAll(`
      SELECT pp.*, t.name as theme_name, t.theme_id as theme_code
      FROM player_progress pp
      JOIN themes t ON pp.theme_id = t.id
      WHERE pp.guild_id = $1 AND pp.player_id = $2
      ORDER BY t.name
    `, [guildId, player.id]);

    for (const p of allProgress) {
      console.log(`\n  📊 Thème: ${p.theme_name} (${p.theme_code})`);
      console.log(`     collected_count: ${p.collected_count}`);
      console.log(`     is_completed: ${p.is_completed}`);
      console.log(`     achieved_progression_roles: ${JSON.stringify(p.achieved_progression_roles || [])}`);
    }

    // 5. Configuration progression_roles dans theme_config pour TOUS les thèmes
    console.log('\n📋 5. PROGRESSION_ROLES DANS THEME_CONFIG');
    console.log('-'.repeat(40));
    const allConfigs = await db.queryAll(`
      SELECT tc.theme_id, t.name as theme_name, tc.progression_roles
      FROM theme_config tc
      JOIN themes t ON tc.theme_id = t.id
      WHERE tc.guild_id = $1
      ORDER BY t.name
    `, [guildId]);

    for (const c of allConfigs) {
      console.log(`\n  🎯 Thème: ${c.theme_name}`);
      const roles = c.progression_roles || [];
      if (roles.length === 0) {
        console.log(`     ❌ Aucun progression_role configuré!`);
      } else {
        for (const r of roles) {
          console.log(`     - "${r.name}" @ ${r.required_items} items (${r.percentage}%) - discord_role_id: ${r.discord_role_id || 'NON CRÉÉ'}`);
        }
      }
    }

    // 6. Collectibles du joueur sur le thème ACTIF
    console.log('\n📋 6. COLLECTIBLES DU JOUEUR SUR THÈME ACTIF');
    console.log('-'.repeat(40));
    if (activeTheme) {
      const collectibles = await db.queryAll(`
        SELECT col.name, col.rarity, c.collected_at
        FROM collections c
        JOIN collectibles col ON c.collectible_id = col.id
        WHERE c.guild_id = $1 AND c.player_id = $2 AND col.theme_id = $3
        ORDER BY c.collected_at DESC
      `, [guildId, player.id, activeTheme.id]);

      console.log(`  Total: ${collectibles.length} collectibles sur ${activeTheme.name}`);
      console.table(collectibles);
    }

    // 7. Vérification des rôles Discord partagés entre thèmes
    console.log('\n📋 7. VÉRIFICATION DES DISCORD_ROLE_ID PARTAGÉS');
    console.log('-'.repeat(40));
    const roleIds = [];
    for (const c of allConfigs) {
      const roles = c.progression_roles || [];
      for (const r of roles) {
        if (r.discord_role_id) {
          roleIds.push({
            theme: c.theme_name,
            role_name: r.name,
            required_items: r.required_items,
            discord_role_id: r.discord_role_id
          });
        }
      }
    }

    // Grouper par discord_role_id
    const groupedByRoleId = {};
    for (const r of roleIds) {
      if (!groupedByRoleId[r.discord_role_id]) {
        groupedByRoleId[r.discord_role_id] = [];
      }
      groupedByRoleId[r.discord_role_id].push(r);
    }

    let sharedFound = false;
    for (const [roleId, entries] of Object.entries(groupedByRoleId)) {
      if (entries.length > 1) {
        sharedFound = true;
        console.log(`\n  ⚠️  RÔLE PARTAGÉ discord_role_id: ${roleId}`);
        for (const e of entries) {
          console.log(`     - Thème "${e.theme}" → "${e.role_name}" @ ${e.required_items} items`);
        }
      }
    }
    if (!sharedFound) {
      console.log('  ✅ Aucun discord_role_id partagé entre thèmes');
    }

    // 8. Vérification progression_roles TABLE (si elle existe)
    console.log('\n📋 8. TABLE progression_roles (ancienne structure?)');
    console.log('-'.repeat(40));
    try {
      const tableExists = await db.queryOne(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'progression_roles'
        )
      `);

      if (tableExists.exists) {
        const oldRoles = await db.queryAll(`
          SELECT pr.*, t.name as theme_name
          FROM progression_roles pr
          JOIN themes t ON pr.theme_id = t.id
          WHERE pr.guild_id = $1
          ORDER BY t.name, pr.required_collectibles
        `, [guildId]);

        if (oldRoles.length > 0) {
          console.log('  ⚠️  ANCIENNE TABLE progression_roles EXISTE!');
          console.table(oldRoles);
        } else {
          console.log('  Table existe mais vide');
        }
      } else {
        console.log('  Table n\'existe pas (normal si migration récente)');
      }
    } catch (e) {
      console.log('  Erreur accès table:', e.message);
    }

    // 9. ANALYSE DU PROBLÈME POTENTIEL
    console.log('\n' + '='.repeat(80));
    console.log('🔬 ANALYSE DU PROBLÈME POTENTIEL');
    console.log('='.repeat(80));

    // Trouver le player_progress pour le thème actif
    const activeProgress = allProgress.find(p => p.theme_code === activeTheme?.theme_id);
    const activeConfig = allConfigs.find(c => c.theme_id === activeTheme?.id);

    if (activeProgress && activeConfig) {
      console.log(`\nThème actif: ${activeTheme.name}`);
      console.log(`Collectibles comptés: ${activeProgress.collected_count}`);
      console.log(`Rôles déjà atteints: ${JSON.stringify(activeProgress.achieved_progression_roles || [])}`);

      const progressionRoles = activeConfig.progression_roles || [];
      console.log(`\nRôles de progression configurés:`);
      for (const r of progressionRoles) {
        const achieved = (activeProgress.achieved_progression_roles || []).includes(r.required_items);
        const shouldHave = activeProgress.collected_count >= r.required_items;
        console.log(`  - "${r.name}" @ ${r.required_items} items`);
        console.log(`    Devrait l'avoir: ${shouldHave ? '✅ OUI' : '❌ NON'}`);
        console.log(`    Marqué atteint: ${achieved ? '✅ OUI' : '❌ NON'}`);
        if (shouldHave && !achieved) {
          console.log(`    ⚠️  PROBLÈME: Devrait avoir ce rôle mais pas marqué comme atteint!`);
        }
      }
    } else {
      console.log('❌ Impossible de trouver player_progress ou theme_config pour le thème actif');
    }

    // 10. Vérifier si la fonction member.roles.add() vérifie si le membre a déjà le rôle
    console.log('\n📋 10. VÉRIFICATION CODE - Conditions de blocage potentielles');
    console.log('-'.repeat(40));
    console.log(`
Le code progressionRoleHandler.js (lignes 55-64) fait cette vérification:

  const newlyAchievedRoles = progressionRoles.filter(role => {
    const threshold = role.required_items;
    return (
      newCollectionCount >= threshold &&          // Seuil atteint
      !achievedRoles.includes(threshold) &&       // Pas déjà dans achieved_progression_roles
      role.percentage < 100                       // Pas le rôle final
    );
  });

⚠️  PROBLÈME POTENTIEL IDENTIFIÉ:
- Si achieved_progression_roles contient déjà le seuil (ex: 1), le nouveau seuil (ex: 2) ne sera pas bloqué
- MAIS si le discord_role_id du rôle niveau 2 n'existe pas, il sera créé
- Le problème n'est PAS lié aux rôles partagés entre thèmes car achieved_progression_roles est par thème
    `);

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

analyze();
