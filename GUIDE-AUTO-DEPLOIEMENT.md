# Guide Auto-Déploiement GitHub → VPS Hostinger

> **Automatisation complète** : Push sur GitHub = Déploiement automatique sur le VPS !

---

## 🎯 Vue d'Ensemble

Ce système utilise **GitHub Actions** pour déployer automatiquement votre bot sur le VPS à chaque push sur la branche `master`.

### Comment ça fonctionne ?

```
1. Vous commitez du code → GitHub
2. GitHub Actions se déclenche automatiquement
3. Le VPS récupère le code et redémarre le bot
4. ✅ Votre bot est à jour !
```

---

## 📋 Prérequis

- [x] Bot déployé sur VPS Hostinger
- [x] Repository GitHub
- [x] Clé SSH pour le VPS
- [ ] Secrets GitHub configurés

---

## 🔧 Configuration (À faire une seule fois)

### Étape 1 : Ajouter les Secrets GitHub

1. Allez sur votre repository GitHub : https://github.com/loomixlabs/mysterybox-discord-bot
2. Cliquez sur **Settings** (en haut à droite)
3. Dans le menu de gauche, cliquez sur **Secrets and variables** → **Actions**
4. Cliquez sur **New repository secret**

Ajoutez les 4 secrets suivants :

#### Secret 1 : `VPS_SSH_KEY`
```
Nom: VPS_SSH_KEY
Valeur: [Contenu de votre clé SSH privée]
```

**Pour obtenir la clé SSH :**
```bash
# Sur votre ordinateur (Git Bash / PowerShell)
cat ~/.ssh/id_rsa_vps_hostinger
```
Copiez TOUT le contenu (y compris `-----BEGIN OPENSSH PRIVATE KEY-----` et `-----END OPENSSH PRIVATE KEY-----`)

#### Secret 2 : `VPS_HOST`
```
Nom: VPS_HOST
Valeur: 72.60.185.62
```

#### Secret 3 : `VPS_USER`
```
Nom: VPS_USER
Valeur: root
```

#### Secret 4 : `VPS_PATH`
```
Nom: VPS_PATH
Valeur: /root/bot-mysterybox
```

### Étape 2 : Vérifier le Workflow

Le fichier `.github/workflows/deploy.yml` est déjà créé et prêt à l'emploi !

---

## 🚀 Utilisation

### Déploiement Automatique

```bash
# Sur votre ordinateur
cd "C:\ia mogo\bot discord"

# Faire vos modifications
# ... éditer des fichiers ...

# Commit et push
git add .
git commit -m "feat: ajout de nouvelle fonctionnalité"
git push origin master

# 🎉 Le déploiement se lance automatiquement !
```

### Déploiement Manuel (via GitHub)

1. Allez sur GitHub : https://github.com/loomixlabs/mysterybox-discord-bot/actions
2. Cliquez sur le workflow **Deploy to VPS Hostinger**
3. Cliquez sur **Run workflow** → **Run workflow**

---

## 📊 Suivi du Déploiement

### Voir les Logs GitHub Actions

1. Allez sur https://github.com/loomixlabs/mysterybox-discord-bot/actions
2. Cliquez sur le dernier workflow en cours
3. Vous verrez les étapes en temps réel :
   - 📥 Checkout code
   - 🔑 Setup SSH
   - 🚀 Deploy to VPS
   - ✅ Deployment Success

### Voir les Logs sur le VPS

```bash
# Se connecter au VPS
ssh -i ~/.ssh/id_rsa_vps_hostinger root@72.60.185.62

# Voir les logs du bot
cd /root/bot-mysterybox
docker compose logs bot-mysterybox --tail=50 -f
```

---

## 🔍 Vérifications

### Vérifier que le Workflow est Actif

```bash
# Sur votre ordinateur
cd "C:\ia mogo\bot discord"
git status

# Vérifier que .github/workflows/deploy.yml existe
ls .github/workflows/
```

### Tester le Workflow

Faites un petit changement pour tester :

```bash
# Modifier le fichier VERSION
echo "1.9.2" > VERSION

# Commit et push
git add VERSION
git commit -m "test: vérification auto-déploiement"
git push origin master

# Allez voir sur GitHub Actions si ça se déclenche !
```

---

## ⚙️ Configuration Avancée

### Désactiver le Déploiement Automatique

Éditez `.github/workflows/deploy.yml` et commentez les lignes :

```yaml
on:
  # push:
  #   branches:
  #     - master
  workflow_dispatch:  # Garde uniquement le déploiement manuel
```

### Ajouter des Branches

```yaml
on:
  push:
    branches:
      - master
      - production  # Ajouter d'autres branches
      - develop
```

### Notifications Discord (Optionnel)

Ajoutez un webhook Discord pour être notifié des déploiements :

```yaml
- name: 📢 Notify Discord
  if: always()
  env:
    DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}
  run: |
    curl -H "Content-Type: application/json" \
      -d '{"content": "✅ Bot déployé sur le VPS avec succès!"}' \
      $DISCORD_WEBHOOK
```

Ajoutez le secret `DISCORD_WEBHOOK` dans GitHub.

---

## 🛡️ Sécurité

### ✅ Ce qui est Sécurisé

- Clé SSH stockée dans les secrets GitHub (jamais exposée)
- `.env` jamais commité (protégé par `.gitignore`)
- Backup automatique du `.env` avant chaque déploiement

### ⚠️ À NE JAMAIS FAIRE

- ❌ Commiter le fichier `.env`
- ❌ Partager vos secrets GitHub
- ❌ Mettre la clé SSH privée dans le code

---

## 🐛 Dépannage

### Erreur : "Permission denied (publickey)"

**Problème** : La clé SSH n'est pas valide.

**Solution** :
1. Vérifiez que vous avez copié TOUTE la clé (avec `-----BEGIN` et `-----END`)
2. Vérifiez qu'il n'y a pas d'espaces en trop
3. Régénérez la clé si nécessaire

### Erreur : "docker compose: command not found"

**Problème** : Docker n'est pas installé ou mal configuré sur le VPS.

**Solution** :
```bash
ssh root@72.60.185.62
docker compose version  # Vérifier que ça fonctionne
```

### Le Workflow ne se Déclenche Pas

**Vérifications** :
1. Le fichier `.github/workflows/deploy.yml` est bien dans le repo
2. Vous avez push sur la branche `master`
3. GitHub Actions est activé dans Settings → Actions

---

## 📚 Ressources

- [Documentation GitHub Actions](https://docs.github.com/en/actions)
- [Documentation Docker Compose](https://docs.docker.com/compose/)
- [Guide SSH GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

---

## ✅ Checklist de Configuration

```
Fichiers créés:
  □ .github/workflows/deploy.yml

Secrets GitHub configurés:
  □ VPS_SSH_KEY
  □ VPS_HOST
  □ VPS_USER
  □ VPS_PATH

Tests effectués:
  □ Commit test poussé sur master
  □ Workflow déclenché automatiquement
  □ Bot redémarré avec succès sur le VPS
  □ Logs vérifiés sur GitHub Actions

Configuration locale:
  □ Fichier database-pg.js corrigé (SSL désactivé)
  □ .gitignore contient .env
  □ Repository GitHub à jour
```

---

**Dernière mise à jour** : 2025-11-24
**Créé par** : Claude Code (Sonnet 4.5)
