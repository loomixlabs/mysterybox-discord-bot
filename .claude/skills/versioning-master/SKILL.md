---
name: versioning-master
description: |
  Expert SemVer, CHANGELOG et releases Git.
  ACTIVE AUTOMATIQUEMENT quand:
  - Du code est modifié (CHANGELOG obligatoire)
  - Une release est demandée
  - Un tag Git est nécessaire
  - L'utilisateur demande la version actuelle

  Garantit: CHANGELOG à jour, versioning correct, tags Git propres.
  MISE À JOUR CHANGELOG = BUMP VERSION + COMMIT GIT OBLIGATOIRES.
---

# Versioning Master

## RÈGLE ABSOLUE - Workflow Complet Obligatoire

```
❌ INTERDIT: Mettre à jour CHANGELOG sans bumper la version
❌ INTERDIT: Bumper la version sans committer
✅ OBLIGATOIRE: CHANGELOG + BUMP + COMMIT = UNE SEULE OPÉRATION
```

**Quand Claude met à jour CHANGELOG.md, il DOIT IMMÉDIATEMENT:**

1. ✅ Renommer `[Non publié]` → `[X.Y.Z] - YYYY-MM-DD`
2. ✅ Mettre à jour `package.json` avec la nouvelle version
3. ✅ Créer le commit Git avec message conventionnel
4. ✅ Informer l'utilisateur de la version publiée

## Format SemVer

```
MAJOR.MINOR.PATCH (ex: 2.6.1)

PATCH (2.6.0 → 2.6.1)
  - Bug fix, correction mineure, optimisation

MINOR (2.6.0 → 2.7.0)
  - Nouvelle fonctionnalité, ajout sans breaking change

MAJOR (2.6.0 → 3.0.0)
  - Breaking change, refonte majeure
```

## Workflow de Modification (3 étapes atomiques)

```
ÉTAPE 1: Écrire dans CHANGELOG.md section [Non publié]
         → Après chaque modification de code

ÉTAPE 2: Finaliser la release (ATOMIQUE)
         → Quand l'utilisateur dit "commit", "release", "version"
         → OU quand Claude a terminé un ensemble de modifications

         a) Déterminer le type: PATCH/MINOR/MAJOR
         b) Renommer [Non publié] → [X.Y.Z] - DATE
         c) Mettre à jour package.json
         d) git add . && git commit

ÉTAPE 3: Tag et push (optionnel, sur demande)
         → git tag -a vX.Y.Z -m "Release vX.Y.Z"
         → git push origin main --tags
```

## Format CHANGELOG.md

```markdown
# Changelog

## [Non publié]
<!-- Utilisé UNIQUEMENT pendant le développement -->

### ✨ Added
- Nouvelle fonctionnalité

### 🔄 Changed
- Modification de comportement

### 🐛 Fixed
- Correction de bug

### 🗑️ Removed
- Fonctionnalité supprimée

---

## [2.6.1] - 2026-01-18

### 🐛 Fixed
- **[Module]**: Description du fix
  - Fichiers: `path/to/file.js` (lignes X-Y)
```

## Messages de Commit

```bash
# Format Conventional Commits
type(scope): description courte

# Types
feat:     Nouvelle fonctionnalité (→ MINOR)
fix:      Correction de bug (→ PATCH)
docs:     Documentation
refactor: Refactoring
perf:     Amélioration performance
chore:    Maintenance, release

# Exemples
feat(admin): Ajouter wizard modification durée thème
fix(admin): Corriger message collector bloqué
chore(release): v2.6.1
```

## Commandes de Release

```bash
# Commit de release (après CHANGELOG + package.json)
git add -A && git commit -m "chore(release): vX.Y.Z

- Feature 1
- Fix 1

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Tag (optionnel)
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push (optionnel)
git push origin main --tags
```

## Checklist Automatique Claude

Avant de dire "terminé" ou de passer à autre chose:

```
□ CHANGELOG.md mis à jour avec les modifications
□ [Non publié] renommé en [X.Y.Z] - DATE
□ package.json version mise à jour
□ Commit Git créé
□ Utilisateur informé de la nouvelle version
```

**Si UNE étape manque → NE PAS terminer, compléter d'abord.**
