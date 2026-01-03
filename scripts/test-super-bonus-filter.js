require('dotenv').config();
const db = require('../utils/database-pg');

const GUILD_ID = '1248028543389143070'; // Serveur de production

async function test() {
  try {
    console.log('🔍 TEST DU FILTRE SUPER BONUS\n');
    console.log('='.repeat(80));

    // 1. Récupérer TOUS les super bonus (comme dans le panneau admin)
    console.log('\n📊 TEST 1: getAllSuperBonuses() - TOUS les bonus (panneau admin):\n');
    const allBonuses = await db.getAllSuperBonuses(GUILD_ID);
    console.log(`Total: ${allBonuses.length} super bonus`);

    if (allBonuses.length > 0) {
      console.table(allBonuses.map(b => ({
        'ID': b.id,
        'Bonus': `${b.icon} ${b.name}`,
        'Rareté': b.rarity,
        'Activé': b.is_enabled ? '✅' : '❌',
        'Mode': b.activation_mode
      })));
    }

    // 2. Récupérer UNIQUEMENT les super bonus actifs (comme dans Give Unique)
    console.log('\n✨ TEST 2: getAllSuperBonuses(guildId, null, true) - UNIQUEMENT actifs (Give Unique):\n');
    const activeBonuses = await db.getAllSuperBonuses(GUILD_ID, null, true);
    console.log(`Total: ${activeBonuses.length} super bonus actifs`);

    if (activeBonuses.length > 0) {
      console.table(activeBonuses.map(b => ({
        'ID': b.id,
        'Bonus': `${b.icon} ${b.name}`,
        'Rareté': b.rarity,
        'Activé': b.is_enabled ? '✅' : '❌',
        'Mode': b.activation_mode
      })));
    } else {
      console.log('⚠️  Aucun super bonus actif trouvé');
      console.log('💡 Active des bonus dans le panneau Super Admin pour les voir ici');
    }

    // 3. Statistiques
    console.log('\n📈 STATISTIQUES:\n');
    const enabledCount = allBonuses.filter(b => b.is_enabled).length;
    const disabledCount = allBonuses.length - enabledCount;

    console.log(`Total des super bonus: ${allBonuses.length}`);
    console.log(`  ✅ Activés: ${enabledCount}`);
    console.log(`  ❌ Désactivés: ${disabledCount}`);

    // 4. Vérification de cohérence
    console.log('\n🔍 VÉRIFICATION DE COHÉRENCE:\n');
    if (activeBonuses.length === enabledCount) {
      console.log(`✅ CORRECT: Le filtre activeOnly retourne bien ${enabledCount} bonus actif(s)`);
    } else {
      console.error(`❌ ERREUR: Incohérence détectée !`);
      console.error(`   - Filtre activeOnly: ${activeBonuses.length} bonus`);
      console.error(`   - Comptage manuel: ${enabledCount} bonus activés`);
    }

    // 5. Affichage du résultat attendu dans Give Unique
    console.log('\n🎁 RÉSULTAT DANS GIVE UNIQUE:\n');
    if (activeBonuses.length === 0) {
      console.log('❌ Aucun super bonus actif disponible.');
      console.log('💡 Astuce: Active des super bonus dans le panneau Super Admin pour pouvoir les envoyer.');
    } else {
      console.log(`✅ ${activeBonuses.length} super bonus seront affichés dans la liste Give Unique:`);
      activeBonuses.forEach((b, i) => {
        console.log(`   ${i + 1}. ${b.icon} ${b.name} (${b.rarity.toUpperCase()})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Test terminé\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

test();
