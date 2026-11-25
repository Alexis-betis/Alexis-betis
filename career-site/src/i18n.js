/* Textes de l'interface du site public, par langue.
   Le contenu (blocs, offres, questions) se traduit dans l'éditeur ; ici ce sont les libellés fixes.
   Ajouter une langue = ajouter un dictionnaire ici et l'entrée dans CS.LANGS. */
window.CS = window.CS || {};

CS.LANGS = [
  { id: 'fr', label: 'Français', short: 'FR', locale: 'fr-FR' },
  { id: 'en', label: 'English', short: 'EN', locale: 'en-GB' },
];

CS.STRINGS = {
  fr: {
    seeJobs: 'Voir les offres', spontaneous: 'Candidature spontanée', home: 'Accueil', allJobs: 'Toutes les offres', back: 'Retour',
    jobsTitle: 'Nos offres', searchPh: 'Rechercher un poste, une compétence…', searchLabel: 'Rechercher une offre',
    allTeams: 'Toutes les équipes', allLocations: 'Tous les lieux', allContracts: 'Tous les contrats', remote: 'Télétravail',
    openJobs: (n) => n + ' offre' + (n > 1 ? 's' : '') + ' ouverte' + (n > 1 ? 's' : ''),
    matchJobs: (n) => n + ' offre' + (n > 1 ? 's' : '') + ' ' + (n > 1 ? 'correspondent' : 'correspond'),
    noJobs: 'Aucune offre ouverte pour le moment.', noJobsSub: 'Envoyez-nous une candidature spontanée, nous la lirons avec attention.',
    noMatch: 'Aucune offre ne correspond à ces critères.', noMatchSub: 'Essayez d’élargir la recherche, ou envoyez une candidature spontanée.',
    jobGone: 'Cette offre n’est plus en ligne.', seeOpenJobs: 'Voir les offres ouvertes',
    team: 'Équipe', location: 'Lieu', contract: 'Contrat', experience: 'Expérience', salary: 'Salaire', posted: 'Publiée',
    apply: 'Postuler', copyLink: 'Copier le lien de l’offre', linkCopied: 'Lien copié', shareLinkedIn: 'Partager sur LinkedIn',
    salaryUnit: '€ brut / an',
    remoteOnsite: 'Sur site', remoteHybrid: 'Télétravail partiel', remoteFull: 'Télétravail complet',
    firstName: 'Prénom', lastName: 'Nom', email: 'E-mail', phone: 'Téléphone', linkedin: 'Profil LinkedIn',
    cv: 'CV', coverLetter: 'Quelques mots sur votre motivation', coverLetterFile: 'Lettre de motivation (fichier)',
    optional: '(facultatif)', choose: 'Choisir…', yes: 'Oui', no: 'Non',
    dropFile: 'Déposez un fichier ou <u>parcourez vos fichiers</u>', fileHint: 'PDF, Word ou ODT, 10 Mo maximum.', extraHint: 'PDF, image ou archive ZIP, 20 Mo maximum.',
    privacy: 'Politique de confidentialité', talentPool: 'Me proposer d’autres offres qui pourraient me correspondre.',
    send: 'Envoyer ma candidature', sendSpontaneous: 'Envoyer ma candidature spontanée', requiredNote: 'Les champs marqués d’un astérisque sont obligatoires.',
    errFirst: 'Indiquez votre prénom.', errLast: 'Indiquez votre nom.', errEmail: 'Saisissez une adresse e-mail valide, par exemple prenom@domaine.fr.',
    errPhone: 'Indiquez un numéro de téléphone.', errLinkedin: 'Indiquez l’adresse de votre profil LinkedIn.',
    errFile: 'Ajoutez ce fichier pour continuer.', errSize: (mo) => 'Ce fichier dépasse ' + mo + ' Mo. Envoyez une version plus légère.',
    errLetter: 'Écrivez quelques mots sur votre motivation.', errRequired: 'Cette question est obligatoire.',
    errConsent: 'Vous devez accepter le traitement de vos données pour envoyer votre candidature.',
    spontTitle: 'Parlez-nous de vous', spontLead: 'Aucune offre ne vous correspond pour l’instant ? Laissez-nous votre candidature, nous revenons vers vous dès qu’un poste s’ouvre.',
    seeOtherJobs: 'Voir les autres offres', backHome: 'Retour à l’accueil', similar: 'Offres similaires',
    rights: 'Mentions légales', poweredBy: 'Site carrière propulsé par', cookies: 'Gérer les cookies',
    emptyPage: 'Cette page est vide.', emptyPageSub: 'Ajoutez des blocs depuis le panneau de gauche.',
    menu: 'Menu', mainNav: 'Menu principal', legalNav: 'Liens légaux', language: 'Langue',
    seeOnMap: 'Voir sur la carte', jobsCount: (n) => n ? n + ' offre' + (n > 1 ? 's' : '') + ' ouverte' + (n > 1 ? 's' : '') : 'Pas d’offre ouverte',
    watchVideo: 'Regarder la vidéo', playVideo: 'Lire la vidéo',
    cookieTitle: 'Mesure d’audience', accept: 'Accepter', refuse: 'Refuser',
    previewHidden: (s) => 'Aperçu : cette offre n’est pas visible par les candidats (' + s + ').',
    stDraft: 'brouillon', stArchived: 'archivée', stExpired: 'expirée', stScheduled: (d) => 'programmée le ' + d,
  },
  en: {
    seeJobs: 'See open roles', spontaneous: 'Open application', home: 'Home', allJobs: 'All open roles', back: 'Back',
    jobsTitle: 'Open roles', searchPh: 'Search a role or a skill…', searchLabel: 'Search open roles',
    allTeams: 'All teams', allLocations: 'All locations', allContracts: 'All contract types', remote: 'Remote work',
    openJobs: (n) => n + ' open role' + (n > 1 ? 's' : ''),
    matchJobs: (n) => n + ' matching role' + (n > 1 ? 's' : ''),
    noJobs: 'No open roles right now.', noJobsSub: 'Send us an open application and we will read it carefully.',
    noMatch: 'No role matches these filters.', noMatchSub: 'Try a broader search, or send an open application.',
    jobGone: 'This role is no longer open.', seeOpenJobs: 'See open roles',
    team: 'Team', location: 'Location', contract: 'Contract', experience: 'Experience', salary: 'Salary', posted: 'Posted',
    apply: 'Apply', copyLink: 'Copy link to this role', linkCopied: 'Link copied', shareLinkedIn: 'Share on LinkedIn',
    salaryUnit: '€ gross / year',
    remoteOnsite: 'On site', remoteHybrid: 'Hybrid', remoteFull: 'Fully remote',
    firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone', linkedin: 'LinkedIn profile',
    cv: 'Resume', coverLetter: 'A few words about your motivation', coverLetterFile: 'Cover letter (file)',
    optional: '(optional)', choose: 'Choose…', yes: 'Yes', no: 'No',
    dropFile: 'Drop a file or <u>browse your files</u>', fileHint: 'PDF, Word or ODT, 10 MB max.', extraHint: 'PDF, image or ZIP archive, 20 MB max.',
    privacy: 'Privacy policy', talentPool: 'Suggest other roles that may suit me.',
    send: 'Send my application', sendSpontaneous: 'Send my open application', requiredNote: 'Fields marked with an asterisk are required.',
    errFirst: 'Enter your first name.', errLast: 'Enter your last name.', errEmail: 'Enter a valid email address, for example name@domain.com.',
    errPhone: 'Enter a phone number.', errLinkedin: 'Enter your LinkedIn profile URL.',
    errFile: 'Add this file to continue.', errSize: (mo) => 'This file is larger than ' + mo + ' MB. Send a lighter version.',
    errLetter: 'Write a few words about your motivation.', errRequired: 'This question is required.',
    errConsent: 'You need to accept the processing of your data to send your application.',
    spontTitle: 'Tell us about yourself', spontLead: 'No role matches you yet? Leave us your application and we will get back to you as soon as one opens.',
    seeOtherJobs: 'See other roles', backHome: 'Back to home', similar: 'Similar roles',
    rights: 'Legal notice', poweredBy: 'Careers site powered by', cookies: 'Cookie settings',
    emptyPage: 'This page is empty.', emptyPageSub: 'Add blocks from the left panel.',
    menu: 'Menu', mainNav: 'Main menu', legalNav: 'Legal links', language: 'Language',
    seeOnMap: 'See on map', jobsCount: (n) => n ? n + ' open role' + (n > 1 ? 's' : '') : 'No open role',
    watchVideo: 'Watch the video', playVideo: 'Play the video',
    cookieTitle: 'Audience measurement', accept: 'Accept', refuse: 'Decline',
    previewHidden: (s) => 'Preview: candidates cannot see this role (' + s + ').',
    stDraft: 'draft', stArchived: 'archived', stExpired: 'expired', stScheduled: (d) => 'scheduled for ' + d,
  },
};

/* t('clé', arg) dans la langue courante du rendu */
CS.t = (lang, key, arg) => {
  const dict = CS.STRINGS[lang] || CS.STRINGS.fr;
  const v = dict[key] != null ? dict[key] : CS.STRINGS.fr[key];
  return typeof v === 'function' ? v(arg) : v == null ? key : v;
};
