import { supabase } from './supabaseClient.js';

const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordField = document.getElementById('confirm-password-field');
const confirmPasswordInput = document.getElementById('confirm-password');
const errorEl = document.getElementById('auth-error');
const successEl = document.getElementById('auth-success');
const submitBtn = document.getElementById('submit-btn');
const formTitle = document.getElementById('form-title');
const formSubtitle = document.getElementById('form-subtitle');
const togglePrompt = document.getElementById('toggle-prompt');
const toggleModeBtn = document.getElementById('toggle-mode-btn');

let mode = 'login'; // 'login' | 'signup'

function applyMode() {
  errorEl.textContent = '';
  successEl.style.display = 'none';
  if (mode === 'login') {
    formTitle.textContent = 'เข้าสู่ระบบ';
    formSubtitle.textContent = 'เข้าสู่ระบบเพื่อแจ้งปัญหาและติดตามสถานะที่เคยแจ้งไว้';
    submitBtn.textContent = 'เข้าสู่ระบบ';
    togglePrompt.textContent = 'ยังไม่มีบัญชี?';
    toggleModeBtn.textContent = 'สมัครสมาชิก';
    confirmPasswordField.hidden = true;
    confirmPasswordInput.required = false;
    confirmPasswordInput.value = '';
  } else {
    formTitle.textContent = 'สมัครสมาชิก';
    formSubtitle.textContent = 'สร้างบัญชีเพื่อเริ่มแจ้งปัญหาการใช้งานระบบ';
    submitBtn.textContent = 'สมัครสมาชิก';
    togglePrompt.textContent = 'มีบัญชีอยู่แล้ว?';
    toggleModeBtn.textContent = 'เข้าสู่ระบบ';
    confirmPasswordField.hidden = false;
    confirmPasswordInput.required = true;
  }
}

toggleModeBtn.addEventListener('click', () => {
  mode = mode === 'login' ? 'signup' : 'login';
  applyMode();
});

async function redirectIfAlreadySignedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = './index.html';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  successEl.style.display = 'none';
  submitBtn.disabled = true;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (mode === 'login') {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    submitBtn.disabled = false;
    if (error) {
      errorEl.textContent = error.message.includes('Email not confirmed')
        ? 'บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณาตรวจสอบกล่องอีเมลแล้วกดลิงก์ยืนยันก่อนเข้าสู่ระบบ'
        : 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      return;
    }
    window.location.href = './index.html';
  } else {
    if (password !== confirmPasswordInput.value) {
      submitBtn.disabled = false;
      errorEl.textContent = 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน';
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    submitBtn.disabled = false;
    if (error) {
      errorEl.textContent = error.message.includes('already registered')
        ? 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน'
        : 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่';
      return;
    }
    if (data.session) {
      window.location.href = './index.html';
      return;
    }
    mode = 'login';
    applyMode();
    successEl.textContent = 'สมัครสำเร็จ กรุณายืนยันตัวตนผ่านอีเมลที่ส่งไปให้ แล้วกลับมาเข้าสู่ระบบอีกครั้ง';
    successEl.style.display = 'block';
  }
});

applyMode();
redirectIfAlreadySignedIn();
