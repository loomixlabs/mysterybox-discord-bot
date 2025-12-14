# SPÉCIFICATION COMPLÈTE - Système de Sévérité des Pièges
**Version**: 1.1.0
**Date**: 2024-12-14
**Statut**: EN COURS D'IMPLÉMENTATION

---

## 0. STATUT D'AVANCEMENT

### ✅ FAIT (Phase 1 - Database & Core)

| Élément | Fichier | Status |
|---------|---------|--------|
| Migration SQL | `database/migrations/add-trap-severity.sql` | ✅ Créé |
| Colonne `severity` dans `traps` | DB locale | ✅ Appliqué |
| Colonnes `trap_severity_1..5` dans `theme_config` | DB locale | ✅ Appliqué |
| Migration pièges existants par type | DB locale | ✅ 46 pièges migrés |
| Pièges par défaut avec sévérité | `utils/trapDefaults.js` | ✅ Modifié |
| Script de migration | `scripts/run-trap-severity-migration.js` | ✅ Créé |

### 🔄 À FAIRE (Bot Discord - Pour tests)

| Priorité | Fichier | Modification | Complexité |
|----------|---------|--------------|------------|
| **1** | `handlers/mysteryBoxHandler.js` | Ajouter `selectTrapWeighted()` + appeler à ligne 413 | Moyenne |
| **2** | `handlers/trapAdminHandler.js` | Afficher sévérité dans liste pièges | Simple |
| **3** | `handlers/trapAdminHandler.js` | Select menu sévérité AVANT le modal de création | Moyenne |
| **4** | `handlers/probabilityHandler.js` | 4ème section "Sévérité Pièges" (embed + bouton + modal) | Moyenne |
| **5** | `utils/themeImporter.js` | Import/Export severity (fallback: 3) | Simple |

### ⏸️ REPORTÉ (Theme Builder)

Le Theme Builder sera traité une fois que le bot sera 100% fonctionnel et testable via Discord.

---

## 1. RÉSUMÉ EXÉCUTIF

### Objectif
Ajouter un système de sévérité (1-5) aux pièges pour permettre une distribution pondérée, évitant que les pièges dévastateurs aient la même probabilité que les pièges mineurs.

### Principe
- Chaque piège a une **sévérité obligatoire** (1=Minor → 5=Extreme)
- Les probabilités sont configurables par thème dans `theme_config`
- Fallback intelligent si une sévérité est vide (descend vers moins sévère)
- Total des probabilités = 100% (autocalcul)

### Distribution actuelle (DB locale)
| Sévérité | Label | Nombre de pièges |
|----------|-------|------------------|
| 1 | ⭐ Minor (empty-box) | 8 |
| 2 | ⭐⭐ Low (cooldown) | 16 |
| 3 | ⭐⭐⭐ Medium (lose-collectible, public-shame) | 15 |
| 5 | ⭐⭐⭐⭐⭐ Extreme (lose-all) | 7 |

---

## 2. TRAVAIL RESTANT - BOT DISCORD

### 2.1 mysteryBoxHandler.js (PRIORITÉ 1)

**Fichier**: `handlers/mysteryBoxHandler.js`

**Modifications requises**:

1. **Ajouter méthode `selectTrapWeighted()`** (après ligne 232, après selectCollectibleWeighted):
```javascript
/**
 * Sélection pondérée d'un piège selon sa sévérité
 * @param {Array} traps - Liste des pièges actifs
 * @param {Object} config - Configuration du thème (probabilités)
 * @returns {Object} Piège sélectionné
 */
selectTrapWeighted(traps, config) {
  // Probabilités par sévérité (depuis config ou defaults)
  const percentages = {
    5: config.trap_severity_5 || 2,   // Extreme
    4: config.trap_severity_4 || 8,   // High
    3: config.trap_severity_3 || 15,  // Medium
    2: config.trap_severity_2 || 30,  // Low
    1: config.trap_severity_1 || 45   // Minor
  };

  console.log(`🎲 Pourcentages sévérité pièges:`, percentages);

  // Grouper les pièges par sévérité
  const bySeverity = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  traps.forEach(trap => {
    const sev = trap.severity || 3; // Default à Medium
    bySeverity[sev].push(trap);
  });

  console.log(`📊 Distribution: Sev1=${bySeverity[1].length}, Sev2=${bySeverity[2].length}, Sev3=${bySeverity[3].length}, Sev4=${bySeverity[4].length}, Sev5=${bySeverity[5].length}`);

  // Tirage cumulatif de la sévérité (du plus sévère au moins sévère)
  const rand = Math.random() * 100;
  let cumulative = 0;
  let targetSeverity = 1;

  for (let sev = 5; sev >= 1; sev--) {
    if (rand < (cumulative += percentages[sev])) {
      targetSeverity = sev;
      break;
    }
  }

  // FALLBACK: Si sévérité vide, descendre vers moins sévère
  let selectedSeverity = targetSeverity;
  while (selectedSeverity >= 1 && bySeverity[selectedSeverity].length === 0) {
    selectedSeverity--;
  }

  // Si toujours vide, sélection uniforme parmi tous
  if (selectedSeverity < 1 || bySeverity[selectedSeverity].length === 0) {
    console.log('⚠️ Fallback: aucun piège dans les sévérités, sélection uniforme');
    return traps[Math.floor(Math.random() * traps.length)];
  }

  // Sélection uniforme dans la sévérité choisie
  const pool = bySeverity[selectedSeverity];
  const selected = pool[Math.floor(Math.random() * pool.length)];

  console.log(`✅ Sévérité sélectionnée: ${selectedSeverity} (roll: ${rand.toFixed(2)})`);
  console.log(`   Piège: ${selected.name}`);

  return selected;
}
```

2. **Modifier le bloc else** (lignes 412-415):
```javascript
// AVANT:
} else {
  // Sélection uniforme pour missions et pièges (pas de rareté)
  item = items[Math.floor(Math.random() * items.length)];
}

// APRÈS:
} else if (type === 'trap') {
  // Sélection pondérée par sévérité pour les pièges
  item = this.selectTrapWeighted(items, config);
  console.log(`🎯 Piège sélectionné (pondéré): ${item.name} (sévérité ${item.severity})`);
} else {
  // Sélection uniforme pour missions
  item = items[Math.floor(Math.random() * items.length)];
}
```

---

### 2.2 trapAdminHandler.js - Affichage (PRIORITÉ 2)

**Fichier**: `handlers/trapAdminHandler.js`

**Modifications requises**:

1. **Afficher la sévérité dans la liste des pièges** (dans l'embed qui liste les pièges):
   - Ajouter un badge étoiles (⭐) selon la sévérité
   - Format: `⭐⭐ Piège Temporel (cooldown)`

2. **Dans la vue détail d'un piège**:
   - Afficher la sévérité avec son label

**Labels à utiliser**:
```javascript
const SEVERITY_LABELS = {
  1: '⭐ Minor',
  2: '⭐⭐ Low',
  3: '⭐⭐⭐ Medium',
  4: '⭐⭐⭐⭐ High',
  5: '⭐⭐⭐⭐⭐ Extreme'
};
```

---

### 2.3 trapAdminHandler.js - Création/Édition (PRIORITÉ 3)

**CONTRAINTE DISCORD**: Les modals sont limités à 5 champs texte. Le modal de création de piège utilise déjà les 5 champs.

**Solution**: Ajouter un **select menu AVANT le modal** pour choisir la sévérité.

**Flow proposé**:
```
1. Clic "Ajouter un piège"
   ↓
2. Select menu: Choisir le TYPE de piège
   ↓
3. Select menu: Choisir la SÉVÉRITÉ (NOUVEAU)
   ↓
4. Modal: Saisir les détails (nom, description, etc.)
   ↓
5. Sauvegarde avec type + sévérité + détails
```

**CustomIds à créer**:
- `trap_select_severity_{type}` - Select menu sévérité
- `trap_severity_{type}_{severity}` - Option sélectionnée

---

### 2.4 probabilityHandler.js - 4ème section (PRIORITÉ 4)

**Fichier**: `handlers/probabilityHandler.js`

**IMPORTANT**: Ce handler gère déjà 3 sections de probabilités. Ajouter une 4ème.

**Structure actuelle**:
1. Probabilités Types (collectible/mission/trap/super_bonus)
2. Rareté Collectibles (legendary/epic/rare/common)
3. Rareté Super Bonus (legendary/epic/rare/common)

**À ajouter**:
4. **Sévérité Pièges** (minor/low/medium/high/extreme)

**Modifications requises**:

1. **Dans `showMainMenu()`** - Ajouter champ embed:
```javascript
embed.addFields({
  name: '⚠️ SÉVÉRITÉ PIÈGES',
  value:
    `⭐ Minor (1): **${config.trap_severity_1 || 45}%**\n` +
    `⭐⭐ Low (2): **${config.trap_severity_2 || 30}%**\n` +
    `⭐⭐⭐ Medium (3): **${config.trap_severity_3 || 15}%**\n` +
    `⭐⭐⭐⭐ High (4): **${config.trap_severity_4 || 8}%**\n` +
    `⭐⭐⭐⭐⭐ Extreme (5): **${config.trap_severity_5 || 2}%**`,
  inline: true
});
```

2. **Ajouter bouton**:
```javascript
new ButtonBuilder()
  .setCustomId('probability_config_trap_severity')
  .setLabel('⚠️ Sévérité Pièges')
  .setStyle(ButtonStyle.Secondary)
```

3. **Nouvelle méthode `showTrapSeverityModal()`**:
```javascript
async showTrapSeverityModal(interaction, config) {
  const modal = new ModalBuilder()
    .setCustomId('probability_modal_trap_severity')
    .setTitle('⚠️ Probabilités Sévérité Pièges');

  // 5 champs pour les 5 sévérités
  const inputs = [
    { id: 'trap_severity_1', label: '⭐ Minor (1) - %', value: String(config.trap_severity_1 || 45) },
    { id: 'trap_severity_2', label: '⭐⭐ Low (2) - %', value: String(config.trap_severity_2 || 30) },
    { id: 'trap_severity_3', label: '⭐⭐⭐ Medium (3) - %', value: String(config.trap_severity_3 || 15) },
    { id: 'trap_severity_4', label: '⭐⭐⭐⭐ High (4) - %', value: String(config.trap_severity_4 || 8) },
    { id: 'trap_severity_5', label: '⭐⭐⭐⭐⭐ Extreme (5) - %', value: String(config.trap_severity_5 || 2) }
  ];

  inputs.forEach(input => {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(input.id)
          .setLabel(input.label)
          .setStyle(TextInputStyle.Short)
          .setValue(input.value)
          .setRequired(true)
          .setMaxLength(3)
      )
    );
  });

  return interaction.showModal(modal);
}
```

4. **Nouvelle méthode `handleTrapSeveritySubmit()`**:
```javascript
async handleTrapSeveritySubmit(interaction) {
  await interaction.deferReply({ flags: 64 });

  const guildId = interaction.guildId;
  const theme = await db.getActiveTheme(guildId);

  if (!theme) {
    return interaction.editReply({ content: '❌ Aucun thème actif.' });
  }

  const values = {
    trap_severity_1: parseInt(interaction.fields.getTextInputValue('trap_severity_1')) || 0,
    trap_severity_2: parseInt(interaction.fields.getTextInputValue('trap_severity_2')) || 0,
    trap_severity_3: parseInt(interaction.fields.getTextInputValue('trap_severity_3')) || 0,
    trap_severity_4: parseInt(interaction.fields.getTextInputValue('trap_severity_4')) || 0,
    trap_severity_5: parseInt(interaction.fields.getTextInputValue('trap_severity_5')) || 0
  };

  const total = values.trap_severity_1 + values.trap_severity_2 + values.trap_severity_3 +
                values.trap_severity_4 + values.trap_severity_5;

  if (total !== 100) {
    return interaction.editReply({
      content: `❌ Le total doit faire 100%. Actuellement: ${total}%`
    });
  }

  // UPDATE theme_config
  await db.query(`
    UPDATE theme_config SET
      trap_severity_1 = $1,
      trap_severity_2 = $2,
      trap_severity_3 = $3,
      trap_severity_4 = $4,
      trap_severity_5 = $5
    WHERE guild_id = $6 AND theme_id = $7
  `, [values.trap_severity_1, values.trap_severity_2, values.trap_severity_3,
      values.trap_severity_4, values.trap_severity_5, guildId, theme.id]);

  return interaction.editReply({
    content: '✅ Probabilités sévérité pièges mises à jour !'
  });
}
```

5. **Router dans `handleInteraction()`**:
```javascript
// Button
if (customId === 'probability_config_trap_severity') {
  return this.showTrapSeverityModal(interaction, config);
}

// Modal submit (dans modalHandler.js ou ici)
if (customId === 'probability_modal_trap_severity') {
  return this.handleTrapSeveritySubmit(interaction);
}
```

---

### 2.5 themeImporter.js (PRIORITÉ 5)

**Fichier**: `utils/themeImporter.js`

**Modifications requises**:

1. **À l'import des pièges** - Ajouter fallback:
```javascript
severity: trap.severity || 3  // Default: Medium
```

2. **À l'export des pièges** - Inclure severity:
```javascript
{
  trap_id: trap.trap_id,
  name: trap.name,
  type: trap.type,
  severity: trap.severity,  // ← AJOUTER
  // ... autres champs
}
```

3. **À l'import de theme_config** - Ajouter fallback:
```javascript
trap_severity_1: config.trap_severity_1 || 45,
trap_severity_2: config.trap_severity_2 || 30,
trap_severity_3: config.trap_severity_3 || 15,
trap_severity_4: config.trap_severity_4 || 8,
trap_severity_5: config.trap_severity_5 || 2,
```

---

## 3. ALGORITHME DE SÉLECTION

```javascript
/**
 * Sélection pondérée d'un piège selon sa sévérité
 * @param {Array} traps - Liste des pièges actifs
 * @param {Object} config - Configuration du thème (probabilités)
 * @returns {Object} Piège sélectionné
 */
selectTrapWeighted(traps, config) {
  // Probabilités par sévérité (depuis config ou defaults)
  const percentages = {
    5: config.trap_severity_5 || 2,   // Extreme
    4: config.trap_severity_4 || 8,   // High
    3: config.trap_severity_3 || 15,  // Medium
    2: config.trap_severity_2 || 30,  // Low
    1: config.trap_severity_1 || 45   // Minor
  };

  // Grouper les pièges par sévérité
  const bySeverity = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  traps.forEach(trap => {
    const sev = trap.severity || 3; // Default à Medium
    bySeverity[sev].push(trap);
  });

  // Tirage cumulatif de la sévérité
  const rand = Math.random() * 100;
  let cumulative = 0;
  let targetSeverity = 1;

  for (let sev = 5; sev >= 1; sev--) {
    if (rand < (cumulative += percentages[sev])) {
      targetSeverity = sev;
      break;
    }
  }

  // FALLBACK: Si sévérité vide, descendre
  let selectedSeverity = targetSeverity;
  while (selectedSeverity >= 1 && bySeverity[selectedSeverity].length === 0) {
    selectedSeverity--;
  }

  // Si toujours vide, sélection uniforme parmi tous
  if (selectedSeverity < 1 || bySeverity[selectedSeverity].length === 0) {
    console.log('⚠️ Fallback: aucun piège dans les sévérités, sélection uniforme');
    return traps[Math.floor(Math.random() * traps.length)];
  }

  // Sélection uniforme dans la sévérité choisie
  const pool = bySeverity[selectedSeverity];
  const selected = pool[Math.floor(Math.random() * pool.length)];

  console.log(`🎲 Piège sélectionné: ${selected.name} (Sévérité ${selectedSeverity})`);
  return selected;
}
```

---

## 4. INTERFACE UTILISATEUR - BOT DISCORD

### 4.1 Liste des pièges (trapAdminHandler)
```
┌──────────────────────────────────────────────┐
│           🪤 PIÈGES DU THÈME                 │
├──────────────────────────────────────────────┤
│                                              │
│ ⭐ La Boîte Vide (empty-box)                 │
│ ⭐⭐ Allez en Prison ! (cooldown)            │
│ ⭐⭐ Taxe de Luxe (cooldown)                 │
│ ⭐⭐⭐ Piège Voleur (lose-collectible)       │
│ ⭐⭐⭐ Piège de la Honte (public-shame)      │
│ ⭐⭐⭐⭐⭐ Piège Dévastateur (lose-all)      │
│                                              │
│ [➕ Ajouter] [✏️ Modifier] [🗑️ Supprimer]   │
└──────────────────────────────────────────────┘
```

### 4.2 Config probabilités (probabilityHandler)
```
┌──────────────────────────────────────────────┐
│   ⚠️ SÉVÉRITÉ PIÈGES                        │
├──────────────────────────────────────────────┤
│                                              │
│ ⭐ Minor (1):        45%                     │
│ ⭐⭐ Low (2):        30%                     │
│ ⭐⭐⭐ Medium (3):   15%                     │
│ ⭐⭐⭐⭐ High (4):    8%                     │
│ ⭐⭐⭐⭐⭐ Extreme:   2%                     │
│                                              │
│ Total: 100% ✅                               │
│                                              │
│ [⚠️ Sévérité Pièges]                        │
└──────────────────────────────────────────────┘
```

---

## 5. CHECKLIST BOT DISCORD

### Phase 1 - Core (FAIT)
- [x] Migration SQL créée
- [x] Migration exécutée localement
- [x] trapDefaults.js mis à jour
- [x] Distribution pièges par sévérité correcte

### Phase 2 - Handler mysteryBoxHandler
- [ ] Ajouter méthode `selectTrapWeighted()`
- [ ] Modifier le bloc de sélection (ligne 413)
- [ ] Tester la sélection pondérée

### Phase 3 - Handler trapAdminHandler
- [ ] Afficher sévérité dans liste pièges
- [ ] Select menu sévérité avant création
- [ ] Sauvegarder sévérité à la création

### Phase 4 - Handler probabilityHandler
- [ ] Ajouter champ embed sévérité pièges
- [ ] Ajouter bouton configuration
- [ ] Créer modal avec 5 inputs
- [ ] Handler submit + validation 100%

### Phase 5 - Utils
- [ ] themeImporter: Import severity (fallback: 3)
- [ ] themeImporter: Export severity

---

## 6. DÉCISIONS VALIDÉES

| Question | Réponse |
|----------|---------|
| Valeur par défaut si non spécifié | **3 (Medium)** |
| Fallback si sévérité vide | **Descendre vers moins sévère** |
| Sévérité obligatoire à la création | **OUI** |
| Migration existante par type | **OUI** (déjà fait) |
| Theme Builder | **REPORTÉ** (après validation bot) |

---

**Dernière mise à jour**: 2024-12-14
