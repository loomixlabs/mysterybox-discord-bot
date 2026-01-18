---
name: test-engineer
description: |
  Expert en création de scripts de test et vérification E2E.
  ACTIVE AUTOMATIQUEMENT quand:
  - Une nouvelle fonctionnalité est implémentée
  - Un bug est corrigé (régression test)
  - L'utilisateur demande de tester
  - Avant déploiement en production

  Crée: scripts de vérification Node.js, tests DB, tests handlers.
  Garantit: pas de régression, comportement attendu validé.
---

# Test Engineer

## Philosophie

**Pas de déploiement sans test. Pas de fix sans vérification.**

Ce projet n'utilise PAS Jest/Mocha. On utilise des **scripts Node.js simples**
qui vérifient le comportement attendu.

## Types de Tests

### 1. Vérification DB

Vérifie que les données sont correctes après une opération.

```javascript
// scripts/verify-xxx.js
const db = require('./utils/database-pg');

async function verify() {
  console.log('🔍 VÉRIFICATION [NOM]\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Vérifier existence
    const result = await db.queryOne(`
      SELECT * FROM table_name
      WHERE condition = $1 AND guild_id = $2
    `, [value, process.env.GUILD_ID]);

    if (result) {
      console.log('✅ Test 1: Donnée existe');
    } else {
      console.log('❌ Test 1: Donnée manquante');
      process.exit(1);
    }

    // Test 2: Vérifier valeur
    if (result.field === expectedValue) {
      console.log('✅ Test 2: Valeur correcte');
    } else {
      console.log(`❌ Test 2: Attendu ${expectedValue}, reçu ${result.field}`);
      process.exit(1);
    }

    console.log('\n✅ TOUS LES TESTS PASSÉS');
    process.exit(0);

  } catch (error) {
    console.error('🔴 Erreur:', error);
    process.exit(1);
  }
}

verify();
```

### 2. Vérification Schéma

Vérifie qu'une colonne/table existe.

```javascript
// scripts/check-schema-xxx.js
const db = require('./utils/database-pg');

async function check() {
  console.log('🔍 Vérification schéma...\n');

  // Vérifier table existe
  const table = await db.queryOne(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = $1
    )
  `, ['ma_table']);

  if (!table.exists) {
    console.log('❌ Table ma_table manquante');
    process.exit(1);
  }
  console.log('✅ Table ma_table existe');

  // Vérifier colonne existe
  const column = await db.queryOne(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
    )
  `, ['ma_table', 'ma_colonne']);

  if (!column.exists) {
    console.log('❌ Colonne ma_colonne manquante');
    process.exit(1);
  }
  console.log('✅ Colonne ma_colonne existe');

  console.log('\n✅ Schéma OK');
  process.exit(0);
}

check();
```

### 3. Test Handler (Simulation)

Simule une interaction pour tester la logique.

```javascript
// scripts/test-handler-xxx.js
const handler = require('./handlers/myHandler');

// Mock interaction
const mockInteraction = {
  guildId: process.env.GUILD_ID,
  customId: 'test_action_123',
  user: { id: '123', tag: 'TestUser#0001' },
  isButton: () => true,
  isStringSelectMenu: () => false,
  isModalSubmit: () => false,
  deferUpdate: async () => console.log('  [Mock] deferUpdate called'),
  editReply: async (content) => console.log('  [Mock] editReply:', content),
  values: ['selected_value'],
  fields: {
    getTextInputValue: (id) => 'mock_input_value'
  }
};

async function test() {
  console.log('🧪 Test Handler\n');

  try {
    await handler.handleInteraction(mockInteraction);
    console.log('\n✅ Handler exécuté sans erreur');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

test();
```

### 4. Test Complet E2E

Teste un flow complet.

```javascript
// scripts/test-e2e-xxx.js
const db = require('./utils/database-pg');

async function testE2E() {
  const guildId = process.env.GUILD_ID;
  const testPlayerId = 'test_' + Date.now();

  console.log('🧪 TEST E2E: [Nom du Flow]\n');
  console.log('='.repeat(60));

  try {
    // Setup
    console.log('\n📦 Setup...');
    await db.query(`
      INSERT INTO players (discord_id, guild_id, username)
      VALUES ($1, $2, 'TestPlayer')
    `, [testPlayerId, guildId]);
    console.log('✅ Player créé');

    // Test
    console.log('\n🔄 Test...');
    // ... logique à tester

    // Verify
    console.log('\n🔍 Vérification...');
    const result = await db.queryOne(`
      SELECT * FROM players
      WHERE discord_id = $1 AND guild_id = $2
    `, [testPlayerId, guildId]);

    if (!result) {
      throw new Error('Player non trouvé');
    }
    console.log('✅ Player trouvé');

    // Cleanup
    console.log('\n🧹 Cleanup...');
    await db.query(`
      DELETE FROM players
      WHERE discord_id = $1 AND guild_id = $2
    `, [testPlayerId, guildId]);
    console.log('✅ Cleanup done');

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST E2E RÉUSSI');
    process.exit(0);

  } catch (error) {
    console.error('\n🔴 TEST ÉCHOUÉ:', error.message);

    // Cleanup même en cas d'erreur
    await db.query(`
      DELETE FROM players WHERE discord_id LIKE 'test_%'
    `);

    process.exit(1);
  }
}

testE2E();
```

## Nommage des Scripts

```
verify-xxx.js      - Vérification simple
check-xxx.js       - Check existence/état
test-xxx.js        - Test unitaire
test-e2e-xxx.js    - Test end-to-end
diagnostic-xxx.js  - Diagnostic problème
```

## Checklist Post-Implémentation

```
□ Script de vérification créé
□ Test exécuté localement
□ Données de test nettoyées
□ Edge cases testés
□ Erreurs gérées
```

## Commandes

```bash
# Exécuter un test
node scripts/verify-xxx.js

# Tester tous les scripts verify
for f in scripts/verify-*.js; do node "$f"; done
```

## Références

- [test-templates.md](references/test-templates.md) - Templates de tests
