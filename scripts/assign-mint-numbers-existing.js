/**
 * Script pour attribuer les mint numbers aux collectibles existants
 * Basé sur la date d'obtention (collected_at) - les premiers collecteurs ont les mint les plus bas
 */

require('dotenv').config();
const db = require('../utils/database-pg');

async function assignMintNumbers() {
  console.log('🔢 Attribution des mint numbers aux collectibles existants...\n');
  console.log('='.repeat(70));

  try {
    // 1. Récupérer tous les collectibles uniques qui ont des collections sans mint
    const collectiblesWithoutMint = await db.queryAll(`
      SELECT DISTINCT c.collectible_id, col.name, c.guild_id
      FROM collections c
      JOIN collectibles col ON c.collectible_id = col.id
      WHERE c.mint_number IS NULL
      ORDER BY c.guild_id, c.collectible_id
    `);

    console.log(`\n📊 ${collectiblesWithoutMint.length} collectibles différents n'ont pas de mint attribué\n`);

    let totalUpdated = 0;
    let totalCollectibles = 0;

    // 2. Pour chaque collectible, attribuer les mint en ordre chronologique
    for (const item of collectiblesWithoutMint) {
      // Récupérer toutes les collections de ce collectible, triées par date
      const collections = await db.queryAll(`
        SELECT c.id, c.player_id, c.collected_at, p.username
        FROM collections c
        JOIN players p ON c.player_id = p.id
        WHERE c.collectible_id = $1 AND c.guild_id = $2 AND c.mint_number IS NULL
        ORDER BY c.collected_at ASC
      `, [item.collectible_id, item.guild_id]);

      if (collections.length === 0) continue;

      // Récupérer le dernier mint attribué pour ce collectible
      const lastMint = await db.queryOne(`
        SELECT COALESCE(MAX(mint_number), 0) as last_mint
        FROM collections
        WHERE collectible_id = $1 AND guild_id = $2
      `, [item.collectible_id, item.guild_id]);

      let currentMint = lastMint.last_mint;

      console.log(`\n📦 ${item.name} (ID: ${item.collectible_id}) - ${collections.length} collection(s) à traiter`);
      console.log(`   Dernier mint existant: #${currentMint}`);

      // Attribuer les mint en ordre chronologique
      for (const col of collections) {
        currentMint++;

        await db.query(`
          UPDATE collections
          SET mint_number = $1
          WHERE id = $2
        `, [currentMint, col.id]);

        const date = new Date(col.collected_at).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        console.log(`   ✅ Mint #${currentMint} → ${col.username} (collecté le ${date})`);
        totalUpdated++;
      }

      // Mettre à jour le compteur de mint
      await db.query(`
        INSERT INTO collectible_mint_counter (guild_id, collectible_id, current_mint)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, collectible_id)
        DO UPDATE SET current_mint = GREATEST(collectible_mint_counter.current_mint, $3)
      `, [item.guild_id, item.collectible_id, currentMint]);

      totalCollectibles++;
    }

    console.log('\n' + '='.repeat(70));
    console.log(`\n✅ Migration terminée !`);
    console.log(`   📦 ${totalCollectibles} collectibles traités`);
    console.log(`   🔢 ${totalUpdated} mint numbers attribués`);

    // Vérification finale
    const remaining = await db.queryOne(`
      SELECT COUNT(*) as count FROM collections WHERE mint_number IS NULL
    `);

    console.log(`\n📊 Collections sans mint restantes: ${remaining.count}`);

  } catch (error) {
    console.error('🔴 Erreur:', error);
  }

  process.exit(0);
}

assignMintNumbers();
