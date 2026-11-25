/* État du module : brouillon, version publiée, candidatures. Persistance navigateur (prototype). */
window.CS = window.CS || {};

(function () {
  const U = CS.U;
  const KEY = 'profilr-site-carriere-v1';

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
    {
      id: 'ocean', name: 'Océan',
      theme: { colors: { primary: '#123B6D', accent: '#FFB547', text: '#18263A', background: '#FFFFFF', surface: '#EEF3F9' }, fonts: { heading: 'Space Grotesk', body: 'Inter' }, radius: 'doux', buttons: 'arrondi' },
    },
    {
      id: 'terre', name: 'Terre cuite',
      theme: { colors: { primary: '#8C2F1B', accent: '#F6D7B0', text: '#2B1B14', background: '#FFFCF8', surface: '#F7EEE4' }, fonts: { heading: 'Fraunces', body: 'Work Sans' }, radius: 'doux', buttons: 'arrondi' },
    },
    {
      id: 'graphite', name: 'Graphite',
      theme: { colors: { primary: '#16161A', accent: '#7C5CFF', text: '#1C1C21', background: '#FFFFFF', surface: '#F3F3F5' }, fonts: { heading: 'Manrope', body: 'Manrope' }, radius: 'carre', buttons: 'carre' },
    },
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

  /* Projets Profilr auxquels rattacher une offre. En production : liste lue depuis l'API Profilr. */
  const PROJECTS = [
    { id: 'p-101', name: 'Back-end senior – Python' },
    { id: 'p-102', name: 'Product Designer' },
    { id: 'p-103', name: 'Account Executive mid-market' },
    { id: 'p-104', name: 'Customer Success Manager' },
    { id: 'p-105', name: 'Alternance Growth' },
    { id: 'p-199', name: 'Vivier – candidatures spontanées' },
  ];

  const CONTRACTS = ['CDI', 'CDD', 'Stage', 'Alternance', 'Freelance'];
  const REMOTE = [
    { id: 'onsite', label: 'Sur site' },
    { id: 'hybrid', label: 'Télétravail partiel' },
    { id: 'remote', label: 'Télétravail complet' },
  ];
  const EXPERIENCE = ['Débutant accepté', '1 à 3 ans', '3 à 5 ans', '5 ans et plus'];
  const APP_STATUSES = ['Nouveau', 'À qualifier', 'Entretien', 'Proposition', 'Embauché', 'Refusé'];

  /* ---------- Contenu d'exemple ---------- */
  const b = (type, props, extra) => Object.assign({ id: U.uid('b_'), type, hidden: false, bg: 'default', menu: '', props }, extra || {});

  const defaultPage = () => ({
    id: 'home',
    title: 'Accueil',
    blocks: [
      b('hero', {
        layout: 'split',
        eyebrow: 'Carrières chez Profilr',
        title: 'Aidez les recruteurs à trouver les bonnes personnes, plus vite.',
        subtitle: 'Profilr construit l’agent IA de sourcing qui cherche sur tout le web et dans les viviers, classe les meilleurs profils et lance la prise de contact. On agrandit l’équipe.',
        ctaLabel: 'Voir les offres', ctaAction: 'jobs',
        secondaryLabel: 'Candidature spontanée', secondaryAction: 'spontaneous',
        image: 'ph:1',
      }, { bg: 'primary' }),
      b('stats', {
        title: '',
        items: [
          { value: '35', label: 'personnes dans l’équipe' },
          { value: '8', label: 'nationalités' },
          { value: '2 j', label: 'de télétravail par semaine' },
          { value: '4,7/5', label: 'note moyenne des collaborateurs' },
        ],
      }),
      b('textImage', {
        eyebrow: 'Notre mission',
        title: 'Remettre de l’humain dans le recrutement',
        body: 'Les recruteurs passent des heures à chercher des profils au lieu de leur parler. Profilr automatise la recherche, la qualification et la prise de contact, pour leur rendre ce temps.\n\nNous sommes une équipe produit, tech et commerciale qui travaille au plus près de ses clients : cabinets de recrutement, équipes talent acquisition et RH.',
        image: 'ph:2', side: 'right', ctaLabel: '', ctaAction: 'jobs',
      }, { menu: 'L’entreprise' }),
      b('values', {
        title: 'Ce qui nous guide',
        intro: 'Quatre principes qu’on applique au quotidien, du code aux rendez-vous clients.',
        items: [
          { icon: 'heart', title: 'Le candidat d’abord', text: 'Chaque fonctionnalité doit rendre l’expérience plus respectueuse pour les personnes qu’on contacte.' },
          { icon: 'target', title: 'Exigence et simplicité', text: 'On préfère une chose bien faite à dix choses à moitié finies.' },
          { icon: 'rocket', title: 'Apprendre vite', text: 'On livre souvent, on mesure, on ajuste. Se tromper fait partie du travail.' },
          { icon: 'chat', title: 'Transparence', text: 'Les chiffres, les décisions et les salaires sont partagés avec toute l’équipe.' },
        ],
      }, { bg: 'surface', menu: 'Nos valeurs' }),
      b('video', {
        title: 'Une journée chez Profilr',
        text: 'Trois minutes avec l’équipe, entre deux mises en production.',
        url: '', poster: 'ph:3',
      }),
      b('testimonials', {
        title: 'Ils et elles en parlent',
        items: [
          { quote: 'J’ai rejoint Profilr pour l’impact produit. Ce que je livre le lundi est utilisé par des recruteurs le mardi.', name: 'Camille R.', role: 'Product Designer', photo: '' },
          { quote: 'On me fait confiance dès le premier mois, avec un vrai accompagnement technique derrière.', name: 'Yanis B.', role: 'Ingénieur back-end', photo: '' },
          { quote: 'Nos clients nous parlent tous les jours. Leurs retours changent vraiment la feuille de route.', name: 'Inès M.', role: 'Customer Success Manager', photo: '' },
        ],
      }),
      b('gallery', {
        title: 'La vie au bureau',
        layout: 'mosaic',
        items: [
          { image: 'ph:4', caption: 'Le point produit du lundi' },
          { image: 'ph:0', caption: 'Séminaire d’équipe' },
          { image: 'ph:5', caption: 'Nos bureaux' },
          { image: 'ph:2', caption: 'Hackathon IA' },
          { image: 'ph:3', caption: 'Afterwork mensuel' },
        ],
      }),
      b('benefits', {
        title: 'Nos avantages',
        intro: '',
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
        title: 'Comment se passe le recrutement',
        intro: 'Quatre étapes, trois semaines en moyenne. On répond à chaque candidature.',
        items: [
          { title: 'Candidature', text: 'Vous postulez en ligne. Réponse sous 7 jours.', duration: '5 min' },
          { title: 'Premier échange', text: 'Un appel avec l’équipe recrutement pour faire connaissance.', duration: '30 min' },
          { title: 'Entretien métier', text: 'Avec votre futur·e manager, autour d’un cas concret.', duration: '1 h' },
          { title: 'Rencontre de l’équipe', text: 'Un moment avec vos futurs collègues, puis notre proposition.', duration: '1 h' },
        ],
      }),
      b('jobs', {
        title: 'Nos offres',
        intro: 'Toutes nos offres sont ouvertes aux personnes en situation de handicap.',
        filters: true, groupBy: 'none', limit: 0,
      }, { menu: 'Offres' }),
      b('faq', {
        title: 'Questions fréquentes',
        items: [
          { q: 'Puis-je postuler à plusieurs offres ?', a: 'Oui. Chaque candidature est étudiée séparément, et on vous prévient si un autre poste vous correspond mieux.' },
          { q: 'Combien de temps dure le process ?', a: 'Trois semaines en moyenne entre la candidature et la proposition.' },
          { q: 'Proposez-vous du télétravail complet ?', a: 'Pour certains postes, indiqués « Télétravail complet » sur l’offre. Les autres sont en hybride, avec deux jours à distance.' },
          { q: 'Que devient ma candidature si elle n’est pas retenue ?', a: 'Avec votre accord, nous la gardons deux ans pour vous recontacter si un poste correspond. Vous pouvez demander sa suppression à tout moment.' },
        ],
      }),
      b('cta', {
        title: 'Vous ne trouvez pas le poste qui vous correspond ?',
        text: 'Envoyez-nous une candidature spontanée. On la lit, et on revient vers vous dès qu’une opportunité se présente.',
        buttonLabel: 'Candidature spontanée', action: 'spontaneous',
      }, { bg: 'primary' }),
    ],
  });

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

  const defaultJobs = () => [
    {
      id: 'j_backend', title: 'Ingénieur·e back-end senior (Python)', department: 'Tech', location: 'Paris', contract: 'CDI', remote: 'hybrid',
      experience: '5 ans et plus', salaryMin: 60000, salaryMax: 75000, salaryVisible: true, status: 'published', publishedAt: daysAgo(3), closesAt: '', projectId: 'p-101',
      summary: 'Concevoir les services qui font tourner notre agent de sourcing à grande échelle.',
      description: '## Vos missions\n- Concevoir et faire évoluer nos API et nos pipelines de données (Python, PostgreSQL, Elasticsearch)\n- Rendre la recherche de profils plus rapide et plus pertinente\n- Participer aux choix d’architecture avec le CTO\n- Accompagner deux développeurs plus juniors\n\n## Votre profil\n- 5 ans d’expérience ou plus en back-end, dont une bonne part en Python\n- À l’aise avec les bases de données et la recherche plein texte\n- Vous aimez comprendre le métier de vos utilisateurs\n\n## Ce que nous proposons\nUne équipe tech de huit personnes, des mises en production quotidiennes et une vraie autonomie sur votre périmètre.',
    },
    {
      id: 'j_design', title: 'Product Designer', department: 'Produit', location: 'Paris', contract: 'CDI', remote: 'hybrid',
      experience: '3 à 5 ans', salaryMin: 50000, salaryMax: 60000, salaryVisible: true, status: 'published', publishedAt: daysAgo(9), closesAt: '', projectId: 'p-102',
      summary: 'Dessiner l’expérience des recruteurs, de la recherche à la prise de contact.',
      description: '## Vos missions\n- Mener la conception de bout en bout : recherche utilisateur, prototypes, tests, suivi en production\n- Faire évoluer notre design system\n- Travailler en binôme avec les product managers et les développeurs\n\n## Votre profil\n- 3 ans d’expérience ou plus sur un produit SaaS\n- Un portfolio qui montre votre démarche, pas seulement le résultat\n- Figma n’a pas de secret pour vous',
    },
    {
      id: 'j_ae', title: 'Account Executive mid-market', department: 'Sales', location: 'Lyon', contract: 'CDI', remote: 'hybrid',
      experience: '3 à 5 ans', salaryMin: 45000, salaryMax: 55000, salaryVisible: true, status: 'published', publishedAt: daysAgo(14), closesAt: '', projectId: 'p-103',
      summary: 'Faire découvrir Profilr aux cabinets et équipes RH, de la démo à la signature.',
      description: '## Vos missions\n- Gérer un portefeuille de prospects mid-market\n- Mener les démos et les cycles de vente jusqu’à la signature\n- Faire remonter les besoins clients à l’équipe produit\n\n## Votre profil\n- Une première expérience réussie en vente SaaS B2B\n- Une connaissance du recrutement est un vrai plus\n\n**Rémunération :** fixe indiqué + variable déplafonné.',
    },
    {
      id: 'j_csm', title: 'Customer Success Manager', department: 'Customer Success', location: 'France', contract: 'CDI', remote: 'remote',
      experience: '1 à 3 ans', salaryMin: 40000, salaryMax: 48000, salaryVisible: false, status: 'published', publishedAt: daysAgo(21), closesAt: '', projectId: 'p-104',
      summary: 'Accompagner nos clients pour qu’ils tirent le meilleur de Profilr.',
      description: '## Vos missions\n- Onboarder les nouveaux clients et former leurs équipes\n- Suivre l’usage et proposer des améliorations\n- Être le relais des clients auprès du produit\n\n## Votre profil\n- Une première expérience en customer success ou en recrutement\n- Pédagogue, organisé·e et à l’aise à l’oral',
    },
    {
      id: 'j_growth', title: 'Alternance – Growth Marketing', department: 'Marketing', location: 'Paris', contract: 'Alternance', remote: 'onsite',
      experience: 'Débutant accepté', salaryMin: 0, salaryMax: 0, salaryVisible: false, status: 'draft', publishedAt: '', closesAt: '', projectId: 'p-105',
      summary: 'Apprendre le growth en lançant de vraies campagnes.',
      description: '## Vos missions\n- Lancer et analyser des campagnes d’acquisition\n- Écrire des contenus pour notre blog et LinkedIn\n\n## Votre profil\n- En école de commerce ou de marketing, pour une alternance de 12 à 24 mois',
    },
  ];

  const defaultForm = () => ({
    fields: { phone: 'optional', linkedin: 'optional', coverLetter: 'optional', cv: 'required' },
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
    retentionMonths: 24,
    notifyEmails: '',
    showPoweredBy: true,
  });

  const sampleApplications = () => [
    {
      id: 'a_s1', jobId: 'j_backend', createdAt: daysAgo(0.2), sample: true, status: 'Nouveau', source: 'LinkedIn',
      firstName: 'Léa', lastName: 'Fontaine', email: 'lea.fontaine@example.com', phone: '', linkedin: 'linkedin.com/in/exemple', coverLetter: '',
      cv: { name: 'CV-Lea-Fontaine.pdf', size: 182000 }, answers: { q_start: 'Sous 3 mois', q_auth: 'Oui', q_source: 'LinkedIn' }, knockedOut: false, talentPool: true,
    },
    {
      id: 'a_s2', jobId: 'j_design', createdAt: daysAgo(1.4), sample: true, status: 'À qualifier', source: 'Google for Jobs',
      firstName: 'Mehdi', lastName: 'Laurent', email: 'mehdi.laurent@example.com', phone: '06 00 00 00 00', linkedin: '', coverLetter: 'Votre approche du design centrée sur les recruteurs m’intéresse beaucoup.',
      cv: { name: 'Portfolio-MLaurent.pdf', size: 2400000 }, answers: { q_start: 'Sous 1 mois', q_auth: 'Oui', q_source: 'Site emploi' }, knockedOut: false, talentPool: true,
    },
    {
      id: 'a_s3', jobId: null, createdAt: daysAgo(3), sample: true, status: 'Nouveau', source: 'Accès direct',
      firstName: 'Sofia', lastName: 'Marchetti', email: 'sofia.marchetti@example.com', phone: '', linkedin: '', coverLetter: '',
      cv: { name: 'CV_Sofia_Marchetti.pdf', size: 96000 }, answers: { q_start: 'Plus tard', q_auth: 'Non', q_source: 'Événement' }, knockedOut: true, talentPool: false,
    },
  ];

  const defaultDraft = () => ({
    settings: defaultSettings(),
    theme: U.clone(PROFILR_THEME),
    pages: [defaultPage()],
    jobs: defaultJobs(),
    form: defaultForm(),
  });

  const fresh = () => {
    const draft = defaultDraft();
    return { draft, published: U.clone(draft), publishedAt: daysAgo(3), applications: sampleApplications() };
  };

  /* ---------- Store ---------- */
  const listeners = [];
  const store = {
    state: null,
    storageOk: true,
    load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { this.storageOk = false; }
      try { this.state = raw ? JSON.parse(raw) : fresh(); } catch (e) { this.state = fresh(); }
      if (!this.state.draft || !this.state.draft.pages) this.state = fresh();
      return this.state;
    },
    save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
        return true;
      } catch (e) {
        if (this.storageOk) CS.toast && CS.toast('Le stockage du navigateur est plein : la dernière modification n’est pas sauvegardée. Utilisez des images plus légères.', 'warn');
        return false;
      }
    },
    saveSoon: null,
    /* mutate(fn, opts) : modifie l'état puis prévient l'interface */
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
        s.draft.jobs.forEach((j) => { if (j.status === 'published' && !j.publishedAt) j.publishedAt = new Date().toISOString(); });
        s.published = U.clone(s.draft);
        s.publishedAt = new Date().toISOString();
      }, { structural: true });
    },
    discard() {
      this.mutate((s) => { s.draft = U.clone(s.published); }, { structural: true });
    },
  };
  store.saveSoon = U.debounce(() => store.save(), 250);

  CS.store = store;
  CS.data = { PROFILR_THEME, PRESETS, FONTS, PROJECTS, CONTRACTS, REMOTE, EXPERIENCE, APP_STATUSES, defaultForm };
})();
