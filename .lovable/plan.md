

# Plan : Gestion simplifiée des membres via SuperAdmin

## Contexte actuel

Le système actuel est trop complexe :
1. Invitations avec tokens, emails, expiration
2. Triggers multiples sur `auth.users`  
3. Problèmes de synchronisation entre `organization_members` et `company_members`
4. Auto-création de BP/settings parasites (corrigé mais symptôme du problème)

## Nouvelle approche simplifiée

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SUPERADMIN : Gestion centralisée des membres                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Ajouter un membre à une ORGANISATION (par email)                       │
│     └─► Si l'utilisateur existe → ajout direct à organization_members      │
│     └─► Si n'existe pas → message "utilisateur non inscrit"                │
│                                                                             │
│  2. Toggle de visibilité par SOCIÉTÉ                                        │
│     └─► Switch ON = ajoute à company_members                               │
│     └─► Switch OFF = retire de company_members                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Modifications à apporter

### 1. Nouvelle section "Membres de l'organisation" dans OrganizationDetail.tsx

**Nouvelle Card** avec :
- Liste des membres actuels de l'organisation (avec rôle)
- Formulaire pour ajouter un membre par email
- Bouton supprimer pour retirer un membre

```text
┌─────────────────────────────────────────────────────────────┐
│ 👥 Membres de l'organisation                               │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ nixonshop@... (owner)              [Propriétaire] 🔒    │ │
│ │ cloud.vapor@... (member)           [Membre] [🗑️]       │ │
│ │ test@... (viewer)                  [Lecteur] [🗑️]      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌──────────────────────────┬──────────┬──────────┐         │
│ │ email@utilisateur.com    │ [Rôle ▼] │ Ajouter │         │
│ └──────────────────────────┴──────────┴──────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 2. Refonte de CompanyMembersManager avec Toggles

Remplacer le système d'invitation par des **switches simples** :

```text
┌─────────────────────────────────────────────────────────────┐
│ 🏢 Cloud Vapor                                    2 membres │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  nixonshop@...     [Propriétaire]              ✓ (locked)  │
│  cloud.vapor@...   [Membre]                    [🔘 ON ]    │
│  test@...          [Lecteur]                   [  OFF 🔘]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

- Affiche TOUS les membres de l'organisation
- Toggle ON = ajoute à `company_members`
- Toggle OFF = retire de `company_members`
- Le propriétaire de la société est toujours ON (verrouillé)

---

## Section technique

### Nouvelles fonctions SQL nécessaires

```sql
-- 1. Ajouter un membre à l'organisation par email
CREATE OR REPLACE FUNCTION add_organization_member_by_email(
  _org_id UUID,
  _email TEXT,
  _role app_role DEFAULT 'member'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  _user_id UUID;
BEGIN
  -- Trouver l'utilisateur par email
  SELECT id INTO _user_id 
  FROM auth.users 
  WHERE email = lower(trim(_email));
  
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  END IF;
  
  -- Vérifier s'il est déjà membre
  IF EXISTS (SELECT 1 FROM organization_members WHERE organization_id = _org_id AND user_id = _user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Déjà membre');
  END IF;
  
  -- Ajouter à l'organisation
  INSERT INTO organization_members (organization_id, user_id, role, joined_at)
  VALUES (_org_id, _user_id, _role, now());
  
  RETURN jsonb_build_object('success', true, 'user_id', _user_id);
END;
$$;

-- 2. Récupérer tous les membres de l'org avec leur accès par société
CREATE OR REPLACE FUNCTION get_org_members_with_company_access(
  _org_id UUID
)
RETURNS TABLE (
  member_id UUID,
  user_id UUID,
  email TEXT,
  role app_role,
  joined_at TIMESTAMPTZ,
  companies JSONB -- [{company_id, company_name, has_access}]
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    om.id as member_id,
    om.user_id,
    au.email,
    om.role,
    om.joined_at,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'company_id', c.id,
        'company_name', c.name,
        'has_access', EXISTS (
          SELECT 1 FROM company_members cm 
          WHERE cm.company_id = c.id AND cm.user_id = om.user_id
        ),
        'is_owner', c.user_id = om.user_id
      ))
      FROM companies c
      WHERE c.organization_id = _org_id AND c.deleted_at IS NULL
    ) as companies
  FROM organization_members om
  JOIN auth.users au ON au.id = om.user_id
  WHERE om.organization_id = _org_id
  ORDER BY om.role, om.joined_at;
END;
$$;

-- 3. Toggle accès société
CREATE OR REPLACE FUNCTION toggle_company_member_access(
  _company_id UUID,
  _user_id UUID,
  _enable BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF _enable THEN
    INSERT INTO company_members (company_id, user_id)
    VALUES (_company_id, _user_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM company_members
    WHERE company_id = _company_id AND user_id = _user_id;
  END IF;
  RETURN true;
END;
$$;
```

### Nouveau composant : OrganizationMembersSection

Fichier : `src/components/superadmin/OrganizationMembersSection.tsx`

- Affiche les membres de l'organisation
- Formulaire d'ajout par email (avec sélecteur de rôle)
- Bouton supprimer (sauf owner)
- Appelle `add_organization_member_by_email` via RPC

### Modification : CompanyMembersManager

Transformer le composant actuel :
- Supprimer le système d'invitation (email + token)
- Afficher TOUS les membres de l'org
- Ajouter un Switch (toggle) pour chaque membre
- Le toggle ON/OFF appelle `toggle_company_member_access`
- Le propriétaire de la société = switch verrouillé ON

---

## Fichiers à modifier/créer

| Fichier | Action |
|---------|--------|
| Migration SQL | Créer les 3 fonctions RPC |
| `src/components/superadmin/OrganizationMembersSection.tsx` | Nouveau composant |
| `src/components/superadmin/CompanyMembersManager.tsx` | Refonte avec toggles |
| `src/pages/SuperAdmin/OrganizationDetail.tsx` | Ajouter OrganizationMembersSection |

---

## Résultat attendu

1. **SuperAdmin** ouvre une organisation
2. Voit la liste des membres existants
3. Peut **ajouter un membre par email** (utilisateur existant)
4. Pour chaque société, peut **activer/désactiver l'accès** via toggle
5. Plus de système d'invitation complexe
6. Plus de création de données parasites

