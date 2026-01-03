/**
 * Script pour ajouter le piège "Krach Boursier" (lose-all-collectibles)
 * au thème Monopoly existant dans la base de données
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function addDevastateur() {
  const client = await pool.connect();

  try {
    console.log('🔍 Recherche du thème Monopoly dans la base de données...\n');

    // Trouver tous les thèmes Monopoly
    const themes = await client.query(`
      SELECT id, name, guild_id
      FROM themes
      WHERE LOWER(name) LIKE '%monopoly%'
    `);

    if (themes.rows.length === 0) {
      console.log('❌ Aucun thème Monopoly trouvé dans la base de données');
      return;
    }

    console.log(`✅ ${themes.rows.length} thème(s) Monopoly trouvé(s):\n`);

    for (const theme of themes.rows) {
      console.log(`📋 Thème ID: ${theme.id} - "${theme.name}" (Serveur: ${theme.guild_id})`);

      // Vérifier si le piège existe déjà
      const existingTrap = await client.query(`
        SELECT id FROM traps
        WHERE theme_id = $1 AND type = 'lose-all-collectibles'
      `, [theme.id]);

      if (existingTrap.rows.length > 0) {
        console.log(`   ✅ Piège "lose-all-collectibles" existe déjà (ID: ${existingTrap.rows[0].id})`);
        continue;
      }

      // Ajouter le nouveau piège (structure exacte du piège existant)
      const result = await client.query(`
        INSERT INTO traps (
          theme_id, guild_id, trap_id, name, type, description, image_url,
          cooldown_duration, removes_collectible, shame_message, malus_points,
          is_default, is_active, notif_title, notif_description, notif_color, notif_footer
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id
      `, [
        theme.id,
        theme.guild_id,
        'trap-krach-boursier',
        'Krach Boursier 📉',
        'lose-all-collectibles',
        'Un krach boursier dévastateur vous fait tout perdre ! Toutes vos propriétés sont saisies.',
        'https://assets.stickpng.com/images/593007da3919fe0ee3614da8.png',
        0,                    // cooldown_duration
        true,                 // removes_collectible
        '💥 {user} a déclenché un KRACH BOURSIER ! Toutes ses propriétés ont été saisies... ({count} propriétés perdues)',
        0,                    // malus_points
        true,                 // is_default
        true,                 // is_active
        '📉 KRACH BOURSIER !',
        '**CATASTROPHE FINANCIÈRE !** La bourse s\'effondre et emporte avec elle **TOUTES VOS PROPRIÉTÉS** !\n\n💔 **{count} propriété(s) perdue(s)** d\'un seul coup...\n\n⚠️ Votre empire immobilier a été complètement anéanti. Il va falloir tout recommencer ! 😈',
        '#8b0000',
        'L\'empire s\'effondre... 💔'
      ]);

      console.log(`   ✅ Piège "Krach Boursier" ajouté avec succès (ID: ${result.rows[0].id})`);
    }

    // Vérification finale
    console.log('\n📊 Vérification finale des pièges Monopoly:\n');

    for (const theme of themes.rows) {
      const traps = await client.query(`
        SELECT name, type FROM traps WHERE theme_id = $1 ORDER BY type
      `, [theme.id]);

      console.log(`🎭 Thème: ${theme.name} (ID: ${theme.id})`);
      traps.rows.forEach(trap => {
        console.log(`   - ${trap.name} (type: ${trap.type})`);
      });
      console.log('');
    }

    console.log('🎉 Migration terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

addDevastateur();
