# Site carrière · module Profilr (V1, prototype)

Un module qui permet à une équipe RH de créer son site carrière dans Profilr :
une page marque employeur construite avec des blocs, des offres publiées comme des articles de blog,
et un formulaire de candidature dont les réponses arrivent dans Profilr.

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

Les données (brouillon, version publiée, candidatures) sont gardées dans le `localStorage` du navigateur.
**Paramètres → Réinitialiser la démo** remet le contenu d'exemple.

## Ce que fait la V1

| Onglet | Fonctionnalités |
|---|---|
| **Page** | 13 types de blocs (bandeau, texte, texte + image, chiffres clés, valeurs, avantages, galerie, vidéo, témoignages, process, liste des offres, FAQ, appel à l'action). Ajout, réordonnancement par glisser-déposer ou flèches, duplication, masquage, suppression. Fond de section au choix, lien dans le menu. Clic sur un bloc dans l'aperçu pour l'éditer. |
| **Offres** | Brouillon, publiée ou archivée, date limite, projet Profilr lié, champs structurés (équipe, lieu, contrat, télétravail, expérience, salaire affiché ou non), description en mini-markdown, duplication. Aperçu des données Google for Jobs (`JobPosting`). |
| **Formulaire** | CV, téléphone, LinkedIn et motivation (obligatoires, facultatifs ou masqués), questions personnalisées (texte, liste, oui/non) avec critère éliminatoire signalé, consentement RGPD, opt-in vivier, page et e-mail de confirmation. |
| **Thème** | 4 thèmes prêts à l'emploi, logo (Profilr, import ou nom en texte), 5 couleurs avec contrôle de contraste, polices, coins et boutons. Les visuels d'exemple se recolorent avec le thème. |
| **Candidatures** | Liste filtrable, statut, détail avec réponses, critères non remplis, rattachement au projet Profilr, suppression (droit à l'effacement). |
| **Paramètres** | Sous-domaine `*.jobs.profilr.eu` et domaine personnalisé, titre et description SEO avec aperçu Google, politique de confidentialité, durée de conservation, notifications, mention « propulsé par Profilr », export JSON de la configuration. |

Le bouton **Publier** fige le brouillon : le site public (bouton « Voir le site publié », ou `#site` dans l'URL) n'affiche que la version publiée.
L'aperçu se règle sur ordinateur, tablette ou mobile. Le site public utilise des *container queries* : la même mise en page sert dans l'aperçu et en vrai.

## Organisation du code

```
career-site/
├── index.html          coque de l'éditeur et du site public
├── build.mjs           assemble le tout en un seul fichier HTML
├── assets/             polices Clash Display, logos Profilr (clair et foncé)
└── src/
    ├── brand.js        logo Profilr en SVG (couleur appliquée à l'affichage)
    ├── util.js         échappement, couleurs et contraste, icônes, visuels d'exemple, mini-markdown
    ├── store.js        modèle de données, contenu d'exemple, thèmes, brouillon / publication
    ├── blocks.js       registre des blocs : champs éditables + rendu HTML
    ├── site.js         moteur du site public (pages, offres, formulaire, JSON-LD Google for Jobs)
    ├── admin.js        éditeur
    └── styles.css      styles de l'éditeur (.ad-*) et du site (.cs-*, pilotés par les variables du thème)
```

**Ajouter un type de bloc** : une entrée dans `CS.blocks.BLOCKS` (`src/blocks.js`) avec ses `fields` et sa fonction `render`, puis son nom dans `ORDER`.
Le panneau d'édition est généré à partir des champs déclarés.

## Modèle de données

Toute la configuration d'un site tient dans un objet (Paramètres → « Copier la configuration JSON ») :

```js
{
  settings: { siteTitle, slug, customDomain, seoDescription, privacyUrl, retentionMonths, notifyEmails, showPoweredBy },
  theme:    { companyName, logo, logoHeight, colors: { primary, accent, text, background, surface }, fonts: { heading, body }, radius, buttons },
  pages:    [{ id, title, blocks: [{ id, type, hidden, bg, menu, props: {…} }] }],
  jobs:     [{ id, title, department, location, contract, remote, experience, salaryMin, salaryMax, salaryVisible,
               status: 'draft' | 'published' | 'archived', publishedAt, closesAt, projectId, summary, description }],
  form:     { fields: { cv, phone, linkedin, coverLetter }, questions: [{ id, label, type, options, required, knockout }],
              consent, talentPoolOptIn, confirmTitle, confirmText, autoReplySubject }
}
```

Une candidature : `{ id, jobId, projectId, createdAt, status, source, firstName, lastName, email, phone, linkedin, coverLetter, cv, answers, knockedOut, talentPool }`.

## Ce qui reste simulé (à brancher pour la production)

- **Stockage** : brouillon, versions publiées et candidatures côté serveur, avec historique des versions.
- **Fichiers** : upload des CV et des médias vers un stockage objet (le prototype ne garde que le nom du CV, et les images en base64).
- **Profilr** : création ou dédoublonnage du profil, ajout au projet lié, notification du recruteur (aujourd'hui simulés dans l'onglet Candidatures). La liste des projets est figée dans `store.js`.
- **E-mails** : accusé de réception au candidat, notifications.
- **Site public** : rendu côté serveur (SEO, Google for Jobs), sous-domaines et domaines personnalisés avec certificat automatique, anti-spam (captcha invisible, limitation de débit, antivirus sur les CV).
- **RGPD** : purge automatique selon la durée de conservation.

## Prochaines étapes (V2)

Programmation des offres et validation manager, multilingue, parsing du CV et import LinkedIn, alertes emploi,
widget à intégrer sur le site corporate, statistiques (vues, conversion, sources), plusieurs pages et plusieurs marques.
