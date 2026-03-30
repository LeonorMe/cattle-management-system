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
  events: [],
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

    const eventsRes = await api('GET', '/events/');
    state.events = Array.isArray(eventsRes) ? eventsRes : [];

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

  const farmNameEl = document.getElementById('farm-name');
  if (farmNameEl && state.farm) farmNameEl.textContent = state.farm.name;

  renderAnimalList(state.animals.slice(0, 5)); // Just top 5 on dashboard
  renderEventList(state.events.slice(0, 5));
}

function renderEventList(events) {
  const list = document.getElementById('event-list');
  if (!list) return;

  if (events.length === 0) {
    list.innerHTML = `<p class="subtext text-center" style="padding:var(--space-md) 0">Nenhum evento recente.</p>`;
    return;
  }

  list.innerHTML = events.map(e => {
    const animal = state.animals.find(a => a.id === e.animal_id);
    return `
      <div class="event-row">
        <div class="event-dot"></div>
        <div class="event-info">
          <div class="event-title">${e.event_type} — ${animal?.name ?? animal?.registration_id ?? 'Animal'}</div>
          <div class="event-date">${new Date(e.date).toLocaleDateString('pt-PT')}</div>
        </div>
      </div>
    `;
  }).join('');
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
      populateParentDropdowns('a-mother', 'a-father');
      showPage('page-add-animal');
    } else if (target === 'page-settings') {
      showPage('page-settings');
    }
  });
});

document.querySelector('[data-page="page-animals"]')?.addEventListener('click', () => {
  renderAnimalList(state.animals);
  showPage('page-animals');
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
    mother_id:       document.getElementById('a-mother').value || null,
    father_id:       document.getElementById('a-father').value || null,
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

// ── Animal Detail ─────────────────────────────────
async function showAnimalDetail(id) {
  const animal = state.animals.find(a => a.id === id);
  if (!animal) return;

  document.getElementById('d-name').textContent = animal.name ?? 'Sem nome';
  document.getElementById('d-reg-id').textContent = `# ${animal.registration_id}`;
  document.getElementById('d-status').textContent = translateStatus(animal.status);
  document.getElementById('d-gender').textContent = animal.gender === 'F' ? 'Fêmea 🐄' : 'Macho 🐂';
  document.getElementById('d-breed').textContent = animal.breed ?? '—';
  document.getElementById('d-birth').textContent = animal.birth_date ? new Date(animal.birth_date).toLocaleDateString('pt-PT') : '—';
  document.getElementById('d-avatar').textContent = animal.gender === 'F' ? '🐄' : '🐂';

  // Events for this animal
  const animalEvents = state.events
    .filter(e => e.animal_id === id)
    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

  const eventList = document.getElementById('detail-event-list');
  if (eventList) {
    if (animalEvents.length === 0) {
      eventList.innerHTML = `<p class="subtext text-center">Nenhum evento registado.</p>`;
    } else {
      eventList.innerHTML = animalEvents.map(e => `
        <div class="event-row">
          <div class="event-dot"></div>
          <div class="event-info">
            <div class="event-title">${translateEventType(e.event_type)}</div>
            <div class="event-date">${new Date(e.event_date).toLocaleDateString('pt-PT')}</div>
            ${e.description ? `<div class="subtext" style="font-size:12px; margin-top:2px">${e.description}</div>` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  // Set up action buttons
  document.getElementById('btn-edit-animal-trigger').onclick = () => showEditAnimal(animal);
  document.getElementById('btn-delete-animal').onclick = () => handleDeleteAnimal(animal);
  document.getElementById('btn-log-event').onclick = () => {
    document.getElementById('event-animal-id').value = id;
    document.getElementById('ev-date').value = new Date().toISOString().split('T')[0];
    showPage('page-add-event');
  };

  loadGenealogy(id);

  showPage('page-animal-detail');
}

function translateEventType(type) {
  const map = {
    Vaccination: 'Vacinação 💉',
    Medication:  'Medicação 💊',
    Heat:        'Cio 🔥',
    Pregnancy:   'Prenhez 🤰',
    Birth:       'Nascimento 🐣',
    Other:       'Outro'
  };
  return map[type] ?? type;
}

document.getElementById('form-add-event')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const animal_id = document.getElementById('event-animal-id').value;
  const btn       = document.getElementById('btn-save-event');
  const errEl     = document.getElementById('add-event-error');

  errEl.classList.remove('visible');
  setButtonLoading(btn, true);

  const payload = {
    animal_id,
    event_type:  document.getElementById('ev-type').value,
    event_date:  document.getElementById('ev-date').value,
    description: document.getElementById('ev-desc').value.trim() || null,
  };

  try {
    const newEvent = await api('POST', '/events/', payload);
    state.events.unshift(newEvent);
    showToast('Evento registado!', 'success');
    showAnimalDetail(animal_id);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('visible');
  } finally {
    setButtonLoading(btn, false);
  }
});

function showEditAnimal(animal) {
  populateParentDropdowns('e-mother', 'e-father', animal.id);

  document.getElementById('e-id').value = animal.id;
  document.getElementById('e-reg-id').value = animal.registration_id;
  document.getElementById('e-name').value = animal.name ?? '';
  document.getElementById('e-breed').value = animal.breed ?? '';
  document.getElementById('e-birth').value = animal.birth_date ?? '';
  document.getElementById('e-status').value = animal.status;
  document.getElementById('e-mother').value = animal.mother_id ?? '';
  document.getElementById('e-father').value = animal.father_id ?? '';

  showPage('page-edit-animal');
}

document.getElementById('form-edit-animal')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id    = document.getElementById('e-id').value;
  const btn   = document.getElementById('btn-update-animal');
  const errEl = document.getElementById('edit-animal-error');

  errEl.classList.remove('visible');
  setButtonLoading(btn, true);

  const payload = {
    name:       document.getElementById('e-name').value.trim() || null,
    breed:      document.getElementById('e-breed').value.trim() || null,
    birth_date: document.getElementById('e-birth').value || null,
    status:     document.getElementById('e-status').value,
    mother_id:  document.getElementById('e-mother').value || null,
    father_id:  document.getElementById('e-father').value || null,
  };

  try {
    const updated = await api('PATCH', `/animals/${id}`, payload);
    // Update local state
    const index = state.animals.findIndex(a => a.id === id);
    if (index !== -1) state.animals[index] = updated;

    showToast('Animal atualizado!', 'success');
    showAnimalDetail(id);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('visible');
  } finally {
    setButtonLoading(btn, false);
  }
});

async function handleDeleteAnimal(animal) {
  if (!confirm(`Tem a certeza que deseja eliminar ${animal.name ?? animal.registration_id}?`)) return;

  try {
    await api('DELETE', `/animals/${animal.id}`);
    state.animals = state.animals.filter(a => a.id !== animal.id);
    showToast('Animal eliminado.', 'success');
    showPage('page-animals');
    renderAnimalList(state.animals);
  } catch (err) {
    showToast(err.message, 'error');
  }
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

// ── Data Management (Export / Import) ─────────────
document.getElementById('btn-export-excel')?.addEventListener('click', async () => {
  const token = auth.getToken();
  if (!token) return;
  
  try {
    const res = await fetch(`${API_BASE}/animals/export/excel?format=xlsx`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail ?? 'Falha ao exportar dados');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animais_export.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Exportação concluída!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

document.getElementById('btn-import-excel')?.addEventListener('click', () => {
  document.getElementById('import-file-input')?.click();
});

document.getElementById('import-file-input')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = ''; // reset input
  
  const btn = document.getElementById('btn-import-excel');
  setButtonLoading(btn, true);
  
  const token = auth.getToken();
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const res = await fetch(`${API_BASE}/animals/import/excel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.detail ?? 'Falha ao importar dados');
    
    showToast(`Importados: ${data.imported}, Atualizados: ${data.updated}`, 'success');
    
    // Refresh animals list in state
    const animalsRes = await api('GET', '/animals/');
    state.animals = Array.isArray(animalsRes) ? animalsRes : [];
    renderDashboard();
    renderAnimalList(state.animals);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonLoading(btn, false);
  }
});

// ── Genealogy logic ───────────────────────────────
function populateParentDropdowns(selectMotherId, selectFatherId, currentAnimalId = null) {
  const motherSelect = document.getElementById(selectMotherId);
  const fatherSelect = document.getElementById(selectFatherId);
  if (!motherSelect || !fatherSelect) return;

  motherSelect.innerHTML = '<option value="">Desconhecida / Nenhuma</option>';
  fatherSelect.innerHTML = '<option value="">Desconhecido / Nenhum</option>';

  const sortedAnimals = [...state.animals].sort((a,b) => (a.name||a.registration_id).localeCompare(b.name||b.registration_id));
  
  for (const a of sortedAnimals) {
    if (a.id === currentAnimalId) continue;
    const label = a.name ? `${a.name} (#${a.registration_id})` : `#${a.registration_id}`;
    if (a.gender === 'F') {
      motherSelect.innerHTML += `<option value="${a.id}">${label}</option>`;
    } else if (a.gender === 'M') {
      fatherSelect.innerHTML += `<option value="${a.id}">${label}</option>`;
    }
  }
}

async function loadGenealogy(animalId) {
  const container = document.getElementById('detail-genealogy-list');
  if (!container) return;
  container.innerHTML = '<div class="text-center" style="padding:var(--space-md); color:var(--color-text-muted)">A carregar...</div>';
  
  try {
    const data = await api('GET', `/animals/${animalId}/genealogy`);
    let html = '';
    
    // Parents
    html += '<div class="mb-md"><strong style="display:block;margin-bottom:8px;color:var(--color-text-muted);font-size:12px;text-transform:uppercase;">Progenitores</strong><div style="display:flex;flex-direction:column;gap:8px;">';
    
    if (data.mother) {
      html += `<div class="animal-card" style="cursor:pointer" onclick="showAnimalDetail('${data.mother.id}')">
        <div class="animal-avatar">🐄</div>
        <div class="animal-info">
          <div class="animal-name">${data.mother.name ?? 'Sem nome'} <span style="font-size:12px;color:var(--color-text-muted);font-weight:normal">(Mãe)</span></div>
          <div class="animal-tag"># ${data.mother.registration_id}</div>
        </div>
      </div>`;
    } else {
      html += '<div class="subtext">Mãe desconhecida</div>';
    }
    
    html += '<div style="height:4px"></div>';
    
    if (data.father) {
      html += `<div class="animal-card" style="cursor:pointer" onclick="showAnimalDetail('${data.father.id}')">
        <div class="animal-avatar">🐂</div>
        <div class="animal-info">
          <div class="animal-name">${data.father.name ?? 'Sem nome'} <span style="font-size:12px;color:var(--color-text-muted);font-weight:normal">(Pai)</span></div>
          <div class="animal-tag"># ${data.father.registration_id}</div>
        </div>
      </div>`;
    } else {
      html += '<div class="subtext">Pai desconhecido</div>';
    }
    html += '</div></div>';
    
    // Children
    html += '<div><strong style="display:block;margin-bottom:8px;color:var(--color-text-muted);font-size:12px;text-transform:uppercase;">Descendentes</strong><div style="display:flex;flex-direction:column;gap:8px;">';
    if (!data.children || data.children.length === 0) {
      html += '<div class="subtext">Sem descendentes registados</div>';
    } else {
      html += data.children.map(c => `
        <div class="animal-card" style="cursor:pointer" onclick="showAnimalDetail('${c.id}')">
          <div class="animal-avatar">${c.gender === 'F' ? '🐄' : '🐂'}</div>
          <div class="animal-info">
            <div class="animal-name">${c.name ?? 'Sem nome'}</div>
            <div class="animal-tag"># ${c.registration_id}</div>
          </div>
        </div>
      `).join('');
    }
    html += '</div></div>';
    
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="text-center" style="color:var(--color-danger);padding:var(--space-md)">Erro ao carregar genealogia.</div>`;
  }
}

