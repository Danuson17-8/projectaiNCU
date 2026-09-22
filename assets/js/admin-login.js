import { supabase } from './supabaseClient.js';

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorEl = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');

async function redirectIfAlreadySignedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = './systems.html';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  loginBtn.disabled = true;

  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value,
  });

  loginBtn.disabled = false;

  if (error) {
    errorEl.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    return;
  }

  window.location.href = './systems.html';
});

redirectIfAlreadySignedIn();
