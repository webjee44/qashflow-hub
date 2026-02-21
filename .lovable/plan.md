

# Popup Calendly anti-churn sur le Dashboard

## Objectif

Reduire le churn a l'onboarding en proposant un appel gratuit de setup aux nouveaux utilisateurs. Un popup elegant apparait apres 45 secondes sur le Dashboard, avec un lien vers Calendly.

---

## Comportement

- **Declenchement** : 45 secondes apres l'arrivee sur le Dashboard
- **Frequence** : 1 seule fois par utilisateur (flag `calendly_popup_dismissed` stocke en base dans la table `profiles`)
- **Fermeture** : bouton "Plus tard" ou clic sur le CTA. Dans les deux cas, le popup ne reapparait plus
- **CTA principal** : ouvre le lien Calendly dans un nouvel onglet
- **Design** : Dialog shadcn/ui avec icone Calendar, titre accrocheur, texte court et 2 boutons

---

## Fichiers a creer

### `src/components/onboarding/CalendlyPopup.tsx`

Composant React qui :
1. Verifie si l'utilisateur a deja ferme le popup (requete `profiles.calendly_popup_dismissed`)
2. Lance un `setTimeout(45000)` si non dismissed
3. Affiche un Dialog avec :
   - Icone Calendar + emoji main
   - Titre : "Besoin d'un coup de pouce ?"
   - Texte : "Reservez un appel gratuit de 15 min avec notre equipe pour configurer votre compte ensemble."
   - Bouton principal : "Reserver mon appel gratuit" (ouvre Calendly)
   - Bouton secondaire : "Plus tard"
4. Au clic sur l'un ou l'autre bouton, met a jour `profiles.calendly_popup_dismissed = true`

Le lien Calendly est stocke en constante dans le composant (facile a modifier).

---

## Fichiers a modifier

### `src/pages/Dashboard.tsx`

Ajouter `<CalendlyPopup />` dans le JSX, a cote du `<OnboardingTour />` existant.

---

## Schema de donnees

Ajout d'une colonne a la table `profiles` :

```text
ALTER TABLE profiles ADD COLUMN calendly_popup_dismissed BOOLEAN DEFAULT false;
```

Cela permet de persister le choix meme si l'utilisateur change de navigateur.

---

## Parcours utilisateur

```text
Inscription --> Welcome --> Dashboard
                              |
                              +-- 45s --> Popup apparait
                              |             |
                              |             +-- "Reserver" --> Calendly (nouvel onglet) + dismiss
                              |             +-- "Plus tard" --> dismiss
                              |
                              +-- (prochaine visite : pas de popup)
```

---

## Details techniques

- Composant base sur `Dialog` de shadcn/ui (deja installe)
- Animation d'entree via les classes `animate-in` natives du Dialog
- Le `setTimeout` est nettoye dans le `useEffect` cleanup pour eviter les fuites memoire
- Le lien Calendly sera en constante : vous pourrez le modifier facilement dans le fichier
