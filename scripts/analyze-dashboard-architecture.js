/**
 * Analyse de l'architecture DB pour le Dashboard
 */
const db = require('../utils/database-pg');

async function analyze() {
  console.log('═'.repeat(60));
  console.log('   ANALYSE ARCHITECTURE DB POUR DASHBOARD');
  console.log('═'.repeat(60));

  try {
    // 1. Themes par guild
    console.log('\n📦 THEMES PAR GUILD:');
    const themes = await db.queryAll(`
      SELECT guild_id, id, name, is_active, created_at
      FROM themes
      ORDER BY guild_id, is_active DESC
    `);
    themes.forEach(t => {
      console.log(`  Guild ${t.guild_id}: Theme "${t.name}" (ID: ${t.id}) - Active: ${t.is_active ? '✅' : '❌'}`);
    });

    // 2. Guild Config - colonnes
    console.log('\n⚙️ GUILD_CONFIG (colonnes):');
    const guildConfigCols = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'guild_config'
      ORDER BY ordinal_position
    `);
    guildConfigCols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));

    // Guild Config data
    const guildConfig = await db.queryAll(`SELECT * FROM guild_config LIMIT 5`);
    console.log('\n  Données:');
    guildConfig.forEach(g => {
      console.log(`  Guild ${g.guild_id}: premium=${g.is_premium}, trial=${g.trial_mode}`);
    });

    // 3. Theme Config
    console.log('\n🎨 THEME_CONFIG (structure):');
    const themeConfigCols = await db.queryAll(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'theme_config'
      ORDER BY ordinal_position
    `);
    themeConfigCols.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));

    // 4. Announcement Templates
    console.log('\n📢 ANNOUNCEMENT_TEMPLATES:');
    const templateCount = await db.queryAll(`
      SELECT guild_id, theme_id, COUNT(*) as count
      FROM announcement_templates
      GROUP BY guild_id, theme_id
    `);
    templateCount.forEach(t => {
      console.log(`  Guild ${t.guild_id}, Theme ${t.theme_id}: ${t.count} templates`);
    });

    // 5. Campaigns
    console.log('\n🎯 GIVE_CAMPAIGNS:');
    const campaigns = await db.queryAll(`
      SELECT id, guild_id, theme_id, name, status, campaign_type
      FROM give_campaigns
      ORDER BY guild_id
    `);
    if (campaigns.length === 0) {
      console.log('  (Aucune campagne)');
    } else {
      campaigns.forEach(c => {
        console.log(`  Campaign "${c.name}": guild=${c.guild_id}, theme=${c.theme_id || 'NULL'}, type=${c.campaign_type}, status=${c.status}`);
      });
    }

    // 6. Collectibles par theme
    console.log('\n💎 COLLECTIBLES PAR THEME:');
    const collectibles = await db.queryAll(`
      SELECT guild_id, theme_id, COUNT(*) as count
      FROM collectibles
      GROUP BY guild_id, theme_id
      ORDER BY guild_id, theme_id
    `);
    collectibles.forEach(c => {
      console.log(`  Guild ${c.guild_id}, Theme ${c.theme_id}: ${c.count} collectibles`);
    });

    // 7. Traps par theme
    console.log('\n⚠️ TRAPS PAR THEME:');
    const traps = await db.queryAll(`
      SELECT guild_id, theme_id, COUNT(*) as count
      FROM traps
      GROUP BY guild_id, theme_id
      ORDER BY guild_id, theme_id
    `);
    traps.forEach(t => {
      console.log(`  Guild ${t.guild_id}, Theme ${t.theme_id}: ${t.count} traps`);
    });

    // 8. Missions par theme
    console.log('\n🎯 MISSIONS PAR THEME:');
    const missions = await db.queryAll(`
      SELECT guild_id, theme_id, type, COUNT(*) as count
      FROM missions
      GROUP BY guild_id, theme_id, type
      ORDER BY guild_id, theme_id
    `);
    missions.forEach(m => {
      console.log(`  Guild ${m.guild_id}, Theme ${m.theme_id}: ${m.count} missions (type: ${m.type})`);
    });

    // 9. Super Bonus (global ou par guild?)
    console.log('\n⚡ SUPER_BONUSES:');
    const superBonuses = await db.queryAll(`
      SELECT guild_id, COUNT(*) as count
      FROM super_bonuses
      GROUP BY guild_id
    `);
    superBonuses.forEach(s => {
      console.log(`  Guild ${s.guild_id}: ${s.count} super bonus configurés`);
    });

    // 10. Players par guild
    console.log('\n👥 PLAYERS PAR GUILD:');
    const players = await db.queryAll(`
      SELECT guild_id, COUNT(*) as count
      FROM players
      GROUP BY guild_id
    `);
    players.forEach(p => {
      console.log(`  Guild ${p.guild_id}: ${p.count} joueurs`);
    });

    // 11. Themes Library (public)
    console.log('\n📚 THEMES_LIBRARY (bibliothèque publique):');
    const library = await db.queryAll(`
      SELECT theme_id, name, visibility, creator_username, download_count, is_featured
      FROM themes_library
      ORDER BY is_featured DESC, download_count DESC
      LIMIT 10
    `);
    if (library.length === 0) {
      console.log('  (Aucun thème dans la bibliothèque)');
    } else {
      library.forEach(l => {
        console.log(`  "${l.name}" by ${l.creator_username} - ${l.visibility} - Downloads: ${l.download_count} ${l.is_featured ? '⭐' : ''}`);
      });
    }

    console.log('\n' + '═'.repeat(60));
    console.log('   RÉSUMÉ DES RELATIONS');
    console.log('═'.repeat(60));
    console.log(`
┌─────────────────────────────────────────────────────────┐
│  GUILD (serveur Discord)                                │
│  └── guild_config (1 config par guild)                  │
│      └── active_theme_id → pointe vers un theme         │
│                                                         │
│  THEMES (par guild)                                     │
│  └── theme_config (config du thème actif)               │
│  └── collectibles (items du thème)                      │
│  └── traps (pièges du thème)                            │
│  └── missions (missions du thème)                       │
│  └── theme_messages (messages personnalisés)            │
│  └── announcement_templates (annonces du thème)         │
│                                                         │
│  GIVE_CAMPAIGNS                                         │
│  └── Liées à guild_id ET theme_id (optionnel)           │
│                                                         │
│  SUPER_BONUSES                                          │
│  └── Par guild (12 types configurables)                 │
│                                                         │
│  THEMES_LIBRARY (indépendant des guilds)                │
│  └── Thèmes publics/privés partageables                 │
└─────────────────────────────────────────────────────────┘
`);

    process.exit(0);
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

analyze();
