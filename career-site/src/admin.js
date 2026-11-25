/* Éditeur du site carrière (côté équipe RH) : pages à blocs, offres, formulaire, thème, statistiques,
   candidatures, paramètres, traductions et historique des versions. */
window.CS = window.CS || {};

(function () {
  const U = CS.U;
  const e = U.esc;
  const store = CS.store;
  const B = () => CS.blocks.BLOCKS;
  const D = () => CS.store.state.draft;

  const ui = {
    tab: 'page',
    pageId: 'home',
    blockId: null,
    jobId: null,
    jobFilter: 'all',
    appId: null, appJob: '', appStatus: '',
    device: 'desktop',
    route: { name: 'home' },
    lang: null /* langue en cours d'édition */,
    adding: false,
    pageSettings: false,
    history: false,
    viewVersion: null /* aperçu d'une ancienne version */,
    statsDays: 30,
    open: {},
    confirm: null,
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const defLang = () => CS.site.defaultLang(D());
  const trMode = () => ui.lang && ui.lang !== defLang();
  const langShort = (l) => (CS.LANGS.find((x) => x.id === l) || { short: String(l).toUpperCase() }).short;

  /* ---------- Toast ---------- */
  CS.toast = (msg, kind) => {
    const t = $('#ad-toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'ad-toast is-on' + (kind ? ' ad-toast--' + kind : '');
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.className = 'ad-toast'), kind === 'warn' ? 6000 : 3200);
  };

  /* ---------- Pages ---------- */
  const curPage = () => D().pages.find((p) => p.id === ui.pageId) || D().pages[0];
  const blocks = () => curPage().blocks;
  const pageRoute = () => (curPage() === D().pages[0] ? { name: 'home' } : { name: 'page', id: curPage().id });

  /* ---------- Contrôleur de l'aperçu ---------- */
  const preview = {
    mode: 'editor',
    root: null,
    get route() { return ui.route; },
    get lang() { return ui.lang; },
    set lang(v) { ui.lang = v; },
    get selectedId() { return ui.tab === 'page' ? ui.blockId : null; },
    getData: () => (ui.viewVersion ? (store.state.versions.find((v) => v.id === ui.viewVersion) || {}).snapshot || D() : D()),
    go(route, after) {
      ui.route = route;
      if (route.name === 'page' || route.name === 'home') {
        const pg = route.name === 'home' ? D().pages[0] : D().pages.find((p) => p.id === route.id);
        if (pg && pg.id !== ui.pageId && ui.tab === 'page' && !ui.viewVersion) { ui.pageId = pg.id; ui.blockId = null; renderPanel(); }
      }
      renderPreview(true);
      const fr = $('#ad-frame');
      if (fr && !after) fr.scrollTo({ top: 0, behavior: 'instant' });
      if (after) requestAnimationFrame(after);
      renderStageBar();
    },
    setLang(l) { ui.lang = l; renderAll(); },
    onSelectBlock(id) {
      if (ui.viewVersion) return;
      ui.tab = 'page';
      ui.blockId = id;
      ui.adding = false;
      renderAll();
    },
    onApply(app) {
      store.mutate((s) => s.applications.unshift(app), { structural: true });
      CS.toast('Candidature de test enregistrée : retrouvez-la dans l’onglet Candidatures.');
    },
  };

  let rafId = 0;
  const renderPreview = (now) => {
    if (!preview.root) return;
    const run = () => { rafId = 0; CS.site.render(preview); };
    if (now) { cancelAnimationFrame(rafId); run(); return; }
    if (!rafId) rafId = requestAnimationFrame(run);
  };
  const scrollPreviewTo = (blockId) => {
    const el = preview.root && preview.root.querySelector('#sec-' + CSS.escape(blockId));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const resetFrame = () => { const fr = $('#ad-frame'); if (fr) fr.scrollTo({ top: 0, behavior: 'instant' }); };

  /* ---------- Champs génériques ----------
     data-bind="scope|chemin" relie un contrôle à l'état. scope : block, job, theme, settings, form, page.
     data-bind="tr|clé|chemin" écrit une traduction dans i18n[langue][clé][chemin]. */
  const scopeObj = (scope) => {
    const d = D();
    if (scope === 'block') return blocks().find((b) => b.id === ui.blockId);
    if (scope === 'page') return curPage();
    if (scope === 'job') return d.jobs.find((j) => j.id === ui.jobId);
    if (scope === 'theme') return d.theme;
    if (scope === 'settings') return d.settings;
    if (scope === 'form') return d.form;
    return null;
  };
  const bindAttr = (scope, path, extra) => ' data-bind="' + scope + '|' + path + '"' + (extra || '');
  const val = (scope, path) => {
    const o = scopeObj(scope);
    const v = o ? U.getPath(o, path) : '';
    return v == null ? '' : v;
  };

  const fieldWrap = (id, label, control, help, cls) =>
    '<div class="ad-field ' + (cls || '') + '">' + (label ? '<label class="ad-label" for="' + id + '">' + e(label) + '</label>' : '') + control + (help ? '<p class="ad-help">' + help + '</p>' : '') + '</div>';
  let fid = 0;
  const nid = () => 'f' + ++fid;

  const ctrl = {
    text(scope, path, label, o) {
      o = o || {};
      const id = nid();
      return fieldWrap(id, label, '<input class="ad-input" id="' + id + '" type="' + (o.type || 'text') + '" value="' + e(val(scope, path)) + '"' + (o.placeholder ? ' placeholder="' + e(o.placeholder) + '"' : '') + (o.list ? ' list="' + o.list + '"' : '') + (o.min ? ' min="' + o.min + '"' : '') + bindAttr(scope, path, o.kind ? ' data-kind="' + o.kind + '"' : '') + (o.structural ? ' data-structural' : '') + '>', o.help);
    },
    textarea(scope, path, label, o) {
      o = o || {};
      const id = nid();
      const v = val(scope, path);
      return fieldWrap(id, label, '<textarea class="ad-input" id="' + id + '" rows="' + (o.rows || 3) + '"' + bindAttr(scope, path, o.kind ? ' data-kind="' + o.kind + '"' : '') + (o.counter ? ' data-counter="' + o.counter + '"' : '') + '>' + e(Array.isArray(v) ? v.join('\n') : v) + '</textarea>' +
        (o.counter ? '<p class="ad-counter" data-counter-for="' + id + '">' + String(v).length + ' / ' + o.counter + '</p>' : ''), o.help);
    },
    select(scope, path, label, options, o) {
      o = o || {};
      const id = nid();
      const v = String(val(scope, path));
      return fieldWrap(id, label, '<select class="ad-input" id="' + id + '"' + bindAttr(scope, path) + (o.structural ? ' data-structural' : '') + '>' +
        options.map((op) => { const ov = typeof op === 'object' ? op.value : op; const ol = typeof op === 'object' ? op.label : op; return '<option value="' + e(ov) + '"' + (String(ov) === v ? ' selected' : '') + '>' + e(ol) + '</option>'; }).join('') + '</select>', o.help);
    },
    toggle(scope, path, label, o) {
      o = o || {};
      const id = nid();
      return '<div class="ad-field ad-field--toggle"><label class="ad-switch" for="' + id + '"><input type="checkbox" id="' + id + '"' + (val(scope, path) ? ' checked' : '') + bindAttr(scope, path, ' data-kind="bool"') + (o.structural ? ' data-structural' : '') + '><span class="ad-switch__track" aria-hidden="true"></span><span>' + e(label) + '</span></label>' + (o.help ? '<p class="ad-help">' + o.help + '</p>' : '') + '</div>';
    },
    segmented(scope, path, label, options, o) {
      o = o || {};
      const v = String(val(scope, path));
      const name = nid();
      return '<div class="ad-field"><span class="ad-label" id="' + name + '-l">' + e(label) + '</span><div class="ad-seg" role="radiogroup" aria-labelledby="' + name + '-l">' +
        options.map((op) => '<label class="ad-seg__opt"><input type="radio" name="' + name + '" value="' + e(op.value) + '"' + (op.value === v ? ' checked' : '') + bindAttr(scope, path) + (o.structural ? ' data-structural' : '') + '><span>' + e(op.label) + '</span></label>').join('') +
        '</div>' + (o.help ? '<p class="ad-help">' + o.help + '</p>' : '') + '</div>';
    },
    color(scope, path, label, help) {
      const id = nid();
      const v = val(scope, path);
      return '<div class="ad-field ad-field--color"><label class="ad-label" for="' + id + '">' + e(label) + '</label><div class="ad-color"><input type="color" aria-label="' + e(label) + ' (sélecteur)" value="' + e(U.isHex(v) ? (v.length === 4 ? '#' + v.slice(1).split('').map((c) => c + c).join('') : v) : '#000000') + '"' + bindAttr(scope, path, ' data-kind="color"') + '><input class="ad-input ad-input--mono" id="' + id + '" value="' + e(v) + '" maxlength="7" spellcheck="false"' + bindAttr(scope, path, ' data-kind="color"') + '></div>' + (help ? '<p class="ad-help">' + help + '</p>' : '') + '</div>';
    },
    image(scope, path, label, o) {
      o = o || {};
      const v = val(scope, path);
      const th = D().theme;
      const has = v && !U.isPlaceholder(v);
      return '<div class="ad-field"><span class="ad-label">' + e(label) + '</span><div class="ad-image">' +
        (v || !o.optional ? '<img src="' + e(U.imgSrc(v, th, 4 / 3)) + '" alt="">' : '<span class="ad-image__none">' + U.icon('image') + '</span>') +
        '<div class="ad-image__actions"><label class="ad-btn ad-btn--sm">' + U.icon('upload') + 'Importer<input type="file" accept="image/*" hidden data-image="' + scope + '|' + path + '"></label>' +
        (!o.optional ? '<button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="ph" data-target="' + scope + '|' + path + '">' + (has ? 'Visuel d’exemple' : 'Autre exemple') + '</button>' : '') +
        (o.optional && v ? '<button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="img-clear" data-target="' + scope + '|' + path + '">Retirer</button>' : '') +
        '</div></div>' + (!has && !o.optional ? '<p class="ad-help">Visuel d’exemple aux couleurs du thème. Importez vos photos pour le remplacer.</p>' : '') + '</div>';
    },
    icon(scope, path, label) {
      const v = val(scope, path);
      const name = nid();
      return '<div class="ad-field"><span class="ad-label">' + e(label) + '</span><div class="ad-icons" role="radiogroup" aria-label="' + e(label) + '">' +
        U.ICON_CHOICES.map((ic) => '<label class="ad-icons__opt" title="' + ic + '"><input type="radio" name="' + name + '" value="' + ic + '"' + (ic === v ? ' checked' : '') + bindAttr(scope, path) + '><span>' + U.icon(ic) + '</span></label>').join('') + '</div></div>';
    },
    video(scope, path, label, help) {
      const id = nid();
      const v = String(val(scope, path));
      const isBlob = v.indexOf('blob:') === 0;
      return fieldWrap(id, label, '<input class="ad-input" id="' + id + '" type="url" placeholder="https://www.youtube.com/watch?v=…" value="' + e(isBlob ? '' : v) + '"' + bindAttr(scope, path) + '>' +
        '<div class="ad-row"><label class="ad-btn ad-btn--sm">' + U.icon('upload') + 'Importer un fichier vidéo<input type="file" accept="video/mp4,video/webm" hidden data-video="' + scope + '|' + path + '"></label>' + (isBlob ? '<span class="ad-chip ad-chip--ok">Fichier importé</span>' : '') + '</div>',
        e(help || '') + (isBlob ? '<br>Dans ce prototype, le fichier vidéo n’est conservé que jusqu’au rechargement de la page.' : ''));
    },
    /* Champ de traduction : texte source affiché au-dessus, saisie dans la langue cible */
    tr(key, path, label, source, type) {
      const id = nid();
      const map = ((D().i18n || {})[ui.lang] || {})[key] || {};
      let v = map[path];
      const lines = Array.isArray(source);
      if (Array.isArray(v)) v = v.join('\n');
      const src = lines ? source.join(' · ') : U.mdText(source);
      const long = type === 'textarea' || type === 'md' || lines;
      const attrs = ' id="' + id + '" data-bind="tr|' + e(key) + '|' + e(path) + '"' + (lines ? ' data-kind="lines"' : '');
      return '<div class="ad-field ad-trfield' + (v ? '' : ' is-missing') + '"><label class="ad-label" for="' + id + '">' + e(label) + (v ? '' : ' <span class="ad-chip ad-chip--sm ad-chip--warn">à traduire</span>') + '</label>' +
        '<p class="ad-src" lang="' + defLang() + '"><span>' + langShort(defLang()) + '</span>' + e(src.length > 180 ? src.slice(0, 180) + '…' : src) + '</p>' +
        (long ? '<textarea class="ad-input" rows="' + (type === 'md' ? 8 : 3) + '"' + attrs + ' lang="' + ui.lang + '">' + e(v || '') + '</textarea>' : '<input class="ad-input"' + attrs + ' lang="' + ui.lang + '" value="' + e(v || '') + '">') +
        (lines ? '<p class="ad-help">Un choix par ligne, dans le même ordre que l’original.</p>' : '') + '</div>';
    },
  };

  /* Options d'action des boutons : actions de base + les pages du site */
  const actionOptions = () => CS.blocks.ACTIONS.slice(0, 2).concat(D().pages.slice(1).map((p) => ({ value: 'page:' + p.id, label: 'Aller à la page « ' + p.title + ' »' })), CS.blocks.ACTIONS.slice(2));

  const listField = (scope, f, items) => {
    const base = 'props.' + f.key;
    let h = '<div class="ad-field"><div class="ad-listhead"><span class="ad-label">' + e(f.label) + ' <span class="ad-muted">(' + items.length + ')</span></span></div><div class="ad-items">';
    items.forEach((it, i) => {
      const path = base + '.' + i;
      const okey = ui.blockId + ':' + (it._id || path);
      const title = it[f.itemLabel] || it.title || it.caption || 'Élément ' + (i + 1);
      h += '<details class="ad-item"' + (ui.open[okey] ? ' open' : '') + ' data-open-key="' + e(okey) + '"><summary><span class="ad-item__title">' + e(U.mdText(title)) + '</span>' +
        '<span class="ad-item__tools"><button type="button" class="ad-iconbtn" data-act="item-up" data-list="' + base + '" data-i="' + i + '" aria-label="Monter"' + (i === 0 ? ' disabled' : '') + '>' + U.icon('up') + '</button>' +
        '<button type="button" class="ad-iconbtn" data-act="item-down" data-list="' + base + '" data-i="' + i + '" aria-label="Descendre"' + (i === items.length - 1 ? ' disabled' : '') + '>' + U.icon('down') + '</button>' +
        '<button type="button" class="ad-iconbtn ad-iconbtn--danger" data-act="item-del" data-list="' + base + '" data-i="' + i + '" aria-label="Supprimer">' + U.icon('trash') + '</button></span></summary><div class="ad-item__body">';
      f.fields.forEach((sf) => (h += fieldFor(scope, sf, path + '.' + sf.key)));
      h += '</div></details>';
    });
    h += '</div>' + (!f.max || items.length < f.max ? '<button type="button" class="ad-btn ad-btn--sm ad-btn--dashed" data-act="item-add" data-list="' + base + '" data-field="' + f.key + '">' + U.icon('plus') + 'Ajouter</button>' : '<p class="ad-help">Maximum atteint (' + f.max + ').</p>') + '</div>';
    return h;
  };

  const fieldFor = (scope, f, path) => {
    switch (f.type) {
      case 'textarea': return ctrl.textarea(scope, path, f.label, { rows: f.rows, help: f.help });
      case 'md': return ctrl.textarea(scope, path, f.label, { rows: f.rows, help: 'Ligne vide : nouveau paragraphe · « - » : puce · « ## » : intertitre · **gras**' });
      case 'select': return ctrl.select(scope, path, f.label, f.options === CS.blocks.ACTIONS ? actionOptions() : f.options, { help: f.help });
      case 'toggle': return ctrl.toggle(scope, path, f.label, { help: f.help });
      case 'number': return ctrl.text(scope, path, f.label, { type: 'number', kind: 'number', help: f.help });
      case 'image': return ctrl.image(scope, path, f.label, { optional: f.optional });
      case 'icon': return ctrl.icon(scope, path, f.label);
      case 'video': return ctrl.video(scope, path, f.label, f.help);
      default: return ctrl.text(scope, path, f.label, { help: f.help });
    }
  };

  /* ---------- Traductions : inventaire des textes traduisibles ---------- */
  const TEXTY = { text: 1, textarea: 1, md: 1 };
  const trUnits = (d) => {
    const out = [];
    const add = (key, path, label, source, type, group) => { if (source != null && source !== '' && !(Array.isArray(source) && !source.length)) out.push({ key, path, label, source, type, group }); };
    d.pages.forEach((p, pi) => {
      if (pi > 0) add('p:' + p.id, 'title', 'Titre de la page', p.title, 'text', 'page');
      p.blocks.forEach((b) => {
        const def = B()[b.type];
        if (!def) return;
        def.fields.forEach((f) => {
          if (f.type === 'list') {
            (b.props[f.key] || []).forEach((it, i) => f.fields.forEach((sf) => {
              if (TEXTY[sf.type] && !sf.noTr) add('b:' + b.id, 'props.' + f.key + '.' + (it._id || i) + '.' + sf.key, sf.label, it[sf.key], sf.type, def.label + ' · ' + U.mdText(it[f.itemLabel] || it.title || ('n° ' + (i + 1))));
            }));
          } else if (TEXTY[f.type] && !f.noTr) add('b:' + b.id, 'props.' + f.key, f.label, b.props[f.key], f.type, def.label);
        });
        if (b.menu) add('b:' + b.id, 'menu', 'Lien dans le menu', b.menu, 'text', def.label);
      });
    });
    d.jobs.forEach((j) => {
      add('j:' + j.id, 'title', 'Intitulé du poste', j.title, 'text');
      add('j:' + j.id, 'summary', 'Résumé', j.summary, 'textarea');
      add('j:' + j.id, 'description', 'Description', j.description, 'md');
      add('j:' + j.id, 'extraFileLabel', 'Nom du fichier complémentaire', j.extraFileLabel, 'text');
    });
    (d.form.questions || []).forEach((q) => {
      add('form', 'questions.' + q.id + '.label', 'Question', q.label, 'text', 'Questions');
      if (q.type === 'select') add('form', 'questions.' + q.id + '.options', 'Choix proposés', q.options, 'lines', 'Questions');
    });
    [['extraFileLabel', 'Nom du fichier complémentaire', 'text'], ['consent', 'Texte de consentement', 'textarea'], ['confirmTitle', 'Titre de confirmation', 'text'], ['confirmText', 'Message de confirmation', 'textarea'], ['autoReplySubject', 'Objet de l’e-mail d’accusé de réception', 'text']]
      .forEach((x) => add('form', x[0], x[1], d.form[x[0]], x[2], 'Textes du formulaire'));
    [['siteTitle', 'Titre du site', 'text'], ['seoDescription', 'Description pour les moteurs de recherche', 'textarea'], ['cookieText', 'Texte du bandeau cookies', 'textarea']]
      .forEach((x) => add('settings', x[0], x[1], d.settings[x[0]], x[2]));
    return out;
  };
  const trDone = (u, lang) => { const v = (((D().i18n || {})[lang] || {})[u.key] || {})[u.path]; return Array.isArray(v) ? v.length > 0 : !!v; };
  const trProgress = (lang, filter) => {
    const units = trUnits(D()).filter(filter || (() => true));
    const done = units.filter((u) => trDone(u, lang)).length;
    return { done, total: units.length, pct: units.length ? Math.round((done / units.length) * 100) : 100 };
  };
  const trPanel = (filter, intro) => {
    const units = trUnits(D()).filter(filter);
    const prog = trProgress(ui.lang, filter);
    let h = '<div class="ad-trhead">' + U.icon('translate') + '<div><strong>Traduction ' + langShort(ui.lang) + '</strong><span>' + prog.done + ' / ' + prog.total + ' textes traduits</span></div><span class="ad-meter" role="img" aria-label="' + prog.pct + ' % traduit"><i style="width:' + prog.pct + '%"></i></span></div>' +
      '<p class="ad-help">' + (intro ? intro + ' ' : '') + 'Les textes non traduits s’affichent dans la langue principale. Images, couleurs et réglages sont communs à toutes les langues : repassez en ' + langShort(defLang()) + ' pour les modifier.</p>';
    let group = null;
    units.forEach((u) => {
      if (u.group && u.group !== group && u.group !== 'page') { h += '<h4 class="ad-trgroup">' + e(u.group) + '</h4>'; group = u.group; }
      h += ctrl.tr(u.key, u.path, u.label, u.source, u.type);
    });
    if (!units.length) h += '<p class="ad-emptyline">Rien à traduire ici.</p>';
    return h;
  };

  /* ---------- Barre du haut ---------- */
  const logoInline = () => '<span class="ad-logo" role="img" aria-label="Profilr">' + CS.PROFILR_LOGO_SVG.replace(/__C__/g, 'currentColor').replace('<svg ', '<svg aria-hidden="true" ') + '</span>';
  const renderTop = () => {
    const dirty = store.isDirty();
    const s = D().settings;
    $('#ad-top').innerHTML =
      '<div class="ad-top__brand">' + logoInline() + '<span class="ad-top__sep" aria-hidden="true"></span><span class="ad-top__module">Site carrière</span></div>' +
      '<div class="ad-top__site"><span class="ad-url">' + U.icon('globe') + '<span>' + e(CS.site.publicUrl(s).replace('https://', '')) + '</span></span>' +
      (dirty ? '<span class="ad-chip ad-chip--warn">Modifications non publiées</span>' : '<span class="ad-chip ad-chip--ok">' + U.icon('check') + 'En ligne · publié ' + e(U.relDays(store.state.publishedAt)) + '</span>') + '</div>' +
      '<div class="ad-top__actions">' +
      (dirty ? (ui.confirm === 'discard'
        ? '<span class="ad-confirm">Annuler toutes les modifications ? <button type="button" class="ad-btn ad-btn--sm ad-btn--danger" data-act="discard-yes">Oui, annuler</button><button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="confirm-no">Non</button></span>'
        : '<button type="button" class="ad-btn ad-btn--quiet" data-act="discard">Annuler les modifications</button>') : '') +
      '<button type="button" class="ad-btn' + (ui.history ? ' is-on' : '') + '" data-act="history" aria-expanded="' + ui.history + '">' + U.icon('history') + 'Historique</button>' +
      '<a class="ad-btn" href="#site" data-act="open-public">' + U.icon('eye') + 'Voir le site publié</a>' +
      '<button type="button" class="ad-btn ad-btn--primary" data-act="publish"' + (dirty ? '' : ' disabled') + '>' + U.icon('send') + 'Publier</button></div>';
  };

  /* ---------- Navigation latérale ---------- */
  const TABS = [
    { id: 'page', label: 'Pages', icon: 'layout' },
    { id: 'jobs', label: 'Offres', icon: 'briefcase' },
    { id: 'form', label: 'Formulaire', icon: 'form' },
    { id: 'theme', label: 'Thème', icon: 'palette' },
    { id: 'stats', label: 'Statistiques', icon: 'chart' },
    { id: 'apps', label: 'Candidatures', icon: 'inbox' },
    { id: 'settings', label: 'Paramètres', icon: 'settings' },
  ];
  const FULL_TABS = { apps: 1, stats: 1 };
  const renderNav = () => {
    const newApps = store.state.applications.filter((a) => a.status === 'Nouveau').length;
    const live = CS.site.liveJobs(D()).length;
    $('#ad-nav').innerHTML = TABS.map((t) =>
      '<button type="button" class="ad-nav__btn' + (ui.tab === t.id ? ' is-on' : '') + '" data-tab="' + t.id + '"' + (ui.tab === t.id ? ' aria-current="page"' : '') + '>' + U.icon(t.icon) + '<span>' + t.label + '</span>' +
      (t.id === 'apps' && newApps ? '<span class="ad-badge" aria-label="' + newApps + ' nouvelles">' + newApps + '</span>' : '') +
      (t.id === 'jobs' ? '<span class="ad-nav__meta">' + live + ' en ligne</span>' : '') +
      (t.id === 'page' ? '<span class="ad-nav__meta">' + D().pages.length + ' page' + (D().pages.length > 1 ? 's' : '') + '</span>' : '') + '</button>').join('');
  };

  /* ---------- Panneaux ---------- */
  const panelHead = (title, sub, back) =>
    '<div class="ad-phead">' + (back ? '<button type="button" class="ad-back" data-act="' + back.act + '">' + U.icon('back') + e(back.label) + '</button>' : '') +
    '<h2 class="ad-ptitle">' + e(title) + '</h2>' + (sub ? '<p class="ad-psub">' + sub + '</p>' : '') + '</div>';
  const section = (title, body, note) => '<section class="ad-sec"><h3 class="ad-sectitle">' + e(title) + '</h3>' + (note ? '<p class="ad-help ad-help--top">' + note + '</p>' : '') + body + '</section>';
  const confirmBtn = (key, act, id, label, ask) =>
    ui.confirm === key
      ? '<span class="ad-confirm">' + e(ask) + ' <button type="button" class="ad-btn ad-btn--sm ad-btn--danger" data-act="' + act + '-yes" data-id="' + e(id) + '">' + e(label) + '</button><button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="confirm-no">Annuler</button></span>'
      : '<button type="button" class="ad-btn ad-btn--sm ad-btn--danger-quiet" data-act="' + act + '" data-id="' + e(id) + '">' + U.icon('trash') + e(label) + '</button>';

  const blockSummary = (b) => {
    const p = b.props || {};
    return U.mdText(p.title || p.eyebrow || (p.items && p.items[0] && (p.items[0].title || p.items[0].q || p.items[0].value || p.items[0].name || p.items[0].city)) || '') || B()[b.type].desc;
  };

  const pageSwitcher = () => {
    const d = D();
    const pg = curPage();
    let h = '<div class="ad-pages" role="tablist" aria-label="Pages du site">' + d.pages.map((p, i) =>
      '<button type="button" role="tab" class="ad-pages__btn' + (p.id === pg.id ? ' is-on' : '') + '" aria-selected="' + (p.id === pg.id) + '" data-act="page-select" data-id="' + e(p.id) + '">' + U.icon(i === 0 ? 'home' : 'doc') + '<span>' + e(p.title) + '</span></button>').join('') +
      (trMode() ? '' : '<button type="button" class="ad-pages__btn ad-pages__add" data-act="page-add" aria-label="Ajouter une page">' + U.icon('plus') + '<span>Page</span></button>') + '</div>';
    if (pg !== d.pages[0] && !trMode()) {
      h += '<details class="ad-pageset"' + (ui.pageSettings ? ' open' : '') + ' data-open-key="pageset"><summary>' + U.icon('settings') + 'Réglages de la page</summary><div class="ad-item__body">' +
        ctrl.text('page', 'title', 'Titre de la page') +
        ctrl.text('page', 'slug', 'Adresse', { help: 'La page s’affiche à <strong>' + e(CS.site.publicUrl(d.settings).replace('https://', '')) + '/' + e(pg.slug || '…') + '</strong>.' }) +
        ctrl.toggle('page', 'inMenu', 'Afficher dans le menu du site') +
        '<div class="ad-row">' + confirmBtn('del-page:' + pg.id, 'page-del', pg.id, 'Supprimer la page', 'Supprimer la page et ses blocs ?') + '</div></div></details>';
    }
    return h;
  };

  const pagePanel = () => {
    if (trMode()) {
      if (ui.blockId) {
        const b = blocks().find((x) => x.id === ui.blockId);
        if (b) return panelHead(B()[b.type].label, '', { act: 'back-blocks', label: 'Tous les blocs' }) + trPanel((u) => u.key === 'b:' + b.id);
      }
      return panelHead('Pages', 'Cliquez sur un bloc de l’aperçu pour aller directement à ses textes.') + pageSwitcher() +
        trPanel((u) => u.key === 'p:' + curPage().id || curPage().blocks.some((b) => u.key === 'b:' + b.id), 'Tous les textes de cette page.');
    }
    if (ui.blockId) {
      const b = blocks().find((x) => x.id === ui.blockId);
      if (b) return blockPanel(b);
      ui.blockId = null;
    }
    const list = blocks();
    let h = panelHead('Pages', 'Organisez les blocs comme vous le souhaitez : glissez-les pour les réordonner, cliquez pour les modifier.');
    h += pageSwitcher();
    h += '<ol class="ad-blocks" data-dnd>';
    list.forEach((b, i) => {
      const def = B()[b.type];
      h += '<li class="ad-block' + (b.hidden ? ' is-hidden' : '') + '" draggable="true" data-id="' + e(b.id) + '">' +
        '<span class="ad-block__grip" aria-hidden="true">' + U.icon('grip') + '</span>' +
        '<button type="button" class="ad-block__main" data-act="edit-block" data-id="' + e(b.id) + '"><span class="ad-block__icon">' + U.icon(def.icon) + '</span><span class="ad-block__txt"><strong>' + e(def.label) + (b.menu ? ' <span class="ad-chip ad-chip--sm">menu</span>' : '') + '</strong><span>' + e(blockSummary(b)) + '</span></span></button>' +
        '<span class="ad-block__tools"><button type="button" class="ad-iconbtn" data-act="block-up" data-id="' + e(b.id) + '" aria-label="Monter"' + (i === 0 ? ' disabled' : '') + '>' + U.icon('up') + '</button>' +
        '<button type="button" class="ad-iconbtn" data-act="block-down" data-id="' + e(b.id) + '" aria-label="Descendre"' + (i === list.length - 1 ? ' disabled' : '') + '>' + U.icon('down') + '</button>' +
        '<button type="button" class="ad-iconbtn" data-act="block-hide" data-id="' + e(b.id) + '" aria-label="' + (b.hidden ? 'Afficher' : 'Masquer') + '" title="' + (b.hidden ? 'Bloc masqué : cliquez pour l’afficher' : 'Masquer ce bloc') + '">' + U.icon(b.hidden ? 'eyeOff' : 'eye') + '</button></span></li>';
    });
    h += '</ol>';
    if (!list.length) h += '<p class="ad-emptyline">Cette page n’a pas encore de bloc.</p>';
    h += ui.adding ? libraryHTML() : '<button type="button" class="ad-btn ad-btn--dashed ad-btn--block" data-act="add-open">' + U.icon('plus') + 'Ajouter un bloc</button>';
    return h;
  };

  const libraryHTML = () =>
    '<div class="ad-library"><div class="ad-library__head"><h3 class="ad-sectitle">Ajouter un bloc</h3><button type="button" class="ad-iconbtn" data-act="add-close" aria-label="Fermer">' + U.icon('x') + '</button></div><div class="ad-library__grid">' +
    CS.blocks.ORDER.map((t) => { const d = B()[t]; return '<button type="button" class="ad-lib" data-act="add-block" data-type="' + t + '"><span class="ad-block__icon">' + U.icon(d.icon) + '</span><strong>' + e(d.label) + '</strong><span>' + e(d.desc) + '</span></button>'; }).join('') +
    '</div><p class="ad-help">Le bloc est ajouté ' + (ui.blockId ? 'après le bloc sélectionné.' : 'en bas de la page.') + '</p></div>';

  const blockPanel = (b) => {
    const def = B()[b.type];
    let h = panelHead(def.label, e(def.desc), { act: 'back-blocks', label: 'Tous les blocs' });
    let content = '';
    def.fields.forEach((f) => {
      if (f.type === 'list') content += listField('block', f, b.props[f.key] || []);
      else content += fieldFor('block', f, 'props.' + f.key);
    });
    h += section('Contenu', content);
    const th = D().theme.colors;
    const swatch = { default: th.background, surface: th.surface, primary: th.primary, accent: th.accent };
    const name = nid();
    h += section('Apparence',
      '<div class="ad-field"><span class="ad-label" id="' + name + '-l">Fond de la section</span><div class="ad-swatches" role="radiogroup" aria-labelledby="' + name + '-l">' +
      CS.blocks.BACKGROUNDS.map((o) => '<label class="ad-swatch"><input type="radio" name="' + name + '" value="' + o.value + '"' + ((b.bg || 'default') === o.value ? ' checked' : '') + bindAttr('block', 'bg') + '><span class="ad-swatch__c" style="background:' + e(swatch[o.value]) + '"></span><span>' + e(o.label) + '</span></label>').join('') + '</div></div>' +
      ctrl.text('block', 'menu', 'Lien dans le menu du site', { placeholder: 'Ex. Nos valeurs', help: 'Laissez vide pour ne pas afficher ce bloc dans le menu.' }));
    const others = D().pages.filter((p) => p.id !== curPage().id);
    h += '<div class="ad-pfoot"><button type="button" class="ad-btn ad-btn--sm" data-act="block-dup" data-id="' + e(b.id) + '">' + U.icon('copy') + 'Dupliquer</button>' +
      '<button type="button" class="ad-btn ad-btn--sm" data-act="block-hide" data-id="' + e(b.id) + '">' + U.icon(b.hidden ? 'eye' : 'eyeOff') + (b.hidden ? 'Afficher' : 'Masquer') + '</button>' +
      (others.length ? '<label class="ad-sr" for="mv-' + e(b.id) + '">Déplacer vers une autre page</label><select class="ad-input ad-input--sm" id="mv-' + e(b.id) + '" data-move-block="' + e(b.id) + '"><option value="">Déplacer vers…</option>' + others.map((p) => '<option value="' + e(p.id) + '">' + e(p.title) + '</option>').join('') + '</select>' : '') +
      confirmBtn('del-block:' + b.id, 'block-del', b.id, 'Supprimer', 'Supprimer ce bloc ?') + '</div>';
    return h;
  };

  const STATUS = { draft: ['Brouillon', 'muted'], published: ['Publiée', 'ok'], archived: ['Archivée', 'muted'] };
  const fmtWhen = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : U.fmtDate(iso) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); };
  const jobStatus = (j) => {
    if (CS.site.isScheduled(j)) return ['Programmée · ' + U.fmtDate(j.publishAt).replace(/ \d{4}$/, ''), 'info'];
    if (j.status === 'published' && !CS.site.isLive(j)) return ['Expirée', 'warn'];
    if (j.status === 'published' && !(store.state.published.jobs || []).some((p) => p.id === j.id && p.status === 'published')) return ['À publier', 'warn'];
    return STATUS[j.status] || STATUS.draft;
  };

  const jobsPanel = () => {
    const d = D();
    if (ui.jobId) {
      const j = d.jobs.find((x) => x.id === ui.jobId);
      if (j) return trMode() ? panelHead(j.title, '', { act: 'back-jobs', label: 'Toutes les offres' }) + trPanel((u) => u.key === 'j:' + j.id) : jobPanel(j);
      ui.jobId = null;
    }
    const counts = { all: d.jobs.length, published: 0, scheduled: 0, draft: 0, archived: 0 };
    d.jobs.forEach((j) => { if (CS.site.isScheduled(j)) counts.scheduled++; else counts[j.status]++; });
    let h = panelHead('Offres', 'Rédigez vos offres comme des articles : brouillon, programmation, publication. Chaque offre est rattachée à un projet Profilr.');
    if (!trMode()) h += '<button type="button" class="ad-btn ad-btn--primary ad-btn--block" data-act="job-new">' + U.icon('plus') + 'Nouvelle offre</button>';
    else { const p = trProgress(ui.lang, (u) => u.key.indexOf('j:') === 0); h += '<p class="ad-help">Traduction ' + langShort(ui.lang) + ' des offres : ' + p.done + ' / ' + p.total + ' textes. Choisissez une offre à traduire.</p>'; }
    h += '<div class="ad-tabs" role="tablist">' + [['all', 'Toutes'], ['published', 'En ligne'], ['scheduled', 'Programmées'], ['draft', 'Brouillons'], ['archived', 'Archivées']].map((t) =>
      '<button type="button" role="tab" class="ad-tabs__btn' + (ui.jobFilter === t[0] ? ' is-on' : '') + '" aria-selected="' + (ui.jobFilter === t[0]) + '" data-act="job-filter" data-f="' + t[0] + '">' + t[1] + ' <span>' + counts[t[0]] + '</span></button>').join('') + '</div>';
    const list = d.jobs.filter((j) => ui.jobFilter === 'all' || (ui.jobFilter === 'scheduled' ? CS.site.isScheduled(j) : j.status === ui.jobFilter && !CS.site.isScheduled(j)));
    h += '<ul class="ad-joblist">' + (list.length ? list.map((j) => {
      const st = jobStatus(j);
      const n = store.state.applications.filter((a) => a.jobId === j.id).length;
      const nb = (j.jobboards || []).length;
      const trp = trMode() ? trProgress(ui.lang, (u) => u.key === 'j:' + j.id) : null;
      return '<li><button type="button" class="ad-jobitem" data-act="job-edit" data-id="' + e(j.id) + '"><span class="ad-jobitem__top"><strong>' + e(j.title || 'Offre sans titre') + '</strong><span class="ad-chip ad-chip--' + st[1] + '">' + e(st[0]) + '</span></span>' +
        '<span class="ad-jobitem__meta">' + e([j.department, j.location, j.contract].filter(Boolean).join(' · ')) + '</span>' +
        '<span class="ad-jobitem__meta">' + U.icon('inbox') + n + ' candidature' + (n > 1 ? 's' : '') + (j.multipost && nb ? '<span aria-hidden="true">·</span>' + U.icon('broadcast') + nb + ' jobboard' + (nb > 1 ? 's' : '') : '') +
        (trp ? '<span aria-hidden="true">·</span>' + U.icon('translate') + trp.done + '/' + trp.total : '') + '</span></button></li>';
    }).join('') : '<li class="ad-emptyline">Aucune offre dans cette catégorie.</li>') + '</ul>';
    return h;
  };

  const multipostStatus = (j) => {
    const n = (j.jobboards || []).length;
    const pl = n > 1 ? 's' : '';
    if (!j.multipost || !n) return '';
    if (j.diffusedAt) return '<p class="ad-note ad-note--ok">' + U.icon('broadcast') + '<span>Diffusée sur ' + n + ' jobboard' + pl + ' le ' + e(fmtWhen(j.diffusedAt)) + '.</span></p>';
    if (CS.site.isScheduled(j)) return '<p class="ad-note">' + U.icon('clock') + '<span>Sera diffusée sur ' + n + ' jobboard' + pl + ' à la mise en ligne, le ' + e(fmtWhen(j.publishAt)) + '.</span></p>';
    if (j.status === 'published') return '<p class="ad-note">' + U.icon('send') + '<span>Sera diffusée sur ' + n + ' jobboard' + pl + ' au prochain clic sur « Publier ».</span></p>';
    return '<p class="ad-note">' + U.icon('broadcast') + '<span>La diffusion partira quand l’offre sera publiée.</span></p>';
  };

  const jobPanel = (j) => {
    const d = D();
    const depts = Array.from(new Set(d.jobs.map((x) => x.department).filter(Boolean)));
    const locs = Array.from(new Set(d.jobs.map((x) => x.location).filter(Boolean)));
    let h = panelHead(j.title || 'Nouvelle offre', '', { act: 'back-jobs', label: 'Toutes les offres' });
    h += '<datalist id="dl-dept">' + depts.map((x) => '<option value="' + e(x) + '">').join('') + '</datalist><datalist id="dl-loc">' + locs.map((x) => '<option value="' + e(x) + '">').join('') + '</datalist>';
    const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    h += section('Publication',
      ctrl.segmented('job', 'status', 'Statut', [{ value: 'draft', label: 'Brouillon' }, { value: 'published', label: 'Publiée' }, { value: 'archived', label: 'Archivée' }], { structural: true, help: 'Une offre publiée apparaît sur le site après avoir cliqué sur « Publier » en haut à droite.' }) +
      ctrl.text('job', 'publishAt', 'Mise en ligne programmée (facultatif)', { type: 'datetime-local', min: nowLocal, structural: true, help: j.publishAt ? (CS.site.isScheduled(j) ? 'L’offre apparaîtra automatiquement le ' + e(fmtWhen(j.publishAt)) + '. <button type="button" class="ad-linkbtn ad-linkbtn--inline" data-act="job-unschedule">Publier tout de suite</button>' : 'Date passée : l’offre est en ligne dès la publication.') : 'Laissez vide pour mettre l’offre en ligne dès que vous cliquez sur « Publier ».' }) +
      ctrl.text('job', 'closesAt', 'Date limite (facultatif)', { type: 'date', help: 'L’offre se retire automatiquement du site après cette date.' }) +
      ctrl.select('job', 'projectId', 'Projet Profilr lié', [{ value: '', label: 'Aucun projet' }].concat(CS.data.PROJECTS.map((p) => ({ value: p.id, label: p.name }))), { help: 'Les candidatures reçues arrivent dans ce projet, au statut « Nouveau ».' }));
    h += section('Multidiffusion',
      ctrl.toggle('job', 'multipost', 'Diffuser aussi sur les jobboards', { structural: true, help: 'Profilr publie l’offre sur les jobboards connectés à votre compte, et la retire quand elle est archivée ou expirée.' }) +
      (j.multipost ? '<fieldset class="ad-boards"><legend class="ad-sr">Jobboards</legend>' + CS.data.JOBBOARDS.map((bd) => {
        const on = (j.jobboards || []).indexOf(bd.id) >= 0;
        return '<label class="ad-board' + (bd.connected ? '' : ' is-off') + '"><input type="checkbox" value="' + bd.id + '"' + (on ? ' checked' : '') + (bd.connected ? '' : ' disabled') + bindAttr('job', 'jobboards', ' data-kind="arr" data-structural') + '><span class="ad-board__name">' + e(bd.name) + '</span>' +
          (bd.connected ? '<span class="ad-chip ad-chip--sm ad-chip--ok">connecté</span>' : '<a class="ad-board__link" href="https://app.profilr.eu/" target="_blank" rel="noopener">Connecter dans Profilr</a>') + '</label>';
      }).join('') + '</fieldset>' + multipostStatus(j) : ''));
    h += section('L’offre',
      ctrl.text('job', 'title', 'Intitulé du poste') +
      ctrl.textarea('job', 'summary', 'Résumé en une phrase', { rows: 2, help: 'Affiché sous le titre de l’offre.' }) +
      '<div class="ad-grid2">' + ctrl.text('job', 'department', 'Équipe', { list: 'dl-dept' }) + ctrl.text('job', 'location', 'Lieu', { list: 'dl-loc' }) + '</div>' +
      '<div class="ad-grid2">' + ctrl.select('job', 'contract', 'Contrat', CS.data.CONTRACTS) + ctrl.select('job', 'remote', 'Télétravail', CS.data.REMOTE.map((r) => ({ value: r.id, label: r.label }))) + '</div>' +
      ctrl.select('job', 'experience', 'Expérience', CS.data.EXPERIENCE) +
      '<div class="ad-grid2">' + ctrl.text('job', 'salaryMin', 'Salaire min. (€ brut/an)', { type: 'number', kind: 'number' }) + ctrl.text('job', 'salaryMax', 'Salaire max.', { type: 'number', kind: 'number' }) + '</div>' +
      ctrl.toggle('job', 'salaryVisible', 'Afficher la fourchette de salaire') +
      ctrl.textarea('job', 'description', 'Description', { rows: 14, help: 'Ligne vide : nouveau paragraphe · « - » : puce · « ## » : intertitre · **gras**' }));
    const f = d.form;
    const lvlLabel = { required: 'obligatoire', optional: 'facultatif', off: 'masqué' }[f.fields.extraFile] || 'masqué';
    h += section('Candidature pour cette offre',
      ctrl.select('job', 'extraFile', 'Fichier complémentaire', [
        { value: 'default', label: 'Comme le formulaire (' + lvlLabel + ')' }, { value: 'required', label: 'Obligatoire pour cette offre' },
        { value: 'optional', label: 'Facultatif pour cette offre' }, { value: 'off', label: 'Ne pas demander pour cette offre' }], { structural: true, help: 'Par exemple un portfolio obligatoire pour un poste de designer.' }) +
      (CS.site.formFor(d, j).fields.extraFile !== 'off' ? ctrl.text('job', 'extraFileLabel', 'Nom du fichier demandé', { placeholder: f.extraFileLabel, help: 'Laissez vide pour reprendre « ' + e(f.extraFileLabel) + ' ».' }) : ''));
    const ld = JSON.stringify(CS.site.jobPostingLD(j, d), null, 2);
    h += '<details class="ad-sec ad-disclosure"><summary class="ad-sectitle">Référencement Google for Jobs</summary><p class="ad-help">Ces données structurées (schema.org JobPosting) sont ajoutées automatiquement à la page de l’offre pour qu’elle apparaisse dans les résultats emploi de Google.</p><pre class="ad-code">' + e(ld) + '</pre></details>';
    h += '<div class="ad-pfoot"><button type="button" class="ad-btn ad-btn--sm" data-act="job-dup" data-id="' + e(j.id) + '">' + U.icon('copy') + 'Dupliquer</button>' + confirmBtn('del-job:' + j.id, 'job-del', j.id, 'Supprimer', 'Supprimer cette offre ?') + '</div>';
    return h;
  };

  const formPanel = () => {
    if (trMode()) return panelHead('Formulaire de candidature', '') + trPanel((u) => u.key === 'form');
    const f = D().form;
    const lvl = [{ value: 'required', label: 'Obligatoire' }, { value: 'optional', label: 'Facultatif' }, { value: 'off', label: 'Masqué' }];
    let h = panelHead('Formulaire de candidature', 'Le même formulaire sert pour toutes les offres et pour les candidatures spontanées. Le fichier complémentaire peut être réglé offre par offre.');
    h += section('Coordonnées',
      '<p class="ad-locked">' + U.icon('shield') + 'Prénom, nom et e-mail sont toujours demandés.</p>' +
      ctrl.segmented('form', 'fields.phone', 'Téléphone', lvl) +
      ctrl.segmented('form', 'fields.linkedin', 'Profil LinkedIn', lvl));
    h += section('Documents',
      ctrl.segmented('form', 'fields.cv', 'CV', lvl) +
      ctrl.segmented('form', 'fields.coverLetterFile', 'Lettre de motivation (fichier)', lvl) +
      ctrl.segmented('form', 'fields.coverLetter', 'Message de motivation (texte)', lvl) +
      ctrl.segmented('form', 'fields.extraFile', 'Fichier complémentaire', lvl, { structural: true }) +
      (f.fields.extraFile !== 'off' ? ctrl.text('form', 'extraFileLabel', 'Nom du fichier complémentaire', { help: 'PDF, image ou archive ZIP jusqu’à 20 Mo : portfolio, étude de cas, travaux…' }) : ''));
    let q = '<div class="ad-items">';
    (f.questions || []).forEach((qq, i) => {
      const path = 'questions.' + i;
      const okey = 'form:' + qq.id;
      const typeLabel = { text: 'Texte court', textarea: 'Texte long', select: 'Liste de choix', yesno: 'Oui / Non' }[qq.type];
      q += '<details class="ad-item"' + (ui.open[okey] ? ' open' : '') + ' data-open-key="' + okey + '"><summary><span class="ad-item__title">' + e(qq.label || 'Question sans titre') + '<span class="ad-muted"> · ' + typeLabel + (qq.required ? ' · obligatoire' : '') + (qq.knockout ? ' · éliminatoire' : '') + '</span></span>' +
        '<span class="ad-item__tools"><button type="button" class="ad-iconbtn" data-act="q-up" data-i="' + i + '" aria-label="Monter"' + (i === 0 ? ' disabled' : '') + '>' + U.icon('up') + '</button><button type="button" class="ad-iconbtn" data-act="q-down" data-i="' + i + '" aria-label="Descendre"' + (i === f.questions.length - 1 ? ' disabled' : '') + '>' + U.icon('down') + '</button><button type="button" class="ad-iconbtn ad-iconbtn--danger" data-act="q-del" data-i="' + i + '" aria-label="Supprimer">' + U.icon('trash') + '</button></span></summary><div class="ad-item__body">' +
        ctrl.text('form', path + '.label', 'Question') +
        ctrl.select('form', path + '.type', 'Type de réponse', [{ value: 'text', label: 'Texte court' }, { value: 'textarea', label: 'Texte long' }, { value: 'select', label: 'Liste de choix' }, { value: 'yesno', label: 'Oui / Non' }], { structural: true }) +
        (qq.type === 'select' ? ctrl.textarea('form', path + '.options', 'Choix proposés (un par ligne)', { rows: 4, kind: 'lines' }) : '') +
        ctrl.toggle('form', path + '.required', 'Réponse obligatoire') +
        (qq.type === 'select' || qq.type === 'yesno'
          ? ctrl.select('form', path + '.knockout', 'Critère éliminatoire', [{ value: '', label: 'Aucun' }].concat((qq.type === 'yesno' ? ['Oui', 'Non'] : qq.options || []).map((o) => ({ value: o, label: 'Signaler si la réponse est « ' + o + ' »' }))), { help: 'La candidature est signalée dans l’onglet Candidatures. Elle n’est pas refusée automatiquement.' })
          : '') +
        '</div></details>';
    });
    q += '</div><button type="button" class="ad-btn ad-btn--sm ad-btn--dashed" data-act="q-add">' + U.icon('plus') + 'Ajouter une question</button>';
    h += section('Questions personnalisées', q);
    h += section('Consentement (RGPD)',
      ctrl.textarea('form', 'consent', 'Texte de consentement', { rows: 4, help: 'Le candidat doit cocher cette case pour envoyer sa candidature. Le lien vers votre politique de confidentialité est ajouté à la suite.' }) +
      ctrl.toggle('form', 'talentPoolOptIn', 'Proposer d’entrer dans le vivier', { help: 'Le candidat peut accepter d’être recontacté pour d’autres offres.', structural: true }));
    h += section('Après l’envoi',
      ctrl.text('form', 'confirmTitle', 'Titre de la page de confirmation') +
      ctrl.textarea('form', 'confirmText', 'Message de confirmation', { rows: 3 }) +
      ctrl.text('form', 'autoReplySubject', 'Objet de l’e-mail d’accusé de réception', { help: 'L’e-mail est envoyé automatiquement au candidat, dans la langue où il a postulé.' }));
    return h;
  };

  const themePanel = () => {
    const t = D().theme;
    const c = t.colors;
    let h = panelHead('Thème', 'Le site reprend la charte Profilr par défaut. Remplacez le logo, les couleurs et les polices par celles de votre marque.' + (trMode() ? ' Le thème est commun à toutes les langues.' : ''));
    h += section('Thèmes prêts à l’emploi', '<div class="ad-presets">' + CS.data.PRESETS.map((p) => {
      const pc = p.theme.colors;
      const on = ['primary', 'accent', 'text', 'background', 'surface'].every((k) => String(pc[k]).toLowerCase() === String(c[k]).toLowerCase()) && p.theme.fonts.heading === t.fonts.heading;
      return '<button type="button" class="ad-preset' + (on ? ' is-on' : '') + '" data-act="preset" data-id="' + p.id + '" aria-pressed="' + on + '"><span class="ad-preset__sw" style="background:' + pc.background + '"><i style="background:' + pc.primary + '"></i><i style="background:' + pc.accent + '"></i><i style="background:' + pc.surface + '"></i></span><strong>' + e(p.name) + '</strong><span>' + e(p.theme.fonts.heading) + '</span></button>';
    }).join('') + '</div>');
    const logoState = t.logo === 'profilr' ? 'profilr' : t.logo ? 'custom' : 'text';
    h += section('Identité',
      ctrl.text('theme', 'companyName', 'Nom de l’entreprise') +
      '<div class="ad-field"><span class="ad-label">Logo</span><div class="ad-logoprev">' + (t.logo ? '<img src="' + e(CS.site.logoSrc(t)) + '" alt="Logo actuel" style="height:' + (Number(t.logoHeight) || 30) + 'px">' : '<span class="ad-logoprev__txt" style="font-family:' + e(CS.site.fontCss(t.fonts.heading)) + '">' + e(t.companyName) + '</span>') + '</div>' +
      '<div class="ad-row"><label class="ad-btn ad-btn--sm">' + U.icon('upload') + 'Importer un logo<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden data-logo></label>' +
      (logoState !== 'profilr' ? '<button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="logo-profilr">Logo Profilr</button>' : '') +
      (logoState !== 'text' ? '<button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="logo-text">Nom en texte</button>' : '') + '</div>' +
      '<p class="ad-help">SVG ou PNG à fond transparent, de préférence.</p></div>' +
      (t.logo ? '<div class="ad-field"><label class="ad-label" for="logo-h">Hauteur du logo <span class="ad-muted" data-out="logo-h">' + (t.logoHeight || 30) + ' px</span></label><input type="range" id="logo-h" min="18" max="60" step="1" value="' + (t.logoHeight || 30) + '" class="ad-range"' + bindAttr('theme', 'logoHeight', ' data-kind="number"') + '></div>' : ''));
    const ratio = U.contrast(c.text, c.background);
    h += section('Couleurs',
      ctrl.color('theme', 'colors.primary', 'Couleur principale', 'Bandeaux, boutons principaux, titres d’offres.') +
      ctrl.color('theme', 'colors.accent', 'Couleur d’accent', 'Boutons sur fond coloré, puces, détails.') +
      ctrl.color('theme', 'colors.text', 'Texte') +
      ctrl.color('theme', 'colors.background', 'Fond de page') +
      ctrl.color('theme', 'colors.surface', 'Fond doux', 'Sections alternées et cartes.') +
      '<p class="ad-contrast ' + (ratio < 4.5 ? 'is-bad' : '') + '" data-contrast>' + contrastMsg(ratio) + '</p>');
    const fonts = CS.data.FONTS.map((f) => ({ value: f.name, label: f.name }));
    h += section('Typographie', ctrl.select('theme', 'fonts.heading', 'Police des titres', fonts) + ctrl.select('theme', 'fonts.body', 'Police du texte', fonts));
    h += section('Formes',
      ctrl.segmented('theme', 'radius', 'Coins des cartes et images', [{ value: 'arrondi', label: 'Arrondis' }, { value: 'doux', label: 'Doux' }, { value: 'carre', label: 'Droits' }]) +
      ctrl.segmented('theme', 'buttons', 'Boutons', [{ value: 'pilule', label: 'Pilule' }, { value: 'arrondi', label: 'Arrondis' }, { value: 'carre', label: 'Droits' }]));
    h += '<div class="ad-pfoot"><button type="button" class="ad-btn ad-btn--sm" data-act="theme-reset">' + U.icon('sparkles') + 'Revenir à la charte Profilr</button></div>';
    return h;
  };
  const contrastMsg = (r) => (r < 4.5
    ? U.icon('flag') + 'Contraste texte / fond : ' + r.toFixed(1) + ':1. Visez au moins 4,5:1 pour que le texte reste lisible.'
    : U.icon('check') + 'Contraste texte / fond : ' + r.toFixed(1) + ':1, lisible.');

  const settingsPanel = () => {
    const s = D().settings;
    if (trMode()) return panelHead('Paramètres', '') + trPanel((u) => u.key === 'settings');
    let h = panelHead('Paramètres', '');
    const langs = s.languages || ['fr'];
    h += section('Langues du site',
      '<div class="ad-langs">' + CS.LANGS.map((l, i) => {
        const on = langs.indexOf(l.id) >= 0;
        const p = on && i > 0 ? trProgress(l.id) : null;
        return '<label class="ad-lang' + (i === 0 ? ' is-locked' : '') + '"><input type="checkbox" value="' + l.id + '"' + (on ? ' checked' : '') + (i === 0 ? ' disabled' : '') + ' data-lang-toggle><span class="ad-lang__txt"><strong>' + e(l.label) + '</strong>' + (i === 0 ? '<span class="ad-muted">Langue principale</span>' : p ? '<span class="ad-muted">' + p.pct + ' % traduit · ' + p.done + ' / ' + p.total + ' textes</span>' : '<span class="ad-muted">Non proposée</span>') + '</span>' +
          (p ? '<span class="ad-meter"><i style="width:' + p.pct + '%"></i></span>' : '') + '</label>';
      }).join('') + '</div>' +
      '<p class="ad-help">Pour traduire, choisissez la langue d’édition au-dessus de l’aperçu. Les candidats changent de langue depuis l’en-tête du site, et reçoivent leurs e-mails dans leur langue.</p>');
    h += section('Adresse du site',
      ctrl.text('settings', 'slug', 'Sous-domaine Profilr', { help: 'Votre site est en ligne à l’adresse <strong data-out="url">' + e(CS.site.publicUrl(Object.assign({}, s, { customDomain: '' })).replace('https://', '')) + '</strong>.' }) +
      ctrl.text('settings', 'customDomain', 'Domaine personnalisé (facultatif)', { placeholder: 'carrieres.votre-entreprise.com', help: 'Créez un enregistrement CNAME vers <code>sites.profilr.eu</code> chez votre hébergeur. Le certificat HTTPS est généré automatiquement.' }));
    h += section('Référencement',
      ctrl.text('settings', 'siteTitle', 'Titre du site') +
      ctrl.textarea('settings', 'seoDescription', 'Description pour les moteurs de recherche', { rows: 3, counter: 160 }) +
      '<div class="ad-serp" aria-label="Aperçu dans Google"><span class="ad-serp__url" data-out="serp-url">' + e(CS.site.publicUrl(s).replace('https://', '')) + '</span><span class="ad-serp__title" data-out="serp-title">' + e(s.siteTitle) + '</span><span class="ad-serp__desc" data-out="serp-desc">' + e(s.seoDescription) + '</span></div>');
    h += section('Mesure d’audience',
      ctrl.toggle('settings', 'analytics', 'Mesurer l’audience du site', { structural: true, help: 'Alimente l’onglet Statistiques. Un bandeau demande l’accord des visiteurs : sans accord, rien n’est mesuré, à part les candidatures.' }) +
      (s.analytics ? ctrl.textarea('settings', 'cookieText', 'Texte du bandeau cookies', { rows: 3 }) : ''));
    h += section('Jobboards connectés dans Profilr',
      '<ul class="ad-boardlist">' + CS.data.JOBBOARDS.map((bd) => '<li><span>' + e(bd.name) + '</span>' + (bd.connected ? '<span class="ad-chip ad-chip--ok">' + U.icon('check') + 'connecté</span>' : '<a href="https://app.profilr.eu/" target="_blank" rel="noopener">Connecter dans Profilr</a>') + '</li>').join('') + '</ul>' +
      '<p class="ad-help">Cochez « Multidiffusion » sur une offre pour la publier aussi sur ces jobboards.</p>');
    h += section('Données personnelles et mentions',
      ctrl.text('settings', 'privacyUrl', 'Lien vers la politique de confidentialité', { type: 'url' }) +
      ctrl.text('settings', 'legalUrl', 'Lien vers les mentions légales', { type: 'url' }) +
      ctrl.select('settings', 'retentionMonths', 'Durée de conservation des candidatures', [{ value: '6', label: '6 mois' }, { value: '12', label: '12 mois' }, { value: '24', label: '24 mois (recommandé par la CNIL)' }, { value: '36', label: '36 mois' }], { help: 'Passé ce délai, les candidatures non retenues sont anonymisées automatiquement.' }));
    h += section('Notifications', ctrl.text('settings', 'notifyEmails', 'Prévenir aussi ces adresses à chaque candidature', { placeholder: 'rh@entreprise.com, manager@entreprise.com', help: 'Le recruteur responsable du projet Profilr est toujours prévenu.' }));
    h += section('Pied de page', ctrl.toggle('settings', 'showPoweredBy', 'Afficher « Site carrière propulsé par Profilr »'));
    h += section('Données du prototype',
      '<p class="ad-help">La configuration du site tient dans un seul objet JSON : thème, pages, blocs, offres, formulaire et traductions. C’est le format à stocker côté serveur.</p>' +
      '<div class="ad-row"><button type="button" class="ad-btn ad-btn--sm" data-act="copy-json">' + U.icon('copy') + 'Copier la configuration JSON</button>' +
      confirmBtn('reset', 'reset', 'x', 'Réinitialiser la démo', 'Tout réinitialiser ?') + '</div>' +
      (store.storageOk ? '' : '<p class="ad-help ad-help--warn">Le stockage du navigateur est indisponible : vos modifications seront perdues au rechargement.</p>'));
    return h;
  };

  /* ---------- Statistiques ---------- */
  const fmtN = (n) => Math.round(n).toLocaleString('fr-FR');
  const fmtPct = (n) => (isFinite(n) ? (Math.round(n * 1000) / 10).toLocaleString('fr-FR') : '0') + ' %';
  const sumDays = (days) => {
    const daily = store.state.stats.daily;
    const t = { visits: 0, jobViews: 0, applyStarts: 0, applies: 0, consentYes: 0, consentNo: 0, sources: {}, appSources: {}, jobs: {}, langs: {}, sample: false };
    days.forEach((k) => {
      const d = daily[k];
      if (!d) return;
      if (d.s) t.sample = true;
      t.visits += d.visits || 0; t.applyStarts += d.applyStarts || 0; t.applies += d.applies || 0; t.consentYes += d.consentYes || 0; t.consentNo += d.consentNo || 0;
      Object.keys(d.jobViews || {}).forEach((j) => { t.jobViews += d.jobViews[j]; t.jobs[j] = (t.jobs[j] || 0) + d.jobViews[j]; });
      ['sources', 'appSources', 'langs'].forEach((f) => Object.keys(d[f] || {}).forEach((x) => (t[f][x] = (t[f][x] || 0) + d[f][x])));
    });
    return t;
  };
  const dayList = (n, offset) => Array.from({ length: n }, (_, i) => U.dayKey(Date.now() - (n - 1 - i + (offset || 0)) * 86400000));
  const niceMax = (m) => { if (m <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(m))); const r = m / p; return (r <= 2 ? 2 : r <= 5 ? 5 : 10) * p; };

  /* Histogramme d'une seule série, en HTML : barres fines arrondies en haut, axe Y à 3 graduations, infobulle au survol */
  const columnChart = (title, sub, keys, values, unit) => {
    const max = niceMax(Math.max(1, ...values));
    const ticks = [0, max / 2, max];
    const lab = (k) => new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const every = keys.length > 14 ? 7 : 1;
    const total = values.reduce((a, b) => a + b, 0);
    return '<figure class="ad-chart ad-card"><figcaption><h3 class="ad-chart__title">' + e(title) + '</h3><p class="ad-chart__sub">' + e(sub) + ' · total ' + fmtN(total) + '</p></figcaption>' +
      '<div class="ad-chart__plot"><div class="ad-chart__y" aria-hidden="true">' + ticks.slice().reverse().map((t) => '<span>' + fmtN(t) + '</span>').join('') + '</div>' +
      '<div class="ad-chart__area"><div class="ad-chart__grid" aria-hidden="true"><i></i><i></i><i></i></div><div class="ad-chart__bars" role="list" aria-label="' + e(title) + '">' +
      values.map((v, i) => '<div class="ad-chart__col" role="listitem" tabindex="0" data-tip="' + e(lab(keys[i]) + ' : ' + fmtN(v) + ' ' + unit) + '" aria-label="' + e(lab(keys[i]) + ' : ' + fmtN(v) + ' ' + unit) + '"><span style="height:' + ((v / max) * 100).toFixed(2) + '%"></span></div>').join('') +
      '</div><div class="ad-chart__x" aria-hidden="true">' + keys.map((k, i) => '<span>' + ((keys.length - 1 - i) % every === 0 ? e(lab(k)) : '') + '</span>').join('') + '</div></div></div>' +
      '<details class="ad-chart__table"><summary>Voir les données</summary><div class="ad-tablewrap"><table class="ad-table ad-table--compact"><thead><tr><th scope="col">Jour</th><th scope="col" class="ad-num">' + e(title) + '</th></tr></thead><tbody>' +
      keys.map((k, i) => '<tr><td>' + e(lab(k)) + '</td><td class="ad-num">' + fmtN(values[i]) + '</td></tr>').join('') + '</tbody></table></div></details></figure>';
  };
  /* Barres horizontales d'une seule série (entonnoir, sources) */
  const hbars = (rows, fmt) => {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return '<ul class="ad-hbars">' + rows.map((r) => '<li><span class="ad-hbars__label">' + e(r.label) + '</span><span class="ad-hbars__track"><span class="ad-hbars__bar" style="width:' + Math.max(0.5, (r.value / max) * 100).toFixed(2) + '%"></span></span><span class="ad-hbars__val">' + (fmt ? fmt(r) : fmtN(r.value)) + '</span></li>').join('') + '</ul>';
  };
  const delta = (cur, prev) => {
    if (!prev) return '<span class="ad-kpi__delta"><span class="ad-muted">pas de période précédente</span></span>';
    const d = (cur - prev) / prev;
    return '<span class="ad-kpi__delta">' + (d >= 0 ? '▲ +' : '▼ ') + fmtPct(d) + ' <span class="ad-muted">vs période précédente</span></span>';
  };

  const statsView = () => {
    const d = D();
    const n = ui.statsDays;
    const keys = dayList(n);
    const cur = sumDays(keys);
    const prev = sumDays(dayList(n, n));
    const daily = store.state.stats.daily;
    const conv = cur.visits ? cur.applies / cur.visits : 0;
    const convPrev = prev.visits ? prev.applies / prev.visits : 0;
    let h = '<div class="ad-stats"><div class="ad-apps__head"><div><h2 class="ad-ptitle">Statistiques</h2><p class="ad-psub">Visites du site carrière et candidatures, sur les ' + n + ' derniers jours.' + (cur.sample ? ' <span class="ad-chip ad-chip--sm">données d’exemple</span>' : '') + '</p></div>' +
      '<div class="ad-seg" role="radiogroup" aria-label="Période">' + [7, 30, 60].map((x) => '<label class="ad-seg__opt"><input type="radio" name="stats-days" value="' + x + '"' + (x === n ? ' checked' : '') + ' data-stats-days><span>' + x + ' jours</span></label>').join('') + '</div></div>';
    if (!d.settings.analytics) h += '<p class="ad-banner ad-banner--warn">' + U.icon('flag') + '<span>La mesure d’audience est désactivée dans Paramètres : seules les candidatures sont comptées.</span></p>';
    h += '<div class="ad-kpis">' +
      '<div class="ad-kpi"><span class="ad-kpi__label">Visites</span><strong class="ad-kpi__value">' + fmtN(cur.visits) + '</strong>' + delta(cur.visits, prev.visits) + '</div>' +
      '<div class="ad-kpi"><span class="ad-kpi__label">Vues d’offres</span><strong class="ad-kpi__value">' + fmtN(cur.jobViews) + '</strong>' + delta(cur.jobViews, prev.jobViews) + '</div>' +
      '<div class="ad-kpi"><span class="ad-kpi__label">Candidatures</span><strong class="ad-kpi__value">' + fmtN(cur.applies) + '</strong>' + delta(cur.applies, prev.applies) + '</div>' +
      '<div class="ad-kpi"><span class="ad-kpi__label">Taux de candidature</span><strong class="ad-kpi__value">' + fmtPct(conv) + '</strong><span class="ad-kpi__delta">' + (convPrev ? (conv >= convPrev ? '▲ +' : '▼ ') + ((conv - convPrev) * 100).toFixed(1).replace('.', ',') + ' pt ' : '') + '<span class="ad-muted">candidatures / visites</span></span></div></div>';
    h += '<div class="ad-chartgrid">' +
      columnChart('Visites par jour', 'Visiteurs ayant accepté la mesure d’audience', keys, keys.map((k) => (daily[k] || {}).visits || 0), 'visites') +
      columnChart('Candidatures par jour', 'Toutes les candidatures reçues', keys, keys.map((k) => (daily[k] || {}).applies || 0), 'candidatures') + '</div>';
    const funnel = [
      { label: 'Visites', value: cur.visits }, { label: 'Vues d’une offre', value: cur.jobViews },
      { label: 'Formulaire commencé', value: cur.applyStarts }, { label: 'Candidature envoyée', value: cur.applies },
    ];
    const srcRows = Object.keys(cur.sources).map((s) => ({ label: s, value: cur.sources[s], apps: cur.appSources[s] || 0 })).sort((a, b) => b.value - a.value);
    h += '<div class="ad-chartgrid">' +
      '<section class="ad-card"><h3 class="ad-chart__title">Du visiteur au candidat</h3><p class="ad-chart__sub">Chaque étape, et la part qui passe à l’étape suivante (un visiteur peut voir plusieurs offres)</p>' +
      hbars(funnel, (r) => { const i = funnel.indexOf(r); if (i === 1) return fmtN(r.value) + ' <span class="ad-muted">' + (cur.visits ? (r.value / cur.visits).toFixed(1).replace('.', ',') : '0') + ' par visite</span>'; return fmtN(r.value) + (i ? ' <span class="ad-muted">' + fmtPct(funnel[i - 1].value ? r.value / funnel[i - 1].value : 0) + '</span>' : ''); }) + '</section>' +
      '<section class="ad-card"><h3 class="ad-chart__title">Provenance des visiteurs</h3><p class="ad-chart__sub">Visites par source, et candidatures qui en viennent</p>' +
      (srcRows.length ? hbars(srcRows, (r) => fmtN(r.value) + ' <span class="ad-muted">· ' + fmtN(r.apps) + ' cand.</span>') : '<p class="ad-emptyline">Pas encore de visite mesurée.</p>') + '</section></div>';
    const appsBy = (id) => store.state.applications.filter((a) => a.jobId === id && new Date(a.createdAt) >= new Date(keys[0])).length;
    const rows = d.jobs.filter((j) => cur.jobs[j.id] || appsBy(j.id)).map((j) => {
      const v = cur.jobs[j.id] || 0;
      const est = Math.round(v * (cur.jobViews ? cur.applies / cur.jobViews : 0));
      return { j, v, a: cur.sample ? Math.max(est, appsBy(j.id)) : appsBy(j.id) };
    }).sort((x, y) => y.v - x.v);
    h += '<section class="ad-card"><h3 class="ad-chart__title">Performance des offres</h3><p class="ad-chart__sub">Vues et candidatures par offre sur la période</p>' +
      (rows.length ? '<div class="ad-tablewrap ad-tablewrap--flat"><table class="ad-table"><thead><tr><th scope="col">Offre</th><th scope="col" class="ad-num">Vues</th><th scope="col" class="ad-num">Candidatures</th><th scope="col" class="ad-num">Taux</th><th scope="col">Diffusion</th></tr></thead><tbody>' +
        rows.map((r) => '<tr><td><button type="button" class="ad-linkbtn" data-act="stats-job" data-id="' + e(r.j.id) + '"><strong>' + e(r.j.title) + '</strong></button></td><td class="ad-num">' + fmtN(r.v) + '</td><td class="ad-num">' + fmtN(r.a) + '</td><td class="ad-num">' + (r.v ? fmtPct(r.a / r.v) : '–') + '</td><td>' +
          (r.j.multipost && (r.j.jobboards || []).length ? e(['Site carrière'].concat((r.j.jobboards || []).map((id) => (CS.data.JOBBOARDS.find((b) => b.id === id) || {}).name).filter(Boolean)).join(', ')) : '<span class="ad-muted">Site carrière uniquement</span>') + '</td></tr>').join('') +
        '</tbody></table></div>' : '<p class="ad-emptyline">Aucune offre consultée sur la période.</p>') + '</section>';
    const ck = cur.consentYes + cur.consentNo;
    const langTotal = Object.values(cur.langs).reduce((a, b) => a + b, 0);
    h += '<div class="ad-chartgrid"><section class="ad-card"><h3 class="ad-chart__title">Bandeau cookies</h3><p class="ad-chart__sub">Part des visiteurs qui acceptent la mesure d’audience</p><p class="ad-bigline"><strong class="ad-big">' + (ck ? fmtPct(cur.consentYes / ck) : '–') + '</strong> <span class="ad-muted">' + fmtN(cur.consentYes) + ' accords sur ' + fmtN(ck) + ' réponses</span></p><p class="ad-help">Les visites des personnes qui refusent ne sont pas comptées : les chiffres d’audience sont donc des minimums.</p></section>' +
      '<section class="ad-card"><h3 class="ad-chart__title">Langue des visiteurs</h3><p class="ad-chart__sub">Langue choisie sur le site</p>' + (langTotal ? hbars(Object.keys(cur.langs).map((l) => ({ label: (CS.LANGS.find((x) => x.id === l) || { label: l }).label, value: cur.langs[l] })), (r) => fmtPct(r.value / langTotal)) : '<p class="ad-emptyline">Pas encore de visite mesurée.</p>') + '</section></div>';
    return h + '</div><div class="ad-tip" id="ad-tip" role="tooltip" hidden></div>';
  };

  /* ---------- Candidatures ---------- */
  const appsView = () => {
    const d = D();
    const all = store.state.applications;
    const jobName = (id) => (id ? (d.jobs.find((j) => j.id === id) || {}).title || 'Offre supprimée' : 'Candidature spontanée');
    const list = all.filter((a) => (!ui.appJob || (ui.appJob === 'spont' ? !a.jobId : a.jobId === ui.appJob)) && (!ui.appStatus || a.status === ui.appStatus));
    const counts = {};
    all.forEach((a) => (counts[a.status] = (counts[a.status] || 0) + 1));
    let h = '<div class="ad-apps' + (ui.appId ? ' has-drawer' : '') + '"><div class="ad-apps__head"><div><h2 class="ad-ptitle">Candidatures</h2><p class="ad-psub">' + all.length + ' reçue' + (all.length > 1 ? 's' : '') + ' via le site carrière · ' + (counts['Nouveau'] || 0) + ' à traiter</p></div>' +
      '<div class="ad-row"><label class="ad-sr" for="app-job">Filtrer par offre</label><select id="app-job" class="ad-input" data-appfilter="job"><option value="">Toutes les offres</option><option value="spont"' + (ui.appJob === 'spont' ? ' selected' : '') + '>Candidatures spontanées</option>' + d.jobs.map((j) => '<option value="' + e(j.id) + '"' + (ui.appJob === j.id ? ' selected' : '') + '>' + e(j.title) + '</option>').join('') + '</select>' +
      '<label class="ad-sr" for="app-st">Filtrer par statut</label><select id="app-st" class="ad-input" data-appfilter="status"><option value="">Tous les statuts</option>' + CS.data.APP_STATUSES.map((s) => '<option' + (ui.appStatus === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div></div>' +
      '<p class="ad-banner">' + U.icon('sparkles') + '<span>Chaque candidature crée (ou met à jour) le profil dans Profilr, l’ajoute au projet lié à l’offre au statut « Nouveau » et prévient le recruteur. Dans ce prototype, elles sont stockées dans votre navigateur.</span></p>';
    if (!list.length) return h + '<div class="ad-emptybox">' + U.icon('inbox') + '<p><strong>Aucune candidature' + (all.length ? ' pour ces filtres' : ' pour l’instant') + '.</strong><br>Testez le formulaire depuis l’aperçu : la candidature apparaîtra ici.</p></div></div>';
    h += '<div class="ad-tablewrap"><table class="ad-table"><thead><tr><th scope="col">Candidat</th><th scope="col">Offre</th><th scope="col">Reçue</th><th scope="col">Source</th><th scope="col">Pièces</th><th scope="col">Critères</th><th scope="col">Statut</th></tr></thead><tbody>';
    list.forEach((a) => {
      const nFiles = [a.cv, a.files && a.files.coverLetterFile, a.files && a.files.extraFile].filter(Boolean).length;
      h += '<tr class="' + (ui.appId === a.id ? 'is-on' : '') + '"><td><button type="button" class="ad-linkbtn" data-act="app-open" data-id="' + e(a.id) + '"><strong>' + e(a.firstName + ' ' + a.lastName) + '</strong></button><span class="ad-muted">' + e(a.email) + '</span>' + (a.sample ? '<span class="ad-chip ad-chip--sm">exemple</span>' : '') + '</td>' +
        '<td>' + e(jobName(a.jobId)) + '</td><td class="ad-nowrap">' + e(U.fmtDateTime(a.createdAt)) + '</td><td>' + e(a.source) + (a.lang && a.lang !== defLang() ? ' <span class="ad-chip ad-chip--sm">' + langShort(a.lang) + '</span>' : '') + '</td>' +
        '<td class="ad-nowrap" aria-label="' + nFiles + ' pièce' + (nFiles > 1 ? 's' : '') + ' jointe' + (nFiles > 1 ? 's' : '') + '">' + U.icon('paperclip') + ' ' + nFiles + '</td>' +
        '<td>' + (a.knockedOut ? '<span class="ad-chip ad-chip--warn">' + U.icon('flag') + 'À vérifier</span>' : '<span class="ad-chip ad-chip--ok">' + U.icon('check') + 'OK</span>') + '</td>' +
        '<td><label class="ad-sr" for="st-' + e(a.id) + '">Statut</label><select id="st-' + e(a.id) + '" class="ad-input ad-input--sm" data-appstatus="' + e(a.id) + '">' + CS.data.APP_STATUSES.map((s) => '<option' + (a.status === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></td></tr>';
    });
    return h + '</tbody></table></div></div>';
  };

  const appDrawer = () => {
    const a = store.state.applications.find((x) => x.id === ui.appId);
    if (!a) return '';
    const d = D();
    const job = a.jobId ? d.jobs.find((j) => j.id === a.jobId) : null;
    const proj = CS.data.PROJECTS.find((p) => p.id === (a.projectId || (job && job.projectId)));
    const qs = d.form.questions || [];
    const fsz = (f) => (f.size > 1048576 ? (f.size / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(f.size / 1024)) + ' Ko');
    const fl = a.files || {};
    const files = [['CV', a.cv], ['Lettre de motivation', fl.coverLetterFile], [(fl.extraFile && fl.extraFile.label) || 'Fichier complémentaire', fl.extraFile]].filter((x) => x[1]);
    const rows = [['E-mail', a.email], ['Téléphone', a.phone], ['LinkedIn', a.linkedin], ['Langue', a.lang ? (CS.LANGS.find((l) => l.id === a.lang) || { label: a.lang }).label : '']].filter((r) => r[1]);
    const answers = Object.keys(a.answers || {}).filter((k) => a.answers[k]).map((k) => {
      const q = qs.find((x) => x.id === k);
      const bad = q && q.knockout && q.knockout === a.answers[k];
      return '<div><dt>' + e(q ? q.label : k) + '</dt><dd>' + e(a.answers[k]) + (bad ? ' <span class="ad-chip ad-chip--warn">' + U.icon('flag') + 'critère non rempli</span>' : '') + '</dd></div>';
    }).join('');
    return '<aside class="ad-drawer" aria-label="Détail de la candidature"><div class="ad-drawer__head"><div><h3 class="ad-ptitle">' + e(a.firstName + ' ' + a.lastName) + '</h3><p class="ad-psub">' + e(job ? job.title : 'Candidature spontanée') + ' · ' + e(U.fmtDateTime(a.createdAt)) + '</p></div><button type="button" class="ad-iconbtn" data-act="app-close" aria-label="Fermer">' + U.icon('x') + '</button></div>' +
      '<dl class="ad-dl">' + rows.map((r) => '<div><dt>' + r[0] + '</dt><dd>' + e(r[1]) + '</dd></div>').join('') + '</dl>' +
      '<h4 class="ad-sectitle">Pièces jointes</h4>' + (files.length ? '<ul class="ad-files">' + files.map((f) => '<li>' + U.icon('file') + '<span><strong>' + e(f[0]) + '</strong><span class="ad-muted">' + e(f[1].name) + ' · ' + fsz(f[1]) + '</span></span></li>').join('') + '</ul>' : '<p class="ad-emptyline">Aucun fichier joint.</p>') +
      (a.coverLetter ? '<h4 class="ad-sectitle">Motivation</h4><p class="ad-letter">' + e(a.coverLetter) + '</p>' : '') +
      (answers ? '<h4 class="ad-sectitle">Réponses</h4><dl class="ad-dl">' + answers + '</dl>' : '') +
      '<h4 class="ad-sectitle">Dans Profilr</h4><ul class="ad-checks"><li>' + U.icon('check') + 'Profil créé et dédoublonné par e-mail</li><li>' + U.icon('check') + 'Ajouté au projet « ' + e(proj ? proj.name : 'Vivier') + ' »</li><li>' + U.icon(a.talentPool ? 'check' : 'x') + (a.talentPool ? 'Accepte d’être recontacté pour d’autres offres' : 'Ne souhaite pas entrer dans le vivier') + '</li><li>' + U.icon('check') + 'Consentement RGPD enregistré · conservation ' + e(d.settings.retentionMonths) + ' mois</li></ul>' +
      '<div class="ad-row"><a class="ad-btn ad-btn--sm" href="https://app.profilr.eu/profiles" target="_blank" rel="noopener">' + U.icon('external') + 'Ouvrir dans Profilr</a>' +
      confirmBtn('del-app:' + a.id, 'app-del', a.id, 'Supprimer (droit à l’effacement)', 'Supprimer ?') + '</div></aside>';
  };

  /* ---------- Historique des versions ---------- */
  const historyDrawer = () => {
    const vs = store.state.versions.slice().reverse();
    const liveId = vs.length ? vs[0].id : null;
    const dirty = store.isDirty();
    return '<aside class="ad-drawer ad-drawer--history" aria-label="Historique des versions"><div class="ad-drawer__head"><div><h3 class="ad-ptitle">Historique</h3><p class="ad-psub">Chaque publication crée une version. Restaurer une version la remet dans le brouillon : rien ne change en ligne avant de publier.</p></div><button type="button" class="ad-iconbtn" data-act="history" aria-label="Fermer">' + U.icon('x') + '</button></div>' +
      '<ol class="ad-versions">' +
      (dirty ? '<li class="ad-version is-draft"><span class="ad-version__dot" aria-hidden="true"></span><div><strong>Brouillon en cours</strong><span>' + e(CS.data.diffSummary(store.state.published, D())) + '</span></div></li>' : '') +
      vs.map((v) => '<li class="ad-version' + (ui.viewVersion === v.id ? ' is-viewing' : '') + (v.id === liveId ? ' is-live' : '') + '"><span class="ad-version__dot" aria-hidden="true"></span><div><strong>Version ' + v.n + (v.id === liveId ? ' <span class="ad-chip ad-chip--sm ad-chip--ok">en ligne</span>' : '') + '</strong>' +
        '<span class="ad-muted">' + e(fmtWhen(v.at)) + ' · ' + e(v.author) + '</span><span>' + e(v.summary) + '</span>' +
        '<span class="ad-row">' + (ui.viewVersion === v.id
          ? '<button type="button" class="ad-btn ad-btn--sm" data-act="version-close">Quitter l’aperçu</button>'
          : '<button type="button" class="ad-btn ad-btn--sm" data-act="version-view" data-id="' + e(v.id) + '">' + U.icon('eye') + 'Aperçu</button>') +
        (ui.confirm === 'restore:' + v.id
          ? '<span class="ad-confirm">Remplacer le brouillon ? <button type="button" class="ad-btn ad-btn--sm ad-btn--primary" data-act="version-restore-yes" data-id="' + e(v.id) + '">Restaurer</button><button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="confirm-no">Annuler</button></span>'
          : '<button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="version-restore" data-id="' + e(v.id) + '">' + U.icon('history') + 'Restaurer</button>') + '</span></div></li>').join('') +
      '</ol><p class="ad-help">Les ' + store.state.versions.length + ' dernières versions sont conservées.</p></aside>';
  };

  /* ---------- Rendu principal ---------- */
  const renderStageBar = () => {
    const bar = $('#ad-stagebar');
    if (!bar) return;
    const d = D();
    const r = ui.route;
    if (ui.viewVersion) {
      const v = store.state.versions.find((x) => x.id === ui.viewVersion);
      const restore = ui.confirm === 'restore:' + ui.viewVersion
        ? '<span class="ad-confirm">Remplacer le brouillon ? <button type="button" class="ad-btn ad-btn--sm ad-btn--primary" data-act="version-restore-yes" data-id="' + e(ui.viewVersion) + '">Restaurer</button><button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="confirm-no">Annuler</button></span>'
        : '<button type="button" class="ad-btn ad-btn--sm ad-btn--primary" data-act="version-restore" data-id="' + e(ui.viewVersion) + '">Restaurer cette version</button><button type="button" class="ad-btn ad-btn--sm" data-act="version-close">Quitter l’aperçu</button>';
      bar.innerHTML = '<div class="ad-stagebar__crumb ad-stagebar__crumb--version">' + U.icon('history') + '<span>Aperçu de la version ' + (v ? v.n : '') + ' · lecture seule</span></div><div class="ad-row">' + restore + '</div>';
      return;
    }
    let crumb = d.pages[0].title;
    if (r.name === 'page') crumb = (d.pages.find((p) => p.id === r.id) || {}).title || '';
    if (r.name === 'job') crumb = 'Offre · ' + ((d.jobs.find((j) => j.id === r.id) || {}).title || '');
    if (r.name === 'spontaneous') crumb = 'Candidature spontanée';
    if (r.name === 'done') crumb = 'Confirmation';
    if (r.name === 'jobs') crumb = 'Offres';
    const langs = d.settings.languages || ['fr'];
    bar.innerHTML = '<div class="ad-stagebar__crumb">' + (r.name !== 'home' ? '<button type="button" class="ad-linkbtn" data-act="pv-home">' + U.icon('back') + e(d.pages[0].title) + '</button><span aria-hidden="true">/</span>' : '') + '<span>' + e(crumb) + '</span><span class="ad-chip ad-chip--sm">Brouillon</span></div>' +
      '<div class="ad-row ad-row--nowrap">' +
      (langs.length > 1 ? '<div class="ad-seg ad-seg--icons" role="radiogroup" aria-label="Langue d’édition">' + langs.map((l) => '<label class="ad-seg__opt" title="Éditer en ' + e((CS.LANGS.find((x) => x.id === l) || { label: l }).label) + '"><input type="radio" name="edit-lang" value="' + l + '"' + (ui.lang === l ? ' checked' : '') + ' data-edit-lang><span>' + langShort(l) + '</span></label>').join('') + '</div>' : '') +
      '<div class="ad-seg ad-seg--icons" role="radiogroup" aria-label="Taille de l’aperçu">' + [['desktop', 'monitor', 'Ordinateur'], ['tablet', 'tablet', 'Tablette'], ['mobile', 'phone', 'Mobile']].map((x) =>
        '<label class="ad-seg__opt" title="' + x[2] + '"><input type="radio" name="device" value="' + x[0] + '"' + (ui.device === x[0] ? ' checked' : '') + ' data-device><span>' + U.icon(x[1]) + '<span class="ad-sr">' + x[2] + '</span></span></label>').join('') + '</div></div>';
  };

  const renderPanel = () => {
    const panel = $('#ad-panel');
    const scroll = panel.scrollTop;
    fid = 0;
    let h = '';
    if (ui.tab === 'page') h = pagePanel();
    else if (ui.tab === 'jobs') h = jobsPanel();
    else if (ui.tab === 'form') h = formPanel();
    else if (ui.tab === 'theme') h = themePanel();
    else if (ui.tab === 'settings') h = settingsPanel();
    if (trMode() && ui.tab !== 'theme') h = '<p class="ad-trbanner">' + U.icon('translate') + '<span>Mode traduction <strong>' + langShort(ui.lang) + '</strong></span><button type="button" class="ad-linkbtn" data-act="lang-default">Revenir en ' + langShort(defLang()) + '</button></p>' + h;
    panel.innerHTML = h;
    panel.scrollTop = scroll;
  };

  const renderAll = () => {
    const langs = D().settings.languages || ['fr'];
    if (!ui.lang || langs.indexOf(ui.lang) < 0) ui.lang = langs[0];
    if (!D().pages.some((p) => p.id === ui.pageId)) ui.pageId = D().pages[0].id;
    renderTop();
    renderNav();
    /* les tiroirs s'ouvrent sous la barre du haut, qui reste cliquable */
    document.documentElement.style.setProperty('--ad-top-h', $('#ad-top').offsetHeight + 'px');
    const body = $('#ad-body');
    const full = !!FULL_TABS[ui.tab];
    body.classList.toggle('is-apps', full);
    body.classList.toggle('has-history', ui.history);
    $('#ad-panel').hidden = full;
    $('#ad-stage').hidden = full;
    $('#ad-apps').hidden = !full;
    $('#ad-history').innerHTML = ui.history ? historyDrawer() : '';
    if (full) {
      $('#ad-apps').innerHTML = ui.tab === 'apps' ? appsView() + appDrawer() : statsView();
      return;
    }
    renderPanel();
    renderStageBar();
    $('#ad-frame').dataset.device = ui.device;
    renderPreview(true);
    if (ui.resetScroll) { ui.resetScroll = false; resetFrame(); }
  };

  /* ---------- Actions ---------- */
  const move = (arr, i, j) => { if (j < 0 || j >= arr.length) return; const [x] = arr.splice(i, 1); arr.splice(j, 0, x); };
  const resolveTarget = (t) => { const [scope, path] = t.split('|'); return { obj: scopeObj(scope), path, scope }; };
  const slugify = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';

  const setTab = (tab) => {
    ui.tab = tab;
    ui.confirm = null;
    ui.adding = false;
    if (tab === 'form') ui.route = { name: 'spontaneous' };
    else if (tab === 'jobs' && ui.jobId) ui.route = { name: 'job', id: ui.jobId };
    else if (tab === 'page') ui.route = pageRoute();
    else if (!FULL_TABS[tab]) ui.route = { name: 'home' };
    ui.resetScroll = true;
    renderAll();
    if (tab === 'jobs' && !ui.jobId) {
      const d = D();
      const pg = d.pages.find((p) => p.blocks.some((b) => b.type === 'jobs' && !b.hidden));
      if (pg) {
        ui.route = pg === d.pages[0] ? { name: 'home' } : { name: 'page', id: pg.id };
        renderPreview(true);
        const jb = pg.blocks.find((b) => b.type === 'jobs' && !b.hidden);
        requestAnimationFrame(() => scrollPreviewTo(jb.id));
      }
    }
  };

  const actions = {
    'publish'() {
      const scheduled = D().jobs.filter((j) => CS.site.isScheduled(j)).length;
      store.publish();
      ui.viewVersion = null;
      CS.toast('Site publié (version ' + store.state.versions[store.state.versions.length - 1].n + ').' + (scheduled ? ' ' + scheduled + ' offre' + (scheduled > 1 ? 's' : '') + ' programmée' + (scheduled > 1 ? 's' : '') + ' apparaîtr' + (scheduled > 1 ? 'ont' : 'a') + ' à la date prévue.' : ''));
    },
    'discard'() { ui.confirm = 'discard'; renderTop(); },
    'discard-yes'() { ui.confirm = null; ui.blockId = null; ui.jobId = null; store.discard(); CS.toast('Modifications annulées : retour à la version en ligne.'); },
    'confirm-no'() { ui.confirm = null; renderAll(); },
    'open-public'(el, ev) { ev.preventDefault(); location.hash = 'site'; },
    'pv-home'() { preview.go({ name: 'home' }); },
    'lang-default'() { ui.lang = defLang(); renderAll(); },

    'history'() { ui.history = !ui.history; ui.confirm = null; if (!ui.history) ui.viewVersion = null; renderAll(); },
    'version-view'(el) { ui.viewVersion = el.dataset.id; ui.confirm = null; if (FULL_TABS[ui.tab]) ui.tab = 'page'; ui.route = { name: 'home' }; ui.resetScroll = true; renderAll(); },
    'version-close'() { ui.viewVersion = null; ui.confirm = null; ui.route = pageRoute(); renderAll(); },
    'version-restore'(el) { ui.confirm = 'restore:' + el.dataset.id; renderAll(); },
    'version-restore-yes'(el) {
      ui.confirm = null; ui.viewVersion = null; ui.blockId = null; ui.jobId = null;
      const v = store.restore(el.dataset.id);
      if (!D().pages.some((p) => p.id === ui.pageId)) ui.pageId = D().pages[0].id;
      ui.route = pageRoute();
      renderAll();
      CS.toast('Version ' + (v ? v.n : '') + ' restaurée dans le brouillon. Publiez pour la remettre en ligne.');
    },

    'page-select'(el) { ui.pageId = el.dataset.id; ui.blockId = null; ui.adding = false; ui.confirm = null; ui.route = pageRoute(); ui.resetScroll = true; renderAll(); },
    'page-add'() {
      const d = D();
      const id = U.uid('p_');
      const title = 'Nouvelle page ' + d.pages.length;
      store.mutate(() => {
        d.pages.push({ id, title, slug: slugify(title), inMenu: true, blocks: [
          { id: U.uid('b_'), type: 'hero', hidden: false, bg: 'surface', menu: '', props: Object.assign(U.clone(B().hero.defaults), { layout: 'centered', eyebrow: '', title: title, subtitle: 'Présentez cette page en une phrase.', secondaryLabel: '' }) },
          { id: U.uid('b_'), type: 'text', hidden: false, bg: 'default', menu: '', props: U.clone(B().text.defaults) },
        ] });
        U.ensureIds(d.pages);
        ui.pageId = id; ui.blockId = null; ui.pageSettings = true; ui.route = { name: 'page', id };
      }, { structural: true });
      const t = $('#ad-panel input[data-bind="page|title"]');
      if (t) { t.focus(); t.select(); }
    },
    'page-del'(el) { ui.confirm = 'del-page:' + el.dataset.id; renderPanel(); },
    'page-del-yes'(el) {
      ui.confirm = null;
      ui.pageId = D().pages[0].id; ui.route = { name: 'home' }; ui.blockId = null;
      store.mutate((s) => { s.draft.pages = s.draft.pages.filter((p) => p.id !== el.dataset.id); const tr = s.draft.i18n || {}; Object.keys(tr).forEach((l) => delete tr[l]['p:' + el.dataset.id]); }, { structural: true });
      CS.toast('Page supprimée.');
    },

    'edit-block'(el) { ui.blockId = el.dataset.id; ui.adding = false; ui.confirm = null; ui.route = pageRoute(); renderAll(); scrollPreviewTo(ui.blockId); },
    'back-blocks'() { ui.blockId = null; ui.confirm = null; renderAll(); },
    'block-up'(el) { store.mutate(() => { const a = blocks(); const i = a.findIndex((b) => b.id === el.dataset.id); move(a, i, i - 1); }, { structural: true }); },
    'block-down'(el) { store.mutate(() => { const a = blocks(); const i = a.findIndex((b) => b.id === el.dataset.id); move(a, i, i + 1); }, { structural: true }); },
    'block-hide'(el) { store.mutate(() => { const b = blocks().find((x) => x.id === el.dataset.id); b.hidden = !b.hidden; }, { structural: true }); },
    'block-dup'(el) {
      let nb;
      store.mutate(() => { const a = blocks(); const i = a.findIndex((b) => b.id === el.dataset.id); nb = U.clone(a[i]); nb.id = U.uid('b_'); nb.menu = ''; Object.keys(nb.props).forEach((k) => Array.isArray(nb.props[k]) && nb.props[k].forEach((it) => it && typeof it === 'object' && (it._id = U.uid('i')))); a.splice(i + 1, 0, nb); ui.blockId = nb.id; }, { structural: true });
      requestAnimationFrame(() => scrollPreviewTo(nb.id));
      CS.toast('Bloc dupliqué.');
    },
    'block-del'(el) { ui.confirm = 'del-block:' + el.dataset.id; renderPanel(); },
    'block-del-yes'(el) { ui.confirm = null; ui.blockId = null; store.mutate(() => { const a = blocks(); a.splice(a.findIndex((b) => b.id === el.dataset.id), 1); }, { structural: true }); CS.toast('Bloc supprimé.'); },
    'add-open'() { ui.adding = true; renderPanel(); const lib = $('.ad-library'); lib && lib.scrollIntoView({ block: 'nearest' }); },
    'add-close'() { ui.adding = false; renderPanel(); },
    'add-block'(el) {
      const def = B()[el.dataset.type];
      const nb = { id: U.uid('b_'), type: el.dataset.type, hidden: false, bg: def.defaultBg || 'default', menu: '', props: U.clone(def.defaults) };
      U.ensureIds([{ blocks: [nb] }]);
      store.mutate(() => {
        const a = blocks();
        const i = ui.blockId ? a.findIndex((b) => b.id === ui.blockId) : -1;
        if (i >= 0) a.splice(i + 1, 0, nb); else a.push(nb);
        ui.blockId = nb.id;
        ui.adding = false;
      }, { structural: true });
      requestAnimationFrame(() => scrollPreviewTo(nb.id));
    },

    'item-add'(el) {
      const def = B()[scopeObj('block').type];
      const f = def.fields.find((x) => x.key === el.dataset.field);
      store.mutate(() => {
        const b = scopeObj('block');
        b.props[f.key] = b.props[f.key] || [];
        const it = Object.assign(U.clone(f.add || {}), { _id: U.uid('i') });
        b.props[f.key].push(it);
        ui.open[ui.blockId + ':' + it._id] = true;
      }, { structural: true });
    },
    'item-del'(el, ev) { ev.preventDefault(); store.mutate(() => U.getPath(scopeObj('block'), el.dataset.list).splice(+el.dataset.i, 1), { structural: true }); },
    'item-up'(el, ev) { ev.preventDefault(); store.mutate(() => move(U.getPath(scopeObj('block'), el.dataset.list), +el.dataset.i, +el.dataset.i - 1), { structural: true }); },
    'item-down'(el, ev) { ev.preventDefault(); store.mutate(() => move(U.getPath(scopeObj('block'), el.dataset.list), +el.dataset.i, +el.dataset.i + 1), { structural: true }); },
    'ph'(el) {
      const { obj, path } = resolveTarget(el.dataset.target);
      const cur = U.getPath(obj, path);
      const n = U.isPlaceholder(cur) && cur ? (parseInt(cur.split(':')[1], 10) + 1) % 6 : 0;
      store.mutate(() => U.setPath(obj, path, 'ph:' + n), { structural: true });
    },
    'img-clear'(el) { const { obj, path } = resolveTarget(el.dataset.target); store.mutate(() => U.setPath(obj, path, ''), { structural: true }); },

    'job-new'() {
      const j = { id: U.uid('j_'), title: 'Nouvelle offre', department: '', location: '', contract: 'CDI', remote: 'hybrid', experience: '1 à 3 ans', salaryMin: 0, salaryMax: 0, salaryVisible: false, status: 'draft', publishedAt: '', publishAt: '', closesAt: '', projectId: '', multipost: false, jobboards: CS.data.JOBBOARDS.filter((x) => x.connected).map((x) => x.id), diffusedAt: '', extraFile: 'default', extraFileLabel: '', summary: '', description: '## Vos missions\n- \n\n## Votre profil\n- ' };
      store.mutate((s) => { s.draft.jobs.unshift(j); ui.jobId = j.id; ui.route = { name: 'job', id: j.id }; ui.resetScroll = true; }, { structural: true });
      const t = $('#ad-panel input[data-bind="job|title"]');
      if (t) { t.focus(); t.select(); }
    },
    'job-edit'(el) { ui.jobId = el.dataset.id; ui.confirm = null; ui.route = { name: 'job', id: ui.jobId }; ui.resetScroll = true; renderAll(); },
    'stats-job'(el) { ui.jobId = el.dataset.id; setTab('jobs'); },
    'back-jobs'() { ui.jobId = null; ui.confirm = null; setTab('jobs'); },
    'job-filter'(el) { ui.jobFilter = el.dataset.f; renderPanel(); },
    'job-unschedule'() { store.mutate(() => { scopeObj('job').publishAt = ''; }, { structural: true }); },
    'job-dup'(el) {
      store.mutate((s) => { const i = s.draft.jobs.findIndex((j) => j.id === el.dataset.id); const nj = U.clone(s.draft.jobs[i]); nj.id = U.uid('j_'); nj.title += ' (copie)'; nj.status = 'draft'; nj.publishedAt = ''; nj.diffusedAt = ''; s.draft.jobs.splice(i + 1, 0, nj); ui.jobId = nj.id; ui.route = { name: 'job', id: nj.id }; ui.resetScroll = true; }, { structural: true });
      CS.toast('Offre dupliquée en brouillon.');
    },
    'job-del'(el) { ui.confirm = 'del-job:' + el.dataset.id; renderPanel(); },
    'job-del-yes'(el) { ui.confirm = null; ui.jobId = null; store.mutate((s) => s.draft.jobs.splice(s.draft.jobs.findIndex((j) => j.id === el.dataset.id), 1), { structural: true }); setTab('jobs'); CS.toast('Offre supprimée. Elle disparaîtra du site et des jobboards à la prochaine publication.'); },

    'q-add'() {
      store.mutate((s) => { const q = { id: U.uid('q_'), label: 'Nouvelle question', type: 'text', options: [], required: false, knockout: '' }; s.draft.form.questions.push(q); ui.open['form:' + q.id] = true; }, { structural: true });
    },
    'q-del'(el, ev) { ev.preventDefault(); store.mutate((s) => s.draft.form.questions.splice(+el.dataset.i, 1), { structural: true }); },
    'q-up'(el, ev) { ev.preventDefault(); store.mutate((s) => move(s.draft.form.questions, +el.dataset.i, +el.dataset.i - 1), { structural: true }); },
    'q-down'(el, ev) { ev.preventDefault(); store.mutate((s) => move(s.draft.form.questions, +el.dataset.i, +el.dataset.i + 1), { structural: true }); },

    'preset'(el) {
      const p = CS.data.PRESETS.find((x) => x.id === el.dataset.id);
      store.mutate((s) => { const t = s.draft.theme; t.colors = U.clone(p.theme.colors); t.fonts = U.clone(p.theme.fonts); t.radius = p.theme.radius; t.buttons = p.theme.buttons; }, { structural: true });
    },
    'theme-reset'() { store.mutate((s) => { s.draft.theme = U.clone(CS.data.PROFILR_THEME); }, { structural: true }); CS.toast('Charte Profilr rétablie.'); },
    'logo-profilr'() { store.mutate((s) => { s.draft.theme.logo = 'profilr'; }, { structural: true }); },
    'logo-text'() { store.mutate((s) => { s.draft.theme.logo = ''; }, { structural: true }); },

    'copy-json'() {
      const json = JSON.stringify(D(), null, 2);
      const ok = () => CS.toast('Configuration copiée (' + Math.round(json.length / 1024) + ' Ko).');
      try { navigator.clipboard.writeText(json).then(ok, () => CS.toast('La copie a été refusée par le navigateur.', 'warn')); } catch (err) { CS.toast('La copie a été refusée par le navigateur.', 'warn'); }
    },
    'reset'() { ui.confirm = 'reset'; renderPanel(); },
    'reset-yes'() { ui.confirm = null; ui.blockId = null; ui.jobId = null; ui.pageId = 'home'; ui.viewVersion = null; ui.route = { name: 'home' }; ui.lang = null; store.reset(); CS.toast('Démo réinitialisée.'); },

    'app-open'(el) { ui.appId = el.dataset.id; ui.confirm = null; renderAll(); },
    'app-close'() { ui.appId = null; renderAll(); },
    'app-del'(el) { ui.confirm = 'del-app:' + el.dataset.id; renderAll(); },
    'app-del-yes'(el) { ui.confirm = null; ui.appId = null; store.mutate((s) => s.applications.splice(s.applications.findIndex((a) => a.id === el.dataset.id), 1), { structural: true }); CS.toast('Candidature supprimée.'); },
  };

  /* ---------- Saisie dans les champs ---------- */
  const onFieldInput = (el) => {
    const parts = el.dataset.bind.split('|');
    if (parts[0] === 'tr') {
      const key = parts[1], path = parts[2];
      let v = el.value;
      if (el.dataset.kind === 'lines') v = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
      store.mutate((s) => {
        const d = s.draft;
        d.i18n = d.i18n || {};
        const L = (d.i18n[ui.lang] = d.i18n[ui.lang] || {});
        const m = (L[key] = L[key] || {});
        if (v === '' || (Array.isArray(v) && !v.length)) delete m[path]; else m[path] = v;
      }, { field: true });
      const box = el.closest('.ad-trfield');
      if (box) box.classList.toggle('is-missing', !el.value);
      return;
    }
    const [scope, path] = parts;
    const obj = scopeObj(scope);
    if (!obj) return;
    let v = el.type === 'checkbox' && el.dataset.kind !== 'arr' ? el.checked : el.value;
    const kind = el.dataset.kind;
    if (kind === 'number') v = el.value === '' ? 0 : Number(el.value);
    if (kind === 'lines') v = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
    if (kind === 'arr') {
      const arr = (U.getPath(obj, path) || []).filter((x) => x !== el.value);
      if (el.checked) arr.push(el.value);
      v = arr;
    }
    if (kind === 'color') {
      if (!U.isHex(v)) return;
      $$('[data-bind="' + el.dataset.bind + '"]', el.closest('.ad-color')).forEach((o) => { if (o !== el) o.value = v.length === 4 ? '#' + v.slice(1).split('').map((c) => c + c).join('') : v; });
      v = v.toUpperCase();
    }
    if (scope === 'page' && path === 'title' && obj.slug === slugify(obj.title)) obj.slug = slugify(v);
    if (scope === 'page' && path === 'slug') v = slugify(v);
    const structural = el.hasAttribute('data-structural');
    store.mutate(() => U.setPath(obj, path, v), { structural, field: true });
    if (el.dataset.counter) { const c = $('[data-counter-for="' + el.id + '"]'); if (c) { c.textContent = el.value.length + ' / ' + el.dataset.counter; c.classList.toggle('is-over', el.value.length > +el.dataset.counter); } }
    if (scope === 'theme' && path.indexOf('colors.') === 0) {
      const c = D().theme.colors;
      const p = $('[data-contrast]');
      if (p) { const r = U.contrast(c.text, c.background); p.innerHTML = contrastMsg(r); p.classList.toggle('is-bad', r < 4.5); }
    }
    if (path === 'logoHeight') { const o = $('[data-out="logo-h"]'); if (o) o.textContent = v + ' px'; const img = $('.ad-logoprev img'); if (img) img.style.height = v + 'px'; }
    if (scope === 'settings') {
      const s = D().settings;
      const set = (k, t) => { const o = $('[data-out="' + k + '"]'); if (o) o.textContent = t; };
      set('url', CS.site.publicUrl(Object.assign({}, s, { customDomain: '' })).replace('https://', ''));
      set('serp-url', CS.site.publicUrl(s).replace('https://', ''));
      set('serp-title', s.siteTitle);
      set('serp-desc', s.seoDescription);
    }
    if (scope === 'page' && path === 'title') { const b = $('.ad-pages__btn.is-on span'); if (b) b.textContent = el.value || '…'; }
    if (scope === 'job' && path === 'title') { const t = $('.ad-ptitle'); if (t) t.textContent = el.value || 'Nouvelle offre'; }
    if (scope === 'block' || (scope === 'form' && /\.label$/.test(path))) {
      const det = el.closest('details.ad-item');
      if (det && /\.(title|name|caption|q|value|label|city)$/.test(path)) { const t = det.querySelector('.ad-item__title'); if (t && t.firstChild) t.firstChild.textContent = el.value || '…'; }
    }
  };

  const onFile = async (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    try {
      if (el.dataset.logo !== undefined) {
        const src = await U.readImage(file, 600);
        store.mutate((s) => { s.draft.theme.logo = src; }, { structural: true });
        CS.toast('Logo importé.');
      } else if (el.dataset.image) {
        const src = await U.readImage(file, 1600);
        const { obj, path } = resolveTarget(el.dataset.image);
        store.mutate(() => U.setPath(obj, path, src), { structural: true });
      } else if (el.dataset.video) {
        if (!/^video\//.test(file.type)) throw new Error('Choisissez un fichier vidéo MP4 ou WebM.');
        const { obj, path } = resolveTarget(el.dataset.video);
        store.mutate(() => U.setPath(obj, path, URL.createObjectURL(file)), { structural: true });
      }
    } catch (err) {
      CS.toast(err.message || 'Import impossible.', 'warn');
    }
  };

  /* ---------- Glisser-déposer des blocs ---------- */
  const bindDnd = () => {
    const panel = $('#ad-panel');
    let dragId = null;
    panel.addEventListener('dragstart', (ev) => {
      const li = ev.target.closest('.ad-block');
      if (!li) return;
      dragId = li.dataset.id;
      li.classList.add('is-drag');
      ev.dataTransfer.effectAllowed = 'move';
      try { ev.dataTransfer.setData('text/plain', dragId); } catch (err) { /* certains navigateurs */ }
    });
    panel.addEventListener('dragover', (ev) => {
      const li = ev.target.closest('.ad-block');
      if (!dragId || !li) return;
      ev.preventDefault();
      $$('.ad-block', panel).forEach((x) => x.classList.remove('drop-before', 'drop-after'));
      const r = li.getBoundingClientRect();
      li.classList.add(ev.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
    });
    panel.addEventListener('dragend', () => { dragId = null; $$('.ad-block', panel).forEach((x) => x.classList.remove('is-drag', 'drop-before', 'drop-after')); });
    panel.addEventListener('drop', (ev) => {
      const li = ev.target.closest('.ad-block');
      if (!dragId || !li) return;
      ev.preventDefault();
      const after = li.classList.contains('drop-after');
      const targetId = li.dataset.id;
      const id = dragId;
      dragId = null;
      if (targetId === id) return renderPanel();
      store.mutate(() => {
        const a = blocks();
        const [x] = a.splice(a.findIndex((b) => b.id === id), 1);
        const j = a.findIndex((b) => b.id === targetId);
        a.splice(after ? j + 1 : j, 0, x);
      }, { structural: true });
    });
  };

  /* Infobulle des graphiques (survol et focus clavier) */
  const bindTips = () => {
    const host = $('#ad-apps');
    const show = (col) => {
      const tip = $('#ad-tip');
      if (!tip) return;
      if (!col) { tip.hidden = true; return; }
      tip.textContent = col.dataset.tip;
      tip.hidden = false;
      const r = col.getBoundingClientRect();
      const tr = tip.getBoundingClientRect();
      tip.style.left = Math.max(8, Math.min(window.innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2)) + 'px';
      tip.style.top = Math.max(8, r.top - tr.height - 8) + 'px';
    };
    host.addEventListener('mouseover', (ev) => show(ev.target.closest('[data-tip]')));
    host.addEventListener('focusin', (ev) => show(ev.target.closest('[data-tip]')));
    host.addEventListener('mouseleave', () => show(null));
  };

  /* ---------- Mode site public (#site) ---------- */
  const detectSource = () => {
    try {
      const p = new URLSearchParams(location.search).get('utm_source');
      if (p) return p;
      const r = document.referrer ? new URL(document.referrer).hostname : '';
      if (/linkedin/.test(r)) return 'LinkedIn';
      if (/google/.test(r)) return 'Google';
      if (/indeed/.test(r)) return 'Indeed';
      if (/welcometothejungle/.test(r)) return 'Welcome to the Jungle';
    } catch (err) { /* referrer illisible */ }
    return 'Accès direct';
  };
  const publicCtl = {
    mode: 'public',
    root: null,
    route: { name: 'home' },
    lang: null,
    source: 'Accès direct',
    visited: false,
    getData: () => store.state.published || D(),
    hash() {
      const r = this.route;
      const def = CS.site.defaultLang(this.getData());
      const l = this.lang && this.lang !== def ? '-' + this.lang : '';
      return 'site' + l + (r.name === 'job' ? '-offre-' + r.id : r.name === 'page' ? '-page-' + r.id : r.name === 'spontaneous' ? '-candidature' : r.name === 'done' ? '-merci' : '');
    },
    go(route, after) {
      publicCtl.route = route;
      if (location.hash.slice(1) !== publicCtl.hash()) history.replaceState(null, '', '#' + publicCtl.hash());
      CS.site.render(publicCtl);
      if (after) requestAnimationFrame(after); else window.scrollTo(0, 0);
    },
    setLang(l) { publicCtl.lang = l; if (publicCtl.visited) store.track('langs', l); publicCtl.go(publicCtl.route); },
    track(field, key) { store.track(field, key); },
    countVisit() {
      if (publicCtl.visited) return;
      publicCtl.visited = true;
      store.track('visits');
      store.track('sources', publicCtl.source);
      store.track('langs', publicCtl.lang || CS.site.defaultLang(publicCtl.getData()));
    },
    onConsent() { publicCtl.countVisit(); },
    onApply(app) {
      store.mutate((s) => s.applications.unshift(app), { structural: false });
      store.track('applies');
      store.track('appSources', app.source);
    },
  };
  const routeFromHash = () => {
    let h = location.hash.slice(1);
    if (h.indexOf('site') !== 0) return null;
    h = h.slice(4);
    let lang = null;
    const m0 = h.match(/^-([a-z]{2})(?=-|$)/);
    if (m0 && CS.LANGS.some((l) => l.id === m0[1])) { lang = m0[1]; h = h.slice(3); }
    let r = { name: 'home' };
    let m = h.match(/^-offre-(.+)$/);
    if (m) r = { name: 'job', id: m[1] };
    else if ((m = h.match(/^-page-(.+)$/))) r = { name: 'page', id: m[1] };
    else if (h === '-candidature') r = { name: 'spontaneous' };
    return { route: r, lang };
  };
  const applyHash = () => {
    const r = routeFromHash();
    const pub = $('#public');
    const app = $('#app');
    if (r) {
      app.hidden = true;
      pub.hidden = false;
      publicCtl.route = r.route;
      publicCtl.lang = r.lang || CS.site.defaultLang(publicCtl.getData());
      publicCtl.source = detectSource();
      CS.site.render(publicCtl);
      if (publicCtl.getData().settings.analytics && CS.site.getConsent() === 'yes') publicCtl.countVisit();
      window.scrollTo(0, 0);
    } else {
      pub.hidden = true;
      app.hidden = false;
      document.title = 'Site carrière · Profilr';
      const ld = document.getElementById('cs-jobposting');
      if (ld) ld.remove();
      renderAll();
    }
  };

  /* ---------- Initialisation ---------- */
  CS.admin = {
    init() {
      store.load();
      preview.root = $('#preview');
      publicCtl.root = $('#public-site');

      store.subscribe((opts) => {
        if (!$('#public').hidden) return;
        if (opts.structural) renderAll();
        else { renderTop(); renderPreview(); }
      });

      const app = $('#app');
      app.addEventListener('click', (ev) => {
        const tab = ev.target.closest('[data-tab]');
        if (tab) { ui.viewVersion = null; return setTab(tab.dataset.tab); }
        const a = ev.target.closest('[data-act]');
        if (a && actions[a.dataset.act] && !a.disabled) actions[a.dataset.act](a, ev);
      });
      const isChangeOnly = (el) => el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'datetime-local' || el.type === 'date';
      app.addEventListener('input', (ev) => {
        const el = ev.target;
        if (el.dataset.bind && !isChangeOnly(el)) onFieldInput(el);
      });
      app.addEventListener('change', (ev) => {
        const el = ev.target;
        if (el.type === 'file') return onFile(el);
        if (el.dataset.bind && isChangeOnly(el)) onFieldInput(el);
        if (el.dataset.device !== undefined) { ui.device = el.value; $('#ad-frame').dataset.device = ui.device; }
        if (el.dataset.editLang !== undefined) { ui.lang = el.value; ui.confirm = null; renderAll(); }
        if (el.dataset.statsDays !== undefined) { ui.statsDays = +el.value; renderAll(); }
        if (el.dataset.langToggle !== undefined) {
          store.mutate((s) => { const L = s.draft.settings.languages || ['fr']; s.draft.settings.languages = el.checked ? CS.LANGS.map((l) => l.id).filter((id) => L.indexOf(id) >= 0 || id === el.value) : L.filter((x) => x !== el.value); }, { structural: true });
        }
        if (el.dataset.moveBlock && el.value) {
          const target = el.value;
          const title = D().pages.find((p) => p.id === target).title;
          store.mutate((s) => { const a = blocks(); const i = a.findIndex((b) => b.id === el.dataset.moveBlock); const [x] = a.splice(i, 1); s.draft.pages.find((p) => p.id === target).blocks.push(x); ui.blockId = null; }, { structural: true });
          CS.toast('Bloc déplacé en bas de la page « ' + title + ' ».');
        }
        if (el.dataset.appfilter) { ui[el.dataset.appfilter === 'job' ? 'appJob' : 'appStatus'] = el.value; renderAll(); }
        if (el.dataset.appstatus) { store.mutate((s) => { const x = s.applications.find((y) => y.id === el.dataset.appstatus); if (x) x.status = el.value; }, { structural: true }); }
      });
      app.addEventListener('toggle', (ev) => {
        const d = ev.target;
        if (!d.dataset || !d.dataset.openKey) return;
        if (d.dataset.openKey === 'pageset') ui.pageSettings = d.open; else ui.open[d.dataset.openKey] = d.open;
      }, true);
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && !$('#app').hidden) {
          if (ui.confirm) { ui.confirm = null; renderAll(); }
          else if (ui.history) { ui.history = false; ui.viewVersion = null; renderAll(); }
          else if (ui.tab === 'apps' && ui.appId) { ui.appId = null; renderAll(); }
          else if (ui.adding) { ui.adding = false; renderPanel(); }
        }
      });
      bindDnd();
      bindTips();

      $('#public-back').addEventListener('click', (ev) => { ev.preventDefault(); history.replaceState(null, '', location.pathname + location.search); applyHash(); });
      window.addEventListener('hashchange', applyHash);
      applyHash();
    },
  };
})();
