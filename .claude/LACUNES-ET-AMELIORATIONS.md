# ⚠️ LACUNES RÉCURRENTES & PRÉVENTION

> **Ajouté**: 2025-11-18 après analyse complète des conversations depuis le début du projet
>
> Cette documentation identifie les 7 lacunes principales qui ont fait perdre du temps et comment les éviter définitivement.

---

## 🎯 Vue d'Ensemble

| Lacune | Gravité | Fréquence | Impact Temps |
|--------|---------|-----------|--------------|
| #1 - Modif DB sans consulter schéma | 🔴 CRITIQUE | 15% | 2-4h perdues |
| #2 - Oubli `guild_id` (multi-serveur) | 🔴 CRITIQUE | 25% | 1-3h + bug prod |
| #3 - Interaction timeout (10062) | 🟠 ÉLEVÉ | 35% | 1-2h |
| #4 - Routing incomplet | 🟠 ÉLEVÉ | 10% | 1-2h |
| #5 - Sous-estimation travail | 🟡 MOYEN | 20% | 30min-1h |
| #6 - Tests E2E manquants | 🟡 MOYEN | 40% | Bugs tardifs |
| #7 - Documentation tardive | 🟡 MOYEN | 30% | Perte contexte |

**Total temps perdu estimé par session**: 4-8 heures en moyenne

---

## 🔴 LACUNE #1: Modification DB sans Consultation Schéma

### Problème Concret

**Session du 2025-11-06**:
- Implémentation toggles pour 5 nouveaux types de missions dans UI admin
- UI ne changeait pas d'état (⬜ restait ⬜ au lieu de ✅)
- **Cause**: Colonnes `mission_started`, `mission_completed`, `mission_failed`, `mission_approved`, `mission_rejected` n'existaient PAS dans `announcement_settings`
- Seule `mission_word_guessed` existait
- **Temps perdu**: 2-3h de debug + migration DB

### Cause Racine

1. ❌ Pas de vérification préalable structure DB
2. ❌ Supposition que colonnes existent
3. ❌ Focus uniquement sur le code UI

### Solution OBLIGATOIRE

```markdown
✅ WORKFLOW SYSTÉMATIQUE - Modification DB

AVANT toute modification impliquant la DB:

1. **Lire DATABASE-SCHEMA.md** pour la table concernée
   - Vérifier TOUTES les colonnes mentionnées dans le code
   - Noter les contraintes (CHECK, UNIQUE, FK)
   - Vérifier types de données

2. **Créer script Node.js de vérification**
   ```bash
   node scripts/check-table-structure.js
   ```

3. **SI colonnes manquantes**:
   - Créer migration SQL versionnée
   - Créer script Node.js d'exécution
   - Tester sur DB locale
   - Vérifier avec script de validation

4. **Seulement APRÈS**: Implémenter l'UI
```

### Checklist Préventive

```
□ J'ai lu DATABASE-SCHEMA.md pour cette table
□ J'ai vérifié que TOUTES les colonnes existent
□ Si migration nécessaire, fichier SQL versionné créé
□ Script Node.js de vérification créé
□ Migration testée localement
□ Vérification post-migration exécutée
```

### Template Script Vérification

```javascript
// scripts/check-my-table.js
const db = require('../utils/database-pg');

async function checkTable() {
  console.log('🔍 Vérification structure my_table\n');

  // Vérifier colonnes
  const columns = await db.queryAll(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'my_table'
    ORDER BY ordinal_position
  `);

  const required = ['col1', 'col2', 'col3'];
  const existing = columns.map(c => c.column_name);

  const missing = required.filter(r => !existing.includes(r));

  if (missing.length > 0) {
    console.error('❌ Colonnes manquantes:', missing);
    process.exit(1);
  }

  console.log('✅ Toutes les colonnes existent!');
  console.table(columns);
  process.exit(0);
}

checkTable();
```

---

## 🔴 LACUNE #2: Oubli `guild_id` - Bug Multi-Serveur CRITIQUE

### Problème Concret

**Session du 2025-11-18 (v1.4.1)**:
- 3 fonctions dans `handlers/superBonusHandler.js` manquaient `WHERE guild_id = $X`
- `handleEditBonusDurationHours()` - ligne 536
- `handleEditBonusDurationDays()` - ligne 585
- `handleEditBonusDurationCharges()` - ligne 634
- **Conséquence**: Modification durée/charges d'un bonus s'appliquait sur TOUS les serveurs
- **Gravité**: BUG CRITIQUE de sécurité/isolation

### Code Problématique

```javascript
// ❌ INCORRECT - DANGEREUX
const bonus = await db.queryOne(
  'SELECT * FROM super_bonuses WHERE id = $1',
  [parseInt(bonusId)]
);

await db.query(
  'UPDATE super_bonuses SET duration_value = $1 WHERE id = $2',
  [totalSeconds, parseInt(bonusId)]
);
```

### Code Corrigé

```javascript
// ✅ CORRECT - Isolation par serveur
const guildId = interaction.guildId;

const bonus = await db.queryOne(
  'SELECT * FROM super_bonuses WHERE id = $1 AND guild_id = $2',
  [parseInt(bonusId), guildId]
);

await db.query(
  'UPDATE super_bonuses SET duration_value = $1 WHERE id = $2 AND guild_id = $3',
  [totalSeconds, parseInt(bonusId), guildId]
);
```

### Cause Racine

1. ❌ Focus sur la logique métier, oubli architecture multi-serveur
2. ❌ Copier-coller de requêtes sans vérification guild_id
3. ❌ Pas de pattern de code standardisé

### Solution OBLIGATOIRE

```javascript
// ===== PATTERN UNIVERSEL - TOUJOURS SUIVRE =====

async function anyHandler(interaction) {
  // 🎯 LIGNE 1: Extraire guild_id IMMÉDIATEMENT
  const guildId = interaction.guildId;

  // ✅ SELECT: guild_id dans WHERE
  const data = await db.queryOne(`
    SELECT * FROM table_name
    WHERE id = $1 AND guild_id = $2
  `, [id, guildId]);

  // ✅ UPDATE: guild_id dans WHERE
  await db.query(`
    UPDATE table_name
    SET field = $1
    WHERE id = $2 AND guild_id = $3
  `, [value, id, guildId]);

  // ✅ INSERT: guild_id dans VALUES
  await db.query(`
    INSERT INTO table_name (guild_id, field)
    VALUES ($1, $2)
  `, [guildId, value]);

  // ✅ DELETE: guild_id dans WHERE
  await db.query(`
    DELETE FROM table_name
    WHERE id = $1 AND guild_id = $2
  `, [id, guildId]);
}
```

### Checklist Préventive

```
□ guildId extrait en PREMIÈRE ligne: const guildId = interaction.guildId
□ Toutes les requêtes SELECT incluent WHERE guild_id = $X
□ Toutes les requêtes UPDATE incluent WHERE guild_id = $X
□ Toutes les requêtes DELETE incluent WHERE guild_id = $X
□ Toutes les requêtes INSERT incluent guild_id dans VALUES
□ Aucune table métier n'est interrogée sans guild_id
```

### Exceptions (Tables SANS guild_id)

- `super_admins` - Accès global multi-serveur
- `colors` - Palette de couleurs partagée

---

## 🟠 LACUNE #3: Interaction Discord Timeout (Code 10062)

### Problème Concret

**Session du 2025-11-08**:
- 6 handlers manquaient `await interaction.deferUpdate()` en première ligne
- Erreur "Unknown interaction" après 3 secondes
- Flow: User click → Handler query DB (2-3s) → **TIMEOUT** → Erreur 10062

**Handlers affectés**:
- `handleGiveUniqueModeSelect()` - ligne 117
- `handleGiveUniqueChannelRandom()` - ligne 452
- `handleGiveUniqueChannelSpecific()` - ligne 465
- `handleGiveUniqueChannelsSelect()` - ligne 533
- `handleGiveUniqueLaunch()` - ligne 684
- `handleGiveUniqueAnnouncementModal()` - ligne 867

**Temps perdu**: 2h de debug

### Cause Racine

1. ❌ Méconnaissance de la limite Discord (3 secondes max)
2. ❌ DB queries ou calculs AVANT de déférer
3. ❌ Pas de pattern systématique

### Solution OBLIGATOIRE

```javascript
// ✅ PATTERN BOUTON/SELECT MENU

async handleButtonClick(interaction) {
  // ⚡ LIGNE 1: DÉFÉRER IMMÉDIATEMENT
  await interaction.deferUpdate();

  // Maintenant on peut faire des opérations longues
  const data = await db.query(...);  // OK: peut prendre 2-3s
  const result = await processData(data);

  // Répondre avec editReply (JAMAIS update/reply après defer)
  await interaction.editReply({
    embeds: [embed],
    components: [row]
  });
}

// ✅ PATTERN MODAL SUBMIT

async handleModalSubmit(interaction) {
  // ⚡ LIGNE 1: DÉFÉRER (ephemeral pour modals)
  await interaction.deferReply({ flags: 64 });

  const fields = interaction.fields;
  const result = await processModalData(fields);

  await interaction.editReply({ content: result });
}

// ❌ INCORRECT - TIMEOUT GARANTI

async handleBadClick(interaction) {
  const data = await db.query(...);  // ❌ 2-3s SANS defer
  await interaction.update({ ... }); // ❌ ERREUR 10062
}
```

### Exceptions (Ne PAS Déférer)

1. **`interaction.showModal()`** - Réponse immédiate, pas besoin de defer
2. **Délégation immédiate** - Le handler délégué va déférer

```javascript
// ✅ CORRECT - Délégation SANS defer
if (customId.startsWith('give_unique_')) {
  return giveUniqueHandler.handleInteraction(interaction);
  // Le handler délégué va déférer
}

// ❌ INCORRECT - Double defer
if (customId.startsWith('give_unique_')) {
  await interaction.deferUpdate();  // ❌ Le handler va aussi déférer
  return giveUniqueHandler.handleInteraction(interaction);
}
```

### Checklist Préventive

```
□ Ligne 1 du handler: await interaction.deferUpdate()
□ OU Ligne 1: await interaction.deferReply({ flags: 64 })
□ Utilise editReply() après defer (JAMAIS update() ou reply())
□ Gère l'erreur 10062 gracefully
□ Si délégation: PAS de defer avant
□ Si showModal(): PAS de defer
```

### Template Gestion Erreur

```javascript
async handleInteraction(interaction) {
  await interaction.deferUpdate();

  try {
    // ... logique
    await interaction.editReply({ content: 'Done!' });

  } catch (error) {
    console.error('🔴 Erreur:', error);

    // Ignorer timeout (déjà passé)
    if (error.code === 10062) {
      console.error('⏱️  Interaction expirée - Timeout dépassé');
      return;
    }

    // Répondre si possible
    if (interaction.deferred) {
      await interaction.editReply({ content: '❌ Erreur', flags: 64 });
    }
  }
}
```

---

## 🟠 LACUNE #4: Routing Incomplet des Interactions

### Problème Concret

**Session du 2025-11-08 (B)**:
- `handleSelectMenu()` dans `adminPanelHandler` ne routait PAS `give_unique_*`
- Seuls les boutons étaient routés, pas les select menus
- Flow cassé: User select → adminPanelHandler → **AUCUNE RÉPONSE** → Timeout

### Code Problématique

```javascript
// adminPanelHandler.js

// ✅ Boutons routés correctement
async handleAdminInteraction(interaction) {
  if (customId.startsWith('give_unique_')) {
    return giveUniqueHandler.handleInteraction(interaction);
  }
}

// ❌ Select menus NON routés
async handleSelectMenu(interaction) {
  // give_unique_ n'était PAS géré ici
  // → Aucune réponse → Timeout
}
```

### Solution Appliquée

```javascript
// ✅ CORRECT - Router TOUS les types

// Boutons
if (interaction.isButton()) {
  if (customId.startsWith('give_unique_')) {
    return giveUniqueHandler.handleInteraction(interaction);
  }
}

// Select Menus - NE PAS OUBLIER
if (interaction.isStringSelectMenu()) {
  if (customId.startsWith('give_unique_')) {
    return giveUniqueHandler.handleInteraction(interaction);
  }
}

// Modals - NE PAS OUBLIER
if (interaction.isModalSubmit()) {
  if (customId.startsWith('give_unique_')) {
    return giveUniqueHandler.handleInteraction(interaction);
  }
}
```

### Cause Racine

1. ❌ Focus uniquement sur les boutons
2. ❌ Oubli des autres types d'interactions (selects, modals)
3. ❌ Pas de vérification exhaustive

### Checklist Préventive

```
□ Router les BOUTONS avec customId matching
□ Router les SELECT MENUS avec customId matching
□ Router les MODALS avec customId matching
□ Tester CHAQUE étape du wizard sur Discord
□ Vérifier les logs: aucun "Unknown interaction"
```

### Template Router Complet

```javascript
// events/interactionCreate.js

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    const customId = interaction.customId || '';

    // ===== BOUTONS =====
    if (interaction.isButton()) {
      if (customId.startsWith('my_wizard_')) {
        return myWizardHandler.handleInteraction(interaction);
      }
    }

    // ===== SELECT MENUS =====
    if (interaction.isStringSelectMenu()) {
      if (customId.startsWith('my_wizard_')) {
        return myWizardHandler.handleInteraction(interaction);
      }
    }

    // ===== MODALS =====
    if (interaction.isModalSubmit()) {
      if (customId.startsWith('my_wizard_')) {
        return myWizardHandler.handleInteraction(interaction);
      }
    }
  }
};
```

---

## 🟡 LACUNE #5: Sous-Estimation du Travail Effectué

### Problème Concret

**Session du 2025-11-18 (versioning v1.4.1)**:
- Analyse initiale: Mentionne seulement bug multi-serveur
- User corrige: "on a fait plus que ca. verifie car il y a au moins la vision divine et le jackpot X2 . plus d'autres details"
- **Oubli**: Vision Divine, Jackpot x2, Aimant à Légendaires (3 super bonuses complets!)
- **Temps perdu**: 30min-1h de re-vérification

### Cause Racine

1. ❌ Lecture partielle des git diff
2. ❌ Pas de consultation des fichiers markdown
3. ❌ Focus uniquement sur les fichiers .js

### Solution OBLIGATOIRE

```bash
✅ WORKFLOW VÉRIFICATION EXHAUSTIF

AVANT tout résumé/versioning:

1. **Lister TOUS les markdown de documentation**
   ```bash
   ls *.md
   cat TESTS-*.md
   cat GUIDE-*.md
   cat SPEC-*.md
   cat RECAP-*.md
   ```

2. **Git diff COMPLET de tous les dossiers**
   ```bash
   git diff handlers/
   git diff utils/
   git diff views/
   git diff events/
   git diff commands/
   ```

3. **Lister les scripts de test créés**
   ```bash
   ls scripts/test-*.js
   ls scripts/verify-*.js
   ```

4. **Consulter le CHANGELOG existant**
   ```bash
   cat CHANGELOG.md
   ```

5. **Seulement APRÈS: Faire le résumé**
```

### Checklist Préventive

```
□ J'ai lu TOUS les *.md créés/modifiés
□ J'ai fait git diff sur TOUS les dossiers code
□ J'ai listé les scripts test-*.js
□ J'ai vérifié le CHANGELOG existant
□ J'ai demandé confirmation à l'utilisateur si doute
```

---

## 🟡 LACUNE #6: Tests E2E Non Systématiques

### Problème

- Implémentations sans script de validation
- Bugs découverts tardivement sur Discord
- Pas de reproductibilité des tests

### Solution OBLIGATOIRE

```javascript
// ✅ TEMPLATE: Script E2E Complet

// scripts/test-my-feature.js
const db = require('../utils/database-pg');

async function testFeature() {
  console.log('🧪 TEST E2E: Ma Feature\n');
  console.log('='.repeat(80));

  const guildId = process.env.GUILD_ID;
  const testUserId = 'test_user_123';

  try {
    // 1. Test cas normal
    console.log('\n✅ Test 1: Cas normal...');
    const result1 = await myFunction(guildId, testUserId);
    console.assert(result1 !== null, 'Should return result');
    console.log('   ✓ Cas normal OK');

    // 2. Test cas limite (null)
    console.log('\n✅ Test 2: Cas limite null...');
    const result2 = await myFunction(guildId, null);
    console.assert(result2 === null, 'Should return null');
    console.log('   ✓ Cas limite OK');

    // 3. Test isolation multi-serveur
    console.log('\n✅ Test 3: Isolation multi-serveur...');
    const result3 = await myFunction('other_guild_id', testUserId);
    console.assert(result3 !== result1, 'Should be isolated');
    console.log('   ✓ Isolation OK');

    // 4. Test edge case
    console.log('\n✅ Test 4: Edge case...');
    const result4 = await myFunction(guildId, 'invalid_user');
    console.assert(result4 === null, 'Should handle invalid');
    console.log('   ✓ Edge case OK');

    console.log('\n' + '='.repeat(80));
    console.log('✅ TOUS LES TESTS PASSÉS!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST ÉCHOUÉ:', error);
    process.exit(1);
  }
}

testFeature();
```

### Checklist Préventive

```
□ Script scripts/test-[feature].js créé
□ Test cas normal inclus
□ Test cas limites (null, undefined, invalide) inclus
□ Test isolation multi-serveur (guild_id différent) inclus
□ Test edge cases métier inclus
□ Script exécuté avec succès: node scripts/test-[feature].js
□ Documentation du test dans TESTS-*.md
```

---

## 🟡 LACUNE #7: Documentation Tardive

### Problème

- Documentation créée après le code
- Risque d'oubli de détails importants
- Pas de specs claires pendant développement

### Solution OBLIGATOIRE

```markdown
✅ WORKFLOW DOC-DRIVEN

PHASE 1 - AVANT de coder:
  1. Créer SPEC-[feature].md avec:
     - Objectif
     - Cas d'usage
     - Schéma DB nécessaire
     - Interactions Discord
     - Edge cases prévus

PHASE 2 - PENDANT le dev:
  1. Mettre à jour SPEC avec décisions prises
  2. Créer GUIDE-TESTS-[feature].md au fur et à mesure
  3. Noter les bugs rencontrés et solutions

PHASE 3 - APRÈS le dev:
  1. Créer RECAP-[feature]-IMPLEMENTATION.md
  2. Mettre à jour CHANGELOG.md immédiatement
  3. Créer scripts de test E2E
  4. Mettre à jour DATABASE-SCHEMA.md si modifs DB
```

### Template SPEC

```markdown
# SPEC - Ma Feature

## 🎯 Objectif

Description claire de ce qu'on veut accomplir.

## 📊 Schéma DB

**Tables concernées**:
- `my_table`: Colonnes x, y, z
- `autre_table`: Relation FK

**Nouvelles colonnes nécessaires**:
- `ma_colonne` (TEXT, NOT NULL)

## 🎮 Interactions Discord

1. User clique bouton "Action"
2. Modal s'ouvre avec champs A, B
3. Submit → Traitement
4. Réponse avec embed résultat

## ⚠️ Edge Cases

- [ ] User annule le modal
- [ ] guild_id invalide
- [ ] Données manquantes
- [ ] Timeout interaction
```

### Checklist Préventive

```
□ SPEC-*.md créé AVANT de coder
□ GUIDE-TESTS-*.md créé PENDANT le dev
□ RECAP-*-IMPLEMENTATION.md créé APRÈS le dev
□ CHANGELOG.md mis à jour immédiatement
□ DATABASE-SCHEMA.md mis à jour si modifs DB
```

---

## 💡 SUGGESTIONS AMÉLIORATION CLAUDE.md

### 🎯 Suggestion #1: Checklist Universelle en Début de Fichier

**Ajouter en tête de CLAUDE.md**:

```markdown
## ✅ CHECKLIST UNIVERSELLE (CONSULTER AVANT TOUTE TÂCHE)

Avant de modifier du code, TOUJOURS vérifier:

1. [ ] J'ai lu DATABASE-SCHEMA.md pour les tables concernées
2. [ ] J'ai vérifié l'existence de TOUTES les colonnes mentionnées
3. [ ] J'extrais `guildId = interaction.guildId` en PREMIÈRE ligne
4. [ ] Je défère l'interaction IMMÉDIATEMENT (deferUpdate/deferReply)
5. [ ] Toutes mes requêtes SQL incluent `WHERE guild_id = $X`
6. [ ] Je crée un script de test E2E après implémentation
7. [ ] Je mets à jour CHANGELOG.md immédiatement
8. [ ] Je route TOUS les types d'interactions (buttons, selects, modals)

Si UNE SEULE de ces étapes est manquante:
  → ARRÊTER et compléter avant de continuer
```

### 🎯 Suggestion #2: Templates de Code Obligatoires

**Ajouter section "Code Templates" dans CLAUDE.md**:

```javascript
// ===== TEMPLATE UNIVERSEL: Handler Interaction =====

async function handleMyInteraction(interaction) {
  // LIGNE 1: guild_id
  const guildId = interaction.guildId;

  // LIGNE 2: defer
  await interaction.deferUpdate();

  try {
    // LIGNE 3+: Logique avec guild_id TOUJOURS
    const data = await db.queryOne(`
      SELECT * FROM my_table
      WHERE id = $1 AND guild_id = $2
    `, [id, guildId]);

    // Répondre avec editReply
    await interaction.editReply({ content: 'Done!' });

  } catch (error) {
    console.error('🔴', error);
    if (error.code === 10062) return; // Timeout

    if (interaction.deferred) {
      await interaction.editReply({ content: '❌ Erreur', flags: 64 });
    }
  }
}
```

### 🎯 Suggestion #3: Référence Rapide Erreurs Discord

**Ajouter tableau de référence**:

| Code | Signification | Solution Immédiate |
|------|---------------|-------------------|
| 10062 | Unknown Interaction (Timeout) | Ajouter `deferUpdate()` en ligne 1 |
| 40060 | Already Replied | Utiliser `editReply()` après defer |
| 10008 | Unknown Message | Message supprimé. Vérifier existence |
| 50013 | Missing Permissions | Bot manque perms. Vérifier rôles |

### 🎯 Suggestion #4: Script Diagnostic Automatique

**Créer scripts/diagnostic-code-quality.js**:

```javascript
// Vérifie patterns dangereux dans le code

const fs = require('fs');
const glob = require('glob');

const dangerousPatterns = [
  {
    name: 'Missing guild_id in WHERE clause',
    regex: /WHERE\s+(?!.*guild_id).*FROM\s+(\w+)/gi,
    severity: '🔴 CRITIQUE',
    fix: 'Ajouter AND guild_id = $X dans WHERE'
  },
  {
    name: 'Missing deferUpdate() in handler',
    regex: /async\s+function\s+handle\w+.*\{(?!.*defer)/gs,
    severity: '🟠 ERREUR',
    fix: 'Ajouter await interaction.deferUpdate() en ligne 1'
  },
  {
    name: 'Using update() after defer',
    regex: /defer.*interaction\.update\(/gs,
    severity: '🟠 ERREUR',
    fix: 'Utiliser editReply() au lieu de update()'
  }
];

console.log('🔍 Diagnostic Code Quality\n');

glob.sync('{handlers,events}/**/*.js').forEach(file => {
  const content = fs.readFileSync(file, 'utf8');

  dangerousPatterns.forEach(pattern => {
    if (pattern.regex.test(content)) {
      console.warn(`${pattern.severity} ${file}`);
      console.warn(`   ${pattern.name}`);
      console.warn(`   Fix: ${pattern.fix}\n`);
    }
  });
});
```

---

## 📋 Checklist Finale Avant Commit

```
□ Toutes les lacunes vérifiées
□ DATABASE-SCHEMA.md consulté
□ guild_id dans TOUTES les requêtes SQL
□ deferUpdate() en ligne 1 de tous les handlers
□ Routing complet (buttons, selects, modals)
□ Script E2E créé et passé
□ CHANGELOG.md mis à jour
□ Documentation créée/mise à jour
```

---

**Dernière mise à jour**: 2025-11-18
**Basé sur**: Analyse complète des conversations depuis début du projet
**Temps total économisé**: ~4-8h par session de développement
