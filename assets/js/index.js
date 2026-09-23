import { supabase } from './supabaseClient.js';
import { requireSession, wireLogoutButton } from './authGuard.js';
import { statusLabel, statusBadgeClass, formatDateTime } from './statusUtils.js';

const ICONS = {
  login: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
  payment: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>',
  orders: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.1-1.8V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"></path><polyline points="2.32 6.16 12 11 21.68 6.16"></polyline><line x1="12" y1="22.76" x2="12" y2="11"></line></svg>',
  email: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M22 6l-10 7L2 6"></path></svg>',
  'e-document': '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>',
  'vehicle-booking': '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>',
  visa: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>',
  'student-registry': '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"></path><path d="M22 10v6"></path><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path></svg>',
  reports: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>',
};

const DEFAULT_ICON = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4"></path><line x1="12" y1="17.5" x2="12" y2="17.5"></line></svg>';

const CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C6C6BF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 4px;"><polyline points="9 18 15 12 9 6"></polyline></svg>';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderSystemCard(system) {
  const icon = ICONS[system.slug] || DEFAULT_ICON;
  const a = document.createElement('a');
  a.className = 'card card-link';
  a.href = `report.html?system=${encodeURIComponent(system.slug)}`;
  a.innerHTML = `
    <div class="card-icon">${icon}</div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 3px;">
      <span class="row" style="gap: 8px; flex-wrap: wrap;">
        <span style="font-size: 14.5px; font-weight: 600;">${escapeHtml(system.name)}</span>
        <span class="pill pill-audience" data-audience="${escapeHtml(system.audience)}">${AUDIENCE_LABEL[system.audience] || ''}</span>
      </span>
      <span style="font-size: 12.5px;" class="text-faint">${escapeHtml(system.description || '')}</span>
    </div>
    ${CHEVRON}
  `;
  return a;
}

const AUDIENCE_LABEL = { student: 'นักศึกษา', staff: 'บุคลากร' };

let allSystems = [];
let audienceFilter = '';

// Re-render the grid from allSystems using the search box + type filter
function renderSystems() {
  const grid = document.getElementById('systems-grid');
  const query = document.getElementById('system-search').value.trim().toLowerCase();
  const matches = allSystems.filter((s) => {
    if (audienceFilter && s.audience !== audienceFilter) return false;
    if (!query) return true;
    return `${s.name} ${s.description || ''}`.toLowerCase().includes(query);
  });

  grid.innerHTML = '';
  if (!matches.length) {
    grid.innerHTML = `<p class="text-faint">ไม่พบระบบที่ตรงกับการค้นหา</p>`;
    return;
  }
  matches.forEach((system) => grid.appendChild(renderSystemCard(system)));
}

function wireSystemFilters() {
  document.getElementById('system-search').addEventListener('input', renderSystems);

  const modal = document.getElementById('filter-modal');
  const form = document.getElementById('filter-form');
  const openBtn = document.getElementById('filter-open-btn');
  const dot = document.getElementById('filter-dot');

  openBtn.addEventListener('click', () => {
    // start from the filter currently applied, not the last unconfirmed pick
    form.querySelector(`input[name="audience"][value="${audienceFilter}"]`).checked = true;
    modal.showModal();
  });

  // a click on the backdrop (outside the form) closes without applying
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close('cancel');
  });

  modal.addEventListener('close', () => {
    if (modal.returnValue === 'apply') {
      audienceFilter = form.querySelector('input[name="audience"]:checked').value;
    } else if (modal.returnValue === 'clear') {
      audienceFilter = '';
    } else {
      return;
    }
    dot.hidden = !audienceFilter;
    openBtn.setAttribute(
      'aria-label',
      audienceFilter ? `กรองระบบ (${AUDIENCE_LABEL[audienceFilter]})` : 'กรองระบบ'
    );
    renderSystems();
  });
}

async function loadSystems() {
  const grid = document.getElementById('systems-grid');
  const { data, error } = await supabase
    .from('systems')
    .select('id,name,slug,description,icon_color,audience')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  grid.innerHTML = '';

  if (error) {
    grid.innerHTML = `<p class="field-error">โหลดรายการระบบไม่สำเร็จ กรุณาลองใหม่ภายหลัง</p>`;
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    grid.innerHTML = `<p class="text-faint">ยังไม่มีระบบให้เลือกแจ้งปัญหาในขณะนี้</p>`;
    return;
  }

  allSystems = data;
  renderSystems();
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function renderTicketRow(ticket) {
  const systemName = ticket.systems ? ticket.systems.name : '(ไม่ทราบระบบ)';
  const a = document.createElement('a');
  a.className = 'card';
  a.href = `report.html?ticket=${encodeURIComponent(ticket.id)}`;
  a.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 16px; text-decoration: none; color: inherit;';
  a.innerHTML = `
    <div class="stack" style="gap: 4px; min-width: 0;">
      <span style="font-size: 13.5px; font-weight: 600;">${escapeHtml(systemName)}</span>
      <span style="font-size: 12.5px;" class="text-faint">${escapeHtml(truncate(ticket.message, 90))}</span>
      <span class="mono text-faintest" style="font-size: 11px;">${formatDateTime(ticket.created_at)}</span>
    </div>
    <span class="badge ${statusBadgeClass(ticket.status)}" style="flex-shrink: 0;">
      <span class="badge-dot"></span>${statusLabel(ticket.status)}
    </span>
  `;
  return a;
}

let ticketsLoaded = false;

async function loadTickets() {
  if (ticketsLoaded) return;
  ticketsLoaded = true;

  const listEl = document.getElementById('panel-history');
  const { data, error } = await supabase
    .from('tickets')
    .select('id, message, status, created_at, systems(name)')
    .order('created_at', { ascending: false });

  listEl.innerHTML = '';

  if (error) {
    listEl.innerHTML = `<p class="field-error">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่ภายหลัง</p>`;
    console.error(error);
    ticketsLoaded = false;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<p class="text-faint">คุณยังไม่เคยแจ้งปัญหา</p>`;
    return;
  }

  data.forEach((ticket) => listEl.appendChild(renderTicketRow(ticket)));
}

function switchTab(tab) {
  const tabReport = document.getElementById('tab-report');
  const tabHistory = document.getElementById('tab-history');
  const panelReport = document.getElementById('panel-report');
  const panelHistory = document.getElementById('panel-history');
  const subtitle = document.getElementById('panel-subtitle');

  const isHistory = tab === 'history';

  tabReport.dataset.active = String(!isHistory);
  tabReport.setAttribute('aria-selected', String(!isHistory));
  tabHistory.dataset.active = String(isHistory);
  tabHistory.setAttribute('aria-selected', String(isHistory));

  panelReport.hidden = isHistory;
  panelHistory.hidden = !isHistory;
  document.getElementById('picker-controls').hidden = isHistory;
  subtitle.textContent = isHistory
    ? 'ปัญหาที่คุณเคยแจ้งไว้ และสถานะล่าสุด'
    : 'เลือกระบบที่คุณพบปัญหา เพื่อเริ่มแจ้งปัญหา';

  if (isHistory) loadTickets();
}

function wireTabs() {
  document.getElementById('tab-report').addEventListener('click', () => switchTab('report'));
  document.getElementById('tab-history').addEventListener('click', () => switchTab('history'));
}

wireLogoutButton(document.getElementById('logout-btn'), 'login.html');
wireTabs();
wireSystemFilters();

// On phones show exactly the first 9 characters of the email, then "…"
const PHONE_EMAIL_CHARS = 9;
const phoneQuery = window.matchMedia('(max-width: 560px)');

function showUserEmail(email) {
  const el = document.getElementById('user-email');
  el.title = email;
  const render = () => {
    el.textContent = phoneQuery.matches && email.length > PHONE_EMAIL_CHARS
      ? email.slice(0, PHONE_EMAIL_CHARS) + '…'
      : email;
  };
  render();
  phoneQuery.addEventListener('change', render);
}

async function init() {
  const session = await requireSession('login.html');
  if (!session) return;
  showUserEmail(session.user.email || '');
  loadSystems();

  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'history') switchTab('history');
}

init();
