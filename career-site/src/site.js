/* Moteur du site carrière : transforme les données (thème, blocs, offres, formulaire) en pages.
   Le même moteur sert l'aperçu de l'éditeur et le site public. */
window.CS = window.CS || {};
CS.config = CS.config || { allowEmbeds: true };

(function () {
  const U = CS.U;
  const e = U.esc;
  const site = {};

  /* ---------- Thème -> variables CSS ---------- */
  const fontCss = (name) => {
    const f = CS.data.FONTS.find((x) => x.name === name);
    return f ? f.css : "'" + String(name).replace(/'/g, '') + "', system-ui, sans-serif";
  };
  const loadedFonts = {};
  site.loadFonts = (theme) => {
    [theme.fonts.heading, theme.fonts.body].forEach((name) => {
      const f = CS.data.FONTS.find((x) => x.name === name);
      if (!f || f.local || loadedFonts[name]) return;
      loadedFonts[name] = true;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    });
  };

  site.themeVars = (theme) => {
    const c = theme.colors;
    const radius = { arrondi: ['24px', '16px'], doux: ['14px', '10px'], carre: ['4px', '3px'] }[theme.radius] || ['24px', '16px'];
    const btnRadius = { pilule: '999px', arrondi: '12px', carre: '4px' }[theme.buttons] || '999px';
    const onPrimary = U.onColor(c.primary, c.text, '#FFFFFF');
    const onAccent = U.onColor(c.accent, U.contrast(c.accent, c.primary) > 4.5 ? c.primary : c.text, '#FFFFFF');
    /* Accent utilisé comme couleur de texte/lien sur fond clair : on garde la principale si l'accent est trop pâle */
    const linkOnBg = U.contrast(c.accent, c.background) >= 3 ? c.accent : c.primary;
    /* Bouton "accent" posé sur un fond clair : s'il se confond avec le fond, on bascule sur la principale */
    const accentVisible = U.contrast(c.accent, c.background) >= 1.6;
    const accentLightBg = accentVisible ? c.accent : c.primary;
    const accentLightOn = accentVisible ? onAccent : onPrimary;
    const vars = {
      '--cs-primary': c.primary,
      '--cs-on-primary': onPrimary,
      '--cs-accent': c.accent,
      '--cs-on-accent': onAccent,
      '--cs-text': c.text,
      '--cs-bg': c.background,
      '--cs-surface': c.surface,
      '--cs-link': linkOnBg,
      '--cs-accent-light-bg': accentLightBg,
      '--cs-accent-light-on': accentLightOn,
      '--cs-muted': U.mix(c.text, c.background, 0.38),
      '--cs-line': U.mix(c.text, c.background, 0.86),
      '--cs-primary-soft': U.mix(c.primary, c.background, 0.9),
      '--cs-radius': radius[0],
      '--cs-radius-sm': radius[1],
      '--cs-btn-radius': btnRadius,
      '--cs-font-h': fontCss(theme.fonts.heading),
      '--cs-font-b': fontCss(theme.fonts.body),
    };
    return Object.keys(vars).map((k) => k + ':' + vars[k]).join(';');
  };

  site.logoSrc = (theme, onDark) => {
    if (theme.logo === 'profilr') return U.profilrLogo(onDark ? '#DFFFA5' : theme.colors.primary);
    return theme.logo || '';
  };
  const logoHTML = (theme) => {
    const src = site.logoSrc(theme);
    return src
      ? '<img class="cs-logo" src="' + e(src) + '" alt="' + e(theme.companyName) + '" style="height:' + (Number(theme.logoHeight) || 30) + 'px">'
      : '<span class="cs-wordmark">' + e(theme.companyName || 'Votre entreprise') + '</span>';
  };

  /* ---------- Offres ---------- */
  site.isLive = (job) => job.status === 'published' && (!job.closesAt || new Date(job.closesAt + 'T23:59:59') >= new Date());
  site.liveJobs = (data) => data.jobs.filter(site.isLive);
  const remoteLabel = (id) => (CS.data.REMOTE.find((r) => r.id === id) || {}).label || '';
  site.salaryLabel = (j) => {
    if (!j.salaryVisible || !j.salaryMin) return '';
    const a = U.fmtK(j.salaryMin), b = U.fmtK(j.salaryMax);
    return (b && j.salaryMax > j.salaryMin ? a.replace(' k', '') + ' – ' + b : a) + '€ brut / an';
  };
  const jobChips = (j, withSalary) => {
    const chips = [
      j.location && [U.icon('pin'), j.location],
      j.contract && [U.icon('briefcase'), j.contract],
      j.remote && [U.icon('home'), remoteLabel(j.remote)],
      withSalary && site.salaryLabel(j) && [U.icon('euro'), site.salaryLabel(j)],
    ].filter(Boolean);
    return chips.map((c) => '<span class="cs-chip">' + c[0] + e(c[1]) + '</span>').join('');
  };

  site.jobsList = (ctx, p) => {
    let jobs = site.liveJobs(ctx.data).slice().sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
    const limit = Number(p.limit) || 0;
    if (limit) jobs = jobs.slice(0, limit);
    if (!jobs.length)
      return '<div class="cs-empty">' + U.icon('briefcase') + '<p><strong>Aucune offre ouverte pour le moment.</strong><br>Envoyez-nous une candidature spontanée, nous la lirons avec attention.</p>' +
        '<a class="cs-btn cs-btn--main" href="#" data-go="spontaneous">Candidature spontanée</a></div>';
    const uniq = (k) => Array.from(new Set(jobs.map((j) => j[k]).filter(Boolean))).sort();
    const sel = (k, label, opts) =>
      opts.length > 1
        ? '<label class="cs-field cs-field--inline"><span class="cs-sr">' + label + '</span><select data-filter="' + k + '"><option value="">' + label + '</option>' + opts.map((o) => '<option value="' + e(o.value || o) + '">' + e(o.label || o) + '</option>').join('') + '</select></label>'
        : '';
    const filters = p.filters
      ? '<div class="cs-filters" role="search"><label class="cs-search">' + U.icon('search') + '<span class="cs-sr">Rechercher une offre</span><input type="search" data-filter="q" placeholder="Rechercher un poste, une compétence…"></label>' +
        sel('department', 'Toutes les équipes', uniq('department')) +
        sel('location', 'Tous les lieux', uniq('location')) +
        sel('contract', 'Tous les contrats', uniq('contract')) +
        sel('remote', 'Télétravail', uniq('remote').map((r) => ({ value: r, label: remoteLabel(r) }))) +
        '</div>'
      : '';
    const card = (j) =>
      '<a class="cs-job" href="#" data-go="job:' + e(j.id) + '" data-q="' + e((j.title + ' ' + j.department + ' ' + j.summary + ' ' + U.mdText(j.description)).toLowerCase()) + '" data-department="' + e(j.department) + '" data-location="' + e(j.location) + '" data-contract="' + e(j.contract) + '" data-remote="' + e(j.remote) + '">' +
      '<div class="cs-job__main"><span class="cs-job__dept">' + e(j.department) + '</span><h3 class="cs-job__title">' + e(j.title) + '</h3><div class="cs-chips">' + jobChips(j, false) + '</div></div>' +
      '<span class="cs-job__go">' + U.icon('arrow') + '</span></a>';
    let list;
    if (p.groupBy && p.groupBy !== 'none') {
      const groups = {};
      jobs.forEach((j) => { const k = j[p.groupBy] || 'Autres'; (groups[k] = groups[k] || []).push(j); });
      list = Object.keys(groups).sort().map((k) => '<div class="cs-jobgroup" data-group><h3 class="cs-jobgroup__title">' + e(k) + ' <span>' + groups[k].length + '</span></h3><div class="cs-jobs">' + groups[k].map(card).join('') + '</div></div>').join('');
    } else list = '<div class="cs-jobs">' + jobs.map(card).join('') + '</div>';
    return '<div data-jobs>' + filters + '<p class="cs-count" aria-live="polite"><span data-count>' + jobs.length + '</span> offre' + (jobs.length > 1 ? 's' : '') + ' ouverte' + (jobs.length > 1 ? 's' : '') + '</p>' + list +
      '<div class="cs-empty" data-noresult hidden>' + U.icon('search') + '<p><strong>Aucune offre ne correspond à ces critères.</strong><br>Essayez d’élargir la recherche, ou envoyez une candidature spontanée.</p></div></div>';
  };

  const filterJobs = (box) => {
    const vals = {};
    box.querySelectorAll('[data-filter]').forEach((el) => (vals[el.dataset.filter] = el.value.trim().toLowerCase()));
    let n = 0;
    box.querySelectorAll('.cs-job').forEach((card) => {
      const ok = (!vals.q || card.dataset.q.indexOf(vals.q) >= 0) &&
        ['department', 'location', 'contract', 'remote'].every((k) => !vals[k] || card.dataset[k].toLowerCase() === vals[k]);
      card.hidden = !ok;
      if (ok) n++;
    });
    box.querySelectorAll('[data-group]').forEach((g) => (g.hidden = !g.querySelector('.cs-job:not([hidden])')));
    const c = box.querySelector('[data-count]');
    if (c) c.parentNode.innerHTML = '<span data-count>' + n + '</span> offre' + (n > 1 ? 's' : '') + ' ' + (n > 1 ? 'correspondent' : 'correspond');
    const nr = box.querySelector('[data-noresult]');
    if (nr) nr.hidden = n > 0;
  };

  /* Données structurées schema.org JobPosting, lues par Google for Jobs */
  site.jobPostingLD = (job, data) => {
    const t = data.theme, s = data.settings;
    const ld = {
      '@context': 'https://schema.org/',
      '@type': 'JobPosting',
      title: job.title,
      description: U.md(job.description),
      datePosted: (job.publishedAt || new Date().toISOString()).slice(0, 10),
      employmentType: { CDI: 'FULL_TIME', CDD: 'TEMPORARY', Stage: 'INTERN', Alternance: 'INTERN', Freelance: 'CONTRACTOR' }[job.contract] || 'FULL_TIME',
      hiringOrganization: { '@type': 'Organization', name: t.companyName, sameAs: site.publicUrl(s) },
      jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location, addressCountry: 'FR' } },
      directApply: true,
    };
    if (job.closesAt) ld.validThrough = job.closesAt + 'T23:59:59';
    if (job.remote === 'remote') { ld.jobLocationType = 'TELECOMMUTE'; ld.applicantLocationRequirements = { '@type': 'Country', name: 'France' }; }
    if (job.salaryMin) ld.baseSalary = { '@type': 'MonetaryAmount', currency: 'EUR', value: { '@type': 'QuantitativeValue', minValue: job.salaryMin, maxValue: job.salaryMax || job.salaryMin, unitText: 'YEAR' } };
    return ld;
  };
  site.publicUrl = (s) => 'https://' + (s.customDomain || (s.slug || 'entreprise') + '.jobs.profilr.eu');

  /* ---------- Formulaire de candidature ---------- */
  const field = (id, label, input, req, hint) =>
    '<div class="cs-field"><label for="' + id + '">' + e(label) + (req ? ' <span class="cs-req" aria-hidden="true">*</span>' : ' <span class="cs-opt">(facultatif)</span>') + '</label>' + input +
    (hint ? '<p class="cs-hint">' + e(hint) + '</p>' : '') + '<p class="cs-error" data-error-for="' + id + '" hidden></p></div>';

  site.applyForm = (ctx, job) => {
    const f = ctx.data.form;
    const pre = ctx.idPrefix || 'ap';
    const id = (k) => pre + '-' + k;
    const st = (k) => f.fields[k] || 'off';
    const inp = (k, type, auto, req) => '<input id="' + id(k) + '" name="' + k + '" type="' + type + '" autocomplete="' + auto + '"' + (req ? ' required' : '') + '>';
    let h = '<form class="cs-form" data-apply="' + e(job ? job.id : '') + '" novalidate>';
    h += '<div class="cs-form__row">' + field(id('firstName'), 'Prénom', inp('firstName', 'text', 'given-name', true), true) + field(id('lastName'), 'Nom', inp('lastName', 'text', 'family-name', true), true) + '</div>';
    h += '<div class="cs-form__row">' + field(id('email'), 'E-mail', inp('email', 'email', 'email', true), true) +
      (st('phone') !== 'off' ? field(id('phone'), 'Téléphone', inp('phone', 'tel', 'tel', st('phone') === 'required'), st('phone') === 'required') : '') + '</div>';
    if (st('linkedin') !== 'off') h += field(id('linkedin'), 'Profil LinkedIn', '<input id="' + id('linkedin') + '" name="linkedin" type="url" placeholder="https://www.linkedin.com/in/…"' + (st('linkedin') === 'required' ? ' required' : '') + '>', st('linkedin') === 'required');
    if (st('cv') !== 'off')
      h += field(id('cv'), 'CV',
        '<label class="cs-file" for="' + id('cv') + '">' + U.icon('upload') + '<span data-file-label>Déposez votre CV ou <u>parcourez vos fichiers</u></span><input id="' + id('cv') + '" name="cv" type="file" accept=".pdf,.doc,.docx,.odt"' + (st('cv') === 'required' ? ' required' : '') + '></label>',
        st('cv') === 'required', 'PDF, Word ou ODT, 10 Mo maximum.');
    if (st('coverLetter') !== 'off') h += field(id('coverLetter'), 'Quelques mots sur votre motivation', '<textarea id="' + id('coverLetter') + '" name="coverLetter" rows="5"' + (st('coverLetter') === 'required' ? ' required' : '') + '></textarea>', st('coverLetter') === 'required');
    (f.questions || []).forEach((q) => {
      const qid = id(q.id);
      let input;
      if (q.type === 'textarea') input = '<textarea id="' + qid + '" name="' + e(q.id) + '" rows="3"' + (q.required ? ' required' : '') + '></textarea>';
      else if (q.type === 'select') input = '<select id="' + qid + '" name="' + e(q.id) + '"' + (q.required ? ' required' : '') + '><option value="">Choisir…</option>' + (q.options || []).map((o) => '<option>' + e(o) + '</option>').join('') + '</select>';
      else if (q.type === 'yesno') input = '<div class="cs-radios" role="radiogroup" id="' + qid + '">' + ['Oui', 'Non'].map((o, i) => '<label><input type="radio" name="' + e(q.id) + '" value="' + o + '"' + (q.required && !i ? ' required' : '') + '> ' + o + '</label>').join('') + '</div>';
      else input = '<input id="' + qid + '" name="' + e(q.id) + '" type="text"' + (q.required ? ' required' : '') + '>';
      h += field(qid, q.label, input, q.required);
    });
    const privacy = ctx.data.settings.privacyUrl ? ' <a href="' + e(ctx.data.settings.privacyUrl) + '" target="_blank" rel="noopener">Politique de confidentialité</a>' : '';
    h += '<div class="cs-field cs-check"><label><input type="checkbox" name="consent" id="' + id('consent') + '" required> <span>' + e(f.consent) + privacy + '</span></label><p class="cs-error" data-error-for="' + id('consent') + '" hidden></p></div>';
    if (f.talentPoolOptIn) h += '<div class="cs-field cs-check"><label><input type="checkbox" name="talentPool" id="' + id('talentPool') + '" checked> <span>Me proposer d’autres offres qui pourraient me correspondre.</span></label></div>';
    h += '<div class="cs-form__submit"><button type="submit" class="cs-btn cs-btn--main">' + (job ? 'Envoyer ma candidature' : 'Envoyer ma candidature spontanée') + '</button><p class="cs-hint">Les champs marqués d’un astérisque sont obligatoires.</p></div>';
    return h + '</form>';
  };

  const showError = (form, inputId, msg) => {
    const p = form.querySelector('[data-error-for="' + inputId + '"]');
    if (p) { p.textContent = msg; p.hidden = !msg; }
    const el = form.querySelector('#' + CSS.escape(inputId));
    if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  const submitApply = (form, ctl) => {
    const data = ctl.getData();
    const f = data.form;
    const jobId = form.dataset.apply || null;
    const job = jobId ? data.jobs.find((j) => j.id === jobId) : null;
    const fd = (name) => {
      const el = form.elements[name];
      if (!el) return '';
      if (el instanceof RadioNodeList) return el.value || '';
      return el.type === 'checkbox' ? el.checked : (el.value || '').trim();
    };
    const pre = form.querySelector('input').id.split('-')[0];
    const id = (k) => pre + '-' + k;
    let firstBad = null;
    const check = (k, ok, msg) => {
      showError(form, id(k), ok ? '' : msg);
      if (!ok && !firstBad) firstBad = form.querySelector('#' + CSS.escape(id(k)));
    };
    check('firstName', fd('firstName'), 'Indiquez votre prénom.');
    check('lastName', fd('lastName'), 'Indiquez votre nom.');
    check('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fd('email')), 'Saisissez une adresse e-mail valide, par exemple prenom@domaine.fr.');
    if (f.fields.phone === 'required') check('phone', fd('phone').replace(/\D/g, '').length >= 9, 'Indiquez un numéro de téléphone.');
    if (f.fields.linkedin === 'required') check('linkedin', fd('linkedin'), 'Indiquez l’adresse de votre profil LinkedIn.');
    const cvEl = form.elements.cv;
    const cv = cvEl && cvEl.files && cvEl.files[0];
    if (cvEl) {
      if (cv && cv.size > 10 * 1024 * 1024) check('cv', false, 'Ce fichier dépasse 10 Mo. Envoyez une version plus légère.');
      else check('cv', f.fields.cv !== 'required' || cv, 'Ajoutez votre CV pour continuer.');
    }
    if (f.fields.coverLetter === 'required') check('coverLetter', fd('coverLetter'), 'Écrivez quelques mots sur votre motivation.');
    const answers = {};
    let knockedOut = false;
    (f.questions || []).forEach((q) => {
      const v = fd(q.id);
      answers[q.id] = v;
      if (q.required) check(q.id, v, 'Cette question est obligatoire.');
      if (q.knockout && v && v === q.knockout) knockedOut = true;
    });
    check('consent', fd('consent'), 'Vous devez accepter le traitement de vos données pour envoyer votre candidature.');
    if (firstBad) { firstBad.focus(); return; }
    const app = {
      id: U.uid('a_'), jobId: job ? job.id : null, createdAt: new Date().toISOString(), status: 'Nouveau',
      source: ctl.mode === 'editor' ? 'Aperçu de l’éditeur' : 'Site carrière',
      firstName: fd('firstName'), lastName: fd('lastName'), email: fd('email'), phone: fd('phone'), linkedin: fd('linkedin'), coverLetter: fd('coverLetter'),
      cv: cv ? { name: cv.name, size: cv.size } : null, answers, knockedOut, talentPool: !!fd('talentPool'),
      projectId: job ? job.projectId : 'p-199',
    };
    ctl.onApply && ctl.onApply(app);
    ctl.go({ name: 'done', id: app.jobId, firstName: app.firstName });
  };

  /* ---------- Pages ---------- */
  const header = (ctx) => {
    const blocks = ctx.data.pages[0].blocks.filter((b) => !b.hidden && b.menu);
    return '<header class="cs-header"><div class="cs-wrap cs-header__in"><a href="#" class="cs-header__logo" data-go="home" aria-label="Accueil – ' + e(ctx.data.theme.companyName) + '">' + logoHTML(ctx.data.theme) + '</a>' +
      '<nav class="cs-nav" aria-label="Menu principal">' + blocks.map((b) => '<a href="#" data-go="sec:' + e(b.id) + '">' + e(b.menu) + '</a>').join('') + '</nav>' +
      '<a class="cs-btn cs-btn--main cs-btn--sm" href="#" data-go="jobs">Voir les offres</a></div></header>';
  };
  const footer = (ctx) => {
    const s = ctx.data.settings, t = ctx.data.theme;
    return '<footer class="cs-footer"><div class="cs-wrap cs-footer__in"><div>' + logoHTML(t) + '<p>© ' + new Date().getFullYear() + ' ' + e(t.companyName) + '</p></div>' +
      '<nav aria-label="Liens légaux"><a href="#" data-go="jobs">Offres</a><a href="#" data-go="spontaneous">Candidature spontanée</a>' + (s.privacyUrl ? '<a href="' + e(s.privacyUrl) + '" target="_blank" rel="noopener">Confidentialité</a>' : '') + '</nav>' +
      (s.showPoweredBy ? '<p class="cs-powered">Site carrière propulsé par <strong>Profilr</strong></p>' : '') + '</div></footer>';
  };

  const sectionHTML = (b, ctx) => {
    const def = CS.blocks.BLOCKS[b.type];
    if (!def) return '';
    let inner;
    try { inner = def.render(b.props || {}, ctx); } catch (err) { inner = '<div class="cs-wrap"><p class="cs-empty">Ce bloc n’a pas pu s’afficher.</p></div>'; console.error(err); }
    const editor = ctx.mode === 'editor';
    return '<section class="cs-sec cs-sec--' + b.type + ' cs-bg-' + (b.bg || 'default') + (editor && ctx.selectedId === b.id ? ' is-selected' : '') + '" id="sec-' + e(b.id) + '" data-block="' + e(b.id) + '"' +
      (editor ? ' data-label="' + e(def.label) + '"' : '') + '>' + inner + '</section>';
  };

  const homePage = (ctx) => ctx.data.pages[0].blocks.filter((b) => !b.hidden).map((b) => sectionHTML(b, ctx)).join('') ||
    '<section class="cs-sec"><div class="cs-wrap cs-empty"><p><strong>Cette page est vide.</strong><br>Ajoutez des blocs depuis le panneau de gauche.</p></div></section>';

  const jobsPage = (ctx) => '<section class="cs-sec"><div class="cs-wrap"><h1 class="cs-h1 cs-h1--page">Nos offres</h1>' + site.jobsList(ctx, { filters: true, groupBy: 'none' }) + '</div></section>';

  const jobPage = (ctx, job) => {
    if (!job) return '<section class="cs-sec"><div class="cs-wrap cs-empty"><p><strong>Cette offre n’est plus en ligne.</strong></p><a class="cs-btn cs-btn--main" href="#" data-go="jobs">Voir les offres ouvertes</a></div></section>';
    const draftNote = !site.isLive(job) ? '<p class="cs-draftnote">' + U.icon('eyeOff') + 'Aperçu : cette offre n’est pas visible par les candidats (' + (job.status === 'draft' ? 'brouillon' : job.status === 'archived' ? 'archivée' : 'expirée') + ').</p>' : '';
    const facts = [
      ['Équipe', job.department], ['Lieu', job.location], ['Contrat', job.contract], ['Télétravail', remoteLabel(job.remote)],
      ['Expérience', job.experience], ['Salaire', site.salaryLabel(job)], ['Publiée', job.publishedAt ? U.relDays(job.publishedAt) : ''],
    ].filter((x) => x[1]);
    return draftNote +
      '<section class="cs-sec cs-bg-surface cs-jobhead"><div class="cs-wrap"><a href="#" class="cs-back" data-go="jobs">' + U.icon('back') + 'Toutes les offres</a>' +
      '<p class="cs-eyebrow">' + e(job.department) + '</p><h1 class="cs-h1">' + e(job.title) + '</h1>' + (job.summary ? '<p class="cs-lead">' + e(job.summary) + '</p>' : '') +
      '<div class="cs-chips">' + jobChips(job, true) + '</div></div></section>' +
      '<section class="cs-sec"><div class="cs-wrap cs-jobbody"><article class="cs-prose">' + U.md(job.description) + '</article>' +
      '<aside class="cs-jobaside"><dl>' + facts.map((f) => '<div><dt>' + e(f[0]) + '</dt><dd>' + e(f[1]) + '</dd></div>').join('') + '</dl>' +
      '<a class="cs-btn cs-btn--main cs-btn--block" href="#" data-go="sec:postuler">Postuler</a>' +
      '<button type="button" class="cs-btn cs-btn--ghost cs-btn--block" data-copy-job="' + e(job.id) + '">' + U.icon('link') + 'Copier le lien de l’offre</button></aside></div></section>' +
      '<section class="cs-sec cs-bg-surface" id="sec-postuler"><div class="cs-wrap cs-narrow"><h2 class="cs-h2">Postuler</h2><p class="cs-intro">' + e(job.title) + ' · ' + e(job.location) + '</p>' + site.applyForm(ctx, job) + '</div></section>';
  };

  const spontaneousPage = (ctx) =>
    '<section class="cs-sec cs-bg-surface cs-jobhead"><div class="cs-wrap cs-narrow"><a href="#" class="cs-back" data-go="home">' + U.icon('back') + 'Retour</a><p class="cs-eyebrow">Candidature spontanée</p>' +
    '<h1 class="cs-h1">Parlez-nous de vous</h1><p class="cs-lead">Aucune offre ne vous correspond pour l’instant ? Laissez-nous votre candidature, nous revenons vers vous dès qu’un poste s’ouvre.</p></div></section>' +
    '<section class="cs-sec"><div class="cs-wrap cs-narrow">' + site.applyForm(ctx, null) + '</div></section>';

  const donePage = (ctx, route) => {
    const f = ctx.data.form;
    const job = route.id ? ctx.data.jobs.find((j) => j.id === route.id) : null;
    return '<section class="cs-sec"><div class="cs-wrap cs-narrow cs-done"><span class="cs-done__icon">' + U.icon('check') + '</span>' +
      '<h1 class="cs-h1 cs-h1--page">' + e(f.confirmTitle) + '</h1>' + (job ? '<p class="cs-eyebrow">' + e(job.title) + '</p>' : '') + '<p class="cs-lead">' + e(f.confirmText) + '</p>' +
      '<div class="cs-actions cs-actions--center"><a class="cs-btn cs-btn--main" href="#" data-go="jobs">Voir les autres offres</a><a class="cs-btn cs-btn--ghost" href="#" data-go="home">Retour à l’accueil</a></div></div></section>';
  };

  /* ---------- Rendu complet ---------- */
  site.render = (ctl) => {
    const data = ctl.getData();
    const route = ctl.route || { name: 'home' };
    const ctx = { data, theme: data.theme, mode: ctl.mode, selectedId: ctl.selectedId, idPrefix: ctl.mode === 'editor' ? 'pv' : 'ap' };
    site.loadFonts(data.theme);
    let main;
    if (route.name === 'job') main = jobPage(ctx, data.jobs.find((j) => j.id === route.id));
    else if (route.name === 'spontaneous') main = spontaneousPage(ctx);
    else if (route.name === 'done') main = donePage(ctx, route);
    else if (route.name === 'jobs' && !data.pages[0].blocks.some((b) => b.type === 'jobs' && !b.hidden)) main = jobsPage(ctx);
    else main = homePage(ctx);
    const root = ctl.root;
    root.setAttribute('style', site.themeVars(data.theme));
    root.classList.add('cs-root');
    root.classList.toggle('cs-root--editor', ctl.mode === 'editor');
    root.innerHTML = header(ctx) + '<main class="cs-main">' + main + '</main>' + footer(ctx);
    site.bind(ctl);
    /* Google for Jobs : données structurées de l'offre affichée (site public seulement) */
    if (ctl.mode !== 'editor') {
      let ld = document.getElementById('cs-jobposting');
      const job = route.name === 'job' && data.jobs.find((j) => j.id === route.id && site.isLive(j));
      if (job) {
        if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'cs-jobposting'; document.head.appendChild(ld); }
        ld.textContent = JSON.stringify(site.jobPostingLD(job, data));
      } else if (ld) ld.remove();
      document.title = job ? job.title + ' – ' + data.theme.companyName : data.settings.siteTitle;
    }
  };

  /* Navigation interne du site : data-go="home | jobs | spontaneous | job:<id> | sec:<id>" */
  site.bind = (ctl) => {
    const root = ctl.root;
    if (root._csBound) return;
    root._csBound = true;
    root.addEventListener('click', (ev) => {
      const embed = ev.target.closest('[data-embed]');
      if (embed) {
        const fr = document.createElement('iframe');
        fr.src = embed.dataset.embed + '?autoplay=1';
        fr.allow = 'autoplay; fullscreen; picture-in-picture';
        fr.allowFullscreen = true;
        fr.title = 'Vidéo';
        fr.className = 'cs-video__el';
        embed.replaceWith(fr);
        return;
      }
      const copy = ev.target.closest('[data-copy-job]');
      if (copy) {
        const url = site.publicUrl(ctl.getData().settings) + '/offres/' + copy.dataset.copyJob;
        const done = () => { copy.lastChild.textContent = 'Lien copié'; setTimeout(() => { copy.lastChild.textContent = 'Copier le lien de l’offre'; }, 1800); };
        try { navigator.clipboard.writeText(url).then(done, () => CS.toast && CS.toast(url)); } catch (err) { CS.toast && CS.toast(url); }
        return;
      }
      const go = ev.target.closest('[data-go]');
      if (go) {
        ev.preventDefault();
        ev.stopPropagation();
        const v = go.dataset.go;
        if (v.indexOf('sec:') === 0) {
          const target = root.querySelector('#sec-' + CSS.escape(v.slice(4)));
          if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
          ctl.go({ name: 'home' }, () => { const t = root.querySelector('#sec-' + CSS.escape(v.slice(4))); t && t.scrollIntoView({ block: 'start' }); });
          return;
        }
        if (v === 'jobs') {
          const jb = ctl.getData().pages[0].blocks.find((b) => b.type === 'jobs' && !b.hidden);
          if (jb) {
            const scrollToJobs = () => { const t = root.querySelector('#sec-' + CSS.escape(jb.id)); t && t.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
            if ((ctl.route || {}).name === 'home' || !ctl.route) scrollToJobs();
            else ctl.go({ name: 'home' }, scrollToJobs);
            return;
          }
          return ctl.go({ name: 'jobs' });
        }
        if (v === 'home') return ctl.go({ name: 'home' });
        if (v === 'spontaneous') return ctl.go({ name: 'spontaneous' });
        if (v.indexOf('job:') === 0) return ctl.go({ name: 'job', id: v.slice(4) });
        return;
      }
      if (ctl.mode === 'editor' && ctl.onSelectBlock) {
        const sec = ev.target.closest('[data-block]');
        if (sec && !ev.target.closest('input,select,textarea,label,summary,button,a')) ctl.onSelectBlock(sec.dataset.block);
      }
    });
    root.addEventListener('input', (ev) => {
      const box = ev.target.closest('[data-jobs]');
      if (box && ev.target.dataset.filter) filterJobs(box);
    });
    root.addEventListener('change', (ev) => {
      const box = ev.target.closest('[data-jobs]');
      if (box && ev.target.dataset.filter) filterJobs(box);
      if (ev.target.type === 'file') {
        const label = ev.target.parentNode.querySelector('[data-file-label]');
        const file = ev.target.files[0];
        if (label) label.innerHTML = file ? U.icon('file') + ' ' + e(file.name) + ' <span class="cs-opt">(' + Math.round(file.size / 1024) + ' Ko)</span>' : 'Déposez votre CV ou <u>parcourez vos fichiers</u>';
      }
      const form = ev.target.closest('form[data-apply]');
      if (form && ev.target.id) showError(form, ev.target.id, '');
    });
    root.addEventListener('submit', (ev) => {
      const form = ev.target.closest('form[data-apply]');
      if (!form) return;
      ev.preventDefault();
      submitApply(form, ctl);
    });
  };

  CS.site = site;
})();
