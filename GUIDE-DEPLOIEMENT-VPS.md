# Guide de Déploiement sur VPS Hostinger

> **Version**: 1.0.0
> **Date**: 2025-11-24
> **Bot Version**: 1.9.1

---

## 📋 Prérequis

### Sur votre machine locale
- [x] Bot fonctionnel en local
- [x] Git installé
- [x] Accès SSH à votre VPS Hostinger

### Sur le VPS Hostinger
- [ ] Ubuntu/Debian (recommandé)
- [ ] Node.js 20+ installé
- [ ] PostgreSQL 14+ installé
- [ ] PM2 installé (pour maintenir le bot actif)
- [ ] Git installé

---

## 🚀 Étape 1: Préparer le VPS

### 1.1 Connexion SSH

```bash
# Remplacer par vos informations VPS
ssh root@VOTRE_IP_VPS
# ou
ssh utilisateur@VOTRE_IP_VPS
```

### 1.2 Mettre à jour le système

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Installer Node.js 20+

```bash
# Installer Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier l'installation
node -v  # Devrait afficher v20.x.x
npm -v   # Devrait afficher 10.x.x
```

### 1.4 Installer PostgreSQL

```bash
# Installer PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Démarrer PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Vérifier le statut
sudo systemctl status postgresql
```

### 1.5 Installer PM2

```bash
# Installer PM2 globalement
sudo npm install -g pm2

# Configurer PM2 pour démarrer au boot
pm2 startup
# Suivre les instructions affichées
```

### 1.6 Installer Git

```bash
sudo apt install -y git
```

---

## 🗄️ Étape 2: Configurer PostgreSQL

### 2.1 Créer l'utilisateur et la base de données

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Dans psql, exécuter:
CREATE USER botuser WITH PASSWORD 'VotreMotDePasseSecurise123!';
CREATE DATABASE botdb OWNER botuser;
GRANT ALL PRIVILEGES ON DATABASE botdb TO botuser;

# Quitter psql
\q
```

### 2.2 Configurer l'accès distant (optionnel)

```bash
# Éditer pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Ajouter cette ligne (remplacer VOTRE_IP_LOCALE par votre IP):
# host    botdb           botuser         VOTRE_IP_LOCALE/32      md5

# Éditer postgresql.conf
sudo nano /etc/postgresql/*/main/postgresql.conf

# Décommenter et modifier:
# listen_addresses = 'localhost,VOTRE_IP_VPS'

# Redémarrer PostgreSQL
sudo systemctl restart postgresql
```

---

## 📦 Étape 3: Transférer le Code

### Option A: Via Git (Recommandé)

#### 3.1 Créer un dépôt Git privé

```bash
# Sur votre machine locale
cd "C:\ia mogo\bot discord"

# Initialiser Git si pas déjà fait
git init

# Créer .gitignore
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "temp_images/" >> .gitignore
echo "backups/" >> .gitignore

# Commit initial
git add .
git commit -m "Initial commit for VPS deployment"

# Ajouter le remote (GitHub/GitLab/Bitbucket)
git remote add origin https://github.com/VOTRE_USERNAME/VOTRE_REPO.git
git push -u origin master
```

#### 3.2 Cloner sur le VPS

```bash
# Sur le VPS, créer le dossier de l'application
mkdir -p ~/bot-discord
cd ~/bot-discord

# Cloner le repo
git clone https://github.com/VOTRE_USERNAME/VOTRE_REPO.git .

# Alternative: Si repo privé
git clone https://VOTRE_TOKEN@github.com/VOTRE_USERNAME/VOTRE_REPO.git .
```

### Option B: Via SFTP/SCP

```bash
# Sur votre machine locale (depuis PowerShell/CMD)
# Compresser le projet (exclure node_modules)
# Puis utiliser SCP:

scp -r "C:\ia mogo\bot discord" utilisateur@VOTRE_IP_VPS:~/bot-discord

# Exclure les dossiers inutiles manuellement après
```

---

## ⚙️ Étape 4: Configurer l'Environnement

### 4.1 Créer le fichier .env

```bash
# Sur le VPS
cd ~/bot-discord
nano .env
```

Copier ce contenu (remplacer les valeurs):

```env
# ==================== Discord Configuration ====================
DISCORD_TOKEN=votre_vrai_token_discord
APPLICATION_ID=votre_application_id
GUILD_ID=votre_guild_id_principal

# ==================== PostgreSQL Production ====================
DATABASE_URL=postgresql://botuser:VotreMotDePasseSecurise123!@localhost:5432/botdb

# ==================== Permissions ====================
CO_FOUNDER_ROLE_ID=votre_role_cofondateur_id

# ==================== Salons Discord ====================
ANNOUNCE_CHANNEL_ID=votre_salon_annonces_id
GIVE_CATEGORY_ID=votre_categorie_gives_id

# ==================== Super Admin ====================
OWNER_DISCORD_ID=votre_discord_user_id

# ==================== Environment ====================
NODE_ENV=production
```

Sauvegarder: `Ctrl+X`, `Y`, `Enter`

### 4.2 Sécuriser le fichier .env

```bash
chmod 600 .env
```

---

## 🔧 Étape 5: Installer et Initialiser

### 5.1 Installer les dépendances

```bash
cd ~/bot-discord
npm install --production
```

### 5.2 Initialiser la base de données

```bash
# Si vous avez un schéma SQL initial
psql -U botuser -d botdb -f database/schema.sql

# Ou via Node.js si vous avez un script
node scripts/init-database.js
```

### 5.3 Déployer les commandes Discord

```bash
# Déployer les commandes slash
node deploy-commands.js
```

---

## 🚦 Étape 6: Lancer le Bot avec PM2

### 6.1 Créer le fichier ecosystem PM2

```bash
nano ecosystem.config.js
```

Copier ce contenu:

```javascript
module.exports = {
  apps: [{
    name: 'bot-discord',
    script: './index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
```

### 6.2 Créer le dossier logs

```bash
mkdir -p logs
```

### 6.3 Lancer le bot

```bash
# Démarrer avec PM2
pm2 start ecosystem.config.js

# Vérifier le statut
pm2 status

# Voir les logs en temps réel
pm2 logs bot-discord

# Voir les logs d'erreur
pm2 logs bot-discord --err

# Sauvegarder la configuration PM2
pm2 save
```

### 6.4 Commandes PM2 utiles

```bash
# Redémarrer le bot
pm2 restart bot-discord

# Arrêter le bot
pm2 stop bot-discord

# Supprimer de PM2
pm2 delete bot-discord

# Voir les détails
pm2 show bot-discord

# Monitorer en temps réel
pm2 monit
```

---

## 🔄 Étape 7: Mises à Jour Futures

### Script de mise à jour automatique

Créer un script `update.sh`:

```bash
nano ~/bot-discord/update.sh
```

Contenu:

```bash
#!/bin/bash
echo "🔄 Mise à jour du bot..."

cd ~/bot-discord

# Sauvegarder les changements locaux
git stash

# Récupérer les derniers changements
git pull origin master

# Restaurer les changements locaux si nécessaire
git stash pop || true

# Installer les nouvelles dépendances
npm install --production

# Redémarrer le bot
pm2 restart bot-discord

echo "✅ Mise à jour terminée!"
pm2 logs bot-discord
```

Rendre exécutable:

```bash
chmod +x ~/bot-discord/update.sh
```

Utilisation:

```bash
~/bot-discord/update.sh
```

---

## 🛡️ Étape 8: Sécurité

### 8.1 Configurer le pare-feu (UFW)

```bash
# Installer UFW
sudo apt install -y ufw

# Autoriser SSH
sudo ufw allow 22/tcp

# Autoriser PostgreSQL (si accès distant nécessaire)
# sudo ufw allow 5432/tcp

# Activer le pare-feu
sudo ufw enable

# Vérifier le statut
sudo ufw status
```

### 8.2 Sauvegardes automatiques PostgreSQL

Créer un script de backup:

```bash
nano ~/backup-db.sh
```

Contenu:

```bash
#!/bin/bash
BACKUP_DIR=~/backups
DB_NAME=botdb
DB_USER=botuser
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

PGPASSWORD='VotreMotDePasseSecurise123!' pg_dump -U $DB_USER -d $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Garder seulement les 7 derniers backups
ls -t $BACKUP_DIR/backup_*.sql | tail -n +8 | xargs rm -f

echo "✅ Backup créé: backup_$DATE.sql"
```

Rendre exécutable:

```bash
chmod +x ~/backup-db.sh
```

Ajouter au cron (backup quotidien à 3h du matin):

```bash
crontab -e

# Ajouter cette ligne:
0 3 * * * ~/backup-db.sh
```

---

## 📊 Étape 9: Monitoring

### 9.1 Vérifier que le bot fonctionne

```bash
# Statut PM2
pm2 status

# Logs en temps réel
pm2 logs bot-discord --lines 50

# Utilisation ressources
pm2 monit
```

### 9.2 Vérifier la base de données

```bash
# Se connecter à PostgreSQL
psql -U botuser -d botdb

# Vérifier les tables
\dt

# Vérifier quelques données
SELECT COUNT(*) FROM players;
SELECT * FROM themes LIMIT 5;

# Quitter
\q
```

### 9.3 Tester sur Discord

1. Aller sur votre serveur Discord
2. Tester une commande: `/admin-panel`
3. Vérifier les logs: `pm2 logs bot-discord`

---

## 🐛 Dépannage

### Le bot ne démarre pas

```bash
# Vérifier les logs d'erreur
pm2 logs bot-discord --err --lines 100

# Vérifier les variables d'environnement
cat .env

# Tester manuellement
node index.js
# Ctrl+C pour arrêter
```

### Erreur de connexion PostgreSQL

```bash
# Vérifier que PostgreSQL fonctionne
sudo systemctl status postgresql

# Tester la connexion
psql -U botuser -d botdb -h localhost

# Vérifier les credentials dans .env
cat .env | grep DATABASE_URL
```

### Bot déconnecté après quelques heures

```bash
# Vérifier les logs PM2
pm2 logs bot-discord --lines 200

# Augmenter la mémoire max dans ecosystem.config.js
max_memory_restart: '1G'

# Redémarrer
pm2 restart bot-discord
```

### Erreur "Unknown interaction"

- Vérifier que les commandes sont bien déployées: `node deploy-commands.js`
- Attendre 5-10 minutes pour la propagation Discord
- Redémarrer le bot: `pm2 restart bot-discord`

---

## 📋 Checklist Finale

```
✅ Node.js 20+ installé sur le VPS
✅ PostgreSQL installé et configuré
✅ Base de données créée (botdb)
✅ Code transféré sur le VPS
✅ Fichier .env configuré avec les vraies valeurs
✅ Dépendances npm installées
✅ Schéma DB initialisé
✅ Commandes Discord déployées
✅ PM2 configuré et bot lancé
✅ Bot visible en ligne sur Discord
✅ Commandes testées et fonctionnelles
✅ Logs PM2 sans erreurs
✅ Backups automatiques configurés
✅ Script de mise à jour créé
```

---

## 🎯 Résumé des Commandes Essentielles

```bash
# Lancer le bot
pm2 start ecosystem.config.js

# Voir les logs
pm2 logs bot-discord

# Redémarrer
pm2 restart bot-discord

# Mettre à jour
~/bot-discord/update.sh

# Backup DB
~/backup-db.sh

# Vérifier le statut
pm2 status
```

---

## 📞 Support

En cas de problème:
1. Consulter les logs: `pm2 logs bot-discord --lines 100`
2. Vérifier la base de données: `psql -U botuser -d botdb`
3. Tester en mode debug: `NODE_ENV=development node index.js`

---

**Dernière mise à jour**: 2025-11-24
**Auteur**: Claude Code
**Version**: 1.0.0
