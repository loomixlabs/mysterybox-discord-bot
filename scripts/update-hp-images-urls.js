/**
 * Script pour mettre à jour les URLs des images HP dans la base de données
 * Les images sont servies depuis le VPS via nginx sur le port 8080
 */

const BASE_URL = 'http://72.60.185.62:8080/hp-images';
const HP_GUILD_ID = '1182395170273099806';
const HP_THEME_ID = 65; // Harry Potter theme

// Mapping collectibles: nom -> filename
const COLLECTIBLES = [
  { name: 'Baguette de Sureau', file: 'Gemini_Generated_Image_iv93dwiv93dwiv93.png' },
  { name: 'Pierre de Résurrection', file: 'Gemini_Generated_Image_uhpkuwuhpkuwuhpk.png' },
  { name: "Cape d'Invisibilité", file: 'Gemini_Generated_Image_fxd6y9fxd6y9fxd6.png' },
  { name: 'Carte du Maraudeur', file: 'Gemini_Generated_Image_a1oyxba1oyxba1oy.png' },
  { name: 'Éclair de Feu', file: 'Gemini_Generated_Image_dnfeykdnfeykdnfe.png' },
  { name: 'Choixpeau Magique', file: 'Gemini_Generated_Image_2814ve2814ve2814.png' },
  { name: 'Pensine', file: 'Gemini_Generated_Image_joh5tqjoh5tqjoh5.png' },
  { name: 'Retourneur de Temps', file: 'Gemini_Generated_Image_iq9ohciq9ohciq9o.png' },
  { name: 'Baguette Plume de Phénix', file: 'Gemini_Generated_Image_b0mjh3b0mjh3b0mj.png' },
  { name: 'Nimbus 2000', file: 'Gemini_Generated_Image_pp23x8pp23x8pp23.png' },
  { name: "Vif d'Or", file: 'Gemini_Generated_Image_1xagb31xagb31xag.png' },
  { name: 'Orbe de Prophétie', file: 'Gemini_Generated_Image_3yzvf33yzvf33yzv.png' },
  { name: 'Déluminateur', file: 'Gemini_Generated_Image_rxu8icrxu8icrxu8.png' },
  { name: 'Miroir du Riséd', file: 'Gemini_Generated_Image_k1yep9k1yep9k1ye.png' },
  { name: 'Lettre de Poudlard', file: 'Gemini_Generated_Image_q9c1mq9c1mq9c1mq.png' },
  { name: 'Écharpe Gryffondor', file: 'Gemini_Generated_Image_hjmbwphjmbwphjmb.png' },
  { name: 'Écharpe Serpentard', file: 'Gemini_Generated_Image_k7kaqlk7kaqlk7ka.png' },
  { name: 'Écharpe Serdaigle', file: 'Gemini_Generated_Image_oz3nbuoz3nbuoz3n.png' },
  { name: 'Écharpe Poufsouffle', file: 'Gemini_Generated_Image_m51ok1m51ok1m51o.png' },
  { name: 'Chocogrenouille', file: 'Gemini_Generated_Image_8ba9748ba9748ba9.png' },
  { name: 'Dragées Bertie Crochue', file: 'Gemini_Generated_Image_s0i84hs0i84hs0i8.png' },
  { name: 'Plume Magique', file: 'Gemini_Generated_Image_6me32z6me32z6me3%20(1).png' } // URL encoded space
];

// Mapping pièges: id -> filename
const TRAPS = [
  { id: 165, name: 'Baiser du Détraqueur', file: 'Gemini_Generated_Image_awr4tkawr4tkawr4.png' },
  { id: 167, name: "Sortilège d'Oubliettes", file: 'Gemini_Generated_Image_fng8o1fng8o1fng8.png' },
  { id: 168, name: 'Petrificus Totalus', file: 'Gemini_Generated_Image_bvo5ocbvo5ocbvo5.png' },
  { id: 189, name: 'Avada Kedavra', file: 'Gemini_Generated_Image_n2lh7ln2lh7ln2lh.png' },
  { id: 166, name: 'Maléfice de Chauve-Furie', file: 'Gemini_Generated_Image_xlq5okxlq5okxlq5.png' },
  { id: 190, name: 'Beuglante de Molly', file: 'Gemini_Generated_Image_kpm3obkpm3obkpm3.png' }
];

async function updateHPImages() {
  const { Pool } = require('pg');

  // Utiliser DATABASE_URL si disponible (Docker), sinon fallback local
  const connectionString = process.env.DATABASE_URL;

  const pool = connectionString
    ? new Pool({ connectionString })
    : new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'botdb',
        user: process.env.DB_USER || 'botuser',
        password: process.env.DB_PASSWORD || 'Discord2025IA@Bot'
      });

  console.log('='.repeat(60));
  console.log('🪄 MISE À JOUR DES IMAGES HARRY POTTER');
  console.log('='.repeat(60));
  console.log(`\n📍 Base URL: ${BASE_URL}`);
  console.log(`📍 Guild ID: ${HP_GUILD_ID}`);
  console.log(`📍 Theme ID: ${HP_THEME_ID}\n`);

  try {
    // 1. Mise à jour des collectibles
    console.log('📦 MISE À JOUR DES COLLECTIBLES...\n');

    for (const item of COLLECTIBLES) {
      const imageUrl = `${BASE_URL}/${item.file}`;
      const result = await pool.query(
        `UPDATE collectibles
         SET image_url = $1
         WHERE name = $2 AND guild_id = $3 AND theme_id = $4
         RETURNING id, name`,
        [imageUrl, item.name, HP_GUILD_ID, HP_THEME_ID]
      );

      if (result.rowCount > 0) {
        console.log(`   ✅ ${item.name} → image mise à jour`);
      } else {
        console.log(`   ⚠️ ${item.name} → NON TROUVÉ`);
      }
    }

    // 2. Mise à jour des pièges
    console.log('\n⚠️ MISE À JOUR DES PIÈGES...\n');

    for (const trap of TRAPS) {
      const imageUrl = `${BASE_URL}/${trap.file}`;
      const result = await pool.query(
        `UPDATE traps
         SET image_url = $1
         WHERE id = $2 AND guild_id = $3
         RETURNING id, name`,
        [imageUrl, trap.id, HP_GUILD_ID]
      );

      if (result.rowCount > 0) {
        console.log(`   ✅ ${trap.name} (ID: ${trap.id}) → image mise à jour`);
      } else {
        console.log(`   ⚠️ ${trap.name} (ID: ${trap.id}) → NON TROUVÉ`);
      }
    }

    // 3. Vérification
    console.log('\n📊 VÉRIFICATION...\n');

    const collectiblesCheck = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN image_url LIKE '%72.60.185.62%' THEN 1 END) as updated
       FROM collectibles
       WHERE guild_id = $1 AND theme_id = $2`,
      [HP_GUILD_ID, HP_THEME_ID]
    );

    const trapsCheck = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN image_url LIKE '%72.60.185.62%' THEN 1 END) as updated
       FROM traps
       WHERE guild_id = $1 AND theme_id = $2`,
      [HP_GUILD_ID, HP_THEME_ID]
    );

    console.log(`   Collectibles: ${collectiblesCheck.rows[0].updated}/${collectiblesCheck.rows[0].total} mis à jour`);
    console.log(`   Pièges: ${trapsCheck.rows[0].updated}/${trapsCheck.rows[0].total} mis à jour`);

    console.log('\n✅ Mise à jour terminée !');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await pool.end();
  }
}

// Charger les variables d'environnement
require('dotenv').config();

updateHPImages();
