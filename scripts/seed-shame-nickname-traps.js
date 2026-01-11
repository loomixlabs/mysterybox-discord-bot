/**
 * Seed: Créer les pièges "Shame Nickname" par défaut pour tous les thèmes actifs
 */

require('dotenv').config();
const db = require('../utils/database-pg');

// Un seul piège par défaut - les admins peuvent créer d'autres variantes si besoin
const DEFAULT_SHAME_NICKNAME_TRAPS = [
  {
    trap_id: 'shame-nickname',
    name: 'Pseudo Honteux',
    description: 'Un sortilège maléfique change ton pseudo ! Impossible de le modifier jusqu\'à expiration...',
    type: 'shame-nickname',
    cooldown_duration: 60, // 1 heure par défaut
    image_url: '',
    is_default: true,
    notif_title: '🎭 PSEUDO HONTEUX !',
    notif_description: '{player} a été victime du piège du Pseudo Honteux !',
    notif_color: '#E91E63',
    notif_footer: 'Durée configurable par les admins'
  }
];

async function seedShameNicknameTraps() {
  console.log('🎭 Seed: Création des pièges Shame Nickname\n');
  console.log('='.repeat(60));

  try {
    // Récupérer tous les thèmes de tous les serveurs
    const themes = await db.queryAll(`
      SELECT t.id, t.name, t.guild_id, gc.guild_name
      FROM themes t
      JOIN guild_config gc ON t.guild_id = gc.guild_id
      ORDER BY t.guild_id, t.name
    `);

    console.log(`📊 ${themes.length} thème(s) trouvé(s)\n`);

    let created = 0;
    let skipped = 0;

    for (const theme of themes) {
      console.log(`\n🎨 Thème: ${theme.name} (Serveur: ${theme.guild_name})`);

      for (const trapDef of DEFAULT_SHAME_NICKNAME_TRAPS) {
        // Vérifier si le piège existe déjà
        const existing = await db.queryOne(`
          SELECT id FROM traps
          WHERE guild_id = $1 AND theme_id = $2 AND trap_id = $3
        `, [theme.guild_id, theme.id, trapDef.trap_id]);

        if (existing) {
          console.log(`   ⏭️  ${trapDef.name} existe déjà`);
          skipped++;
          continue;
        }

        // Créer le piège
        await db.query(`
          INSERT INTO traps (
            guild_id, theme_id, trap_id, name, description, type,
            cooldown_duration, image_url, is_default, is_active,
            notif_title, notif_description, notif_color, notif_footer
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          theme.guild_id,
          theme.id,
          trapDef.trap_id,
          trapDef.name,
          trapDef.description,
          trapDef.type,
          trapDef.cooldown_duration,
          trapDef.image_url,
          trapDef.is_default,
          true, // is_active
          trapDef.notif_title,
          trapDef.notif_description,
          trapDef.notif_color,
          trapDef.notif_footer
        ]);

        console.log(`   ✅ ${trapDef.name} créé (${trapDef.cooldown_duration} min)`);
        created++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ SEED TERMINÉ: ${created} pièges créés, ${skipped} ignorés`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n🔴 ERREUR:', error);
    process.exit(1);
  }
}

seedShameNicknameTraps();
