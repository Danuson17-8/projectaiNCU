import { supabase } from './supabaseClient.js';
import { requireSession, wireLogoutButton } from './authGuard.js';

const tbody = document.getElementById('systems-tbody');
const panel = document.getElementById('system-panel');
const panelTitle = document.getElementById('panel-title');
const form = document.getElementById('system-form');
const formError = document.getElementById('system-form-error');
const idInput = document.getElementById('sys-id');
const nameInput = document.getElementById('sys-name');
const slugInput = document.getElementById('sys-slug');
const descInput = document.getElementById('sys-desc');
const activeInput = document.getElementById('sys-active');

const EDIT_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B6B65" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>';
const DELETE_ICON =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B3311C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function selectedColor() {
  const checked = form.querySelector('input[name="sys-color"]:checked');
  return checked ? checked.value : '#0F6C61';
}

function setSelectedColor(hex) {
  const radios = form.querySelectorAll('input[name="sys-color"]');
  let matched = false;
  radios.forEach((r) => {
    if (r.value.toLowerCase() === (hex || '').toLowerCase()) {
      r.checked = true;
      matched = true;
    }
  });
  if (!matched) radios[0].checked = true;
}

function openPanelForCreate() {
  form.reset();
  idInput.value = '';
  panelTitle.textContent = 'เพิ่มระบบใหม่';
  activeInput.checked = true;
  setSelectedColor('#0F6C61');
  formError.textContent = '';
  panel.hidden = false;
}

function openPanelForEdit(system) {
  idInput.value = system.id;
  nameInput.value = system.name;
  slugInput.value = system.slug;
  descInput.value = system.description || '';
  activeInput.checked = system.is_active;
  setSelectedColor(system.icon_color);
  panelTitle.textContent = `แก้ไข: ${system.name}`;
  formError.textContent = '';
  panel.hidden = false;
}

function closePanel() {
  panel.hidden = true;
  form.reset();
}

function renderRow(system) {
  const tr = document.createElement('tr');

  const statusBadge = system.is_active
    ? '<span class="badge badge-active"><span class="badge-dot"></span>Active</span>'
    : '<span class="badge badge-inactive"><span class="badge-dot"></span>Inactive</span>';

  tr.innerHTML = `
    <td>
      <div class="row">
        <div class="card-icon" style="width: 28px; height: 28px; border-radius: 7px; color: ${escapeHtml(system.icon_color)};">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle></svg>
        </div>
        <span style="font-weight: 500;">${escapeHtml(system.name)}</span>
      </div>
    </td>
    <td class="mono text-faint">${escapeHtml(system.slug)}</td>
    <td>${statusBadge}</td>
    <td>
      <div class="row" style="gap: 6px;">
        <button class="btn btn-icon" data-action="edit" aria-label="แก้ไข${escapeHtml(system.name)}">${EDIT_ICON}</button>
        <button class="btn btn-icon" data-action="delete" aria-label="ลบ${escapeHtml(system.name)}">${DELETE_ICON}</button>
      </div>
    </td>
  `;

  tr.querySelector('[data-action="edit"]').addEventListener('click', () => openPanelForEdit(system));
  tr.querySelector('[data-action="delete"]').addEventListener('click', () => deleteSystem(system));

  return tr;
}

async function loadSystems() {
  const { data, error } = await supabase
    .from('systems')
    .select('*')
    .order('created_at', { ascending: true });

  tbody.innerHTML = '';

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="field-error">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-faint">ยังไม่มีระบบ กด "+ เพิ่มระบบใหม่" เพื่อเริ่มต้น</td></tr>`;
    return;
  }

  data.forEach((system) => tbody.appendChild(renderRow(system)));
}

async function deleteSystem(system) {
  const confirmed = window.confirm(
    `ลบระบบ "${system.name}" ใช่หรือไม่? การลบระบบนี้จะลบรายการแจ้งปัญหา (ticket) ที่เกี่ยวข้องทั้งหมดด้วย`
  );
  if (!confirmed) return;

  const { error } = await supabase.from('systems').delete().eq('id', system.id);
  if (error) {
    alert('ลบไม่สำเร็จ กรุณาลองใหม่');
    console.error(error);
    return;
  }
  loadSystems();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';

  const payload = {
    name: nameInput.value.trim(),
    slug: slugInput.value.trim().toLowerCase(),
    description: descInput.value.trim(),
    icon_color: selectedColor(),
    is_active: activeInput.checked,
  };

  if (!payload.name || !payload.slug) {
    formError.textContent = 'กรุณากรอกชื่อระบบและ slug';
    return;
  }

  const id = idInput.value;
  const { error } = id
    ? await supabase.from('systems').update(payload).eq('id', id)
    : await supabase.from('systems').insert(payload);

  if (error) {
    formError.textContent = error.code === '23505' ? 'slug นี้ถูกใช้แล้ว กรุณาใช้ค่าอื่น' : 'บันทึกไม่สำเร็จ กรุณาลองใหม่';
    console.error(error);
    return;
  }

  closePanel();
  loadSystems();
});

document.getElementById('add-system-btn').addEventListener('click', openPanelForCreate);
document.getElementById('cancel-panel-btn').addEventListener('click', closePanel);
wireLogoutButton(document.getElementById('logout-btn'));

async function init() {
  const session = await requireSession();
  if (!session) return;
  loadSystems();
}

init();
