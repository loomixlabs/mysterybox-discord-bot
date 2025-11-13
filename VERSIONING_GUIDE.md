# Guide de Versioning - Monopoly Friends Give Bot

## 📖 Qu'est-ce que le Semantic Versioning ?

Le Semantic Versioning (SemVer) est un système de numérotation de version au format **MAJOR.MINOR.PATCH** (ex: `2.3.1`)

### Format : `MAJOR.MINOR.PATCH`

```
1.2.3
│ │ │
│ │ └─── PATCH : Corrections de bugs, modifications mineures
│ └───── MINOR : Nouvelles fonctionnalités (rétrocompatibles)
└─────── MAJOR : Changements majeurs (breaking changes)
```

---

## 🎯 Quand incrémenter chaque niveau ?

### MAJOR (v1.0.0 → v2.0.0)
**Changements incompatibles avec les versions précédentes**

Exemples :
- ❌ Refonte complète de la structure de base de données
- ❌ Changement des noms de commandes Discord
- ❌ Migration vers une nouvelle version majeure de Discord.js
- ❌ Suppression de fonctionnalités utilisées
- ❌ Modification des formats de données stockées

**Impact** : Les utilisateurs doivent migrer leurs données ou reconfigurer

---

### MINOR (v1.0.0 → v1.1.0)
**Nouvelles fonctionnalités (compatibles avec l'ancienne version)**

Exemples :
- ✨ Ajout d'un nouveau type de mission
- ✨ Nouveau système de pièges
- ✨ Système de campagnes
- ✨ Nouvelles commandes Discord
- ✨ Export des statistiques en CSV
- ✅ Amélioration d'une fonctionnalité existante (sans la casser)

**Impact** : Les utilisateurs peuvent profiter de nouvelles fonctionnalités sans rien changer

---

### PATCH (v1.0.0 → v1.0.1)
**Corrections de bugs et modifications mineures**

Exemples :
- 🐛 Fix du bug de validation des missions
- 🐛 Correction des interactions différées
- 🐛 Fix d'un toggle manquant
- 🔧 Optimisation des performances
- 📝 Correction de fautes de frappe
- 🎨 Amélioration de l'affichage sans changer la logique

**Impact** : Les bugs sont corrigés, pas de nouveaux changements fonctionnels

---

## 📝 Processus de versioning à suivre

### 1. Avant de faire une modification

```bash
# Créer une branche pour la nouvelle fonctionnalité
git checkout -b feature/nouveau-type-mission

# OU pour un fix
git checkout -b fix/bug-validation-missions
```

### 2. Pendant le développement

- Tester toutes les modifications
- Documenter les changements au fur et à mesure
- Garder une trace des fichiers modifiés

### 3. Après avoir terminé

#### a) Mettre à jour CHANGELOG.md

Ajouter les changements dans la section `[Non publié]` :

```markdown
## [Non publié]

### Added
- Nouveau système de badges pour les joueurs

### Fixed
- Correction du calcul des points de campagne
```

#### b) Décider de la nouvelle version

Selon les changements :
- Breaking change ? → Incrémenter MAJOR
- Nouvelle fonctionnalité ? → Incrémenter MINOR
- Correction de bug ? → Incrémenter PATCH

#### c) Créer la nouvelle version

```bash
# Exemple pour une nouvelle fonctionnalité (MINOR)
npm version minor -m "Release v%s - Ajout du système de badges"

# Cela va :
# 1. Incrémenter la version dans package.json (1.0.0 → 1.1.0)
# 2. Créer un commit git
# 3. Créer un tag git (v1.1.0)
```

#### d) Mettre à jour CHANGELOG.md

Remplacer `[Non publié]` par la nouvelle version et la date :

```markdown
## [1.1.0] - 2025-11-15

### Added
- Nouveau système de badges pour les joueurs

### Fixed
- Correction du calcul des points de campagne
```

#### e) Commiter et pousser

```bash
git add CHANGELOG.md
git commit -m "docs: Update CHANGELOG for v1.1.0"
git push origin main
git push origin v1.1.0  # Pousser le tag
```

---

## 🏷️ Convention de nommage des commits

Utiliser [Conventional Commits](https://www.conventionalcommits.org/) :

```
<type>(<scope>): <description>

[corps optionnel]

[pied optionnel]
```

### Types de commits

- `feat`: Nouvelle fonctionnalité (→ MINOR)
- `fix`: Correction de bug (→ PATCH)
- `docs`: Documentation uniquement
- `style`: Formatage, point-virgules manquants, etc.
- `refactor`: Refactoring de code sans changer les fonctionnalités
- `perf`: Amélioration des performances
- `test`: Ajout ou correction de tests
- `chore`: Maintenance (mise à jour de dépendances, etc.)
- `breaking`: Breaking change (→ MAJOR)

### Exemples

```bash
feat(missions): Ajout du type de mission "Énigme"
fix(collectibles): Correction du bug de perte de collectibles
docs(readme): Mise à jour de la documentation d'installation
breaking(database): Migration vers PostgreSQL 16
```

---

## 📋 Checklist avant une release

### Pour toute version

- [ ] Tous les tests passent
- [ ] Le bot démarre sans erreur
- [ ] CHANGELOG.md est à jour
- [ ] La version dans package.json est correcte
- [ ] Le fichier VERSION est à jour
- [ ] Documentation mise à jour si nécessaire

### Pour une version MINOR ou MAJOR

- [ ] Créer une branche de release (`release/v1.1.0`)
- [ ] Tester toutes les fonctionnalités
- [ ] Vérifier la rétrocompatibilité (MINOR)
- [ ] Préparer un guide de migration (MAJOR)
- [ ] Annoncer les changements aux utilisateurs

### Pour une version MAJOR

- [ ] Guide de migration écrit
- [ ] Script de migration de base de données testé
- [ ] Documentation complète mise à jour
- [ ] Période de transition annoncée
- [ ] Support de l'ancienne version planifié

---

## 🚀 Commandes utiles

### Afficher la version actuelle

```bash
cat VERSION
# ou
node -p "require('./package.json').version"
```

### Créer une nouvelle version (npm)

```bash
# Automatique (recommandé)
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0

# Avec message de commit personnalisé
npm version minor -m "Release v%s - Ajout système badges"
```

### Lister les tags git

```bash
git tag
git tag -l "v1.*"  # Toutes les versions 1.x
```

### Voir les changements entre versions

```bash
git diff v1.0.0 v1.1.0
git log v1.0.0..v1.1.0 --oneline
```

---

## 📊 Historique du projet

```
v1.0.0 (2025-11-13) - Version initiale stable
├── Système de missions (Quiz, Mot à deviner)
├── Système de collectibles et thèmes
├── Système de pièges complet
└── Panel d'administration Discord

Prochaines versions :
├── v1.1.0 - Système de badges et statistiques avancées
├── v1.2.0 - Export de données et rapports
└── v2.0.0 - Interface web d'administration
```

---

## 🔗 Ressources

- [Semantic Versioning](https://semver.org/lang/fr/)
- [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Tagging](https://git-scm.com/book/fr/v2/Les-bases-de-Git-Étiquetage)
