
# Plan : Système d'invitation par lien privé

## Objectif

Permettre d'inviter des utilisateurs (existants ou nouveaux) à rejoindre une organisation **sans qu'ils créent leur propre tenant**.

## Architecture proposée

### 1. Nouvelle table `organization_invitations`

Stocke les invitations en attente avec un token unique :

```sql
CREATE TABLE public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  company_ids uuid[] DEFAULT NULL, -- Restriction optionnelle à certaines sociétés
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2. Modifier le trigger `handle_new_user`

Avant de créer un tenant, vérifier s'il existe une invitation :

```sql
-- Vérifier si une invitation existe pour cet email
IF EXISTS (
  SELECT 1 FROM organization_invitations
  WHERE email = lower(NEW.email)
    AND accepted_at IS NULL
    AND expires_at > now()
) THEN
  -- Récupérer l'invitation
  SELECT * INTO v_invitation FROM organization_invitations
  WHERE email = lower(NEW.email) AND accepted_at IS NULL AND expires_at > now()
  LIMIT 1;
  
  -- Créer le profil seulement
  INSERT INTO profiles (id, full_name) VALUES (...);
  
  -- L'ajouter comme membre de l'organisation
  INSERT INTO organization_members (organization_id, user_id, role, joined_at)
  VALUES (v_invitation.organization_id, NEW.id, v_invitation.role, now());
  
  -- Marquer l'invitation comme acceptée
  UPDATE organization_invitations SET accepted_at = now() WHERE id = v_invitation.id;
  
  -- NE PAS créer d'organisation ni de société
  RETURN NEW;
END IF;
```

### 3. Interface d'invitation (Superadmin + Settings)

**Nouveau composant `InviteMemberDialog`** :
- Champ email
- Sélection du rôle (viewer, member, admin)
- Restriction aux sociétés spécifiques (optionnel)
- Bouton "Générer le lien"
- Affichage du lien copiable

### 4. Page d'inscription via invitation `/join`

Nouvelle route qui :
- Lit le token depuis l'URL (`/join?token=xxx`)
- Affiche les infos de l'invitation (organisation, rôle)
- Formulaire simplifié (email pré-rempli, mot de passe)
- Crée le compte avec métadonnée `invitation_token`

### 5. Gestion des utilisateurs existants

Si l'email invité a déjà un compte :
- Afficher directement un bouton "Accepter l'invitation"
- Ajouter à l'organisation sans créer de nouveau compte

---

## Fichiers à créer/modifier

| Fichier | Action | Description |
|---------|--------|-------------|
| Migration SQL | Créer | Table `organization_invitations` + modifier trigger |
| `src/pages/JoinInvitation.tsx` | Créer | Page d'inscription via invitation |
| `src/components/settings/InviteMemberDialog.tsx` | Créer | Dialog pour générer un lien d'invitation |
| `src/hooks/useInvitations.ts` | Créer | Hook pour gérer les invitations |
| `src/App.tsx` | Modifier | Ajouter route `/join` |
| `src/components/settings/OrganizationMembersCard.tsx` | Modifier | Intégrer le nouveau système |
| `src/components/superadmin/CompanyMembersManager.tsx` | Modifier | Ajouter option invitation |

---

## Flux utilisateur

```text
┌─────────────────────────────────────────────────────────────────┐
│                    INVITATION FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Owner/Admin                                                     │
│      │                                                           │
│      ▼                                                           │
│  [Inviter un membre]                                             │
│      │                                                           │
│      ├─► Email + Rôle + (Sociétés optionnel)                    │
│      │                                                           │
│      ▼                                                           │
│  Génération du lien                                              │
│  https://app.qashflow.fr/join?token=abc123...                   │
│      │                                                           │
│      ▼                                                           │
│  Envoi par email (ou copier/coller)                             │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Utilisateur invité                                              │
│      │                                                           │
│      ▼                                                           │
│  Clique sur le lien                                              │
│      │                                                           │
│      ├── A déjà un compte ? ──► Connexion ──► Accepte ──► OK    │
│      │                                                           │
│      └── Nouveau ? ──► Formulaire simplifié                     │
│                            │                                     │
│                            ▼                                     │
│                     Création compte                              │
│                     (trigger détecte invitation)                 │
│                            │                                     │
│                            ▼                                     │
│                     Rattaché à l'organisation                    │
│                     PAS de création de tenant                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Avantages

1. **Pas de tenant parasite** : Les invités ne créent pas d'organisation inutile
2. **Lien sécurisé** : Token unique avec expiration (7 jours)
3. **UX simplifiée** : Moins d'étapes pour l'invité
4. **Flexible** : Fonctionne pour nouveaux ET anciens utilisateurs
5. **Restriction par société** : Possibilité de limiter l'accès à certaines sociétés

---

## Section technique

### RLS Policies pour `organization_invitations`

```sql
-- Admins peuvent créer des invitations
CREATE POLICY "Org admins can create invitations"
ON organization_invitations FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), organization_id));

-- Admins peuvent voir leurs invitations
CREATE POLICY "Org admins can view invitations"
ON organization_invitations FOR SELECT
USING (is_org_admin(auth.uid(), organization_id));

-- Lecture publique via token (pour la page /join)
CREATE POLICY "Anyone can read valid invitation by token"
ON organization_invitations FOR SELECT
USING (
  expires_at > now() 
  AND accepted_at IS NULL
);
```

### Fonction SQL pour accepter une invitation

```sql
CREATE OR REPLACE FUNCTION accept_invitation(_token text)
RETURNS jsonb AS $$
DECLARE
  v_invitation organization_invitations;
  v_user_id uuid := auth.uid();
BEGIN
  -- Récupérer l'invitation
  SELECT * INTO v_invitation
  FROM organization_invitations
  WHERE token = _token
    AND expires_at > now()
    AND accepted_at IS NULL;
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitation invalide ou expirée');
  END IF;
  
  -- Ajouter comme membre
  INSERT INTO organization_members (organization_id, user_id, role, joined_at)
  VALUES (v_invitation.organization_id, v_user_id, v_invitation.role, now())
  ON CONFLICT DO NOTHING;
  
  -- Marquer comme acceptée
  UPDATE organization_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;
  
  RETURN jsonb_build_object('success', true, 'organization_id', v_invitation.organization_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
