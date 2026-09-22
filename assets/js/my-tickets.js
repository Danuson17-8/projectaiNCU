import { supabase } from './supabaseClient.js';
import { requireSession, wireLogoutButton } from './authGuard.js';
import { statusLabel, statusBadgeClass, formatDateTime } from './statusUtils.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
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

async function loadTickets() {
  const listEl = document.getElementById('tickets-list');
  const { data, error } = await supabase
    .from('tickets')
    .select('id, message, status, created_at, systems(name)')
    .order('created_at', { ascending: false });

  listEl.innerHTML = '';

  if (error) {
    listEl.innerHTML = `<p class="field-error">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่ภายหลัง</p>`;
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<p class="text-faint">คุณยังไม่เคยแจ้งปัญหา</p>`;
    return;
  }

  data.forEach((ticket) => listEl.appendChild(renderTicketRow(ticket)));
}

wireLogoutButton(document.getElementById('logout-btn'), 'login.html');

async function init() {
  const session = await requireSession('login.html');
  if (!session) return;
  document.getElementById('user-email').textContent = session.user.email || '';
  loadTickets();
}

init();
