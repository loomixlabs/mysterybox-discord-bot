#!/bin/bash
# ============================================================
# SCRIPT DE DÉPLOIEMENT VPS - 2024-12-14
# ============================================================
# Usage: ./scripts/deploy-to-vps.sh
# ============================================================

set -e  # Arrêter en cas d'erreur

VPS_HOST="root@72.60.185.62"
VPS_PATH="/root/bot-mysterybox"
SSH_KEY="~/.ssh/id_rsa_vps_hostinger"
LOCAL_PATH="c:/ia mogo/bot discord"

echo "============================================================"
echo "🚀 DÉPLOIEMENT VPS - Bot MysteryBox"
echo "============================================================"
echo ""

# Étape 1: Stopper le bot sur le VPS
echo "📦 Étape 1/5: Arrêt du bot sur le VPS..."
ssh -i $SSH_KEY $VPS_HOST "cd $VPS_PATH && docker-compose stop bot-mysterybox" || true
echo "✅ Bot arrêté"
echo ""

# Étape 2: Backup de la base de données
echo "💾 Étape 2/5: Sauvegarde de la base de données..."
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
ssh -i $SSH_KEY $VPS_HOST "docker exec bot-mysterybox-db pg_dump -U botuser -d botdb > /root/backups/botdb_$BACKUP_DATE.sql"
echo "✅ Backup créé: botdb_$BACKUP_DATE.sql"
echo ""

# Étape 3: Appliquer la migration
echo "🔄 Étape 3/5: Application de la migration SQL..."
scp -i $SSH_KEY "$LOCAL_PATH/database/migrations/vps-sync-2024-12-14.sql" $VPS_HOST:/tmp/migration.sql
ssh -i $SSH_KEY $VPS_HOST "docker exec -i bot-mysterybox-db psql -U botuser -d botdb < /tmp/migration.sql"
echo "✅ Migration appliquée"
echo ""

# Étape 4: Transfert des fichiers (exclure .env et node_modules)
echo "📤 Étape 4/5: Transfert des fichiers..."
rsync -avz --progress \
  --exclude '.env' \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'backups' \
  --exclude 'temp_*' \
  --exclude '*.md' \
  --exclude 'scripts/*.js' \
  --exclude 'database-schema.json' \
  -e "ssh -i $SSH_KEY" \
  "$LOCAL_PATH/" $VPS_HOST:$VPS_PATH/
echo "✅ Fichiers transférés"
echo ""

# Étape 5: Redémarrer le bot
echo "🔄 Étape 5/5: Redémarrage du bot..."
ssh -i $SSH_KEY $VPS_HOST "cd $VPS_PATH && docker-compose up -d bot-mysterybox"
echo "✅ Bot redémarré"
echo ""

# Vérification finale
echo "🔍 Vérification des logs..."
sleep 5
ssh -i $SSH_KEY $VPS_HOST "docker logs --tail 20 bot-mysterybox"

echo ""
echo "============================================================"
echo "✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS!"
echo "============================================================"
