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

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
    });
  } catch (err) {
    if (state.isOffline) {
        // Handle mutation queueing within handlers for better control
        throw new Error('OFFLINE');
    }
    throw err;
  }

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
  notifications: [],
  team: [],
  isOffline: !navigator.onLine,
  mutationQueue: JSON.parse(localStorage.getItem('mutation_queue') || '[]'),
};

// ── IndexedDB Helper ──────────────────────────────
const db = {
  name: 'cattle_ms_db',
  version: 1,
  
  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      request.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('animals')) d.createObjectStore('animals', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('events'))  d.createObjectStore('events',  { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta'))    d.createObjectStore('meta',    { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror   = () => reject(request.error);
    });
  },

  async save(storeName, data) {
    const d = await this.open();
    const tx = d.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    if (Array.isArray(data)) {
      store.clear();
      data.forEach(item => store.put(item));
    } else {
      store.put(data);
    }
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  async getAll(storeName) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const tx = d.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },

  async clear(storeName) {
    const d = await this.open();
    const tx = d.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
  }
};

// ── Offline status handling ──────────────────────
window.addEventListener('online',  () => { 
  state.isOffline = false; 
  updateOfflineUI(); 
  processMutationQueue();
});
window.addEventListener('offline', () => { 
  state.isOffline = true;  
  updateOfflineUI(); 
});

function updateOfflineUI() {
  const banner = document.getElementById('offline-indicator');
  if (banner) banner.style.display = state.isOffline ? 'block' : 'none';
}

// ── Mutation Queue (Offline Writes) ──────────────
async function queueMutation(method, path, body) {
  state.mutationQueue.push({ id: Date.now(), method, path, body });
  localStorage.setItem('mutation_queue', JSON.stringify(state.mutationQueue));
  showToast('Guardado localmente. Sincronizará quando estiver online.', 'info');
}

async function processMutationQueue() {
  if (state.isOffline || state.mutationQueue.length === 0) return;
  
  showToast('A sincronizar alterações pendentes...', 'info');
  const queue = [...state.mutationQueue];
  state.mutationQueue = [];
  localStorage.setItem('mutation_queue', '[]');

  for (const item of queue) {
    try {
      await api(item.method, item.path, item.body);
    } catch (err) {
      console.error('Failed to sync mutation:', err);
      // If it fails again, put it back in queue? 
      // For now, we'll just log it to avoid infinite loops on 400s
    }
  }
  
  // Refresh data after sync
  initApp();
}

// ── On Load ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateOfflineUI();
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
  
  if (state.isOffline) {
    try {
      state.animals = await db.getAll('animals');
      state.events  = await db.getAll('events');
      // Note: user and farm might be in localStorage if we want, 
      // but for now let's assume they are partially stored in state if app was already open.
      if (state.animals.length > 0) {
        renderDashboard();
        showPage('page-dashboard');
        return;
      }
    } catch (err) {
      console.warn('Failed to load local data', err);
    }
  }

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
      db.save('animals', state.animals); // Persist
    }

    const eventsRes = await api('GET', '/events/');
    state.events = Array.isArray(eventsRes) ? eventsRes : [];
    db.save('events', state.events); // Persist

    const notifRes = await api('GET', '/notifications/');
    state.notifications = Array.isArray(notifRes) ? notifRes : [];

    // If user has no farm yet, show the setup page
    if (!state.farm) {
      showPage('page-setup-farm');
      return;
    }

    renderDashboard();
    showPage('page-dashboard');
    
    // Check for pending mutations once logged in and online
    processMutationQueue();
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

  // ── Advanced Productivity Stats ──
  const currentYear = new Date().getFullYear();
  
  const birthsThisYear = state.events.filter(e => {
    if (e.event_type !== 'Birth') return false;
    const evYear = new Date(e.event_date).getFullYear();
    return evYear === currentYear;
  }).length;
  
  const sold = state.animals.filter(a => a.status === 'Sold').length;
  const deceased = state.animals.filter(a => a.status === 'Deceased').length;
  
  let pregnantCount = 0;
  const activeFemales = state.animals.filter(a => a.status === 'Active' && a.gender === 'F');
  for (const cow of activeFemales) {
    const cowEvents = state.events
      .filter(e => e.animal_id === cow.id && (e.event_type === 'Pregnancy' || e.event_type === 'Birth'))
      .sort((a,b) => new Date(b.event_date) - new Date(a.event_date));
      
    if (cowEvents.length > 0 && cowEvents[0].event_type === 'Pregnancy') {
      pregnantCount++;
    }
  }

  const elBirths = document.getElementById('stat-births-yr');
  if (elBirths) elBirths.textContent = birthsThisYear;
  
  const elPregnant = document.getElementById('stat-pregnant');
  if (elPregnant) elPregnant.textContent = pregnantCount;
  
  const elDeceased = document.getElementById('stat-deceased');
  if (elDeceased) elDeceased.textContent = deceased;

  // ── Productivity Highlights ──
  // 1. Fertility Rate (Cows that gave birth this year / Total active females)
  const fertilityRate = activeFemales.length > 0 ? Math.round((birthsThisYear / activeFemales.length) * 100) : 0;
  const elFertility = document.getElementById('stat-fertility');
  if (elFertility) elFertility.textContent = fertilityRate + '%';

  // 2. Average Birth Interval (days)
  let totalIntervalDays = 0;
  let intervalCount = 0;
  
  for (const cow of activeFemales) {
    const cowBirths = state.events
      .filter(e => e.animal_id === cow.id && e.event_type === 'Birth')
      .sort((a,b) => new Date(a.event_date) - new Date(b.event_date));
      
    if (cowBirths.length > 1) {
        for (let i = 1; i < cowBirths.length; i++) {
            const diff = new Date(cowBirths[i].event_date) - new Date(cowBirths[i-1].event_date);
            totalIntervalDays += diff / (1000 * 60 * 60 * 24);
            intervalCount++;
        }
    }
  }
  const avgInterval = intervalCount > 0 ? Math.round(totalIntervalDays / intervalCount) : '—';
  const elInterval = document.getElementById('stat-interval');
  if (elInterval) elInterval.textContent = avgInterval + (avgInterval !== '—' ? ' dias' : '');

  const farmNameEl = document.getElementById('farm-name');
  if (farmNameEl && state.farm) farmNameEl.textContent = state.farm.name;

  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.style.display = state.notifications.length > 0 ? 'block' : 'none';
  }

  renderAnimalList(state.animals.slice(0, 5)); // Just top 5 on dashboard
  renderEventList(state.events.slice(0, 5));
  renderDashboardCharts();
}

// ── Dashboard Charts ──────────────────────────────
let charts = {};

function renderDashboardCharts() {
  if (typeof Chart === 'undefined') return;

  const breedFilter = document.getElementById('dashboard-breed-filter');
  const selectedBreed = breedFilter ? breedFilter.value : '';
  
  // Populate breed filter only once if breeds change
  const breeds = [...new Set(state.animals.map(a => a.breed).filter(b => !!b))];
  if (breedFilter && breedFilter.options.length <= 1) {
      breeds.sort().forEach(b => {
          const opt = document.createElement('option');
          opt.value = b;
          opt.textContent = b;
          breedFilter.appendChild(opt);
      });
      breedFilter.onchange = renderDashboardCharts;
  }

  const filteredAnimals = selectedBreed ? state.animals.filter(a => a.breed === selectedBreed) : state.animals;
  const filteredAnimalIds = filteredAnimals.map(a => a.id);
  const filteredEvents = selectedBreed ? state.events.filter(e => filteredAnimalIds.includes(e.animal_id)) : state.events;

  // 1. Births comparison (current vs last year)
  const birthsByMonthCurrent = new Array(12).fill(0);
  const birthsByMonthLast    = new Array(12).fill(0);
  const currentYear = new Date().getFullYear();
  const lastYear    = currentYear - 1;

  filteredEvents.filter(e => e.event_type === 'Birth').forEach(e => {
    const evDate = new Date(e.event_date);
    const evYear = evDate.getFullYear();
    const evMonth = evDate.getMonth();
    if (evYear === currentYear) birthsByMonthCurrent[evMonth]++;
    else if (evYear === lastYear) birthsByMonthLast[evMonth]++;
  });

  const ctxBirths = document.getElementById('chart-births');
  if (ctxBirths) {
    if (charts.births) charts.births.destroy();
    charts.births = new Chart(ctxBirths, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        datasets: [
          {
            label: 'Nascimentos ' + currentYear,
            data: birthsByMonthCurrent,
            backgroundColor: 'rgba(74, 103, 65, 0.7)',
            borderRadius: 4
          },
          {
            label: 'Nascimentos ' + lastYear,
            data: birthsByMonthLast,
            backgroundColor: 'rgba(143, 174, 92, 0.4)',
            borderRadius: 4
          }
        ]
      },
      options: { 
        responsive: true, 
        plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } } }, 
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } } 
      }
    });
  }

  // 2. Status distribution (pie)
  const statusCounts = { Active: 0, Sold: 0, Deceased: 0 };
  filteredAnimals.forEach(a => statusCounts[a.status]++);

  const ctxStatus = document.getElementById('chart-status');
  if (ctxStatus) {
    if (charts.status) charts.status.destroy();
    charts.status = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: ['Ativos', 'Vendidos', 'Falecidos'],
        datasets: [{
          data: [statusCounts.Active, statusCounts.Sold, statusCounts.Deceased],
          backgroundColor: ['#4caf50', '#f5a623', '#d9534f']
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
  }

  // 3. Breed distribution (pie)
  const breedCounts = {};
  state.animals.forEach(a => {
    const b = a.breed || 'Outra';
    breedCounts[b] = (breedCounts[b] || 0) + 1;
  });
  const breedLabels = Object.keys(breedCounts);
  const breedData = Object.values(breedCounts);

    const ctxBreed = document.getElementById('chart-breed');
    if (ctxBreed) {
      if (charts.breed) charts.breed.destroy();
      charts.breed = new Chart(ctxBreed, {
        type: 'pie',
        data: {
          labels: breedLabels,
          datasets: [{
            data: breedData,
            backgroundColor: ['#4a6741', '#8fae5c', '#d5d9cc', '#7a9e76', '#344d30']
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
      });
    }
  }

let selectionMode = false;
let selectedAnimals = new Set();

function toggleSelectionMode() {
    selectionMode = !selectionMode;
    const btn = document.getElementById('btn-toggle-selection');
    const bar = document.getElementById('bulk-action-bar');
    
    if (selectionMode) {
        btn.textContent = 'Cancelar';
        btn.classList.add('btn-primary');
        bar.style.display = 'flex';
        selectedAnimals.clear();
        updateBulkCount();
    } else {
        btn.textContent = 'Selecionar';
        btn.classList.remove('btn-primary');
        bar.style.display = 'none';
    }
    renderAnimalList(state.animals);
}

function updateBulkCount() {
    const el = document.getElementById('bulk-selection-count');
    if (el) el.textContent = `${selectedAnimals.size} selecionados`;
}

// ── Search & Filters ──
document.getElementById('animal-search')?.addEventListener('input', debounce((e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
        renderAnimalList(state.animals);
        return;
    }
    // Simple local search for offline/fast response
    const filtered = state.animals.filter(a => 
        (a.name && a.name.toLowerCase().includes(q)) || 
        a.registration_id.toLowerCase().includes(q)
    );
    renderAnimalList(filtered);
}, 300));

function renderAnimalList(animals) {
  const list = document.getElementById('animal-list');
  if (!list) return;

  if (animals.length === 0) {
    list.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🐄</div>
      <p>Nenhum animal encontrado.</p>
    </div>`;
    return;
  }

  list.innerHTML = animals.map(a => `
    <div class="animal-card mb-sm ${selectedAnimals.has(a.id) ? 'selected' : ''}" data-id="${a.id}">
      ${selectionMode ? `
        <div class="selection-box">
            <input type="checkbox" ${selectedAnimals.has(a.id) ? 'checked' : ''} onclick="event.stopPropagation()">
        </div>
      ` : `<div class="animal-avatar">${a.gender === 'F' ? '🐄' : '🐂'}</div>`}
      <div class="animal-info">
        <div class="animal-name">${a.name ?? 'Sem nome'}</div>
        <div class="animal-tag"># ${a.registration_id} · ${a.breed ?? 'Raça desconhecida'}</div>
      </div>
      <span class="badge badge-${a.status.toLowerCase()}">${translateStatus(a.status)}</span>
    </div>
  `).join('');

  list.querySelectorAll('.animal-card').forEach(card => {
    card.addEventListener('click', () => {
        const id = card.dataset.id;
        if (selectionMode) {
            if (selectedAnimals.has(id)) selectedAnimals.delete(id);
            else selectedAnimals.add(id);
            updateBulkCount();
            renderAnimalList(animals);
        } else {
            showAnimalDetail(id);
        }
    });
  });
}

function openFilters() {
    document.getElementById('modal-filters').style.display = 'flex';
}

function closeFilters() {
    document.getElementById('modal-filters').style.display = 'none';
}

async function applyFilters() {
    const status = document.getElementById('filter-status').value;
    const gender = document.getElementById('filter-gender').value;
    const breed  = document.getElementById('filter-breed').value.trim();
    
    let url = '/animals/?';
    if (status) url += `status=${status}&`;
    if (gender) url += `gender=${gender}&`;
    if (breed)  url += `breed=${breed}&`;
    
    try {
        const filtered = await api('GET', url);
        renderAnimalList(filtered);
        closeFilters();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

document.getElementById('btn-animal-filters')?.addEventListener('click', openFilters);
document.getElementById('btn-apply-filters')?.addEventListener('click', applyFilters);
document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-gender').value = '';
    document.getElementById('filter-breed').value = '';
    renderAnimalList(state.animals);
    closeFilters();
});

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

document.getElementById('btn-toggle-selection')?.addEventListener('click', toggleSelectionMode);

document.getElementById('btn-bulk-status')?.addEventListener('click', async () => {
    if (selectedAnimals.size === 0) return;
    const newStatus = prompt('Novo estado para os selecionados (Ativo, Vendido, Falecido):');
    if (!newStatus) return;
    
    // Normalize status
    const normalized = newStatus.trim().charAt(0).toUpperCase() + newStatus.trim().slice(1).toLowerCase();
    const valid = ['Active', 'Sold', 'Deceased'];
    const dbValue = normalized === 'Ativo' ? 'Active' : (normalized === 'Vendido' ? 'Sold' : (normalized === 'Falecido' ? 'Deceased' : normalized));
    
    if (!valid.includes(dbValue)) {
        alert('Estado inválido.');
        return;
    }

    const ids = Array.from(selectedAnimals);
    try {
        await api('PATCH', '/animals/bulk', { animal_ids: ids, status: dbValue });
        showToast(`Estado atualizado para ${ids.length} animais.`, 'success');
        
        // Update local state
        state.animals.forEach(a => {
            if (ids.includes(a.id)) a.status = dbValue;
        });
        db.save('animals', state.animals);
        
        toggleSelectionMode();
        renderAnimalList(state.animals);
    } catch (err) {
        if (err.message === 'OFFLINE') {
            queueMutation('PATCH', '/animals/bulk', { animal_ids: ids, status: dbValue });
            state.animals.forEach(a => {
                if (ids.includes(a.id)) a.status = dbValue;
            });
            db.save('animals', state.animals);
            showToast('Atualização agendada localmente.', 'info');
            toggleSelectionMode();
            renderAnimalList(state.animals);
        } else {
            showToast(err.message, 'error');
        }
    }
});

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
      renderSettings();
      showPage('page-settings');
    }
  });
});

async function renderSettings() {
    const farmNameEl = document.getElementById('settings-farm-name');
    const farmLocEl  = document.getElementById('settings-farm-location');
    const invSection = document.getElementById('invitation-section');

    if (state.farm) {
        farmNameEl.textContent = farmNameEl ? state.farm.name : '';
        farmLocEl.textContent  = farmLocEl ? (state.farm.location || 'Sem localização definida') : '';
        
        const shareIdEl = document.getElementById('share-farm-id');
        if (shareIdEl) shareIdEl.value = state.farm.id;

        // Show invitation section only if owner
        const isOwner = state.user && state.farm.owner_id === state.user.id;
        invSection.style.display = isOwner ? 'block' : 'none';
        
        if (isOwner) {
            loadInvitations();
        }
    }
    
    // Load team members
    const teamList = document.getElementById('team-list');
    if (!teamList) return;
    
    try {
        state.team = await api('GET', '/users/farm-members');
        renderTeamList();
    } catch (err) {
        teamList.innerHTML = `<div class="subtext error-msg visible">Erro ao carregar equipa.</div>`;
    }
}

async function loadInvitations() {
    const list = document.getElementById('invitation-list');
    if (!list) return;
    try {
        const invitations = await api('GET', '/invitations/');
        renderInvitationList(invitations);
    } catch (err) {
        console.error('Failed to load invitations', err);
    }
}

function renderInvitationList(invs) {
    const list = document.getElementById('invitation-list');
    if (!list) return;

    const pending = invs.filter(i => !i.accepted_at);
    if (pending.length === 0) {
        list.innerHTML = '';
        return;
    }

    list.innerHTML = `<p class="subtext mb-sm" style="font-size:12px; font-weight:600">Convites Pendentes</p>` + 
        pending.map(i => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--color-border)">
            <div style="font-size:13px">${i.email}</div>
            <div class="subtext" style="font-size:11px">${i.role}</div>
        </div>
    `).join('');
}

document.getElementById('form-invite-member')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailEl = document.getElementById('invite-email');
    const btn     = document.getElementById('btn-invite');
    
    setButtonLoading(btn, true);
    try {
        await api('POST', '/invitations/', { email: emailEl.value.trim(), role: 'member' });
        showToast('Convite enviado!', 'success');
        emailEl.value = '';
        loadInvitations();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
});

function renderTeamList() {
    const list = document.getElementById('team-list');
    if (!list) return;

    if (state.team.length === 0) {
        list.innerHTML = `<div class="subtext">Apenas você nesta quinta.</div>`;
        return;
    }

    list.innerHTML = state.team.map(u => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-sm) 0; border-bottom:1px solid var(--color-border)">
            <div>
                <div style="font-weight:600; font-size:14px">${u.name}</div>
                <div class="subtext" style="font-size:12px">${u.email}</div>
            </div>
            ${u.id !== state.user.id ? `
                <button class="btn btn-sm btn-outline-danger" style="padding:4px 8px; font-size:11px" onclick="handleRemoveMember('${u.id}')">Remover</button>
            ` : '<span class="badge badge-active" style="font-size:9px">Você</span>'}
        </div>
    `).join('');
}

async function handleRemoveMember(userId) {
    if (!confirm('Tem a certeza que deseja remover este membro da quinta?')) return;
    
    try {
        await api('DELETE', `/users/farm-members/${userId}`);
        state.team = state.team.filter(u => u.id !== userId);
        renderTeamList();
        showToast('Membro removido.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

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
    db.save('animals', state.animals); // Update local cache
    showToast(`${animal.name ?? animal.registration_id} adicionado!`, 'success');
    showPage('page-dashboard');
    renderDashboard();
  } catch (err) {
    if (err.message === 'OFFLINE') {
      // Create a temporary animal for local UI
      const tempAnimal = { ...payload, id: 'temp-' + Date.now() };
      state.animals.unshift(tempAnimal);
      db.save('animals', state.animals);
      queueMutation('POST', '/animals/', payload);
      showPage('page-dashboard');
      renderDashboard();
      return;
    }
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
  const btn       = document.getElementById('btn-save-event');
  const errEl     = document.getElementById('add-event-error');
  const animal_id = document.getElementById('event-animal-id').value;

  errEl.classList.remove('visible');
  setButtonLoading(btn, true);

  const isBulk = state.currentBulkIds && state.currentBulkIds.length > 0;
  
  const payload = {
    event_type:  document.getElementById('ev-type').value,
    event_date:  document.getElementById('ev-date').value,
    description: document.getElementById('ev-desc').value.trim() || null,
  };

  try {
    if (isBulk) {
        await api('POST', '/events/bulk', { ...payload, animal_ids: state.currentBulkIds });
        showToast(`Registo efetuado para ${state.currentBulkIds.length} animais.`, 'success');
        state.currentBulkIds = null;
        toggleSelectionMode(); // Exit selection mode
        showPage('page-animals');
    } else {
        const newEvent = await api('POST', '/events/', { ...payload, animal_id });
        state.events.unshift(newEvent);
        db.save('events', state.events);
        showToast('Evento registado!', 'success');
        showAnimalDetail(animal_id);
    }
  } catch (err) {
    if (err.message === 'OFFLINE') {
        if (isBulk) {
            state.currentBulkIds.forEach(id => {
               queueMutation('POST', '/events/', { ...payload, animal_id: id });
            });
            showToast('Eventos agendados para sincronização.', 'info');
            state.currentBulkIds = null;
            toggleSelectionMode();
            showPage('page-animals');
        } else {
            queueMutation('POST', '/events/', { ...payload, animal_id });
            showToast('Evento agendado localmente.', 'info');
            showAnimalDetail(animal_id);
        }
        return;
    }
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
    db.save('animals', state.animals);

    showToast('Animal atualizado!', 'success');
    showAnimalDetail(id);
  } catch (err) {
    if (err.message === 'OFFLINE') {
      const index = state.animals.findIndex(a => a.id === id);
      if (index !== -1) state.animals[index] = { ...state.animals[index], ...payload };
      db.save('animals', state.animals);
      queueMutation('PATCH', `/animals/${id}`, payload);
      showAnimalDetail(id);
      return;
    }
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
    db.save('animals', state.animals);
    showToast('Animal eliminado.', 'success');
    showPage('page-animals');
    renderAnimalList(state.animals);
  } catch (err) {
    if (err.message === 'OFFLINE') {
      state.animals = state.animals.filter(a => a.id !== animal.id);
      db.save('animals', state.animals);
      queueMutation('DELETE', `/animals/${animal.id}`);
      showPage('page-animals');
      renderAnimalList(state.animals);
      return;
    }
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

document.getElementById('btn-accept-invite')?.addEventListener('click', async () => {
  const token = document.getElementById('join-token').value.trim();
  if (!token) return;
  try {
    const res = await api('POST', `/invitations/accept/${token}`);
    showToast('Convite aceite com sucesso!', 'success');
    initApp(); // Refresh everything
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
    const current = state.animals.find(a => a.id === animalId);
    
    let html = `
      <div class="genealogy-tree">
        <!-- Grandparents Row -->
        <div class="tree-row" style="margin-bottom:var(--space-sm)">
          ${renderTreeNode(data.maternal_grandfather, 'Avo Materno', '🐂', 'grandparent-node')}
          ${renderTreeNode(data.maternal_grandmother, 'Avó Materna', '🐄', 'grandparent-node')}
          ${renderTreeNode(data.paternal_grandfather, 'Avo Paterno', '🐂', 'grandparent-node')}
          ${renderTreeNode(data.paternal_grandmother, 'Avó Paterna', '🐄', 'grandparent-node')}
        </div>

        <div class="tree-connectors" style="height:20px">
           <svg width="100%" height="20" style="display:block">
              <line x1="12.5%" y1="0" x2="25%" y2="20" stroke="var(--color-border)" stroke-width="1.5" />
              <line x1="37.5%" y1="0" x2="25%" y2="20" stroke="var(--color-border)" stroke-width="1.5" />
              <line x1="62.5%" y1="0" x2="75%" y2="20" stroke="var(--color-border)" stroke-width="1.5" />
              <line x1="87.5%" y1="0" x2="75%" y2="20" stroke="var(--color-border)" stroke-width="1.5" />
           </svg>
        </div>

        <!-- Parents Row -->
        <div class="tree-row">
          ${renderTreeNode(data.mother, 'Mãe', '🐄', 'parent-node')}
          ${renderTreeNode(data.father, 'Pai', '🐂', 'parent-node')}
        </div>

        <!-- SVG Connectors to Current -->
        <div class="tree-connectors">
          <svg width="100%" height="40" style="display:block">
            <line x1="25%" y1="0" x2="50%" y2="40" stroke="var(--color-border)" stroke-width="2" />
            <line x1="75%" y1="0" x2="50%" y2="40" stroke="var(--color-border)" stroke-width="2" />
          </svg>
        </div>

        <!-- Current Animal -->
        <div class="tree-row">
          ${renderTreeNode(current, 'Animal Atual', current.gender === 'F' ? '🐄' : '🐂', 'current-node')}
        </div>

        <!-- Children Section -->
        ${data.children && data.children.length > 0 ? `
          <div class="tree-connectors">
            <svg width="100%" height="40" style="display:block">
              <line x1="50%" y1="0" x2="50%" y2="40" stroke="var(--color-border)" stroke-width="2" />
            </svg>
          </div>
          <div class="tree-children">
            <strong style="display:block; text-align:center; margin-bottom:12px; font-size:11px; text-transform:uppercase; color:var(--color-text-muted)">Descendentes (${data.children.length})</strong>
            <div class="children-grid">
              ${data.children.map(c => `
                <div class="tree-node child-node" onclick="showAnimalDetail('${c.id}')">
                   <div class="node-icon" style="font-size:18px">${c.gender === 'F' ? '🐄' : '🐂'}</div>
                   <div class="node-name" style="font-size:12px">${c.name || '#' + c.registration_id}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="mt-md text-center subtext">Sem descendentes registados.</div>
        `}
      </div>
    `;
    
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div class="text-center" style="color:var(--color-danger);padding:var(--space-md)">Erro ao carregar genealogia.</div>`;
  }
}

// ── Notifications render ──────────────────────────
function renderNotifications() {
  const list = document.getElementById('notifications-list');
  if (!list) return;

  if (state.notifications.length === 0) {
    list.innerHTML = `<div class="text-center" style="padding:var(--space-xl) 0; color:var(--color-text-muted)">
      <div style="font-size:48px">✅</div>
      <p class="subtext" style="margin-top:var(--space-sm)">Sem notificações pendentes.</p>
    </div>`;
    return;
  }

  list.innerHTML = state.notifications.map(n => {
    let icon = '📅';
    if (n.type === 'Birth') icon = '🐣';
    if (n.type === 'Heat') icon = '🔥';
    
    let colorClass = 'var(--color-primary)';
    if (n.days_until < 0) colorClass = 'var(--color-danger)';
    else if (n.days_until <= 3) colorClass = '#d97706';

    return `
      <div class="content-card mb-sm" style="border-left: 4px solid ${colorClass}; cursor:pointer;" onclick="showAnimalDetail('${n.animal_id}')">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="font-size:24px;">${icon}</div>
          <div style="flex:1;">
            <div style="font-weight:600; margin-bottom:4px;">${n.title} — ${n.animal_name}</div>
            <div class="subtext" style="font-size:13px; line-height:1.4;">${n.description}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

