const db = require('./utils/database-pg');
require('dotenv').config();

async function createEmptyBoxTrap() {
  try {
    const guildId = '1248028543389143070';
    const themeId = 23; // Blanche-Neige

    console.log('📦 Création du piège "La Boîte Vide"...\n');

    // Vérifier si le piège existe déjà
    const existing = await db.queryOne(`
      SELECT * FROM traps
      WHERE guild_id = $1 AND theme_id = $2 AND trap_id = 'trap-empty-box'
    `, [guildId, themeId]);

    if (existing) {
      console.log('⏭️  Le piège existe déjà:');
      console.log(`   ID: ${existing.id}`);
      console.log(`   Nom: ${existing.name}`);
      console.log(`   Actif: ${existing.is_active}`);
      console.log(`   Type: ${existing.type}`);
      console.log('\nSi vous voulez le réactiver:');
      console.log(`   UPDATE traps SET is_active = true WHERE id = ${existing.id};`);
      process.exit(0);
    }

    // Créer le piège
    const result = await db.queryOne(`
      INSERT INTO traps (
        guild_id,
        theme_id,
        trap_id,
        name,
        type,
        description,
        image_url,
        cooldown_duration,
        malus_points,
        shame_message,
        removes_collectible,
        is_default,
        is_active,
        notif_title,
        notif_description,
        notif_color,
        notif_footer
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id
    `, [
      guildId,
      themeId,
      'trap-empty-box',
      'La Boîte Vide',
      'empty-box',
      'Sérieusement, qui peut bien avoir l\'idée d\'envoyer une boîte vide ?',
      null, // Pas d'image pour l'instant
      0,
      0,
      '📦 La boîte est... vide ? Complètement vide ! Rien du tout.',
      false,
      true, // is_default
      true, // is_active
      '📦 BOÎTE VIDE !',
      '**Sérieusement ?** Tu as ouvert une boîte... complètement vide !\n\n🤷 Pas de collectible, pas de mission, rien du tout. Juste le néant.\n\n💡 Au moins tu n\'as rien perdu !',
      '#95a5a6', // Gris
      'Mieux vaut en rire ! 🤷'
    ]);

    const trapId = result.id;

    console.log('✅ Piège créé avec succès !');
    console.log(`   ID: ${trapId}`);
    console.log(`   Nom: La Boîte Vide`);
    console.log(`   Type: empty-box`);
    console.log(`   Thème: Blanche-Neige (ID: ${themeId})`);
    console.log(`   Actif: true`);

    console.log('\n🎯 Pour tester:');
    console.log(`   /give unique mode:trap item_id:${trapId}`);

    console.log('\n📋 Prochaines étapes:');
    console.log('   1. Exécuter: node add-empty-box-announcement.js');
    console.log('   2. Exécuter: node post-empty-box-announcement.js');
    console.log('   3. Tester avec /give unique');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

createEmptyBoxTrap();
