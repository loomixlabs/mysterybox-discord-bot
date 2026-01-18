---
name: deployer-vps
description: |
  Expert déploiement VPS Hostinger avec Docker.
  ACTIVE AUTOMATIQUEMENT quand:
  - L'utilisateur demande de déployer
  - Des fichiers sont prêts à envoyer sur le VPS
  - Le bot doit être redémarré en production
  - Une mise à jour doit aller en prod

  Garantit: rebuild Docker obligatoire, vérification logs, rollback si erreur.
  JAMAIS copier sans rebuild. JAMAIS docker restart seul.
---

# Deployer VPS Expert

## Configuration VPS

```
IP: 72.60.185.62
User: root
SSH Key: ~/.ssh/id_rsa_vps_hostinger
Path: /root/bot-mysterybox/
Container: bot-mysterybox
DB Container: bot-mysterybox-db
```

## RÈGLE ABSOLUE

**TOUJOURS REBUILD après copie de fichiers**

```bash
# ❌ INTERDIT - Les changements NE SERONT PAS appliqués
scp fichier.js root@vps:/path/
# FIN sans rebuild

# ✅ OBLIGATOIRE - 3 étapes
# 1. Copier
# 2. Rebuild
# 3. Vérifier logs
```

## Procédure de Déploiement (3 étapes)

### Étape 1: Copier les Fichiers

```bash
# Fichier unique
scp -i ~/.ssh/id_rsa_vps_hostinger \
  "c:/ia mogo/bot discord/handlers/myHandler.js" \
  root@72.60.185.62:/root/bot-mysterybox/handlers/

# Dossier complet
scp -i ~/.ssh/id_rsa_vps_hostinger -r \
  "c:/ia mogo/bot discord/handlers/" \
  root@72.60.185.62:/root/bot-mysterybox/

# Plusieurs fichiers
scp -i ~/.ssh/id_rsa_vps_hostinger \
  "c:/ia mogo/bot discord/handlers/file1.js" \
  "c:/ia mogo/bot discord/handlers/file2.js" \
  root@72.60.185.62:/root/bot-mysterybox/handlers/
```

### Étape 2: Rebuild Docker (OBLIGATOIRE)

```bash
ssh -i ~/.ssh/id_rsa_vps_hostinger root@72.60.185.62 \
  'cd /root/bot-mysterybox && \
   docker compose down && \
   docker compose build --no-cache bot && \
   docker compose up -d'
```

### Étape 3: Vérifier les Logs

```bash
# Dernières lignes
ssh -i ~/.ssh/id_rsa_vps_hostinger root@72.60.185.62 \
  'docker logs bot-mysterybox --tail 30'

# Suivre en temps réel
ssh -i ~/.ssh/id_rsa_vps_hostinger root@72.60.185.62 \
  'docker logs bot-mysterybox -f'

# Chercher erreurs
ssh -i ~/.ssh/id_rsa_vps_hostinger root@72.60.185.62 \
  'docker logs bot-mysterybox 2>&1 | grep -i error | tail -10'
```

## Commandes Utiles VPS

### État des Containers

```bash
# Liste containers
ssh root@72.60.185.62 'docker ps'

# Stats ressources
ssh root@72.60.185.62 'docker stats --no-stream'
```

### Base de Données VPS

```bash
# Accéder à PostgreSQL
ssh root@72.60.185.62 'docker exec -it bot-mysterybox-db psql -U botuser -d botdb'

# Exécuter requête
ssh root@72.60.185.62 'docker exec bot-mysterybox-db psql -U botuser -d botdb -c "SELECT COUNT(*) FROM players"'
```

### Rollback d'Urgence

```bash
# Arrêter le bot
ssh root@72.60.185.62 'cd /root/bot-mysterybox && docker compose down'

# Restaurer depuis backup (si existe)
ssh root@72.60.185.62 'cd /root/bot-mysterybox && git checkout -- .'

# Relancer
ssh root@72.60.185.62 'cd /root/bot-mysterybox && docker compose up -d'
```

## Redémarrage Local (PowerShell)

```powershell
# 1. Trouver le PID
powershell -Command "Get-Process node | Select-Object Id, StartTime"

# 2. Tuer le processus
powershell -Command "Stop-Process -Id XXXX -Force"

# 3. Attendre
powershell -Command "Start-Sleep -Seconds 2"

# 4. Relancer
node index.js
```

## Méthodes INTERDITES

```bash
# ❌ JAMAIS - Ne rebuild pas l'image
docker restart bot-mysterybox

# ❌ JAMAIS - Tue TOUS les processus Node
taskkill /F /IM node.exe

# ❌ JAMAIS - Copier sans rebuild
scp fichier.js root@vps:/path/  # puis RIEN
```

## Checklist Pré-Déploiement

```
□ Code testé localement
□ Pas d'erreurs de syntaxe (node --check fichier.js)
□ CHANGELOG.md mis à jour
□ Backup fait si changement critique
□ Fichiers à copier listés
```

## Scripts de Déploiement

```bash
# Script complet
node scripts/deploy-to-vps.js handlers/myHandler.js

# Ou manuellement via /deploy-vps
```

## Mapping Chemins Local → VPS

| Local | VPS |
|-------|-----|
| `handlers/` | `/root/bot-mysterybox/handlers/` |
| `utils/` | `/root/bot-mysterybox/utils/` |
| `events/` | `/root/bot-mysterybox/events/` |
| `commands/` | `/root/bot-mysterybox/commands/` |
| `scripts/` | `/root/bot-mysterybox/scripts/` |
