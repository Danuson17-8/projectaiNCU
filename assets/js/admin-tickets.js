import { supabase } from './supabaseClient.js';
import { requireAdminSession, wireLogoutButton } from './authGuard.js';
import { formatDateTime } from './statusUtils.js';

const tbody = document.getElementById('tickets-tbody');

const STATUS_OPTIONS = [
  { value: 'pending', label: 'รอตรวจสอบ' },
  { value: 'in_progress', label: 'กำลังดำเนินการ' },
  { value: 'resolved', label: 'แก้ไขแล้ว' },
];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

function renderRow(ticket) {
  const tr = document.createElement('tr');
  const systemName = ticket.systems ? ticket.systems.name : '(ไม่ทราบระบบ)';

  tr.innerHTML = `
    <td style="white-space: nowrap;">${escapeHtml(systemName)}</td>
    <td title="${escapeHtml(ticket.message)}" style="max-width: 320px;">${escapeHtml(truncate(ticket.message, 80))}</td>
    <td class="text-faint" style="white-space: nowrap;">${formatDateTime(ticket.created_at)}</td>
    <td></td>
    <td class="mono text-faint" title="${escapeHtml(ticket.id)}">${escapeHtml(ticket.id.slice(0, 8))}…</td>
  `;

  const statusCell = tr.children[3];
  const select = document.createElement('select');
  select.setAttribute('aria-label', `สถานะของ ticket ${ticket.id}`);
  select.style.cssText =
    'padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border); font-size: 12.5px; font-family: inherit;';

  STATUS_OPTIONS.forEach((opt) => {
    const optionEl = document.createElement('option');
    optionEl.value = opt.value;
    optionEl.textContent = opt.label;
    if (opt.value === ticket.status) optionEl.selected = true;
    select.appendChild(optionEl);
  });

  select.addEventListener('change', async () => {
    const newStatus = select.value;
    select.disabled = true;
    const { error } = await supabase.from('tickets').update({ status: newStatus }).eq('id', ticket.id);
    select.disabled = false;
    if (error) {
      alert('อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่');
      select.value = ticket.status;
      console.error(error);
      return;
    }
    ticket.status = newStatus;
  });

  statusCell.appendChild(select);
  return tr;
}

async function loadTickets() {
  const { data, error } = await supabase
    .from('tickets')
    .select('id, message, status, created_at, systems(name)')
    .order('created_at', { ascending: false });

  tbody.innerHTML = '';

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="field-error">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-faint">ยังไม่มีรายการแจ้งปัญหา</td></tr>`;
    return;
  }

  data.forEach((ticket) => tbody.appendChild(renderRow(ticket)));
}

wireLogoutButton(document.getElementById('logout-btn'));

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  loadTickets();
}

init();
