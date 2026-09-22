import { supabase } from './supabaseClient.js';
import { requireSession, wireLogoutButton } from './authGuard.js';

const ICONS = {
  login: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
  payment: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>',
  orders: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.1-1.8V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"></path><polyline points="2.32 6.16 12 11 21.68 6.16"></polyline><line x1="12" y1="22.76" x2="12" y2="11"></line></svg>',
  email: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M22 6l-10 7L2 6"></path></svg>',
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
      <span style="font-size: 14.5px; font-weight: 600;">${escapeHtml(system.name)}</span>
      <span style="font-size: 12.5px;" class="text-faint">${escapeHtml(system.description || '')}</span>
    </div>
    ${CHEVRON}
  `;
  return a;
}

async function loadSystems() {
  const grid = document.getElementById('systems-grid');
  const { data, error } = await supabase
    .from('systems')
    .select('id,name,slug,description,icon_color')
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

  data.forEach((system) => grid.appendChild(renderSystemCard(system)));
}

wireLogoutButton(document.getElementById('logout-btn'), 'login.html');

async function init() {
  const session = await requireSession('login.html');
  if (!session) return;
  document.getElementById('user-email').textContent = session.user.email || '';
  loadSystems();
}

init();
