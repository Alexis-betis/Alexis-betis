/* État du module : brouillon, version publiée, historique des versions, candidatures, statistiques.
   Persistance navigateur (prototype). */
window.CS = window.CS || {};

(function () {
  const U = CS.U;
  const KEY = 'profilr-site-carriere-v2';

  /* ---------- Thème ---------- */
  const PROFILR_THEME = {
    companyName: 'Profilr',
    logo: 'profilr' /* 'profilr' = logo Profilr, '' = nom en texte, sinon image importée */,
    logoHeight: 30,
    colors: {
      primary: '#043428' /* sapin */,
      accent: '#DFFFA5' /* citron */,
      text: '#1F3A32',
      background: '#FFFFFF',
      surface: '#F0F3F3' /* menthe pâle */,
    },
    fonts: { heading: 'Clash Display', body: 'Figtree' },
    radius: 'arrondi',
    buttons: 'pilule',
  };

  const PRESETS = [
    { id: 'profilr', name: 'Profilr', theme: PROFILR_THEME },
    { id: 'ocean', name: 'Océan', theme: { colors: { primary: '#123B6D', accent: '#FFB547', text: '#18263A', background: '#FFFFFF', surface: '#EEF3F9' }, fonts: { heading: 'Space Grotesk', body: 'Inter' }, radius: 'doux', buttons: 'arrondi' } },
    { id: 'terre', name: 'Terre cuite', theme: { colors: { primary: '#8C2F1B', accent: '#F6D7B0', text: '#2B1B14', background: '#FFFCF8', surface: '#F7EEE4' }, fonts: { heading: 'Fraunces', body: 'Work Sans' }, radius: 'doux', buttons: 'arrondi' } },
    { id: 'graphite', name: 'Graphite', theme: { colors: { primary: '#16161A', accent: '#7C5CFF', text: '#1C1C21', background: '#FFFFFF', surface: '#F3F3F5' }, fonts: { heading: 'Manrope', body: 'Manrope' }, radius: 'carre', buttons: 'carre' } },
  ];

  /* Polices proposées. Clash Display est auto-hébergée (assets/fonts), les autres viennent de Google Fonts. */
  const FONTS = [
    { name: 'Clash Display', css: "'Clash Display', 'Figtree', system-ui, sans-serif", local: true },
    { name: 'Figtree', css: "'Figtree', system-ui, sans-serif" },
    { name: 'Inter', css: "'Inter', system-ui, sans-serif" },
    { name: 'DM Sans', css: "'DM Sans', system-ui, sans-serif" },
    { name: 'Manrope', css: "'Manrope', system-ui, sans-serif" },
    { name: 'Outfit', css: "'Outfit', system-ui, sans-serif" },
    { name: 'Poppins', css: "'Poppins', system-ui, sans-serif" },
    { name: 'Montserrat', css: "'Montserrat', system-ui, sans-serif" },
    { name: 'Space Grotesk', css: "'Space Grotesk', system-ui, sans-serif" },
    { name: 'Work Sans', css: "'Work Sans', system-ui, sans-serif" },
    { name: 'Fraunces', css: "'Fraunces', Georgia, serif" },
    { name: 'Playfair Display', css: "'Playfair Display', Georgia, serif" },
    { name: 'Lora', css: "'Lora', Georgia, serif" },
  ];

  /* Projets et jobboards configurés dans Profilr. En production : lus depuis l'API Profilr. */
  const PROJECTS = [
    { id: 'p-101', name: 'Back-end senior – Python' },
    { id: 'p-102', name: 'Product Designer' },
    { id: 'p-103', name: 'Account Executive mid-market' },
    { id: 'p-104', name: 'Customer Success Manager' },
    { id: 'p-105', name: 'Alternance Growth' },
    { id: 'p-199', name: 'Vivier – candidatures spontanées' },
  ];
  const JOBBOARDS = [
    { id: 'linkedin', name: 'LinkedIn Jobs', connected: true },
    { id: 'indeed', name: 'Indeed', connected: true },
    { id: 'wttj', name: 'Welcome to the Jungle', connected: true },
    { id: 'francetravail', name: 'France Travail', connected: true },
    { id: 'hellowork', name: 'HelloWork', connected: false },
    { id: 'apec', name: 'Apec', connected: false },
  ];

  const CONTRACTS = ['CDI', 'CDD', 'Stage', 'Alternance', 'Freelance'];
  const REMOTE = [
    { id: 'onsite', label: 'Sur site', key: 'remoteOnsite' },
    { id: 'hybrid', label: 'Télétravail partiel', key: 'remoteHybrid' },
    { id: 'remote', label: 'Télétravail complet', key: 'remoteFull' },
  ];
  const EXPERIENCE = ['Débutant accepté', '1 à 3 ans', '3 à 5 ans', '5 ans et plus'];
  const APP_STATUSES = ['Nouveau', 'À qualifier', 'Entretien', 'Proposition', 'Embauché', 'Refusé'];
  const SOURCES = ['LinkedIn', 'Google', 'Indeed', 'Welcome to the Jungle', 'Accès direct', 'Cooptation'];

  /* ---------- Contenu d'exemple ---------- */
  const b = (type, props, extra) => Object.assign({ id: U.uid('b_'), type, hidden: false, bg: 'default', menu: '', props }, extra || {});

  const homeBlocks = () => [
    b('hero', {
      layout: 'split', eyebrow: 'Carrières chez Profilr',
      title: 'Aidez les recruteurs à trouver les bonnes personnes, plus vite.',
      subtitle: 'Profilr construit l’agent IA de sourcing qui cherche sur tout le web et dans les viviers, classe les meilleurs profils et lance la prise de contact. On agrandit l’équipe.',
      ctaLabel: 'Voir les offres', ctaAction: 'jobs', secondaryLabel: 'Candidature spontanée', secondaryAction: 'spontaneous', image: 'ph:1',
    }, { bg: 'primary' }),
    b('stats', { title: '', items: [
      { value: '35', label: 'personnes dans l’équipe' }, { value: '8', label: 'nationalités' },
      { value: '2 j', label: 'de télétravail par semaine' }, { value: '4,7/5', label: 'note moyenne des collaborateurs' },
    ] }),
    b('textImage', {
      eyebrow: 'Notre mission', title: 'Remettre de l’humain dans le recrutement',
      body: 'Les recruteurs passent des heures à chercher des profils au lieu de leur parler. Profilr automatise la recherche, la qualification et la prise de contact, pour leur rendre ce temps.\n\nNous sommes une équipe produit, tech et commerciale qui travaille au plus près de ses clients : cabinets de recrutement, équipes talent acquisition et RH.',
      image: 'ph:2', side: 'right', ctaLabel: '', ctaAction: 'jobs',
    }, { menu: 'L’entreprise' }),
    b('values', {
      title: 'Ce qui nous guide', intro: 'Quatre principes qu’on applique au quotidien, du code aux rendez-vous clients.',
      items: [
        { icon: 'heart', title: 'Le candidat d’abord', text: 'Chaque fonctionnalité doit rendre l’expérience plus respectueuse pour les personnes qu’on contacte.' },
        { icon: 'target', title: 'Exigence et simplicité', text: 'On préfère une chose bien faite à dix choses à moitié finies.' },
        { icon: 'rocket', title: 'Apprendre vite', text: 'On livre souvent, on mesure, on ajuste. Se tromper fait partie du travail.' },
        { icon: 'chat', title: 'Transparence', text: 'Les chiffres, les décisions et les salaires sont partagés avec toute l’équipe.' },
      ],
    }, { bg: 'surface', menu: 'Nos valeurs' }),
    b('teams', {
      title: 'Nos équipes', intro: 'Trouvez l’équipe où vous aurez le plus d’impact.',
      items: [
        { name: 'Tech', icon: 'rocket', text: 'Back-end, data et IA : le moteur de recherche et l’agent de sourcing.' },
        { name: 'Produit', icon: 'sparkles', text: 'Design et product management, au contact des recruteurs.' },
        { name: 'Sales', icon: 'target', text: 'Faire découvrir Profilr aux cabinets et aux équipes RH.' },
        { name: 'Customer Success', icon: 'heart', text: 'Accompagner nos clients pour qu’ils réussissent avec Profilr.' },
      ],
    }),
    b('video', { title: 'Une journée chez Profilr', text: 'Trois minutes avec l’équipe, entre deux mises en production.', url: '', poster: 'ph:3' }),
    b('benefits', {
      title: 'Nos avantages', intro: '',
      items: [
        { icon: 'home', title: 'Télétravail flexible', text: 'Deux jours par semaine, et des semaines à distance possibles.' },
        { icon: 'shield', title: 'Mutuelle à 100 %', text: 'Prise en charge complète, pour vous et vos proches.' },
        { icon: 'book', title: 'Budget formation', text: '1 500 € par an et par personne, en plus du CPF.' },
        { icon: 'coffee', title: 'Titres-restaurant', text: '10 € par jour, sur carte.' },
        { icon: 'bike', title: 'Mobilités durables', text: 'Forfait vélo et transports remboursés.' },
        { icon: 'euro', title: 'BSPCE', text: 'Toute l’équipe est associée à la réussite de Profilr.' },
      ],
    }, { bg: 'surface', menu: 'Avantages' }),
    b('process', {
      title: 'Comment se passe le recrutement', intro: 'Quatre étapes, trois semaines en moyenne. On répond à chaque candidature.',
      items: [
        { title: 'Candidature', text: 'Vous postulez en ligne. Réponse sous 7 jours.', duration: '5 min' },
        { title: 'Premier échange', text: 'Un appel avec l’équipe recrutement pour faire connaissance.', duration: '30 min' },
        { title: 'Entretien métier', text: 'Avec votre futur·e manager, autour d’un cas concret.', duration: '1 h' },
        { title: 'Rencontre de l’équipe', text: 'Un moment avec vos futurs collègues, puis notre proposition.', duration: '1 h' },
      ],
    }),
    b('jobs', { title: 'Nos offres', intro: 'Toutes nos offres sont ouvertes aux personnes en situation de handicap.', filters: true, groupBy: 'none', limit: 0 }, { menu: 'Offres' }),
    b('faq', {
      title: 'Questions fréquentes',
      items: [
        { q: 'Puis-je postuler à plusieurs offres ?', a: 'Oui. Chaque candidature est étudiée séparément, et on vous prévient si un autre poste vous correspond mieux.' },
        { q: 'Combien de temps dure le process ?', a: 'Trois semaines en moyenne entre la candidature et la proposition.' },
        { q: 'Proposez-vous du télétravail complet ?', a: 'Pour certains postes, indiqués « Télétravail complet » sur l’offre. Les autres sont en hybride, avec deux jours à distance.' },
        { q: 'Que devient ma candidature si elle n’est pas retenue ?', a: 'Avec votre accord, nous la gardons deux ans pour vous recontacter si un poste correspond. Vous pouvez demander sa suppression à tout moment.' },
      ],
    }),
    b('cta', { title: 'Vous ne trouvez pas le poste qui vous correspond ?', text: 'Envoyez-nous une candidature spontanée. On la lit, et on revient vers vous dès qu’une opportunité se présente.', buttonLabel: 'Candidature spontanée', action: 'spontaneous' }, { bg: 'primary' }),
  ];

  const lifeBlocks = () => [
    b('hero', {
      layout: 'centered', eyebrow: 'Vie chez nous', title: 'L’équipe, les bureaux et ce qui fait notre quotidien',
      subtitle: 'Des photos, des témoignages et les adresses où nous travaillons.', ctaLabel: 'Voir les offres', ctaAction: 'jobs', secondaryLabel: '', secondaryAction: 'none', image: 'ph:4',
    }, { bg: 'surface' }),
    b('testimonials', {
      title: 'Ils et elles en parlent',
      items: [
        { quote: 'J’ai rejoint Profilr pour l’impact produit. Ce que je livre le lundi est utilisé par des recruteurs le mardi.', name: 'Camille R.', role: 'Product Designer', photo: '' },
        { quote: 'On me fait confiance dès le premier mois, avec un vrai accompagnement technique derrière.', name: 'Yanis B.', role: 'Ingénieur back-end', photo: '' },
        { quote: 'Nos clients nous parlent tous les jours. Leurs retours changent vraiment la feuille de route.', name: 'Inès M.', role: 'Customer Success Manager', photo: '' },
      ],
    }, { menu: 'Témoignages' }),
    b('gallery', {
      title: 'La vie au bureau', layout: 'mosaic',
      items: [
        { image: 'ph:4', caption: 'Le point produit du lundi' }, { image: 'ph:0', caption: 'Séminaire d’équipe' },
        { image: 'ph:5', caption: 'Nos bureaux' }, { image: 'ph:2', caption: 'Hackathon IA' }, { image: 'ph:3', caption: 'Afterwork mensuel' },
      ],
    }),
    b('locations', {
      title: 'Nos bureaux', intro: 'Deux bureaux en France, et une partie de l’équipe à distance.',
      items: [
        { city: 'Paris', address: '10 rue de Rivoli, 75004 Paris', text: 'Le siège : produit, tech et direction. À deux pas du métro Saint-Paul.', image: 'ph:5' },
        { city: 'Lyon', address: 'Place Bellecour, 69002 Lyon', text: 'L’équipe commerciale pour le sud-est de la France.', image: 'ph:0' },
      ],
    }, { menu: 'Nos bureaux' }),
    b('logos', {
      title: 'Nos labels et engagements', intro: '', style: 'mono',
      items: [{ name: 'Great Place to Work', image: '' }, { name: 'Label Diversité', image: '' }, { name: 'French Tech', image: '' }, { name: 'Engagé RSE', image: '' }],
    }),
  ];

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const inDays = (n, h) => { const d = new Date(Date.now() + n * 86400000); d.setHours(h || 9, 0, 0, 0); return d.toISOString().slice(0, 16); };

  const defaultJobs = () => [
    {
      id: 'j_backend', title: 'Ingénieur·e back-end senior (Python)', department: 'Tech', location: 'Paris', contract: 'CDI', remote: 'hybrid',
      experience: '5 ans et plus', salaryMin: 60000, salaryMax: 75000, salaryVisible: true, status: 'published', publishedAt: daysAgo(3), publishAt: '', closesAt: '', projectId: 'p-101',
      multipost: true, jobboards: ['linkedin', 'indeed', 'wttj'], diffusedAt: daysAgo(3), extraFile: 'default', extraFileLabel: '',
      summary: 'Concevoir les services qui font tourner notre agent de sourcing à grande échelle.',
      description: '## Vos missions\n- Concevoir et faire évoluer nos API et nos pipelines de données (Python, PostgreSQL, Elasticsearch)\n- Rendre la recherche de profils plus rapide et plus pertinente\n- Participer aux choix d’architecture avec le CTO\n- Accompagner deux développeurs plus juniors\n\n## Votre profil\n- 5 ans d’expérience ou plus en back-end, dont une bonne part en Python\n- À l’aise avec les bases de données et la recherche plein texte\n- Vous aimez comprendre le métier de vos utilisateurs\n\n## Ce que nous proposons\nUne équipe tech de huit personnes, des mises en production quotidiennes et une vraie autonomie sur votre périmètre.',
    },
    {
      id: 'j_design', title: 'Product Designer', department: 'Produit', location: 'Paris', contract: 'CDI', remote: 'hybrid',
      experience: '3 à 5 ans', salaryMin: 50000, salaryMax: 60000, salaryVisible: true, status: 'published', publishedAt: daysAgo(9), publishAt: '', closesAt: '', projectId: 'p-102',
      multipost: true, jobboards: ['linkedin', 'wttj'], diffusedAt: daysAgo(9), extraFile: 'required', extraFileLabel: 'Portfolio',
      summary: 'Dessiner l’expérience des recruteurs, de la recherche à la prise de contact.',
      description: '## Vos missions\n- Mener la conception de bout en bout : recherche utilisateur, prototypes, tests, suivi en production\n- Faire évoluer notre design system\n- Travailler en binôme avec les product managers et les développeurs\n\n## Votre profil\n- 3 ans d’expérience ou plus sur un produit SaaS\n- Un portfolio qui montre votre démarche, pas seulement le résultat\n- Figma n’a pas de secret pour vous',
    },
    {
      id: 'j_ae', title: 'Account Executive mid-market', department: 'Sales', location: 'Lyon', contract: 'CDI', remote: 'hybrid',
      experience: '3 à 5 ans', salaryMin: 45000, salaryMax: 55000, salaryVisible: true, status: 'published', publishedAt: daysAgo(14), publishAt: '', closesAt: '', projectId: 'p-103',
      multipost: false, jobboards: [], diffusedAt: '', extraFile: 'default', extraFileLabel: '',
      summary: 'Faire découvrir Profilr aux cabinets et équipes RH, de la démo à la signature.',
      description: '## Vos missions\n- Gérer un portefeuille de prospects mid-market\n- Mener les démos et les cycles de vente jusqu’à la signature\n- Faire remonter les besoins clients à l’équipe produit\n\n## Votre profil\n- Une première expérience réussie en vente SaaS B2B\n- Une connaissance du recrutement est un vrai plus\n\n**Rémunération :** fixe indiqué + variable déplafonné.',
    },
    {
      id: 'j_csm', title: 'Customer Success Manager', department: 'Customer Success', location: 'France', contract: 'CDI', remote: 'remote',
      experience: '1 à 3 ans', salaryMin: 40000, salaryMax: 48000, salaryVisible: false, status: 'published', publishedAt: daysAgo(21), publishAt: '', closesAt: '', projectId: 'p-104',
      multipost: true, jobboards: ['indeed', 'francetravail'], diffusedAt: daysAgo(21), extraFile: 'default', extraFileLabel: '',
      summary: 'Accompagner nos clients pour qu’ils tirent le meilleur de Profilr.',
      description: '## Vos missions\n- Onboarder les nouveaux clients et former leurs équipes\n- Suivre l’usage et proposer des améliorations\n- Être le relais des clients auprès du produit\n\n## Votre profil\n- Une première expérience en customer success ou en recrutement\n- Pédagogue, organisé·e et à l’aise à l’oral',
    },
    {
      id: 'j_growth', title: 'Alternance – Growth Marketing', department: 'Marketing', location: 'Paris', contract: 'Alternance', remote: 'onsite',
      experience: 'Débutant accepté', salaryMin: 0, salaryMax: 0, salaryVisible: false, status: 'published', publishedAt: '', publishAt: inDays(5, 9), closesAt: '', projectId: 'p-105',
      multipost: true, jobboards: ['linkedin', 'indeed', 'wttj', 'francetravail'], diffusedAt: '', extraFile: 'off', extraFileLabel: '',
      summary: 'Apprendre le growth en lançant de vraies campagnes.',
      description: '## Vos missions\n- Lancer et analyser des campagnes d’acquisition\n- Écrire des contenus pour notre blog et LinkedIn\n\n## Votre profil\n- En école de commerce ou de marketing, pour une alternance de 12 à 24 mois',
    },
  ];

  const defaultForm = () => ({
    fields: { cv: 'required', coverLetter: 'optional', coverLetterFile: 'optional', extraFile: 'optional', phone: 'optional', linkedin: 'optional' },
    extraFileLabel: 'Fichier complémentaire (portfolio, travaux…)',
    questions: [
      { id: 'q_start', label: 'Quand pourriez-vous commencer ?', type: 'select', options: ['Immédiatement', 'Sous 1 mois', 'Sous 3 mois', 'Plus tard'], required: true, knockout: '' },
      { id: 'q_auth', label: 'Êtes-vous autorisé·e à travailler en France ?', type: 'yesno', options: [], required: true, knockout: 'Non' },
      { id: 'q_source', label: 'Comment avez-vous connu Profilr ?', type: 'select', options: ['LinkedIn', 'Bouche-à-oreille', 'Site emploi', 'Événement', 'Autre'], required: false, knockout: '' },
    ],
    consent: 'J’accepte que Profilr traite mes données pour étudier ma candidature et me recontacter pendant 24 mois. Je peux demander leur suppression à tout moment.',
    talentPoolOptIn: true,
    confirmTitle: 'Merci, votre candidature est bien envoyée',
    confirmText: 'Vous allez recevoir un e-mail de confirmation. Notre équipe vous répond sous 7 jours.',
    autoReplySubject: 'Nous avons bien reçu votre candidature',
  });

  const defaultSettings = () => ({
    siteTitle: 'Carrières chez Profilr',
    slug: 'profilr',
    customDomain: '',
    seoDescription: 'Rejoignez Profilr, l’agent IA de sourcing de talents. Découvrez nos offres d’emploi et notre culture.',
    privacyUrl: 'https://www.profilr.eu/fr/confidentialite/',
    legalUrl: 'https://www.profilr.eu/fr/mentions-legales/',
    retentionMonths: 24,
    notifyEmails: '',
    showPoweredBy: true,
    languages: ['fr', 'en'],
    analytics: true,
    cookieText: 'Nous mesurons l’audience de ce site pour améliorer nos offres. Aucune donnée n’est revendue ni utilisée à des fins publicitaires.',
  });

  /* Traductions anglaises d'exemple. Les textes non traduits s'affichent en français. */
  const seedEnglish = (pages, jobs) => {
    const en = {};
    const tb = (blk, map) => {
      const o = (en['b:' + blk.id] = {});
      Object.keys(map).forEach((path) => {
        /* "props.items.0.title" -> "props.items.<_id>.title" */
        const parts = path.split('.');
        if (parts[0] === 'props' && /^\d+$/.test(parts[2] || '')) parts[2] = blk.props[parts[1]][+parts[2]]._id;
        o[parts.join('.')] = map[path];
      });
    };
    const [hero, stats, ti, values, teams, , benefits, , jobsB, faq, cta] = pages[0].blocks;
    tb(hero, { 'props.eyebrow': 'Careers at Profilr', 'props.title': 'Help recruiters find the right people, faster.', 'props.subtitle': 'Profilr builds the AI sourcing agent that searches the whole web and talent pools, ranks the best profiles and starts the conversation. We are growing the team.', 'props.ctaLabel': 'See open roles', 'props.secondaryLabel': 'Open application' });
    tb(stats, { 'props.items.0.label': 'people on the team', 'props.items.1.label': 'nationalities', 'props.items.2.label': 'remote days per week', 'props.items.3.label': 'average employee rating' });
    tb(ti, { 'props.eyebrow': 'Our mission', 'props.title': 'Putting people back into recruiting', 'props.body': 'Recruiters spend hours searching for profiles instead of talking to them. Profilr automates search, screening and outreach to give them that time back.\n\nWe are a product, tech and sales team working closely with our customers: recruitment agencies, talent acquisition and HR teams.', menu: 'Company' });
    tb(values, { 'props.title': 'What guides us', 'props.intro': 'Four principles we apply every day, from code to customer meetings.', 'props.items.0.title': 'Candidates first', 'props.items.0.text': 'Every feature should make the experience more respectful for the people we contact.', 'props.items.1.title': 'High standards, kept simple', 'props.items.1.text': 'One thing done well beats ten half-finished ones.', 'props.items.2.title': 'Learn fast', 'props.items.2.text': 'We ship often, measure and adjust. Being wrong is part of the job.', 'props.items.3.title': 'Transparency', 'props.items.3.text': 'Numbers, decisions and salaries are shared with the whole team.', menu: 'Our values' });
    tb(teams, { 'props.title': 'Our teams', 'props.intro': 'Find the team where you will have the most impact.' });
    tb(benefits, { 'props.title': 'Our benefits', menu: 'Benefits' });
    tb(jobsB, { 'props.title': 'Open roles', 'props.intro': 'All our roles are open to people with disabilities.', menu: 'Open roles' });
    tb(faq, { 'props.title': 'Frequently asked questions', 'props.items.0.q': 'Can I apply to several roles?', 'props.items.0.a': 'Yes. Each application is reviewed separately, and we will tell you if another role suits you better.', 'props.items.1.q': 'How long does the process take?', 'props.items.1.a': 'Three weeks on average from application to offer.' });
    tb(cta, { 'props.title': 'Can’t find the right role?', 'props.text': 'Send us an open application. We read it and get back to you as soon as an opportunity comes up.', 'props.buttonLabel': 'Open application' });
    en['p:' + pages[1].id] = { title: 'Life at Profilr' };
    en['j:j_backend'] = { title: 'Senior Back-end Engineer (Python)', summary: 'Design the services that run our sourcing agent at scale.', description: '## What you will do\n- Design and evolve our APIs and data pipelines (Python, PostgreSQL, Elasticsearch)\n- Make profile search faster and more relevant\n- Take part in architecture decisions with the CTO\n- Mentor two more junior developers\n\n## About you\n- 5+ years of back-end experience, much of it in Python\n- Comfortable with databases and full-text search\n- You like to understand your users’ job' };
    en['j:j_design'] = { title: 'Product Designer', summary: 'Shape the recruiter experience, from search to outreach.', description: '## What you will do\n- Lead design end to end: user research, prototypes, tests, follow-up in production\n- Evolve our design system\n- Pair with product managers and developers\n\n## About you\n- 3+ years on a SaaS product\n- A portfolio that shows your process, not just the result', extraFileLabel: 'Portfolio' };
    en.form = {
      'questions.q_start.label': 'When could you start?', 'questions.q_start.options': ['Immediately', 'Within 1 month', 'Within 3 months', 'Later'],
      'questions.q_auth.label': 'Are you authorised to work in France?', 'questions.q_source.label': 'How did you hear about Profilr?',
      consent: 'I agree that Profilr may process my data to review my application and contact me for 24 months. I can ask for it to be deleted at any time.',
      confirmTitle: 'Thank you, your application has been sent', confirmText: 'You will receive a confirmation email. Our team replies within 7 days.',
      extraFileLabel: 'Additional file (portfolio, work samples…)',
    };
    en.settings = { siteTitle: 'Careers at Profilr', seoDescription: 'Join Profilr, the AI talent sourcing agent. Discover our open roles and our culture.', cookieText: 'We measure traffic on this site to improve our job ads. No data is sold or used for advertising.' };
    return { en };
  };

  const sampleApplications = () => [
    {
      id: 'a_s1', jobId: 'j_backend', createdAt: daysAgo(0.2), sample: true, status: 'Nouveau', source: 'LinkedIn', lang: 'fr',
      firstName: 'Léa', lastName: 'Fontaine', email: 'lea.fontaine@example.com', phone: '', linkedin: 'linkedin.com/in/exemple', coverLetter: '',
      cv: { name: 'CV-Lea-Fontaine.pdf', size: 182000 }, files: {}, answers: { q_start: 'Sous 3 mois', q_auth: 'Oui', q_source: 'LinkedIn' }, knockedOut: false, talentPool: true,
    },
    {
      id: 'a_s2', jobId: 'j_design', createdAt: daysAgo(1.4), sample: true, status: 'À qualifier', source: 'Google', lang: 'en',
      firstName: 'Mehdi', lastName: 'Laurent', email: 'mehdi.laurent@example.com', phone: '06 00 00 00 00', linkedin: '', coverLetter: 'Votre approche du design centrée sur les recruteurs m’intéresse beaucoup.',
      cv: { name: 'CV-MLaurent.pdf', size: 240000 }, files: { extraFile: { name: 'Portfolio-MLaurent.pdf', size: 8400000, label: 'Portfolio' }, coverLetterFile: { name: 'Lettre-MLaurent.pdf', size: 64000 } },
      answers: { q_start: 'Sous 1 mois', q_auth: 'Oui', q_source: 'Site emploi' }, knockedOut: false, talentPool: true,
    },
    {
      id: 'a_s3', jobId: null, createdAt: daysAgo(3), sample: true, status: 'Nouveau', source: 'Accès direct', lang: 'fr',
      firstName: 'Sofia', lastName: 'Marchetti', email: 'sofia.marchetti@example.com', phone: '', linkedin: '', coverLetter: '',
      cv: { name: 'CV_Sofia_Marchetti.pdf', size: 96000 }, files: {}, answers: { q_start: 'Plus tard', q_auth: 'Non', q_source: 'Événement' }, knockedOut: true, talentPool: false,
    },
  ];

  /* Statistiques d'exemple sur 60 jours, agrégées par jour (pas de données personnelles) */
  const sampleStats = (jobs) => {
    const daily = {};
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const live = jobs.filter((j) => j.status === 'published' && !j.publishAt).map((j) => j.id);
    const weight = { j_backend: 1.3, j_design: 1.6, j_ae: 0.8, j_csm: 1.0 };
    for (let i = 60; i >= 1; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const we = d.getDay() === 0 || d.getDay() === 6;
      const trend = 1 + (60 - i) / 90;
      const visits = Math.round((we ? 28 : 70) * trend * (0.75 + rnd() * 0.5));
      const jobViews = {};
      let jv = 0;
      live.forEach((id) => { const n = Math.round(visits * 0.22 * (weight[id] || 1) * (0.7 + rnd() * 0.6)); jobViews[id] = n; jv += n; });
      const starts = Math.round(jv * (0.16 + rnd() * 0.06));
      const applies = Math.round(starts * (0.42 + rnd() * 0.18));
      const sources = {};
      const mix = [0.31, 0.24, 0.14, 0.11, 0.15, 0.05];
      SOURCES.forEach((s, k) => (sources[s] = Math.round(visits * mix[k] * (0.8 + rnd() * 0.4))));
      const appSources = {};
      let left = applies;
      SOURCES.forEach((s, k) => { const n = k === SOURCES.length - 1 ? left : Math.min(left, Math.round(applies * [0.34, 0.18, 0.2, 0.12, 0.1, 0.06][k])); appSources[s] = n; left -= n; });
      const consentYes = Math.round(visits * 0.71);
      daily[U.dayKey(d)] = { s: 1, visits, pageViews: Math.round(visits * 2.4), jobViews, applyStarts: starts, applies, sources, appSources, consentYes, consentNo: visits - consentYes, langs: { fr: Math.round(visits * 0.82), en: visits - Math.round(visits * 0.82) } };
    }
    return { daily };
  };

  const defaultDraft = () => {
    const pages = [
      { id: 'home', title: 'Accueil', slug: '', inMenu: false, blocks: homeBlocks() },
      { id: 'p_life', title: 'Vie chez nous', slug: 'vie-chez-nous', inMenu: true, blocks: lifeBlocks() },
    ];
    U.ensureIds(pages);
    const jobs = defaultJobs();
    return { settings: defaultSettings(), theme: U.clone(PROFILR_THEME), pages, jobs, form: defaultForm(), i18n: seedEnglish(pages, jobs) };
  };

  const fresh = () => {
    const draft = defaultDraft();
    const v1 = U.clone(draft);
    v1.jobs = v1.jobs.filter((j) => j.id !== 'j_backend' && j.id !== 'j_growth');
    v1.pages.pop();
    return {
      draft,
      published: U.clone(draft),
      publishedAt: daysAgo(3),
      versions: [
        { id: 'v1', n: 1, at: daysAgo(21), author: 'Vous', summary: 'Première mise en ligne', snapshot: v1 },
        { id: 'v2', n: 2, at: daysAgo(3), author: 'Vous', summary: '1 page ajoutée · 2 offres ajoutées', snapshot: U.clone(draft) },
      ],
      applications: sampleApplications(),
      stats: sampleStats(draft.jobs),
    };
  };

  /* Résumé lisible des différences entre deux versions */
  const diffSummary = (a, b2) => {
    if (!a) return 'Première mise en ligne';
    const out = [];
    const ids = (arr) => new Set(arr.map((x) => x.id));
    const cnt = (n, one, many) => n + ' ' + (n > 1 ? many : one);
    const pa = ids(a.pages), pb = ids(b2.pages);
    const pAdd = [...pb].filter((x) => !pa.has(x)).length, pDel = [...pa].filter((x) => !pb.has(x)).length;
    if (pAdd) out.push(cnt(pAdd, 'page ajoutée', 'pages ajoutées'));
    if (pDel) out.push(cnt(pDel, 'page supprimée', 'pages supprimées'));
    const blocksOf = (d) => { const m = {}; d.pages.forEach((p) => p.blocks.forEach((x) => (m[x.id] = JSON.stringify(x)))); return m; };
    const ba = blocksOf(a), bb = blocksOf(b2);
    const bAdd = Object.keys(bb).filter((k) => !(k in ba)).length, bDel = Object.keys(ba).filter((k) => !(k in bb)).length;
    const bMod = Object.keys(bb).filter((k) => k in ba && ba[k] !== bb[k]).length;
    if (bAdd) out.push(cnt(bAdd, 'bloc ajouté', 'blocs ajoutés'));
    if (bDel) out.push(cnt(bDel, 'bloc supprimé', 'blocs supprimés'));
    if (bMod) out.push(cnt(bMod, 'bloc modifié', 'blocs modifiés'));
    const live = (d) => new Set(d.jobs.filter((j) => j.status === 'published').map((j) => j.id));
    const ja = live(a), jb = live(b2);
    const jAdd = [...jb].filter((x) => !ja.has(x)).length, jDel = [...ja].filter((x) => !jb.has(x)).length;
    const jMod = b2.jobs.filter((j) => { const o = a.jobs.find((x) => x.id === j.id); return o && ja.has(j.id) && jb.has(j.id) && JSON.stringify(o) !== JSON.stringify(j); }).length;
    if (jAdd) out.push(cnt(jAdd, 'offre publiée', 'offres publiées'));
    if (jDel) out.push(cnt(jDel, 'offre retirée', 'offres retirées'));
    if (jMod) out.push(cnt(jMod, 'offre modifiée', 'offres modifiées'));
    if (JSON.stringify(a.theme) !== JSON.stringify(b2.theme)) out.push('thème modifié');
    if (JSON.stringify(a.form) !== JSON.stringify(b2.form)) out.push('formulaire modifié');
    if (JSON.stringify(a.i18n) !== JSON.stringify(b2.i18n)) out.push('traductions modifiées');
    if (JSON.stringify(a.settings) !== JSON.stringify(b2.settings)) out.push('paramètres modifiés');
    return out.length ? out.join(' · ') : 'Aucun changement de contenu';
  };

  /* ---------- Store ---------- */
  const MAX_VERSIONS = 15;
  const listeners = [];
  const store = {
    state: null,
    storageOk: true,
    load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { this.storageOk = false; }
      try { this.state = raw ? JSON.parse(raw) : fresh(); } catch (e) { this.state = fresh(); }
      if (!this.state.draft || !this.state.draft.pages || !this.state.versions) this.state = fresh();
      this.state.stats = this.state.stats || { daily: {} };
      return this.state;
    },
    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
        return true;
      } catch (e) {
        /* stockage plein : on sacrifie d'abord les plus vieilles versions */
        if (this.state.versions && this.state.versions.length > 3) {
          this.state.versions = this.state.versions.slice(-3);
          try { localStorage.setItem(KEY, JSON.stringify(this.state)); CS.toast && CS.toast('Stockage presque plein : seules les 3 dernières versions sont conservées.', 'warn'); return true; } catch (e2) { /* on continue */ }
        }
        if (this.storageOk) CS.toast && CS.toast('Le stockage du navigateur est plein : la dernière modification n’est pas sauvegardée. Utilisez des images plus légères.', 'warn');
        return false;
      }
    },
    saveSoon: null,
    mutate(fn, opts) {
      fn(this.state);
      this.saveSoon();
      listeners.forEach((l) => l(opts || {}));
    },
    subscribe(fn) { listeners.push(fn); },
    reset() {
      this.state = fresh();
      this.save();
      listeners.forEach((l) => l({ structural: true }));
    },
    isDirty() {
      return JSON.stringify(this.state.draft) !== JSON.stringify(this.state.published);
    },
    publish() {
      this.mutate((s) => {
        const now = new Date().toISOString();
        s.draft.jobs.forEach((j) => {
          if (j.status !== 'published') return;
          const scheduled = j.publishAt && new Date(j.publishAt) > new Date();
          if (!j.publishedAt && !scheduled) j.publishedAt = now;
          /* Multidiffusion : en production, Profilr pousse l'offre vers chaque jobboard coché */
          if (j.multipost && (j.jobboards || []).length && !scheduled && !j.diffusedAt) j.diffusedAt = now;
        });
        const summary = diffSummary(s.published, s.draft);
        const n = (s.versions.length ? s.versions[s.versions.length - 1].n : 0) + 1;
        s.versions.push({ id: U.uid('v'), n, at: now, author: 'Vous', summary, snapshot: U.clone(s.draft) });
        if (s.versions.length > MAX_VERSIONS) s.versions = s.versions.slice(-MAX_VERSIONS);
        s.published = U.clone(s.draft);
        s.publishedAt = now;
      }, { structural: true });
    },
    discard() {
      this.mutate((s) => { s.draft = U.clone(s.published); }, { structural: true });
    },
    restore(versionId) {
      const v = this.state.versions.find((x) => x.id === versionId);
      if (!v) return null;
      this.mutate((s) => { s.draft = U.clone(v.snapshot); }, { structural: true });
      return v;
    },
    /* Statistiques : compteurs journaliers, sans donnée personnelle */
    track(field, key, inc) {
      const s = this.state;
      const k = U.dayKey(new Date());
      const day = (s.stats.daily[k] = s.stats.daily[k] || { visits: 0, pageViews: 0, jobViews: {}, applyStarts: 0, applies: 0, sources: {}, appSources: {}, consentYes: 0, consentNo: 0, langs: {} });
      if (key != null) { day[field] = day[field] || {}; day[field][key] = (day[field][key] || 0) + (inc || 1); }
      else day[field] = (day[field] || 0) + (inc || 1);
      this.saveSoon();
    },
  };
  store.saveSoon = U.debounce(() => store.save(), 250);

  CS.store = store;
  CS.data = { PROFILR_THEME, PRESETS, FONTS, PROJECTS, JOBBOARDS, CONTRACTS, REMOTE, EXPERIENCE, APP_STATUSES, SOURCES, defaultForm, diffSummary };
})();
