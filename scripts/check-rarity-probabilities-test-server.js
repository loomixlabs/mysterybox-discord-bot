const db = require('../utils/database-pg');

async function checkRarityProbabilities() {
  try {
    const GUILD_ID = '297309737135898624'; // Serveur de TEST

    console.log('🔍 VÉRIFICATION - Probabilités de Rareté (SERVEUR TEST)\n');
    console.log('='.repeat(80));

    // Vérifier si le thème a des probabilités personnalisées
    const themeProbs = await db.query(`
      SELECT t.id, t.name, tc.rarity_probabilities
      FROM themes t
      LEFT JOIN theme_config tc ON t.id = tc.theme_id AND tc.guild_id = t.guild_id
      WHERE t.guild_id = $1 AND t.is_active = TRUE
    `, [GUILD_ID]);

    console.log('\n📊 Thème actif et probabilités:\n');

    if (themeProbs.length > 0) {
      const theme = themeProbs[0];
      console.log(`Theme ID: ${theme.id}`);
      console.log(`Theme Name: ${theme.name}`);
      console.log(`\nProbabilités enregistrées:`);

      if (theme.rarity_probabilities) {
        console.log(JSON.stringify(theme.rarity_probabilities, null, 2));

        // Calculer le boost attendu pour legendary
        const legendaryProb = theme.rarity_probabilities.legendary || 0;
        const boost = 50; // boost_percentage de l'Aimant
        const boostedProb = legendaryProb + boost;

        console.log(`\n🎯 Calculs pour Aimant à Légendaires (boost +${boost}):`);
        console.log(`   Probabilité legendary de base: ${legendaryProb}%`);
        console.log(`   Probabilité avec Aimant: ${boostedProb}%`);
        console.log(`   (Formule: ${legendaryProb} + ${boost} = ${boostedProb})`);
      } else {
        console.log('NULL (utilise les probabilités par défaut du code)');
      }
    } else {
      console.log('❌ Aucun thème actif trouvé pour ce serveur !');
    }

    console.log('\n' + '='.repeat(80));
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkRarityProbabilities();
