/*
  Campus Stationery + Share N Learn Portal
  Vanilla JS single-page app (hash routing).
*/

const API_BASE = (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '') + '/api'; // Use backend server in dev, relative in production

const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isAdmin: false,
  currentModule: null, // 'stationery' or 'sharelearn'
  currentPage: 'login',
  orderStatusOptions: ['Order placed', 'In queue', 'Packed successfully', 'Ready to collect', 'Delivered'],
};

const el = (id) => document.getElementById(id);

const request = async (path, options = {}) => {
  const headers = options.headers || {};
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  headers['Content-Type'] = headers['Content-Type'] || 'application/json';

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    showAlert('Unable to reach server. Is the backend running?', 'error');
    throw err;
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = { message: text };
  }

  if (!res.ok) {
    const message = data?.message || data?.error || 'Something went wrong';
    if (res.status === 401 || res.status === 403) {
      // Token expired / unauthorized - force logout
      clearSession();
      navigate('login');
      showAlert('Session expired. Please log in again.', 'warning');
    }
    throw new Error(message);
  }

  return data;
};

const downloadUpload = async (uploadId, filename) => {
  try {
    const res = await fetch(`${API_BASE}/uploads/download/${uploadId}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!res.ok) throw new Error('Download failed');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    // Update download count in UI immediately
    const card = document.querySelector(`.upload-card .download-btn[data-id="${uploadId}"]`);
    if (card) {
      const statsDiv = card.closest('.upload-card').querySelector('.stats');
      if (statsDiv) {
        const downloadSpan = statsDiv.querySelector('span:first-child');
        if (downloadSpan && downloadSpan.textContent.startsWith('⬇️ ')) {
          const current = parseInt(downloadSpan.textContent.replace('⬇️ ', '')) || 0;
          downloadSpan.textContent = `⬇️ ${current + 1}`;
        }
      }
    }


    if (state.currentModule === 'sharelearn' && state.currentPage === 'search') {
      const btn = el('searchBtn');
      if (btn) btn.click();
    }
  } catch (err) {
    showAlert(err.message, 'error');
  }
};

const createUploadCard = (upload) => {
  const avgRating = Number(((upload.averageRating ?? upload.rating) || 0).toFixed(1));
  const tags = Array.isArray(upload.tags) ? upload.tags : String(upload.tags || '').split(',');
  const tagHtml = tags
    .filter((t) => t && t.trim())
    .map((tag) => `<span class="tag">${tag.trim()}</span>`)
    .join('');

  const card = document.createElement('div');
  card.className = 'upload-card';
  card.innerHTML = `
    <h3>${upload.title}</h3>
    <p class="subject">${upload.subject}</p>
    <div class="meta">
      <span>Dept: ${upload.department}</span>
      <span>Sem: ${upload.semester}</span>
    </div>
    <div class="meta">
      <span>Uploaded by: ${upload.uploadedBy || 'Unknown'}</span>
    </div>
    <div class="tags">${tagHtml}</div>
    <div class="stats">
      <span>⬇️ ${upload.downloads || 0}</span>
      <span>Average: ${avgRating} / 5</span>
    </div>
    <div class="rating-stars" data-id="${upload._id}">
      ${[1, 2, 3, 4, 5]
      .map((i) => `<span class="star" data-value="${i}">${i <= Math.round(avgRating) ? '★' : '☆'}</span>`)
      .join('')}
    </div>
    <button class="primary download-btn" data-id="${upload._id}">Download</button>
  `;

  card.querySelector('.download-btn').addEventListener('click', () => {
    downloadUpload(upload._id, upload.title);
  });

  const updateRatingUI = (newAvg) => {
    const statsDiv = card.querySelector('.stats');
    if (statsDiv) {
      const avgSpan = statsDiv.querySelector('span:nth-child(2)');
      if (avgSpan) {
        avgSpan.textContent = `Average: ${newAvg.toFixed(1)} / 5`;
      }
    }

    const starsDiv = card.querySelector('.rating-stars');
    if (starsDiv) {
      starsDiv.innerHTML = [1, 2, 3, 4, 5]
        .map((i) => `<span class="star" data-value="${i}">${i <= Math.round(newAvg) ? '★' : '☆'}</span>`)
        .join('');
      starsDiv.querySelectorAll('.star').forEach((star) => {
        star.addEventListener('click', async () => {
          const value = Number(star.dataset.value);
          if (!value || value < 1 || value > 5) return;
          try {
            const res = await request(`/uploads/rate/${upload._id}`, {
              method: 'POST',
              body: JSON.stringify({ rating: value }),
            });
            showAlert('Thanks for rating!', 'success');
            updateRatingUI(Number(res.averageRating));
          } catch (err) {
            showAlert(err.message, 'error');
          }
        });
      });
    }
  };

  updateRatingUI(avgRating);

  return card;
};

const setSession = (token, user, isAdmin = false) => {
  state.token = token;
  state.user = user;
  state.isAdmin = isAdmin;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  if (isAdmin) {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_username', user.username);
  }

  // Initialize Socket.io for student sessions (for real-time updates)
  if (!isAdmin && user && typeof initSocket === 'function') {
    // Use _id if available, otherwise use rollNo
    const studentId = user._id || user.rollNo;
    if (studentId) {
      initSocket(studentId);
    }
  }
};

const clearSession = () => {
  state.token = null;
  state.user = null;
  state.isAdmin = false;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_username');
};

const showAlert = (message, type = 'info', timeout = 4000) => {
  const container = document.createElement('div');
  container.className = `alert ${type}`;
  container.textContent = message;
  document.body.prepend(container);
  setTimeout(() => container.remove(), timeout);
};

const navigate = (target) => {
  const parts = target.split('/');

  if (parts.length === 1) {
    // keep current module unless navigating to login/modules
    if (target === 'login' || target === 'modules') {
      state.currentModule = null;
    }
    state.currentPage = target;
  } else {
    state.currentModule = parts[0];
    state.currentPage = parts[1];
  }

  window.location.hash = `#${target}`;
  render();
};

const init = () => {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'login';
    const parts = hash.split('/');
    if (parts.length === 1) {
      state.currentModule = null;
      state.currentPage = hash;
    } else {
      state.currentModule = parts[0];
      state.currentPage = parts[1];
    }
    render();
  });

  const initial = window.location.hash.replace('#', '') || 'login';
  const parts = initial.split('/');
  if (parts.length === 1) {
    state.currentModule = null;
    state.currentPage = initial;
  } else {
    state.currentModule = parts[0];
    state.currentPage = parts[1];
  }
  render();
};

// --- Views ---

const renderLogin = () => {
  return `
  <div class="login-page">
    <div class="login-container">
      <!-- Main Heading -->
      <div class="login-header">
        <h1 class="main-title">Smart Service Hub</h1>
        <p class="subtitle">Your Complete Campus Solution</p>
      </div>

      <!-- Features Section -->
      <div class="features-section">
        <!-- Stationery Features -->
        <div class="feature-column stationery-features">
          <h3 class="feature-title">📚 Stationery</h3>
          <div class="feature-list">
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <p>Skip queues, order online</p>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <p>Fast & easy collection</p>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <p>All essentials in one place</p>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <p>Track your order live</p>
            </div>
          </div>
        </div>

        <!-- Share N Learn Features -->
        <div class="feature-column sharelearn-features">
          <h3 class="feature-title">📖 Share N Learn</h3>
          <div class="feature-list">
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <p>Access notes & PYQs easily</p>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <p>Upload & share resources</p>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <p>Quick search & discover</p>
            </div>
            <div class="feature-item">
              <span class="feature-icon">✓</span>
              <p>Earn top contributor rank</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Login Box -->
      <div class="login-box">
        <h2>Welcome Back!</h2>
        <p class="login-subtitle">Sign in to your account</p>
        <div class="form-row">
          <div>
            <label>Roll Number</label>
            <input id="loginRoll" placeholder="1601-24-749-001" />
          </div>
          <div>
            <label>Password</label>
            <input id="loginPassword" type="password" placeholder="Password" />
          </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--muted); margin: 10px 0;">
          Default password: your roll number
        </p>

        <div style="display:flex; gap: 12px; margin-top: 16px;">
          <button class="primary" id="loginBtn">Login</button>
          <button class="secondary" id="adminLoginBtn">Admin</button>
        </div>

        <div style="margin-top: 12px; font-size: 0.85rem; color: var(--muted); text-align: center;">
          <strong>Student roll range:</strong> 1601-24-749-001 to 1601-24-749-050
        </div>
      </div>
    </div>
  </div>
  `;
};

const renderDashboard = async () => {
  const userName = state.user?.name || state.user?.rollNo || '';
  window.portalModule = state.currentModule;
  const showTopbarSearch = !(
    (state.currentModule === 'stationery' && state.currentPage === 'shop') ||
    (state.currentModule === 'sharelearn' && ['search', 'upload'].includes(state.currentPage))
  );
  let navItems = '';

  if (state.currentModule === 'stationery') {
    navItems = `
      <button data-page="stationery/home" class="active">Home</button>
      <button data-page="stationery/shop">Shop</button>
      <button data-page="stationery/orders">Orders</button>
      <button data-page="stationery/cart">Cart</button>
      <button data-page="logout">Logout</button>
    `;
  } else if (state.currentModule === 'sharelearn') {
    navItems = `
      <button data-page="sharelearn/home" class="active">Home</button>
      <button data-page="sharelearn/upload">Upload</button>
      <button data-page="sharelearn/search">Search</button>
      <button data-page="sharelearn/dashboard">Dashboard</button>
      <button data-page="logout">Logout</button>
    `;
  }

  return `
  <div class="app-shell">
    <aside class="sidebar">
      <h1>${state.currentPage === 'profile' ? 'Profile' : state.currentModule === 'stationery' ? 'Stationery' : 'Share N Learn'}</h1>
      <nav>
        ${navItems}
      </nav>
    </aside>
    <main class="content">
      <div class="topbar">
        ${showTopbarSearch ? `<div class="search">
          <input id="searchInput" type="search" placeholder="Search..." />
          <button id="searchBtn" class="secondary">Search</button>
        </div>` : '<div></div>'}
        <div class="top-actions">
          <div style="position: relative; display: inline-block;">
            <button id="notificationsBtn" style="position: relative;">🔔
              <span id="notifications-badge" style="position: absolute; top: -8px; right: -8px; background: #EF4444; color: white; border-radius: 50%; width: 20px; height: 20px; display: none; flex-align: center; justify-content: center; font-size: 0.75rem; font-weight: bold; line-height: 20px; text-align: center; border: 2px solid white;"></span>
            </button>
          </div>
          <button id="profileBtn">👤 ${userName}</button>
          ${state.currentModule === 'stationery' ? `
            <div style="position: relative; display: inline-block;">
              <button id="cartBtn" style="position: relative;">🛒 Cart
                <span id="cart-badge" style="position: absolute; top: -8px; right: -8px; background: #EF4444; color: white; border-radius: 50%; width: 20px; height: 20px; display: none; flex-align: center; justify-content: center; font-size: 0.75rem; font-weight: bold; line-height: 20px; text-align: center; border: 2px solid white;"></span>
              </button>
            </div>
          ` : ''}
        </div>
      </div>

      <div id="pageContent"></div>
      
      <!-- Notification Modal -->
      <div id="notification-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; flex-align: center; justify-content: center; align-items: center;">
        <div style="background: white; border-radius: 0.5rem; width: 90%; max-width: 500px; padding: 2rem; max-height: 70vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
            <h2 style="margin: 0; font-size: 1.3rem;">${state.currentModule === 'sharelearn' ? 'Share N Learn Notifications' : 'Notifications'}</h2>
            <button id="close-notifications" style="background: none; border: none; cursor: pointer; font-size: 1.5rem; color: var(--text-muted);">✕</button>
          </div>
          <div id="notifications-list">
            <p style="padding: 2rem; text-align: center; color: var(--text-muted);">No notifications</p>
          </div>
        </div>
      </div>
    </main>
  </div>
  `;
};

const renderModuleSelection = () => {
  return `
  <div class="module-selection">
    <h1>Welcome, ${state.user.name || state.user.rollNo}</h1>
    <p>Choose a module to continue:</p>
    <div class="modules-grid">
      <div class="module-card" id="stationeryCard">
        <h2>📚 Stationery</h2>
        <p>Browse and purchase stationery items</p>
      </div>
      <div class="module-card" id="sharelearnCard">
        <h2>📖 Share N Learn</h2>
        <p>Upload and download academic files</p>
      </div>
    </div>
  </div>
  `;
};

const renderStationeryHome = () => `
  <div class="container">
    <h1>Welcome to Stationery Store</h1>
    <div class="featured-products">
      <h2>Featured Products</h2>
      <div id="featuredProducts" class="product-grid">
        <!-- Featured products will be loaded here -->
      </div>
    </div>
  </div>
`;

const renderStationeryShop = () => `
  <div class="container">
    <h1>Shop Stationery</h1>
    <div class="filters">
      <select id="categoryFilter">
        <option value="">All Categories</option>
        <option value="Notebooks">Notebooks</option>
        <option value="Pens">Pens</option>
        <option value="Pencils">Pencils</option>
        <option value="Graph Books">Graph Books</option>
        <option value="Boxes">Boxes</option>
        <option value="Files">Files</option>
        <option value="Lab Manuals">Lab Manuals</option>
        <option value="Drawing Sheets">Drawing Sheets</option>
      </select>
    </div>
    <div id="productsGrid" class="product-grid">
      <!-- Products will be loaded here -->
    </div>
  </div>
`;

const renderShareLearnHome = () => `
  <div class="container">
    <h1>Welcome to Share N Learn</h1>
    <div class="recent-uploads">
      <h2>Recent Uploads</h2>
      <div id="recentUploads" class="upload-grid">
        <!-- Recent uploads will be loaded here -->
      </div>
    </div>
  </div>
`;

const renderShareLearnUpload = () => `
  <div class="container">
    <h1>Upload Academic Resource</h1>
    <form id="uploadForm" class="upload-form">
      <div class="form-row">
        <div>
          <label>Subject *</label>
          <input id="uploadSubject" required />
        </div>
        <div>
          <label>Department *</label>
          <select id="uploadDepartment" required>
            <option value="">Select Department</option>
            <option value="CSE">CSE</option>
            <option value="ECE">ECE</option>
            <option value="ME">ME</option>
            <option value="CE">CE</option>
            <option value="EE">EE</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>Semester *</label>
          <select id="uploadSemester" required>
            <option value="">Select Semester</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
          </select>
        </div>
        <div>
          <label>Title *</label>
          <input id="uploadTitle" required />
        </div>
      </div>
      <div class="form-row">
        <div style="flex:1">
          <label>Tags (comma separated)</label>
          <input id="uploadTags" placeholder="e.g., exam, notes, assignment" />
        </div>
      </div>
      <div class="form-row">
        <div style="flex:1">
          <label>Description</label>
          <textarea id="uploadDescription" rows="3" placeholder="Brief description of the resource"></textarea>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>File *</label>
          <input id="uploadFile" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png" required />
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="primary">Upload</button>
      </div>
    </form>
  </div>
`;

const renderShareLearnSearch = () => `
  <div class="container">
    <h1>Search Resources</h1>
    <div class="search-filters">
      <div class="form-row">
        <div>
          <label>Subject</label>
          <input id="searchSubject" placeholder="e.g., Data Structures" />
        </div>
        <div>
          <label>Department</label>
          <select id="searchDepartment">
            <option value="">All Departments</option>
            <option value="CSE">CSE</option>
            <option value="ECE">ECE</option>
            <option value="ME">ME</option>
            <option value="CE">CE</option>
            <option value="EE">EE</option>
          </select>
        </div>
        <div>
          <label>Semester</label>
          <select id="searchSemester">
            <option value="">All Semesters</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>Uploaded By</label>
          <select id="searchUploadedBy">
            <option value="">All Students</option>
          </select>
        </div>
        <div style="flex:1">
          <label>Keywords</label>
          <input id="searchKeywords" placeholder="Search in title, tags, description" />
        </div>
        <div>
          <label>Sort by</label>
          <select id="searchSort">
            <option value="rating">Rating</option>
            <option value="downloads">Downloads</option>
            <option value="recent">Recent</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button id="searchBtn" class="primary">Search</button>
      </div>
    </div>
    <div id="searchResults" class="upload-grid">
      <!-- Search results will be loaded here -->
    </div>
  </div>
`;

const renderShareLearnDashboard = () => `
  <div class="container">
    <h1>Student Dashboard</h1>
    <div class="dashboard-stats">
      <div class="stat-card">
        <h3>Your Uploads</h3>
        <div id="userUploadsCount">0</div>
      </div>
      <div class="stat-card">
        <h3>Total Downloads</h3>
        <div id="userDownloadsCount">0</div>
      </div>
      <div class="stat-card">
        <h3>Average Rating</h3>
        <div id="userAvgRating">0</div>
      </div>
    </div>
    <div class="leaderboard">
      <h2>Top Contributors</h2>
      <div id="leaderboard" class="leaderboard-list">
        <!-- Leaderboard will be loaded here -->
      </div>
    </div>
  </div>
`;

const renderNotFound = () => `
  <div class="container">
    <h1>Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <button onclick="navigate('${state.currentModule ? state.currentModule + '/home' : 'login'}')">Go Home</button>
  </div>
`;

const renderStationery = () => {
  return `
    <div class="panel">
      <h2>Stationery Store</h2>
      <div class="grid" id="stationeryGrid"></div>
    </div>
  `;
};

const renderCart = () => {
  return `
    <div class="panel">
      <h2>Your Cart</h2>
      <div id="cartContainer"></div>
    </div>
  `;
};

const renderOrders = () => {
  return `
    <div class="panel">
      <h2>Your Orders</h2>
      <div id="ordersContainer"></div>
    </div>
  `;
};

const renderProfile = () => {
  return `
    <div class="panel">
      <h2>Profile</h2>
      <div class="form-row">
        <div>
          <label>Roll Number</label>
          <input id="profileRoll" disabled />
        </div>
        <div>
          <label>Name</label>
          <input id="profileName" />
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>Department</label>
          <input id="profileDept" />
        </div>
        <div>
          <label>Email</label>
          <input id="profileEmail" type="email" />
        </div>
      </div>
      <div class="form-row">
        <div>
          <label>Mobile</label>
          <input id="profileMobile" />
        </div>
      </div>
      <div style="display:flex; gap:10px; margin-top:14px;">
        <button class="primary" id="saveProfileBtn">Save profile</button>
        <button class="secondary" id="changePassBtn">Change password</button>
      </div>
    </div>
  `;
};

const renderShareLearn = () => {
  return `
    <div class="panel">
      <h2>Share N Learn</h2>
      <div class="form-row">
        <div><label>Subject</label><input id="uploadSubject" /></div>
        <div><label>Title</label><input id="uploadTitle" /></div>
      </div>
      <div class="form-row">
        <div style="flex:1"><label>Tags (comma separated)</label><input id="uploadTags" /></div>
      </div>
      <div class="form-row">
        <div style="flex:1"><label>Description</label><textarea id="uploadDescription" rows="3"></textarea></div>
      </div>
      <div class="form-row">
        <div><label>File (pdf/doc/ppt/image)</label><input id="uploadFile" type="file" /></div>
      </div>
      <div style="margin-top:12px; display:flex; gap:10px;"><button class="primary" id="uploadBtn">Upload</button></div>
    </div>
    <div class="panel">
      <h2>Available Files</h2>
      <div id="uploadsGrid" class="grid"></div>
    </div>
  `;
};

const renderAdminLogin = () => {
  return `
  <div class="login-page">
    <div class="login-container">
      <!-- Main Heading -->
      <div class="login-header">
        <h1 class="main-title">Admin Portal</h1>
        <p class="subtitle">Campus Stationery Management</p>
      </div>

      <!-- Admin Login Box -->
      <div class="login-box" style="max-width: 450px; margin: 60px auto 0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; font-size: 2rem;">
            🔒
          </div>
        </div>
        <h2 style="text-align: center;">Admin Access</h2>
        <p class="login-subtitle" style="text-align: center;">Enter your admin credentials</p>
        
        <div class="form-row">
          <div>
            <label>Username</label>
            <input id="adminUsername" placeholder="Enter admin username" />
          </div>
          <div>
            <label>Password</label>
            <input id="adminPassword" type="password" placeholder="Enter admin password" />
          </div>
        </div>

        <div style="display:flex; gap: 12px; margin-top: 16px;">
          <button class="primary" id="adminSubmitBtn" style="width: 100%;">Admin Login</button>
        </div>

        <button id="backToLoginBtn" class="secondary" style="width: 100%; margin-top: 10px;">Back to Login</button>
      </div>
    </div>
  </div>
  `;
};

const renderAdmin = () => {
  return `<div class="panel">
    <h2>Admin Dashboard</h2>
    <p>Use the API directly (not implemented in this UI yet).</p>
  </div>`;
};

// --- Page logic ---

const mountModuleSelection = () => {
  el('stationeryCard').addEventListener('click', () => navigate('stationery/home'));
  el('sharelearnCard').addEventListener('click', () => navigate('sharelearn/home'));
};

const mountLogin = () => {
  const loginBtn = el('loginBtn');
  const adminLoginBtn = el('adminLoginBtn');

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const roll = el('loginRoll').value.trim();
      const pwd = el('loginPassword').value;
      if (!roll || !pwd) return showAlert('Please enter roll number and password', 'warning');

      try {
        const res = await request('/auth/student/login', {
          method: 'POST',
          body: JSON.stringify({ rollNo: roll, password: pwd }),
        });

        if (res.firstLogin) {
          const newPassword = prompt('First login detected. Please enter a new password (min 6 chars):');
          if (!newPassword || newPassword.length < 6) return showAlert('Password not changed.', 'warning');
          const passwordRes = await request('/auth/student/change-password', {
            method: 'POST',
            body: JSON.stringify({ rollNo: roll, currentPassword: pwd, newPassword }),
          });
          setSession(passwordRes.token, { rollNo: roll }, false);
          navigate('modules');
          return;
        }

        setSession(res.token, res.student, false);
        navigate('modules');
      } catch (err) {
        console.error('Login error:', err);
        showAlert(err.message, 'error');
      }
    });
  }

  if (adminLoginBtn) {
    adminLoginBtn.addEventListener('click', () => {
      console.log('Admin login button clicked');
      navigate('adminLogin');
    });
  }
};

const mountAdminLogin = () => {
  const adminSubmitBtn = el('adminSubmitBtn');
  const backToLoginBtn = el('backToLoginBtn');

  if (adminSubmitBtn) {
    adminSubmitBtn.addEventListener('click', async () => {
      const username = el('adminUsername').value.trim();
      const password = el('adminPassword').value;
      if (!username || !password) {
        return showAlert('Please enter username and password', 'warning');
      }

      try {
        const res = await request('/auth/admin/login', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        });

        setSession(res.token, res.admin, true);
        // Directly redirect to admin dashboard without any intermediate pages
        setTimeout(() => {
          window.location.href = '/admin/dashboard';
        }, 100);
      } catch (err) {
        console.error('Admin login error:', err);
        showAlert(err.message, 'error');
      }
    });
  }

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener('click', () => {
      navigate('login');
    });
  }
};

const mountShell = () => {
  const buttons = document.querySelectorAll('.sidebar nav button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page === 'logout') {
        clearSession();
        window.location.assign('/');
        return;
      }

      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      navigate(page);
    });
  });

  const searchBtn = el('searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const term = el('searchInput').value.trim();
      if (!term) return;
      state.searchQuery = term;
      if (state.currentModule === 'stationery') {
        navigate('stationery/shop');
      } else if (state.currentModule === 'sharelearn') {
        navigate('sharelearn/search');
      }
    });
  }

  el('cartBtn')?.addEventListener('click', () => {
    resetCartBadge?.();
    navigate('stationery/cart');
  });
  el('profileBtn')?.addEventListener('click', () => navigate('profile'));
  el('notificationsBtn')?.addEventListener('click', () => {
    if (typeof openNotificationPanel === 'function') {
      openNotificationPanel();
    }
  });

  // Close notification modal
  el('close-notifications')?.addEventListener('click', () => {
    if (typeof closeNotificationPanel === 'function') {
      closeNotificationPanel();
    }
  });

  // Close on outside click
  el('notification-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'notification-modal' && typeof closeNotificationPanel === 'function') {
      closeNotificationPanel();
    }
  });
};

const loadStationery = async () => {
  const container = el('stationeryGrid');
  if (!container) return;
  container.innerHTML = '<p>Loading products...</p>';

  try {
    const query = state.searchQuery ? `?search=${encodeURIComponent(state.searchQuery)}` : '';
    const res = await request(`/products${query}`);
    container.innerHTML = '';

    if (!res.items?.length) {
      container.innerHTML = '<p>No products found.</p>';
      return;
    }

    for (const product of res.items) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="http://localhost:5000${product.image}" alt="${product.name}" />
        <h3>${product.name}</h3>
        <div class="meta">
          <span>${product.category || 'Stationery'}</span>
          <span>₹${product.price.toFixed(2)}</span>
        </div>
        <div class="meta">
          <span>Stock: ${product.stock}</span>
          <span>ID: ${product._id.slice(-6)}</span>
        </div>
        <div class="actions">
          <button class="secondary add-btn">Add to cart</button>
          <button class="primary buy-btn">Buy now</button>
        </div>
      `;

      card.querySelector('.add-btn').addEventListener('click', async () => {
        try {
          await request('/cart', {
            method: 'POST',
            body: JSON.stringify({ productId: product._id, quantity: 1 }),
          });
          showAlert('Added to cart', 'success');
        } catch (err) {
          showAlert(err.message, 'error');
        }
      });

      card.querySelector('.buy-btn').addEventListener('click', async () => {
        try {
          await request('/orders', {
            method: 'POST',
            body: JSON.stringify({ items: [{ productId: product._id, quantity: 1 }] }),
          });
          showAlert('Order placed', 'success');
        } catch (err) {
          showAlert(err.message, 'error');
        }
      });

      container.appendChild(card);
    }
  } catch (err) {
    container.innerHTML = `<p class="alert error">${err.message}</p>`;
  }
};

const loadCart = async () => {
  const container = el('cartContainer');
  if (!container) return;

  try {
    const cart = await request('/cart');
    if (!cart.products?.length) {
      container.innerHTML = '<p>Your cart is empty.</p>';
      return;
    }

    const rows = cart.products.map((item) => {
      const total = (item.priceAtAdd || 0) * item.quantity;
      return `
        <div class="card">
          <h3>${item.productId?.name || 'Product'}</h3>
          <div class="meta">
            <span>Qty: <input type="number" min="1" value="${item.quantity}" data-id="${item.productId?._id}" class="qty-input" style="width:68px" /></span>
            <span>Price: ₹${item.priceAtAdd.toFixed(2)}</span>
          </div>
          <div class="meta">
            <span>Total: ₹${total.toFixed(2)}</span>
            <button class="secondary remove-btn" data-id="${item.productId?._id}">Remove</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="grid">${rows.join('')}</div>
      <div style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="primary" id="checkoutBtn">Place order</button>
        <button class="secondary" id="clearCartBtn">Clear cart</button>
      </div>
    `;

    container.querySelectorAll('.qty-input').forEach((input) => {
      input.addEventListener('change', async (event) => {
        const qty = parseInt(event.target.value, 10);
        const productId = event.target.dataset.id;
        if (qty < 1) return;
        try {
          await request('/cart', {
            method: 'PUT',
            body: JSON.stringify({ productId, quantity: qty }),
          });
          loadCart();
        } catch (err) {
          showAlert(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('.remove-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await request(`/cart/${btn.dataset.id}`, { method: 'DELETE' });
          loadCart();
        } catch (err) {
          showAlert(err.message, 'error');
        }
      });
    });

    el('checkoutBtn').addEventListener('click', async () => {
      try {
        await request('/orders', { method: 'POST' });
        showAlert('Order placed', 'success');
        loadCart();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });

    el('clearCartBtn').addEventListener('click', async () => {
      try {
        await request('/cart', { method: 'DELETE' });
        showAlert('Cart cleared', 'info');
        loadCart();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });
  } catch (err) {
    container.innerHTML = `<p class="alert error">${err.message}</p>`;
  }
};

const loadOrders = async () => {
  const container = el('ordersContainer');
  if (!container) return;

  try {
    const orders = await request('/orders');
    if (!orders.length) {
      container.innerHTML = '<p>No orders yet.</p>';
      return;
    }

    const html = orders
      .map(
        (order) => `
        <div class="card" data-order-id="${order._id}">
          <h3>Order ${order.orderNumber}</h3>
          <div class="meta">
            <span>Status: <strong data-order-status>${order.status}</strong></span>
            <span>Date: ${new Date(order.createdAt).toLocaleString()}</span>
          </div>
          <div style="margin-top: 8px;">
            ${order.items
            .map(
              (item) =>
                `<div style="display:flex; justify-content: space-between; padding: 6px 0; border-top: 1px solid var(--border);"><span>${item.name} × ${item.quantity}</span><span>₹${(item.price * item.quantity).toFixed(2)}</span></div>`
            )
            .join('')}
          </div>
          <div style="margin-top: 10px; font-weight: 600;">Total: ₹${order.totalPrice.toFixed(2)}</div>
          ${['Order placed', 'In queue', 'Reviewed', 'Processing'].includes(order.status)
            ? `<button class="secondary cancel-order-btn" data-order-id="${order._id}" style="margin-top: 12px;">Cancel Order</button>`
            : ''}
        </div>
      `
      )
      .join('');

    container.innerHTML = html;
    container.querySelectorAll('.cancel-order-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirm('Cancel this order?')) return;
        button.disabled = true;
        try {
          await request(`/orders/${button.dataset.orderId}`, { method: 'DELETE' });
          showAlert('Order cancelled successfully', 'success');
          await loadOrders();
        } catch (err) {
          showAlert(err.message, 'error');
          button.disabled = false;
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<p class="alert error">${err.message}</p>`;
  }
};

window.refreshStudentOrders = loadOrders;

const loadShareLearn = async () => {
  const uploadsGrid = el('uploadsGrid');
  const uploadBtn = el('uploadBtn');

  const listUploads = async () => {
    const res = await request('/uploads');
    uploadsGrid.innerHTML = '';

    if (!res.items?.length) {
      uploadsGrid.innerHTML = '<p>No files uploaded yet.</p>';
      return;
    }

    res.items.forEach((u) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>${u.title}</h3>
        <div class="meta"><span>Subject: ${u.subject}</span><span>By: ${u.uploadedBy}</span></div>
        <div class="meta"><span>Rating: ${u.rating || 0}</span><span>Downloads: ${u.downloads || 0}</span></div>
        <div class="actions">
          <button class="secondary download-btn">Download</button>
          <button class="secondary rate-btn">Rate</button>
        </div>
      `;

      card.querySelector('.download-btn').addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = `/api/uploads/download/${u._id}`;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        link.remove();
      });

      card.querySelector('.rate-btn').addEventListener('click', async () => {
        const rating = prompt('Rate 1-5 stars:');
        const value = Number(rating);
        if (!value || value < 1 || value > 5) return showAlert('Rating should be 1–5', 'warning');
        try {
          await request(`/uploads/rate/${u._id}`, {
            method: 'POST',
            body: JSON.stringify({ rating: value }),
          });
          showAlert('Thanks for rating!', 'success');
          listUploads();
        } catch (err) {
          showAlert(err.message, 'error');
        }
      });

      uploadsGrid.appendChild(card);
    });
  };

  uploadBtn.addEventListener('click', async () => {
    const subject = el('uploadSubject').value;
    const title = el('uploadTitle').value;
    const tags = el('uploadTags').value;
    const description = el('uploadDescription').value;
    const file = el('uploadFile').files[0];

    if (!subject || !title || !file) {
      return showAlert('Subject, title and file are required', 'warning');
    }

    const form = new FormData();
    form.append('subject', subject);
    form.append('title', title);
    form.append('tags', tags);
    form.append('description', description);
    form.append('file', file);

    try {
      await fetch(`${API_BASE}/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.token}` },
        body: form,
      });
      showAlert('Uploaded successfully', 'success');
      listUploads();
    } catch (err) {
      showAlert(err.message || 'Upload failed', 'error');
    }
  });

  listUploads();
};

// --- New Load Functions ---

const loadStationeryHome = async () => {
  const featuredProducts = el('featuredProducts');
  try {
    const res = await request('/products');
    featuredProducts.innerHTML = '';

    // Show first 6 products as featured
    const featured = (res.items || []).slice(0, 6);
    featured.forEach((product) => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <img src="http://localhost:5000${product.image}" alt="${product.name}" />
        <h3>${product.name}</h3>
        <p class="price">₹${product.price}</p>
        <p class="stock">Stock: ${product.stock}</p>
        <button class="primary add-to-cart-btn" data-id="${product._id}">Add to Cart</button>
      `;

      card.querySelector('.add-to-cart-btn').addEventListener('click', async () => {
        try {
          await request('/cart', {
            method: 'POST',
            body: JSON.stringify({ productId: product._id, quantity: 1 }),
          });
          showAlert('Added to cart!', 'success');
        } catch (err) {
          showAlert(err.message, 'error');
        }
      });

      featuredProducts.appendChild(card);
    });
  } catch (err) {
    featuredProducts.innerHTML = '<p>Failed to load featured products.</p>';
    showAlert(err.message, 'error');
  }
};

const loadStationeryShop = async () => {
  const productsGrid = el('productsGrid');
  const categoryFilter = el('categoryFilter');

  // default to all categories
  if (categoryFilter) categoryFilter.value = '';

  const loadProducts = async (category = '') => {
    try {
      const queryParams = new URLSearchParams();
      if (category) queryParams.append('category', category);
      const url = queryParams.toString() ? `/products?${queryParams}` : '/products';

      const res = await request(url);
      const products = res.items || [];
      productsGrid.innerHTML = '';

      if (!products.length) {
        productsGrid.innerHTML = '<p>No products found.</p>';
        return;
      }

      products.forEach((product) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
          <img src="http://localhost:5000${product.image}" alt="${product.name}" />
          <h3>${product.name}</h3>
          <p class="category">${product.category}</p>
          <p class="price">₹${product.price}</p>
          <p class="stock">Stock: ${product.stock}</p>
          <button class="primary buy-now-btn" data-id="${product._id}">Buy Now</button>
          <button class="secondary add-to-cart-btn" data-id="${product._id}">Add to Cart</button>
        `;

        card.querySelector('.add-to-cart-btn').addEventListener('click', async () => {
          try {
            await request('/cart', {
              method: 'POST',
              body: JSON.stringify({ productId: product._id, quantity: 1 }),
            });
            showAlert('Added to cart!', 'success');
          } catch (err) {
            showAlert(err.message, 'error');
          }
        });

        card.querySelector('.buy-now-btn').addEventListener('click', async () => {
          if (product.stock <= 0) {
            showAlert('Out of stock!', 'warning');
            return;
          }

          const confirmed = confirm(`Buy ${product.name} for ₹${product.price}?`);
          if (!confirmed) return;

          try {
            await request('/orders', {
              method: 'POST',
              body: JSON.stringify({ items: [{ productId: product._id, quantity: 1 }] }),
            });
            showAlert('Order placed successfully!', 'success');
            loadProducts(category); // Refresh to show updated stock
          } catch (err) {
            showAlert(err.message, 'error');
          }
        });

        productsGrid.appendChild(card);
      });
    } catch (err) {
      productsGrid.innerHTML = '<p>Failed to load products.</p>';
      showAlert(err.message, 'error');
    }
  };

  categoryFilter?.addEventListener('change', () => {
    loadProducts(categoryFilter.value);
  });

  loadProducts();
};

const loadShareLearnHome = async () => {
  const recentUploads = el('recentUploads');
  try {
    const res = await request('/uploads');
    recentUploads.innerHTML = '';

    // Show first 6 uploads as recent
    const recent = res.items.slice(0, 6);
    recent.forEach((upload) => {
      const card = createUploadCard(upload);
      recentUploads.appendChild(card);
    });
  } catch (err) {
    recentUploads.innerHTML = '<p>Failed to load recent uploads.</p>';
    showAlert(err.message, 'error');
  }
};

const loadShareLearnUpload = async () => {
  const uploadForm = el('uploadForm');
  const uploadsGrid = el('uploadsGrid');

  const listUploads = async () => {
    try {
      const res = await request('/uploads');
      uploadsGrid.innerHTML = '';

      if (!res.items?.length) {
        uploadsGrid.innerHTML = '<p>No files uploaded yet.</p>';
        return;
      }

      res.items.forEach((u) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <h3>${u.title}</h3>
          <div class="meta"><span>Subject: ${u.subject}</span><span>By: ${u.uploadedBy}</span></div>
          <div class="meta"><span>Rating: ${u.rating || 0}</span><span>Downloads: ${u.downloads || 0}</span></div>
          <div class="actions">
            <button class="secondary download-btn">Download</button>
            <button class="secondary rate-btn">Rate</button>
          </div>
        `;

        card.querySelector('.download-btn').addEventListener('click', () => {
          const link = document.createElement('a');
          link.href = `/api/uploads/download/${u._id}`;
          link.download = '';
          document.body.appendChild(link);
          link.click();
          link.remove();
        });

        card.querySelector('.rate-btn').addEventListener('click', async () => {
          const rating = prompt('Rate 1-5 stars:');
          const value = Number(rating);
          if (!value || value < 1 || value > 5) return showAlert('Rating should be 1–5', 'warning');
          try {
            await request(`/uploads/rate/${u._id}`, {
              method: 'POST',
              body: JSON.stringify({ rating: value }),
            });
            showAlert('Thanks for rating!', 'success');
            listUploads();
          } catch (err) {
            showAlert(err.message, 'error');
          }
        });

        uploadsGrid.appendChild(card);
      });
    } catch (err) {
      uploadsGrid.innerHTML = '<p>Failed to load uploads.</p>';
      showAlert(err.message, 'error');
    }
  };

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const subject = el('uploadSubject').value.trim();
    const department = el('uploadDepartment').value;
    const semester = el('uploadSemester').value;
    const title = el('uploadTitle').value.trim();
    const tags = el('uploadTags').value.trim();
    const description = el('uploadDescription').value.trim();
    const file = el('uploadFile').files[0];

    if (!subject || !department || !semester || !title || !file) {
      return showAlert('All required fields must be filled', 'warning');
    }

    const form = new FormData();
    form.append('subject', subject);
    form.append('department', department);
    form.append('semester', semester);
    form.append('title', title);
    form.append('tags', tags);
    form.append('description', description);
    form.append('file', file);

    try {
      await fetch(`${API_BASE}/uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.token}` },
        body: form,
      });
      showAlert('File uploaded successfully', 'success');
      uploadForm.reset();
      listUploads();
    } catch (err) {
      showAlert(err.message || 'Upload failed', 'error');
    }
  });

  listUploads();
};

const loadShareLearnSearch = async () => {
  const searchBtn = el('searchBtn');
  const searchResults = el('searchResults');

  const performSearch = async () => {
    const subject = el('searchSubject').value.trim();
    const department = el('searchDepartment').value;
    const semester = el('searchSemester').value;
    const uploadedBy = el('searchUploadedBy').value;
    const keywords = el('searchKeywords').value.trim();
    const sort = el('searchSort').value;

    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (department) params.append('department', department);
    if (semester) params.append('semester', semester);
    if (uploadedBy) params.append('studentId', uploadedBy);
    if (keywords) params.append('keywords', keywords);
    params.append('sort', sort);

    try {
      const res = await request(`/uploads?${params}`);
      searchResults.innerHTML = '';

      if (!res.items?.length) {
        searchResults.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);"><p style="margin: 0;">No files found matching your search criteria.</p></div>';
        return;
      }

      res.items.forEach((upload) => {
        const card = createUploadCard(upload);
        searchResults.appendChild(card);
      });
    } catch (err) {
      searchResults.innerHTML = '<p style="padding: 20px; color: var(--error);">Search failed.</p>';
      showAlert(err.message, 'error');
    }
  };

  searchBtn.addEventListener('click', performSearch);

  // Populate "Uploaded By" dropdown with unique students
  const populateUploadedByDropdown = async () => {
    try {
      const res = await request('/uploads?limit=1000'); // Get many uploads to extract unique students
      const uploadedBySelect = el('searchUploadedBy');
      const uniqueStudents = new Map(); // Use Map to track unique students by ID

      if (res.items && res.items.length > 0) {
        res.items.forEach((upload) => {
          if (upload.studentId && upload.uploadedBy && !uniqueStudents.has(upload.studentId)) {
            uniqueStudents.set(upload.studentId, upload.uploadedBy);
          }
        });

        // Sort students by name
        const sortedStudents = Array.from(uniqueStudents.entries()).sort((a, b) =>
          a[1].localeCompare(b[1])
        );

        // Add options to dropdown
        sortedStudents.forEach(([studentId, studentName]) => {
          const option = document.createElement('option');
          option.value = studentId;
          option.textContent = studentName;
          uploadedBySelect.appendChild(option);
        });
      }
    } catch (err) {
      console.error('Error populating Uploaded By dropdown:', err);
    }
  };

  populateUploadedByDropdown();

};

const loadShareLearnDashboard = async () => {
  try {
    const res = await request('/uploads/dashboard');

    const stats = res.myStats || {};
    el('userUploadsCount').textContent = stats.uploads ?? 0;
    el('userDownloadsCount').textContent = stats.downloads ?? 0;
    el('userAvgRating').textContent = (stats.avgRating ?? 0).toFixed(1);

    const leaderboard = el('leaderboard');
    leaderboard.innerHTML = '';

    res.leaderboard.forEach((student, index) => {
      const item = document.createElement('div');
      item.className = 'leaderboard-item';
      item.innerHTML = `
        <span class="rank">#${index + 1}</span>
        <span class="name">${student.name} (${student.rollNo})</span>
        <span class="score">${student.uploads} uploads | Avg Rating ${student.avgRating?.toFixed(1) ?? '0.0'}</span>
      `;
      leaderboard.appendChild(item);
    });
  } catch (err) {
    showAlert('Failed to load dashboard', 'error');
  }
};

const loadProfile = async () => {
  try {
    const res = await request('/profile');

    el('profileRoll').value = res.rollNo || '';
    el('profileName').value = res.name || '';
    el('profileDept').value = res.department || '';
    el('profileEmail').value = res.email || '';
    el('profileMobile').value = res.mobile || '';

    el('saveProfileBtn').addEventListener('click', async () => {
      try {
        const updated = {
          name: el('profileName').value.trim(),
          department: el('profileDept').value.trim(),
          email: el('profileEmail').value.trim(),
          mobile: el('profileMobile').value.trim(),
        };
        const updatedProfile = await request('/profile', {
          method: 'PUT',
          body: JSON.stringify(updated),
        });
        setSession(state.token, updatedProfile, state.isAdmin);
        showAlert('Profile updated successfully', 'success');
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });

    el('changePassBtn').addEventListener('click', async () => {
      const current = prompt('Current password:');
      if (!current) return;
      const next = prompt('New password (min 6 chars):');
      if (!next || next.length < 6) return showAlert('New password must be at least 6 characters', 'warning');

      try {
        const res = await request('/auth/student/change-password', {
          method: 'POST',
          body: JSON.stringify({
            rollNo: res.rollNo,
            currentPassword: current,
            newPassword: next,
          }),
        });
        setSession(res.token, state.user, state.isAdmin);
        showAlert('Password changed successfully', 'success');
      } catch (err) {
        showAlert(err.message, 'error');
      }
    });
  } catch (err) {
    showAlert('Failed to load profile', 'error');
  }
};

const renderApp = async () => {
  // Always show login page when the route is #login (clears any existing session)
  if (state.currentPage === 'login') {
    clearSession();
    state.currentModule = null;
    document.getElementById('app').innerHTML = renderLogin();
    mountLogin();
    return;
  }

  // Admin login page
  if (state.currentPage === 'adminLogin') {
    clearSession();
    state.currentModule = null;
    document.getElementById('app').innerHTML = renderAdminLogin();
    mountAdminLogin();
    return;
  }

  // If not logged in, force login page
  if (!state.token) {
    navigate('login');
    return;
  }

  // If already logged in and trying to view modules/login, send to module selection
  if (state.token && state.currentPage === 'login') {
    navigate('modules');
    return;
  }

  if (state.currentPage === 'modules') {
    document.getElementById('app').innerHTML = renderModuleSelection();
    mountModuleSelection();
    return;
  }

  document.getElementById('app').innerHTML = await renderDashboard();
  mountShell();
  window.loadStudentNotifications?.({ module: state.currentModule });

  const page = state.currentPage;
  const content = el('pageContent');

  // Profile page can be viewed from any module
  if (page === 'profile') {
    content.innerHTML = renderProfile();
    loadProfile();
    return;
  }

  if (state.currentModule === 'stationery') {
    if (page === 'home') {
      content.innerHTML = renderStationeryHome();
      loadStationeryHome();
    } else if (page === 'shop') {
      content.innerHTML = renderStationeryShop();
      loadStationeryShop();
    } else if (page === 'orders') {
      content.innerHTML = renderOrders();
      loadOrders();
    } else if (page === 'cart') {
      content.innerHTML = renderCart();
      loadCart();
    } else {
      content.innerHTML = renderNotFound();
    }
  } else if (state.currentModule === 'sharelearn') {
    if (page === 'home') {
      content.innerHTML = renderShareLearnHome();
      loadShareLearnHome();
    } else if (page === 'upload') {
      content.innerHTML = renderShareLearnUpload();
      loadShareLearnUpload();
    } else if (page === 'search') {
      content.innerHTML = renderShareLearnSearch();
      loadShareLearnSearch();
    } else if (page === 'dashboard') {
      content.innerHTML = renderShareLearnDashboard();
      loadShareLearnDashboard();
    } else {
      content.innerHTML = renderNotFound();
    }
  } else {
    content.innerHTML = renderNotFound();
  }
};

const render = () => {
  try {
    renderApp();
  } catch (err) {
    console.error(err);
    document.getElementById('app').innerHTML = `<div class="panel"><h2>Error</h2><p>${err.message}</p></div>`;
  }
};

init();
