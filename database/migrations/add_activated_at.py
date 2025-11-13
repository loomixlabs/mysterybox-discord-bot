import psycopg2

# Connexion à la base de données
conn = psycopg2.connect(
    host="localhost",
    database="botdb",
    user="botuser",
    password="Discord2025IA@Bot"
)

cur = conn.cursor()

# Ajouter la colonne
try:
    cur.execute("ALTER TABLE themes ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP DEFAULT NULL;")
    conn.commit()
    print("✅ Colonne activated_at ajoutée avec succès")
except Exception as e:
    print(f"❌ Erreur: {e}")
    conn.rollback()

# Mettre à jour les thèmes actifs avec created_at
try:
    cur.execute("UPDATE themes SET activated_at = created_at WHERE is_active = TRUE AND activated_at IS NULL;")
    conn.commit()
    print(f"✅ {cur.rowcount} thème(s) mis à jour")
except Exception as e:
    print(f"❌ Erreur: {e}")
    conn.rollback()

# Vérifier que la colonne existe
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='themes' AND column_name='activated_at';")
result = cur.fetchone()
if result:
    print(f"✅ Colonne {result[0]} existe bien dans la table themes")
else:
    print("❌ Colonne activated_at introuvable")

cur.close()
conn.close()
