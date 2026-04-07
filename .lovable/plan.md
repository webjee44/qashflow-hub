

## Vue consolidee groupe — Cockpit CEO

### Objectif

Creer une page `/groupe` (ou section du dashboard) qui affiche en un coup d'oeil :
- Le solde consolide de toutes les societes accessibles
- Le solde individuel de chaque societe avec indicateur visuel (vert/orange/rouge)
- Les alertes critiques : solde negatif, connexion bancaire en erreur, pas de compte bancaire connecte
- Navigation rapide vers le dashboard de chaque societe

### Architecture

**Pas de nouveau endpoint ni de nouvelle table.** Les donnees existent deja :
- `companies` (filtrees par RLS via `has_company_access`) → noms des societes
- `company_bridge_accounts` + `bridge_accounts` → soldes par societe et statut connexion (`item_status`)
- Le hook `useCompany` fournit deja la liste des societes accessibles

### Composants a creer

1. **`src/hooks/useGroupBalances.ts`** — Hook unique qui pour chaque societe accessible :
   - Recupere les `company_bridge_accounts` → `bridge_accounts` (balance, item_status)
   - Calcule le solde total par societe et le solde consolide global
   - Detecte les alertes : `balance < 0`, `item_status !== 'ok'`, aucun compte assigne

2. **`src/pages/GroupOverview.tsx`** — Page principale :
   - Carte hero : solde consolide global + nombre de societes
   - Grille de cartes par societe (nom, solde, nombre de comptes, badges d'alerte)
   - Clic sur une carte → switch `currentCompany` + navigation vers `/dashboard`
   - Bandeau d'alertes en haut si des problemes sont detectes

3. **`src/components/group/CompanyCard.tsx`** — Carte individuelle par societe :
   - Nom, solde formate, mini-liste des comptes bancaires
   - Badge couleur selon le solde (vert positif, rouge negatif)
   - Icone d'alerte si connexion bancaire en erreur ou pas de compte

### Regles d'alerte

```text
┌─────────────────────────┬──────────┬────────────────────────┐
│ Condition               │ Severite │ Message                │
├─────────────────────────┼──────────┼────────────────────────┤
│ Solde societe < 0       │ Critique │ "Solde negatif"        │
│ item_status = 'error'   │ Critique │ "Connexion en erreur"  │
│ item_status = 'needs_   │ Warning  │ "Action requise"       │
│   action'               │          │                        │
│ 0 comptes bancaires     │ Info     │ "Pas de banque liee"   │
└─────────────────────────┴──────────┴────────────────────────┘
```

### Integration navigation

- Ajout d'un lien dans la sidebar (icone `Building2`, label "Vue groupe") au-dessus du dashboard, visible uniquement si l'utilisateur a acces a 2+ societes
- Route `/groupe` ajoutee dans `App.tsx` (protegee, lazy-loaded)

### Respect du modele d'acces

Le hook `useGroupBalances` s'appuie sur les RLS existantes : chaque requete passe par le client Supabase authentifie, donc seules les societes auxquelles l'utilisateur a acces (via `has_company_access`) sont retournees. Zero logique d'autorisation cote client.

### Fichiers impactes

| Fichier | Action |
|---------|--------|
| `src/hooks/useGroupBalances.ts` | Creer |
| `src/pages/GroupOverview.tsx` | Creer |
| `src/components/group/CompanyCard.tsx` | Creer |
| `src/components/layout/Sidebar.tsx` | Ajouter lien conditionnel |
| `src/App.tsx` | Ajouter route `/groupe` |

