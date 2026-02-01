

# Refonte UX de la page Reglages Tresorerie

## Problemes identifies

| Probleme | Impact |
|----------|--------|
| Onglets quasi-invisibles | Utilisateurs ne savent pas qu'il y a 2 sections |
| GroupsManager non integre | Les groupes crees ne sont jamais affiches ! |
| Trop de boutons en haut | Surcharge cognitive, on ne sait pas par ou commencer |
| Actions cachees au hover | Sur mobile et pour decouverte = probleme |
| Banner AI trop imposant | Occupe beaucoup d'espace pour peu de valeur |

---

## Solution proposee

### 1. Onglets visibles et distincts

Remplacer le style actuel des onglets par un style plus visible :
- Bordure inferieure coloree pour l'onglet actif
- Fond distinct `bg-card` avec bordure
- Plus grand (`h-12`) avec icones plus visibles

```text
┌──────────────────────────────────────────────────────────────┐
│  [📁 Categories]        [⚡ Automatisations]                 │
│  ─────────────────                                           │
│     (ligne active)                                           │
└──────────────────────────────────────────────────────────────┘
```

### 2. Layout restructure en 2 colonnes

Reorganiser la page Categories :

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Reglages Tresorerie                                                     │
│ Configurez vos categories et regles d'automatisation                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [📁 Categories]  [⚡ Automatisations]                                  │
│  ═══════════════                                                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📁 Groupes (4)                              [+ Ajouter groupe]  │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  🟢 Fournisseurs (3)    ✎ 🗑                                    │   │
│  │  🔴 RH (4)              ✎ 🗑                                    │   │
│  │  🔵 Frais generaux (5)  ✎ 🗑                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Revenus (5)                      [+ Categorie] [✓ Organiser]    │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  ...                                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Depenses (12)                    [+ Categorie] [✓ Organiser]    │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  ...                                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📥 Import                                                       │   │
│  │ Importer depuis Zenfirst | Reinitialiser par defaut             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. Changements specifiques

#### A. Onglets plus visibles
```css
/* Nouveau style pour TabsList */
bg-card border shadow-sm rounded-lg p-1

/* Nouveau style pour TabsTrigger actif */
data-[state=active]:bg-primary data-[state=active]:text-primary-foreground
```

#### B. Integrer GroupsManager
Ajouter le composant `GroupsManager` qui existe deja mais n'est pas utilise dans la page.

#### C. Boutons d'action toujours visibles dans GroupsManager
Supprimer `opacity-0 group-hover:opacity-100` pour que les boutons edit/delete soient toujours affiches.

#### D. Supprimer le banner AI
Trop imposant - deplacer l'info dans un tooltip sur le titre ou simplement supprimer.

#### E. Stats compactes
Reduire la taille des 3 cartes de stats ou les integrer dans l'en-tete.

#### F. Section Import en bas
Deplacer les boutons Import Zenfirst et Categories par defaut dans une section discrete en bas de page.

---

## Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `src/pages/TreasurySettings.tsx` | Restructurer layout, integrer GroupsManager, deplacer boutons |
| `src/components/categories/GroupsManager.tsx` | Rendre les boutons toujours visibles |

---

## Details techniques

### Nouvelle structure TreasurySettings.tsx

```tsx
<Tabs>
  {/* Onglets plus visibles */}
  <TabsList className="bg-card border shadow-sm h-12 p-1.5">
    <TabsTrigger className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground h-9 px-4">
      Categories
    </TabsTrigger>
    <TabsTrigger className="...">
      Automatisations
    </TabsTrigger>
  </TabsList>

  <TabsContent value="categories">
    {/* Section Groupes - AJOUTEE */}
    <GroupsManager 
      incomeGroups={incomeGroups}
      expenseGroups={expenseGroups}
      onCreateGroup={openCreateGroupDialog}
      onEditGroup={handleEditGroup}
      onDeleteGroup={handleDeleteGroup}
    />

    {/* Tableaux Categories */}
    <CategoryTable ... />
    <CategoryTable ... />

    {/* Section Import discrete en bas */}
    <Card className="border-dashed mt-8">
      <CardContent className="flex items-center justify-center gap-4 py-4">
        <Button variant="ghost">Importer depuis Zenfirst</Button>
        <Button variant="ghost">Categories par defaut</Button>
      </CardContent>
    </Card>
  </TabsContent>
</Tabs>
```

### GroupsManager avec boutons toujours visibles

```tsx
// AVANT
className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"

// APRES
className="h-7 w-7"
```

---

## Benefices attendus

| Avant | Apres |
|-------|-------|
| Onglets invisibles | Onglets clairs avec style actif distinct |
| Groupes non affiches | Section dediee en haut de page |
| Actions cachees | Boutons toujours visibles |
| Surcharge de boutons | Actions organisees par section |
| Banner AI imposant | Supprime ou reduit |

