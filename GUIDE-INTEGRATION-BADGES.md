# 🏆 GUIDE D'INTÉGRATION DE NOUVEAUX BADGES

> **Date**: 2025-11-20
> **Version bot**: v1.6.0+
> **Maintenu par**: Claude (Sonnet 4.5)
>
> 📌 **IMPORTANT**: Ce fichier DOIT être mis à jour à chaque ajout de badge, comme CHANGELOG.md

---

## 🎯 PRINCIPE GÉNÉRAL

Le système de badges est conçu pour être **extensible et maintenable**. Chaque nouveau badge suit un processus standardisé en 4 étapes :

```
1. DÉFINITION     → Créer l'entrée du badge
2. SEEDING        → Ajouter le badge en base de données
3. TRACKING       → Implémenter la logique de progression
4. DOCUMENTATION  → Mettre à jour ce fichier
```

---

## 📁 ARCHITECTURE DU SYSTÈME

### Fichiers Clés

```
handlers/badgeHandler.js          # ✅ Logique centrale badges (550+ lignes)
utils/database-pg.js               # ✅ Méthodes DB (lignes 1973-2530)
database/migrations/               # ✅ Migration système badges
scripts/seed-super-bonus-badges.js # ✅ Exemple de seeding
views/profileView.js               # ✅ Affichage badges (lignes 803-983)
handlers/profileHandler.js         # ✅ Routing interactions (lignes 145-159, 551-699)
```

### Tables Base de Données

```sql
badges                # Définitions des badges (master list)
player_badges         # Badges débloqués par joueur
badge_progress        # Progression en temps réel
```

---

## 🔧 ÉTAPE 1: DÉFINIR LE BADGE

### 1.1 - Structure d'un Badge

```javascript
{
  code: 'UNIQUE_IDENTIFIER',           // Code unique (ex: 'VOYANT_DIVIN_APPRENTI')
  name: 'Nom du Badge',                // Nom affiché (ex: 'Voyant Divin')
  description: 'Description...',       // Description claire
  emoji: '👁️✨',                       // Emoji(s) représentatif
  color: '#9b59b6',                    // Couleur hex selon rareté
  rarity: 'epic',                      // common|uncommon|rare|epic|legendary|mythic
  category: 'super_bonus',             // Voir catégories ci-dessous
  condition_type: 'super_bonus_usage', // Type de condition
  condition_target: 'vision_divine',   // Cible spécifique (optionnel)
  condition_value: 10,                 // Seuil de déclenchement
  display_order: 1,                    // Ordre d'affichage (optionnel)
  is_secret: false                     // Badge secret (optionnel)
}
```

### 1.2 - Catégories Disponibles

```javascript
'super_bonus'   // Badges liés aux super bonus (Vision Divine, Jackpot, etc.)
'collection'    // Badges de progression collection (Débutant, Maître, etc.)
'rarity'        // Badges par rareté spécifique (Chasseur Légendaire, etc.)
'mystery_box'   // Badges ouverture de mystery boxes
'trap'          // Badges pièges (déclenchés, bloqués, survie)
'mission'       // Badges missions (complétées, approuvées, etc.)
'engagement'    // Badges fidélité/streaks (jours consécutifs)
'social'        // Badges partage/parrainage
'special'       // Badges spéciaux/events
```

### 1.3 - Types de Conditions

```javascript
'super_bonus_usage'   // Utiliser un super bonus X fois
'super_bonus_unlock'  // Débloquer un super bonus spécifique
'collectible_count'   // Collecter X collectibles
'rarity_collect'      // Collecter X items d'une rareté
'mystery_box_open'    // Ouvrir X mystery boxes
'trap_survive'        // Survivre à X pièges
'trap_block'          // Bloquer X pièges (via Bouclier)
'mission_complete'    // Compléter X missions
'login_streak'        // X jours consécutifs
'custom'              // Condition personnalisée
```

### 1.4 - Codes Couleur par Rareté

**IMPORTANT**: Respecter strictement ces codes pour cohérence visuelle :

```javascript
const RARITY_COLORS = {
  common: '#95a5a6',     // Gris/Blanc   ⚪
  uncommon: '#2ecc71',   // Vert         🟢
  rare: '#3498db',       // Bleu         🔵
  epic: '#9b59b6',       // Violet       🟣
  legendary: '#f39c12',  // Orange/Or    🟠
  mythic: '#e74c3c'      // Rouge/Rose   🔴
};
```

**Référence**: World of Warcraft, Diablo, Discord Nitro

---

## 🌱 ÉTAPE 2: SEEDING (AJOUTER EN BASE DE DONNÉES)

### 2.1 - Créer un Script de Seeding

**Template** (`scripts/seed-[category]-badges.js`):

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'botdb',
  user: 'botuser',
  password: 'Discord2025IA@Bot'
});

async function createBadge(badgeData) {
  const {
    code, name, description, emoji, color, rarity, category,
    condition_type, condition_target, condition_value,
    display_order = 0, is_secret = false
  } = badgeData;

  const result = await pool.query(`
    INSERT INTO badges (
      code, name, description, emoji, color, rarity, category,
      condition_type, condition_target, condition_value,
      display_order, is_secret
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      emoji = EXCLUDED.emoji
    RETURNING *
  `, [
    code, name, description, emoji, color, rarity, category,
    condition_type, condition_target, condition_value,
    display_order, is_secret
  ]);

  return result.rows[0];
}

async function seedBadges() {
  console.log('🏆 SEED: Badges [Catégorie]\n');
  console.log('═'.repeat(100));

  try {
    const badges = [
      // Vos badges ici
      {
        code: 'EXEMPLE_BADGE',
        name: 'Badge Exemple',
        description: 'Description du badge',
        emoji: '🎯',
        color: '#9b59b6',
        rarity: 'epic',
        category: 'super_bonus',
        condition_type: 'super_bonus_usage',
        condition_target: 'exemple_bonus',
        condition_value: 10
      }
    ];

    let created = 0;
    let updated = 0;

    for (const badge of badges) {
      try {
        const result = await createBadge(badge);
        if (result) {
          created++;
          console.log(`   ✅ ${badge.emoji} ${badge.name} (${badge.rarity})`);
        }
      } catch (error) {
        updated++;
        console.log(`   ⏭️  ${badge.emoji} ${badge.name} déjà existant`);
      }
    }

    console.log('\n' + '═'.repeat(100));
    console.log('✅ SEEDING TERMINÉ\n');
    console.log('📊 Résumé:');
    console.log(`   • Badges créés: ${created}`);
    console.log(`   • Badges mis à jour: ${updated}`);
    console.log(`   • Total: ${badges.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors du seeding:', error.message);
    console.error('\n📋 Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedBadges();
```

### 2.2 - Exécuter le Seeding

```bash
node scripts/seed-[category]-badges.js
```

**Vérifier** :

```javascript
// Créer un script de vérification
const db = require('./utils/database-pg');

async function verify() {
  const badges = await db.query(`
    SELECT code, name, rarity, category
    FROM badges
    WHERE category = $1
    ORDER BY display_order, rarity DESC
  `, ['votre_categorie']);

  console.table(badges);
  process.exit(0);
}

verify();
```

---

## 📊 ÉTAPE 3: TRACKING (IMPLÉMENTER LA PROGRESSION)

### 3.1 - Ajouter le Mapping dans badgeHandler.js

**Pour badges Super Bonus** (lignes 40-120):

```javascript
// handlers/badgeHandler.js

const SUPER_BONUS_TO_BADGE_MAP = {
  vision_divine: [
    { code: 'VOYANT_DIVIN_APPRENTI', threshold: 10 },
    { code: 'VOYANT_DIVIN_EXPERT', threshold: 50 },
    { code: 'VOYANT_DIVIN_MAITRE', threshold: 100 }
  ],

  // AJOUTER ICI VOTRE NOUVEAU SUPER BONUS
  nouveau_bonus: [
    { code: 'NOUVEAU_BADGE_TIER1', threshold: 5 },
    { code: 'NOUVEAU_BADGE_TIER2', threshold: 20 },
    { code: 'NOUVEAU_BADGE_TIER3', threshold: 50 }
  ]
};
```

**Pour badges Trap Block** (lignes 122-135):

```javascript
const TRAP_BLOCK_BADGES = [
  { code: 'BOUCLIER_NOVICE', threshold: 1 },
  { code: 'BOUCLIER_EXPERT', threshold: 25 },
  { code: 'BOUCLIER_LEGENDE', threshold: 50 },

  // AJOUTER ICI
  { code: 'NOUVEAU_TRAP_BADGE', threshold: 100 }
];
```

### 3.2 - Créer un Hook Fonction (si nouvelle catégorie)

**Template**:

```javascript
// handlers/badgeHandler.js

/**
 * 🎯 Hook: Quand [événement] se produit
 */
async function onNouvelEvenement(guildId, playerId, eventData, client = null) {
  try {
    console.log(`🏆 [BADGE] Tracking nouvel événement - Player: ${playerId}, Event: ${eventData}`);

    // Récupérer le compte actuel
    const eventCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM votre_table
      WHERE guild_id = $1 AND player_id = $2
    `, [guildId, playerId]);

    const totalEvents = eventCount ? parseInt(eventCount.count) : 0;

    // Liste des badges à vérifier
    const badgeList = [
      { code: 'BADGE_TIER1', threshold: 10 },
      { code: 'BADGE_TIER2', threshold: 50 },
      { code: 'BADGE_TIER3', threshold: 100 }
    ];

    // Mettre à jour la progression
    for (const badgeInfo of badgeList) {
      await updateBadgeProgress(guildId, playerId, badgeInfo.code, totalEvents, client);
    }

  } catch (error) {
    console.error(`🔴 Erreur onNouvelEvenement:`, error);
  }
}

// EXPORTER LA FONCTION
module.exports = {
  // ... exports existants
  onNouvelEvenement  // AJOUTER ICI
};
```

### 3.3 - Intégrer le Hook dans le Handler Concerné

**Exemple** (handlers/monHandler.js):

```javascript
const badgeHandler = require('./badgeHandler');

// Dans la fonction qui déclenche l'événement:
async function handleEvent(interaction, eventData) {
  // ... logique existante

  // 🏆 Tracking badge
  try {
    await badgeHandler.onNouvelEvenement(
      interaction.guildId,
      player.id,
      eventData,
      interaction.client
    );
  } catch (error) {
    console.error('🔴 Erreur tracking badge:', error);
  }
}
```

---

## ✅ ÉTAPE 4: DOCUMENTATION

### 4.1 - Mettre à Jour ce Fichier

Ajouter dans la section **[HISTORIQUE DES BADGES]** ci-dessous :

```markdown
### [Date] - [Catégorie] Badges

**Ajouté par**: [Votre nom]
**Badges créés**: [Nombre]
**Script**: `scripts/seed-[category]-badges.js`

| Code | Nom | Rareté | Condition |
|------|-----|--------|-----------|
| BADGE_CODE | Badge Name | epic | Description |

**Intégration**:
- Hook: `onNouvelEvenement()` dans badgeHandler.js
- Handler modifié: `handlers/monHandler.js` (ligne X)
- Tests: `scripts/test-[category]-badges.js`
```

### 4.2 - Mettre à Jour CHANGELOG.md

```markdown
## [Version]

### Added
- **[Badges]**: Nouveau système de badges [Catégorie]
  - Ajout de X badges pour [catégorie]
  - Hook `badgeHandler.onNouvelEvenement()`
  - Integration dans [handler]
  - Fichiers modifiés: handlers/badgeHandler.js, handlers/monHandler.js
  - Script de seed: scripts/seed-[category]-badges.js
```

---

## 📋 CHECKLIST COMPLÈTE

Avant de considérer le badge comme **terminé**, vérifier :

```
✅ Étape 1: Définition
  □ Code unique choisi (format: CATEGORY_NAME_TIER)
  □ Nom et description clairs
  □ Emoji et couleur selon rareté
  □ Catégorie et condition_type définis
  □ Seuil (condition_value) déterminé

✅ Étape 2: Seeding
  □ Script de seeding créé (scripts/seed-[category]-badges.js)
  □ Script exécuté sans erreur
  □ Badge visible dans la table `badges`
  □ Script de vérification exécuté

✅ Étape 3: Tracking
  □ Mapping ajouté dans badgeHandler.js
  □ Hook fonction créé (si nouvelle catégorie)
  □ Hook intégré dans le handler concerné
  □ Tests manuels effectués

✅ Étape 4: Documentation
  □ Ce fichier mis à jour (section Historique)
  □ CHANGELOG.md mis à jour
  □ Commentaires ajoutés dans le code
  □ Script de test E2E créé (optionnel)

✅ Validation Finale
  □ Badge s'affiche dans /profile → Badges
  □ Progression fonctionne correctement
  □ Déblocage automatique testé
  □ Notification DM reçue
  □ Badge visible dans leaderboard
```

---

## 🧪 TESTS E2E

### Template de Test

```javascript
// scripts/test-[category]-badge.js

const db = require('./utils/database-pg');

async function testBadge() {
  const GUILD_ID = process.env.GUILD_ID;
  const TEST_PLAYER_ID = 1; // Remplacer par ID réel

  console.log('🧪 TEST: Badge [Nom]');
  console.log('═'.repeat(80));

  try {
    // 1. Vérifier que le badge existe
    const badge = await db.getBadgeByCode('BADGE_CODE');
    console.log('\n✅ Badge trouvé:', badge.name);

    // 2. Simuler progression
    console.log('\n📊 Simulation progression...');
    for (let i = 1; i <= badge.condition_value; i++) {
      await db.incrementBadgeProgress(
        GUILD_ID,
        TEST_PLAYER_ID,
        badge.id,
        1,
        badge.condition_value
      );

      if (i % 10 === 0 || i === badge.condition_value) {
        const progress = await db.getBadgeProgress(GUILD_ID, TEST_PLAYER_ID, badge.id);
        console.log(`   Progression: ${i}/${badge.condition_value} (${progress?.percentage || 0}%)`);
      }
    }

    // 3. Vérifier déblocage
    const unlocked = await db.playerHasBadge(GUILD_ID, TEST_PLAYER_ID, badge.id);
    console.log(`\n${unlocked ? '✅' : '❌'} Badge débloqué: ${unlocked}`);

    // 4. Vérifier suppression progression
    const remainingProgress = await db.getBadgeProgress(GUILD_ID, TEST_PLAYER_ID, badge.id);
    console.log(`${!remainingProgress ? '✅' : '❌'} Progression supprimée: ${!remainingProgress}`);

    console.log('\n' + '═'.repeat(80));
    console.log('✅ TEST TERMINÉ\n');

  } catch (error) {
    console.error('❌ Erreur test:', error);
  }

  process.exit(0);
}

testBadge();
```

---

## 🎨 BONNES PRATIQUES

### Nommage des Codes

```
Format: CATEGORY_NAME_TIER

Exemples:
✅ VOYANT_DIVIN_APPRENTI
✅ BOUCLIER_EXPERT
✅ JACKPOT_ROI
✅ COLLECTION_MAITRE

❌ voyant_apprenti (manque catégorie)
❌ VoyantDivinApprenti (camelCase)
❌ vision_divine_10 (nombre dans le nom)
```

### Tiers Progressifs

Pour badges évolutifs, utiliser :

```
Tier 1: APPRENTI / NOVICE / DEBUTANT (seuil bas: 1-10)
Tier 2: EXPERT / AVANCE / PRO (seuil moyen: 25-50)
Tier 3: MAITRE / LEGENDE / ROI (seuil haut: 50-100+)
```

### Emojis Composés

```
✅ 👁️✨ (Vision + Magie)
✅ 🛡️⚡ (Bouclier + Puissance)
✅ 💰👑 (Richesse + Royauté)
✅ 🧲💎 (Aimant + Diamant)

❌ 👁 (emoji seul)
❌ ✨✨✨ (répétition)
```

### Performance

```javascript
// ✅ CORRECT - Batch update
const promises = badges.map(badge =>
  db.incrementBadgeProgress(guildId, playerId, badge.code, 1)
);
await Promise.all(promises);

// ❌ INCORRECT - Sequential
for (const badge of badges) {
  await db.incrementBadgeProgress(guildId, playerId, badge.code, 1);
}
```

---

## 🔍 DEBUGGING

### Vérifier un Badge Spécifique

```javascript
const db = require('./utils/database-pg');

async function debug() {
  const badge = await db.getBadgeByCode('BADGE_CODE');
  console.log('Badge:', badge);

  const progress = await db.query(`
    SELECT * FROM badge_progress
    WHERE badge_id = $1
  `, [badge.id]);
  console.log('Progressions:', progress);

  const unlocks = await db.query(`
    SELECT * FROM player_badges
    WHERE badge_id = $1
  `, [badge.id]);
  console.log('Débloqués:', unlocks);

  process.exit(0);
}

debug();
```

### Logs de Tracking

```javascript
// Activer logs détaillés dans badgeHandler.js
console.log(`🏆 [BADGE] Checking ${badgeCode}`);
console.log(`   Current: ${currentValue}/${targetValue}`);
console.log(`   Percentage: ${percentage}%`);
console.log(`   Should unlock: ${currentValue >= targetValue}`);
```

---

## 📚 RESSOURCES

### Fichiers de Référence

- [SYSTEME-BADGES-COMPLET-2025.md](SYSTEME-BADGES-COMPLET-2025.md) - Spécification complète
- [handlers/badgeHandler.js](handlers/badgeHandler.js) - Logique centrale
- [scripts/seed-super-bonus-badges.js](scripts/seed-super-bonus-badges.js) - Exemple de seeding
- [CLAUDE.md](.claude/CLAUDE.md) - Directives projet

### Base de Données

```sql
-- Voir tous les badges
SELECT * FROM badges ORDER BY category, display_order;

-- Badges par catégorie
SELECT category, COUNT(*) as total
FROM badges
GROUP BY category;

-- Badges les plus débloqués
SELECT b.name, COUNT(*) as unlocks
FROM player_badges pb
JOIN badges b ON pb.badge_id = b.id
GROUP BY b.id, b.name
ORDER BY unlocks DESC;

-- Progression moyenne par badge
SELECT b.name, AVG(bp.percentage) as avg_progress
FROM badge_progress bp
JOIN badges b ON bp.badge_id = b.id
GROUP BY b.id, b.name;
```

---

## 📊 HISTORIQUE DES BADGES

### 2025-11-20 - Super Bonus Badges (Sprint 1)

**Ajouté par**: Claude (Sonnet 4.5)
**Badges créés**: 13
**Script**: `scripts/seed-super-bonus-badges.js`

| Code | Nom | Rareté | Condition |
|------|-----|--------|-----------|
| VOYANT_DIVIN_APPRENTI | Voyant Divin | epic | Utiliser Vision Divine 10x |
| VOYANT_DIVIN_EXPERT | Expert Vision | epic | Utiliser Vision Divine 50x |
| VOYANT_DIVIN_MAITRE | Maître Vision | legendary | Utiliser Vision Divine 100x |
| BOUCLIER_NOVICE | Gardien Novice | rare | Bloquer 1 piège |
| BOUCLIER_EXPERT | Défenseur Aguerri | epic | Bloquer 25 pièges |
| BOUCLIER_LEGENDE | Indestructible | legendary | Bloquer 50 pièges |
| JACKPOT_CHANCEUX | Coup de Chance | epic | Obtenir 10 jackpots x2 |
| JACKPOT_FORTUNE | Machine à Gains | epic | Obtenir 30 jackpots x2 |
| JACKPOT_ROI | Roi du Jackpot | legendary | Obtenir 50 jackpots x2 |
| AIMANT_DEBUTANT | Attraction Magique | epic | 5 légendaires via Aimant |
| AIMANT_COLLECTIONNEUR | Collectionneur Légendaire | legendary | 15 légendaires via Aimant |
| AIMANT_MAITRE | Maître de l'Aimant | mythic | 30 légendaires via Aimant |
| SUPER_BONUS_COLLECTIONNEUR | Collectionneur de Super Bonus | legendary | Utiliser tous les types |

**Intégration**:

- Hooks: `onSuperBonusUsed()`, `onTrapBlocked()` dans badgeHandler.js
- Handlers modifiés: superBonusHandler.js (lignes 9, 1042-1069), mysteryBoxHandler.js (lignes 6, 927-932)
- Vue /profile: profileView.js (lignes 803-983), profileHandler.js (lignes 145-159, 551-699)
- Tests: ⏳ À créer

### 2025-11-20 - Sprint 2: Badges Progression & Engagement

**Ajouté par**: Claude (Sonnet 4.5)
**Badges créés**: 24 (5 catégories)

**Scripts**:

- `scripts/seed-collection-badges.js`
- `scripts/seed-mission-badges.js`
- `scripts/seed-mystery-box-badges.js`
- `scripts/seed-trap-survival-badges.js`
- `scripts/seed-engagement-badges.js`

#### Collection (6 badges)

| Code | Nom | Rareté | Condition |
|------|-----|--------|-----------|
| COLLECTION_DEBUTANT | Débutant | common | 1 collectible |
| COLLECTION_COLLECTIONNEUR | Collectionneur | rare | 10 collectibles |
| COLLECTION_CHASSEUR | Chasseur | epic | 50 collectibles |
| COLLECTION_EXPERT | Expert | epic | 100 collectibles |
| COLLECTION_MAITRE | Maître Collectionneur | legendary | 250 collectibles |
| COLLECTION_LEGENDE | Légende | mythic | 500 collectibles |

#### Mission (4 badges)

| Code | Nom | Rareté | Condition |
|------|-----|--------|-----------|
| MISSION_APPRENTI | Apprenti | common | 1 mission complétée |
| MISSION_MISSIONNAIRE | Missionnaire | rare | 10 missions |
| MISSION_CHAMPION | Champion | epic | 50 missions |
| MISSION_GRAND_MAITRE | Grand Maître | legendary | 100 missions |

#### Mystery Box (4 badges)

| Code | Nom | Rareté | Condition |
|------|-----|--------|-----------|
| MYSTERY_CHANCEUX | Chanceux | rare | 10 mystery boxes ouvertes |
| MYSTERY_CHASSEUR | Chasseur de Trésors | epic | 50 mystery boxes |
| MYSTERY_MAITRE | Maître des Mystères | epic | 100 mystery boxes |
| MYSTERY_LEGENDE | Légende des Coffres | legendary | 250 mystery boxes |

#### Trap & Survie (5 badges)

| Code | Nom | Rareté | Condition |
|------|-----|--------|-----------|
| TRAP_SURVIVOR | Survivant | uncommon | 1 piège survécu |
| TRAP_RESILIENT | Résilient | rare | 10 pièges survécus |
| TRAP_VETERAN | Vétéran du Danger | epic | 50 pièges survécus |
| TRAP_MASTER | Maître de la Survie | epic | 100 pièges survécus |
| TRAP_IMMORTAL | Immortel | legendary | 250 pièges survécus |

#### Engagement (5 badges)

| Code | Nom | Rareté | Condition |
|------|-----|--------|-----------|
| ENGAGEMENT_ACTIF | Actif | uncommon | 3 jours consécutifs |
| ENGAGEMENT_ASSIDU | Assidu | rare | 7 jours consécutifs |
| ENGAGEMENT_DEVOU | Dévoué | epic | 14 jours consécutifs |
| ENGAGEMENT_MARATHONIEN | Marathonien | legendary | 30 jours consécutifs |
| ENGAGEMENT_ETERNEL | Éternel | mythic | 90 jours consécutifs |

**Intégration**:

- Hooks: `onCollectibleFound()`, `onMissionCompleted()`, `onMysteryBoxOpened()`, `onTrapSurvived()`, `onLoginStreak()` dans badgeHandler.js (lignes 695-742)
- Fonctions de check: `checkCollectibleCountBadges()`, `checkMissionCompleteBadges()`, `checkMysteryBoxOpenBadges()`, `checkTrapSurviveBadges()`, `checkLoginStreakBadges()` (lignes 355-488)
- Mappings: COLLECTION_BADGES, MISSION_BADGES, MYSTERY_BOX_BADGES, TRAP_SURVIVE_BADGES, ENGAGEMENT_BADGES (lignes 100-151)
- Handlers modifiés:
  - mysteryBoxHandler.js (lignes 578-584, 806-812, 1026-1032)
  - missionHandler.js (ligne 4, lignes 646-652)
- Tests E2E: ✅ `scripts/test-badges-e2e.js` (19/19 badges testés avec succès)
- Bugs fixés:
  - checkMysteryBoxOpenBadges: Correction requête give_logs (winner_id au lieu de player_id)
  - collections: Contrainte source_check (utilisation de 'give', 'mission', 'mystery_box')

---

**Dernière mise à jour**: 2025-11-20
**Maintenu par**: Claude (Sonnet 4.5)
**Version bot**: v1.6.0+
