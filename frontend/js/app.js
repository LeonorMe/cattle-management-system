const API_BASE = 'http://127.0.0.1:8000/api/v1';

// ── Auth helpers ──────────────────────────────────
const auth = {
  getToken: () => localStorage.getItem('access_token'),
  setToken: (t) => localStorage.setItem('access_token', t),
  clear:    () => localStorage.removeItem('access_token'),
  isLoggedIn: () => !!localStorage.getItem('access_token'),
};

// ── API client ────────────────────────────────────
async function api(method, path, body = null, auth_token = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = auth_token ?? auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  if (res.status === 204) return null;

  // Guard: only parse JSON if the response is actually JSON
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return text;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? `Server error (${res.status})`);
  return data;
}

// Form-encoded POST (for OAuth2 login)
async function apiForm(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(formData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Request failed');
  return data;
}

// ── Toast notifications ───────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Page routing ──────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);
}

// ── Button loading state ──────────────────────────
function setButtonLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText ?? btn.innerHTML;
    btn.disabled = false;
  }
}

// ── App State ─────────────────────────────────────
const state = {
  user: null,
  farm: null,
  animals: [],
};

// ── On Load ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (auth.isLoggedIn()) {
    initApp();
  } else {
    showPage('page-splash');
  }
});

// ── Login ─────────────────────────────────────────
document.getElementById('btn-go-login')?.addEventListener('click', () => showPage('page-login'));
document.getElementById('btn-go-register')?.addEventListener('click', () => showPage('page-register'));
document.getElementById('link-go-register')?.addEventListener('click', (e) => { e.preventDefault(); showPage('page-register'); });
document.getElementById('link-go-login')?.addEventListener('click', (e) => { e.preventDefault(); showPage('page-login'); });

document.getElementById('form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  const emailEl = document.getElementById('login-email');
  const passEl  = document.getElementById('login-password');
  const errEl   = document.getElementById('login-error');

  setButtonLoading(btn, true);
  errEl.classList.remove('visible');

  try {
    const data = await apiForm('/auth/access-token', {
      username: emailEl.value.trim(),
      password: passEl.value,
    });
    auth.setToken(data.access_token);
    showToast('Bem-vindo! 🐄', 'success');
    initApp();
  } catch (err) {
    errEl.textContent = 'Email ou senha incorretos.';
    errEl.classList.add('visible');
  } finally {
    setButtonLoading(btn, false);
  }
});

// ── Register ──────────────────────────────────────
document.getElementById('form-register')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn   = document.getElementById('btn-register');
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');

  setButtonLoading(btn, true);
  errEl.classList.remove('visible');

  try {
    await api('POST', '/auth/register', { name, email, password: pass });
    showToast('Conta criada com sucesso!', 'success');
    showPage('page-login');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('visible');
  } finally {
    setButtonLoading(btn, false);
  }
});

// ── Password visibility toggle ────────────────────
document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.input-wrapper').querySelector('input');
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.textContent = isPass ? '🙈' : '👁️';
  });
});

// ── App Initialization ────────────────────────────
async function initApp() {
  showPage('page-loading');
  try {
    // Load user profile first — if token is invalid this will throw
    state.user = await api('GET', '/users/me');

    // Load farm + animals in parallel; gracefully handle 404 (no farm yet)
    const [farmRes, animalsRes] = await Promise.allSettled([
      api('GET', '/farms/me'),
      api('GET', '/animals/'),
    ]);

    if (farmRes.status === 'fulfilled' && farmRes.value) {
      state.farm = farmRes.value;
    }
    if (animalsRes.status === 'fulfilled' && Array.isArray(animalsRes.value)) {
      state.animals = animalsRes.value;
    }

    // If user has no farm yet, show the setup page
    if (!state.farm) {
      showPage('page-setup-farm');
      return;
    }

    renderDashboard();
    showPage('page-dashboard');
  } catch (err) {
    // Token expired or invalid — back to splash
    auth.clear();
    showPage('page-splash');
  }
}

// ── Dashboard Render ──────────────────────────────
function renderDashboard() {
  const total    = state.animals.length;
  const active   = state.animals.filter(a => a.status === 'Active').length;
  const female   = state.animals.filter(a => a.gender === 'F').length;
  const male     = state.animals.filter(a => a.gender === 'M').length;

  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-active').textContent  = active;
  document.getElementById('stat-female').textContent  = female;
  document.getElementById('stat-male').textContent    = male;

  const farmName = document.getElementById('farm-name');
  if (farmName && state.farm) farmName.textContent = state.farm.name;

  renderAnimalList(state.animals);
}

function renderAnimalList(animals) {
  const list = document.getElementById('animal-list');
  if (!list) return;

  if (animals.length === 0) {
    list.innerHTML = `<div class="text-center" style="padding:var(--space-xl) 0; color:var(--color-text-muted)">
      <div style="font-size:48px">🐄</div>
      <p class="subtext" style="margin-top:var(--space-sm)">Sem animais registados ainda.</p>
    </div>`;
    return;
  }

  list.innerHTML = animals.map(a => `
    <div class="animal-card mb-sm" data-id="${a.id}">
      <div class="animal-avatar">${a.gender === 'F' ? '🐄' : '🐂'}</div>
      <div class="animal-info">
        <div class="animal-name">${a.name ?? 'Sem nome'}</div>
        <div class="animal-tag"># ${a.registration_id} · ${a.breed ?? 'Raça desconhecida'}</div>
      </div>
      <span class="badge badge-${a.status.toLowerCase()}">${translateStatus(a.status)}</span>
    </div>
  `).join('');

  list.querySelectorAll('.animal-card').forEach(card => {
    card.addEventListener('click', () => showAnimalDetail(card.dataset.id));
  });
}

function translateStatus(status) {
  return { Active: 'Ativo', Sold: 'Vendido', Deceased: 'Falecido' }[status] ?? status;
}

// ── Bottom Nav ────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const target = item.dataset.page;
    if (target === 'page-dashboard') {
      renderDashboard();
      showPage('page-dashboard');
    } else if (target === 'page-animals') {
      renderAnimalList(state.animals);
      showPage('page-animals');
    } else if (target === 'page-add-animal') {
      showPage('page-add-animal');
    } else if (target === 'page-settings') {
      showPage('page-settings');
    }
  });
});

// ── Add Animal Form ───────────────────────────────
document.getElementById('form-add-animal')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn   = document.getElementById('btn-add-animal');
  const errEl = document.getElementById('add-animal-error');
  errEl.classList.remove('visible');
  setButtonLoading(btn, true);

  const payload = {
    registration_id: document.getElementById('a-reg-id').value.trim(),
    name:            document.getElementById('a-name').value.trim() || null,
    breed:           document.getElementById('a-breed').value.trim() || null,
    gender:          document.getElementById('a-gender').value,
    birth_date:      document.getElementById('a-birth').value || null,
    status:          document.getElementById('a-status').value,
  };

  try {
    const animal = await api('POST', '/animals/', payload);
    state.animals.unshift(animal);
    showToast(`${animal.name ?? animal.registration_id} adicionado!`, 'success');
    showPage('page-dashboard');
    renderDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('visible');
  } finally {
    setButtonLoading(btn, false);
  }
});

// ── Animal Detail (placeholder) ───────────────────
function showAnimalDetail(id) {
  const animal = state.animals.find(a => a.id === id);
  if (!animal) return;
  showToast(`${animal.name ?? animal.registration_id} — Em breve!`, 'info');
}

// ── Setup Farm Page ───────────────────────────────
document.getElementById('form-create-farm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn   = document.getElementById('btn-create-farm');
  const errEl = document.getElementById('farm-error');
  errEl.classList.remove('visible');
  setButtonLoading(btn, true);

  try {
    const farm = await api('POST', '/farms/', {
      name:     document.getElementById('farm-name-input').value.trim(),
      location: document.getElementById('farm-location').value.trim() || null,
    });
    state.farm = farm;
    showToast(`Quinta "${farm.name}" criada!`, 'success');
    const animalsRes = await api('GET', '/animals/');
    state.animals = animalsRes ?? [];
    renderDashboard();
    showPage('page-dashboard');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('visible');
  } finally {
    setButtonLoading(btn, false);
  }
});

// ── Join Farm ─────────────────────────────────────
document.getElementById('btn-join-farm')?.addEventListener('click', async () => {
  const id = document.getElementById('join-farm-id').value.trim();
  if (!id) return;
  try {
    const farm = await api('POST', `/farms/join/${id}`);
    state.farm = farm;
    showToast(`Juntou-se à quinta "${farm.name}"!`, 'success');
    showPage('page-dashboard');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ── Logout ────────────────────────────────────────
document.getElementById('btn-logout')?.addEventListener('click', () => {
  auth.clear();
  state.user = null;
  state.farm = null;
  state.animals = [];
  showPage('page-splash');
  showToast('Sessão terminada.', 'info');
});
