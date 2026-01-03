const db = require('../utils/database-pg');

/**
 * Retirer "(3 jours)" de la description du bonus "Aimant à Légendaires"
 * Car la durée est affichée dynamiquement dans /profile et peut être configurée
 */

const GUILD_ID = process.env.GUILD_ID || '1248028543389143070';

async function update() {
  console.log('\n🔄 MISE À JOUR - Description "Aimant à Légendaires"\n');
  console.log('='.repeat(80));

  try {
    // Récupérer le bonus
    const bonus = await db.queryOne(`
      SELECT *
      FROM super_bonuses
      WHERE guild_id = $1
        AND bonus_id = 'legendary_magnet'
    `, [GUILD_ID]);

    if (!bonus) {
      console.log('❌ Bonus "Aimant à Légendaires" introuvable');
      process.exit(1);
    }

    console.log(`\n📋 AVANT:\n`);
    console.log(`   Description: "${bonus.description}"`);

    // Nouvelle description sans mention de durée
    const newDescription = 'Si un collectible tombe, +50% de chance qu\'il soit légendaire';

    // Mettre à jour
    await db.query(`
      UPDATE super_bonuses
      SET description = $1
      WHERE guild_id = $2
        AND bonus_id = 'legendary_magnet'
    `, [newDescription, GUILD_ID]);

    console.log(`\n📋 APRÈS:\n`);
    console.log(`   Description: "${newDescription}"`);

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Description mise à jour avec succès !');
    console.log('💡 La durée est maintenant affichée dynamiquement dans /profile\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

update();
