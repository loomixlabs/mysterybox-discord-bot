const db = require('../utils/database-pg');

/**
 * Vérifier la configuration actuelle du bonus "Aimant à Légendaires"
 */

const GUILD_ID = process.env.GUILD_ID || '1248028543389143070';

async function check() {
  console.log('\n🔍 VÉRIFICATION - Bonus "Aimant à Légendaires"\n');
  console.log('='.repeat(80));

  try {
    // Chercher le bonus
    const bonus = await db.queryOne(`
      SELECT *
      FROM super_bonuses
      WHERE guild_id = $1
        AND (
          name ILIKE '%aimant%légendaire%'
          OR name ILIKE '%aimant%legendaire%'
          OR bonus_id = 'legendary_magnet'
        )
    `, [GUILD_ID]);

    if (!bonus) {
      console.log('❌ Bonus "Aimant à Légendaires" introuvable');
      process.exit(1);
    }

    console.log('\n✅ BONUS TROUVÉ\n');
    console.log(`ID:             ${bonus.id}`);
    console.log(`Bonus ID:       ${bonus.bonus_id}`);
    console.log(`Nom:            ${bonus.name}`);
    console.log(`Description:    ${bonus.description}`);
    console.log(`Type durée:     ${bonus.duration_type}`);
    console.log(`Valeur durée:   ${bonus.duration_value} secondes`);
    console.log(`                = ${Math.floor(bonus.duration_value / 3600)} heures`);
    console.log(`                = ${Math.floor(bonus.duration_value / 86400)} jours`);
    console.log(`Rareté:         ${bonus.rarity}`);
    console.log(`Couleur:        ${bonus.color}`);
    console.log(`Icône:          ${bonus.icon}`);

    console.log('\n' + '='.repeat(80));
    console.log('\n📝 ACTIONS À EFFECTUER:\n');
    console.log('1. Modifier handleBonusDurationSelect() pour afficher sélecteur 1-10h');
    console.log('2. Retirer mention de durée de la description si présente');
    console.log('3. Modifier buildBonusAnnouncementEmbed() pour afficher heures');
    console.log('4. Modifier buildVisionEmbedRow() pour afficher heures');

    console.log('\n' + '='.repeat(80) + '\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

check();
