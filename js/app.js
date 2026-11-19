/* PitStop Lava Jato — site público: agendamento + galeria + PWA */
(() => {
'use strict';
const C = window.PITSTOP;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ico = (n, cls = '') => `<svg class="ico ${cls}"><use href="#i-${n}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- datas (sempre no fuso de Pernambuco) ---------- */
const pad = (n) => String(n).padStart(2, '0');
function nowTZ() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: C.TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: +g('hour') * 60 + +g('minute') };
}
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmtD = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => { const d = parseD(s); d.setUTCDate(d.getUTCDate() + n); return fmtD(d); };
const dow = (s) => parseD(s).getUTCDay();
const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = (s) => cap(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(parseD(s)));
const prettyDate = (s) => cap(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(parseD(s)));
const monthName = (y, m) => cap(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1))));
const money = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v).replace(/ /g, ' ');

/* ---------- camada de dados (Supabase via REST, sem biblioteca) ---------- */
const DEMO = !C.SUPABASE_URL || /SEU-PROJETO/.test(C.SUPABASE_URL);
const KEY = C.SUPABASE_ANON_KEY || '';
async function rest(path, opts = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + KEY; // chaves JWT legadas
  const r = await fetch(C.SUPABASE_URL + '/rest/v1/' + path, { ...opts, headers });
  let body = null; try { body = await r.json(); } catch (_) { /* sem corpo */ }
  if (!r.ok) { const e = new Error((body && body.message) || 'HTTP ' + r.status); e.code = (body && body.message) || ''; e.status = r.status; throw e; }
  return body;
}
const demoStore = {
  all() { try { return JSON.parse(localStorage.getItem('pitstop_demo') || '[]'); } catch (_) { return []; } },
  save(a) { try { localStorage.setItem('pitstop_demo', JSON.stringify(a)); } catch (_) { /* ignore */ } }
};
const api = {
  async services() {
    if (DEMO) return C.SERVICES;
    try {
      const rows = await rest('services?select=id,vehicle,name,description,price&active=eq.true&order=sort');
      return rows.length ? rows.map((r) => ({ ...r, price: Number(r.price) })) : C.SERVICES;
    } catch (_) { return C.SERVICES; }
  },
  async availability(from, to) {
    if (DEMO) return demoStore.all().filter((b) => b.date >= from && b.date <= to).map((b) => ({ slot_date: b.date, slot_time: b.time }));
    return rest('rpc/get_availability', { method: 'POST', body: JSON.stringify({ p_from: from, p_to: to }) });
  },
  async create(p) {
    if (DEMO) {
      const all = demoStore.all();
      if (all.some((b) => b.date === p.date && b.time === p.time)) { const e = new Error('SLOT_TAKEN'); e.code = 'SLOT_TAKEN'; throw e; }
      const svc = state.services.find((s) => s.id === p.serviceId);
      const rec = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), ...p, name: p.name, price: svc.price };
      all.push(rec); demoStore.save(all);
      return { id: rec.id, price: svc.price, service_name: svc.name, status: 'pendente', hold_minutes: 120 };
    }
    return rest('rpc/create_booking', { method: 'POST', body: JSON.stringify({ p_name: p.name, p_vehicle: p.vehicle, p_service_id: p.serviceId, p_date: p.date, p_time: p.time }) });
  }
};
const ERRORS = {
  INVALID_NAME: 'Confira o seu nome: use entre 2 e 60 letras.',
  SLOT_TAKEN: 'Ops! Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.',
  SLOT_BLOCKED: 'Esse horário não está disponível. Escolha outro, por favor.',
  PAST_DATE: 'Essa data já passou. Escolha uma data a partir de hoje.',
  PAST_TIME: 'Esse horário já passou. Escolha um horário mais tarde.',
  CLOSED_DAY: 'Não abrimos aos domingos. Escolha de segunda a sábado.',
  INVALID_TIME: 'Horário inválido. Escolha um dos horários da lista.',
  TOO_FAR: 'Ainda não abrimos agenda para essa data. Escolha uma data mais próxima.',
  TOO_MANY: 'Você já tem solicitações aguardando confirmação. Fale com a gente pelo WhatsApp.',
  SERVICE_MISMATCH: 'Esse serviço não é do veículo escolhido. Selecione o serviço novamente.',
  INVALID_SERVICE: 'Serviço indisponível. Selecione outro, por favor.'
};
const errMsg = (e) => { const k = Object.keys(ERRORS).find((k) => (e.code || e.message || '').includes(k)); return k ? ERRORS[k] : null; };

/* ---------- estado ---------- */
const STEP_LABELS = ['Identificação', 'Veículo', 'Serviço', 'Data e horário', 'Revisão'];
const state = { step: 1, name: '', vehicle: null, serviceId: null, date: null, time: null, cal: null, avail: new Map(), loadingAvail: false, services: C.SERVICES.slice(), busy: false, result: null, failed: false, sumOpen: false };
const svcById = (id) => state.services.find((s) => s.id === id);
const currentSvc = () => svcById(state.serviceId);
const cleanName = () => state.name.replace(/\s+/g, ' ').trim();
const waLink = (text) => `https://wa.me/${C.WHATSAPP}` + (text ? `?text=${encodeURIComponent(text)}` : '');

/* ---------- disponibilidade ---------- */
function takenSet(date) { return state.avail.get(date) || new Set(); }
function slotState(date, time) {
  const n = nowTZ();
  if (!C.SLOTS.includes(time)) return 'invalid';
  if (date === n.date && toMin(time) <= n.minutes) return 'past';
  if (takenSet(date).has(time)) return 'taken';
  return 'free';
}
function dateState(date) {
  const n = nowTZ();
  if (date < n.date) return 'past';
  if (!C.OPEN_DAYS.includes(dow(date))) return 'closed';
  if (date > addDays(n.date, C.MAX_DAYS_AHEAD)) return 'far';
  if (state.availLoadedFor && state.availLoadedFor.has(date) && !C.SLOTS.some((t) => slotState(date, t) === 'free')) return 'full';
  return 'ok';
}
async function loadAvail(y, m) {
  const first = `${y}-${pad(m + 1)}-01`;
  const last = fmtD(new Date(Date.UTC(y, m + 1, 0)));
  const n = nowTZ();
  const from = first < n.date ? n.date : first;
  if (from > last) return;
  state.loadingAvail = true; state.availFail = false;
  try {
    const rows = await api.availability(from, last);
    for (let d = from; d <= last; d = addDays(d, 1)) state.avail.set(d, new Set());
    rows.forEach((r) => { (state.avail.get(r.slot_date) || state.avail.set(r.slot_date, new Set()).get(r.slot_date)).add(r.slot_time.slice(0, 5)); });
    state.availLoadedFor = state.availLoadedFor || new Set();
    for (let d = from; d <= last; d = addDays(d, 1)) state.availLoadedFor.add(d);
  } catch (_) { state.availFail = true; }
  state.loadingAvail = false;
}

/* ---------- validações ---------- */
function nameProblem() {
  const n = cleanName();
  if (!n) return 'Digite seu nome para continuar.';
  if (n.length < 2) return 'O nome precisa ter pelo menos 2 letras.';
  if (n.length > 60) return 'O nome está muito longo (máximo 60 letras).';
  if (!/\p{L}/u.test(n)) return 'Use letras no nome, por favor.';
  return null;
}
function problem(step) {
  if (step >= 1 && nameProblem()) return { step: 1, msg: nameProblem() };
  if (step >= 2 && !state.vehicle) return { step: 2, msg: 'Escolha se o veículo é uma moto ou um carro.' };
  if (step >= 3) {
    const s = currentSvc();
    if (!s) return { step: 3, msg: 'Escolha um serviço para continuar.' };
    if (s.vehicle !== state.vehicle) return { step: 3, msg: ERRORS.SERVICE_MISMATCH };
  }
  if (step >= 4) {
    if (!state.date) return { step: 4, msg: 'Escolha o dia do agendamento.' };
    const ds = dateState(state.date);
    if (ds === 'past') return { step: 4, msg: ERRORS.PAST_DATE };
    if (ds === 'closed') return { step: 4, msg: ERRORS.CLOSED_DAY };
    if (ds === 'far') return { step: 4, msg: ERRORS.TOO_FAR };
    if (!state.time) return { step: 4, msg: 'Escolha um horário livre.' };
    const ss = slotState(state.date, state.time);
    if (ss === 'invalid') return { step: 4, msg: ERRORS.INVALID_TIME };
    if (ss === 'past') return { step: 4, msg: ERRORS.PAST_TIME };
    if (ss === 'taken') return { step: 4, msg: ERRORS.SLOT_TAKEN };
  }
  return null;
}

/* ---------- toast ---------- */
let toastT;
function toast(msg, bad = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200);
}

/* ---------- roteamento ---------- */
function route() {
  const booking = location.hash.startsWith('#/agendar');
  $('#viewHome').hidden = booking; $('#viewBook').hidden = !booking;
  document.body.style.overflow = booking ? 'hidden' : '';
  $('#demoBanner').hidden = booking || !DEMO;
  if (booking) {
    if (state.step === 6) resetBooking();
    const hs = history.state && history.state.step;
    state.step = Math.min(hs || state.step || 1, 5) || 1;
    if (!problemFree(state.step - 1)) state.step = 1;
    history.replaceState({ step: state.step }, '', location.hash);
    render({ animate: true });
  } else { window.scrollTo(0, window.__homeY || 0); }
}
function problemFree(step) { return step < 1 || !problem(step); }
function resetBooking() { Object.assign(state, { step: 1, name: '', vehicle: null, serviceId: null, date: null, time: null, result: null, failed: false }); }
function goStep(n, dir = 'fwd') {
  state.step = n;
  history.pushState({ step: n }, '', '#/agendar');
  render({ animate: true, dir });
  $('#bookScroll').scrollTop = 0;
}
window.addEventListener('hashchange', route);
window.addEventListener('popstate', () => { if (location.hash.startsWith('#/agendar')) { const s = (history.state && history.state.step) || 1; if (s !== state.step && state.step !== 6) { state.step = s; render({ animate: true, dir: 'back' }); } } });

/* ---------- renderização das etapas ---------- */
const STEPS = {
  1: () => `<div class="step"><h2>Qual é o seu nome?</h2><p class="sub">É só isso que precisamos. Sem cadastro, sem senha.</p>
    <div class="field"><label for="nameIn">Seu nome</label>
    <input id="nameIn" class="input" type="text" inputmode="text" autocomplete="name" autocapitalize="words" maxlength="60" placeholder="Ex.: João Silva" value="${esc(state.name)}" aria-describedby="nameErr">
    <p class="err" id="nameErr" role="alert"></p></div></div>`,
  2: () => `<div class="step"><h2>Qual é o veículo?</h2><p class="sub">Assim mostramos só os serviços certos para ele.</p>
    <div class="choice-grid" role="radiogroup" aria-label="Tipo de veículo">
      ${[['moto', '🏍️', 'Moto'], ['carro', '🚗', 'Carro']].map(([v, e, l]) => `
      <button type="button" class="choice" role="radio" aria-checked="${state.vehicle === v}" data-act="vehicle" data-v="${v}">
        <span class="badge-check">${ico('check')}</span><span class="emoji" aria-hidden="true">${e}</span><b>${l}</b></button>`).join('')}
    </div><p class="err" id="stepErr" role="alert"></p></div>`,
  3: () => {
    const list = state.services.filter((s) => s.vehicle === state.vehicle);
    return `<div class="step"><h2>Escolha o serviço</h2><p class="sub">${state.vehicle === 'moto' ? 'Serviço para moto:' : 'Serviços para carro:'}</p>
    <div role="radiogroup" aria-label="Serviço">${list.map((s) => `
      <button type="button" class="svc-pick" role="radio" aria-checked="${state.serviceId === s.id}" data-act="service" data-id="${esc(s.id)}">
        <span class="badge-check">${ico('check')}</span>
        <h3>${esc(s.name)}</h3><p>${esc(s.description || '')}</p>
        <span class="price"><small>R$</small>${money(s.price).replace('R$ ', '')}</span>
      </button>`).join('')}</div><p class="err" id="stepErr" role="alert"></p></div>`;
  },
  4: () => `<div class="step"><h2>Dia e horário</h2><p class="sub">Atendemos de segunda a sábado, das 08h às 17h.</p>
    <div class="cal" id="cal"></div>
    <div class="times" id="times"></div><p class="err" id="stepErr" role="alert"></p></div>`,
  5: () => {
    const s = currentSvc();
    return `<div class="step"><h2>Confira e confirme</h2><p class="sub">Revise os dados antes de enviar.</p>
    ${reviewHTML(s)}
    <div class="notice">${ico('info')}<div><b>Isto é uma solicitação.</b> Ao tocar no botão, você envia o pedido pelo WhatsApp. O horário só fica <b>confirmado depois que o PitStop validar</b> e responder a você.</div></div>
    <div id="failBox"></div></div>`;
  }
};
function reviewHTML(s, extra = '') {
  const row = (i, l, v) => `<div class="review-row">${ico(i)}<div><span>${l}</span><b>${esc(v)}</b></div></div>`;
  return `<div class="review">
    ${row('user', 'Nome', cleanName())}
    ${row('car', 'Veículo', state.vehicle === 'moto' ? '🏍️ Moto' : '🚗 Carro')}
    ${row('drop', 'Serviço', s.name)}
    ${row('calendar', 'Data', longDate(state.date))}
    ${row('clock', 'Horário', state.time)}
    <div class="review-total"><span>Valor</span><span class="price"><small>R$</small>${money(s.price).replace('R$ ', '')}</span></div></div>${extra}`;
}

function renderCalendar() {
  const cal = $('#cal'); if (!cal) return;
  const n = nowTZ(); const { y, m } = state.cal;
  const first = new Date(Date.UTC(y, m, 1)); const lead = first.getUTCDay(); const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const minM = +n.date.slice(0, 4) * 12 + (+n.date.slice(5, 7) - 1);
  const maxD = addDays(n.date, C.MAX_DAYS_AHEAD); const maxM = +maxD.slice(0, 4) * 12 + (+maxD.slice(5, 7) - 1);
  const cur = y * 12 + m;
  let cells = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('');
  cells += '<span class="day blank"></span>'.repeat(lead);
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${pad(m + 1)}-${pad(d)}`; const st = dateState(ds);
    cells += `<button type="button" class="day${ds === n.date ? ' today' : ''}${ds === state.date ? ' sel' : ''}${st === 'full' ? ' full' : ''}" data-act="date" data-d="${ds}" ${st !== 'ok' ? 'disabled' : ''}
      aria-label="${prettyDate(ds)}${st === 'full' ? ', sem horários' : st === 'closed' ? ', fechado' : ''}" aria-pressed="${ds === state.date}">${d}</button>`;
  }
  cal.innerHTML = `<div class="cal-head"><button type="button" class="icon-btn" data-act="month" data-dir="-1" aria-label="Mês anterior" ${cur <= minM ? 'disabled' : ''}>${ico('left')}</button>
    <b>${monthName(y, m)}</b><button type="button" class="icon-btn" data-act="month" data-dir="1" aria-label="Próximo mês" ${cur >= maxM ? 'disabled' : ''}>${ico('right')}</button></div>
    <div class="cal-grid">${cells}</div>
    <div class="legend"><span class="l-sel">Selecionado</span><span>Domingo fechado</span><span>Riscado = sem vagas</span></div>`;
}
function renderTimes() {
  const box = $('#times'); if (!box) return;
  if (!state.date) { box.innerHTML = '<div class="empty">Escolha um dia no calendário para ver os horários.</div>'; return; }
  if (state.loadingAvail && !state.avail.has(state.date)) { box.innerHTML = `<h3>${prettyDate(state.date)}</h3><div class="slot-grid">${'<div class="skeleton"></div>'.repeat(8)}</div>`; return; }
  const btn = (t) => { const st = slotState(state.date, t); return `<button type="button" class="slot${state.time === t ? ' sel' : ''}" data-act="time" data-t="${t}" ${st !== 'free' ? 'disabled' : ''} aria-pressed="${state.time === t}" aria-label="${t}${st === 'taken' ? ', ocupado' : st === 'past' ? ', já passou' : ''}">${t}</button>`; };
  const am = C.SLOTS.filter((t) => toMin(t) < 720), pm = C.SLOTS.filter((t) => toMin(t) >= 780);
  box.innerHTML = `<h3>${prettyDate(state.date)}</h3>${state.availFail ? `<div class="notice err-box">${ico('info')}<div>Não consegui atualizar os horários agora. <button type="button" class="chip" data-act="retry-avail">Tentar de novo</button></div></div>` : ''}
    <div class="period">Manhã</div><div class="slot-grid">${am.map(btn).join('')}</div>
    <p class="lunch">${ico('clock')} 12:00–13:00 · intervalo de almoço</p>
    <div class="period">Tarde</div><div class="slot-grid">${pm.map(btn).join('')}</div>`;
}

function renderSummary() {
  const bar = $('#sumBar'); const s = currentSvc();
  const has = state.step > 1 && state.step < 5 && (state.name || state.vehicle);
  bar.hidden = !has; if (!has) return;
  const parts = [];
  if (state.vehicle) parts.push(`<b>${state.vehicle === 'moto' ? '🏍️ Moto' : '🚗 Carro'}</b>`);
  if (s) parts.push(`<em>${esc(s.name)}</em>`);
  if (state.date) parts.push(`<em>${state.date.slice(8)}/${state.date.slice(5, 7)}${state.time ? ' · ' + state.time : ''}</em>`);
  if (s) parts.push(`<span class="p">${money(s.price)}</span>`);
  $('#sumLine').innerHTML = parts.join('');
  const rows = [['Nome', cleanName()], ['Veículo', state.vehicle ? (state.vehicle === 'moto' ? 'Moto' : 'Carro') : '—'], ['Serviço', s ? s.name : '—'], ['Valor', s ? money(s.price) : '—'], ['Data', state.date ? longDate(state.date) : '—'], ['Horário', state.time || '—']];
  $('#sumList').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('#sumList').hidden = !state.sumOpen; $('#sumToggle').setAttribute('aria-expanded', state.sumOpen);
}

function updateNext() {
  const b = $('#nextBtn'); const s = state.step;
  $('#bookFoot').hidden = false;
  if (s === 6) { $('#bookFoot').hidden = true; return; }
  const ok = !problem(s);
  b.disabled = state.busy || !ok;
  b.setAttribute('aria-disabled', b.disabled);
  b.innerHTML = state.busy ? '<span class="spinner"></span> Reservando…' : s === 5 ? `${ico('wa')} Confirmar agendamento pelo WhatsApp` : `Continuar ${ico('right')}`;
  b.classList.toggle('is-final', s === 5);
}

function render(opts = {}) {
  const s = state.step;
  $('#stepLabel').textContent = s <= 5 ? `Etapa ${s} de 5 · ${STEP_LABELS[s - 1]}` : 'Solicitação enviada';
  $$('#progress i').forEach((i, idx) => i.classList.toggle('on', idx < Math.min(s, 5)));
  $('#progress').setAttribute('aria-valuenow', Math.min(s, 5));
  if (s === 3) { const list = state.services.filter((x) => x.vehicle === state.vehicle); if (!state.serviceId && list.length === 1) state.serviceId = list[0].id; }
  const body = $('#stepBody');
  body.className = 'step-body' + (opts.animate ? ' enter-' + (opts.dir || 'fwd') : '');
  if (s === 6) body.innerHTML = doneHTML(); else body.innerHTML = STEPS[s]();
  if (s === 4) {
    if (!state.cal) { const n = nowTZ(); state.cal = { y: +n.date.slice(0, 4), m: +n.date.slice(5, 7) - 1 }; }
    if (state.date && dateState(state.date) !== 'ok' && dateState(state.date) !== 'full') { state.date = null; state.time = null; }
    renderCalendar(); renderTimes();
    if (opts.animate || opts.refresh) refreshAvail();
  }
  if (s === 1 && opts.animate) { const i = $('#nameIn'); if (i && !state.name) setTimeout(() => i.focus({ preventScroll: true }), 380); }
  renderSummary(); updateNext();
}
async function refreshAvail() {
  if (state.step !== 4 || !state.cal) return;
  await loadAvail(state.cal.y, state.cal.m);
  if (state.step !== 4) return;
  if (state.time && state.date && slotState(state.date, state.time) !== 'free') { state.time = null; toast('Esse horário acabou de ser ocupado. Escolha outro.', true); }
  if (state.date && dateState(state.date) === 'full') { state.time = null; }
  renderCalendar(); renderTimes(); updateNext(); renderSummary();
}

function doneHTML() {
  const s = currentSvc(); const r = state.result || {};
  const hold = r.hold_minutes ? ` Reservamos o horário por ${r.hold_minutes >= 60 ? Math.round(r.hold_minutes / 60) + ' h' : r.hold_minutes + ' min'} enquanto aguardamos a validação.` : '';
  return `<div class="step done"><div class="big-check">${ico('check')}</div>
    <h2>Solicitação enviada!</h2>
    ${r.id ? `<span class="code">Pedido #${esc(String(r.id).slice(0, 8).toUpperCase())}</span>` : ''}
    <p class="sub" style="margin:0">Falta só enviar a mensagem no WhatsApp (se ela não abriu, toque no botão abaixo).</p>
    ${reviewHTML(s)}
    <div class="notice">${ico('info')}<div><b>Ainda não está confirmado.</b> O horário só é garantido quando o PitStop validar o seu pedido e responder pelo WhatsApp.${hold}</div></div>
    <a class="btn btn-primary" id="openWa" href="${esc(waLink(buildMessage()))}" target="_blank" rel="noopener">${ico('wa')} Abrir WhatsApp</a>
    <button class="btn btn-ghost" type="button" data-act="home">Voltar ao início</button>
    <button class="btn btn-ghost" type="button" data-act="again">Novo agendamento</button></div>`;
}

/* ---------- mensagem do WhatsApp ---------- */
function buildMessage() {
  const s = currentSvc();
  const nome = cleanName().replace(/[*_~`]/g, '');
  return `Olá! Tudo bem? 👋

Gostaria de solicitar um agendamento no *PitStop Lava Jato*! 🚗✨

📋 *Detalhes do agendamento:*

👤 Nome: ${nome}
🚘 Veículo: ${state.vehicle === 'moto' ? 'Moto' : 'Carro'}
🧼 Serviço: ${s.name}
💰 Valor: ${money(s.price)}
📅 Data: ${longDate(state.date)}
⏰ Horário: ${state.time}

Aguardo a confirmação do horário!

Obrigado! 😊`;
}

/* ---------- envio ---------- */
async function submit() {
  if (state.busy) return;
  const p = problem(5);
  if (p) { toast(p.msg, true); if (p.step !== 5) goStep(p.step, 'back'); return; }
  state.busy = true; updateNext(); $('#failBox') && ($('#failBox').innerHTML = '');
  try {
    const res = await api.create({ name: cleanName(), vehicle: state.vehicle, serviceId: state.serviceId, date: state.date, time: state.time });
    state.result = res; state.busy = false;
    const url = waLink(buildMessage());
    state.step = 6; history.replaceState({ step: 6 }, '', '#/agendar'); render({ animate: true }); $('#bookScroll').scrollTop = 0;
    setTimeout(() => { window.location.href = url; }, 700);
  } catch (e) {
    state.busy = false;
    const m = errMsg(e);
    if (m) {
      toast(m, true);
      if (/SLOT_TAKEN|SLOT_BLOCKED|PAST_TIME/.test(e.code || e.message || '')) { state.time = null; goStep(4, 'back'); refreshAvail(); }
      else if (/INVALID_NAME/.test(e.code || '')) goStep(1, 'back'); else if (/SERVICE/.test(e.code || '')) goStep(3, 'back'); else if (/DATE|CLOSED|TOO_FAR/.test(e.code || '')) { state.date = null; state.time = null; goStep(4, 'back'); }
      else updateNext();
    } else {
      updateNext();
      const box = $('#failBox');
      if (box) box.innerHTML = `<div class="notice err-box">${ico('info')}<div><b>Não foi possível reservar agora.</b> Verifique a conexão e tente de novo. Se preferir, envie o pedido direto pelo WhatsApp (sem reserva automática do horário).
        <div class="acts"><button type="button" class="chip" data-act="submit">Tentar de novo</button><a class="chip" target="_blank" rel="noopener" href="${esc(waLink(buildMessage()))}">Enviar mesmo assim</a></div></div></div>`;
    }
  }
}

/* ---------- eventos do fluxo ---------- */
$('#stepBody').addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act;
  if (a === 'vehicle') { if (state.vehicle !== t.dataset.v) { state.vehicle = t.dataset.v; state.serviceId = null; } render(); }
  else if (a === 'service') { state.serviceId = t.dataset.id; render(); }
  else if (a === 'month') { state.cal.m += +t.dataset.dir; if (state.cal.m < 0) { state.cal.m = 11; state.cal.y--; } if (state.cal.m > 11) { state.cal.m = 0; state.cal.y++; } renderCalendar(); renderTimes(); refreshAvail(); }
  else if (a === 'date') { if (state.date !== t.dataset.d) { state.date = t.dataset.d; state.time = null; } renderCalendar(); renderTimes(); updateNext(); renderSummary(); const tm = $('#times'); if (tm) tm.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  else if (a === 'time') { state.time = t.dataset.t; renderTimes(); updateNext(); renderSummary(); }
  else if (a === 'retry-avail') refreshAvail();
  else if (a === 'submit') submit();
  else if (a === 'home') { resetBooking(); location.hash = '#/'; }
  else if (a === 'again') { resetBooking(); history.replaceState({ step: 1 }, '', '#/agendar'); render({ animate: true }); }
});
$('#stepBody').addEventListener('input', (e) => {
  if (e.target.id !== 'nameIn') return;
  state.name = e.target.value; const err = $('#nameErr'); if (err) err.textContent = ''; e.target.classList.remove('bad'); updateNext(); renderSummary();
});
$('#stepBody').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'nameIn') { e.preventDefault(); next(); } });
function next() {
  const s = state.step; const p = problem(s);
  if (p) {
    if (s === 1) { const i = $('#nameIn'); $('#nameErr').textContent = p.msg; i.classList.add('bad'); i.focus(); }
    else { const er = $('#stepErr'); if (er) er.textContent = p.msg; toast(p.msg, true); }
    return;
  }
  if (s === 5) return submit();
  goStep(s + 1);
}
$('#nextBtn').addEventListener('click', next);
$('#backBtn').addEventListener('click', () => { if (state.step === 1 || state.step === 6) location.hash = '#/'; else if (history.state && history.state.step === state.step) history.back(); else goStep(state.step - 1, 'back'); });
$('#closeBtn').addEventListener('click', () => { if (state.step === 6) resetBooking(); location.hash = '#/'; });
$('#sumToggle').addEventListener('click', () => { state.sumOpen = !state.sumOpen; renderSummary(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.step === 4) refreshAvail(); });
setInterval(() => { if (!document.hidden && state.step === 4 && !$('#viewBook').hidden) refreshAvail(); }, 30000);

/* ---------- home: serviços, galeria, horário ---------- */
function renderServices() {
  const photo = { 'carro-cera': 'assets/carro-cinza-thumb.jpg', 'carro-simples': 'assets/carro-suv-prata-thumb.jpg', moto: 'assets/moto-honda-thumb.jpg' };
  const alt = { 'carro-cera': 'Carro cinza brilhante após a lavagem', 'carro-simples': 'SUV prata após a lavagem', moto: 'Moto preta após a lavagem' };
  const group = (v, title) => {
    const list = state.services.filter((s) => s.vehicle === v); if (!list.length) return '';
    return `<div class="svc-group"><h3>${ico(v === 'moto' ? 'drop' : 'car')} ${title}</h3>${list.map((s) => `
      <article class="svc-card${photo[s.id] ? '' : ' no-photo'}">
        <div class="svc-info"><h4>${esc(s.name)}</h4><p>${esc(s.description || '')}</p><span class="price"><small>R$</small>${money(s.price).replace('R$ ', '')}</span></div>
        ${photo[s.id] ? `<figure class="svc-photo"><img src="${photo[s.id]}" alt="${alt[s.id]}" width="92" height="204" loading="lazy" decoding="async"></figure>` : ''}
      </article>`).join('')}</div>`;
  };
  $('#svcList').innerHTML = group('carro', 'Carro') + group('moto', 'Motocicleta');
}
function renderGallery() {
  const G = C.GALLERY;
  $('#carousel').innerHTML = G.map((g, i) => `<button type="button" class="shot" data-i="${i}" aria-label="Ampliar foto ${i + 1} de ${G.length}: ${esc(g.alt)}">
    <img src="${g.thumb || g.src}" alt="${esc(g.alt)}" width="${g.w}" height="${g.h}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async">
    <span class="tag">${esc(g.tag)}</span><span class="zoom"><svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4M11 8v6M8 11h6"/></svg></span></button>`).join('');
  $('#dots').innerHTML = G.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('');
  const car = $('#carousel');
  const step = () => (car.firstElementChild ? car.firstElementChild.getBoundingClientRect().width + 14 : 260);
  $('#carPrev').onclick = () => car.scrollBy({ left: -step(), behavior: 'smooth' });
  $('#carNext').onclick = () => car.scrollBy({ left: step(), behavior: 'smooth' });
  let raf; car.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
    const idx = Math.min(G.length - 1, Math.round(car.scrollLeft / step()));
    $$('#dots i').forEach((d, i) => d.classList.toggle('on', i === idx)); }); }, { passive: true });
  car.addEventListener('click', (e) => { const b = e.target.closest('.shot'); if (b) openLB(+b.dataset.i); });
  const hero = $('#heroPhoto'); hero.innerHTML = `<img src="${G[Math.min(1, G.length - 1)].src}" alt="" width="${G[0].w}" height="${G[0].h}" decoding="async">`;
}

/* lightbox */
let lbI = 0, lbOpener = null;
function openLB(i) { lbOpener = document.activeElement; lbI = i; $('#lightbox').hidden = false; document.body.style.overflow = 'hidden'; showLB(); $('#lbClose').focus(); }
function showLB() { const g = C.GALLERY[lbI]; const im = $('#lbImg'); im.src = g.src; im.alt = g.alt; im.width = g.w; im.height = g.h; $('#lbCount').textContent = `${lbI + 1} / ${C.GALLERY.length}`; const one = C.GALLERY.length < 2; $('#lbPrev').hidden = one; $('#lbNext').hidden = one; }
function closeLB() { $('#lightbox').hidden = true; document.body.style.overflow = location.hash.startsWith('#/agendar') ? 'hidden' : ''; if (lbOpener) lbOpener.focus(); }
const stepLB = (d) => { lbI = (lbI + d + C.GALLERY.length) % C.GALLERY.length; showLB(); };
$('#lbClose').onclick = closeLB; $('#lbPrev').onclick = () => stepLB(-1); $('#lbNext').onclick = () => stepLB(1);
$('#lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') closeLB(); });
document.addEventListener('keydown', (e) => { if ($('#lightbox').hidden) return; if (e.key === 'Escape') closeLB(); if (e.key === 'ArrowLeft') stepLB(-1); if (e.key === 'ArrowRight') stepLB(1); });
(() => { let x0 = null; const lb = $('#lightbox'); lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) stepLB(dx > 0 ? -1 : 1); }, { passive: true }); })();

function updateOpenNow() {
  const n = nowTZ(); const d = dow(n.date); const m = n.minutes;
  const open = C.OPEN_DAYS.includes(d) && ((m >= 480 && m < 720) || (m >= 780 && m < 1020));
  const p = $('#openNow'); p.className = 'status-pill ' + (open ? 'open' : 'closed'); p.textContent = open ? 'Aberto agora' : 'Fechado agora';
}

/* ---------- PWA ---------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; $('#installBtn').hidden = false; });
$('#installBtn').addEventListener('click', async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('#installBtn').hidden = true; });
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; });
if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

/* ---------- init ---------- */
function init() {
  $('#year').textContent = nowTZ().date.slice(0, 4);
  $$('.js-wa').forEach((a) => { a.href = waLink('Olá! Gostaria de mais informações sobre o PitStop Lava Jato.'); });
  $('#waTop').href = waLink('Olá! Gostaria de mais informações sobre o PitStop Lava Jato.');
  $('#waShow').textContent = C.WHATSAPP_DISPLAY;
  $('#demoBanner').hidden = !DEMO;
  renderServices(); renderGallery(); updateOpenNow(); setInterval(updateOpenNow, 60000);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone; $('#iosHint').hidden = !ios;
  const sticky = $('#stickyCta'); const hero = $('#ctaHero');
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { sticky.hidden = en.isIntersecting; }, { threshold: 0 }).observe(hero);
  window.addEventListener('scroll', () => { if (!$('#viewHome').hidden) window.__homeY = window.scrollY; }, { passive: true });
  api.services().then((s) => { state.services = s; renderServices(); if (state.step === 3 || state.step === 5) render(); });
  route();
}
init();
})();
