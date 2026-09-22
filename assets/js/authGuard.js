import { supabase } from './supabaseClient.js';

export async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = './login.html';
    return null;
  }
  return session;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = './login.html';
}

export function wireLogoutButton(buttonEl) {
  if (!buttonEl) return;
  buttonEl.addEventListener('click', () => {
    logout();
  });
}
