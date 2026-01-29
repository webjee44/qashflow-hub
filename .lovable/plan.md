
# Plan : Attribution des sociétés dès la création du lien d'invitation

## Objectif
Simplifier le workflow d'invitation en permettant d'attribuer les sociétés directement lors de la création du lien, réduisant le processus de 3 étapes à 2 :
- **Avant** : Créer lien → Inscription → Association société (3 clics)
- **Après** : Créer lien + sociétés → Inscription avec accès automatique (2 clics)

## Workflow cible

```text
┌────────────────────────────────────┐
│  SuperAdmin : Créer invitation     │
│  ┌────────────────────────────┐    │
│  │ Email: user@example.com    │    │
│  │ Rôle: Membre               │    │
│  │ ☑ Retail Shoes             │    │
│  │ ☐ CloudSoft                │    │
│  │ ☑ GoodAgency               │    │
│  └────────────────────────────┘    │
│        [Générer le lien]           │
└────────────────────────────────────┘
                 ↓
   Invitation créée avec company_ids
                 ↓
┌────────────────────────────────────┐
│  Utilisateur clique sur le lien    │
│  S'inscrit → handle_new_user       │
│  détecte company_ids et ajoute     │
│  automatiquement aux sociétés      │
└────────────────────────────────────┘
```

## Modifications techniques

### 1. Modifier `SuperAdminInviteDialog.tsx`

**Ajouts :**
- Query pour charger les sociétés de l'organisation via `get_superadmin_org_companies`
- Checkbox multiple pour sélectionner les sociétés
- Validation : au moins une société doit être sélectionnée
- Envoi du champ `company_ids` lors de la création de l'invitation

**Code modifié :**
```typescript
// Nouveau schéma avec validation sociétés obligatoires
const inviteSchema = z.object({
  email: z.string().email('Email invalide'),
  role: z.enum(['member'] as const),
  company_ids: z.array(z.string()).min(1, 'Sélectionnez au moins une société'),
});

// Query pour charger les sociétés
const { data: companies = [] } = useQuery({
  queryKey: ['superadmin-org-companies', organizationId],
  queryFn: async () => {
    const { data } = await supabase.rpc('get_superadmin_org_companies', {
      _org_id: organizationId
    });
    return data || [];
  },
});

// Insertion avec company_ids
.insert({
  organization_id: organizationId,
  email: params.email,
  role: params.role,
  company_ids: params.company_ids, // ← Nouveau
  invited_by: user?.id,
})
```

### 2. Interface utilisateur ajoutée

Section dans le formulaire :
```text
┌─────────────────────────────────┐
│ Accès aux sociétés (requis)     │
│ ☑ Retail Shoes                  │
│ ☐ CloudSoft                     │
│ ☐ GoodAgency                    │
│                                 │
│ ⚠ Sélectionnez au moins une    │
└─────────────────────────────────┘
```

### 3. Aucune modification base de données requise

Le système existant supporte déjà cette fonctionnalité :
- La table `organization_invitations` a déjà la colonne `company_ids` (uuid[])
- Le trigger `handle_new_user` gère déjà l'insertion dans `company_members` quand `company_ids` est rempli

### 4. Affichage des sociétés sélectionnées dans le récapitulatif

Après génération du lien, afficher :
```text
Email: user@example.com
Rôle: Membre
Sociétés: Retail Shoes, GoodAgency
Expire le: 5 février 2026
```

## Fichiers impactés

| Fichier | Modification |
|---------|--------------|
| `src/components/superadmin/SuperAdminInviteDialog.tsx` | Ajout sélection sociétés + validation |

## Comportement final

1. **SuperAdmin** ouvre le dialog d'invitation
2. Saisit l'email, voit la liste des sociétés avec checkboxes
3. Coche au moins une société (obligatoire)
4. Génère le lien → `company_ids` sauvegardé dans l'invitation
5. **Utilisateur** reçoit le lien, s'inscrit
6. Le trigger `handle_new_user` détecte l'invitation et ajoute automatiquement l'utilisateur aux sociétés cochées
7. L'utilisateur arrive directement avec accès aux sociétés, sans action supplémentaire
