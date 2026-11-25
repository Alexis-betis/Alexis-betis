# Site carrière · module Profilr (prototype V2)

Un module qui permet à une équipe RH de créer son site carrière dans Profilr :
des pages marque employeur construites avec des blocs, des offres publiées comme des articles de blog (avec programmation et multidiffusion),
un formulaire de candidature dont les réponses arrivent dans Profilr, des statistiques et un site multilingue.

Le site prend la charte Profilr par défaut (vert sapin `#043428`, citron `#DFFFA5`, Clash Display + Figtree, logo Profilr).
Logo, nom, couleurs, polices et formes se changent dans l'onglet **Thème**, pour les clients qui ont leur propre marque.

## Lancer le prototype

Aucune dépendance, aucun build nécessaire :

```bash
cd career-site
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000>. Pour une version en un seul fichier, à envoyer ou ouvrir par double-clic :

```bash
node build.mjs
```

Le fichier est créé dans `dist/site-carriere.html`.

Les données (brouillon, versions, candidatures, statistiques) sont gardées dans le `localStorage` du navigateur.
**Paramètres → Réinitialiser la démo** remet le contenu d'exemple.

## Fonctionnalités

| Onglet | Fonctionnalités |
|---|---|
| **Pages** | Plusieurs pages (Accueil, Vie chez nous…), chacune avec son titre, son adresse et sa présence dans le menu. 16 types de blocs : bandeau, texte, texte + image, chiffres clés, valeurs, avantages, équipes et métiers, bureaux et localisations, galerie, vidéo, témoignages, logos et labels, process, liste des offres, FAQ, appel à l'action. Glisser-déposer, duplication, masquage, déplacement vers une autre page, texte alternatif des images. |
| **Offres** | Brouillon, publiée ou archivée. **Mise en ligne programmée** à une date et une heure. Date limite. Projet Profilr lié. **Multidiffusion** vers les jobboards connectés dans Profilr (LinkedIn, Indeed, Welcome to the Jungle, France Travail…), avec l'état de diffusion. Fichier complémentaire réglable par offre (ex. portfolio obligatoire pour un designer). Aperçu Google for Jobs. |
| **Formulaire** | CV, **lettre de motivation en fichier**, message de motivation en texte, **fichier complémentaire** (portfolio, travaux, 20 Mo), téléphone et LinkedIn : chacun obligatoire, facultatif ou masqué. Questions personnalisées avec critère éliminatoire. Consentement RGPD, vivier, confirmation. |
| **Thème** | 4 thèmes prêts à l'emploi, logo (Profilr, import ou nom en texte), 5 couleurs avec contrôle de contraste, polices, coins et boutons. |
| **Statistiques** | Visites, vues d'offres, candidatures et taux de candidature (avec évolution), visites et candidatures par jour, entonnoir du visiteur au candidat, provenance, performance par offre, taux d'acceptation du bandeau cookies, langue des visiteurs. Sur 7, 30 ou 60 jours. |
| **Candidatures** | Liste filtrable, statut, pièces jointes, réponses, critères non remplis, langue de candidature, rattachement au projet Profilr, suppression. |
| **Paramètres** | Langues du site et avancement des traductions, adresse et domaine personnalisé, référencement, mesure d'audience et texte du bandeau cookies, jobboards connectés, confidentialité et mentions légales, conservation des données, notifications. |

Et en permanence :

- **Historique des versions** (barre du haut) : chaque publication crée une version, avec un résumé des changements. On peut prévisualiser une ancienne version et la restaurer dans le brouillon.
- **Multilingue** : choisir la langue d'édition au-dessus de l'aperçu (FR / EN). En anglais, le panneau liste chaque texte à traduire avec l'original en regard. Les textes non traduits gardent la version française. Le site public a un sélecteur de langue.
- **Bandeau cookies** sur le site public : sans accord du visiteur, rien n'est mesuré à part les candidatures.

Le bouton **Publier** fige le brouillon : le site public (« Voir le site publié », ou `#site` dans l'URL, `#site-en` en anglais) n'affiche que la version publiée.

## Organisation du code

```
career-site/
├── index.html          coque de l'éditeur et du site public
├── build.mjs           assemble le tout en un seul fichier HTML
├── assets/             polices Clash Display, logos Profilr
└── src/
    ├── brand.js        logo Profilr en SVG
    ├── util.js         échappement, chemins, couleurs, icônes, visuels d'exemple, mini-markdown, dates
    ├── i18n.js         langues proposées et libellés fixes du site public (FR, EN)
    ├── store.js        modèle de données, contenu d'exemple, publication, versions, statistiques
    ├── blocks.js       registre des blocs : champs éditables + rendu HTML
    ├── site.js         moteur du site public : pages, offres, formulaire, langues, cookies, JSON-LD
    ├── admin.js        éditeur
    └── styles.css      styles de l'éditeur (.ad-*) et du site (.cs-*, pilotés par les variables du thème)
```

- **Ajouter un type de bloc** : une entrée dans `CS.blocks.BLOCKS` (`src/blocks.js`) avec ses `fields` et sa fonction `render`, puis son nom dans `ORDER`. Le panneau d'édition et la liste des textes à traduire sont générés à partir des champs déclarés (`noTr: true` pour un champ qui ne se traduit pas).
- **Ajouter une langue** : un dictionnaire dans `CS.STRINGS` et une entrée dans `CS.LANGS` (`src/i18n.js`).

## Modèle de données

Toute la configuration d'un site tient dans un objet (Paramètres → « Copier la configuration JSON ») :

```js
{
  settings: { siteTitle, slug, customDomain, seoDescription, privacyUrl, legalUrl, retentionMonths, notifyEmails,
              showPoweredBy, languages: ['fr', 'en'], analytics, cookieText },
  theme:    { companyName, logo, logoHeight, colors: { primary, accent, text, background, surface }, fonts: { heading, body }, radius, buttons },
  pages:    [{ id, title, slug, inMenu, blocks: [{ id, type, hidden, bg, menu, props: {…} }] }],
  jobs:     [{ id, title, department, location, contract, remote, experience, salaryMin, salaryMax, salaryVisible,
               status: 'draft' | 'published' | 'archived', publishAt, publishedAt, closesAt, projectId,
               multipost, jobboards: ['linkedin', …], diffusedAt, extraFile, extraFileLabel, summary, description }],
  form:     { fields: { cv, coverLetterFile, coverLetter, extraFile, phone, linkedin }, extraFileLabel,
              questions: [{ id, label, type, options, required, knockout }], consent, talentPoolOptIn, confirmTitle, confirmText, autoReplySubject },
  i18n:     { en: { 'b:<bloc>': { 'props.title': '…', 'props.items.<_id>.text': '…' }, 'p:<page>': {…}, 'j:<offre>': {…}, form: {…}, settings: {…} } }
}
```

Les traductions sont des surcouches : seule la langue principale porte la structure, chaque langue ne stocke que ses textes.
Les éléments de liste ont un identifiant stable (`_id`) pour que les traductions suivent quand on les réordonne.

À côté du site : `versions` (instantanés publiés, 15 conservés), `applications` (avec `files`, `lang`, `answers`) et `stats.daily`
(compteurs par jour : visites, vues par offre, formulaires commencés, candidatures, sources, langues, consentements ; aucune donnée personnelle).

## Ce qui reste simulé (à brancher pour la production)

- **Stockage** côté serveur : brouillon, versions, candidatures, statistiques.
- **Fichiers** : upload des CV, lettres et fichiers complémentaires vers un stockage objet, avec antivirus. Le prototype ne garde que leur nom.
- **Profilr** : création ou dédoublonnage du profil, ajout au projet lié, notification du recruteur. Les listes de projets et de jobboards sont figées dans `store.js`.
- **Multidiffusion** : envoi réel de l'offre aux jobboards, retrait à l'archivage ou à l'expiration.
- **Programmation** : la mise en ligne est calculée à l'affichage. En production, une tâche planifiée publie l'offre et déclenche sa diffusion.
- **E-mails** : accusé de réception dans la langue du candidat, notifications.
- **Statistiques** : collecte côté serveur. Les 60 derniers jours d'exemple sont générés.
- **Traduction automatique** : non incluse (les traductions se saisissent à la main).
- **Site public** : rendu côté serveur pour le SEO, domaines personnalisés, anti-spam.
