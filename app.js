// ==========================================
// API URL AUTO-DETECTION
// ==========================================
// Priority order:
//  1. If running on localhost → use localhost:5000
//  2. If a custom VERCEL_API_URL is set via localStorage (manual override) → use it
//  3. Otherwise → derive from window.location.origin (same domain, works for Vercel)

const LIVE_API_URL   = 'https://notetaker-api-three.vercel.app/api';
const LOCAL_API_URL  = 'http://localhost:5000/api';

function detectApiBase() {
  // Manual override stored by user
  const override = localStorage.getItem('api_override');
  if (override) return override;

  const hostname = window.location.hostname;
  // localhost / 127.x / file:// → use local dev server
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
    return LOCAL_API_URL;
  }
  // Deployed anywhere else → use the live Vercel API
  return LIVE_API_URL;
}

let API_BASE = detectApiBase();

// Show which URL is active in the header
function updateApiDisplay() {
  const el = document.getElementById('apiUrlDisplay');
  if (el) {
    const isLocal = API_BASE === LOCAL_API_URL;
    el.textContent = isLocal ? 'localhost:5000 (local)' : 'Vercel (live)';
    el.style.color = isLocal ? '#86efac' : '#fcd34d';
  }
}

// If we opened from file:// or localhost but the local server is down,
// fall back to the live API automatically.
async function probeAndSetApiBase() {
  updateApiDisplay();
  if (API_BASE !== LOCAL_API_URL) return; // Already on live, no probe needed

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 2000); // 2s timeout
    const res = await fetch(`${LOCAL_API_URL}/auth/me`, { signal: ctrl.signal });
    clearTimeout(tid);
    // Any real HTTP response means local server is up
    updateApiDisplay();
  } catch {
    // Local server unreachable → fall back to live
    API_BASE = LIVE_API_URL;
    console.info('[API] Local server unreachable, switching to Vercel live API');
    updateApiDisplay();
  }
}

// State
let token = localStorage.getItem('token') || '';
let currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
let currentNotesPage = 1;
let currentAdminUsersPage = 1;
let currentInterestsPage = 1;
let currentPostsPage = 1;

// DOM Elements
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const userRole = document.getElementById('userRole');
const logoutBtn = document.getElementById('logoutBtn');
const alertBox = document.getElementById('alertBox');

// Tabs in Auth
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginFormContainer = document.getElementById('loginFormContainer');
const registerFormContainer = document.getElementById('registerFormContainer');

// Nav tabs
const navNotesBtn = document.getElementById('navNotesBtn');
const navPostsBtn = document.getElementById('navPostsBtn');
const navAdminUsersBtn = document.getElementById('navAdminUsersBtn');
const navGroupedInterestsBtn = document.getElementById('navGroupedInterestsBtn');

const notesView = document.getElementById('notesView');
const postsView = document.getElementById('postsView');
const adminUsersView = document.getElementById('adminUsersView');
const groupedInterestsView = document.getElementById('groupedInterestsView');

// --- HELPER: SHOW ALERT ---
function showAlert(message, type = 'error') {
  alertBox.textContent = message;
  alertBox.className = `alert ${type}`;
  alertBox.classList.remove('hidden');
  setTimeout(() => {
    alertBox.classList.add('hidden');
  }, 4000);
}

// --- HELPER: API REQUEST ---
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 204) {
      return null;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    showAlert(err.message, 'error');
    throw err;
  }
}

// --- INITIAL CHECK ---
async function initApp() {
  await probeAndSetApiBase();
  if (token && currentUser) {
    showDashboard();
  } else {
    showAuth();
  }
}

function showAuth() {
  authSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  userInfo.style.display = 'none';
}

function showDashboard() {
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  userInfo.style.display = 'inline-block';
  userName.textContent = currentUser.name;
  userRole.textContent = currentUser.role;

  // Toggle admin views
  const isAdmin = currentUser.role === 'admin';
  document.querySelectorAll('.admin-only').forEach((el) => {
    if (isAdmin) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  const notesRoleScope = document.getElementById('notesRoleScope');
  if (notesRoleScope) {
    notesRoleScope.textContent = isAdmin ? 'Admin View: All Users Notes' : 'Your Notes';
  }

  // Set default active tab
  switchView('notes');
  fetchNotes();
}

// Tab Switching
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginFormContainer.classList.remove('hidden');
  registerFormContainer.classList.add('hidden');
});

tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerFormContainer.classList.remove('hidden');
  loginFormContainer.classList.add('hidden');
});

// Logout
logoutBtn.addEventListener('click', () => {
  token = '';
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  showAuth();
  showAlert('Logged out successfully', 'success');
});

// --- AUTH LOGIC ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    showAlert(`Welcome, ${currentUser.name}!`, 'success');
    showDashboard();
  } catch (e) {}
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const interestsRaw = document.getElementById('regInterests').value;
  const interests = interestsRaw ? interestsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];

  try {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, interests }),
    });

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    showAlert(`Registered & logged in as ${currentUser.name}!`, 'success');
    showDashboard();
  } catch (e) {}
});

// --- NAVIGATION SWITCHER ---
function switchView(view) {
  [notesView, postsView, adminUsersView, groupedInterestsView].forEach((el) => el.classList.add('hidden'));
  [navNotesBtn, navPostsBtn, navAdminUsersBtn, navGroupedInterestsBtn].forEach((el) => el.classList.remove('active'));

  if (view === 'notes') {
    notesView.classList.remove('hidden');
    navNotesBtn.classList.add('active');
  } else if (view === 'posts') {
    postsView.classList.remove('hidden');
    navPostsBtn.classList.add('active');
    if (currentUser) {
      document.getElementById('lookupUserId').value = currentUser.id;
      currentLookupUserId = currentUser.id;
      fetchUserPosts(currentUser.id);
    }
  } else if (view === 'adminUsers') {
    adminUsersView.classList.remove('hidden');
    navAdminUsersBtn.classList.add('active');
    fetchAdminUsers();
  } else if (view === 'interests') {
    groupedInterestsView.classList.remove('hidden');
    navGroupedInterestsBtn.classList.add('active');
    fetchGroupedInterests();
  }
}

navNotesBtn.addEventListener('click', () => switchView('notes'));
navPostsBtn.addEventListener('click', () => switchView('posts'));
navAdminUsersBtn.addEventListener('click', () => switchView('adminUsers'));
navGroupedInterestsBtn.addEventListener('click', () => switchView('interests'));

// ==========================================
// 1. NOTES MODULE
// ==========================================
async function fetchNotes(page = 1) {
  currentNotesPage = page;
  const container = document.getElementById('notesContainer');
  container.innerHTML = '<p>Loading notes...</p>';

  try {
    const data = await apiRequest(`/notes?page=${page}&limit=5`);
    renderNotesList(data.notes);
    renderPagination(
      document.getElementById('notesPagination'),
      data.pagination,
      (newPage) => fetchNotes(newPage)
    );
  } catch (err) {
    container.innerHTML = `<p style="color:red">Failed to load notes.</p>`;
  }
}

function renderNotesList(notes) {
  const container = document.getElementById('notesContainer');
  if (!notes || notes.length === 0) {
    container.innerHTML = '<p class="muted">No notes found.</p>';
    return;
  }

  container.innerHTML = notes.map((note) => {
    const isOwner = currentUser && (note.owner === currentUser.id || note.owner?._id === currentUser.id);
    const date = new Date(note.createdAt).toLocaleString();
    return `
      <div class="item-card">
        <h4>${escapeHtml(note.title)}</h4>
        <p>${escapeHtml(note.content)}</p>
        <div class="meta">
          <span>Created: ${date}</span>
          ${note.owner?.name ? ` | Owner: <strong>${escapeHtml(note.owner.name)}</strong>` : ''}
        </div>
        ${isOwner ? `
          <div class="actions">
            <button class="btn small secondary" onclick="editNote('${note._id}', '${escapeQuotes(note.title)}', '${escapeQuotes(note.content)}')">Edit</button>
            <button class="btn small danger" onclick="deleteNote('${note._id}')">Delete</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

document.getElementById('refreshNotesBtn').addEventListener('click', () => fetchNotes(currentNotesPage));

document.getElementById('noteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editNoteId').value;
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value;

  try {
    if (id) {
      await apiRequest(`/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, content }),
      });
      showAlert('Note updated successfully!', 'success');
    } else {
      await apiRequest('/notes', {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      });
      showAlert('Note created successfully!', 'success');
    }
    resetNoteForm();
    fetchNotes(currentNotesPage);
  } catch (err) {}
});

function editNote(id, title, content) {
  document.getElementById('noteFormTitle').textContent = 'Edit Note';
  document.getElementById('editNoteId').value = id;
  document.getElementById('noteTitle').value = title;
  document.getElementById('noteContent').value = content;
  document.getElementById('saveNoteBtn').textContent = 'Update Note';
  document.getElementById('cancelNoteBtn').classList.remove('hidden');
}

function resetNoteForm() {
  document.getElementById('noteFormTitle').textContent = 'Create Note';
  document.getElementById('editNoteId').value = '';
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteContent').value = '';
  document.getElementById('saveNoteBtn').textContent = 'Save Note';
  document.getElementById('cancelNoteBtn').classList.add('hidden');
}

document.getElementById('cancelNoteBtn').addEventListener('click', resetNoteForm);

async function deleteNote(id) {
  if (!confirm('Are you sure you want to delete this note?')) return;
  try {
    await apiRequest(`/notes/${id}`, { method: 'DELETE' });
    showAlert('Note deleted!', 'success');
    fetchNotes(currentNotesPage);
  } catch (err) {}
}

// ==========================================
// 2. POSTS & $LOOKUP AGGREGATION
// ==========================================

// Track which userId we're currently viewing
let currentLookupUserId = '';

document.getElementById('postForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value;

  try {
    await apiRequest('/posts', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    });
    showAlert('Post published!', 'success');
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';
    // Refresh current view
    const uid = currentLookupUserId || (currentUser ? currentUser.id : '');
    if (uid) fetchUserPosts(uid);
  } catch (err) {}
});

document.getElementById('lookupPostsBtn').addEventListener('click', () => {
  const userId = document.getElementById('lookupUserId').value.trim();
  if (!userId) {
    showAlert('Please paste a User ID');
    return;
  }
  currentLookupUserId = userId;
  fetchUserPosts(userId);
});

document.getElementById('lookupMyPostsBtn').addEventListener('click', () => {
  if (!currentUser) return;
  document.getElementById('lookupUserId').value = currentUser.id;
  currentLookupUserId = currentUser.id;
  fetchUserPosts(currentUser.id);
});

document.getElementById('refreshUserPostsBtn').addEventListener('click', () => {
  const uid = currentLookupUserId || (currentUser ? currentUser.id : '');
  if (uid) fetchUserPosts(uid);
});

async function fetchUserPosts(userId, page = 1) {
  currentPostsPage = page;
  currentLookupUserId = userId;
  const container = document.getElementById('userPostsResult');
  const title = document.getElementById('postsResultTitle');
  container.innerHTML = '<p class="muted">Loading posts via $lookup pipeline...</p>';

  try {
    const data = await apiRequest(`/posts/by-user/${userId}?page=${page}&limit=5`);
    const posts = data.posts || [];
    const author = data.user || {};

    title.textContent = `Posts by ${author.name || 'User'}`;

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="post-author-header">
          👤 ${escapeHtml(author.name || userId)}
        </div>
        <p class="muted">No posts published yet.</p>
      `;
      return;
    }

    const isMyPosts = currentUser && userId === currentUser.id;
    const isAdmin = currentUser && currentUser.role === 'admin';

    container.innerHTML = `
      <div class="post-author-header">
        👤 <strong>${escapeHtml(author.name || '')}</strong>
        ${author.email ? `&nbsp;·&nbsp; ${escapeHtml(author.email)}` : ''}
      </div>
      ${posts.map((p) => {
        const canModify = isAdmin || isMyPosts;
        return `
          <div class="post-card">
            <div class="post-card-header">
              <h4>${escapeHtml(p.title)}</h4>
              ${canModify ? `
                <div style="display:flex; gap:5px; flex-shrink:0;">
                  <button class="btn small secondary" onclick="openEditPostModal('${p._id}', '${escapeQuotes(p.title)}', '${escapeQuotes(p.content)}')">Edit</button>
                  <button class="btn small danger" onclick="deletePost('${p._id}', '${escapeQuotes(userId)}')">Delete</button>
                </div>
              ` : ''}
            </div>
            <p>${escapeHtml(p.content)}</p>
            <div class="meta">Published: ${new Date(p.createdAt).toLocaleString()}</div>
          </div>
        `;
      }).join('')}
    `;

    renderPagination(
      document.getElementById('userPostsPagination'),
      data.pagination,
      (newPage) => fetchUserPosts(userId, newPage)
    );
  } catch (err) {
    container.innerHTML = `<p style="color:red">Failed to load posts. Check the User ID.</p>`;
  }
}

// --- POST EDIT MODAL ---
function openEditPostModal(id, title, content) {
  document.getElementById('editPostId').value = id;
  document.getElementById('editPostTitle').value = title;
  document.getElementById('editPostContent').value = content;
  document.getElementById('editPostModal').classList.remove('hidden');
}

document.getElementById('closeEditModal').addEventListener('click', () => {
  document.getElementById('editPostModal').classList.add('hidden');
});

document.getElementById('editPostForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editPostId').value;
  const title = document.getElementById('editPostTitle').value.trim();
  const content = document.getElementById('editPostContent').value;

  try {
    await apiRequest(`/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, content }),
    });
    showAlert('Post updated!', 'success');
    document.getElementById('editPostModal').classList.add('hidden');
    fetchUserPosts(currentLookupUserId, currentPostsPage);
  } catch (err) {}
});

async function deletePost(postId, userId) {
  if (!confirm('Delete this post permanently?')) return;
  try {
    await apiRequest(`/posts/${postId}`, { method: 'DELETE' });
    showAlert('Post deleted!', 'success');
    fetchUserPosts(userId, currentPostsPage);
  } catch (err) {}
}

// ==========================================
// 3. ADMIN: USER MANAGEMENT
// ==========================================
async function fetchAdminUsers(page = 1) {
  currentAdminUsersPage = page;
  const container = document.getElementById('adminUsersContainer');
  container.innerHTML = '<p>Loading users...</p>';

  try {
    const data = await apiRequest(`/admin/users?page=${page}&limit=5`);
    renderAdminUsersList(data.users);
    renderPagination(
      document.getElementById('adminUsersPagination'),
      data.pagination,
      (newPage) => fetchAdminUsers(newPage)
    );
  } catch (err) {
    container.innerHTML = `<p style="color:red">Admin access required or request failed.</p>`;
  }
}

function renderAdminUsersList(users) {
  const container = document.getElementById('adminUsersContainer');
  if (!users || users.length === 0) {
    container.innerHTML = '<p class="muted">No users found.</p>';
    return;
  }

  container.innerHTML = users.map((u) => {
    const interestsStr = (u.interests || []).join(', ');
    return `
      <div class="item-card">
        <h4>${escapeHtml(u.name)} <span class="badge">${u.role}</span></h4>
        <div style="font-size:0.85rem; color:#475569;">Email: ${escapeHtml(u.email)}</div>
        <div style="font-size:0.85rem; color:#475569;">Interests: ${interestsStr || '<em>None</em>'}</div>
        <div class="meta">User ID: <code>${u.id}</code></div>
        <div class="actions">
          <button class="btn small secondary" onclick="editAdminUser('${u.id}', '${escapeQuotes(u.name)}', '${escapeQuotes(u.email)}', '${u.role}', '${escapeQuotes(interestsStr)}')">Edit</button>
          <button class="btn small danger" onclick="deleteAdminUser('${u.id}')">Delete</button>
          <button class="btn small" style="background:#0284c7; color:white;" onclick="viewUserPosts('${u.id}')">View Posts</button>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('adminRefreshUsersBtn').addEventListener('click', () => fetchAdminUsers(currentAdminUsersPage));

document.getElementById('adminUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('adminEditUserId').value;
  const name = document.getElementById('adminUserName').value.trim();
  const email = document.getElementById('adminUserEmail').value.trim();
  const password = document.getElementById('adminUserPassword').value;
  const role = document.getElementById('adminUserRole').value;
  const interestsRaw = document.getElementById('adminUserInterests').value;
  const interests = interestsRaw ? interestsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const payload = { name, email, role, interests };
  if (password) {
    payload.password = password;
  }

  try {
    if (id) {
      await apiRequest(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      showAlert('User updated successfully!', 'success');
    } else {
      if (!password) {
        showAlert('Password is required for creating a new user');
        return;
      }
      payload.password = password;
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showAlert('User created successfully!', 'success');
    }
    resetAdminUserForm();
    fetchAdminUsers(currentAdminUsersPage);
  } catch (err) {}
});

function editAdminUser(id, name, email, role, interests) {
  document.getElementById('adminUserFormTitle').textContent = 'Admin: Edit User';
  document.getElementById('adminEditUserId').value = id;
  document.getElementById('adminUserName').value = name;
  document.getElementById('adminUserEmail').value = email;
  document.getElementById('adminUserPassword').value = '';
  document.getElementById('adminUserRole').value = role;
  document.getElementById('adminUserInterests').value = interests;
  document.getElementById('adminPassHelp').classList.remove('hidden');
  document.getElementById('adminSaveUserBtn').textContent = 'Update User';
  document.getElementById('adminCancelUserBtn').classList.remove('hidden');
}

function resetAdminUserForm() {
  document.getElementById('adminUserFormTitle').textContent = 'Admin: Create User';
  document.getElementById('adminEditUserId').value = '';
  document.getElementById('adminUserName').value = '';
  document.getElementById('adminUserEmail').value = '';
  document.getElementById('adminUserPassword').value = '';
  document.getElementById('adminUserRole').value = 'user';
  document.getElementById('adminUserInterests').value = '';
  document.getElementById('adminPassHelp').classList.add('hidden');
  document.getElementById('adminSaveUserBtn').textContent = 'Create User';
  document.getElementById('adminCancelUserBtn').classList.add('hidden');
}

document.getElementById('adminCancelUserBtn').addEventListener('click', resetAdminUserForm);

async function deleteAdminUser(id) {
  if (currentUser && currentUser.id === id) {
    showAlert('You cannot delete your own account');
    return;
  }
  if (!confirm('Are you sure you want to delete this user and all their notes/posts?')) return;
  try {
    await apiRequest(`/admin/users/${id}`, { method: 'DELETE' });
    showAlert('User and their notes/posts removed!', 'success');
    fetchAdminUsers(currentAdminUsersPage);
  } catch (err) {}
}

function viewUserPosts(userId) {
  switchView('posts');
  document.getElementById('lookupUserId').value = userId;
  fetchUserPosts(userId);
}

// ==========================================
// 4. ADMIN: INTERESTS AGGREGATION
// ==========================================
async function fetchGroupedInterests(page = 1) {
  currentInterestsPage = page;
  const container = document.getElementById('interestsContainer');
  container.innerHTML = '<p>Loading interest groups pipeline results...</p>';

  try {
    const data = await apiRequest(`/admin/users/grouped-by-interests?page=${page}&limit=5`);
    const groups = data.groups || [];

    if (groups.length === 0) {
      container.innerHTML = '<p class="muted">No interests data found.</p>';
      return;
    }

    container.innerHTML = groups.map((g) => {
      const userList = (g.users || []).map((u) => `<li>${escapeHtml(u.name)} (${escapeHtml(u.email)})</li>`).join('');
      return `
        <div class="item-card">
          <h4>Interest: <span class="badge" style="background:#dbeafe; color:#1e40af; font-size:0.9rem;">#${escapeHtml(g._id)}</span> (${g.userCount} users)</h4>
          <ul style="margin-left: 20px; font-size: 0.85rem; margin-top: 6px;">
            ${userList}
          </ul>
        </div>
      `;
    }).join('');

    renderPagination(
      document.getElementById('interestsPagination'),
      data.pagination,
      (newPage) => fetchGroupedInterests(newPage)
    );
  } catch (err) {
    container.innerHTML = `<p style="color:red">Failed to load interest groups aggregation.</p>`;
  }
}

document.getElementById('refreshInterestsBtn').addEventListener('click', () => fetchGroupedInterests(currentInterestsPage));

// ==========================================
// PAGINATION & ESCAPING UTILS
// ==========================================
function renderPagination(container, pagination, onPageChange) {
  if (!pagination || pagination.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const { page, totalPages, totalItems } = pagination;
  container.innerHTML = `
    <button ${page <= 1 ? 'disabled' : ''} id="prevPageBtn">Prev</button>
    <span>Page <strong>${page}</strong> of <strong>${totalPages}</strong> (${totalItems} total)</span>
    <button ${page >= totalPages ? 'disabled' : ''} id="nextPageBtn">Next</button>
  `;

  const prevBtn = container.querySelector('#prevPageBtn');
  const nextBtn = container.querySelector('#nextPageBtn');
  if (prevBtn) prevBtn.onclick = () => onPageChange(page - 1);
  if (nextBtn) nextBtn.onclick = () => onPageChange(page + 1);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeQuotes(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '\\n');
}

// Start app
window.addEventListener('DOMContentLoaded', () => initApp());
