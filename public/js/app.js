document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const saved = localStorage.getItem('lumi-theme') || 'light';
  root.dataset.theme = saved;

  const refreshIcons = () => window.lucide && window.lucide.createIcons();
  const isAuthenticated = document.body?.dataset.authenticated === '1';
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  const applyThemeIcon = () => {
    const btn = document.querySelector('[data-theme-toggle]');
    if (btn) btn.innerHTML = `<i data-lucide="${root.dataset.theme === 'dark' ? 'sun' : 'moon'}"></i>`;
    refreshIcons();
  };

  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('lumi-theme', root.dataset.theme);
    applyThemeIcon();
  });


  // Friendly Uzbekistan phone formatting; email text is left untouched for legacy accounts.
  document.querySelectorAll('[data-phone-input]').forEach(el => el.addEventListener('input', () => {
    if (el.value.includes('@')) return;
    let d = el.value.replace(/\D/g, '');
    if (!d) return;
    if (d.length <= 9 && !d.startsWith('998')) d = '998' + d;
    if (d.startsWith('998')) d = d.slice(0, 12);
    const c = d.startsWith('998') ? d.slice(3) : d;
    if (d.startsWith('998')) {
      const parts = ['+998', c.slice(0,2), c.slice(2,5), c.slice(5,7), c.slice(7,9)].filter(Boolean);
      el.value = parts.join(' ');
    }
  }));

  // Image previews for post/story creation.
  const input = document.querySelector('[data-image-input]');
  const preview = document.querySelector('[data-preview]');
  input?.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file || !preview) return;
    const url = URL.createObjectURL(file);
    const previewImage = preview.querySelector('[data-preview-image]');
    if (previewImage) {
      previewImage.src = url;
      previewImage.hidden = false;
      preview.querySelector('[data-preview-placeholder]')?.setAttribute('hidden', '');
    } else {
      preview.innerHTML = `<img src="${url}" alt="Preview">`;
    }
  });

  const storyCaptionInput = document.querySelector('[data-story-caption-input]');
  const storyCaptionPreview = document.querySelector('[data-story-caption-preview]');
  storyCaptionInput?.addEventListener('input', () => {
    if (!storyCaptionPreview) return;
    storyCaptionPreview.textContent = storyCaptionInput.value;
    storyCaptionPreview.hidden = !storyCaptionInput.value.trim();
  });

  function openSheet(sheet) {
    if (!sheet) return;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => sheet.classList.add('open'));
    refreshIcons();
  }

  function closeSheet(sheet) {
    if (!sheet) return;
    sheet.classList.remove('open');
    setTimeout(() => { sheet.hidden = true; }, 180);
    if (![...document.querySelectorAll('.sheet-backdrop.open')].some(x => x !== sheet)) document.body.classList.remove('sheet-open');
  }

  const authSheet = document.querySelector('[data-auth-sheet]');
  const openAuthSheet = () => openSheet(authSheet);
  document.addEventListener('click', e => {
    const gated = e.target.closest('[data-auth-required]');
    if (!gated || isAuthenticated) return;
    e.preventDefault();
    e.stopPropagation();
    openAuthSheet();
  }, true);

  document.addEventListener('click', e => {
    const close = e.target.closest('[data-sheet-close]');
    if (close) closeSheet(close.closest('.sheet-backdrop'));
    if (e.target.classList.contains('sheet-backdrop')) closeSheet(e.target);
  });

  const noteSheet = document.querySelector('[data-note-sheet]');
  document.querySelectorAll('[data-note-open]').forEach(btn => btn.addEventListener('click', () => openSheet(noteSheet)));

  // Live note preview + character counter.
  const noteInput = document.querySelector('[data-note-input]');
  const notePreview = document.querySelector('[data-note-preview]');
  const noteCount = document.querySelector('[data-note-count]');
  const syncNotePreview = () => {
    if (!noteInput) return;
    const value = noteInput.value.slice(0, 60);
    if (noteCount) noteCount.textContent = value.length;
    if (notePreview) notePreview.textContent = value.trim() || 'Bugun nimani o‘ylayapsiz? ✨';
  };
  noteInput?.addEventListener('input', syncNotePreview);
  syncNotePreview();

  // Single center + button opens a compact creation dock above the navbar.
  const createMenu = document.querySelector('[data-create-menu]');
  const createToggle = document.querySelector('[data-create-menu-toggle]');
  const createClose = document.querySelector('[data-create-menu-close]');

  const openCreateMenu = () => {
    if (!createMenu || !createToggle) return;
    createMenu.hidden = false;
    createToggle.classList.add('menu-open');
    createToggle.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => createMenu.classList.add('open'));
    refreshIcons();
  };
  const closeCreateMenu = () => {
    if (!createMenu || !createToggle) return;
    createMenu.classList.remove('open');
    createToggle.classList.remove('menu-open');
    createToggle.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!createMenu.classList.contains('open')) createMenu.hidden = true; }, 170);
  };

  createToggle?.addEventListener('click', e => {
    e.stopPropagation();
    createMenu?.classList.contains('open') ? closeCreateMenu() : openCreateMenu();
  });
  createClose?.addEventListener('click', closeCreateMenu);
  createMenu?.addEventListener('click', e => {
    if (e.target === createMenu) closeCreateMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && createMenu?.classList.contains('open')) closeCreateMenu();
  });

  // Persistent post like without a page refresh.
  document.querySelectorAll('.ajax-like-form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        const r = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' } });
        const data = await r.json();
        if (data.ok) {
          btn.classList.toggle('liked', data.liked);
          const card = form.closest('[data-post-id]');
          const count = card?.querySelector('[data-like-count]');
          if (count) count.textContent = data.count;
        }
      } finally { btn.disabled = false; }
    });
  });

  // Comments bottom sheet: lazy-load so long discussions never stretch the post card.
  const commentsSheet = document.querySelector('[data-comments-sheet]');
  const commentsList = commentsSheet?.querySelector('[data-comments-list]');
  const commentForm = commentsSheet?.querySelector('[data-comment-form]');
  const replyBanner = commentsSheet?.querySelector('[data-reply-banner]');
  const replyLabel = commentsSheet?.querySelector('[data-reply-label]');
  const replyId = commentsSheet?.querySelector('[data-reply-id]');
  let commentPostId = null;

  function commentHtml(c) {
    const avatar = c.user.avatarUrl
      ? `<img src="${esc(c.user.avatarUrl)}" alt="">`
      : `<b>${esc((c.user.name || c.user.username || 'U')[0].toUpperCase())}</b>`;
    const replyTo = c.replyToUser ? `<a href="/u/${encodeURIComponent(c.replyToUser.username)}" class="reply-mention">@${esc(c.replyToUser.username)}</a> ` : '';
    return `<article class="sheet-comment" data-comment-id="${esc(c.id)}">
      <a class="avatar comment-avatar" href="/u/${encodeURIComponent(c.user.username)}">${avatar}</a>
      <div class="comment-main"><p><a class="comment-user" href="/u/${encodeURIComponent(c.user.username)}">${esc(c.user.username)}</a> ${replyTo}${esc(c.text)}</p>
        <div class="comment-meta"><span>${new Date(c.createdAt).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span><button type="button" data-reply-to="${esc(c.id)}" data-reply-user="${esc(c.user.username)}">Reply</button><span>${c.likeCount ? c.likeCount + ' like' : ''}</span>${c.isHidden?'<span class="comment-hidden-badge">Yashirin</span>':''}${c.canModerate?`<button type="button" data-comment-pin="${esc(c.id)}">${c.isPinned?'Unpin':'Pin'}</button>${c.isHidden?`<button type="button" data-comment-show="${esc(c.id)}">Show</button>`:''}`:''}${c.canDelete?`<button type="button" data-comment-delete="${esc(c.id)}">Delete</button>`:''}${isAuthenticated?`<button type="button" data-comment-report="${esc(c.id)}">Report</button>`:''}</div>
      </div>
      <button type="button" class="comment-like ${c.liked ? 'liked':''}" data-comment-like="${esc(c.id)}"><i data-lucide="heart"></i><small>${c.likeCount || ''}</small></button>
    </article>`;
  }

  async function loadComments() {
    if (!commentsList || !commentPostId) return;
    commentsList.innerHTML = '<div class="sheet-loading">Yuklanmoqda…</div>';
    try {
      const r = await fetch(`/posts/${commentPostId}/comments`, { headers: { Accept: 'application/json' } });
      const data = await r.json();
      commentsList.innerHTML = data.comments.length ? data.comments.map(commentHtml).join('') : '<div class="empty-mini comments-empty">Hali comment yo‘q. Birinchi bo‘lib yozing ✨</div>';
      refreshIcons();
      commentsList.scrollTop = commentsList.scrollHeight;
    } catch (_) {
      commentsList.innerHTML = '<div class="empty-mini">Comments yuklanmadi.</div>';
    }
  }

  function clearReply() {
    if (replyId) replyId.value = '';
    if (replyBanner) replyBanner.hidden = true;
    if (replyLabel) replyLabel.textContent = '';
  }

  document.querySelectorAll('[data-comments-open]').forEach(btn => btn.addEventListener('click', async () => {
    commentPostId = btn.dataset.commentsOpen;
    clearReply();
    openSheet(commentsSheet);
    await loadComments();
    setTimeout(() => commentForm?.querySelector('input[name="text"]')?.focus(), 100);
  }));

  commentsList?.addEventListener('click', async e => {
    const replyBtn = e.target.closest('[data-reply-to]');
    if (replyBtn) {
      if (!isAuthenticated) { openAuthSheet(); return; }
      if (replyId) replyId.value = replyBtn.dataset.replyTo;
      if (replyLabel) replyLabel.textContent = `@${replyBtn.dataset.replyUser} ga javob`;
      if (replyBanner) replyBanner.hidden = false;
      commentForm?.querySelector('input[name="text"]')?.focus();
      return;
    }
    const delBtn=e.target.closest('[data-comment-delete]');
    if(delBtn&&commentPostId){if(!confirm('Comment o‘chirilsinmi?'))return;const d=await fetch(`/posts/${commentPostId}/comments/${delBtn.dataset.commentDelete}/delete`,{method:'POST',headers:{Accept:'application/json'}}).then(r=>r.json()).catch(()=>null);if(d?.ok)await loadComments();return;}
    const pinBtn=e.target.closest('[data-comment-pin]');
    if(pinBtn&&commentPostId){const d=await fetch(`/posts/${commentPostId}/comments/${pinBtn.dataset.commentPin}/pin`,{method:'POST',headers:{Accept:'application/json'}}).then(r=>r.json()).catch(()=>null);if(d?.ok)await loadComments();return;}
    const showBtn=e.target.closest('[data-comment-show]');
    if(showBtn&&commentPostId){const d=await fetch(`/posts/${commentPostId}/comments/${showBtn.dataset.commentShow}/moderate`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'show'})}).then(r=>r.json()).catch(()=>null);if(d?.ok)await loadComments();return;}
    const reportBtn=e.target.closest('[data-comment-report]');
    if(reportBtn&&commentPostId){await fetch(`/posts/${commentPostId}/comments/${reportBtn.dataset.commentReport}/report`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({reason:'other'})});reportBtn.textContent='Reported';reportBtn.disabled=true;return;}
    const likeBtn = e.target.closest('[data-comment-like]');
    if (likeBtn && commentPostId) {
      if (!isAuthenticated) { openAuthSheet(); return; }
      likeBtn.disabled = true;
      try {
        const r = await fetch(`/posts/${commentPostId}/comments/${likeBtn.dataset.commentLike}/like`, { method:'POST', headers:{ Accept:'application/json' } });
        const data = await r.json();
        if (data.ok) {
          likeBtn.classList.toggle('liked', data.liked);
          likeBtn.querySelector('small').textContent = data.count || '';
        }
      } finally { likeBtn.disabled = false; }
    }
  });

  commentsSheet?.querySelector('[data-reply-cancel]')?.addEventListener('click', clearReply);

  commentForm?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!commentPostId) return;
    const textInput = commentForm.querySelector('input[name="text"]');
    const text = textInput.value.trim();
    if (!text) return;
    const body = new URLSearchParams({ text, replyToComment: replyId?.value || '' });
    const submit = commentForm.querySelector('button');
    submit.disabled = true;
    try {
      const r = await fetch(`/posts/${commentPostId}/comment`, { method:'POST', headers:{ Accept:'application/json','Content-Type':'application/x-www-form-urlencoded' }, body });
      const data = await r.json();
      if (data.ok) {
        textInput.value = '';
        clearReply();
        await loadComments();
        document.querySelectorAll(`[data-comments-open="${commentPostId}"]`).forEach(b => {
          if (b.classList.contains('comments-summary')) b.textContent = `${data.count} ta commentni ko‘rish`;
        });
      }
    } finally { submit.disabled = false; }
  });

  // Share a post directly into an existing conversation.
  const shareSheet = document.querySelector('[data-share-sheet]');
  const shareSuccess = shareSheet?.querySelector('[data-share-success]');
  let sharePostId = null;
  document.querySelectorAll('[data-share-open]').forEach(btn => btn.addEventListener('click', () => {
    sharePostId = btn.dataset.shareOpen;
    if (shareSuccess) shareSuccess.hidden = true;
    openSheet(shareSheet);
  }));

  const postShareUrl = () => sharePostId ? `${location.origin}/p/${sharePostId}` : location.href;
  const sharedCounted=new Set(); const countShare=()=>{if(!sharePostId||sharedCounted.has(sharePostId))return;sharedCounted.add(sharePostId);fetch(`/posts/${sharePostId}/share-event`,{method:'POST',headers:{Accept:'application/json'},keepalive:true}).catch(()=>{})};
  shareSheet?.querySelector('[data-native-share]')?.addEventListener('click', async () => {
    const url = postShareUrl();
    try {
      if (navigator.share) await navigator.share({ title: 'Lumi post', text: 'Lumi’da ushbu postni ko‘ring ✨', url });
      else await navigator.clipboard.writeText(url);
      countShare();
    } catch (_) {}
  });
  shareSheet?.querySelector('[data-copy-post-link]')?.addEventListener('click', async () => {
    const url = postShareUrl();
    try { await navigator.clipboard.writeText(url); } catch (_) {
      const ta=document.createElement('textarea'); ta.value=url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    countShare();
    if (shareSuccess) { shareSuccess.hidden=false; shareSuccess.textContent='Link nusxalandi ✓'; }
  });
  shareSheet?.querySelectorAll('[data-external-share]').forEach(btn => btn.addEventListener('click', () => {
    const url = encodeURIComponent(postShareUrl());
    const text = encodeURIComponent('Lumi’da ushbu postni ko‘ring ✨');
    const kind = btn.dataset.externalShare;
    const target = kind === 'telegram' ? `https://t.me/share/url?url=${url}&text=${text}`
      : kind === 'whatsapp' ? `https://wa.me/?text=${text}%20${url}`
      : `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    window.open(target, '_blank', 'noopener,noreferrer'); countShare();
  }));

  shareSheet?.querySelectorAll('[data-share-conversation]').forEach(btn => btn.addEventListener('click', async () => {
    if (!sharePostId) return;
    btn.disabled = true;
    try {
      const body = new URLSearchParams({ conversationId: btn.dataset.shareConversation, postId: sharePostId });
      const r = await fetch('/chats/share', { method:'POST', headers:{ Accept:'application/json','Content-Type':'application/x-www-form-urlencoded' }, body });
      const data = await r.json();
      if (data.ok) {
        if (shareSuccess) { shareSuccess.hidden = false; shareSuccess.textContent = 'Yuborildi ✓'; }
        setTimeout(() => closeSheet(shareSheet), 650);
      }
    } finally { btn.disabled = false; }
  }));

  // Chat reaction chips.
  document.querySelectorAll('[data-message-react]').forEach(btn => btn.addEventListener('click', async () => {
    const body = new URLSearchParams({ emoji: btn.dataset.messageReact });
    const r = await fetch(`/chats/${btn.dataset.conversation}/messages/${btn.dataset.message}/react`, { method:'POST', headers:{ Accept:'application/json','Content-Type':'application/x-www-form-urlencoded' }, body });
    const data = await r.json();
    if (!data.ok) return;
    const wrap = btn.closest('.message-bubble');
    const target = wrap?.querySelector('.message-reactions');
    if (target) target.innerHTML = Object.entries(data.counts).map(([emoji,count]) => `<span>${esc(emoji)} ${count}</span>`).join('');
  }));

  // One-time camera photo composer.
  const cameraOverlay = document.querySelector('[data-camera-overlay]');
  const cameraVideo = cameraOverlay?.querySelector('[data-camera-video]');
  const cameraCanvas = cameraOverlay?.querySelector('[data-camera-canvas]');
  const cameraPreview = cameraOverlay?.querySelector('[data-camera-preview]');
  const cameraPermission = cameraOverlay?.querySelector('[data-camera-permission]');
  const captureBtn = cameraOverlay?.querySelector('[data-camera-capture]');
  const sendCameraBtn = cameraOverlay?.querySelector('[data-camera-send]');
  const retakeBtn = cameraOverlay?.querySelector('[data-camera-retake]');
  const cameraFile = cameraOverlay?.querySelector('[data-camera-file]');
  let cameraStream = null;
  let cameraFacing = 'user';
  let cameraBlob = null;
  let cameraPreviewUrl = null;

  function stopCamera() {
    cameraStream?.getTracks?.().forEach(track => track.stop());
    cameraStream = null;
  }

  function resetCameraCapture() {
    cameraBlob = null;
    if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
    cameraPreviewUrl = null;
    if (cameraPreview) { cameraPreview.hidden = true; cameraPreview.removeAttribute('src'); }
    if (cameraVideo) cameraVideo.hidden = false;
    if (captureBtn) captureBtn.hidden = false;
    if (sendCameraBtn) sendCameraBtn.hidden = true;
    if (retakeBtn) retakeBtn.hidden = true;
  }

  async function startCamera() {
    if (!cameraOverlay || !cameraVideo) return;
    stopCamera();
    resetCameraCapture();
    if (cameraPermission) cameraPermission.hidden = false;
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: cameraFacing }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false
      });
      cameraVideo.srcObject = cameraStream;
      await cameraVideo.play().catch(() => {});
      if (cameraPermission) cameraPermission.hidden = true;
    } catch (_) {
      if (cameraPermission) cameraPermission.hidden = false;
    }
  }

  function closeCamera() {
    stopCamera();
    if (cameraOverlay) cameraOverlay.hidden = true;
    document.body.classList.remove('camera-open');
    resetCameraCapture();
  }

  document.querySelector('[data-camera-open]')?.addEventListener('click', async () => {
    if (!cameraOverlay) return;
    cameraOverlay.hidden = false;
    document.body.classList.add('camera-open');
    refreshIcons();
    await startCamera();
  });
  cameraOverlay?.querySelector('[data-camera-close]')?.addEventListener('click', closeCamera);
  cameraOverlay?.querySelector('[data-camera-switch]')?.addEventListener('click', async () => {
    cameraFacing = cameraFacing === 'user' ? 'environment' : 'user';
    await startCamera();
  });

  captureBtn?.addEventListener('click', () => {
    if (!cameraVideo?.videoWidth || !cameraCanvas) return;
    const maxEdge = 1280;
    const ratio = Math.min(1, maxEdge / Math.max(cameraVideo.videoWidth, cameraVideo.videoHeight));
    cameraCanvas.width = Math.round(cameraVideo.videoWidth * ratio);
    cameraCanvas.height = Math.round(cameraVideo.videoHeight * ratio);
    const ctx = cameraCanvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
    cameraCanvas.toBlob(blob => {
      if (!blob) return;
      cameraBlob = blob;
      cameraPreviewUrl = URL.createObjectURL(blob);
      cameraPreview.src = cameraPreviewUrl;
      cameraPreview.hidden = false;
      cameraVideo.hidden = true;
      captureBtn.hidden = true;
      sendCameraBtn.hidden = false;
      retakeBtn.hidden = false;
    }, 'image/jpeg', .88);
  });

  cameraFile?.addEventListener('change', () => {
    const file = cameraFile.files?.[0];
    if (!file) return;
    cameraBlob = file;
    if (cameraPreviewUrl) URL.revokeObjectURL(cameraPreviewUrl);
    cameraPreviewUrl = URL.createObjectURL(file);
    cameraPreview.src = cameraPreviewUrl;
    cameraPreview.hidden = false;
    cameraVideo.hidden = true;
    if (cameraPermission) cameraPermission.hidden = true;
    captureBtn.hidden = true;
    sendCameraBtn.hidden = false;
    retakeBtn.hidden = false;
  });

  retakeBtn?.addEventListener('click', async () => {
    resetCameraCapture();
    if (!cameraStream) await startCamera();
  });

  sendCameraBtn?.addEventListener('click', async () => {
    if (!cameraBlob || !cameraOverlay?.dataset.conversation) return;
    sendCameraBtn.disabled = true;
    const old = sendCameraBtn.innerHTML;
    sendCameraBtn.innerHTML = '<span>Yuborilmoqda…</span>';
    try {
      const fd = new FormData();
      fd.append('photo', cameraBlob, 'lumi-once.jpg');
      const r = await fetch(`/chats/${cameraOverlay.dataset.conversation}/camera`, { method: 'POST', headers: { Accept: 'application/json' }, body: fd });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || 'Yuborilmadi');
      window.dispatchEvent(new CustomEvent('lumi:message-created', { detail: { messageId: data.messageId } }));
      closeCamera();
    } catch (err) {
      alert(err.message || 'Surat yuborilmadi.');
      sendCameraBtn.innerHTML = old;
      sendCameraBtn.disabled = false;
      refreshIcons();
    }
  });

  // Open a one-time photo. The same 10-second window cannot be restarted.
  const ephemeralViewer = document.querySelector('[data-ephemeral-viewer]');
  const ephemeralImage = ephemeralViewer?.querySelector('[data-ephemeral-image]');
  const ephemeralCount = ephemeralViewer?.querySelector('[data-ephemeral-count]');
  const ephemeralProgress = ephemeralViewer?.querySelector('[data-ephemeral-progress]');
  let ephemeralTick = null;

  document.querySelectorAll('[data-ephemeral-open]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const r = await fetch(`/chats/${btn.dataset.conversation}/messages/${btn.dataset.message}/ephemeral/open`, { method: 'POST', headers: { Accept: 'application/json' } });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        btn.closest('.once-photo')?.classList.add('is-expired');
        btn.innerHTML = '<span class="once-photo-icon">✓</span><div><strong>Surat ko‘rildi</strong><small>Bir martalik media o‘chirildi</small></div>';
        return;
      }
      if (!ephemeralViewer || !ephemeralImage) return;
      const remaining = Math.max(250, Math.min(10_000, Number(data.remainingMs) || 10_000));
      ephemeralViewer.hidden = false;
      document.body.classList.add('ephemeral-open');
      ephemeralImage.src = data.url;
      const started = performance.now();
      clearInterval(ephemeralTick);
      ephemeralTick = setInterval(() => {
        const left = Math.max(0, remaining - (performance.now() - started));
        if (ephemeralCount) ephemeralCount.textContent = Math.max(0, Math.ceil(left / 1000));
        if (ephemeralProgress) ephemeralProgress.style.transform = `scaleX(${left / remaining})`;
        if (left <= 0) {
          clearInterval(ephemeralTick);
          fetch(`/chats/${btn.dataset.conversation}/messages/${btn.dataset.message}/ephemeral/consume`, { method: 'POST', headers: { Accept: 'application/json' } }).catch(() => {});
          ephemeralViewer.hidden = true;
          document.body.classList.remove('ephemeral-open');
          ephemeralImage.removeAttribute('src');
          const wrap = btn.closest('[data-message-wrap]');
          if (wrap) { const small = wrap.querySelector('.once-photo-expired small'); if (small) small.textContent = 'Bir martalik media o‘chirildi'; }
        }
      }, 100);
    } finally {
      btn.disabled = false;
    }
  }));

  const messageScroll = document.querySelector('[data-message-scroll]');
  if (messageScroll) messageScroll.scrollTop = messageScroll.scrollHeight;

  // Public profile sharing.
  document.querySelectorAll('[data-share-profile]').forEach(btn => btn.addEventListener('click', async () => {
    const url = new URL(btn.dataset.profileUrl || location.pathname, location.origin).href;
    const title = btn.dataset.profileTitle || 'Lumi profil';
    try {
      if (navigator.share) await navigator.share({ title, text: `${title} — Lumi`, url });
      else { await navigator.clipboard.writeText(url); alert('Profil linki nusxalandi ✓'); }
    } catch (_) {}
  }));

  // Count a unique view when at least half of a post has actually entered the viewport.
  const viewedThisPage = new Set();
  const viewTargets = [...document.querySelectorAll('[data-view-track][data-post-id]')];
  if (viewTargets.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(async entry => {
      if (!entry.isIntersecting || entry.intersectionRatio < .45) return;
      const el = entry.target; const id = el.dataset.postId;
      if (!id || viewedThisPage.has(id)) return;
      viewedThisPage.add(id); observer.unobserve(el);
      try {
        const r = await fetch(`/api/posts/${encodeURIComponent(id)}/view`, { method:'POST', headers:{Accept:'application/json'}, keepalive:true });
        const data = await r.json();
        if (data.ok) document.querySelectorAll(`[data-post-id="${CSS.escape(String(id))}"] [data-view-count]`).forEach(x => x.textContent = data.viewCount);
      } catch (_) {}
    }), { threshold:[.45] });
    viewTargets.forEach(el => observer.observe(el));
  } else {
    viewTargets.slice(0,1).forEach(el => fetch(`/api/posts/${encodeURIComponent(el.dataset.postId)}/view`, { method:'POST', headers:{Accept:'application/json'} }).catch(()=>{}));
  }

  // Re-tapping the active Feed icon forces a fresh recommendation mix.
  document.querySelector('[data-feed-refresh]')?.addEventListener('click', e => {
    if (location.pathname !== '/feed') return;
    e.preventDefault();
    const now = new URL(location.href);
    const target = new URL('/feed', location.origin);
    const tab = now.searchParams.get('tab');
    if (tab) target.searchParams.set('tab', tab);
    target.searchParams.set('refresh', String(Date.now()));
    location.assign(target.href);
  });

  window.addEventListener('pagehide', stopCamera);
  applyThemeIcon();
  refreshIcons();
});
