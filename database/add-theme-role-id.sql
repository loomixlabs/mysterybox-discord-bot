-- Ajouter la colonne final_role_id à la table themes
-- Cette colonne stockera l'ID du rôle Discord créé pour le thème

ALTER TABLE themes ADD COLUMN final_role_id TEXT;

-- Vérification
SELECT 'Column final_role_id added successfully!' AS status;
