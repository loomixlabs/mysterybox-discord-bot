/**
 * Diagnostic détaillé des progression_roles pour testv3 et testv4
 */

const db = require('../utils/database-pg');

async function check() {
  console.log('🔍 DIAGNOSTIC PROGRESSION_ROLES\n');
  console.log('='.repeat(80));

  const guildId = '297309737135898624'; // Serveur de test

  try {
    // 1. Tous les thèmes et leur theme_config
    const themes = await db.queryAll(`
      SELECT t.id, t.theme_id, t.name, t.is_active, tc.progression_roles
      FROM themes t
      LEFT JOIN theme_config tc ON t.id = tc.theme_id AND t.guild_id = tc.guild_id
      WHERE t.guild_id = $1
      ORDER BY t.name
    `, [guildId]);

    console.log(`\n📋 ${themes.length} thèmes trouvés:\n`);

    for (const theme of themes) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`🎨 Thème: ${theme.name} (ID: ${theme.id}, theme_id: "${theme.theme_id}")`);
      console.log(`   Actif: ${theme.is_active ? '✅ OUI' : '❌ NON'}`);

      const roles = theme.progression_roles || [];
      console.log(`   Progression roles: ${roles.length}`);

      if (roles.length > 0) {
        for (const role of roles) {
          console.log(`\n      📍 "${role.name}"`);
          console.log(`         percentage: ${role.percentage}`);
          console.log(`         required_items: ${role.required_items} (type: ${typeof role.required_items})`);
          console.log(`         discord_role_id: ${role.discord_role_id || 'NON CRÉÉ'}`);
          console.log(`         color: ${role.color || 'NON DÉFINI'}`);

          // Analyse du problème
          if (role.required_items === undefined) {
            console.log(`         ⚠️  PROBLÈME: required_items est undefined!`);
          } else if (role.required_items === null) {
            console.log(`         ⚠️  PROBLÈME: required_items est null!`);
          } else if (typeof role.required_items !== 'number') {
            console.log(`         ⚠️  PROBLÈME: required_items n'est pas un nombre!`);
          }
        }
      } else {
        console.log(`      ❌ Aucun progression role configuré`);
      }

      // Vérifier le nombre total de collectibles pour ce thème
      const collectibleCount = await db.queryOne(`
        SELECT COUNT(*) as total
        FROM collectibles
        WHERE guild_id = $1 AND theme_id = $2
      `, [guildId, theme.id]);

      console.log(`\n   📦 Nombre de collectibles dans ce thème: ${collectibleCount?.total || 0}`);

      // Recalculer ce que required_items DEVRAIT être
      if (roles.length > 0 && collectibleCount?.total > 0) {
        console.log(`   📐 Recalcul des required_items attendus:`);
        for (const role of roles) {
          const expectedItems = Math.ceil((role.percentage / 100) * collectibleCount.total);
          console.log(`      "${role.name}" @ ${role.percentage}% → devrait être ${expectedItems} items`);
          if (role.required_items !== expectedItems) {
            console.log(`         ⚠️  DÉCALAGE: stocké ${role.required_items}, attendu ${expectedItems}`);
          }
        }
      }
    }

    // 2. Vérifier player_progress pour le thème actif
    console.log(`\n\n${'═'.repeat(80)}`);
    console.log('📊 PLAYER_PROGRESS POUR LE THÈME ACTIF\n');

    const activeTheme = themes.find(t => t.is_active);
    if (activeTheme) {
      const progressList = await db.queryAll(`
        SELECT pp.player_id, p.username, pp.collected_count, pp.achieved_progression_roles
        FROM player_progress pp
        JOIN players p ON pp.player_id = p.id
        WHERE pp.guild_id = $1 AND pp.theme_id = $2
        ORDER BY pp.collected_count DESC
      `, [guildId, activeTheme.id]);

      console.log(`Thème actif: ${activeTheme.name}`);
      console.log(`Progression roles configurés: ${JSON.stringify((activeTheme.progression_roles || []).map(r => ({
        name: r.name,
        required_items: r.required_items,
        percentage: r.percentage
      })))}`);

      console.log(`\nJoueurs avec progression:`);
      for (const prog of progressList) {
        console.log(`\n   👤 ${prog.username}`);
        console.log(`      collected_count: ${prog.collected_count}`);
        console.log(`      achieved_progression_roles: ${JSON.stringify(prog.achieved_progression_roles || [])}`);

        // Analyser si le joueur devrait avoir des rôles qu'il n'a pas
        const roles = activeTheme.progression_roles || [];
        for (const role of roles) {
          const shouldHave = prog.collected_count >= role.required_items && role.percentage < 100;
          const hasIt = (prog.achieved_progression_roles || []).includes(role.required_items);

          if (role.required_items !== undefined) {
            if (shouldHave && !hasIt) {
              console.log(`      ⚠️  MANQUANT: Devrait avoir "${role.name}" (${role.required_items} items)`);
            }
          } else {
            console.log(`      ⚠️  IMPOSSIBLE: "${role.name}" a required_items=undefined`);
          }
        }
      }
    }

    // 3. Conclusion
    console.log(`\n\n${'═'.repeat(80)}`);
    console.log('📋 RÉSUMÉ DES PROBLÈMES TROUVÉS\n');

    let problemCount = 0;
    for (const theme of themes) {
      const roles = theme.progression_roles || [];
      for (const role of roles) {
        if (role.required_items === undefined || role.required_items === null) {
          console.log(`❌ ${theme.name}: "${role.name}" → required_items=${role.required_items}`);
          problemCount++;
        }
      }
    }

    if (problemCount === 0) {
      console.log('✅ Aucun problème de required_items trouvé');
    } else {
      console.log(`\n⚠️  ${problemCount} rôle(s) avec required_items manquant!`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  process.exit(0);
}

check();
