/* ---------------------------------------------------------------------------
   MaDorCARE careers form — flow engine.
   One question per screen, adaptive to the role and to prior answers.
--------------------------------------------------------------------------- */

const DRAFT_KEY = 'madorcare.application.v1';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const state = {
  answers: {},
  file: null,        // { name, size, type, data } — never persisted
  index: -1,         // -1 = welcome screen
  sending: false,
};

const el = {
  stage: document.getElementById('stage'),
  progress: document.getElementById('progressFill'),
  step: document.getElementById('stepMeta'),
  footer: document.getElementById('footer'),
};

/* ------------------------------------------------------------- question set */

function questions() {
  const list = [];
  for (const q of FLOW) {
    list.push(q);
    if (q.id === 'role') {
      const role = roleOf(state.answers);
      if (role && role.extras) list.push(...role.extras);
    }
  }
  return list.filter(q => !q.when || q.when(state.answers));
}

function titleOf(q) {
  return typeof q.titleFor === 'function' ? q.titleFor(state.answers) : q.title;
}

function optionsOf(q) {
  const raw = typeof q.optionsFor === 'function' ? q.optionsFor(state.answers) : q.options;
  return (raw || []).map(o => (typeof o === 'string' ? { value: o, label: o } : o));
}

/* ------------------------------------------------------------------ drafting */

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state.answers));
  } catch (_) { /* private mode, storage full — the form still works */ }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) state.answers = JSON.parse(raw) || {};
  } catch (_) { state.answers = {}; }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
}

function firstUnanswered() {
  const qs = questions();
  const at = qs.findIndex(q => q.required && !isAnswered(q));
  return at === -1 ? Math.max(qs.length - 1, 0) : at;
}

function isAnswered(q) {
  if (q.type === 'file') return Boolean(state.file);
  const v = state.answers[q.id];
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/* ----------------------------------------------------------------- rendering */

function render() {
  if (state.index < 0) return renderWelcome();

  const qs = questions();
  if (state.index >= qs.length) return submit();

  const q = qs[state.index];
  const total = qs.length;
  const pos = state.index + 1;

  el.progress.style.width = `${Math.round((state.index / total) * 100)}%`;
  el.step.textContent = `${pos} of ${total}`;

  const screen = node('section', 'screen');
  screen.append(
    eyebrow(q, pos, total),
    heading(titleOf(q), q.help),
  );

  const body = node('div', 'q__body');
  body.append(control(q));
  screen.append(body);

  const echo = node('p', 'echo');
  echo.id = 'echo';
  echo.hidden = true;
  screen.append(echo);

  const error = node('p', 'error');
  error.id = 'error';
  error.setAttribute('role', 'alert');
  error.hidden = true;
  screen.append(error);

  swap(screen);
  renderFooter(q);
  refreshEcho(q);

  const focusable = screen.querySelector('.field, .choice, .drop input, .drop');
  if (focusable && !isTouch()) focusable.focus({ preventScroll: true });
}

function eyebrow(q, pos, total) {
  const wrap = node('div', 'eyebrow');
  const num = node('span', 'eyebrow__num', `${pos}/${total}`);
  const label = node('span', null, q.section || '');
  wrap.append(num, label, node('span', 'eyebrow__rule'));
  return wrap;
}

function heading(title, help) {
  const frag = document.createDocumentFragment();
  frag.append(node('h1', 'q__title', title));
  if (help) frag.append(node('p', 'q__help', help));
  return frag;
}

function control(q) {
  switch (q.type) {
    case 'select':
    case 'radio':   return choiceGroup(q, false);
    case 'checkbox': return choiceGroup(q, true);
    case 'textarea': return textarea(q);
    case 'file':     return fileControl(q);
    default:         return textInput(q);
  }
}

function choiceGroup(q, multi) {
  const group = node('div', 'choices');
  group.setAttribute('role', multi ? 'group' : 'radiogroup');
  group.setAttribute('aria-label', titleOf(q));

  optionsOf(q).forEach((opt, i) => {
    const current = state.answers[q.id];
    const on = multi
      ? Array.isArray(current) && current.includes(opt.value)
      : current === opt.value;

    const btn = node('button', 'choice');
    btn.type = 'button';
    btn.dataset.value = opt.value;
    btn.setAttribute('role', multi ? 'checkbox' : 'radio');
    btn.setAttribute('aria-checked', String(on));
    if (on) btn.classList.add('is-on');

    btn.append(node('span', 'choice__key', LETTERS[i] || '•'));
    const body = node('div', 'choice__body');
    body.append(node('span', 'choice__label', opt.label));
    if (opt.note) body.append(node('span', 'choice__note', opt.note));
    btn.append(body);

    btn.addEventListener('click', () => pick(q, opt.value, multi));
    group.append(btn);
  });

  return group;
}

function pick(q, value, multi) {
  hideError();

  if (multi) {
    const current = Array.isArray(state.answers[q.id]) ? [...state.answers[q.id]] : [];
    const at = current.indexOf(value);
    if (at === -1) current.push(value); else current.splice(at, 1);
    state.answers[q.id] = current;
  } else {
    // Changing the role invalidates every role-specific answer.
    if (q.id === 'role' && state.answers.role && state.answers.role !== value) {
      dropRoleAnswers();
    }
    state.answers[q.id] = value;
  }

  saveDraft();

  const group = el.stage.querySelector('.choices');
  if (group) {
    group.querySelectorAll('.choice').forEach(b => {
      const on = multi
        ? state.answers[q.id].includes(b.dataset.value)
        : state.answers[q.id] === b.dataset.value;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  refreshEcho(q);
  updateGo(q);

  if (!multi && q.autoAdvance) {
    const delay = q.echo && q.echo(state.answers) ? 620 : 220;
    setTimeout(() => { if (!state.sending) next(); }, delay);
  }
}

function dropRoleAnswers() {
  const keep = new Set(FLOW.map(q => q.id));
  Object.keys(state.answers).forEach(k => {
    if (!keep.has(k)) delete state.answers[k];
  });
  ['credential_type', 'credential_number', 'licence_texas'].forEach(k => delete state.answers[k]);
}

function textInput(q) {
  const input = node('input', 'field');
  input.type = q.type === 'number' ? 'number' : (q.type || 'text');
  input.id = `f_${q.id}`;
  input.value = state.answers[q.id] ?? '';
  if (q.placeholder) input.placeholder = q.placeholder;
  if (q.min !== undefined) input.min = q.min;
  if (q.max !== undefined) input.max = q.max;
  if (q.type === 'email') input.autocomplete = 'email';
  if (q.type === 'tel') input.autocomplete = 'tel';
  if (q.id === 'name') input.autocomplete = 'name';
  if (q.id === 'city') input.autocomplete = 'address-level2';

  input.addEventListener('input', () => {
    state.answers[q.id] = input.value;
    hideError();
    saveDraft();
    updateGo(q);
  });
  input.addEventListener('blur', () => refreshEcho(q));

  return input;
}

function textarea(q) {
  const wrap = document.createDocumentFragment();
  const ta = node('textarea', 'field');
  ta.id = `f_${q.id}`;
  ta.value = state.answers[q.id] ?? '';
  if (q.placeholder) ta.placeholder = q.placeholder;
  if (q.maxLength) ta.maxLength = q.maxLength;

  const count = node('div', 'counter');
  const tick = () => {
    if (q.maxLength) count.textContent = `${ta.value.length} / ${q.maxLength}`;
  };

  ta.addEventListener('input', () => {
    state.answers[q.id] = ta.value;
    hideError();
    saveDraft();
    tick();
    updateGo(q);
  });

  tick();
  wrap.append(ta);
  if (q.maxLength) wrap.append(count);
  return wrap;
}

function fileControl(q) {
  const wrap = node('div', 'filewrap');

  const paint = () => {
    wrap.textContent = '';
    if (state.file) {
      const card = node('div', 'filecard');
      card.append(icon('doc'), (() => {
        const b = node('div');
        b.append(node('div', 'filecard__name', state.file.name));
        b.append(node('div', 'filecard__size', prettySize(state.file.size)));
        return b;
      })());
      const remove = node('button', 'linkbtn', 'Replace');
      remove.type = 'button';
      remove.addEventListener('click', () => { state.file = null; paint(); updateGo(q); });
      card.append(remove);
      wrap.append(card);
      return;
    }

    const label = node('label', 'drop');
    label.tabIndex = 0;
    const input = node('input');
    input.type = 'file';
    input.accept = q.accept || '';
    label.append(input, icon('upload'));
    label.append(node('div', 'drop__main', 'Choose your resume'));
    label.append(node('div', 'drop__sub', isTouch() ? 'Tap to pick a file from your phone' : 'Click to browse, or drop a file here'));

    const take = f => {
      if (!f) return;
      const max = (q.maxMB || 5) * 1024 * 1024;
      if (f.size > max) return showError(`That file is ${prettySize(f.size)}. The limit is ${q.maxMB || 5} MB.`);
      const ok = (q.accept || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (ok.length && !ok.some(ext => f.name.toLowerCase().endsWith(ext))) {
        return showError(`We accept ${ok.join(', ')} files.`);
      }
      const reader = new FileReader();
      reader.onload = () => {
        state.file = {
          name: f.name,
          size: f.size,
          type: f.type || 'application/octet-stream',
          data: String(reader.result).split(',')[1],
        };
        hideError();
        paint();
        updateGo(q);
      };
      reader.onerror = () => showError('That file could not be read. Try another one.');
      reader.readAsDataURL(f);
    };

    input.addEventListener('change', () => take(input.files[0]));
    label.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    ['dragenter', 'dragover'].forEach(ev =>
      label.addEventListener(ev, e => { e.preventDefault(); label.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(ev =>
      label.addEventListener(ev, e => { e.preventDefault(); label.classList.remove('is-over'); }));
    label.addEventListener('drop', e => take(e.dataTransfer.files[0]));

    wrap.append(label);
  };

  paint();
  return wrap;
}

/* -------------------------------------------------------------------- footer */

function renderFooter(q) {
  el.footer.textContent = '';
  const inner = node('div', 'footer__inner');

  if (state.index > 0) {
    const back = node('button', 'btn btn--back', 'Back');
    back.type = 'button';
    back.addEventListener('click', prev);
    inner.append(back);
  }

  const last = state.index === questions().length - 1;
  const go = node('button', 'btn btn--go', last ? 'Send application' : 'Next');
  go.type = 'button';
  go.id = 'goBtn';
  go.addEventListener('click', next);
  inner.append(go);

  if (!isTouch()) {
    const hint = node('div', 'hint');
    hint.innerHTML = q.type === 'textarea'
      ? 'Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to continue'
      : 'Press <kbd>Enter</kbd> to continue';
    inner.append(hint);
  }

  el.footer.append(inner);
  el.footer.hidden = false;
  updateGo(q);
}

function updateGo(q) {
  const go = document.getElementById('goBtn');
  if (go) go.disabled = Boolean(q.required) && !isAnswered(q);
}

/* ----------------------------------------------------------------- validation */

function validate(q) {
  if (!q.required && !isAnswered(q)) return null;
  if (q.required && !isAnswered(q)) return 'This one is required.';

  const v = state.answers[q.id];

  if (q.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim())) {
    return 'That email address does not look right.';
  }
  if (q.type === 'tel' && String(v).replace(/\D/g, '').length < 7) {
    return 'Please enter a phone number we can reach you on.';
  }
  if (q.type === 'number') {
    const n = Number(v);
    if (Number.isNaN(n)) return 'Please enter a number.';
    if (q.min !== undefined && n < q.min) return `Enter ${q.min} or more.`;
    if (q.max !== undefined && n > q.max) return `Enter ${q.max} or less.`;
  }
  return null;
}

/* ------------------------------------------------------------------ movement */

function next() {
  const qs = questions();
  const q = qs[state.index];
  if (!q) return;

  const problem = validate(q);
  if (problem) return showError(problem);

  hideError();
  state.index += 1;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function prev() {
  if (state.index <= 0) return;
  hideError();
  state.index -= 1;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function refreshEcho(q) {
  const box = document.getElementById('echo');
  if (!box) return;
  const line = typeof q.echo === 'function' ? q.echo(state.answers) : null;
  box.textContent = line || '';
  box.hidden = !line;
}

function showError(msg) {
  const box = document.getElementById('error');
  if (!box) return;
  box.textContent = msg;
  box.hidden = false;
}

function hideError() {
  const box = document.getElementById('error');
  if (box) box.hidden = true;
}

/* -------------------------------------------------------------------- screens */

function renderWelcome() {
  el.progress.style.width = '0%';
  el.step.textContent = `${ROLES.length} open roles`;

  const s = node('section', 'screen');
  s.append(node('p', 'hero__kicker', 'We are'));
  s.append(node('h1', 'hero__word', 'Hiring'));
  s.append(node('p', 'hero__lead',
    `${BRAND.intro} Tell us about yourself and attach your resume. It takes about four minutes, one question at a time.`));

  const list = node('ul', 'rolelist');
  ROLES.forEach(r => {
    const li = node('li');
    li.append(node('strong', null, r.label), node('span', null, r.blurb));
    list.append(li);
  });
  s.append(list);

  const meta = node('p', 'meta');
  meta.append(document.createTextNode(`${BRAND.address} · `));
  const link = node('a', null, 'madorcare.com');
  link.href = BRAND.website;
  link.rel = 'noopener';
  meta.append(link);
  s.append(meta);

  swap(s);

  const resuming = Object.keys(state.answers).length > 0;
  el.footer.textContent = '';
  const inner = node('div', 'footer__inner');
  const go = node('button', 'btn btn--go', resuming ? 'Continue your application' : 'Start your application');
  go.type = 'button';
  go.addEventListener('click', () => {
    state.index = resuming ? firstUnanswered() : 0;
    render();
  });
  inner.append(go);

  if (resuming) {
    const fresh = node('button', 'btn btn--back', 'Start over');
    fresh.type = 'button';
    fresh.addEventListener('click', () => {
      clearDraft();
      state.answers = {};
      state.file = null;
      renderWelcome();
    });
    inner.append(fresh);
  }

  el.footer.append(inner);
  el.footer.hidden = false;
}

function renderSending() {
  el.footer.hidden = true;
  const s = node('section', 'screen');
  s.append(node('p', 'hero__kicker', 'One moment'));
  s.append(node('h1', 'hero__word', 'Sending'));
  const line = node('div', 'sending');
  line.append(node('div', 'spinner'), node('span', null, 'Uploading your resume and filing your application.'));
  s.append(line);
  swap(s);
}

function renderSuccess(ref) {
  el.progress.style.width = '100%';
  el.step.textContent = 'Application received';
  el.footer.hidden = true;

  const role = roleOf(state.answers);
  const s = node('section', 'screen');
  s.append(node('p', 'hero__kicker', 'You are'));
  s.append(node('h1', 'hero__word', 'Applied'));
  s.append(node('p', 'hero__lead',
    'Our team reviews every application. If your background fits, we will reach out to arrange a first conversation.'));

  const dl = node('dl', 'receipt');
  dl.append(node('dt', null, 'Reference'));
  const ddRef = node('dd');
  ddRef.append(node('code', null, ref));
  dl.append(ddRef);
  dl.append(node('dt', null, 'Role'));
  dl.append(node('dd', null, role ? role.label : '—'));
  dl.append(node('dt', null, 'Reply goes to'));
  dl.append(node('dd', null, state.answers.email || '—'));
  s.append(dl);

  const meta = node('p', 'meta');
  meta.append(node('span', 'tagline', BRAND.tagline));
  s.append(meta);

  swap(s);
}

function renderFailure(detail) {
  el.footer.hidden = true;
  const s = node('section', 'screen');
  s.append(node('p', 'hero__kicker', 'That did not'));
  s.append(node('h1', 'hero__word', 'Send'));
  s.append(node('p', 'hero__lead',
    `Your answers are saved on this device, so nothing is lost. Try again, and if it keeps failing, email your resume to ${BRAND.email}.`));

  if (detail) {
    const d = node('p', 'meta', detail);
    s.append(d);
  }

  swap(s);

  el.footer.textContent = '';
  const inner = node('div', 'footer__inner');
  const retry = node('button', 'btn btn--go', 'Try again');
  retry.type = 'button';
  retry.addEventListener('click', submit);
  const mail = node('a', 'btn btn--back', 'Email us instead');
  mail.href = `mailto:${BRAND.email}?subject=${encodeURIComponent('Application — ' + (roleOf(state.answers)?.label || 'Careers'))}`;
  inner.append(retry, mail);
  el.footer.append(inner);
  el.footer.hidden = false;
}

/* ------------------------------------------------------------------- submitting */

async function submit() {
  if (state.sending) return;

  if (ENDPOINT.startsWith('PASTE_')) {
    return renderFailure('The form is not connected to its inbox yet. Set ENDPOINT in config.js.');
  }

  saveDraft();   // so the "nothing is lost" promise on the failure screen holds
  state.sending = true;
  renderSending();

  const role = roleOf(state.answers);
  const payload = {
    submittedAt: new Date().toISOString(),
    roleLabel: role ? role.label : '',
    answers: labelledAnswers(),
    raw: state.answers,
    resume: state.file
      ? { name: state.file.name, type: state.file.type, size: state.file.size, data: state.file.data }
      : null,
  };

  try {
    // text/plain keeps this a simple request, so the browser skips the
    // CORS preflight that Apps Script cannot answer.
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await res.text();
    let out = {};
    try { out = JSON.parse(text); } catch (_) { /* fall through to the check below */ }

    if (!res.ok || out.ok === false) {
      throw new Error(out.error || `Server replied ${res.status}.`);
    }

    state.sending = false;
    clearDraft();
    renderSuccess(out.reference || localRef());
  } catch (err) {
    state.sending = false;
    renderFailure(humanError(err));
  }
}

/* Browsers say "Failed to fetch". An applicant needs to know what to do. */
function humanError(err) {
  const raw = err && err.message ? String(err.message) : '';
  if (!navigator.onLine) return 'Your device is offline.';
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return 'We could not reach the server. Your connection may have dropped.';
  }
  return raw || null;
}

/* Human-readable pairs for the spreadsheet, in the order they were asked. */
function labelledAnswers() {
  return questions().map(q => {
    const v = q.type === 'file'
      ? (state.file ? state.file.name : '')
      : state.answers[q.id];
    return {
      id: q.id,
      question: titleOf(q),
      section: q.section || '',
      answer: Array.isArray(v) ? v.join(', ') : (v ?? ''),
    };
  });
}

function localRef() {
  return 'MDC-' + Date.now().toString(36).toUpperCase().slice(-6);
}

/* ----------------------------------------------------------------- utilities */

function node(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

function swap(screen) {
  el.stage.textContent = '';
  el.stage.append(screen);
}

function prettySize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isTouch() {
  return window.matchMedia('(hover: none)').matches;
}

function icon(kind) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (kind === 'upload') svg.classList.add('drop__icon');

  const d = kind === 'upload'
    ? ['M12 16V4', 'M7 9l5-5 5 5', 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3']
    : ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6'];

  d.forEach(path => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    svg.append(p);
  });
  return svg;
}

/* ------------------------------------------------------------------ keyboard */

document.addEventListener('keydown', e => {
  if (state.index < 0 || state.sending) return;

  const qs = questions();
  const q = qs[state.index];
  if (!q) return;

  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

  if (e.key === 'Enter') {
    if (q.type === 'textarea' && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    next();
    return;
  }

  if (typing) return;

  if (['select', 'radio', 'checkbox'].includes(q.type)) {
    const at = LETTERS.indexOf(e.key.toUpperCase());
    const opts = optionsOf(q);
    if (at >= 0 && at < opts.length) {
      e.preventDefault();
      pick(q, opts[at].value, q.type === 'checkbox');
    }
  }
});

/* ---------------------------------------------------------------------- boot */

function boot() {
  document.title = `Careers — ${BRAND.name}`;
  document.getElementById('brandLogo').src = BRAND.logo;
  document.getElementById('brandLogo').alt = `${BRAND.name} logo`;

  const root = document.documentElement.style;
  Object.entries(COLORS).forEach(([k, v]) => {
    root.setProperty(`--${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}`, v);
  });

  loadDraft();
  renderWelcome();
}

boot();
