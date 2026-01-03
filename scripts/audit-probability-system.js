/**
 * AUDIT COMPLET - Système de Probabilités et Pièges
 * Date: 2024-12-14
 */

const db = require('../utils/database-pg');

async function audit() {
  console.log('='.repeat(80));
  console.log('🔍 AUDIT COMPLET - SYSTÈME DE PROBABILITÉS ET PIÈGES');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================
  // 1. STRUCTURE DE LA TABLE rarity_probabilities
  // ============================================================
  console.log('📊 1. TABLE rarity_probabilities');
  console.log('-'.repeat(60));

  const rarityColumns = await db.queryAll(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'rarity_probabilities'
    ORDER BY ordinal_position
  `);
  console.table(rarityColumns);

  const rarityData = await db.queryAll(`
    SELECT rp.*, t.name as theme_name
    FROM rarity_probabilities rp
    LEFT JOIN themes t ON rp.theme_id = t.id
    ORDER BY rp.guild_id, rp.theme_id
    LIMIT 20
  `);
  console.log('\n📋 Données actuelles (max 20):');
  console.table(rarityData);

  // ============================================================
  // 2. STRUCTURE DE LA TABLE collectibles
  // ============================================================
  console.log('\n📊 2. TABLE collectibles');
  console.log('-'.repeat(60));

  const collectibleColumns = await db.queryAll(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'collectibles'
    ORDER BY ordinal_position
  `);
  console.table(collectibleColumns);

  // Contraintes CHECK sur rarity
  const rarityConstraints = await db.queryAll(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'collectibles'::regclass AND contype = 'c'
  `);
  console.log('\n🔒 Contraintes CHECK:');
  console.table(rarityConstraints);

  // Distribution par rareté
  const rarityDistribution = await db.queryAll(`
    SELECT rarity, COUNT(*) as count
    FROM collectibles
    GROUP BY rarity
    ORDER BY
      CASE rarity
        WHEN 'common' THEN 1
        WHEN 'rare' THEN 2
        WHEN 'epic' THEN 3
        WHEN 'legendary' THEN 4
        WHEN 'mythic' THEN 5
      END
  `);
  console.log('\n📈 Distribution des collectibles par rareté:');
  console.table(rarityDistribution);

  // ============================================================
  // 3. STRUCTURE DE LA TABLE traps
  // ============================================================
  console.log('\n📊 3. TABLE traps');
  console.log('-'.repeat(60));

  const trapColumns = await db.queryAll(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'traps'
    ORDER BY ordinal_position
  `);
  console.table(trapColumns);

  // Contraintes CHECK sur type
  const trapConstraints = await db.queryAll(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'traps'::regclass AND contype = 'c'
  `);
  console.log('\n🔒 Contraintes CHECK:');
  console.table(trapConstraints);

  // Distribution par type
  const trapDistribution = await db.queryAll(`
    SELECT type, COUNT(*) as count,
           SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_count
    FROM traps
    GROUP BY type
    ORDER BY type
  `);
  console.log('\n📈 Distribution des pièges par type:');
  console.table(trapDistribution);

  // Liste des pièges avec leurs caractéristiques
  const trapsList = await db.queryAll(`
    SELECT t.id, t.name, t.type, t.removes_collectible, t.malus_points,
           t.cooldown_duration, t.is_active, th.name as theme_name
    FROM traps t
    LEFT JOIN themes th ON t.theme_id = th.id
    ORDER BY t.theme_id, t.type, t.name
    LIMIT 30
  `);
  console.log('\n📋 Liste des pièges (max 30):');
  console.table(trapsList);

  // ============================================================
  // 4. ANALYSE DU CODE - mysteryBoxHandler
  // ============================================================
  console.log('\n📊 4. ANALYSE LOGIQUE DE SÉLECTION');
  console.log('-'.repeat(60));

  console.log(`
📍 SYSTÈME ACTUEL DE PROBABILITÉS (collectibles):
   - Table: rarity_probabilities
   - Colonnes: guild_id, theme_id, common, rare, epic, legendary, mythic
   - Les valeurs sont des pourcentages (ex: common=50, rare=30, epic=15, legendary=4, mythic=1)
   - Total doit faire 100%

📍 SYSTÈME ACTUEL DE PIÈGES:
   - Table: traps
   - Sélection: RANDOM parmi les pièges actifs du thème
   - Aucune colonne de probabilité/poids
   - Tous les pièges ont la même chance d'être sélectionnés

📍 DIFFÉRENCES CLÉS:
   ┌─────────────────────┬──────────────────────┬──────────────────────┐
   │ Aspect              │ Collectibles         │ Pièges               │
   ├─────────────────────┼──────────────────────┼──────────────────────┤
   │ Probabilité         │ ✅ Par rareté        │ ❌ Équiprobable      │
   │ Table config        │ rarity_probabilities │ (aucune)             │
   │ Granularité         │ Par thème/serveur    │ N/A                  │
   │ Algorithme          │ Tirage pondéré       │ Math.random()        │
   └─────────────────────┴──────────────────────┴──────────────────────┘
  `);

  // ============================================================
  // 5. PROPOSITION D'ARCHITECTURE
  // ============================================================
  console.log('\n📊 5. PROPOSITION D\'ARCHITECTURE');
  console.log('-'.repeat(60));

  console.log(`
🎯 OPTION A: Ajouter une colonne 'probability' à la table traps
   - Simple: ALTER TABLE traps ADD COLUMN probability INTEGER DEFAULT 50;
   - Chaque piège a sa propre probabilité (1-100)
   - Algorithme: tirage pondéré comme pour les raretés

🎯 OPTION B: Créer un système de sévérité avec table dédiée
   - Nouvelle table: trap_probabilities (guild_id, theme_id, severity_1...severity_5)
   - Ajouter colonne 'severity' (1-5) à la table traps
   - Plus flexible, cohérent avec rarity_probabilities

🎯 OPTION C: Réutiliser le système de rareté existant
   - Ajouter colonne 'rarity' à la table traps (common, rare, epic, legendary, mythic)
   - Réutiliser rarity_probabilities ou créer trap_probabilities similaire
   - Cohérence maximale avec le système existant
  `);

  console.log('\n' + '='.repeat(80));
  console.log('✅ AUDIT TERMINÉ');
  console.log('='.repeat(80));

  process.exit(0);
}

audit().catch(e => {
  console.error('❌ Erreur:', e);
  process.exit(1);
});
