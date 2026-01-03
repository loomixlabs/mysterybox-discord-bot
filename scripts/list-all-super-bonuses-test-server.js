require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '297309737135898624'; // Serveur de TEST

async function listAll() {
  try {
    console.log('🔍 LISTE DE TOUS LES SUPER BONUS - SERVEUR DE TEST\n');
    console.log('='.repeat(80));
    console.log(`Serveur: ${GUILD_ID}\n`);

    // Récupérer TOUS les super bonus du serveur de test
    const bonuses = await db.queryAll(`
      SELECT
        id,
        bonus_id,
        name,
        description,
        icon,
        rarity,
        effect_type,
        activation_mode,
        is_enabled,
        created_at
      FROM super_bonuses
      WHERE guild_id = $1
      ORDER BY name, id
    `, [GUILD_ID]);

    console.log(`📊 Total: ${bonuses.length} super bonus trouvé(s)\n`);

    if (bonuses.length > 0) {
      console.table(bonuses.map(b => ({
        'ID': b.id,
        'bonus_id': b.bonus_id,
        'Nom': b.name,
        'Icon': b.icon,
        'Rareté': b.rarity,
        'Type': b.effect_type,
        'Mode': b.activation_mode,
        'Activé': b.is_enabled ? '✅' : '❌'
      })));

      // Détecter les doublons par nom
      console.log('\n🔍 DÉTECTION DES DOUBLONS:\n');
      const nameCount = {};
      bonuses.forEach(b => {
        nameCount[b.name] = (nameCount[b.name] || 0) + 1;
      });

      const duplicates = Object.entries(nameCount).filter(([name, count]) => count > 1);

      if (duplicates.length > 0) {
        console.log('⚠️  DOUBLONS DÉTECTÉS:\n');
        duplicates.forEach(([name, count]) => {
          console.log(`   ${name}: ${count} occurrence(s)`);
          const dupes = bonuses.filter(b => b.name === name);
          console.table(dupes.map(d => ({
            'ID': d.id,
            'bonus_id': d.bonus_id,
            'Nom': d.name,
            'Créé le': d.created_at
          })));
        });
      } else {
        console.log('✅ Aucun doublon détecté');
      }
    } else {
      console.log('❌ Aucun super bonus trouvé pour ce serveur');
    }

    console.log('\n' + '='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

listAll();
