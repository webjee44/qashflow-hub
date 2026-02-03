
# Plan : Isolation des comptes bancaires par société

## Contexte du problème

Actuellement, dans l'onglet **Comptes bancaires** (`/parametres#accounts`), un administrateur d'organisation voit **tous les comptes bancaires** de toutes les sociétés de l'organisation. Un utilisateur membre de "Cloud Vapor" devrait uniquement voir les comptes assignés à cette société.

Le problème vient du fait que `BankAccountsCard.tsx` récupère les comptes pour **tous les `bridge_user_uuid`** de toutes les sociétés accessibles, sans tenir compte de la société actuellement sélectionnée (`currentCompany`).

---

## Approche proposée

Créer **deux modes d'affichage** selon le rôle de l'utilisateur :

| Rôle | Vue | Actions |
|------|-----|---------|
| **Owner/Admin** de l'organisation | Tous les comptes, groupés par banque | Peut assigner/désassigner les comptes à n'importe quelle société |
| **Membre** simple d'une société | Seulement les comptes de `currentCompany` | Lecture seule (pas de modification d'assignation) |

Cette approche :
- Préserve la capacité d'administration globale pour les propriétaires
- Isole les données sensibles pour les membres
- Évite toute régression sur les fonctionnalités existantes

---

## Interface utilisateur

### Pour un Membre (ex: utilisateur de Cloud Vapor)

```text
┌───────────────────────────────────────────────────────────────────────┐
│  🏦 Comptes bancaires de Cloud Vapor                                  │
│  Solde total : 30 981,95 €                                           │
├───────────────────────────────────────────────────────────────────────┤
│  ▼ Banque Populaire                           1 compte    30 981,95 € │
│    ┌───────────────────────────────────────────────────────────────┐  │
│    │ Cloud Vapor           Checking    •••• 2484      30 981,95 €  │  │
│    └───────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

- **Pas de switch** pour activer/désactiver
- **Pas de sélecteur** de société
- Juste un affichage informatif des comptes assignés à sa société

### Pour un Owner/Admin

Garde l'interface actuelle avec tous les comptes et la possibilité de les assigner.

---

## Modifications techniques

### 1. Modifier `BankAccountsCard.tsx`

**Ajouter la détection du rôle :**
```typescript
import { useOrganization } from '@/hooks/useOrganization';

const { isOwner, isAdmin } = useOrganization();
const isOrgAdmin = isOwner || isAdmin;
```

**Filtrer les comptes selon le contexte :**
```typescript
// Pour un membre : ne charger que les comptes de currentCompany
const bridgeUserUuids = isOrgAdmin 
  ? [...new Set(companies.filter(c => c.bridge_user_uuid).map(c => c.bridge_user_uuid as string))]
  : currentCompany?.bridge_user_uuid 
    ? [currentCompany.bridge_user_uuid] 
    : [];

// Filtrer les assignations par company_id pour les membres
const assignmentsQuery = supabase
  .from('company_bridge_accounts')
  .select('bridge_account_id, company_id');

if (!isOrgAdmin && currentCompany) {
  assignmentsQuery.eq('company_id', currentCompany.id);
}
```

**Filtrer les comptes affichés :**
```typescript
// Pour les membres : ne montrer que les comptes assignés à leur société
const displayedAccounts = isOrgAdmin 
  ? accounts 
  : accounts.filter(account => {
      const assignment = assignments.get(account.bridge_account_id);
      return assignment?.is_enabled && assignment?.company_id === currentCompany?.id;
    });
```

**Masquer les contrôles pour les membres :**
```typescript
// Dans le rendu des comptes
{isOrgAdmin && (
  <Switch
    checked={isEnabled}
    onCheckedChange={(checked) => onToggle(account.bridge_account_id, checked)}
  />
)}

{isOrgAdmin ? (
  <Select ... />
) : (
  <Badge variant="outline">
    <Building2 className="w-3 h-3 mr-1" />
    {currentCompany?.name}
  </Badge>
)}
```

### 2. Adapter l'en-tête et les actions

Pour les membres, masquer les boutons "Ajouter banque" et "Synchroniser" :

```typescript
// Header buttons
{isOrgAdmin && (
  <>
    <Button onClick={handleConnectBridge}>+ Ajouter banque</Button>
    <Button onClick={handleFullSync}>Synchroniser</Button>
  </>
)}
```

### 3. Sécuriser la sauvegarde (anti-régression)

Modifier `handleSave` pour ne supprimer que les assignations pertinentes :

```typescript
const handleSave = async () => {
  // Pour les admins : supprimer uniquement les assignations des comptes affichés
  const accountIds = accounts.map(a => a.bridge_account_id);
  
  await supabase
    .from('company_bridge_accounts')
    .delete()
    .in('bridge_account_id', accountIds);
  
  // Reste inchangé...
};
```

---

## Fichiers impactés

| Fichier | Modifications |
|---------|---------------|
| `src/components/settings/BankAccountsCard.tsx` | Ajouter filtrage par rôle, masquer contrôles pour membres |

---

## Points de vigilance (anti-régression)

1. **RLS existant** : La table `company_bridge_accounts` utilise déjà `has_company_access()` → pas de changement nécessaire côté DB
2. **Logique de synchronisation** : Les fonctions `bridge-sync` restent identiques, seul l'affichage change
3. **Calcul du solde** : Le hook `useBankBalance` filtre déjà par `currentCompany.id` → pas d'impact
4. **Transactions** : La vue transactions filtre déjà par société → pas d'impact

---

## Résultat attendu

| Scénario | Avant | Après |
|----------|-------|-------|
| Admin sur `/parametres#accounts` | Voit tous les comptes | Inchangé |
| Membre Cloud Vapor sur `/parametres#accounts` | Voit tous les comptes de l'org | Voit seulement les comptes de Cloud Vapor |
| Membre tente de modifier une assignation | Peut modifier | Lecture seule (badges au lieu de selects) |
