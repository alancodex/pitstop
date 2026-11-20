/* PitStop — painel administrativo.
   Toda a segurança real está no banco (Supabase Auth + RLS). Este arquivo só monta a interface. */
(() => {
'use strict';
const C = window.PITSTOP;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const money = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v)).replace(/ /g, ' ');
const ico = (n) => `<svg class="ico"><use href="#i-${n}"/></svg>`;

/* ---------- datas (fuso de Pernambuco) ---------- */
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
const br = (s) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const longDate = (s) => cap(new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(parseD(s)));
const shortDate = (s) => cap(new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(parseD(s))).replace('.', '');
const mondayOf = (s) => { const d = dow(s); return addDays(s, d === 0 ? -6 : 1 - d); };
const stamp = (iso) => new Intl.DateTimeFormat('pt-BR', { timeZone: C.TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const hhmm = (t) => String(t).slice(0, 5);

/* ---------- status ---------- */
const ST = {
  pendente:     { label: 'Aguardando confirmação', c: 'var(--st-pendente)' },
  confirmado:   { label: 'Confirmado',             c: 'var(--st-confirmado)' },
  em_andamento: { label: 'Em andamento',           c: 'var(--st-em_andamento)' },
  concluido:    { label: 'Concluído',              c: 'var(--st-concluido)' },
  cancelado:    { label: 'Cancelado',              c: 'var(--st-cancelado)' },
  expirado:     { label: 'Reserva expirada',       c: 'var(--st-expirado)' }
};
const effStatus = (b) => (b.status === 'pendente' && b.expires_at && new Date(b.expires_at) < new Date() ? 'expirado' : b.status);
const isLive = (s) => ['pendente', 'confirmado', 'em_andamento', 'concluido'].includes(s);
const pill = (s) => `<span class="pill" style="--c:${ST[s].c}">${ST[s].label}</span>`;

/* ---------- estado ---------- */
const configured = C.SUPABASE_URL && !/SEU-PROJETO/.test(C.SUPABASE_URL);
const sb = configured ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
const S = { user: null, role: null, tab: 'painel', day: nowTZ().date, services: [], f: { date: '', vehicle: '', service: '', status: '' },
  cal: { mode: window.innerWidth < 900 ? 'day' : 'week', anchor: nowTZ().date }, tok: 0, hold: 120 };

/* ---------- utilidades de UI ---------- */
let toastT;
function toast(msg, bad = false) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4000); }
function fail(e) {
  console.error(e);
  const m = e && e.code === '23505' ? 'Esse horário já está ocupado por outro agendamento ativo.'
    : e && /row-level security|permission denied|FORBIDDEN/i.test(e.message || '') ? 'Você não tem permissão para essa ação.'
    : (e && e.message) || 'Algo deu errado. Tente novamente.';
  toast(m, true);
}
const modalOpen = () => !$('#modalBack').hidden;
function openModal(title, html) { $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modalBack').hidden = false; document.body.style.overflow = 'hidden'; }
function closeModal() { $('#modalBack').hidden = true; $('#modalBody').innerHTML = ''; document.body.style.overflow = ''; }
$('#modalClose').addEventListener('click', closeModal);
$('#modalBack').addEventListener('mousedown', (e) => { if (e.target.id === 'modalBack') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalOpen()) closeModal(); });

const waNum = (p) => { let d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.length <= 11) d = '55' + d; return d; };
const waUrl = (num, text) => `https://wa.me/${num}${text ? '?text=' + encodeURIComponent(text) : ''}`;
function clientMsg(b, kind) {
  const base = `Olá, ${b.customer_name}! Aqui é do *PitStop Lava Jato*.`;
  const info = `\n\n\u{1F9FC} ${b.service_name}\n\u{1F4C5} ${longDate(b.booking_date)}\n\u{23F0} ${hhmm(b.booking_time)}`;
  if (kind === 'resched') return `${base} Seu agendamento foi *reagendado*:${info}\n\nPode confirmar para nós? \u{1F60A}`;
  if (b.status === 'confirmado' || b.status === 'em_andamento') return `${base} Seu agendamento está *confirmado* \u{2705}${info}\n\nTe esperamos!`;
  return `${base} Sobre o seu pedido de agendamento:${info}`;
}

/* ---------- autenticação ---------- */
function showLogin(msg = '') {
  $('#app').hidden = true; $('#login').hidden = false; S.user = null; S.role = null;
  $('#loginErr').textContent = msg; $('#loginBtn').disabled = false; $('#loginBtn').textContent = 'Entrar';
}
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!configured) { $('#loginErr').textContent = 'Configure o Supabase em js/config.js antes de usar o painel.'; return; }
  const btn = $('#loginBtn'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  const { data, error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#pass').value });
  if (error) { showLogin('E-mail ou senha incorretos.'); return; }
  await enter(data.user);
});
async function enter(user) {
  const { data, error } = await sb.from('admins').select('role').eq('user_id', user.id).maybeSingle();
  if (error || !data) { await sb.auth.signOut(); showLogin('Este usuário não tem permissão para acessar o painel.'); return; }
  S.user = user; S.role = data.role;
  $('#login').hidden = true; $('#app').hidden = false;
  $('#whoami').textContent = 'Sair'; $('#logoutBtn').title = (S.role === 'owner' ? 'Proprietário' : 'Equipe') + ' — sair';
  $('#tabAjustes').hidden = S.role !== 'owner';
  $('#waShop').href = waUrl(C.WHATSAPP);
  $('#pass').value = '';
  await loadServices(); await loadSettings();
  go('painel');
}
$('#logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); showLogin(); });
if (sb) sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && S.user) showLogin('Sessão encerrada. Entre novamente.'); });

/* ---------- dados base ---------- */
async function loadServices() { const { data } = await sb.from('services').select('*').order('sort'); S.services = data || []; }
async function loadSettings() { const { data } = await sb.from('settings').select('*'); const h = (data || []).find((r) => r.key === 'hold_minutes'); S.hold = h ? Number(h.value) : 120; }
async function updateBadge() {
  const { count } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pendente').gt('expires_at', new Date().toISOString());
  const t = $('#tabs [data-tab="agendamentos"]'); $$('.dot', t).forEach((d) => d.remove());
  if (count) t.insertAdjacentHTML('beforeend', `<span class="dot">${count}</span>`);
  document.title = (count ? `(${count}) ` : '') + 'Painel · PitStop Lava Jato';
}

/* ---------- navegação ---------- */
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });
function go(tab) { S.tab = tab; $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab)); refresh(); }
async function refresh(quiet = false) {
  if (!S.user) return;
  const tok = ++S.tok;
  try { await sb.rpc('sweep_expired'); } catch (_) { /* ignora */ }
  if (!quiet) $('#content').innerHTML = '<div class="empty"><span class="spinner" style="margin:auto"></span></div>';
  try {
    const html = await ({ painel: viewPainel, agendamentos: viewLista, calendario: viewCal, bloqueios: viewBloqueios, ajustes: viewAjustes }[S.tab])();
    if (tok !== S.tok) return;
    $('#content').innerHTML = html; afterRender();
  } catch (e) { if (tok === S.tok) { $('#content').innerHTML = `<div class="empty">Não foi possível carregar. <button class="btn btn-sm btn-ghost" data-act="reload">Tentar de novo</button></div>`; fail(e); } }
  updateBadge();
}
$('#refreshBtn').addEventListener('click', () => refresh());
setInterval(() => { if (S.user && !document.hidden && !modalOpen() && !['bloqueios', 'ajustes'].includes(S.tab) && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) refresh(true); }, 30000);

/* ---------- componentes ---------- */
function bkRow(b, showDate = true) {
  const s = effStatus(b); const phone = waNum(b.phone);
  const acts = [];
  if (s === 'pendente' || s === 'expirado') acts.push(['confirm', 'Confirmar', 'btn-ok'], ['cancel', 'Cancelar', 'btn-bad']);
  else if (s === 'confirmado') acts.push(['start', 'Iniciar', 'btn-warn'], ['done', 'Concluir', 'btn-ok'], ['cancel', 'Cancelar', 'btn-bad']);
  else if (s === 'em_andamento') acts.push(['done', 'Concluir', 'btn-ok'], ['cancel', 'Cancelar', 'btn-bad']);
  else if (s === 'cancelado') acts.push(['confirm', 'Reativar', 'btn-ghost']);
  return `<article class="bk" style="--c:${ST[s].c}">
    <div class="bk-main"><span class="bk-name">${esc(b.customer_name)}</span><span>${pill(s)}</span>${s === 'expirado' && b.status === 'pendente' ? '<span class="expired-note">Horário já liberado para outros clientes</span>' : ''}</div>
    <div class="bk-meta"><span>${b.vehicle === 'moto' ? '\u{1F3CD}\u{FE0F}' : '\u{1F697}'} <b>${esc(b.service_name)}</b></span>${showDate ? `<span>\u{1F4C5} ${shortDate(b.booking_date)}</span>` : ''}<span>\u{23F0} <b>${hhmm(b.booking_time)}</b></span></div>
    <div class="bk-price">${money(b.price)}</div>
    <div class="bk-actions">${acts.map(([a, l, c]) => `<button class="btn btn-xs ${c}" data-act="${a}" data-id="${b.id}">${l}</button>`).join('')}
      <button class="btn btn-xs btn-ghost" data-act="details" data-id="${b.id}">Detalhes</button>
      ${phone ? `<a class="btn btn-xs btn-ghost" target="_blank" rel="noopener" href="${esc(waUrl(phone, clientMsg(b)))}" aria-label="WhatsApp do cliente">${ico('wa')}</a>` : ''}</div></article>`;
}
const svcOptions = (sel = '') => ['<option value="">Todos</option>'].concat(S.services.map((s) => `<option value="${esc(s.id)}" ${sel === s.id ? 'selected' : ''}>${esc(s.name)}</option>`)).join('');
const statusOptions = (sel = '') => ['<option value="">Todos</option>'].concat(Object.entries(ST).map(([k, v]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${v.label}</option>`)).join('');
function afterRender() { /* gancho futuro */ }

/* ---------- Painel ---------- */
async function viewPainel() {
  const d = S.day;
  const [{ data: rows, error }, { count: totalDone }] = await Promise.all([
    sb.from('bookings').select('*').eq('booking_date', d).order('booking_time'),
    sb.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'concluido')]);
  if (error) throw error;
  const eff = rows.map((b) => ({ ...b, _s: effStatus(b) }));
  const live = eff.filter((b) => !['cancelado', 'expirado'].includes(b._s));
  const n = (f) => eff.filter(f).length;
  const sum = (f) => eff.filter(f).reduce((a, b) => a + Number(b.price), 0);
  const forecast = sum((b) => ['confirmado', 'em_andamento', 'concluido'].includes(b._s));
  const waiting = sum((b) => b._s === 'pendente');
  const k = (label, val, c, small = '') => `<div class="kpi" style="--c:${c}"><span>${label}</span><b${String(val).startsWith('R$') ? ' class="money"' : ''}>${val}</b>${small ? `<small>${small}</small>` : ''}</div>`;
  return `<div class="page-head"><h1>Painel</h1>
      <div class="row-flex"><button class="btn btn-sm btn-ghost" data-act="day" data-n="-1" aria-label="Dia anterior">${ico('left')}</button>
      <input class="input sm" type="date" id="dayIn" value="${d}" style="width:auto" aria-label="Data do painel">
      <button class="btn btn-sm btn-ghost" data-act="day" data-n="1" aria-label="Próximo dia">${ico('right')}</button>
      <button class="btn btn-sm btn-ghost" data-act="day" data-n="0">Hoje</button>
      <button class="btn btn-sm btn-primary" data-act="new">${ico('plus')} Novo agendamento</button></div></div>
    <p class="muted" style="margin:-6px 0 14px">${longDate(d)}</p>
    <div class="kpis">
      ${k('Agendamentos do dia', live.length, 'var(--white)')}
      ${k('Aguardando confirmação', n((b) => b._s === 'pendente'), ST.pendente.c)}
      ${k('Confirmados', n((b) => ['confirmado', 'em_andamento'].includes(b._s)), ST.confirmado.c, 'inclui em andamento')}
      ${k('Cancelados', n((b) => b._s === 'cancelado'), ST.cancelado.c)}
      ${k('Serviços realizados', n((b) => b._s === 'concluido'), ST.concluido.c, `${totalDone ?? 0} no total geral`)}
      ${k('Faturamento previsto', money(forecast), 'var(--red)', waiting ? `+ ${money(waiting)} aguardando` : 'confirmados + concluídos')}
    </div>
    <div class="list">${live.length || eff.length ? eff.map((b) => bkRow(b, false)).join('') : '<div class="empty">Nenhum agendamento neste dia.</div>'}</div>`;
}

/* ---------- Agendamentos (lista + filtros + histórico) ---------- */
async function viewLista() {
  const f = S.f;
  let q = sb.from('bookings').select('*').order('booking_date', { ascending: false }).order('booking_time', { ascending: false }).limit(300);
  if (f.date) q = q.eq('booking_date', f.date);
  if (f.vehicle) q = q.eq('vehicle', f.vehicle);
  if (f.service) q = q.eq('service_id', f.service);
  if (f.status) q = q.eq('status', f.status);
  const { data, error } = await q; if (error) throw error;
  return `<div class="page-head"><h1>Agendamentos</h1><button class="btn btn-sm btn-primary" data-act="new">${ico('plus')} Novo agendamento</button></div>
    <form class="filters" id="filters">
      <div><label for="fDate">Data</label><input class="input sm" type="date" id="fDate" value="${esc(f.date)}"></div>
      <div><label for="fVeh">Veículo</label><select class="input sm" id="fVeh"><option value="">Todos</option><option value="carro" ${f.vehicle === 'carro' ? 'selected' : ''}>Carro</option><option value="moto" ${f.vehicle === 'moto' ? 'selected' : ''}>Moto</option></select></div>
      <div><label for="fSvc">Serviço</label><select class="input sm" id="fSvc">${svcOptions(f.service)}</select></div>
      <div><label for="fSt">Status</label><select class="input sm" id="fSt">${statusOptions(f.status)}</select></div>
      <div></div><div style="align-self:end"><button type="button" class="btn btn-sm btn-ghost btn-block" data-act="clear-filters">Limpar</button></div>
    </form>
    <p class="muted" style="margin-bottom:10px">${data.length} registro(s)${data.length === 300 ? ' — mostrando os 300 mais recentes; use os filtros para refinar' : ''}.</p>
    <div class="list">${data.length ? data.map((b) => bkRow(b)).join('') : '<div class="empty">Nenhum agendamento encontrado.</div>'}</div>`;
}
document.addEventListener('change', (e) => {
  const m = { fDate: 'date', fVeh: 'vehicle', fSvc: 'service', fSt: 'status' }[e.target.id];
  if (m) { S.f[m] = e.target.value; refresh(true); }
  if (e.target.id === 'dayIn' && e.target.value) { S.day = e.target.value; refresh(true); }
});

/* ---------- Calendário ---------- */
async function viewCal() {
  const { mode, anchor } = S.cal;
  const days = mode === 'week' ? [0, 1, 2, 3, 4, 5].map((i) => addDays(mondayOf(anchor), i)) : [anchor];
  const from = days[0], to = days[days.length - 1];
  const [bk, bl] = await Promise.all([
    sb.from('bookings').select('*').gte('booking_date', from).lte('booking_date', to).order('requested_at'),
    sb.from('blocked_slots').select('*').gte('slot_date', from).lte('slot_date', to)]);
  if (bk.error) throw bk.error; if (bl.error) throw bl.error;
  const today = nowTZ().date;
  const cell = (d, t) => {
    const all = bk.data.filter((b) => b.booking_date === d && hhmm(b.booking_time) === t);
    const eff = all.map((b) => ({ b, s: effStatus(b) }));
    const live = eff.find((x) => isLive(x.s)); const dead = eff.filter((x) => !isLive(x.s));
    const block = bl.data.find((x) => x.slot_date === d && (x.slot_time === null || hhmm(x.slot_time) === t));
    let h = '';
    if (live) h += `<button class="slot-btn has" style="--c:${ST[live.s].c}" data-act="details" data-id="${live.b.id}" title="${ST[live.s].label}"><b>${esc(live.b.customer_name)}</b><small>${live.b.vehicle === 'moto' ? '\u{1F3CD}\u{FE0F}' : '\u{1F697}'} ${esc(live.b.service_name)}</small></button>`;
    else if (block) h += `<button class="slot-btn blocked" data-act="cell-blocked" data-id="${block.id}">Bloqueado${block.reason ? `<br><small>${esc(block.reason)}</small>` : ''}</button>`;
    else h += `<button class="slot-btn free" data-act="cell-free" data-d="${d}" data-t="${t}" aria-label="Horário livre ${t}">+</button>`;
    dead.forEach((x) => { h += `<button class="slot-btn has" style="--c:${ST[x.s].c};min-height:26px;flex:none;opacity:.65" data-act="details" data-id="${x.b.id}" title="${ST[x.s].label}"><small>${esc(x.b.customer_name)} · ${ST[x.s].label}</small></button>`; });
    return h;
  };
  const head = days.map((d) => `<div class="cc head${d === today ? ' today' : ''}">${shortDate(d)}</div>`).join('');
  const rowsHtml = C.SLOTS.map((t) => (t === '13:00' ? '<div class="cc lunch">Almoço · 12:00–13:00</div>' : '') + `<div class="cc h">${t}</div>` + days.map((d) => `<div class="cc">${cell(d, t)}</div>`).join('')).join('');
  const title = mode === 'week' ? `${br(from).slice(0, 5)} a ${br(to).slice(0, 5)}` : longDate(anchor);
  return `<div class="page-head"><h1>Calendário</h1><div class="row-flex">
      <button class="btn btn-sm btn-ghost" data-act="cal-nav" data-n="-1" aria-label="Anterior">${ico('left')}</button>
      <b style="min-width:120px;text-align:center">${esc(title)}</b>
      <button class="btn btn-sm btn-ghost" data-act="cal-nav" data-n="1" aria-label="Próximo">${ico('right')}</button>
      <button class="btn btn-sm btn-ghost" data-act="cal-nav" data-n="0">Hoje</button>
      <button class="btn btn-sm btn-ghost" data-act="cal-mode">${mode === 'week' ? 'Ver dia' : 'Ver semana'}</button></div></div>
    <div class="legend">${Object.entries(ST).map(([, v]) => `<span><i style="--c:${v.c}"></i>${v.label}</span>`).join('')}<span><i style="--c:var(--st-cancelado);opacity:.5"></i>Bloqueado</span></div>
    <div class="cal-wrap"><div class="cal-table ${mode}"><div class="cc head"></div>${head}${rowsHtml}</div></div>`;
}

/* ---------- Bloqueios ---------- */
async function viewBloqueios() {
  const today = nowTZ().date;
  const { data, error } = await sb.from('blocked_slots').select('*').gte('slot_date', today).order('slot_date').order('slot_time', { nullsFirst: true });
  if (error) throw error;
  return `<div class="page-head"><h1>Bloqueios de horário</h1></div>
    <div class="card"><h2>Bloquear</h2>
      <div class="two"><div><label for="bDate">Data</label><input class="input" type="date" id="bDate" min="${today}" value="${today}"></div>
      <div><label for="bTime">Horário</label><select class="input" id="bTime"><option value="">Dia inteiro</option>${C.SLOTS.map((t) => `<option>${t}</option>`).join('')}</select></div></div>
      <label for="bReason">Motivo (opcional)</label><input class="input" id="bReason" maxlength="80" placeholder="Ex.: feriado, manutenção">
      <div class="actions" style="margin-top:14px"><button class="btn btn-primary" data-act="add-block">Bloquear horário</button></div></div>
    <p class="muted" style="margin-bottom:10px">Horários bloqueados não aparecem como disponíveis para os clientes. Para liberar, remova o bloqueio.</p>
    <div class="table-simple">${data.length ? data.map((b) => `<div class="simple-row"><div><b>${shortDate(b.slot_date)} · ${b.slot_time ? hhmm(b.slot_time) : 'Dia inteiro'}</b><div class="muted">${esc(b.reason || 'Sem motivo informado')}</div></div>
      <button class="btn btn-xs btn-ghost" data-act="unblock" data-id="${b.id}">Liberar</button></div>`).join('') : '<div class="empty">Nenhum horário bloqueado.</div>'}</div>`;
}

/* ---------- Ajustes (proprietário) ---------- */
async function viewAjustes() {
  if (S.role !== 'owner') return '<div class="empty">Somente o proprietário acessa esta área.</div>';
  await loadServices(); await loadSettings();
  return `<div class="page-head"><h1>Ajustes</h1></div>
    <div class="card"><h2>Reserva temporária</h2>
      <p class="muted">Quanto tempo um pedido "Aguardando confirmação" segura o horário. Depois disso o horário volta a ficar livre automaticamente.</p>
      <label for="holdIn">Prazo (minutos)</label><input class="input" id="holdIn" type="number" min="5" max="2880" step="5" value="${S.hold}" style="max-width:200px">
      <div class="actions" style="margin-top:12px"><button class="btn btn-sm btn-primary" data-act="save-hold">Salvar prazo</button></div></div>
    <div class="card"><h2>Serviços e preços</h2>
      <div class="table-simple">${S.services.map((s) => `<div class="simple-row" data-svc="${esc(s.id)}"><div><b>${esc(s.name)}</b><div class="muted">${s.vehicle === 'moto' ? 'Moto' : 'Carro'}</div></div>
        <div class="row-flex"><label style="margin:0">R$</label><input class="input sm" type="number" min="0" step="0.5" value="${Number(s.price)}" style="width:110px" data-f="price">
        <label style="margin:0;display:flex;gap:6px;align-items:center"><input type="checkbox" data-f="active" ${s.active ? 'checked' : ''}> Ativo</label>
        <button class="btn btn-xs btn-primary" data-act="save-svc" data-id="${esc(s.id)}">Salvar</button></div>
        <div style="flex-basis:100%"><label style="margin:6px 0 4px;font-size:12px;color:var(--muted)">O que inclui (um item por linha — aparece no site)</label><textarea class="input" rows="4" maxlength="500" data-f="description">${esc(s.description || '')}</textarea></div></div>`).join('')}</div></div>`;
}

/* ---------- seletor de horários (reagendar / novo) ---------- */
async function slotPicker(root, date, selected, onPick) {
  root.innerHTML = '<div class="muted" style="margin-top:8px">Carregando horários…</div>';
  const { data, error } = await sb.rpc('get_availability', { p_from: date, p_to: date });
  if (error) { root.innerHTML = '<div class="err">Não foi possível carregar os horários.</div>'; return; }
  const taken = new Set((data || []).map((r) => r.slot_time.slice(0, 5)));
  const n = nowTZ();
  const closed = !C.OPEN_DAYS.includes(dow(date));
  if (closed) { root.innerHTML = '<div class="err">Domingo: fechado.</div>'; return; }
  root.innerHTML = `<div class="slot-grid">${C.SLOTS.map((t) => {
    const off = taken.has(t) || date < n.date || (date === n.date && toMin(t) <= n.minutes);
    return `<button type="button" data-t="${t}" class="${selected === t ? 'sel' : ''}" ${off ? 'disabled' : ''}>${t}</button>`;
  }).join('')}</div>`;
  root.onclick = (e) => { const b = e.target.closest('button[data-t]'); if (!b) return; $$('button', root).forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); onPick(b.dataset.t); };
}

/* ---------- modais ---------- */
async function openDetails(id) {
  const [{ data: b, error }, { data: ev }] = await Promise.all([
    sb.from('bookings').select('*').eq('id', id).single(),
    sb.from('booking_events').select('*').eq('booking_id', id).order('at')]);
  if (error) return fail(error);
  const s = effStatus(b); const phone = waNum(b.phone);
  const can = (a) => ({ confirm: ['pendente', 'expirado', 'cancelado'], start: ['confirmado'], done: ['confirmado', 'em_andamento'], cancel: ['pendente', 'expirado', 'confirmado', 'em_andamento'], resched: ['pendente', 'expirado', 'confirmado', 'em_andamento'] }[a] || []).includes(s);
  openModal('Detalhes', `
    <dl class="kv">
      <div><dt>Cliente</dt><dd>${esc(b.customer_name)}</dd></div>
      <div><dt>Veículo</dt><dd>${b.vehicle === 'moto' ? '\u{1F3CD}\u{FE0F} Moto' : '\u{1F697} Carro'}</dd></div>
      <div><dt>Serviço</dt><dd>${esc(b.service_name)}</dd></div>
      <div><dt>Valor</dt><dd>${money(b.price)}</dd></div>
      <div><dt>Data</dt><dd>${longDate(b.booking_date)}</dd></div>
      <div><dt>Horário</dt><dd>${hhmm(b.booking_time)}</dd></div>
      <div><dt>Status</dt><dd>${pill(s)}</dd></div>
      <div><dt>Solicitado em</dt><dd>${stamp(b.requested_at)} · ${b.source === 'admin' ? 'painel' : 'site'}</dd></div>
      ${b.status === 'pendente' && b.expires_at ? `<div><dt>Reserva ${new Date(b.expires_at) < new Date() ? 'expirou' : 'expira'} em</dt><dd>${stamp(b.expires_at)}</dd></div>` : ''}
    </dl>
    <label for="dPhone">Telefone / WhatsApp do cliente</label><input class="input" id="dPhone" inputmode="tel" maxlength="20" placeholder="(81) 99999-9999" value="${esc(b.phone || '')}">
    <label for="dNotes">Observações</label><textarea class="input" id="dNotes" maxlength="400">${esc(b.notes || '')}</textarea>
    <p class="err" id="dErr"></p>
    <div class="actions"><button class="btn btn-sm btn-primary" id="dSave">Salvar dados</button>
      ${phone ? `<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="${esc(waUrl(phone, clientMsg(b)))}">${ico('wa')} WhatsApp do cliente</a>` : ''}</div>
    <h3 style="margin:18px 0 6px;font:800 20px var(--font-display);text-transform:uppercase">Ações</h3>
    <div class="actions" style="margin-top:0">
      ${can('confirm') ? `<button class="btn btn-sm btn-ok" data-m="confirm">${s === 'cancelado' ? 'Reativar' : 'Confirmar'}</button>` : ''}
      ${can('start') ? '<button class="btn btn-sm btn-warn" data-m="start">Iniciar</button>' : ''}
      ${can('done') ? '<button class="btn btn-sm btn-ok" data-m="done">Marcar como concluído</button>' : ''}
      ${can('resched') ? '<button class="btn btn-sm btn-ghost" data-m="resched">Reagendar</button>' : ''}
      ${can('cancel') ? '<button class="btn btn-sm btn-bad" data-m="cancel">Cancelar</button>' : ''}
      ${S.role === 'owner' ? '<button class="btn btn-sm btn-bad" data-m="delete">Excluir registro</button>' : ''}
    </div>
    <h3 style="margin:18px 0 6px;font:800 20px var(--font-display);text-transform:uppercase">Histórico</h3>
    <ul class="timeline">${(ev || []).map((e) => `<li><b>${stamp(e.at)}</b> · ${esc(e.note || (e.from_status ? `${ST[e.from_status]?.label || e.from_status} → ${ST[e.to_status]?.label || e.to_status}` : ST[e.to_status]?.label || e.to_status))}</li>`).join('') || '<li>Sem eventos.</li>'}</ul>`);
  $('#dSave').onclick = async () => {
    const ph = $('#dPhone').value.trim(); const digits = ph.replace(/\D/g, '');
    if (ph && (digits.length < 10 || digits.length > 13)) { $('#dErr').textContent = 'Telefone inválido. Use DDD + número.'; return; }
    const { error } = await sb.from('bookings').update({ phone: ph || null, notes: $('#dNotes').value.trim() || null }).eq('id', id);
    if (error) return fail(error); toast('Dados salvos.'); closeModal(); refresh(true);
  };
  $('#modalBody').onclick = async (e) => {
    const m = e.target.closest('[data-m]'); if (!m) return;
    if (m.dataset.m === 'resched') return openResched(b);
    await runAction(m.dataset.m, b);
  };
}
const NEXT = { confirm: 'confirmado', start: 'em_andamento', done: 'concluido', cancel: 'cancelado' };
async function runAction(act, b) {
  if (act === 'cancel' && !confirm(`Cancelar o agendamento de ${b.customer_name}? O horário será liberado.`)) return;
  if (act === 'delete') {
    if (!confirm(`Excluir DEFINITIVAMENTE o registro de ${b.customer_name}? Isso não pode ser desfeito.`)) return;
    const { error } = await sb.from('bookings').delete().eq('id', b.id); if (error) return fail(error);
    toast('Registro excluído.'); closeModal(); return refresh(true);
  }
  const { error } = await sb.from('bookings').update({ status: NEXT[act] }).eq('id', b.id);
  if (error) return fail(error);
  toast({ confirm: 'Agendamento confirmado.', start: 'Serviço iniciado.', done: 'Serviço concluído.', cancel: 'Agendamento cancelado.' }[act]);
  closeModal(); refresh(true);
}
function openResched(b) {
  let date = b.booking_date, time = null;
  openModal('Reagendar', `<p class="muted">${esc(b.customer_name)} · ${esc(b.service_name)}<br>Atual: ${longDate(b.booking_date)} às ${hhmm(b.booking_time)}</p>
    <label for="rDate">Nova data</label><input class="input" type="date" id="rDate" min="${nowTZ().date}" value="${date}">
    <div id="rSlots"></div><p class="err" id="rErr"></p>
    <div class="actions"><button class="btn btn-primary btn-sm" id="rGo">Reagendar</button></div>`);
  const load = () => slotPicker($('#rSlots'), date, time, (t) => { time = t; });
  $('#rDate').onchange = (e) => { date = e.target.value; time = null; if (date) load(); };
  load();
  $('#rGo').onclick = async () => {
    if (!date || !time) { $('#rErr').textContent = 'Escolha a nova data e um horário livre.'; return; }
    const { error } = await sb.from('bookings').update({ booking_date: date, booking_time: time }).eq('id', b.id);
    if (error) return fail(error);
    toast('Reagendado.'); closeModal(); refresh(true);
    if (waNum(b.phone) && confirm('Avisar o cliente pelo WhatsApp?')) window.open(waUrl(waNum(b.phone), clientMsg({ ...b, booking_date: date, booking_time: time }, 'resched')), '_blank', 'noopener');
  };
}
function openNew(pre = {}) {
  let date = pre.date || nowTZ().date, time = pre.time || null;
  openModal('Novo agendamento', `
    <label for="nName">Nome do cliente</label><input class="input" id="nName" maxlength="60" autocomplete="off">
    <label for="nPhone">Telefone / WhatsApp (opcional)</label><input class="input" id="nPhone" inputmode="tel" maxlength="20" placeholder="(81) 99999-9999">
    <div class="two"><div><label for="nVeh">Veículo</label><select class="input" id="nVeh"><option value="carro">Carro</option><option value="moto">Moto</option></select></div>
    <div><label for="nSvc">Serviço</label><select class="input" id="nSvc"></select></div></div>
    <div class="two"><div><label for="nDate">Data</label><input class="input" type="date" id="nDate" min="${nowTZ().date}" value="${date}"></div>
    <div><label for="nSt">Status</label><select class="input" id="nSt"><option value="confirmado">Confirmado</option><option value="pendente">Aguardando confirmação</option></select></div></div>
    <div id="nSlots"></div><p class="err" id="nErr"></p>
    <div class="actions"><button class="btn btn-primary btn-sm" id="nGo">Criar agendamento</button></div>`);
  const fillSvc = () => { $('#nSvc').innerHTML = S.services.filter((s) => s.active && s.vehicle === $('#nVeh').value).map((s) => `<option value="${esc(s.id)}">${esc(s.name)} — ${money(s.price)}</option>`).join(''); };
  fillSvc(); $('#nVeh').onchange = fillSvc;
  const load = () => slotPicker($('#nSlots'), date, time, (t) => { time = t; });
  $('#nDate').onchange = (e) => { date = e.target.value; time = null; if (date) load(); };
  load();
  $('#nGo').onclick = async () => {
    const name = $('#nName').value.replace(/\s+/g, ' ').trim(); const ph = $('#nPhone').value.trim(); const digits = ph.replace(/\D/g, '');
    const svc = S.services.find((s) => s.id === $('#nSvc').value);
    const err = !name || name.length < 2 ? 'Informe o nome do cliente.' : ph && (digits.length < 10 || digits.length > 13) ? 'Telefone inválido. Use DDD + número.' : !svc ? 'Escolha um serviço.' : !date ? 'Escolha a data.' : !time ? 'Escolha um horário livre.' : '';
    if (err) { $('#nErr').textContent = err; return; }
    const st = $('#nSt').value;
    const { error } = await sb.from('bookings').insert({ customer_name: name, phone: ph || null, vehicle: svc.vehicle, service_id: svc.id, service_name: svc.name, price: svc.price,
      booking_date: date, booking_time: time, status: st, source: 'admin', expires_at: st === 'pendente' ? new Date(Date.now() + S.hold * 60000).toISOString() : null });
    if (error) return fail(error);
    toast('Agendamento criado.'); closeModal(); refresh(true);
  };
}

/* ---------- eventos da interface ---------- */
$('#content').addEventListener('click', async (e) => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act; const id = t.dataset.id;
  try {
    if (['confirm', 'start', 'done', 'cancel'].includes(a)) { const { data: b, error } = await sb.from('bookings').select('*').eq('id', id).single(); if (error) throw error; await runAction(a, b); }
    else if (a === 'details') openDetails(id);
    else if (a === 'new') openNew();
    else if (a === 'reload') refresh();
    else if (a === 'day') { const n = +t.dataset.n; S.day = n === 0 ? nowTZ().date : addDays(S.day, n); refresh(true); }
    else if (a === 'clear-filters') { S.f = { date: '', vehicle: '', service: '', status: '' }; refresh(true); }
    else if (a === 'cal-nav') { const n = +t.dataset.n; if (n === 0) S.cal.anchor = nowTZ().date; else if (S.cal.mode === 'week') S.cal.anchor = addDays(S.cal.anchor, 7 * n); else { let d = addDays(S.cal.anchor, n); if (dow(d) === 0) d = addDays(d, n); S.cal.anchor = d; } if (dow(S.cal.anchor) === 0) S.cal.anchor = addDays(S.cal.anchor, 1); refresh(true); }
    else if (a === 'cal-mode') { S.cal.mode = S.cal.mode === 'week' ? 'day' : 'week'; refresh(true); }
    else if (a === 'cell-free') {
      const d = t.dataset.d, tm = t.dataset.t;
      openModal(`${shortDate(d)} às ${tm}`, `<p class="muted">Este horário está livre.</p><div class="actions"><button class="btn btn-primary btn-sm" id="cNew">${ico('plus')} Novo agendamento</button><button class="btn btn-bad btn-sm" id="cBlock">Bloquear horário</button></div>`);
      $('#cNew').onclick = () => openNew({ date: d, time: tm });
      $('#cBlock').onclick = async () => { const { error } = await sb.from('blocked_slots').insert({ slot_date: d, slot_time: tm }); if (error) return fail(error); toast('Horário bloqueado.'); closeModal(); refresh(true); };
    }
    else if (a === 'cell-blocked' || a === 'unblock') {
      if (a === 'cell-blocked' && !confirm('Liberar este horário bloqueado?')) return;
      const { error } = await sb.from('blocked_slots').delete().eq('id', id); if (error) throw error; toast('Horário liberado.'); refresh(true);
    }
    else if (a === 'add-block') {
      const date = $('#bDate').value, time = $('#bTime').value, reason = $('#bReason').value.trim();
      if (!date) return toast('Escolha a data.', true);
      if (date < nowTZ().date) return toast('Não é possível bloquear datas passadas.', true);
      let q = sb.from('bookings').select('id', { count: 'exact', head: true }).eq('booking_date', date).in('status', ['pendente', 'confirmado', 'em_andamento']);
      if (time) q = q.eq('booking_time', time);
      const { count } = await q;
      if (count && !confirm(`Já existe(m) ${count} agendamento(s) ativo(s) nesse período. O bloqueio não cancela agendamentos existentes. Bloquear mesmo assim?`)) return;
      const { error } = await sb.from('blocked_slots').insert({ slot_date: date, slot_time: time || null, reason: reason || null }); if (error) throw error;
      toast('Horário bloqueado.'); refresh(true);
    }
    else if (a === 'save-hold') {
      const v = Math.round(Number($('#holdIn').value));
      if (!(v >= 5 && v <= 2880)) return toast('Informe entre 5 e 2880 minutos.', true);
      const { error } = await sb.from('settings').upsert({ key: 'hold_minutes', value: String(v) }); if (error) throw error; S.hold = v; toast('Prazo salvo.');
    }
    else if (a === 'save-svc') {
      const row = t.closest('[data-svc]'); const price = Number($('[data-f="price"]', row).value);
      if (!(price >= 0)) return toast('Preço inválido.', true);
      const desc = $('[data-f="description"]', row).value.split('\n').map((x) => x.trim()).filter(Boolean).join('\n');
      if (!desc) return toast('Informe pelo menos um item do que a lavagem inclui.', true);
      const { error } = await sb.from('services').update({ price, description: desc, active: $('[data-f="active"]', row).checked }).eq('id', id); if (error) throw error; toast('Serviço atualizado.'); await loadServices();
    }
  } catch (err) { fail(err); }
});

/* ---------- início ---------- */
(async function boot() {
  if (!configured) { showLogin('Configure o Supabase em js/config.js para usar o painel.'); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (session) await enter(session.user); else showLogin();
})();
})();
