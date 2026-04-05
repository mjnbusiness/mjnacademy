/* mjnacademy Admin Panel - Full Supabase Integration */
(function() {
  'use strict';

  const SUPABASE_URL = "https://qfuiotahocgknxhcjylh.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmdWlvdGFob2Nna254aGNqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDM1MDEsImV4cCI6MjA5MDIxOTUwMX0.XGauYwbIhlixu32i-BUvmVqCWb--dxNqVKJjzoC-jCc";

  let supabaseClient;
  let currentUser = null;
  let isAdmin = false;
  let activeTab = 'stats';
  let pendingRequestsSubscription = null;

  // Helper: toast notifications
  function toast(message, type = 'success') {
    const toastDiv = document.createElement('div');
    toastDiv.className = 'toast';
    toastDiv.style.background = type === 'error' ? '#dc2626' : '#10b981';
    toastDiv.innerText = message;
    document.body.appendChild(toastDiv);
    setTimeout(() => toastDiv.remove(), 3000);
  }

  // Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  // Initialize Supabase client
  function initSupabase() {
    if (typeof window.supabase === 'undefined') {
      console.error('Supabase library not loaded');
      return;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true }
    });
  }
  initSupabase();

  // Check admin status
  async function checkAdminStatus(userId) {
    if (!userId) return false;
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();
    if (error || !data) return false;
    return data.is_admin === true;
  }

  // Auth check and redirect
  async function requireAdmin() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user ?? null;
    if (!currentUser) {
      window.location.href = '../pages/login.html';
      return false;
    }
    isAdmin = await checkAdminStatus(currentUser.id);
    if (!isAdmin) {
      alert('Access denied. You are not an administrator.');
      window.location.href = '../index.html';
      return false;
    }
    return true;
  }

  // Tab rendering dispatcher
  async function renderTab(tabId) {
    const container = document.getElementById('admin-tab-content');
    container.innerHTML = '<div class="loading-spinner"></div> Loading...';
    activeTab = tabId;
    switch (tabId) {
      case 'stats': await renderStatsTab(container); break;
      case 'users': await renderUsersTab(container); break;
      case 'courses': await renderCoursesTab(container); break;
      case 'modules': await renderModulesTab(container); break;
      case 'downloads': await renderDownloadsTab(container); break;
      case 'enrollments': await renderEnrollmentsTab(container); break;
      default: container.innerHTML = '<div class="card">Unknown tab</div>';
    }
  }

  // ==================== STATS DASHBOARD ====================
  async function renderStatsTab(container) {
    try {
      const [usersRes, coursesRes, enrollmentsRes] = await Promise.all([
        supabaseClient.from('user_profiles').select('*', { count: 'exact', head: false }),
        supabaseClient.from('courses').select('*', { count: 'exact' }),
        supabaseClient.from('enrollments').select('*', { count: 'exact' })
      ]);
      const totalUsers = usersRes.data?.length || 0;
      const activeUsers = usersRes.data?.filter(u => u.status === 'active').length || 0;
      const blockedUsers = usersRes.data?.filter(u => u.status === 'blocked').length || 0;
      const totalCourses = coursesRes.count || 0;
      const publishedCourses = coursesRes.data?.filter(c => c.is_published).length || 0;
      const totalEnrollments = enrollmentsRes.count || 0;

      let totalRevenue = 0;
      const { data: enrollsWithCourses } = await supabaseClient
        .from('enrollments')
        .select('course_id, courses(price)');
      if (enrollsWithCourses) {
        totalRevenue = enrollsWithCourses.reduce((sum, e) => sum + (e.courses?.price || 0), 0);
      }

      container.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-number">${totalUsers}</div><div>Total Users</div></div>
          <div class="stat-card"><div class="stat-number">${activeUsers}</div><div>Active Users</div></div>
          <div class="stat-card"><div class="stat-number">${blockedUsers}</div><div>Blocked Users</div></div>
          <div class="stat-card"><div class="stat-number">${totalCourses}</div><div>Total Courses</div></div>
          <div class="stat-card"><div class="stat-number">${publishedCourses}</div><div>Published Courses</div></div>
          <div class="stat-card"><div class="stat-number">${totalEnrollments}</div><div>Enrollments</div></div>
          <div class="stat-card"><div class="stat-number">$${(totalRevenue / 100).toFixed(2)}</div><div>Revenue (USD)</div></div>
        </div>
        <div class="card"><h3>Quick Actions</h3><button id="goto-users" class="btn-sm btn-primary">Manage Users</button> <button id="goto-courses" class="btn-sm btn-primary">Manage Courses</button></div>
      `;
      document.getElementById('goto-users')?.addEventListener('click', () => switchTab('users'));
      document.getElementById('goto-courses')?.addEventListener('click', () => switchTab('courses'));
    } catch (err) {
      container.innerHTML = `<div class="card error-msg">Error loading stats: ${err.message}</div>`;
    }
  }

  // ==================== USER & REQUESTS ====================
  async function renderUsersTab(container) {
    // Fetch users from user_profiles (joined with auth.users via email)
    const { data: profiles, error: profErr } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (profErr) {
      container.innerHTML = `<div class="card error-msg">${profErr.message}</div>`;
      return;
    }
    // Fetch pending requests
    const { data: requests, error: reqErr } = await supabaseClient
      .from('requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (reqErr) console.error(reqErr);

    let html = `<div class="card"><h2>User Profiles</h2><div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Email</th><th>Status</th><th>Admin</th><th>Created At</th><th>Actions</th></tr></thead><tbody>`;
    for (const u of profiles) {
      html += `<tr>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge-${u.status || 'pending'}">${u.status || 'pending'}</span></td>
        <td>${u.is_admin ? 'Yes' : 'No'}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td class="table-actions">
          <button class="btn-icon toggle-status" data-id="${u.id}" data-status="${u.status || 'pending'}"><i class="fas fa-user-lock"></i></button>
          <button class="btn-icon toggle-admin" data-id="${u.id}" data-admin="${u.is_admin}"><i class="fas fa-user-cog"></i></button>
          <button class="btn-icon btn-danger delete-user" data-id="${u.id}"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
    }
    html += `</tbody></table></div></div>`;

    html += `<div class="card"><h2>Pending Requests</h2><div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Comment</th><th>Actions</th></tr></thead><tbody>`;
    for (const r of requests || []) {
      html += `<tr>
        <td>${escapeHtml(r.name)} ${escapeHtml(r.surname)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.phone)}</td>
        <td>${escapeHtml(r.comment?.substring(0, 80))}</td>
        <td class="table-actions">
          <button class="btn-sm btn-primary approve-request" data-id="${r.id}" data-email="${r.email}" data-name="${r.name}" data-surname="${r.surname}" data-comment="${escapeHtml(r.comment)}">Approve</button>
          <button class="btn-sm reject-request" data-id="${r.id}">Reject</button>
        </td>
      </tr>`;
    }
    html += `</tbody></table></div></div>`;
    container.innerHTML = html;

    // Attach event listeners
    document.querySelectorAll('.toggle-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.id;
        const current = btn.dataset.status;
        const newStatus = current === 'active' ? 'blocked' : 'active';
        await supabaseClient.from('user_profiles').update({ status: newStatus }).eq('id', userId);
        toast(`User status updated to ${newStatus}`);
        renderTab('users');
      });
    });
    document.querySelectorAll('.toggle-admin').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.id;
        const newAdmin = btn.dataset.admin !== 'true';
        await supabaseClient.from('user_profiles').update({ is_admin: newAdmin }).eq('id', userId);
        toast(`Admin privileges ${newAdmin ? 'granted' : 'revoked'}`);
        renderTab('users');
      });
    });
    document.querySelectorAll('.delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete user permanently? This will also delete enrollments.')) return;
        const userId = btn.dataset.id;
        await supabaseClient.from('user_profiles').delete().eq('id', userId);
        toast('User deleted');
        renderTab('users');
      });
    });
    document.querySelectorAll('.approve-request').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reqId = btn.dataset.id;
        const email = btn.dataset.email;
        const name = btn.dataset.name;
        const surname = btn.dataset.surname;
        const comment = btn.dataset.comment || '';
        try {
          // Create auth user via admin invite (requires edge function or manual creation)
          // Since we cannot call admin.createUser from client, we'll use an edge function.
          const { data, error } = await supabaseClient.functions.invoke('invite-user', {
            body: { email, name, surname }
          });
          if (error) throw error;
          // Update request status
          await supabaseClient.from('requests').update({ status: 'approved' }).eq('id', reqId);
          // Auto-enroll based on comment (simple: if comment contains course id or title)
          toast(`Invitation sent to ${email}. User can login after setting password.`);
          renderTab('users');
        } catch (err) {
          toast(`Approval failed: ${err.message}`, 'error');
        }
      });
    });
    document.querySelectorAll('.reject-request').forEach(btn => {
      btn.addEventListener('click', async () => {
        const reqId = btn.dataset.id;
        await supabaseClient.from('requests').update({ status: 'rejected' }).eq('id', reqId);
        toast('Request rejected');
        renderTab('users');
      });
    });

    // Real-time subscription for new pending requests
    if (pendingRequestsSubscription) pendingRequestsSubscription.unsubscribe();
    pendingRequestsSubscription = supabaseClient
      .channel('requests-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests', filter: 'status=eq.pending' }, () => {
        toast('New request received! Refresh user tab.', 'info');
      })
      .subscribe();
  }

  // ==================== COURSES ====================
  async function renderCoursesTab(container) {
    const { data: courses, error } = await supabaseClient.from('courses').select('*').order('created_at');
    if (error) {
      container.innerHTML = `<div class="card error-msg">${error.message}</div>`;
      return;
    }
    let html = `<div class="card"><h2>Courses <button id="add-course-btn" class="btn-sm btn-primary" style="float:right;">+ Add Course</button></h2>
      <div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Title</th><th>Preview</th><th>Published</th><th>Price</th><th>Actions</th></tr></thead><tbody>`;
    for (const c of courses) {
      html += `<tr>
        <td>${escapeHtml(c.title)}</td>
        <td><img src="${c.preview || ''}" style="width:40px; height:40px; object-fit:cover;"></td>
        <td>${c.is_published ? 'Yes' : 'No'}</td>
        <td>$${(c.price / 100).toFixed(2)}</td>
        <td class="table-actions">
          <button class="btn-icon edit-course" data-id="${c.id}"><i class="fas fa-edit"></i></button>
          <button class="btn-icon btn-danger delete-course" data-id="${c.id}"><i class="fas fa-trash"></i></button>
          <button class="btn-icon duplicate-course" data-id="${c.id}"><i class="fas fa-copy"></i></button>
        </td>
      </tr>`;
    }
    html += `</tbody></table></div></div>`;
    container.innerHTML = html;

    document.getElementById('add-course-btn')?.addEventListener('click', () => openCourseModal());
    document.querySelectorAll('.edit-course').forEach(btn => {
      btn.addEventListener('click', () => {
        const course = courses.find(c => c.id == btn.dataset.id);
        openCourseModal(course);
      });
    });
    document.querySelectorAll('.delete-course').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete course? All modules, videos, downloads will be lost.')) return;
        await supabaseClient.from('courses').delete().eq('id', btn.dataset.id);
        toast('Course deleted');
        renderTab('courses');
      });
    });
    document.querySelectorAll('.duplicate-course').forEach(btn => {
      btn.addEventListener('click', async () => {
        const original = courses.find(c => c.id == btn.dataset.id);
        const newCourse = { ...original, id: undefined, title: `${original.title} (Copy)`, created_at: new Date() };
        await supabaseClient.from('courses').insert([newCourse]);
        toast('Course duplicated');
        renderTab('courses');
      });
    });
  }

  async function openCourseModal(course = null) {
    const modal = createModal(course ? 'Edit Course' : 'Add Course', `
      <div class="form-group"><label>Title</label><input id="course-title" value="${course?.title || ''}"></div>
      <div class="form-group"><label>Description</label><textarea id="course-description">${course?.description || ''}</textarea></div>
      <div class="form-group"><label>Preview Image URL</label><input id="course-preview" value="${course?.preview || ''}"></div>
      <div class="form-group"><label>Price (in cents)</label><input id="course-price" type="number" value="${course?.price || 0}"></div>
      <div class="form-group"><label><input type="checkbox" id="course-published" ${course?.is_published ? 'checked' : ''}> Published</label></div>
    `);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    const saveBtn = modal.querySelector('#save-modal-btn');
    saveBtn.addEventListener('click', async () => {
      const data = {
        title: document.getElementById('course-title').value,
        description: document.getElementById('course-description').value,
        preview: document.getElementById('course-preview').value,
        price: parseInt(document.getElementById('course-price').value) || 0,
        is_published: document.getElementById('course-published').checked
      };
      if (course) {
        await supabaseClient.from('courses').update(data).eq('id', course.id);
        toast('Course updated');
      } else {
        await supabaseClient.from('courses').insert([data]);
        toast('Course added');
      }
      modal.remove();
      renderTab('courses');
    });
  }

  // ==================== MODULES & VIDEOS ====================
  async function renderModulesTab(container) {
    const { data: courses } = await supabaseClient.from('courses').select('id, title');
    if (!courses || courses.length === 0) {
      container.innerHTML = '<div class="card">No courses found. Create a course first.</div>';
      return;
    }
    let html = `<div class="card"><label>Select Course</label><select id="course-select-mv"><option value="">-- Choose --</option>`;
    for (const c of courses) html += `<option value="${c.id}">${escapeHtml(c.title)}</option>`;
    html += `</select><div id="mv-content"></div></div>`;
    container.innerHTML = html;
    const select = document.getElementById('course-select-mv');
    select.addEventListener('change', async () => {
      const courseId = select.value;
      if (!courseId) return;
      const mvDiv = document.getElementById('mv-content');
      mvDiv.innerHTML = '<div class="loading-spinner"></div>';
      const { data: modules } = await supabaseClient.from('modules').select('*').eq('course_id', courseId).order('sort_order');
      let modulesHtml = `<button id="add-module-btn" class="btn-sm btn-primary">+ Add Module</button>`;
      for (const mod of modules || []) {
        const { data: videos } = await supabaseClient.from('videos').select('*').eq('module_id', mod.id).order('sort_order');
        modulesHtml += `
          <div class="card" style="margin-top:1rem;">
            <div><strong>${escapeHtml(mod.title)}</strong> (order: ${mod.sort_order}) 
              <button class="btn-icon edit-module" data-module='${JSON.stringify(mod)}'><i class="fas fa-edit"></i></button>
              <button class="btn-icon btn-danger delete-module" data-id="${mod.id}"><i class="fas fa-trash"></i></button>
              <button class="btn-icon add-video" data-module-id="${mod.id}"><i class="fas fa-plus"></i> Video</button>
            </div>
            <div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Title</th><th>Bunny Video ID</th><th>Sort</th><th>Actions</th></tr></thead><tbody>`;
        for (const v of videos || []) {
          modulesHtml += `<tr>
            <td>${escapeHtml(v.title)}</td>
            <td>${escapeHtml(v.bunny_video_id)}</td>
            <td>${v.sort_order}</td>
            <td class="table-actions">
              <button class="btn-icon edit-video" data-video='${JSON.stringify(v)}'><i class="fas fa-edit"></i></button>
              <button class="btn-icon btn-danger delete-video" data-id="${v.id}"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`;
        }
        modulesHtml += `</tbody></table></div></div>`;
      }
      mvDiv.innerHTML = modulesHtml;
      attachModuleVideoHandlers(courseId);
    });
  }

  function attachModuleVideoHandlers(courseId) {
    document.getElementById('add-module-btn')?.addEventListener('click', () => openModuleModal(null, courseId));
    document.querySelectorAll('.edit-module').forEach(btn => {
      btn.addEventListener('click', () => {
        const mod = JSON.parse(btn.dataset.module);
        openModuleModal(mod, courseId);
      });
    });
    document.querySelectorAll('.delete-module').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete module? All videos inside will be deleted.')) return;
        await supabaseClient.from('modules').delete().eq('id', btn.dataset.id);
        toast('Module deleted');
        renderTab('modules');
      });
    });
    document.querySelectorAll('.add-video').forEach(btn => {
      btn.addEventListener('click', () => openVideoModal(null, btn.dataset.moduleId));
    });
    document.querySelectorAll('.edit-video').forEach(btn => {
      btn.addEventListener('click', () => {
        const video = JSON.parse(btn.dataset.video);
        openVideoModal(video);
      });
    });
    document.querySelectorAll('.delete-video').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete video?')) return;
        await supabaseClient.from('videos').delete().eq('id', btn.dataset.id);
        toast('Video deleted');
        renderTab('modules');
      });
    });
  }

  async function openModuleModal(module = null, courseId) {
    const modal = createModal(module ? 'Edit Module' : 'Add Module', `
      <div class="form-group"><label>Title</label><input id="mod-title" value="${module?.title || ''}"></div>
      <div class="form-group"><label>Sort Order</label><input id="mod-sort" type="number" value="${module?.sort_order || 0}"></div>
      <div class="form-group"><label>Preview Image URL</label><input id="mod-preview" value="${module?.preview || ''}"></div>
    `);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    const saveBtn = modal.querySelector('#save-modal-btn');
    saveBtn.addEventListener('click', async () => {
      const data = {
        title: document.getElementById('mod-title').value,
        sort_order: parseInt(document.getElementById('mod-sort').value) || 0,
        preview: document.getElementById('mod-preview').value,
        course_id: courseId
      };
      if (module) {
        await supabaseClient.from('modules').update(data).eq('id', module.id);
      } else {
        await supabaseClient.from('modules').insert([data]);
      }
      modal.remove();
      renderTab('modules');
    });
  }

  async function openVideoModal(video = null, moduleId = null) {
    const modal = createModal(video ? 'Edit Video' : 'Add Video', `
      <div class="form-group"><label>Title</label><input id="video-title" value="${video?.title || ''}"></div>
      <div class="form-group"><label>Bunny Video ID</label><input id="video-bunny-id" value="${video?.bunny_video_id || ''}"></div>
      <div class="form-group"><label>Sort Order</label><input id="video-sort" type="number" value="${video?.sort_order || 0}"></div>
      <div class="form-group"><label>Duration (seconds)</label><input id="video-duration" type="number" value="${video?.duration || 0}"></div>
      <div class="form-group"><label>Preview Image URL</label><input id="video-preview" value="${video?.preview || ''}"></div>
    `);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    const saveBtn = modal.querySelector('#save-modal-btn');
    saveBtn.addEventListener('click', async () => {
      const data = {
        title: document.getElementById('video-title').value,
        bunny_video_id: document.getElementById('video-bunny-id').value,
        sort_order: parseInt(document.getElementById('video-sort').value) || 0,
        duration: parseInt(document.getElementById('video-duration').value) || null,
        preview: document.getElementById('video-preview').value,
        module_id: video ? video.module_id : moduleId
      };
      if (video) {
        await supabaseClient.from('videos').update(data).eq('id', video.id);
      } else {
        await supabaseClient.from('videos').insert([data]);
      }
      modal.remove();
      renderTab('modules');
    });
  }

  // ==================== DOWNLOADS ====================
  async function renderDownloadsTab(container) {
    const { data: courses } = await supabaseClient.from('courses').select('id, title');
    if (!courses || courses.length === 0) {
      container.innerHTML = '<div class="card">No courses found.</div>';
      return;
    }
    let html = `<div class="card"><label>Select Course</label><select id="course-select-dl"><option value="">-- Choose --</option>`;
    for (const c of courses) html += `<option value="${c.id}">${escapeHtml(c.title)}</option>`;
    html += `</select><div id="dl-content"></div></div>`;
    container.innerHTML = html;
    const select = document.getElementById('course-select-dl');
    select.addEventListener('change', async () => {
      const courseId = select.value;
      if (!courseId) return;
      const dlDiv = document.getElementById('dl-content');
      dlDiv.innerHTML = '<div class="loading-spinner"></div>';
      const { data: downloads } = await supabaseClient.from('downloads').select('*').eq('course_id', courseId);
      let downloadsHtml = `<button id="add-download-btn" class="btn-sm btn-primary">+ Add Download</button><div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Title</th><th>Bunny File Path</th><th>Actions</th></tr></thead><tbody>`;
      for (const d of downloads || []) {
        downloadsHtml += `<tr>
          <td>${escapeHtml(d.title)}</td>
          <td>${escapeHtml(d.bunny_file_path)}</td>
          <td class="table-actions">
            <button class="btn-icon edit-download" data-download='${JSON.stringify(d)}'><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-danger delete-download" data-id="${d.id}"><i class="fas fa-trash"></i></button>
          </td>
        </tr>`;
      }
      downloadsHtml += `</tbody></table></div>`;
      dlDiv.innerHTML = downloadsHtml;
      document.getElementById('add-download-btn')?.addEventListener('click', () => openDownloadModal(null, courseId));
      document.querySelectorAll('.edit-download').forEach(btn => {
        btn.addEventListener('click', () => {
          const download = JSON.parse(btn.dataset.download);
          openDownloadModal(download, courseId);
        });
      });
      document.querySelectorAll('.delete-download').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete download?')) return;
          await supabaseClient.from('downloads').delete().eq('id', btn.dataset.id);
          toast('Download deleted');
          renderTab('downloads');
        });
      });
    });
  }

  async function openDownloadModal(download = null, courseId) {
    const modal = createModal(download ? 'Edit Download' : 'Add Download', `
      <div class="form-group"><label>Title</label><input id="dl-title" value="${download?.title || ''}"></div>
      <div class="form-group"><label>Bunny File Path</label><input id="dl-path" value="${download?.bunny_file_path || ''}" placeholder="/downloads/file.pdf"></div>
    `);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    const saveBtn = modal.querySelector('#save-modal-btn');
    saveBtn.addEventListener('click', async () => {
      const data = {
        title: document.getElementById('dl-title').value,
        bunny_file_path: document.getElementById('dl-path').value,
        course_id: courseId
      };
      if (download) {
        await supabaseClient.from('downloads').update(data).eq('id', download.id);
      } else {
        await supabaseClient.from('downloads').insert([data]);
      }
      modal.remove();
      renderTab('downloads');
    });
  }

  // ==================== ENROLLMENTS ====================
  async function renderEnrollmentsTab(container) {
    const { data: courses } = await supabaseClient.from('courses').select('id, title');
    if (!courses || courses.length === 0) {
      container.innerHTML = '<div class="card">No courses found.</div>';
      return;
    }
    let html = `<div class="card"><label>Select Course</label><select id="course-select-enroll"><option value="">-- Choose --</option>`;
    for (const c of courses) html += `<option value="${c.id}">${escapeHtml(c.title)}</option>`;
    html += `</select><div id="enroll-content"></div></div>`;
    container.innerHTML = html;
    const select = document.getElementById('course-select-enroll');
    select.addEventListener('change', async () => {
      const courseId = select.value;
      if (!courseId) return;
      const enrollDiv = document.getElementById('enroll-content');
      enrollDiv.innerHTML = '<div class="loading-spinner"></div>';
      const { data: enrollments, error } = await supabaseClient
        .from('enrollments')
        .select('*, user_profiles!inner(email, name, surname)')
        .eq('course_id', courseId);
      if (error) {
        enrollDiv.innerHTML = `<div class="error-msg">${error.message}</div>`;
        return;
      }
      let enrollHtml = `<h3>Enrolled Users</h3><div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Email</th><th>Name</th><th>Purchased At</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;
      for (const e of enrollments || []) {
        enrollHtml += `<tr>
          <td>${escapeHtml(e.user_profiles?.email)}</td>
          <td>${escapeHtml(e.user_profiles?.name || '')} ${escapeHtml(e.user_profiles?.surname || '')}</td>
          <td>${new Date(e.purchased_at).toLocaleDateString()}</td>
          <td><span class="badge-${e.status || 'active'}">${e.status || 'active'}</span></td>
          <td class="table-actions">
            <button class="btn-icon btn-danger remove-enroll" data-id="${e.id}"><i class="fas fa-trash"></i></button>
            <button class="btn-icon toggle-enroll-status" data-id="${e.id}" data-status="${e.status || 'active'}"><i class="fas fa-user-lock"></i></button>
          </td>
        </tr>`;
      }
      enrollHtml += `</tbody></table></div><hr><h3>Manual Enrollment</h3><input type="email" id="manual-email" placeholder="User Email"><button id="manual-enroll-btn" class="btn-sm btn-primary">Enroll</button>`;
      enrollDiv.innerHTML = enrollHtml;

      document.querySelectorAll('.remove-enroll').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Remove enrollment?')) return;
          await supabaseClient.from('enrollments').delete().eq('id', btn.dataset.id);
          toast('Enrollment removed');
          renderTab('enrollments');
        });
      });
      document.querySelectorAll('.toggle-enroll-status').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const current = btn.dataset.status;
          const newStatus = current === 'active' ? 'blocked' : 'active';
          await supabaseClient.from('enrollments').update({ status: newStatus }).eq('id', id);
          toast(`Enrollment ${newStatus}`);
          renderTab('enrollments');
        });
      });
      document.getElementById('manual-enroll-btn')?.addEventListener('click', async () => {
        const email = document.getElementById('manual-email').value;
        if (!email) return;
        const { data: profile } = await supabaseClient.from('user_profiles').select('id').eq('email', email).single();
        if (!profile) {
          toast('User not found', 'error');
          return;
        }
        const { error } = await supabaseClient.from('enrollments').insert([{
          user_id: profile.id,
          course_id: courseId,
          purchased_at: new Date(),
          status: 'active'
        }]);
        if (error) toast(error.message, 'error');
        else toast('Enrollment added');
        renderTab('enrollments');
      });
    });
  }

  // ==================== UTILITIES ====================
  function createModal(title, formHtml) {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal';
    modalDiv.innerHTML = `
      <div class="modal-content">
        <div class="modal-header"><h3>${title}</h3><button class="close-modal">&times;</button></div>
        ${formHtml}
        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;">
          <button class="btn-sm btn-outline close-modal-btn">Cancel</button>
          <button id="save-modal-btn" class="btn-sm btn-primary">Save</button>
        </div>
      </div>
    `;
    const closeModal = () => modalDiv.remove();
    modalDiv.querySelector('.close-modal')?.addEventListener('click', closeModal);
    modalDiv.querySelector('.close-modal-btn')?.addEventListener('click', closeModal);
    return modalDiv;
  }

  function switchTab(tabId) {
    activeTab = tabId;
    renderTab(tabId);
    document.querySelectorAll('.admin-tab').forEach(btn => {
      if (btn.dataset.tab === tabId) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  // ==================== INIT ====================
  async function initAdmin() {
    const authorized = await requireAdmin();
    if (!authorized) return;

    // Setup tab listeners
    document.querySelectorAll('.admin-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });
    // Set active tab from URL hash or default
    const hash = window.location.hash.slice(1);
    if (hash && ['stats','users','courses','modules','downloads','enrollments'].includes(hash)) {
      switchTab(hash);
    } else {
      switchTab('stats');
    }

    document.getElementById('view-site-btn')?.addEventListener('click', () => {
      window.location.href = '../index.html';
    });
    document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.href = '../pages/login.html';
    });
  }

  initAdmin();
})();