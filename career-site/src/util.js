/* Utilitaires partagés : échappement, identifiants, couleurs, icônes, visuels d'exemple, mini-markdown. */
window.CS = window.CS || {};

(function () {
  const U = {};

  U.esc = (v) =>
    String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  U.uid = (prefix) => (prefix || 'id') + Math.random().toString(36).slice(2, 8);
  U.clone = (o) => JSON.parse(JSON.stringify(o));

  /* Lecture et écriture d'une valeur par chemin "props.items.2.title" */
  U.getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  U.setPath = (obj, path, value) => {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) o[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  };

  /* ---------- Couleurs ---------- */
  U.hexToRgb = (hex) => {
    let h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return { r: 0, g: 0, b: 0 };
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  };
  U.isHex = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '').trim());
  U.luminance = (hex) => {
    const { r, g, b } = U.hexToRgb(hex);
    const f = (c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  U.contrast = (a, b) => {
    const la = U.luminance(a), lb = U.luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  /* Couleur de texte lisible sur un fond donné : la couleur de texte du thème ou le blanc */
  U.onColor = (bg, dark, light) => {
    dark = dark || '#0B1210';
    light = light || '#FFFFFF';
    return U.contrast(bg, dark) >= U.contrast(bg, light) ? dark : light;
  };
  U.mix = (a, b, t) => {
    const x = U.hexToRgb(a), y = U.hexToRgb(b);
    const m = (p, q) => Math.round(p + (q - p) * t).toString(16).padStart(2, '0');
    return '#' + m(x.r, y.r) + m(x.g, y.g) + m(x.b, y.b);
  };

  /* ---------- Logo ---------- */
  U.profilrLogo = (color) =>
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(CS.PROFILR_LOGO_SVG.replace(/__C__/g, color || '#043428'));

  /* ---------- Icônes (traits 24 px) ---------- */
  const P = {
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    rocket: '<path d="M5 15c-1 1-1.5 3.5-1.5 5.5 2 0 4.5-.5 5.5-1.5M14 4c3 0 6 3 6 6-2 4-6 7-9 8l-5-5c1-3 4-7 8-9z"/><circle cx="14.5" cy="9.5" r="1.5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
    home: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
    book: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5zM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/>',
    coffee: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
    euro: '<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10.5h9M4 13.5h9"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
    leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19 13 11"/>',
    sparkles: '<path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    shield: '<path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.5-4-1-7-4-7-8.5V6z"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>',
    briefcase: '<rect x="3.5" y="7" width="17" height="12.5" rx="2"/><path d="M9 7V5.5C9 4.7 9.7 4 10.5 4h3c.8 0 1.5.7 1.5 1.5V7M3.5 12.5h17"/>',
    chat: '<path d="M4 6.5C4 5.1 5.1 4 6.5 4h11C18.9 4 20 5.1 20 6.5v7c0 1.4-1.1 2.5-2.5 2.5H10l-4.5 4v-4h-.5A1 1 0 0 1 4 15z"/>',
    star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6L12 16.7l-5 2.6.9-5.6-4-4 5.6-.8z"/>',
    bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9 8.5 6H7M14.5 9 12 16"/>',
    baby: '<circle cx="12" cy="8" r="4"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/><path d="M10.5 8h.01M13.5 8h.01"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.1 9.5 6.1s-.9 1.6-2.6 3.2M6.6 6.7C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.6 4.6-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6c0-.8-.7-1.5-1.5-1.5H6c-.8 0-1.5.7-1.5 1.5v8c0 .8.7 1.5 1.5 1.5h2.5"/>',
    trash: '<path d="M4.5 7h15M9.5 7V5c0-.6.4-1 1-1h3c.6 0 1 .4 1 1v2M6.5 7l1 12.5c0 .8.7 1.5 1.5 1.5h6c.8 0 1.5-.7 1.5-1.5l1-12.5"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-4.5-4.5-9 8.5"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 15v3c0 .8.7 1.5 1.5 1.5h12c.8 0 1.5-.7 1.5-1.5v-3"/>',
    file: '<path d="M14 3.5H7c-.8 0-1.5.7-1.5 1.5v14c0 .8.7 1.5 1.5 1.5h10c.8 0 1.5-.7 1.5-1.5V8z"/><path d="M14 3.5V8h4.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    layout: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9h17M9 9v11"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.8 0-1 .8-1.7 1.8-1.7h2.2c2 0 3.7-1.6 3.7-3.6C20.5 6.6 16.7 3.5 12 3.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
    form: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>',
    inbox: '<path d="M3.5 13.5 6 5.5c.2-.6.8-1 1.4-1h9.2c.6 0 1.2.4 1.4 1l2.5 8V18c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5z"/><path d="M3.5 13.5h5l1 2h5l1-2h5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/>',
    monitor: '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>',
    tablet: '<rect x="5.5" y="3" width="13" height="18" rx="2"/><path d="M11 18h2"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    external: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 14v4.5c0 .8-.7 1.5-1.5 1.5h-10c-.8 0-1.5-.7-1.5-1.5v-10C4 7.7 4.7 7 5.5 7H10"/>',
    send: '<path d="M20.5 3.5 3.5 10l7 3 3 7z"/><path d="m10.5 13 10-9.5"/>',
    flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3"/>',
  };
  U.ICONS = P;
  U.ICON_CHOICES = ['heart', 'rocket', 'users', 'home', 'book', 'coffee', 'euro', 'globe', 'leaf', 'sparkles', 'target', 'shield', 'clock', 'calendar', 'pin', 'briefcase', 'chat', 'star', 'bike', 'baby', 'sun'];
  U.icon = (name, cls) =>
    '<svg class="' + (cls || 'i') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (P[name] || P.star) +
    '</svg>';

  /* ---------- Visuels d'exemple ----------
     Une image vaut "ph:N" tant que l'équipe n'a rien importé : on dessine alors une composition
     aux couleurs du thème (formes en trèfle, inspirées de la marque Profilr). Changer de couleurs
     change donc aussi les visuels d'exemple. */
  U.isPlaceholder = (v) => !v || /^ph:\d+$/.test(v);
  U.placeholderArt = (value, theme, ratio) => {
    const seed = parseInt(String(value || 'ph:0').split(':')[1] || '0', 10) || 0;
    const c = theme.colors;
    const W = 800, H = Math.round(800 / (ratio || 4 / 3));
    const tints = [
      [U.mix(c.primary, c.background, 0.88), c.primary, c.accent],
      [c.primary, c.accent, U.mix(c.primary, c.background, 0.35)],
      [U.mix(c.accent, c.background, 0.55), c.primary, U.mix(c.primary, c.background, 0.6)],
      [U.mix(c.primary, '#000000', 0.25), U.mix(c.accent, c.primary, 0.2), c.accent],
      [U.mix(c.primary, c.background, 0.7), c.accent, c.primary],
      [c.accent, c.primary, U.mix(c.primary, c.background, 0.75)],
    ];
    const [bg, a, b] = tints[seed % tints.length];
    /* Pétale : rectangle arrondi d'un côté + disque, comme le trèfle Profilr */
    const petal = (x, y, s, rot, fill) =>
      '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')">' +
      '<path d="M0 0h' + s + 'v' + s * 1.25 + 'a' + s / 2 + ' ' + s / 2 + ' 0 0 1 -' + s + ' 0z" fill="' + fill + '"/>' +
      '<circle cx="' + s / 2 + '" cy="0" r="' + s / 2 + '" fill="' + fill + '"/></g>';
    const r = (n) => ((Math.sin(seed * 97.13 + n * 41.7) + 1) / 2);
    let shapes = '';
    const count = 5 + (seed % 3);
    for (let i = 0; i < count; i++) {
      const s = 90 + r(i) * 150;
      const x = r(i + 10) * W - s / 2;
      const y = r(i + 20) * H - s / 3;
      shapes += petal(x.toFixed(0), y.toFixed(0), s.toFixed(0), [0, 90, 180, 270][(seed + i) % 4], i % 2 ? a : b);
    }
    /* Petit cercle de "lumière" pour donner de la profondeur */
    shapes += '<circle cx="' + (W * (0.2 + r(40) * 0.6)).toFixed(0) + '" cy="' + (H * (0.2 + r(41) * 0.5)).toFixed(0) + '" r="' + (60 + r(42) * 80).toFixed(0) + '" fill="' + U.mix(bg, '#ffffff', 0.25) + '" opacity=".55"/>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice"><rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>' + shapes + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  U.imgSrc = (value, theme, ratio) => (U.isPlaceholder(value) ? U.placeholderArt(value, theme, ratio) : value);

  /* Réduit une image importée (max 1600 px, JPEG) pour qu'elle tienne dans le stockage du prototype */
  U.readImage = (file, maxSize) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
      reader.onload = () => {
        if (file.type === 'image/svg+xml') return resolve(reader.result);
        const img = new Image();
        img.onerror = () => reject(new Error('Ce fichier n’est pas une image lisible'));
        img.onload = () => {
          const max = maxSize || 1600;
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * k);
          cv.height = Math.round(img.height * k);
          const ctx = cv.getContext('2d');
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          const png = file.type === 'image/png' && max <= 600; /* logos : on garde la transparence */
          resolve(cv.toDataURL(png ? 'image/png' : 'image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

  /* ---------- Mini-markdown pour les textes longs ----------
     ## Titre, - puce, **gras**, lignes vides = paragraphes. Tout est échappé avant. */
  U.md = (src) => {
    const inline = (t) => U.esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const lines = String(src || '').split(/\r?\n/);
    let html = '', list = false, para = [];
    const flush = () => {
      if (para.length) html += '<p>' + para.map(inline).join('<br>') + '</p>';
      para = [];
    };
    const closeList = () => {
      if (list) html += '</ul>';
      list = false;
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flush(); closeList(); continue; }
      if (/^#{2,3}\s+/.test(line)) { flush(); closeList(); html += '<h3>' + inline(line.replace(/^#{2,3}\s+/, '')) + '</h3>'; continue; }
      if (/^[-•*]\s+/.test(line)) { flush(); if (!list) { html += '<ul>'; list = true; } html += '<li>' + inline(line.replace(/^[-•*]\s+/, '')) + '</li>'; continue; }
      closeList();
      para.push(line);
    }
    flush(); closeList();
    return html;
  };
  U.mdText = (src) => String(src || '').replace(/^#{2,3}\s+/gm, '').replace(/^[-•*]\s+/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

  /* ---------- Vidéo ---------- */
  U.videoInfo = (url) => {
    const u = String(url || '').trim();
    let m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (m) return { kind: 'youtube', id: m[1], embed: 'https://www.youtube-nocookie.com/embed/' + m[1], url: u };
    m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { kind: 'vimeo', id: m[1], embed: 'https://player.vimeo.com/video/' + m[1], url: u };
    if (/^(blob:|data:video|https?:.*\.(mp4|webm|mov)(\?|$))/i.test(u)) return { kind: 'file', url: u };
    return u ? { kind: 'link', url: u } : null;
  };

  /* ---------- Dates et montants ---------- */
  U.fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  U.fmtDateTime = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };
  U.relDays = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'aujourd’hui';
    if (days === 1) return 'hier';
    if (days < 30) return 'il y a ' + days + ' jours';
    return 'le ' + U.fmtDate(iso);
  };
  U.fmtK = (n) => {
    const v = Number(n);
    if (!v) return '';
    return v >= 1000 ? (Math.round(v / 100) / 10).toString().replace('.', ',') + ' k' : String(v);
  };

  U.debounce = (fn, ms) => {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  };

  CS.U = U;
})();
