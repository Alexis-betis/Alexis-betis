/* Éditeur du site carrière (côté équipe RH) : page à blocs, offres, formulaire, thème, candidatures, paramètres. */
window.CS = window.CS || {};

(function () {
  const U = CS.U;
  const e = U.esc;
  const store = CS.store;
  const B = () => CS.blocks.BLOCKS;
  const D = () => CS.store.state.draft;

  const ui = {
    tab: 'page',
    blockId: null,
    jobId: null,
    jobFilter: 'all',
    appId: null,
    appJob: '',
    appStatus: '',
    device: 'desktop',
    route: { name: 'home' },
    adding: false,
    open: {} /* éléments de liste dépliés, par chemin */,
    confirm: null /* action destructive en attente de confirmation */,
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- Toast ---------- */
  CS.toast = (msg, kind) => {
    const t = $('#ad-toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'ad-toast is-on' + (kind ? ' ad-toast--' + kind : '');
    clearTimeout(t._h);
    t._h = setTimeout(() => (t.className = 'ad-toast'), kind === 'warn' ? 6000 : 3200);
  };

  /* ---------- Contrôleur de l'aperçu ---------- */
  const preview = {
    mode: 'editor',
    root: null,
    get route() { return ui.route; },
    get selectedId() { return ui.tab === 'page' ? ui.blockId : null; },
    getData: () => D(),
    go(route, after) {
      ui.route = route;
      renderPreview(true);
      const fr = $('.ad-frame');
      if (fr && !after) fr.scrollTo({ top: 0, behavior: 'instant' });
      if (after) requestAnimationFrame(after);
      renderStageBar();
    },
    onSelectBlock(id) {
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

  /* ---------- Champs génériques ----------
     data-bind="scope|chemin" relie un contrôle à l'état. scope : block, job, theme, settings, form, q:<id> */
  const scopeObj = (scope) => {
    const d = D();
    if (scope === 'block') return d.pages[0].blocks.find((b) => b.id === ui.blockId);
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
      return fieldWrap(id, label, '<input class="ad-input" id="' + id + '" type="' + (o.type || 'text') + '" value="' + e(val(scope, path)) + '"' + (o.placeholder ? ' placeholder="' + e(o.placeholder) + '"' : '') + (o.list ? ' list="' + o.list + '"' : '') + bindAttr(scope, path, o.kind ? ' data-kind="' + o.kind + '"' : '') + (o.structural ? ' data-structural' : '') + '>', o.help);
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
        '<button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="ph" data-target="' + scope + '|' + path + '">' + (has ? 'Visuel d’exemple' : 'Autre exemple') + '</button>' +
        (o.optional && v ? '<button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="img-clear" data-target="' + scope + '|' + path + '">Retirer</button>' : '') +
        '</div></div>' + (!has && (v || !o.optional) ? '<p class="ad-help">Visuel d’exemple aux couleurs du thème. Importez vos photos pour le remplacer.</p>' : '') + '</div>';
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
  };

  /* Liste d'éléments éditables (chiffres, valeurs, témoignages…) */
  const listField = (scope, f, items) => {
    const base = 'props.' + f.key;
    let h = '<div class="ad-field"><div class="ad-listhead"><span class="ad-label">' + e(f.label) + ' <span class="ad-muted">(' + items.length + ')</span></span></div><div class="ad-items">';
    items.forEach((it, i) => {
      const path = base + '.' + i;
      const open = ui.open[ui.blockId + ':' + path];
      const title = it[f.itemLabel] || it.title || it.caption || 'Élément ' + (i + 1);
      h += '<details class="ad-item"' + (open ? ' open' : '') + ' data-open-key="' + e(ui.blockId + ':' + path) + '"><summary><span class="ad-item__title">' + e(U.mdText(title)) + '</span>' +
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
      case 'select': return ctrl.select(scope, path, f.label, f.options, { help: f.help });
      case 'toggle': return ctrl.toggle(scope, path, f.label, { help: f.help });
      case 'number': return ctrl.text(scope, path, f.label, { type: 'number', kind: 'number', help: f.help });
      case 'image': return ctrl.image(scope, path, f.label, { optional: f.optional });
      case 'icon': return ctrl.icon(scope, path, f.label);
      case 'video': return ctrl.video(scope, path, f.label, f.help);
      default: return ctrl.text(scope, path, f.label, { help: f.help });
    }
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
      '<a class="ad-btn" href="#site" data-act="open-public">' + U.icon('eye') + 'Voir le site publié</a>' +
      '<button type="button" class="ad-btn ad-btn--primary" data-act="publish"' + (dirty ? '' : ' disabled') + '>' + U.icon('send') + 'Publier</button></div>';
  };

  /* ---------- Navigation latérale ---------- */
  const TABS = [
    { id: 'page', label: 'Page', icon: 'layout' },
    { id: 'jobs', label: 'Offres', icon: 'briefcase' },
    { id: 'form', label: 'Formulaire', icon: 'form' },
    { id: 'theme', label: 'Thème', icon: 'palette' },
    { id: 'apps', label: 'Candidatures', icon: 'inbox' },
    { id: 'settings', label: 'Paramètres', icon: 'settings' },
  ];
  const renderNav = () => {
    const newApps = store.state.applications.filter((a) => a.status === 'Nouveau').length;
    const live = CS.site.liveJobs(D()).length;
    $('#ad-nav').innerHTML = TABS.map((t) =>
      '<button type="button" class="ad-nav__btn' + (ui.tab === t.id ? ' is-on' : '') + '" data-tab="' + t.id + '"' + (ui.tab === t.id ? ' aria-current="page"' : '') + '>' + U.icon(t.icon) + '<span>' + t.label + '</span>' +
      (t.id === 'apps' && newApps ? '<span class="ad-badge" aria-label="' + newApps + ' nouvelles">' + newApps + '</span>' : '') +
      (t.id === 'jobs' ? '<span class="ad-nav__meta">' + live + ' en ligne</span>' : '') + '</button>').join('');
  };

  /* ---------- Panneaux ---------- */
  const panelHead = (title, sub, back) =>
    '<div class="ad-phead">' + (back ? '<button type="button" class="ad-back" data-act="' + back.act + '">' + U.icon('back') + e(back.label) + '</button>' : '') +
    '<h2 class="ad-ptitle">' + e(title) + '</h2>' + (sub ? '<p class="ad-psub">' + sub + '</p>' : '') + '</div>';
  const section = (title, body, note) => '<section class="ad-sec"><h3 class="ad-sectitle">' + e(title) + '</h3>' + (note ? '<p class="ad-help ad-help--top">' + note + '</p>' : '') + body + '</section>';

  const blockSummary = (b) => {
    const p = b.props || {};
    return U.mdText(p.title || p.eyebrow || (p.items && p.items[0] && (p.items[0].title || p.items[0].q || p.items[0].value)) || '') || B()[b.type].desc;
  };

  const pagePanel = () => {
    const blocks = D().pages[0].blocks;
    if (ui.blockId) {
      const b = blocks.find((x) => x.id === ui.blockId);
      if (b) return blockPanel(b);
      ui.blockId = null;
    }
    let h = panelHead('Page d’accueil', 'Organisez les blocs comme vous le souhaitez : glissez-les pour les réordonner, cliquez pour les modifier.');
    h += '<ol class="ad-blocks" data-dnd>';
    blocks.forEach((b, i) => {
      const def = B()[b.type];
      h += '<li class="ad-block' + (b.hidden ? ' is-hidden' : '') + '" draggable="true" data-id="' + e(b.id) + '">' +
        '<span class="ad-block__grip" aria-hidden="true">' + U.icon('grip') + '</span>' +
        '<button type="button" class="ad-block__main" data-act="edit-block" data-id="' + e(b.id) + '"><span class="ad-block__icon">' + U.icon(def.icon) + '</span><span class="ad-block__txt"><strong>' + e(def.label) + (b.menu ? ' <span class="ad-chip ad-chip--sm">menu</span>' : '') + '</strong><span>' + e(blockSummary(b)) + '</span></span></button>' +
        '<span class="ad-block__tools"><button type="button" class="ad-iconbtn" data-act="block-up" data-id="' + e(b.id) + '" aria-label="Monter"' + (i === 0 ? ' disabled' : '') + '>' + U.icon('up') + '</button>' +
        '<button type="button" class="ad-iconbtn" data-act="block-down" data-id="' + e(b.id) + '" aria-label="Descendre"' + (i === blocks.length - 1 ? ' disabled' : '') + '>' + U.icon('down') + '</button>' +
        '<button type="button" class="ad-iconbtn" data-act="block-hide" data-id="' + e(b.id) + '" aria-label="' + (b.hidden ? 'Afficher' : 'Masquer') + '" title="' + (b.hidden ? 'Bloc masqué : cliquez pour l’afficher' : 'Masquer ce bloc') + '">' + U.icon(b.hidden ? 'eyeOff' : 'eye') + '</button></span></li>';
    });
    h += '</ol>';
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
    const bgs = CS.blocks.BACKGROUNDS;
    const th = D().theme.colors;
    const swatch = { default: th.background, surface: th.surface, primary: th.primary, accent: th.accent };
    const name = nid();
    h += section('Apparence',
      '<div class="ad-field"><span class="ad-label" id="' + name + '-l">Fond de la section</span><div class="ad-swatches" role="radiogroup" aria-labelledby="' + name + '-l">' +
      bgs.map((o) => '<label class="ad-swatch"><input type="radio" name="' + name + '" value="' + o.value + '"' + ((b.bg || 'default') === o.value ? ' checked' : '') + bindAttr('block', 'bg') + '><span class="ad-swatch__c" style="background:' + e(swatch[o.value]) + '"></span><span>' + e(o.label) + '</span></label>').join('') + '</div></div>' +
      ctrl.text('block', 'menu', 'Lien dans le menu du site', { placeholder: 'Ex. Nos valeurs', help: 'Laissez vide pour ne pas afficher ce bloc dans le menu.' }));
    h += '<div class="ad-pfoot"><button type="button" class="ad-btn ad-btn--sm" data-act="block-dup" data-id="' + e(b.id) + '">' + U.icon('copy') + 'Dupliquer</button>' +
      '<button type="button" class="ad-btn ad-btn--sm" data-act="block-hide" data-id="' + e(b.id) + '">' + U.icon(b.hidden ? 'eye' : 'eyeOff') + (b.hidden ? 'Afficher' : 'Masquer') + '</button>' +
      (ui.confirm === 'del-block:' + b.id
        ? '<span class="ad-confirm">Supprimer ce bloc ? <button type="button" class="ad-btn ad-btn--sm ad-btn--danger" data-act="block-del-yes" data-id="' + e(b.id) + '">Supprimer</button><button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="confirm-no">Annuler</button></span>'
        : '<button type="button" class="ad-btn ad-btn--sm ad-btn--danger-quiet" data-act="block-del" data-id="' + e(b.id) + '">' + U.icon('trash') + 'Supprimer</button>') + '</div>';
    return h;
  };

  const STATUS = { draft: ['Brouillon', 'muted'], published: ['Publiée', 'ok'], archived: ['Archivée', 'muted'] };
  const jobStatus = (j) => {
    if (j.status === 'published' && !CS.site.isLive(j)) return ['Expirée', 'warn'];
    if (j.status === 'published' && store.state.published && !(store.state.published.jobs || []).some((p) => p.id === j.id && p.status === 'published')) return ['À publier', 'warn'];
    return STATUS[j.status] || STATUS.draft;
  };

  const jobsPanel = () => {
    const d = D();
    if (ui.jobId) {
      const j = d.jobs.find((x) => x.id === ui.jobId);
      if (j) return jobPanel(j);
      ui.jobId = null;
    }
    const counts = { all: d.jobs.length, published: 0, draft: 0, archived: 0 };
    d.jobs.forEach((j) => counts[j.status]++);
    let h = panelHead('Offres', 'Rédigez vos offres comme des articles : brouillon, puis publication. Chaque offre est rattachée à un projet Profilr.');
    h += '<button type="button" class="ad-btn ad-btn--primary ad-btn--block" data-act="job-new">' + U.icon('plus') + 'Nouvelle offre</button>';
    h += '<div class="ad-tabs" role="tablist">' + [['all', 'Toutes'], ['published', 'Publiées'], ['draft', 'Brouillons'], ['archived', 'Archivées']].map((t) =>
      '<button type="button" role="tab" class="ad-tabs__btn' + (ui.jobFilter === t[0] ? ' is-on' : '') + '" aria-selected="' + (ui.jobFilter === t[0]) + '" data-act="job-filter" data-f="' + t[0] + '">' + t[1] + ' <span>' + counts[t[0]] + '</span></button>').join('') + '</div>';
    const list = d.jobs.filter((j) => ui.jobFilter === 'all' || j.status === ui.jobFilter);
    h += '<ul class="ad-joblist">' + (list.length ? list.map((j) => {
      const st = jobStatus(j);
      const n = store.state.applications.filter((a) => a.jobId === j.id).length;
      return '<li><button type="button" class="ad-jobitem" data-act="job-edit" data-id="' + e(j.id) + '"><span class="ad-jobitem__top"><strong>' + e(j.title || 'Offre sans titre') + '</strong><span class="ad-chip ad-chip--' + st[1] + '">' + st[0] + '</span></span>' +
        '<span class="ad-jobitem__meta">' + e([j.department, j.location, j.contract].filter(Boolean).join(' · ')) + '</span>' +
        '<span class="ad-jobitem__meta">' + U.icon('inbox') + n + ' candidature' + (n > 1 ? 's' : '') + (j.publishedAt ? ' · publiée ' + e(U.relDays(j.publishedAt)) : '') + '</span></button></li>';
    }).join('') : '<li class="ad-emptyline">Aucune offre dans cette catégorie.</li>') + '</ul>';
    return h;
  };

  const jobPanel = (j) => {
    const d = D();
    const depts = Array.from(new Set(d.jobs.map((x) => x.department).filter(Boolean)));
    const locs = Array.from(new Set(d.jobs.map((x) => x.location).filter(Boolean)));
    let h = panelHead(j.title || 'Nouvelle offre', '', { act: 'back-jobs', label: 'Toutes les offres' });
    h += '<datalist id="dl-dept">' + depts.map((x) => '<option value="' + e(x) + '">').join('') + '</datalist><datalist id="dl-loc">' + locs.map((x) => '<option value="' + e(x) + '">').join('') + '</datalist>';
    h += section('Publication',
      ctrl.segmented('job', 'status', 'Statut', [{ value: 'draft', label: 'Brouillon' }, { value: 'published', label: 'Publiée' }, { value: 'archived', label: 'Archivée' }], { structural: true, help: 'Une offre publiée apparaît sur le site après avoir cliqué sur « Publier » en haut à droite.' }) +
      ctrl.text('job', 'closesAt', 'Date limite (facultatif)', { type: 'date', help: 'L’offre se retire automatiquement du site après cette date.' }) +
      ctrl.select('job', 'projectId', 'Projet Profilr lié', [{ value: '', label: 'Aucun projet' }].concat(CS.data.PROJECTS.map((p) => ({ value: p.id, label: p.name }))), { help: 'Les candidatures reçues arrivent dans ce projet, au statut « Nouveau ».' }));
    h += section('L’offre',
      ctrl.text('job', 'title', 'Intitulé du poste') +
      ctrl.textarea('job', 'summary', 'Résumé en une phrase', { rows: 2, help: 'Affiché sous le titre de l’offre.' }) +
      '<div class="ad-grid2">' + ctrl.text('job', 'department', 'Équipe', { list: 'dl-dept' }) + ctrl.text('job', 'location', 'Lieu', { list: 'dl-loc' }) + '</div>' +
      '<div class="ad-grid2">' + ctrl.select('job', 'contract', 'Contrat', CS.data.CONTRACTS) + ctrl.select('job', 'remote', 'Télétravail', CS.data.REMOTE.map((r) => ({ value: r.id, label: r.label }))) + '</div>' +
      ctrl.select('job', 'experience', 'Expérience', CS.data.EXPERIENCE) +
      '<div class="ad-grid2">' + ctrl.text('job', 'salaryMin', 'Salaire min. (€ brut/an)', { type: 'number', kind: 'number' }) + ctrl.text('job', 'salaryMax', 'Salaire max.', { type: 'number', kind: 'number' }) + '</div>' +
      ctrl.toggle('job', 'salaryVisible', 'Afficher la fourchette de salaire') +
      ctrl.textarea('job', 'description', 'Description', { rows: 14, help: 'Ligne vide : nouveau paragraphe · « - » : puce · « ## » : intertitre · **gras**' }));
    const ld = JSON.stringify(CS.site.jobPostingLD(j, d), null, 2);
    h += '<details class="ad-sec ad-disclosure"><summary class="ad-sectitle">Référencement Google for Jobs</summary><p class="ad-help">Ces données structurées (schema.org JobPosting) sont ajoutées automatiquement à la page de l’offre pour qu’elle apparaisse dans les résultats emploi de Google.</p><pre class="ad-code">' + e(ld) + '</pre></details>';
    h += '<div class="ad-pfoot"><button type="button" class="ad-btn ad-btn--sm" data-act="job-dup" data-id="' + e(j.id) + '">' + U.icon('copy') + 'Dupliquer</button>' +
      (ui.confirm === 'del-job:' + j.id
        ? '<span class="ad-confirm">Supprimer cette offre ? <button type="button" class="ad-btn ad-btn--sm ad-btn--danger" data-act="job-del-yes" data-id="' + e(j.id) + '">Supprimer</button><button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="confirm-no">Annuler</button></span>'
        : '<button type="button" class="ad-btn ad-btn--sm ad-btn--danger-quiet" data-act="job-del" data-id="' + e(j.id) + '">' + U.icon('trash') + 'Supprimer</button>') + '</div>';
    return h;
  };

  const formPanel = () => {
    const f = D().form;
    const lvl = [{ value: 'required', label: 'Obligatoire' }, { value: 'optional', label: 'Facultatif' }, { value: 'off', label: 'Masqué' }];
    let h = panelHead('Formulaire de candidature', 'Le même formulaire sert pour toutes les offres et pour les candidatures spontanées.');
    h += section('Champs standards',
      '<p class="ad-locked">' + U.icon('shield') + 'Prénom, nom et e-mail sont toujours demandés.</p>' +
      ctrl.segmented('form', 'fields.cv', 'CV', lvl, { structural: true }) +
      ctrl.segmented('form', 'fields.phone', 'Téléphone', lvl) +
      ctrl.segmented('form', 'fields.linkedin', 'Profil LinkedIn', lvl) +
      ctrl.segmented('form', 'fields.coverLetter', 'Message de motivation', lvl));
    let q = '<div class="ad-items">';
    (f.questions || []).forEach((qq, i) => {
      const path = 'questions.' + i;
      const open = ui.open['form:' + path];
      const typeLabel = { text: 'Texte court', textarea: 'Texte long', select: 'Liste de choix', yesno: 'Oui / Non' }[qq.type];
      q += '<details class="ad-item"' + (open ? ' open' : '') + ' data-open-key="form:' + path + '"><summary><span class="ad-item__title">' + e(qq.label || 'Question sans titre') + '<span class="ad-muted"> · ' + typeLabel + (qq.required ? ' · obligatoire' : '') + (qq.knockout ? ' · éliminatoire' : '') + '</span></span>' +
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
      ctrl.text('form', 'autoReplySubject', 'Objet de l’e-mail d’accusé de réception', { help: 'L’e-mail est envoyé automatiquement au candidat.' }));
    return h;
  };

  const themePanel = () => {
    const t = D().theme;
    const c = t.colors;
    let h = panelHead('Thème', 'Le site reprend la charte Profilr par défaut. Remplacez le logo, les couleurs et les polices par celles de votre marque.');
    h += section('Thèmes prêts à l’emploi', '<div class="ad-presets">' + CS.data.PRESETS.map((p) => {
      const pc = p.theme.colors;
      const on = ['primary', 'accent', 'text', 'background', 'surface'].every((k) => String(pc[k]).toLowerCase() === String(c[k]).toLowerCase()) && p.theme.fonts.heading === t.fonts.heading;
      return '<button type="button" class="ad-preset' + (on ? ' is-on' : '') + '" data-act="preset" data-id="' + p.id + '" aria-pressed="' + on + '"><span class="ad-preset__sw" style="background:' + pc.background + '"><i style="background:' + pc.primary + '"></i><i style="background:' + pc.accent + '"></i><i style="background:' + pc.surface + '"></i></span><strong>' + e(p.name) + '</strong><span>' + e(p.theme.fonts.heading) + '</span></button>';
    }).join('') + '</div>');
    const logoState = t.logo === 'profilr' ? 'profilr' : t.logo ? 'custom' : 'text';
    h += section('Identité',
      ctrl.text('theme', 'companyName', 'Nom de l’entreprise') +
      '<div class="ad-field"><span class="ad-label">Logo</span><div class="ad-logoprev">' + (t.logo ? '<img src="' + e(CS.site.logoSrc(t)) + '" alt="Logo actuel" style="height:' + (Number(t.logoHeight) || 30) + 'px">' : '<span class="ad-logoprev__txt" style="font-family:' + e(CS.data.FONTS.find((f) => f.name === t.fonts.heading)?.css || 'inherit') + '">' + e(t.companyName) + '</span>') + '</div>' +
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
    h += section('Typographie',
      ctrl.select('theme', 'fonts.heading', 'Police des titres', fonts) +
      ctrl.select('theme', 'fonts.body', 'Police du texte', fonts));
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
    let h = panelHead('Paramètres', '');
    h += section('Adresse du site',
      ctrl.text('settings', 'slug', 'Sous-domaine Profilr', { help: 'Votre site est en ligne à l’adresse <strong data-out="url">' + e(CS.site.publicUrl(Object.assign({}, s, { customDomain: '' })).replace('https://', '')) + '</strong>.' }) +
      ctrl.text('settings', 'customDomain', 'Domaine personnalisé (facultatif)', { placeholder: 'carrieres.votre-entreprise.com', help: 'Créez un enregistrement CNAME vers <code>sites.profilr.eu</code> chez votre hébergeur. Le certificat HTTPS est généré automatiquement.' }));
    h += section('Référencement',
      ctrl.text('settings', 'siteTitle', 'Titre du site') +
      ctrl.textarea('settings', 'seoDescription', 'Description pour les moteurs de recherche', { rows: 3, counter: 160 }) +
      '<div class="ad-serp" aria-label="Aperçu dans Google"><span class="ad-serp__url" data-out="serp-url">' + e(CS.site.publicUrl(s).replace('https://', '')) + '</span><span class="ad-serp__title" data-out="serp-title">' + e(s.siteTitle) + '</span><span class="ad-serp__desc" data-out="serp-desc">' + e(s.seoDescription) + '</span></div>');
    h += section('Données personnelles',
      ctrl.text('settings', 'privacyUrl', 'Lien vers la politique de confidentialité', { type: 'url' }) +
      ctrl.select('settings', 'retentionMonths', 'Durée de conservation des candidatures', [{ value: '6', label: '6 mois' }, { value: '12', label: '12 mois' }, { value: '24', label: '24 mois (recommandé par la CNIL)' }, { value: '36', label: '36 mois' }], { help: 'Passé ce délai, les candidatures non retenues sont anonymisées automatiquement.' }));
    h += section('Notifications',
      ctrl.text('settings', 'notifyEmails', 'Prévenir aussi ces adresses à chaque candidature', { placeholder: 'rh@entreprise.com, manager@entreprise.com', help: 'Le recruteur responsable du projet Profilr est toujours prévenu.' }));
    h += section('Pied de page', ctrl.toggle('settings', 'showPoweredBy', 'Afficher « Site carrière propulsé par Profilr »'));
    h += section('Données du prototype',
      '<p class="ad-help">La configuration du site tient dans un seul objet JSON : thème, blocs, offres et formulaire. C’est le format à stocker côté serveur.</p>' +
      '<div class="ad-row"><button type="button" class="ad-btn ad-btn--sm" data-act="copy-json">' + U.icon('copy') + 'Copier la configuration JSON</button>' +
      (ui.confirm === 'reset'
        ? '<span class="ad-confirm">Tout réinitialiser ? <button type="button" class="ad-btn ad-btn--sm ad-btn--danger" data-act="reset-yes">Réinitialiser</button><button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="confirm-no">Annuler</button></span>'
        : '<button type="button" class="ad-btn ad-btn--sm ad-btn--danger-quiet" data-act="reset">Réinitialiser la démo</button>') + '</div>' +
      (store.storageOk ? '' : '<p class="ad-help ad-help--warn">Le stockage du navigateur est indisponible : vos modifications seront perdues au rechargement.</p>'));
    return h;
  };

  /* ---------- Candidatures (pleine largeur) ---------- */
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
    if (!list.length) {
      h += '<div class="ad-emptybox">' + U.icon('inbox') + '<p><strong>Aucune candidature' + (all.length ? ' pour ces filtres' : ' pour l’instant') + '.</strong><br>Testez le formulaire depuis l’aperçu : la candidature apparaîtra ici.</p></div></div>';
      return h;
    }
    h += '<div class="ad-tablewrap"><table class="ad-table"><thead><tr><th scope="col">Candidat</th><th scope="col">Offre</th><th scope="col">Reçue</th><th scope="col">Source</th><th scope="col">Critères</th><th scope="col">Statut</th></tr></thead><tbody>';
    list.forEach((a) => {
      h += '<tr class="' + (ui.appId === a.id ? 'is-on' : '') + '" data-app="' + e(a.id) + '"><td><button type="button" class="ad-linkbtn" data-act="app-open" data-id="' + e(a.id) + '"><strong>' + e(a.firstName + ' ' + a.lastName) + '</strong></button><span class="ad-muted">' + e(a.email) + '</span>' + (a.sample ? ' <span class="ad-chip ad-chip--sm">exemple</span>' : '') + '</td>' +
        '<td>' + e(jobName(a.jobId)) + '</td><td class="ad-nowrap">' + e(U.fmtDateTime(a.createdAt)) + '</td><td>' + e(a.source) + '</td>' +
        '<td>' + (a.knockedOut ? '<span class="ad-chip ad-chip--warn">' + U.icon('flag') + 'À vérifier</span>' : '<span class="ad-chip ad-chip--ok">' + U.icon('check') + 'OK</span>') + '</td>' +
        '<td><label class="ad-sr" for="st-' + e(a.id) + '">Statut</label><select id="st-' + e(a.id) + '" class="ad-input ad-input--sm" data-appstatus="' + e(a.id) + '">' + CS.data.APP_STATUSES.map((s) => '<option' + (a.status === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></td></tr>';
    });
    h += '</tbody></table></div></div>';
    return h;
  };

  const appDrawer = () => {
    const a = store.state.applications.find((x) => x.id === ui.appId);
    if (!a) return '';
    const d = D();
    const job = a.jobId ? d.jobs.find((j) => j.id === a.jobId) : null;
    const proj = CS.data.PROJECTS.find((p) => p.id === (a.projectId || (job && job.projectId)));
    const qs = d.form.questions || [];
    const rows = [
      ['E-mail', a.email], ['Téléphone', a.phone], ['LinkedIn', a.linkedin],
      ['CV', a.cv ? a.cv.name + ' (' + Math.max(1, Math.round(a.cv.size / 1024)) + ' Ko)' : ''],
    ].filter((r) => r[1]);
    const answers = Object.keys(a.answers || {}).filter((k) => a.answers[k]).map((k) => {
      const q = qs.find((x) => x.id === k);
      const bad = q && q.knockout && q.knockout === a.answers[k];
      return '<div><dt>' + e(q ? q.label : k) + '</dt><dd>' + e(a.answers[k]) + (bad ? ' <span class="ad-chip ad-chip--warn">' + U.icon('flag') + 'critère non rempli</span>' : '') + '</dd></div>';
    }).join('');
    return '<aside class="ad-drawer" aria-label="Détail de la candidature"><div class="ad-drawer__head"><div><h3 class="ad-ptitle">' + e(a.firstName + ' ' + a.lastName) + '</h3><p class="ad-psub">' + e(job ? job.title : 'Candidature spontanée') + ' · ' + e(U.fmtDateTime(a.createdAt)) + '</p></div><button type="button" class="ad-iconbtn" data-act="app-close" aria-label="Fermer">' + U.icon('x') + '</button></div>' +
      '<dl class="ad-dl">' + rows.map((r) => '<div><dt>' + r[0] + '</dt><dd>' + e(r[1]) + '</dd></div>').join('') + '</dl>' +
      (a.coverLetter ? '<h4 class="ad-sectitle">Motivation</h4><p class="ad-letter">' + e(a.coverLetter) + '</p>' : '') +
      (answers ? '<h4 class="ad-sectitle">Réponses</h4><dl class="ad-dl">' + answers + '</dl>' : '') +
      '<h4 class="ad-sectitle">Dans Profilr</h4><ul class="ad-checks"><li>' + U.icon('check') + 'Profil créé et dédoublonné par e-mail</li><li>' + U.icon('check') + 'Ajouté au projet « ' + e(proj ? proj.name : 'Vivier') + ' »</li><li>' + U.icon(a.talentPool ? 'check' : 'x') + (a.talentPool ? 'Accepte d’être recontacté pour d’autres offres' : 'Ne souhaite pas entrer dans le vivier') + '</li><li>' + U.icon('check') + 'Consentement RGPD enregistré · conservation ' + e(d.settings.retentionMonths) + ' mois</li></ul>' +
      '<div class="ad-row"><a class="ad-btn ad-btn--sm" href="https://app.profilr.eu/profiles" target="_blank" rel="noopener">' + U.icon('external') + 'Ouvrir dans Profilr</a>' +
      (ui.confirm === 'del-app:' + a.id
        ? '<span class="ad-confirm">Supprimer ? <button type="button" class="ad-btn ad-btn--sm ad-btn--danger" data-act="app-del-yes" data-id="' + e(a.id) + '">Supprimer</button><button type="button" class="ad-btn ad-btn--sm ad-btn--quiet" data-act="confirm-no">Annuler</button></span>'
        : '<button type="button" class="ad-btn ad-btn--sm ad-btn--danger-quiet" data-act="app-del" data-id="' + e(a.id) + '">' + U.icon('trash') + 'Supprimer (droit à l’effacement)</button>') + '</div></aside>';
  };

  /* ---------- Rendu principal ---------- */
  const renderStageBar = () => {
    const bar = $('#ad-stagebar');
    if (!bar) return;
    const d = D();
    const r = ui.route;
    let crumb = 'Accueil';
    if (r.name === 'job') crumb = 'Offre · ' + ((d.jobs.find((j) => j.id === r.id) || {}).title || '');
    if (r.name === 'spontaneous') crumb = 'Candidature spontanée';
    if (r.name === 'done') crumb = 'Confirmation';
    if (r.name === 'jobs') crumb = 'Offres';
    bar.innerHTML = '<div class="ad-stagebar__crumb">' + (r.name !== 'home' ? '<button type="button" class="ad-linkbtn" data-act="pv-home">' + U.icon('back') + 'Accueil</button><span aria-hidden="true">/</span>' : '') + '<span>' + e(crumb) + '</span><span class="ad-chip ad-chip--sm">Brouillon</span></div>' +
      '<div class="ad-seg ad-seg--icons" role="radiogroup" aria-label="Taille de l’aperçu">' + [['desktop', 'monitor', 'Ordinateur'], ['tablet', 'tablet', 'Tablette'], ['mobile', 'phone', 'Mobile']].map((x) =>
        '<label class="ad-seg__opt" title="' + x[2] + '"><input type="radio" name="device" value="' + x[0] + '"' + (ui.device === x[0] ? ' checked' : '') + ' data-device><span>' + U.icon(x[1]) + '<span class="ad-sr">' + x[2] + '</span></span></label>').join('') + '</div>';
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
    panel.innerHTML = h;
    panel.scrollTop = scroll;
  };

  const renderAll = () => {
    renderTop();
    renderNav();
    const body = $('#ad-body');
    const apps = ui.tab === 'apps';
    body.classList.toggle('is-apps', apps);
    $('#ad-panel').hidden = apps;
    $('#ad-stage').hidden = apps;
    $('#ad-apps').hidden = !apps;
    if (apps) {
      $('#ad-apps').innerHTML = appsView() + appDrawer();
      return;
    }
    renderPanel();
    renderStageBar();
    $('#ad-frame').dataset.device = ui.device;
    renderPreview(true);
    if (ui.resetScroll) { ui.resetScroll = false; const fr = $('#ad-frame'); if (fr) fr.scrollTo({ top: 0, behavior: 'instant' }); }
  };

  /* ---------- Actions ---------- */
  const blocks = () => D().pages[0].blocks;
  const move = (arr, i, j) => { if (j < 0 || j >= arr.length) return; const [x] = arr.splice(i, 1); arr.splice(j, 0, x); };
  const resolveTarget = (t) => { const [scope, path] = t.split('|'); return { obj: scopeObj(scope), path, scope }; };

  const setTab = (tab) => {
    ui.tab = tab;
    ui.confirm = null;
    ui.adding = false;
    if (tab === 'form') ui.route = { name: 'spontaneous' };
    else if (tab === 'jobs' && ui.jobId) ui.route = { name: 'job', id: ui.jobId };
    else if (tab !== 'apps') ui.route = { name: 'home' };
    renderAll();
    const fr = $('#ad-frame');
    if (fr) fr.scrollTo({ top: 0, behavior: 'instant' });
    if (tab === 'jobs' && !ui.jobId) {
      const jb = blocks().find((b) => b.type === 'jobs' && !b.hidden);
      if (jb) requestAnimationFrame(() => scrollPreviewTo(jb.id));
    }
  };

  const actions = {
    'publish'() {
      store.publish();
      CS.toast('Site publié. Les candidats voient la nouvelle version.');
    },
    'discard'() { ui.confirm = 'discard'; renderTop(); },
    'discard-yes'() { ui.confirm = null; ui.blockId = null; ui.jobId = null; store.discard(); CS.toast('Modifications annulées : retour à la version en ligne.'); },
    'confirm-no'() { ui.confirm = null; renderAll(); },
    'open-public'(el, ev) { ev.preventDefault(); location.hash = 'site'; },
    'pv-home'() { preview.go({ name: 'home' }); },

    'edit-block'(el) { ui.blockId = el.dataset.id; ui.adding = false; ui.confirm = null; ui.route = { name: 'home' }; renderAll(); scrollPreviewTo(ui.blockId); },
    'back-blocks'() { ui.blockId = null; ui.confirm = null; renderAll(); },
    'block-up'(el) { store.mutate(() => { const a = blocks(); const i = a.findIndex((b) => b.id === el.dataset.id); move(a, i, i - 1); }, { structural: true }); },
    'block-down'(el) { store.mutate(() => { const a = blocks(); const i = a.findIndex((b) => b.id === el.dataset.id); move(a, i, i + 1); }, { structural: true }); },
    'block-hide'(el) { store.mutate(() => { const b = blocks().find((x) => x.id === el.dataset.id); b.hidden = !b.hidden; }, { structural: true }); },
    'block-dup'(el) {
      let nb;
      store.mutate(() => { const a = blocks(); const i = a.findIndex((b) => b.id === el.dataset.id); nb = U.clone(a[i]); nb.id = U.uid('b_'); nb.menu = ''; a.splice(i + 1, 0, nb); ui.blockId = nb.id; }, { structural: true });
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
        b.props[f.key].push(U.clone(f.add || {}));
        ui.open[ui.blockId + ':props.' + f.key + '.' + (b.props[f.key].length - 1)] = true;
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
      const j = { id: U.uid('j_'), title: 'Nouvelle offre', department: '', location: '', contract: 'CDI', remote: 'hybrid', experience: '1 à 3 ans', salaryMin: 0, salaryMax: 0, salaryVisible: false, status: 'draft', publishedAt: '', closesAt: '', projectId: '', summary: '', description: '## Vos missions\n- \n\n## Votre profil\n- ' };
      store.mutate((s) => { s.draft.jobs.unshift(j); ui.jobId = j.id; ui.route = { name: 'job', id: j.id }; ui.resetScroll = true; }, { structural: true });
      const t = $('#ad-panel input[data-bind="job|title"]');
      if (t) { t.focus(); t.select(); }
    },
    'job-edit'(el) { ui.jobId = el.dataset.id; ui.confirm = null; ui.route = { name: 'job', id: ui.jobId }; ui.resetScroll = true; renderAll(); },
    'back-jobs'() { ui.jobId = null; ui.confirm = null; setTab('jobs'); },
    'job-filter'(el) { ui.jobFilter = el.dataset.f; renderPanel(); },
    'job-dup'(el) {
      store.mutate((s) => { const i = s.draft.jobs.findIndex((j) => j.id === el.dataset.id); const nj = U.clone(s.draft.jobs[i]); nj.id = U.uid('j_'); nj.title += ' (copie)'; nj.status = 'draft'; nj.publishedAt = ''; s.draft.jobs.splice(i + 1, 0, nj); ui.jobId = nj.id; ui.route = { name: 'job', id: nj.id }; ui.resetScroll = true; }, { structural: true });
      CS.toast('Offre dupliquée en brouillon.');
    },
    'job-del'(el) { ui.confirm = 'del-job:' + el.dataset.id; renderPanel(); },
    'job-del-yes'(el) { ui.confirm = null; ui.jobId = null; store.mutate((s) => s.draft.jobs.splice(s.draft.jobs.findIndex((j) => j.id === el.dataset.id), 1), { structural: true }); setTab('jobs'); CS.toast('Offre supprimée. Elle disparaîtra du site à la prochaine publication.'); },

    'q-add'() {
      store.mutate((s) => { s.draft.form.questions.push({ id: U.uid('q_'), label: 'Nouvelle question', type: 'text', options: [], required: false, knockout: '' }); ui.open['form:questions.' + (s.draft.form.questions.length - 1)] = true; }, { structural: true });
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
    'reset-yes'() { ui.confirm = null; ui.blockId = null; ui.jobId = null; ui.route = { name: 'home' }; store.reset(); CS.toast('Démo réinitialisée.'); },

    'app-open'(el) { ui.appId = el.dataset.id; ui.confirm = null; renderAll(); },
    'app-close'() { ui.appId = null; renderAll(); },
    'app-del'(el) { ui.confirm = 'del-app:' + el.dataset.id; renderAll(); },
    'app-del-yes'(el) { ui.confirm = null; ui.appId = null; store.mutate((s) => s.applications.splice(s.applications.findIndex((a) => a.id === el.dataset.id), 1), { structural: true }); CS.toast('Candidature supprimée.'); },
  };

  /* ---------- Saisie dans les champs ---------- */
  const onFieldInput = (el) => {
    const [scope, path] = el.dataset.bind.split('|');
    const obj = scopeObj(scope);
    if (!obj) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    const kind = el.dataset.kind;
    if (kind === 'number') v = el.value === '' ? 0 : Number(el.value);
    if (kind === 'lines') v = el.value.split('\n').map((x) => x.trim()).filter(Boolean);
    if (kind === 'color') {
      if (!U.isHex(v)) return;
      /* garde le sélecteur et le champ texte synchronisés */
      $$('[data-bind="' + el.dataset.bind + '"]', el.closest('.ad-color')).forEach((o) => { if (o !== el) o.value = v.length === 4 ? '#' + v.slice(1).split('').map((c) => c + c).join('') : v; });
      v = v.toUpperCase();
    }
    const structural = el.hasAttribute('data-structural');
    store.mutate(() => U.setPath(obj, path, v), { structural, field: true });
    /* petits retours en direct sans redessiner le panneau */
    if (el.dataset.counter) { const c = $('[data-counter-for="' + el.id + '"]'); if (c) { c.textContent = el.value.length + ' / ' + el.dataset.counter; c.classList.toggle('is-over', el.value.length > +el.dataset.counter); } }
    if (scope === 'theme' && path.indexOf('colors.') === 0) {
      const c = D().theme.colors;
      const p = $('[data-contrast]');
      if (p) { const r = U.contrast(c.text, c.background); p.innerHTML = contrastMsg(r); p.classList.toggle('is-bad', r < 4.5); }
      $$('.ad-swatch__c').forEach(() => {});
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
    if (scope === 'job' && path === 'title') { const t = $('.ad-ptitle'); if (t) t.textContent = el.value || 'Nouvelle offre'; }
    if (scope === 'block' || (scope === 'form' && /\.label$/.test(path))) {
      const det = el.closest('details.ad-item');
      if (det && /\.(title|name|caption|q|value|label)$/.test(path)) { const t = det.querySelector('.ad-item__title'); if (t && t.firstChild) t.firstChild.textContent = el.value || '…'; }
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
        let j = a.findIndex((b) => b.id === targetId);
        a.splice(after ? j + 1 : j, 0, x);
      }, { structural: true });
    });
  };

  /* ---------- Mode site public (#site) ---------- */
  const publicCtl = {
    mode: 'public',
    root: null,
    route: { name: 'home' },
    getData: () => store.state.published || D(),
    go(route, after) {
      publicCtl.route = route;
      const h = route.name === 'job' ? 'site-offre-' + route.id : route.name === 'spontaneous' ? 'site-candidature' : route.name === 'done' ? 'site-merci' : 'site';
      if (location.hash.slice(1) !== h) history.replaceState(null, '', '#' + h);
      CS.site.render(publicCtl);
      if (after) requestAnimationFrame(after); else window.scrollTo(0, 0);
    },
    onApply(app) {
      store.mutate((s) => s.applications.unshift(app), { structural: false });
    },
  };
  const routeFromHash = () => {
    const h = location.hash.slice(1);
    if (h.indexOf('site') !== 0) return null;
    let m = h.match(/^site-offre-(.+)$/);
    if (m) return { name: 'job', id: m[1] };
    if (h === 'site-candidature') return { name: 'spontaneous' };
    return { name: 'home' };
  };
  const applyHash = () => {
    const r = routeFromHash();
    const pub = $('#public');
    const app = $('#app');
    if (r) {
      app.hidden = true;
      pub.hidden = false;
      publicCtl.route = r;
      CS.site.render(publicCtl);
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
        else { renderTop(); renderPreview(); if (ui.tab === 'jobs' && ui.jobId) { /* statut de l'offre dans la liste au retour */ } }
      });

      const app = $('#app');
      app.addEventListener('click', (ev) => {
        const tab = ev.target.closest('[data-tab]');
        if (tab) return setTab(tab.dataset.tab);
        const a = ev.target.closest('[data-act]');
        if (a && actions[a.dataset.act] && !a.disabled) actions[a.dataset.act](a, ev);
      });
      app.addEventListener('input', (ev) => {
        const el = ev.target;
        if (el.dataset.bind && el.type !== 'radio' && el.type !== 'checkbox' && el.tagName !== 'SELECT') onFieldInput(el);
      });
      app.addEventListener('change', (ev) => {
        const el = ev.target;
        if (el.type === 'file') return onFile(el);
        if (el.dataset.bind && (el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT')) onFieldInput(el);
        if (el.dataset.device !== undefined) { ui.device = el.value; $('#ad-frame').dataset.device = ui.device; }
        if (el.dataset.appfilter) { ui[el.dataset.appfilter === 'job' ? 'appJob' : 'appStatus'] = el.value; renderAll(); }
        if (el.dataset.appstatus) { store.mutate((s) => { const x = s.applications.find((y) => y.id === el.dataset.appstatus); if (x) x.status = el.value; }, { structural: true }); }
      });
      /* garder en mémoire les éléments de liste dépliés */
      app.addEventListener('toggle', (ev) => {
        const d = ev.target;
        if (d.dataset && d.dataset.openKey) ui.open[d.dataset.openKey] = d.open;
      }, true);
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && !$('#app').hidden) {
          if (ui.confirm) { ui.confirm = null; renderAll(); }
          else if (ui.tab === 'apps' && ui.appId) { ui.appId = null; renderAll(); }
          else if (ui.adding) { ui.adding = false; renderPanel(); }
        }
      });
      bindDnd();

      $('#public-back').addEventListener('click', (ev) => { ev.preventDefault(); history.replaceState(null, '', location.pathname + location.search); applyHash(); });
      window.addEventListener('hashchange', applyHash);
      applyHash();
    },
  };
})();
