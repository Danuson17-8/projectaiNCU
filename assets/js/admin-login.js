import { supabase } from './supabaseClient.js';

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorEl = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');

async function isAdminSession(session) {
  if (!session) return false;
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();
  return Boolean(profile && profile.is_admin);
}

async function redirectIfAlreadyAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && (await isAdminSession(session))) {
    window.location.href = './dashboard.html';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  loginBtn.disabled = true;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value,
  });

  if (error) {
    loginBtn.disabled = false;
    errorEl.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    return;
  }

  if (!(await isAdminSession(data.session))) {
    await supabase.auth.signOut();
    loginBtn.disabled = false;
    errorEl.textContent = 'บัญชีนี้ไม่มีสิทธิ์เข้าหน้าแอดมิน';
    return;
  }

  window.location.href = './dashboard.html';
});

redirectIfAlreadyAdmin();
