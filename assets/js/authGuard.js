import { supabase } from './supabaseClient.js';

export async function requireSession(loginPath = './login.html') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = loginPath;
    return null;
  }
  return session;
}

export async function requireAdminSession(loginPath = './login.html') {
  const session = await requireSession(loginPath);
  if (!session) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (error || !profile || !profile.is_admin) {
    await supabase.auth.signOut();
    window.location.href = loginPath;
    return null;
  }

  return session;
}

// Show the signed-in admin's email in the sidebar footer (full address on hover)
export function showSidebarUser(session) {
  const el = document.getElementById('sidebar-user-email');
  if (!el || !session) return;
  el.textContent = session.user.email || '';
  el.title = session.user.email || '';
}

export async function logout(redirectPath = './login.html') {
  await supabase.auth.signOut();
  window.location.href = redirectPath;
}

export function wireLogoutButton(buttonEl, redirectPath) {
  if (!buttonEl) return;
  buttonEl.addEventListener('click', () => {
    logout(redirectPath);
  });
}
