import { statusLabel } from './statusUtils.js';

const STATUSES = ['pending', 'in_progress', 'resolved'];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  // also escape quotes: system names go into value="..." attributes
  return div.innerHTML.replace(/"/g, '&quot;');
}

function systemNameOf(ticket) {
  return ticket.systems ? ticket.systems.name : '(ไม่ทราบระบบ)';
}

// Search box + funnel button + <dialog> filter for a list of tickets
// (status and system, both multi-select). Used by the user's history tab
// and the admin tickets page; each page supplies its own elements and
// re-renders its list in onChange.
export function createTicketFilter({ searchInput, openBtn, dot, modal, onChange }) {
  const form = modal.querySelector('form');
  const statusBox = modal.querySelector('[data-filter-statuses]');
  const systemBox = modal.querySelector('[data-filter-systems]');

  let query = '';
  let statuses = new Set();
  let systems = new Set();

  statusBox.innerHTML = STATUSES.map((s) => `
    <label class="filter-chip">
      <input type="checkbox" name="status" value="${s}">
      <span>${statusLabel(s)}</span>
    </label>`).join('');

  const boxes = (name) => [...form.querySelectorAll(`input[name="${name}"]`)];
  const checkedValues = (name) => new Set(boxes(name).filter((b) => b.checked).map((b) => b.value));

  // Rebuild the system checkboxes from the systems present in the tickets
  function setTickets(tickets) {
    const names = [...new Set(tickets.map(systemNameOf))].sort((a, b) => a.localeCompare(b, 'th'));
    systemBox.innerHTML = names.length
      ? names.map((n) => `
        <label class="filter-chip">
          <input type="checkbox" name="system" value="${escapeHtml(n)}">
          <span>${escapeHtml(n)}</span>
        </label>`).join('')
      : '<p class="text-faint" style="margin: 0; font-size: 12.5px;">ยังไม่มีข้อมูล</p>';
    systems = new Set([...systems].filter((n) => names.includes(n)));
  }

  function matches(ticket) {
    if (statuses.size && !statuses.has(ticket.status)) return false;
    if (systems.size && !systems.has(systemNameOf(ticket))) return false;
    if (!query) return true;
    return `${systemNameOf(ticket)} ${ticket.message || ''} ${ticket.id}`.toLowerCase().includes(query);
  }

  function isActive() {
    return Boolean(query || statuses.size || systems.size);
  }

  searchInput.addEventListener('input', () => {
    query = searchInput.value.trim().toLowerCase();
    onChange();
  });

  openBtn.addEventListener('click', () => {
    // start from the filter currently applied, not the last unconfirmed picks
    boxes('status').forEach((b) => { b.checked = statuses.has(b.value); });
    boxes('system').forEach((b) => { b.checked = systems.has(b.value); });
    modal.showModal();
  });

  // a click on the backdrop (outside the form) closes without applying
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close('cancel');
  });

  modal.addEventListener('close', () => {
    if (modal.returnValue === 'apply') {
      statuses = checkedValues('status');
      systems = checkedValues('system');
      // ticking every option in a group is the same as not filtering it
      if (statuses.size === STATUSES.length) statuses = new Set();
      if (systems.size === boxes('system').length) systems = new Set();
    } else if (modal.returnValue === 'clear') {
      statuses = new Set();
      systems = new Set();
    } else {
      return;
    }
    const count = statuses.size + systems.size;
    dot.hidden = !count;
    openBtn.setAttribute('aria-label', count ? `กรองรายการ (${count} ตัวเลือก)` : 'กรองรายการ');
    onChange();
  });

  return { setTickets, matches, isActive };
}
