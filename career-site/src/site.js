/* Moteur du site carrière : transforme les données (thème, pages, blocs, offres, formulaire, traductions) en pages.
   Le même moteur sert l'aperçu de l'éditeur et le site public. */
window.CS = window.CS || {};
CS.config = CS.config || { allowEmbeds: true };

(function () {
  const U = CS.U;
  const e = U.esc;
  const site = {};
  const CONSENT_KEY = 'profilr-cs-consent';

  /* ---------- Thème -> variables CSS ---------- */
  const fontCss = (name) => {
    const f = CS.data.FONTS.find((x) => x.name === name);
    return f ? f.css : "'" + String(name).replace(/'/g, '') + "', system-ui, sans-serif";
  };
  site.fontCss = fontCss;
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
    const linkOnBg = U.contrast(c.accent, c.background) >= 3 ? c.accent : c.primary;
    /* Bouton "accent" posé sur un fond clair : s'il se confond avec le fond, on bascule sur la principale */
    const accentVisible = U.contrast(c.accent, c.background) >= 1.6;
    const vars = {
      '--cs-primary': c.primary, '--cs-on-primary': onPrimary, '--cs-accent': c.accent, '--cs-on-accent': onAccent,
      '--cs-text': c.text, '--cs-bg': c.background, '--cs-surface': c.surface, '--cs-link': linkOnBg,
      '--cs-accent-light-bg': accentVisible ? c.accent : c.primary, '--cs-accent-light-on': accentVisible ? onAccent : onPrimary,
      '--cs-muted': U.mix(c.text, c.background, 0.38), '--cs-line': U.mix(c.text, c.background, 0.86), '--cs-primary-soft': U.mix(c.primary, c.background, 0.9),
      '--cs-radius': radius[0], '--cs-radius-sm': radius[1], '--cs-btn-radius': btnRadius,
      '--cs-font-h': fontCss(theme.fonts.heading), '--cs-font-b': fontCss(theme.fonts.body),
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

  /* ---------- Langues ----------
     Les traductions sont des surcouches : i18n[lang]['b:<bloc>' | 'p:<page>' | 'j:<offre>' | 'form' | 'settings'] = { chemin: texte }.
     Un texte non traduit garde la version de la langue principale. */
  site.defaultLang = (data) => (data.settings.languages || ['fr'])[0];
  site.localize = (data, lang) => {
    if (!lang || lang === site.defaultLang(data)) return data;
    const tr = (data.i18n || {})[lang];
    if (!tr) return data;
    const d = U.clone(data);
    const apply = (obj, map) => obj && map && Object.keys(map).forEach((path) => { if (map[path] !== '' && map[path] != null && !(Array.isArray(map[path]) && !map[path].length)) U.setPath(obj, path, map[path]); });
    Object.keys(tr).forEach((key) => {
      const [kind, id] = key.split(':');
      if (kind === 'b') d.pages.forEach((p) => apply(p.blocks.find((x) => x.id === id), tr[key]));
      else if (kind === 'p') apply(d.pages.find((x) => x.id === id), tr[key]);
      else if (kind === 'j') apply(d.jobs.find((x) => x.id === id), tr[key]);
      else if (key === 'form') apply(d.form, tr[key]);
      else if (key === 'settings') apply(d.settings, tr[key]);
    });
    return d;
  };

  /* ---------- Offres ---------- */
  site.isScheduled = (job) => job.status === 'published' && !!job.publishAt && new Date(job.publishAt) > new Date();
  site.isLive = (job) => job.status === 'published' && !site.isScheduled(job) && (!job.closesAt || new Date(job.closesAt + 'T23:59:59') >= new Date());
  site.liveJobs = (data) => data.jobs.filter(site.isLive);
  site.postedAt = (job) => job.publishedAt || job.publishAt || '';
  const remoteLabel = (id, lang) => { const r = CS.data.REMOTE.find((x) => x.id === id); return r ? CS.t(lang, r.key) : ''; };
  site.salaryLabel = (j, lang) => {
    if (!j.salaryVisible || !j.salaryMin) return '';
    const a = U.fmtK(j.salaryMin), b = U.fmtK(j.salaryMax);
    return (b && j.salaryMax > j.salaryMin ? a.replace(' k', '') + ' – ' + b : a) + CS.t(lang, 'salaryUnit');
  };
  const jobChips = (j, lang, withSalary) => {
    const chips = [
      j.location && [U.icon('pin'), j.location],
      j.contract && [U.icon('briefcase'), j.contract],
      j.remote && [U.icon('home'), remoteLabel(j.remote, lang)],
      withSalary && site.salaryLabel(j, lang) && [U.icon('euro'), site.salaryLabel(j, lang)],
    ].filter(Boolean);
    return chips.map((c) => '<span class="cs-chip">' + c[0] + e(c[1]) + '</span>').join('');
  };
  const jobCard = (j, lang) =>
    '<a class="cs-job" href="#" data-go="job:' + e(j.id) + '" data-q="' + e((j.title + ' ' + j.department + ' ' + j.summary + ' ' + U.mdText(j.description)).toLowerCase()) + '" data-department="' + e(j.department) + '" data-location="' + e(j.location) + '" data-contract="' + e(j.contract) + '" data-remote="' + e(j.remote) + '">' +
    '<div class="cs-job__main"><span class="cs-job__dept">' + e(j.department) + '</span><h3 class="cs-job__title">' + e(j.title) + '</h3><div class="cs-chips">' + jobChips(j, lang, false) + '</div></div>' +
    '<span class="cs-job__go">' + U.icon('arrow') + '</span></a>';

  site.jobsList = (ctx, p) => {
    const L = ctx.lang;
    let jobs = site.liveJobs(ctx.data).slice().sort((a, b) => String(site.postedAt(b)).localeCompare(String(site.postedAt(a))));
    const limit = Number(p.limit) || 0;
    if (limit) jobs = jobs.slice(0, limit);
    if (!jobs.length)
      return '<div class="cs-empty">' + U.icon('briefcase') + '<p><strong>' + e(CS.t(L, 'noJobs')) + '</strong><br>' + e(CS.t(L, 'noJobsSub')) + '</p>' +
        '<a class="cs-btn cs-btn--main" href="#" data-go="spontaneous">' + e(CS.t(L, 'spontaneous')) + '</a></div>';
    const uniq = (k) => Array.from(new Set(jobs.map((j) => j[k]).filter(Boolean))).sort();
    const sel = (k, label, opts) =>
      opts.length > 1
        ? '<label class="cs-field cs-field--inline"><span class="cs-sr">' + e(label) + '</span><select data-filter="' + k + '"><option value="">' + e(label) + '</option>' + opts.map((o) => '<option value="' + e(o.value || o) + '">' + e(o.label || o) + '</option>').join('') + '</select></label>'
        : '';
    const filters = p.filters
      ? '<div class="cs-filters" role="search"><label class="cs-search">' + U.icon('search') + '<span class="cs-sr">' + e(CS.t(L, 'searchLabel')) + '</span><input type="search" data-filter="q" placeholder="' + e(CS.t(L, 'searchPh')) + '"></label>' +
        sel('department', CS.t(L, 'allTeams'), uniq('department')) +
        sel('location', CS.t(L, 'allLocations'), uniq('location')) +
        sel('contract', CS.t(L, 'allContracts'), uniq('contract')) +
        sel('remote', CS.t(L, 'remote'), uniq('remote').map((r) => ({ value: r, label: remoteLabel(r, L) }))) +
        '</div>'
      : '';
    let list;
    if (p.groupBy && p.groupBy !== 'none') {
      const groups = {};
      jobs.forEach((j) => { const k = j[p.groupBy] || '—'; (groups[k] = groups[k] || []).push(j); });
      list = Object.keys(groups).sort().map((k) => '<div class="cs-jobgroup" data-group><h3 class="cs-jobgroup__title">' + e(k) + ' <span>' + groups[k].length + '</span></h3><div class="cs-jobs">' + groups[k].map((j) => jobCard(j, L)).join('') + '</div></div>').join('');
    } else list = '<div class="cs-jobs">' + jobs.map((j) => jobCard(j, L)).join('') + '</div>';
    return '<div data-jobs data-lang="' + e(L) + '">' + filters + '<p class="cs-count" aria-live="polite" data-count>' + e(CS.t(L, 'openJobs', jobs.length)) + '</p>' + list +
      '<div class="cs-empty" data-noresult hidden>' + U.icon('search') + '<p><strong>' + e(CS.t(L, 'noMatch')) + '</strong><br>' + e(CS.t(L, 'noMatchSub')) + '</p></div></div>';
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
    const any = Object.keys(vals).some((k) => vals[k]);
    if (c) c.textContent = CS.t(box.dataset.lang, any ? 'matchJobs' : 'openJobs', n);
    const nr = box.querySelector('[data-noresult]');
    if (nr) nr.hidden = n > 0;
  };

  /* Données structurées schema.org JobPosting, lues par Google for Jobs */
  site.jobPostingLD = (job, data) => {
    const t = data.theme, s = data.settings;
    const ld = {
      '@context': 'https://schema.org/', '@type': 'JobPosting',
      title: job.title, description: U.md(job.description),
      datePosted: (site.postedAt(job) || new Date().toISOString()).slice(0, 10),
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
  site.jobUrl = (s, job, lang) => site.publicUrl(s) + (lang && lang !== (s.languages || ['fr'])[0] ? '/' + lang : '') + '/offres/' + job.id;

  /* ---------- Formulaire de candidature ---------- */
  const field = (L, id, label, input, req, hint) =>
    '<div class="cs-field"><label for="' + id + '">' + e(label) + (req ? ' <span class="cs-req" aria-hidden="true">*</span>' : ' <span class="cs-opt">' + e(CS.t(L, 'optional')) + '</span>') + '</label>' + input +
    (hint ? '<p class="cs-hint">' + e(hint) + '</p>' : '') + '<p class="cs-error" data-error-for="' + id + '" hidden></p></div>';

  /* Réglages effectifs du formulaire pour une offre (le fichier complémentaire peut être réglé par offre) */
  site.formFor = (data, job) => {
    const f = data.form;
    const fields = Object.assign({}, f.fields);
    let extraLabel = f.extraFileLabel;
    if (job && job.extraFile && job.extraFile !== 'default') fields.extraFile = job.extraFile;
    if (job && job.extraFileLabel && fields.extraFile !== 'off') extraLabel = job.extraFileLabel;
    return { fields, extraLabel };
  };
  const FILE_RULES = {
    cv: { accept: '.pdf,.doc,.docx,.odt', max: 10, hint: 'fileHint' },
    coverLetterFile: { accept: '.pdf,.doc,.docx,.odt', max: 10, hint: 'fileHint' },
    extraFile: { accept: '.pdf,.png,.jpg,.jpeg,.zip,.key,.ppt,.pptx', max: 20, hint: 'extraHint' },
  };

  site.applyForm = (ctx, job) => {
    const L = ctx.lang;
    const f = ctx.data.form;
    const { fields, extraLabel } = site.formFor(ctx.data, job);
    const pre = ctx.idPrefix || 'ap';
    const id = (k) => pre + '-' + k;
    const st = (k) => fields[k] || 'off';
    const inp = (k, type, auto, req) => '<input id="' + id(k) + '" name="' + k + '" type="' + type + '" autocomplete="' + auto + '"' + (req ? ' required' : '') + '>';
    const fileInput = (k, label) =>
      st(k) === 'off' ? '' : field(L, id(k), label,
        '<label class="cs-file" for="' + id(k) + '">' + U.icon(k === 'extraFile' ? 'paperclip' : 'upload') + '<span data-file-label>' + CS.t(L, 'dropFile') + '</span><input id="' + id(k) + '" name="' + k + '" type="file" accept="' + FILE_RULES[k].accept + '"' + (st(k) === 'required' ? ' required' : '') + '></label>',
        st(k) === 'required', CS.t(L, FILE_RULES[k].hint));
    let h = '<form class="cs-form" data-apply="' + e(job ? job.id : '') + '" novalidate>';
    h += '<div class="cs-form__row">' + field(L, id('firstName'), CS.t(L, 'firstName'), inp('firstName', 'text', 'given-name', true), true) + field(L, id('lastName'), CS.t(L, 'lastName'), inp('lastName', 'text', 'family-name', true), true) + '</div>';
    h += '<div class="cs-form__row">' + field(L, id('email'), CS.t(L, 'email'), inp('email', 'email', 'email', true), true) +
      (st('phone') !== 'off' ? field(L, id('phone'), CS.t(L, 'phone'), inp('phone', 'tel', 'tel', st('phone') === 'required'), st('phone') === 'required') : '') + '</div>';
    if (st('linkedin') !== 'off') h += field(L, id('linkedin'), CS.t(L, 'linkedin'), '<input id="' + id('linkedin') + '" name="linkedin" type="url" placeholder="https://www.linkedin.com/in/…"' + (st('linkedin') === 'required' ? ' required' : '') + '>', st('linkedin') === 'required');
    h += fileInput('cv', CS.t(L, 'cv'));
    h += fileInput('coverLetterFile', CS.t(L, 'coverLetterFile'));
    h += fileInput('extraFile', extraLabel || 'Fichier complémentaire');
    if (st('coverLetter') !== 'off') h += field(L, id('coverLetter'), CS.t(L, 'coverLetter'), '<textarea id="' + id('coverLetter') + '" name="coverLetter" rows="5"' + (st('coverLetter') === 'required' ? ' required' : '') + '></textarea>', st('coverLetter') === 'required');
    (f.questions || []).forEach((q) => {
      const qid = id(q.id);
      let input;
      if (q.type === 'textarea') input = '<textarea id="' + qid + '" name="' + e(q.id) + '" rows="3"' + (q.required ? ' required' : '') + '></textarea>';
      else if (q.type === 'select') input = '<select id="' + qid + '" name="' + e(q.id) + '"' + (q.required ? ' required' : '') + '><option value="">' + e(CS.t(L, 'choose')) + '</option>' + (q.options || []).map((o, i) => '<option value="' + i + '">' + e(o) + '</option>').join('') + '</select>';
      else if (q.type === 'yesno') input = '<div class="cs-radios" role="radiogroup" id="' + qid + '">' + [['Oui', 'yes'], ['Non', 'no']].map((o, i) => '<label><input type="radio" name="' + e(q.id) + '" value="' + o[0] + '"' + (q.required && !i ? ' required' : '') + '> ' + e(CS.t(L, o[1])) + '</label>').join('') + '</div>';
      else input = '<input id="' + qid + '" name="' + e(q.id) + '" type="text"' + (q.required ? ' required' : '') + '>';
      h += field(L, qid, q.label, input, q.required);
    });
    const privacy = ctx.data.settings.privacyUrl ? ' <a href="' + e(ctx.data.settings.privacyUrl) + '" target="_blank" rel="noopener">' + e(CS.t(L, 'privacy')) + '</a>' : '';
    h += '<div class="cs-field cs-check"><label><input type="checkbox" name="consent" id="' + id('consent') + '" required> <span>' + e(f.consent) + privacy + '</span></label><p class="cs-error" data-error-for="' + id('consent') + '" hidden></p></div>';
    if (f.talentPoolOptIn) h += '<div class="cs-field cs-check"><label><input type="checkbox" name="talentPool" id="' + id('talentPool') + '" checked> <span>' + e(CS.t(L, 'talentPool')) + '</span></label></div>';
    h += '<div class="cs-form__submit"><button type="submit" class="cs-btn cs-btn--main">' + e(CS.t(L, job ? 'send' : 'sendSpontaneous')) + '</button><p class="cs-hint">' + e(CS.t(L, 'requiredNote')) + '</p></div>';
    return h + '</form>';
  };

  const showError = (form, inputId, msg) => {
    const p = form.querySelector('[data-error-for="' + inputId + '"]');
    if (p) { p.textContent = msg; p.hidden = !msg; }
    const el = form.querySelector('#' + CSS.escape(inputId));
    if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  const submitApply = (form, ctl) => {
    const L = ctl.lang;
    const raw = ctl.getData();
    const data = site.localize(raw, L);
    const jobId = form.dataset.apply || null;
    const job = jobId ? raw.jobs.find((j) => j.id === jobId) : null;
    const { fields, extraLabel } = site.formFor(data, job);
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
    check('firstName', fd('firstName'), CS.t(L, 'errFirst'));
    check('lastName', fd('lastName'), CS.t(L, 'errLast'));
    check('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fd('email')), CS.t(L, 'errEmail'));
    if (fields.phone === 'required') check('phone', fd('phone').replace(/\D/g, '').length >= 9, CS.t(L, 'errPhone'));
    if (fields.linkedin === 'required') check('linkedin', fd('linkedin'), CS.t(L, 'errLinkedin'));
    const files = {};
    Object.keys(FILE_RULES).forEach((k) => {
      const el = form.elements[k];
      if (!el) return;
      const file = el.files && el.files[0];
      if (file && file.size > FILE_RULES[k].max * 1024 * 1024) check(k, false, CS.t(L, 'errSize', FILE_RULES[k].max));
      else check(k, fields[k] !== 'required' || file, CS.t(L, 'errFile'));
      if (file) files[k] = { name: file.name, size: file.size };
    });
    if (fields.coverLetter === 'required') check('coverLetter', fd('coverLetter'), CS.t(L, 'errLetter'));
    /* Les réponses sont enregistrées dans la langue principale, pour que l'équipe les lise toutes pareil */
    const answers = {};
    let knockedOut = false;
    (raw.form.questions || []).forEach((q) => {
      let v = fd(q.id);
      if (q.type === 'select' && v !== '') v = (q.options || [])[+v] || v;
      answers[q.id] = v;
      if (q.required) check(q.id, v, CS.t(L, 'errRequired'));
      if (q.knockout && v && v === q.knockout) knockedOut = true;
    });
    check('consent', fd('consent'), CS.t(L, 'errConsent'));
    if (firstBad) { firstBad.focus(); return; }
    /* libellé enregistré dans la langue principale, pour l'équipe */
    if (files.extraFile) files.extraFile.label = site.formFor(raw, job).extraLabel || extraLabel;
    const app = {
      id: U.uid('a_'), jobId: job ? job.id : null, createdAt: new Date().toISOString(), status: 'Nouveau',
      source: ctl.mode === 'editor' ? 'Aperçu de l’éditeur' : (ctl.source || 'Accès direct'), lang: L,
      firstName: fd('firstName'), lastName: fd('lastName'), email: fd('email'), phone: fd('phone'), linkedin: fd('linkedin'), coverLetter: fd('coverLetter'),
      cv: files.cv || null, files: { coverLetterFile: files.coverLetterFile, extraFile: files.extraFile }, answers, knockedOut, talentPool: !!fd('talentPool'),
      projectId: job ? job.projectId : 'p-199',
    };
    ctl.onApply && ctl.onApply(app);
    ctl.go({ name: 'done', id: app.jobId });
  };

  /* ---------- Morceaux de page ---------- */
  site.pageOf = (data, route) => (route && route.name === 'page' && data.pages.find((p) => p.id === route.id)) || data.pages[0];
  const jobsBlockPage = (data) => data.pages.find((p) => p.blocks.some((b) => b.type === 'jobs' && !b.hidden));

  const header = (ctx, route) => {
    const L = ctx.lang, d = ctx.data;
    const current = route.name === 'page' || route.name === 'home' ? site.pageOf(d, route) : null;
    const links = d.pages.slice(1).filter((p) => p.inMenu).map((p) => ({ go: 'page:' + p.id, label: p.title, on: current && current.id === p.id }))
      .concat(current ? current.blocks.filter((b) => !b.hidden && b.menu).map((b) => ({ go: 'sec:' + b.id, label: b.menu })) : []);
    if (d.pages.length > 1 && !(current && current === d.pages[0])) links.unshift({ go: 'home', label: CS.t(L, 'home') });
    const langs = d.settings.languages || ['fr'];
    const switcher = langs.length > 1
      ? '<div class="cs-langs" role="group" aria-label="' + e(CS.t(L, 'language')) + '">' + langs.map((l) => { const def = CS.LANGS.find((x) => x.id === l) || { short: l.toUpperCase(), label: l }; return '<button type="button" data-lang="' + l + '" lang="' + l + '" title="' + e(def.label) + '"' + (l === L ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + e(def.short) + '</button>'; }).join('') + '</div>'
      : '';
    const linkHTML = links.map((x) => '<a href="#" data-go="' + e(x.go) + '"' + (x.on ? ' aria-current="page"' : '') + '>' + e(x.label) + '</a>').join('');
    return '<header class="cs-header"><div class="cs-wrap cs-header__in"><a href="#" class="cs-header__logo" data-go="home" aria-label="' + e(CS.t(L, 'home') + ' – ' + d.theme.companyName) + '">' + logoHTML(d.theme) + '</a>' +
      '<nav class="cs-nav" aria-label="' + e(CS.t(L, 'mainNav')) + '">' + linkHTML + '</nav>' + switcher +
      '<a class="cs-btn cs-btn--main cs-btn--sm cs-header__cta" href="#" data-go="jobs">' + e(CS.t(L, 'seeJobs')) + '</a>' +
      (links.length ? '<details class="cs-burger"><summary aria-label="' + e(CS.t(L, 'menu')) + '">' + U.icon('menu') + '</summary><nav class="cs-burger__panel" aria-label="' + e(CS.t(L, 'mainNav')) + '">' + linkHTML + (links.some((x) => x.go.indexOf('sec:') === 0 && current && current.blocks.some((b) => b.id === x.go.slice(4) && b.type === 'jobs')) ? '' : '<a href="#" data-go="jobs">' + e(CS.t(L, 'seeJobs')) + '</a>') + '</nav></details>' : '') +
      '</div></header>';
  };
  const footer = (ctx) => {
    const L = ctx.lang, s = ctx.data.settings, t = ctx.data.theme;
    return '<footer class="cs-footer"><div class="cs-wrap cs-footer__in"><div>' + logoHTML(t) + '<p>© ' + new Date().getFullYear() + ' ' + e(t.companyName) + '</p></div>' +
      '<nav aria-label="' + e(CS.t(L, 'legalNav')) + '"><a href="#" data-go="jobs">' + e(CS.t(L, 'jobsTitle')) + '</a><a href="#" data-go="spontaneous">' + e(CS.t(L, 'spontaneous')) + '</a>' +
      (s.privacyUrl ? '<a href="' + e(s.privacyUrl) + '" target="_blank" rel="noopener">' + e(CS.t(L, 'privacy')) + '</a>' : '') +
      (s.legalUrl ? '<a href="' + e(s.legalUrl) + '" target="_blank" rel="noopener">' + e(CS.t(L, 'rights')) + '</a>' : '') +
      (s.analytics ? '<a href="#" data-cookies="open">' + e(CS.t(L, 'cookies')) + '</a>' : '') + '</nav>' +
      (s.showPoweredBy ? '<p class="cs-powered">' + e(CS.t(L, 'poweredBy')) + ' <strong>Profilr</strong></p>' : '') + '</div></footer>';
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

  const blocksPage = (ctx, page) => page.blocks.filter((b) => !b.hidden).map((b) => sectionHTML(b, ctx)).join('') ||
    '<section class="cs-sec"><div class="cs-wrap cs-empty"><p><strong>' + e(CS.t(ctx.lang, 'emptyPage')) + '</strong>' + (ctx.mode === 'editor' ? '<br>' + e(CS.t(ctx.lang, 'emptyPageSub')) : '') + '</p></div></section>';

  const jobsPage = (ctx) => '<section class="cs-sec"><div class="cs-wrap"><h1 class="cs-h1 cs-h1--page">' + e(CS.t(ctx.lang, 'jobsTitle')) + '</h1>' + site.jobsList(ctx, { filters: true, groupBy: 'none' }) + '</div></section>';

  const jobPage = (ctx, job) => {
    const L = ctx.lang;
    if (!job || (ctx.mode !== 'editor' && !site.isLive(job)))
      return '<section class="cs-sec"><div class="cs-wrap cs-empty"><p><strong>' + e(CS.t(L, 'jobGone')) + '</strong></p><a class="cs-btn cs-btn--main" href="#" data-go="jobs">' + e(CS.t(L, 'seeOpenJobs')) + '</a></div></section>';
    let state = '';
    if (job.status === 'draft') state = CS.t(L, 'stDraft');
    else if (job.status === 'archived') state = CS.t(L, 'stArchived');
    else if (site.isScheduled(job)) state = CS.t(L, 'stScheduled', U.fmtDate(job.publishAt, L) + ' ' + new Date(job.publishAt).toLocaleTimeString(U.locale(L), { hour: '2-digit', minute: '2-digit' }));
    else if (!site.isLive(job)) state = CS.t(L, 'stExpired');
    const draftNote = state ? '<p class="cs-draftnote">' + U.icon('eyeOff') + e(CS.t(L, 'previewHidden', state)) + '</p>' : '';
    const facts = [
      [CS.t(L, 'team'), job.department], [CS.t(L, 'location'), job.location], [CS.t(L, 'contract'), job.contract], [CS.t(L, 'remote'), remoteLabel(job.remote, L)],
      [CS.t(L, 'experience'), job.experience], [CS.t(L, 'salary'), site.salaryLabel(job, L)], [CS.t(L, 'posted'), site.postedAt(job) && !site.isScheduled(job) ? U.relDays(site.postedAt(job), L) : ''],
    ].filter((x) => x[1]);
    const url = site.jobUrl(ctx.data.settings, job, L);
    const similar = site.liveJobs(ctx.data).filter((j) => j.id !== job.id).sort((a, b) => (b.department === job.department) - (a.department === job.department)).slice(0, 3);
    return draftNote +
      '<section class="cs-sec cs-bg-surface cs-jobhead"><div class="cs-wrap"><a href="#" class="cs-back" data-go="jobs">' + U.icon('back') + e(CS.t(L, 'allJobs')) + '</a>' +
      '<p class="cs-eyebrow">' + e(job.department) + '</p><h1 class="cs-h1">' + e(job.title) + '</h1>' + (job.summary ? '<p class="cs-lead">' + e(job.summary) + '</p>' : '') +
      '<div class="cs-chips">' + jobChips(job, L, true) + '</div></div></section>' +
      '<section class="cs-sec"><div class="cs-wrap cs-jobbody"><article class="cs-prose">' + U.md(job.description) + '</article>' +
      '<aside class="cs-jobaside"><dl>' + facts.map((f) => '<div><dt>' + e(f[0]) + '</dt><dd>' + e(f[1]) + '</dd></div>').join('') + '</dl>' +
      '<a class="cs-btn cs-btn--main cs-btn--block" href="#" data-go="sec:postuler">' + e(CS.t(L, 'apply')) + '</a>' +
      '<div class="cs-share"><a class="cs-btn cs-btn--ghost" href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url) + '" target="_blank" rel="noopener">' + U.icon('external') + e(CS.t(L, 'shareLinkedIn')) + '</a>' +
      '<button type="button" class="cs-btn cs-btn--ghost" data-copy="' + e(url) + '" data-copied="' + e(CS.t(L, 'linkCopied')) + '">' + U.icon('link') + '<span>' + e(CS.t(L, 'copyLink')) + '</span></button></div></aside></div></section>' +
      '<section class="cs-sec cs-bg-surface" id="sec-postuler"><div class="cs-wrap cs-narrow"><h2 class="cs-h2">' + e(CS.t(L, 'apply')) + '</h2><p class="cs-intro">' + e(job.title) + ' · ' + e(job.location) + '</p>' + site.applyForm(ctx, job) + '</div></section>' +
      (similar.length ? '<section class="cs-sec"><div class="cs-wrap"><h2 class="cs-h2">' + e(CS.t(L, 'similar')) + '</h2><div class="cs-jobs">' + similar.map((j) => jobCard(j, L)).join('') + '</div></div></section>' : '');
  };

  const spontaneousPage = (ctx) =>
    '<section class="cs-sec cs-bg-surface cs-jobhead"><div class="cs-wrap cs-narrow"><a href="#" class="cs-back" data-go="home">' + U.icon('back') + e(CS.t(ctx.lang, 'back')) + '</a><p class="cs-eyebrow">' + e(CS.t(ctx.lang, 'spontaneous')) + '</p>' +
    '<h1 class="cs-h1">' + e(CS.t(ctx.lang, 'spontTitle')) + '</h1><p class="cs-lead">' + e(CS.t(ctx.lang, 'spontLead')) + '</p></div></section>' +
    '<section class="cs-sec"><div class="cs-wrap cs-narrow">' + site.applyForm(ctx, null) + '</div></section>';

  const donePage = (ctx, route) => {
    const f = ctx.data.form;
    const job = route.id ? ctx.data.jobs.find((j) => j.id === route.id) : null;
    return '<section class="cs-sec"><div class="cs-wrap cs-narrow cs-done"><span class="cs-done__icon">' + U.icon('check') + '</span>' +
      '<h1 class="cs-h1 cs-h1--page">' + e(f.confirmTitle) + '</h1>' + (job ? '<p class="cs-eyebrow">' + e(job.title) + '</p>' : '') + '<p class="cs-lead">' + e(f.confirmText) + '</p>' +
      '<div class="cs-actions cs-actions--center"><a class="cs-btn cs-btn--main" href="#" data-go="jobs">' + e(CS.t(ctx.lang, 'seeOtherJobs')) + '</a><a class="cs-btn cs-btn--ghost" href="#" data-go="home">' + e(CS.t(ctx.lang, 'backHome')) + '</a></div></div></section>';
  };

  /* ---------- Consentement et mesure d'audience ---------- */
  site.getConsent = () => { try { return localStorage.getItem(CONSENT_KEY); } catch (err) { return null; } };
  site.setConsent = (v) => { try { localStorage.setItem(CONSENT_KEY, v); } catch (err) { /* navigation privée */ } };
  const cookieBanner = (ctx) =>
    '<div class="cs-cookie" role="dialog" aria-live="polite" aria-label="' + e(CS.t(ctx.lang, 'cookieTitle')) + '"><div><strong>' + e(CS.t(ctx.lang, 'cookieTitle')) + '</strong><p>' + e(ctx.data.settings.cookieText) +
    (ctx.data.settings.privacyUrl ? ' <a href="' + e(ctx.data.settings.privacyUrl) + '" target="_blank" rel="noopener">' + e(CS.t(ctx.lang, 'privacy')) + '</a>' : '') + '</p></div>' +
    '<div class="cs-cookie__btns"><button type="button" class="cs-btn cs-btn--ghost cs-btn--sm" data-cookies="no">' + e(CS.t(ctx.lang, 'refuse')) + '</button><button type="button" class="cs-btn cs-btn--main cs-btn--sm" data-cookies="yes">' + e(CS.t(ctx.lang, 'accept')) + '</button></div></div>';

  /* ---------- Rendu complet ---------- */
  site.render = (ctl) => {
    const raw = ctl.getData();
    const langs = raw.settings.languages || ['fr'];
    if (!ctl.lang || langs.indexOf(ctl.lang) < 0) ctl.lang = langs[0];
    const data = site.localize(raw, ctl.lang);
    const route = ctl.route || { name: 'home' };
    const ctx = { data, theme: data.theme, mode: ctl.mode, lang: ctl.lang, selectedId: ctl.selectedId, idPrefix: ctl.mode === 'editor' ? 'pv' : 'ap' };
    site.loadFonts(data.theme);
    let main;
    if (route.name === 'job') main = jobPage(ctx, data.jobs.find((j) => j.id === route.id));
    else if (route.name === 'spontaneous') main = spontaneousPage(ctx);
    else if (route.name === 'done') main = donePage(ctx, route);
    else if (route.name === 'jobs' && !jobsBlockPage(data)) main = jobsPage(ctx);
    else main = blocksPage(ctx, site.pageOf(data, route));
    const root = ctl.root;
    root.setAttribute('style', site.themeVars(data.theme));
    root.setAttribute('lang', ctl.lang);
    root.classList.add('cs-root');
    root.classList.toggle('cs-root--editor', ctl.mode === 'editor');
    const showBanner = ctl.mode !== 'editor' && data.settings.analytics && (ctl.forceBanner || !site.getConsent());
    root.innerHTML = header(ctx, route) + '<main class="cs-main">' + main + '</main>' + footer(ctx) + (showBanner ? cookieBanner(ctx) : '');
    site.bind(ctl);
    if (ctl.mode !== 'editor') {
      let ld = document.getElementById('cs-jobposting');
      const job = route.name === 'job' && data.jobs.find((j) => j.id === route.id && site.isLive(j));
      if (job) {
        if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'cs-jobposting'; document.head.appendChild(ld); }
        ld.textContent = JSON.stringify(site.jobPostingLD(job, data));
      } else if (ld) ld.remove();
      document.title = job ? job.title + ' – ' + data.theme.companyName : (route.name === 'page' ? site.pageOf(data, route).title + ' – ' : '') + data.settings.siteTitle;
      /* mesure d'audience, seulement avec le consentement du visiteur */
      if (ctl.track && data.settings.analytics && site.getConsent() === 'yes') {
        ctl.track('pageViews');
        if (job) ctl.track('jobViews', job.id);
      }
    }
  };

  /* Navigation interne : data-go="home | jobs | spontaneous | job:<id> | page:<id> | sec:<id> | dept:<équipe> | loc:<ville>" */
  site.bind = (ctl) => {
    const root = ctl.root;
    if (root._csBound) return;
    root._csBound = true;
    const scrollToJobs = (filterKey, filterVal) => {
      const d = ctl.getData();
      const pg = jobsBlockPage(d);
      const run = () => {
        const box = root.querySelector('[data-jobs]');
        if (!box) return;
        if (filterKey) {
          const sel = box.querySelector('[data-filter="' + filterKey + '"]');
          if (sel) { const opt = Array.from(sel.options).find((o) => o.value.toLowerCase() === filterVal); sel.value = opt ? opt.value : ''; filterJobs(box); }
        }
        box.closest('section').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (!pg) return ctl.go({ name: 'jobs' }, filterKey ? run : null);
      const cur = ctl.route || { name: 'home' };
      const onPage = (cur.name === 'home' && pg === d.pages[0]) || (cur.name === 'page' && cur.id === pg.id);
      if (onPage) run();
      else ctl.go(pg === d.pages[0] ? { name: 'home' } : { name: 'page', id: pg.id }, run);
    };
    root.addEventListener('click', (ev) => {
      const burger = root.querySelector('.cs-burger[open]');
      if (burger && !ev.target.closest('.cs-burger summary')) burger.open = false;
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
      const lang = ev.target.closest('[data-lang]');
      if (lang && root.contains(lang) && lang.tagName === 'BUTTON') { ctl.setLang ? ctl.setLang(lang.dataset.lang) : (ctl.lang = lang.dataset.lang, site.render(ctl)); return; }
      const ck = ev.target.closest('[data-cookies]');
      if (ck) {
        ev.preventDefault();
        if (ck.dataset.cookies === 'open') { ctl.forceBanner = true; site.render(ctl); return; }
        const prev = site.getConsent();
        site.setConsent(ck.dataset.cookies);
        ctl.forceBanner = false;
        if (ctl.track && prev !== ck.dataset.cookies) {
          ctl.track(ck.dataset.cookies === 'yes' ? 'consentYes' : 'consentNo');
          if (ck.dataset.cookies === 'yes' && !prev) ctl.onConsent && ctl.onConsent();
        }
        const banner = root.querySelector('.cs-cookie');
        if (banner) banner.remove();
        return;
      }
      const copy = ev.target.closest('[data-copy]');
      if (copy) {
        const lab = copy.querySelector('span');
        const old = lab.textContent;
        const done = () => { lab.textContent = copy.dataset.copied; setTimeout(() => { lab.textContent = old; }, 1800); };
        try { navigator.clipboard.writeText(copy.dataset.copy).then(done, () => CS.toast && CS.toast(copy.dataset.copy)); } catch (err) { CS.toast && CS.toast(copy.dataset.copy); }
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
          const d = ctl.getData();
          const pg = d.pages.find((p) => p.blocks.some((b) => b.id === v.slice(4)));
          ctl.go(!pg || pg === d.pages[0] ? { name: 'home' } : { name: 'page', id: pg.id }, () => { const t = root.querySelector('#sec-' + CSS.escape(v.slice(4))); t && t.scrollIntoView({ block: 'start' }); });
          return;
        }
        if (v === 'jobs') return scrollToJobs();
        if (v.indexOf('dept:') === 0) return scrollToJobs('department', v.slice(5).toLowerCase());
        if (v.indexOf('loc:') === 0) return scrollToJobs('location', v.slice(4).toLowerCase());
        if (v === 'home') return ctl.go({ name: 'home' });
        if (v === 'spontaneous') return ctl.go({ name: 'spontaneous' });
        if (v.indexOf('page:') === 0) return ctl.go({ name: 'page', id: v.slice(5) });
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
    root.addEventListener('focusin', (ev) => {
      const form = ev.target.closest('form[data-apply]');
      if (form && !form._started) {
        form._started = true;
        if (ctl.track && ctl.mode !== 'editor' && site.getConsent() === 'yes' && ctl.getData().settings.analytics) ctl.track('applyStarts');
      }
    });
    root.addEventListener('change', (ev) => {
      const box = ev.target.closest('[data-jobs]');
      if (box && ev.target.dataset.filter) filterJobs(box);
      if (ev.target.type === 'file') {
        const label = ev.target.parentNode.querySelector('[data-file-label]');
        const file = ev.target.files[0];
        if (label) label.innerHTML = file ? U.icon('file') + ' ' + e(file.name) + ' <span class="cs-opt">(' + Math.max(1, Math.round(file.size / 1024)) + ' Ko)</span>' : CS.t(ctl.lang, 'dropFile');
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
