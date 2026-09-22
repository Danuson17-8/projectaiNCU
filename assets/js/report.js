import { supabase } from './supabaseClient.js';
import { statusLabel, statusBadgeClass, formatDateTime } from './statusUtils.js';

const chatLog = document.getElementById('chat-log');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatInputRow = document.getElementById('chat-input-row');
const statusPanel = document.getElementById('status-panel');
const statusTicketId = document.getElementById('status-ticket-id');
const statusBadge = document.getElementById('status-badge');
const topbarTitle = document.getElementById('topbar-title');

const CANNED_DECLINE =
  'ขออภัยครับ ตอนนี้ระบบรับแจ้งได้เฉพาะปัญหาแรกที่แจ้งไปเท่านั้น หากมีเรื่องอื่นเพิ่มเติม รบกวนรอทีมงานติดต่อกลับตามหมายเลข ticket นี้ หรือแจ้งเป็นรายการใหม่ครับ';

function appendRow(role, text) {
  const row = document.createElement('div');
  row.className = `chat-row chat-row-${role === 'user' ? 'user' : 'bot'}`;

  const avatar = document.createElement('div');
  avatar.className = role === 'user' ? 'avatar' : 'avatar avatar-square';
  avatar.style.background = role === 'user' ? '#E4E4E0' : '#0F6C61';
  avatar.style.color = role === 'user' ? '#6B6B65' : '#FFFFFF';
  avatar.textContent = role === 'user' ? 'U' : 'AI';

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble-${role === 'user' ? 'user' : 'bot'}`;
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatLog.appendChild(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function showStatusPanel(ticketId, status) {
  statusPanel.hidden = false;
  statusTicketId.textContent = ticketId;
  statusBadge.className = `badge ${statusBadgeClass(status)}`;
  statusBadge.innerHTML = `<span class="badge-dot"></span>${statusLabel(status)}`;
}

function hideInputRow() {
  chatInputRow.hidden = true;
}

async function runSystemMode(slug) {
  const { data: system, error } = await supabase
    .from('systems')
    .select('id,name,slug,description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !system) {
    appendRow('bot', 'ไม่พบระบบนี้ หรือระบบนี้ถูกปิดใช้งานชั่วคราว กรุณากลับไปเลือกระบบใหม่');
    hideInputRow();
    return;
  }

  topbarTitle.textContent = `Issue Desk / ${system.name}`;
  appendRow('bot', `รับทราบครับ กรุณาอธิบายปัญหาที่พบเกี่ยวกับ "${system.name}" ได้เลยครับ`);

  let ticketCreated = false;

  async function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendRow('user', text);
    chatInput.value = '';

    if (!ticketCreated) {
      chatSendBtn.disabled = true;
      const { data: ticket, error: insertError } = await supabase
        .from('tickets')
        .insert({ system_id: system.id, message: text })
        .select()
        .single();
      chatSendBtn.disabled = false;

      if (insertError || !ticket) {
        appendRow('bot', 'ขออภัยครับ เกิดข้อผิดพลาดในการบันทึก กรุณาลองส่งข้อความอีกครั้ง');
        console.error(insertError);
        return;
      }

      ticketCreated = true;
      showStatusPanel(ticket.id, ticket.status);
      appendRow(
        'bot',
        `รับทราบครับ เก็บข้อมูลที่แจ้งไว้แล้ว ทีมงานจะตรวจสอบและอัปเดตสถานะให้ทราบครับ (สถานะปัจจุบัน: ${statusLabel(ticket.status)}) — จดหมายเลข ticket ด้านบนไว้เพื่อติดตามสถานะภายหลังได้ครับ`
      );
    } else {
      appendRow('bot', CANNED_DECLINE);
    }
  }

  chatSendBtn.addEventListener('click', handleSend);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });
}

async function runTrackMode(ticketId) {
  hideInputRow();

  const { data, error } = await supabase.rpc('track_ticket', { ticket_id: ticketId });
  const row = Array.isArray(data) ? data[0] : data;

  if (error || !row) {
    appendRow('bot', 'ไม่พบหมายเลข ticket นี้ กรุณาตรวจสอบหมายเลขอีกครั้ง หรือกลับไปแจ้งปัญหาใหม่');
    return;
  }

  topbarTitle.textContent = `Issue Desk / ${row.system_name}`;
  showStatusPanel(row.id, row.status);
  appendRow('user', row.message);
  appendRow(
    'bot',
    `สถานะล่าสุดของ ticket นี้คือ "${statusLabel(row.status)}" (แจ้งเมื่อ ${formatDateTime(row.created_at)})`
  );
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('system');
  const ticketId = params.get('ticket');

  if (slug) {
    runSystemMode(slug);
  } else if (ticketId) {
    runTrackMode(ticketId);
  } else {
    window.location.href = 'index.html';
  }
}

init();
