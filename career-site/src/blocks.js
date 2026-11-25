/* Registre des blocs : chaque bloc déclare ses champs (pour l'éditeur) et sait se dessiner (pour le site).
   Ajouter un bloc = ajouter une entrée ici, rien d'autre à modifier. */
window.CS = window.CS || {};

(function () {
  const U = CS.U;
  const e = U.esc;

  const ACTIONS = [
    { value: 'jobs', label: 'Aller aux offres' },
    { value: 'spontaneous', label: 'Candidature spontanée' },
    { value: 'none', label: 'Aucun bouton' },
  ];

  /* Bouton du site : data-go est interprété par le moteur du site */
  const btn = (label, action, variant) => {
    if (!label || action === 'none') return '';
    return '<a class="cs-btn cs-btn--' + (variant || 'main') + '" href="#" data-go="' + e(action) + '">' + e(label) + '</a>';
  };
  const head = (p, cls) =>
    (p.eyebrow ? '<p class="cs-eyebrow">' + e(p.eyebrow) + '</p>' : '') +
    (p.title ? '<h2 class="cs-h2 ' + (cls || '') + '">' + e(p.title) + '</h2>' : '') +
    (p.intro ? '<p class="cs-intro">' + e(p.intro) + '</p>' : '');
  const img = (ctx, v, ratio, alt, cls) =>
    '<img class="' + (cls || 'cs-img') + '" src="' + e(U.imgSrc(v, ctx.theme, ratio)) + '" alt="' + e(alt || '') + '" loading="lazy">';
  const initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();

  const BLOCKS = {
    hero: {
      label: 'Bandeau d’accueil', icon: 'layout', desc: 'Grand titre, accroche, boutons et visuel',
      fields: [
        { key: 'layout', label: 'Mise en page', type: 'select', options: [{ value: 'split', label: 'Texte et image côte à côte' }, { value: 'centered', label: 'Texte centré' }, { value: 'cover', label: 'Image en fond' }] },
        { key: 'eyebrow', label: 'Surtitre', type: 'text' },
        { key: 'title', label: 'Titre', type: 'textarea', rows: 2 },
        { key: 'subtitle', label: 'Accroche', type: 'textarea', rows: 3 },
        { key: 'image', label: 'Visuel', type: 'image' },
        { key: 'ctaLabel', label: 'Bouton principal', type: 'text' },
        { key: 'ctaAction', label: 'Action du bouton principal', type: 'select', options: ACTIONS },
        { key: 'secondaryLabel', label: 'Bouton secondaire', type: 'text' },
        { key: 'secondaryAction', label: 'Action du bouton secondaire', type: 'select', options: ACTIONS },
      ],
      defaults: { layout: 'split', eyebrow: 'Carrières', title: 'Rejoignez-nous', subtitle: 'Présentez votre entreprise en une ou deux phrases.', image: 'ph:1', ctaLabel: 'Voir les offres', ctaAction: 'jobs', secondaryLabel: '', secondaryAction: 'spontaneous' },
      defaultBg: 'primary',
      render(p, ctx) {
        const layout = p.layout || 'split';
        const text =
          '<div class="cs-hero__text">' +
          (p.eyebrow ? '<p class="cs-eyebrow">' + e(p.eyebrow) + '</p>' : '') +
          '<h1 class="cs-h1">' + e(p.title) + '</h1>' +
          (p.subtitle ? '<p class="cs-lead">' + e(p.subtitle) + '</p>' : '') +
          '<div class="cs-actions">' + btn(p.ctaLabel, p.ctaAction, 'accent') + btn(p.secondaryLabel, p.secondaryAction, 'ghost') + '</div>' +
          '</div>';
        if (layout === 'cover')
          return '<div class="cs-hero cs-hero--cover">' + img(ctx, p.image, 16 / 7, '', 'cs-hero__bgimg') + '<div class="cs-hero__veil"></div><div class="cs-wrap">' + text + '</div></div>';
        if (layout === 'centered') return '<div class="cs-wrap cs-hero cs-hero--centered">' + text + '</div>';
        return '<div class="cs-wrap cs-hero cs-hero--split">' + text + '<div class="cs-hero__media">' + img(ctx, p.image, 5 / 4, '') + '</div></div>';
      },
    },

    text: {
      label: 'Texte', icon: 'form', desc: 'Un titre et un ou plusieurs paragraphes',
      fields: [
        { key: 'eyebrow', label: 'Surtitre', type: 'text' },
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'body', label: 'Texte', type: 'md', rows: 7 },
        { key: 'align', label: 'Alignement', type: 'select', options: [{ value: 'left', label: 'À gauche' }, { value: 'center', label: 'Centré' }] },
      ],
      defaults: { eyebrow: '', title: 'Notre histoire', body: 'Racontez ici l’histoire de l’entreprise, sa mission ou sa façon de travailler.', align: 'left' },
      render(p) {
        return '<div class="cs-wrap cs-narrow ' + (p.align === 'center' ? 'cs-center' : '') + '">' + head(p) + '<div class="cs-prose">' + U.md(p.body) + '</div></div>';
      },
    },

    textImage: {
      label: 'Texte et image', icon: 'image', desc: 'Un paragraphe à côté d’un visuel',
      fields: [
        { key: 'eyebrow', label: 'Surtitre', type: 'text' },
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'body', label: 'Texte', type: 'md', rows: 7 },
        { key: 'image', label: 'Image', type: 'image' },
        { key: 'side', label: 'Position de l’image', type: 'select', options: [{ value: 'right', label: 'À droite' }, { value: 'left', label: 'À gauche' }] },
        { key: 'ctaLabel', label: 'Bouton (facultatif)', type: 'text' },
        { key: 'ctaAction', label: 'Action du bouton', type: 'select', options: ACTIONS },
      ],
      defaults: { eyebrow: '', title: 'Qui sommes-nous ?', body: 'Décrivez votre activité, vos clients et votre équipe.', image: 'ph:2', side: 'right', ctaLabel: '', ctaAction: 'jobs' },
      render(p, ctx) {
        return '<div class="cs-wrap cs-split ' + (p.side === 'left' ? 'cs-split--rev' : '') + '"><div class="cs-split__text">' + head(p) + '<div class="cs-prose">' + U.md(p.body) + '</div>' +
          (p.ctaLabel ? '<div class="cs-actions">' + btn(p.ctaLabel, p.ctaAction, 'main') + '</div>' : '') +
          '</div><div class="cs-split__media">' + img(ctx, p.image, 4 / 3, p.title) + '</div></div>';
      },
    },

    stats: {
      label: 'Chiffres clés', icon: 'target', desc: 'Effectif, nationalités, avis…',
      fields: [
        { key: 'title', label: 'Titre (facultatif)', type: 'text' },
        { key: 'items', label: 'Chiffres', type: 'list', itemLabel: 'value', max: 6, add: { value: '10', label: 'description' }, fields: [{ key: 'value', label: 'Valeur', type: 'text' }, { key: 'label', label: 'Libellé', type: 'text' }] },
      ],
      defaults: { title: '', items: [{ value: '120', label: 'collaborateurs' }, { value: '4', label: 'pays' }, { value: '2012', label: 'année de création' }] },
      render(p) {
        return '<div class="cs-wrap">' + head(p, 'cs-center') + '<dl class="cs-stats" style="--n:' + Math.max(1, (p.items || []).length) + '">' +
          (p.items || []).map((it) => '<div class="cs-stat"><dt>' + e(it.label) + '</dt><dd>' + e(it.value) + '</dd></div>').join('') + '</dl></div>';
      },
    },

    values: {
      label: 'Valeurs', icon: 'heart', desc: 'Cartes avec icône, titre et texte',
      fields: [
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'intro', label: 'Introduction', type: 'textarea', rows: 2 },
        { key: 'items', label: 'Valeurs', type: 'list', itemLabel: 'title', max: 8, add: { icon: 'star', title: 'Nouvelle valeur', text: '' }, fields: [{ key: 'icon', label: 'Icône', type: 'icon' }, { key: 'title', label: 'Titre', type: 'text' }, { key: 'text', label: 'Texte', type: 'textarea', rows: 2 }] },
      ],
      defaults: { title: 'Nos valeurs', intro: '', items: [{ icon: 'heart', title: 'Bienveillance', text: '' }, { icon: 'rocket', title: 'Ambition', text: '' }, { icon: 'users', title: 'Collectif', text: '' }] },
      render(p) {
        return '<div class="cs-wrap">' + head(p) + '<div class="cs-cards">' +
          (p.items || []).map((it) => '<article class="cs-card"><span class="cs-card__icon">' + U.icon(it.icon) + '</span><h3 class="cs-h3">' + e(it.title) + '</h3>' + (it.text ? '<p>' + e(it.text) + '</p>' : '') + '</article>').join('') +
          '</div></div>';
      },
    },

    benefits: {
      label: 'Avantages', icon: 'sparkles', desc: 'Liste compacte des avantages salariés',
      fields: [
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'intro', label: 'Introduction', type: 'textarea', rows: 2 },
        { key: 'items', label: 'Avantages', type: 'list', itemLabel: 'title', max: 16, add: { icon: 'star', title: 'Nouvel avantage', text: '' }, fields: [{ key: 'icon', label: 'Icône', type: 'icon' }, { key: 'title', label: 'Titre', type: 'text' }, { key: 'text', label: 'Précision', type: 'text' }] },
      ],
      defaults: { title: 'Nos avantages', intro: '', items: [{ icon: 'home', title: 'Télétravail', text: '' }, { icon: 'shield', title: 'Mutuelle', text: '' }, { icon: 'book', title: 'Formation', text: '' }] },
      render(p) {
        return '<div class="cs-wrap">' + head(p) + '<ul class="cs-benefits">' +
          (p.items || []).map((it) => '<li><span class="cs-benefits__icon">' + U.icon(it.icon) + '</span><div><strong>' + e(it.title) + '</strong>' + (it.text ? '<span>' + e(it.text) + '</span>' : '') + '</div></li>').join('') +
          '</ul></div>';
      },
    },

    gallery: {
      label: 'Galerie photos', icon: 'image', desc: 'Photos des bureaux, de l’équipe, des événements',
      fields: [
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'layout', label: 'Disposition', type: 'select', options: [{ value: 'mosaic', label: 'Mosaïque' }, { value: 'grid', label: 'Grille régulière' }] },
        { key: 'items', label: 'Photos', type: 'list', itemLabel: 'caption', max: 12, add: { image: 'ph:0', caption: '' }, fields: [{ key: 'image', label: 'Photo', type: 'image' }, { key: 'caption', label: 'Légende', type: 'text' }] },
      ],
      defaults: { title: 'La vie chez nous', layout: 'mosaic', items: [{ image: 'ph:0', caption: '' }, { image: 'ph:4', caption: '' }, { image: 'ph:5', caption: '' }] },
      render(p, ctx) {
        return '<div class="cs-wrap">' + head(p) + '<div class="cs-gallery cs-gallery--' + e(p.layout || 'mosaic') + '">' +
          (p.items || []).map((it) => '<figure>' + img(ctx, it.image, 1, it.caption) + (it.caption ? '<figcaption>' + e(it.caption) + '</figcaption>' : '') + '</figure>').join('') +
          '</div></div>';
      },
    },

    video: {
      label: 'Vidéo', icon: 'play', desc: 'YouTube, Vimeo ou fichier vidéo',
      fields: [
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'text', label: 'Texte', type: 'textarea', rows: 2 },
        { key: 'url', label: 'Vidéo', type: 'video', help: 'Collez un lien YouTube ou Vimeo, ou importez un fichier MP4.' },
        { key: 'poster', label: 'Image d’aperçu', type: 'image' },
      ],
      defaults: { title: 'Découvrez l’équipe', text: '', url: '', poster: 'ph:3' },
      render(p, ctx) {
        const v = U.videoInfo(p.url);
        const poster = U.imgSrc(p.poster, ctx.theme, 16 / 9);
        let media;
        if (v && v.kind === 'file') {
          media = '<video class="cs-video__el" controls preload="metadata" poster="' + e(poster) + '" src="' + e(v.url) + '"></video>';
        } else if (v && (v.kind === 'youtube' || v.kind === 'vimeo') && CS.config.allowEmbeds) {
          media = '<button type="button" class="cs-video__poster" data-embed="' + e(v.embed) + '" aria-label="Lire la vidéo"><img src="' + e(poster) + '" alt=""><span class="cs-video__play">' + U.icon('play') + '</span></button>';
        } else if (v) {
          media = '<a class="cs-video__poster" href="' + e(v.url) + '" target="_blank" rel="noopener" aria-label="Regarder la vidéo"><img src="' + e(poster) + '" alt=""><span class="cs-video__play">' + U.icon('play') + '</span><span class="cs-video__out">Regarder la vidéo ' + U.icon('external') + '</span></a>';
        } else {
          media = '<div class="cs-video__poster cs-video__poster--empty"><img src="' + e(poster) + '" alt=""><span class="cs-video__play">' + U.icon('play') + '</span>' +
            (ctx.mode === 'editor' ? '<span class="cs-video__out">Ajoutez un lien YouTube ou Vimeo dans le panneau</span>' : '') + '</div>';
        }
        return '<div class="cs-wrap cs-video">' + (p.title || p.text ? '<div class="cs-video__head">' + head({ title: p.title, intro: p.text }) + '</div>' : '') + '<div class="cs-video__frame">' + media + '</div></div>';
      },
    },

    testimonials: {
      label: 'Témoignages', icon: 'chat', desc: 'Citations de collaborateurs',
      fields: [
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'items', label: 'Témoignages', type: 'list', itemLabel: 'name', max: 9, add: { quote: '', name: 'Prénom N.', role: 'Poste', photo: '' }, fields: [{ key: 'quote', label: 'Citation', type: 'textarea', rows: 3 }, { key: 'name', label: 'Nom', type: 'text' }, { key: 'role', label: 'Poste', type: 'text' }, { key: 'photo', label: 'Photo', type: 'image', optional: true }] },
      ],
      defaults: { title: 'Ils et elles en parlent', items: [{ quote: 'Ce que j’aime ici, c’est…', name: 'Prénom N.', role: 'Poste', photo: '' }] },
      render(p) {
        return '<div class="cs-wrap">' + head(p) + '<div class="cs-quotes">' +
          (p.items || []).map((it, i) =>
            '<figure class="cs-quote"><blockquote>' + e(it.quote) + '</blockquote><figcaption>' +
            (it.photo && !U.isPlaceholder(it.photo) ? '<img class="cs-avatar" src="' + e(it.photo) + '" alt="">' : '<span class="cs-avatar cs-avatar--' + (i % 3) + '" aria-hidden="true">' + e(initials(it.name)) + '</span>') +
            '<span><strong>' + e(it.name) + '</strong><span>' + e(it.role) + '</span></span></figcaption></figure>'
          ).join('') +
          '</div></div>';
      },
    },

    process: {
      label: 'Process de recrutement', icon: 'flag', desc: 'Les étapes, dans l’ordre',
      fields: [
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'intro', label: 'Introduction', type: 'textarea', rows: 2 },
        { key: 'items', label: 'Étapes', type: 'list', itemLabel: 'title', max: 8, add: { title: 'Nouvelle étape', text: '', duration: '' }, fields: [{ key: 'title', label: 'Étape', type: 'text' }, { key: 'text', label: 'Description', type: 'textarea', rows: 2 }, { key: 'duration', label: 'Durée', type: 'text' }] },
      ],
      defaults: { title: 'Notre process de recrutement', intro: '', items: [{ title: 'Candidature', text: '', duration: '' }, { title: 'Entretien', text: '', duration: '1 h' }, { title: 'Proposition', text: '', duration: '' }] },
      render(p) {
        return '<div class="cs-wrap">' + head(p) + '<ol class="cs-steps">' +
          (p.items || []).map((it, i) => '<li><span class="cs-steps__n">' + (i + 1) + '</span><h3 class="cs-h3">' + e(it.title) + '</h3>' + (it.text ? '<p>' + e(it.text) + '</p>' : '') + (it.duration ? '<span class="cs-chip">' + U.icon('clock') + e(it.duration) + '</span>' : '') + '</li>').join('') +
          '</ol></div>';
      },
    },

    jobs: {
      label: 'Liste des offres', icon: 'briefcase', desc: 'Les offres publiées, avec recherche et filtres',
      fields: [
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'intro', label: 'Introduction', type: 'textarea', rows: 2 },
        { key: 'filters', label: 'Afficher la recherche et les filtres', type: 'toggle' },
        { key: 'groupBy', label: 'Regrouper', type: 'select', options: [{ value: 'none', label: 'Ne pas regrouper' }, { value: 'department', label: 'Par équipe' }, { value: 'location', label: 'Par lieu' }] },
        { key: 'limit', label: 'Nombre maximum d’offres (0 = toutes)', type: 'number' },
      ],
      defaults: { title: 'Nos offres', intro: '', filters: true, groupBy: 'none', limit: 0 },
      render(p, ctx) {
        return '<div class="cs-wrap">' + head(p) + CS.site.jobsList(ctx, p) + '</div>';
      },
    },

    faq: {
      label: 'Questions fréquentes', icon: 'chat', desc: 'Questions et réponses dépliables',
      fields: [
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'items', label: 'Questions', type: 'list', itemLabel: 'q', max: 20, add: { q: 'Nouvelle question', a: '' }, fields: [{ key: 'q', label: 'Question', type: 'text' }, { key: 'a', label: 'Réponse', type: 'textarea', rows: 3 }] },
      ],
      defaults: { title: 'Questions fréquentes', items: [{ q: 'Comment postuler ?', a: 'Choisissez une offre et remplissez le formulaire.' }] },
      render(p) {
        return '<div class="cs-wrap cs-narrow">' + head(p) + '<div class="cs-faq">' +
          (p.items || []).map((it) => '<details><summary>' + e(it.q) + U.icon('down', 'i cs-faq__chev') + '</summary><p>' + e(it.a) + '</p></details>').join('') +
          '</div></div>';
      },
    },

    cta: {
      label: 'Appel à l’action', icon: 'send', desc: 'Encadré avec un bouton (candidature spontanée…)',
      fields: [
        { key: 'title', label: 'Titre', type: 'text' },
        { key: 'text', label: 'Texte', type: 'textarea', rows: 2 },
        { key: 'buttonLabel', label: 'Bouton', type: 'text' },
        { key: 'action', label: 'Action', type: 'select', options: ACTIONS },
      ],
      defaults: { title: 'Envie de nous rejoindre ?', text: '', buttonLabel: 'Candidature spontanée', action: 'spontaneous' },
      defaultBg: 'primary',
      render(p) {
        return '<div class="cs-wrap cs-cta"><div><h2 class="cs-h2">' + e(p.title) + '</h2>' + (p.text ? '<p class="cs-intro">' + e(p.text) + '</p>' : '') + '</div>' + btn(p.buttonLabel, p.action, 'accent') + '</div>';
      },
    },
  };

  /* Ordre d'affichage dans la bibliothèque de blocs */
  const ORDER = ['hero', 'text', 'textImage', 'stats', 'values', 'benefits', 'gallery', 'video', 'testimonials', 'process', 'jobs', 'faq', 'cta'];

  const BACKGROUNDS = [
    { value: 'default', label: 'Fond de page' },
    { value: 'surface', label: 'Fond doux' },
    { value: 'primary', label: 'Couleur principale' },
    { value: 'accent', label: 'Couleur d’accent' },
  ];

  CS.blocks = { BLOCKS, ORDER, BACKGROUNDS, ACTIONS };
})();
