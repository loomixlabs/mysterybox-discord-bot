# Guide SemVer Complet

## Semantic Versioning 2.0.0

Format: `MAJOR.MINOR.PATCH`

## Quand Incrémenter

### MAJOR (Breaking Change)

Incompatibilité avec versions précédentes:

- Suppression d'une API publique
- Changement de signature de fonction
- Changement de format de données
- Migration de base de données obligatoire
- Changement de comportement existant

**Exemples**:
- `players.getById()` devient `players.find()`
- Format JSON de thème change de structure
- Colonne DB renommée/supprimée

### MINOR (Nouvelle Fonctionnalité)

Ajout rétro-compatible:

- Nouvelle fonctionnalité
- Nouvel endpoint API
- Nouvelle commande Discord
- Nouvelle colonne DB (avec valeur par défaut)
- Dépréciation (marquage, pas suppression)

**Exemples**:
- Ajout système de badges
- Nouveau type de mission
- Nouvelle option de configuration

### PATCH (Bug Fix)

Correction rétro-compatible:

- Correction de bug
- Optimisation performance
- Correction typo documentation
- Fix sécurité mineur

**Exemples**:
- Fix timeout Discord
- Correction calcul score
- Fix affichage embed

## Pré-release

```
1.0.0-alpha      Très instable
1.0.0-alpha.1    Alpha version 1
1.0.0-beta       Feature complete, testing
1.0.0-beta.2     Beta version 2
1.0.0-rc.1       Release candidate 1
```

## Règles Strictes

1. **Jamais modifier une version publiée**
   - Une fois taggée, la version est immuable
   - Bug trouvé → nouvelle version PATCH

2. **MAJOR 0.x.x = Développement**
   - API instable
   - Pas de garantie de compatibilité

3. **MAJOR 1.0.0+ = API publique définie**
   - Contrat de compatibilité

## Dépendances

```json
{
  "dependencies": {
    "exact": "1.2.3",        // Exactement cette version
    "patch": "~1.2.3",       // 1.2.x (>= 1.2.3 < 1.3.0)
    "minor": "^1.2.3",       // 1.x.x (>= 1.2.3 < 2.0.0)
    "range": ">=1.2.3 <2.0.0"
  }
}
```

## Bonnes Pratiques

1. **Commencer à 0.1.0** pour nouveau projet
2. **Passer à 1.0.0** quand API stable
3. **Documenter les breaking changes** dans CHANGELOG
4. **Utiliser tags Git annotés** (`-a`)
5. **Ne jamais sauter de versions**

## Format Date CHANGELOG

```
[2.5.1] - 2025-01-18
```

ISO 8601: YYYY-MM-DD

## Outils

```bash
# Voir version actuelle
node -p "require('./package.json').version"

# Comparer versions
npx semver 1.2.3 -i patch  # → 1.2.4
npx semver 1.2.3 -i minor  # → 1.3.0
npx semver 1.2.3 -i major  # → 2.0.0
```
