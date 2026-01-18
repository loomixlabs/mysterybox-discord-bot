---
name: debugger-expert
description: |
  Expert en diagnostic et résolution de bugs Discord.js/Node.js.
  ACTIVE AUTOMATIQUEMENT quand:
  - Une erreur est signalée par l'utilisateur
  - Un log d'erreur est partagé
  - Le bot ne répond pas ou timeout
  - Un comportement inattendu est décrit

  Diagnostique: erreurs Discord, DB, timeouts, crashes, logs.
  Propose solutions ciblées basées sur patterns connus.
---

# Debugger Expert

## Mission
Diagnostiquer rapidement et résoudre efficacement les bugs.

## Process de Diagnostic

### Étape 1: Collecter les Informations

```
□ Message d'erreur exact?
□ Code d'erreur (10062, ECONNREFUSED, etc.)?
□ Quel fichier/handler?
□ Quelle action utilisateur?
□ Reproductible?
```

### Étape 2: Identifier la Catégorie

| Code/Message | Catégorie | Cause Probable |
|--------------|-----------|----------------|
| `10062` | Discord Timeout | Pas de defer, opération trop longue |
| `10008` | Unknown Message | Message supprimé/expiré |
| `50001` | Missing Access | Permissions bot manquantes |
| `50013` | Missing Permissions | Rôle insuffisant |
| `ECONNREFUSED` | Database | PostgreSQL non démarré |
| `relation does not exist` | Database | Table manquante |
| `column does not exist` | Database | Colonne manquante |
| `duplicate key` | Database | Contrainte UNIQUE violée |
| `Cannot read property of undefined` | Code | Variable non initialisée |

### Étape 3: Appliquer la Solution

## Solutions par Erreur

### Discord 10062 (Unknown Interaction)

**Cause**: Réponse après 3 secondes
**Solution**:
```javascript
// AVANT toute opération async
await interaction.deferUpdate(); // ou deferReply()
// PUIS opérations
await interaction.editReply({ ... });
```

### Discord 10008 (Unknown Message)

**Cause**: Message édité/supprimé entre-temps
**Solution**:
```javascript
try {
  await message.edit({ ... });
} catch (e) {
  if (e.code === 10008) {
    console.log('⚠️ Message plus disponible');
    return; // Ignorer, pas grave
  }
  throw e;
}
```

### Database ECONNREFUSED

**Cause**: PostgreSQL non démarré
**Solution**:
```bash
# Local
net start postgresql-x64-15

# Docker
docker start bot-mysterybox-db
```

### Database "relation does not exist"

**Cause**: Table manquante
**Solution**:
```bash
# Vérifier
node list-tables.js

# Exécuter migration
node database/migrations/xxx.sql
```

### Database "column does not exist"

**Cause**: Colonne non créée
**Solution**:
```javascript
// Créer migration
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS column_name TYPE;
```

### "Cannot read property X of undefined"

**Cause**: Variable null/undefined
**Solution**:
```javascript
// Ajouter vérification
if (!variable) {
  console.error('🔴 Variable manquante:', variableName);
  return;
}
// Ou optional chaining
const value = obj?.prop?.subprop;
```

## Scripts de Diagnostic

```bash
# Vérifier connexion DB
node verify-db.js

# Tester un handler spécifique
node diagnostic-interaction-routing.js

# Vérifier logs Docker
ssh root@72.60.185.62 'docker logs bot-mysterybox --tail 100'

# Chercher erreurs dans logs
ssh root@72.60.185.62 'docker logs bot-mysterybox 2>&1 | grep -i error | tail -20'
```

## Template de Debug Handler

```javascript
async function debugHandler(interaction) {
  console.log('🔍 DEBUG START');
  console.log('  customId:', interaction.customId);
  console.log('  user:', interaction.user.tag);
  console.log('  guild:', interaction.guildId);

  try {
    await interaction.deferUpdate();
    console.log('  ✅ Defer OK');

    // Opération à tester
    const result = await operation();
    console.log('  ✅ Operation OK:', result);

    await interaction.editReply({ content: 'OK' });
    console.log('  ✅ Reply OK');

  } catch (error) {
    console.error('  🔴 ERROR:', error.code, error.message);
    console.error('  Stack:', error.stack);
  }

  console.log('🔍 DEBUG END');
}
```

## Logs Structurés

```javascript
// Convention émojis
console.log('✅ Succès:', data);
console.error('🔴 Erreur:', error);
console.warn('⚠️ Warning:', info);
console.log('🔍 Debug:', details);
console.log('📊 Stats:', metrics);
console.log('⏱️ Timing:', duration);
```

## Références

- [common-errors.md](references/common-errors.md) - Catalogue erreurs + solutions
- [diagnostic-scripts.md](references/diagnostic-scripts.md) - Scripts de diagnostic
