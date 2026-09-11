(() => {
  const currentUserId = document.body?.dataset.currentUserId || '';
  if (!currentUserId) return;
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const icons = () => window.lucide?.createIcons();
  const room = document.querySelector('[data-chat-room]');
  const conversationId = room?.dataset.conversationId || '';
  const messageScroll = document.querySelector('[data-message-scroll]');
  const composer = document.querySelector('[data-chat-composer]');
  const chatInput = composer?.querySelector('[data-chat-input]');
  const typingIndicator = document.querySelector('[data-typing-indicator]');
  let typingTimer = null;
  let typingSent = false;

  function toast(text, href) {
    let el = document.querySelector('[data-global-toast]');
    if (!el) {
      el = document.createElement(href ? 'a' : 'div');
      el.dataset.globalToast = '1';
      el.className = 'global-toast';
      document.body.appendChild(el);
    }
    if (href) el.href = href;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function setBadge(selector, count) {
    document.querySelectorAll(selector).forEach(el => {
      const n = Number(count) || 0;
      el.hidden = n <= 0;
      el.textContent = n > 99 ? '99+' : String(n);
    });
  }

  async function refreshBadges() {
    try {
      const r = await fetch('/api/badges', { headers:{ Accept:'application/json' }, cache:'no-store' });
      const data = await r.json();
      if (!data.ok) return;
      setBadge('[data-notification-badge]', data.notifications);
      setBadge('[data-message-badge]', data.messages);
    } catch (_) {}
  }

  function reactionHtml(counts = {}) {
    return Object.entries(counts).map(([emoji, count]) => `<span>${esc(emoji)} ${count}</span>`).join('');
  }

  function messageHtml(m) {
    const mine = String(m.senderId) === String(currentUserId);
    let content = '';
    if (m.replyTo) content += `<div class="reply-quote">${esc(m.replyTo.text || 'Media')}</div>`;
    if (m.post) content += `<a class="shared-post" href="/p/${encodeURIComponent(m.post.id || '')}"><img src="${esc(m.post.imageUrl)}" alt="Shared post"><div><span class="shared-label"><i data-lucide="send"></i> Post</span><strong>@${esc(m.post.authorUsername || 'user')}</strong><p>${esc(m.post.caption || '')}</p></div></a>`;
    if (m.storyPreview) content += `<div class="shared-story"><img src="${esc(m.storyPreview.imageUrl)}" alt="Story"><div><span class="shared-label"><i data-lucide="circle-play"></i> Storyga javob</span><strong>@${esc(m.storyPreview.authorUsername || '')}</strong><p>${esc(m.storyPreview.caption || 'Story')}</p></div></div>`;
    if (m.ephemeral && m.mediaType === 'image') {
      if (mine) content += `<div class="once-photo once-photo-sent"><span class="once-photo-icon"><i data-lucide="camera"></i></span><div><strong>Bir martalik surat</strong><small>${m.consumed ? 'Ko‘rildi · surat o‘chirildi' : (m.opened ? 'Ochildi · 10 soniya' : 'Yetkazildi')}</small></div></div>`;
      else if (m.consumed) content += `<div class="once-photo once-photo-expired"><span class="once-photo-icon"><i data-lucide="eye-off"></i></span><div><strong>Surat ko‘rildi</strong><small>Bir martalik media o‘chirildi</small></div></div>`;
      else content += `<button class="once-photo once-photo-open" type="button" data-live-ephemeral-open data-conversation="${esc(conversationId)}" data-message="${esc(m.id)}"><span class="once-photo-icon"><i data-lucide="camera"></i></span><div><strong>Bir martalik surat</strong><small>Ochilgach 10 soniya ko‘rinadi</small></div><i data-lucide="chevron-right"></i></button>`;
    }
    if (m.media) {
      if (m.media.type === 'image') content += `<img class="chat-media-image" src="${esc(m.media.url)}" alt="Media">`;
      else if (m.media.type === 'video') content += `<video class="chat-media-video" src="${esc(m.media.url)}" controls playsinline></video>`;
      else if (m.media.type === 'audio') content += `<audio class="chat-media-audio" src="${esc(m.media.url)}" controls></audio>`;
      else content += `<a class="chat-file" href="${esc(m.media.url)}" target="_blank" rel="noopener"><i data-lucide="paperclip"></i> ${esc(m.media.name || 'Fayl')}</a>`;
    }
    if (m.deleted) content += `<p class="message-deleted">Xabar o‘chirildi</p>`;
    else if (m.text) content += `<p class="message-text">${esc(m.text)}</p>`;
    const time = new Date(m.createdAt).toLocaleTimeString('uz-UZ', {hour:'2-digit',minute:'2-digit'});
    const actions = `<div class="reaction-picker">${['❤️','😂','🔥','😮','👍'].map(e => `<button type="button" data-live-message-react="${e}" data-conversation="${esc(conversationId)}" data-message="${esc(m.id)}">${e}</button>`).join('')}<button type="button" data-message-reply="${esc(m.id)}" data-message-preview="${esc((m.text||'Media').slice(0,80))}"><i data-lucide="reply"></i></button><button type="button" data-message-pin="${esc(m.id)}"><i data-lucide="pin"></i></button>${mine&&!m.deleted?`<button type="button" data-message-edit="${esc(m.id)}" data-message-text="${esc(m.text||'')}"><i data-lucide="pencil"></i></button><button type="button" data-message-delete="${esc(m.id)}"><i data-lucide="trash-2"></i></button>`:''}</div>`;
    return `<div class="message-wrap ${mine ? 'mine':'theirs'}" data-message-wrap data-message-id="${esc(m.id)}" data-created-at="${esc(m.createdAt)}"><div class="message-bubble ${m.ephemeral ? 'ephemeral-message':''}">${content}<small class="message-time">${esc(time)}${m.edited?' · tahrirlangan':''}</small><div class="message-reactions" data-message-reactions>${reactionHtml(m.reactionCounts)}</div>${actions}</div></div>`;
  }

  async function fetchAndAppendMessage(messageId) {
    if (!conversationId || !messageId || document.querySelector(`[data-message-wrap][data-message-id="${CSS.escape(String(messageId))}"]`)) return;
    try {
      const r = await fetch(`/chats/${conversationId}/messages/${messageId}/json`, { headers:{ Accept:'application/json' }, cache:'no-store' });
      const data = await r.json();
      if (!data.ok) return;
      typingIndicator?.insertAdjacentHTML('beforebegin', messageHtml(data.message));
      messageScroll.scrollTop = messageScroll.scrollHeight;
      icons();
    } catch (_) {}
  }

  composer?.addEventListener('submit', async e => {
    e.preventDefault();
    const text = chatInput?.value.trim() || '';
    if (!text) return;
    const submit = composer.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const r = await fetch(composer.action, { method:'POST', headers:{ Accept:'application/json','Content-Type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ text, replyTo: composer.querySelector('[data-chat-reply-id]')?.value || '' }) });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || 'Yuborilmadi');
      chatInput.value = '';
      await sendTyping(false);
      await fetchAndAppendMessage(data.messageId);
    } catch (err) { toast(err.message || 'Xabar yuborilmadi'); }
    finally { submit.disabled = false; chatInput?.focus(); }
  });

  async function sendTyping(typing) {
    if (!conversationId || typingSent === typing) return;
    typingSent = typing;
    fetch(`/chats/${conversationId}/typing`, { method:'POST', headers:{ Accept:'application/json','Content-Type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ typing: typing ? '1' : '' }) }).catch(() => {});
  }

  chatInput?.addEventListener('input', () => {
    sendTyping(!!chatInput.value.trim());
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => sendTyping(false), 1400);
  });
  chatInput?.addEventListener('blur', () => sendTyping(false));

  document.addEventListener('click', async e => {
    const react = e.target.closest('[data-live-message-react]');
    if (react) {
      const body = new URLSearchParams({ emoji: react.dataset.liveMessageReact });
      const r = await fetch(`/chats/${react.dataset.conversation}/messages/${react.dataset.message}/react`, { method:'POST', headers:{ Accept:'application/json','Content-Type':'application/x-www-form-urlencoded' }, body });
      const data = await r.json();
      if (data.ok) {
        const target = react.closest('.message-bubble')?.querySelector('[data-message-reactions]');
        if (target) target.innerHTML = reactionHtml(data.counts);
      }
      return;
    }

    const once = e.target.closest('[data-live-ephemeral-open]');
    if (once) {
      const r = await fetch(`/chats/${once.dataset.conversation}/messages/${once.dataset.message}/ephemeral/open`, { method:'POST', headers:{ Accept:'application/json' } });
      const data = await r.json();
      if (!r.ok || !data.ok) { toast('Surat allaqachon ko‘rilgan'); return; }
      const viewer = document.querySelector('[data-ephemeral-viewer]');
      const img = viewer?.querySelector('[data-ephemeral-image]');
      const count = viewer?.querySelector('[data-ephemeral-count]');
      const progress = viewer?.querySelector('[data-ephemeral-progress]');
      if (!viewer || !img) return;
      viewer.hidden = false; img.src = data.url;
      const duration = Math.max(250, Math.min(10000, Number(data.remainingMs) || 10000));
      const started = performance.now();
      const tick = setInterval(() => {
        const left = Math.max(0, duration - (performance.now() - started));
        if (count) count.textContent = Math.ceil(left/1000);
        if (progress) progress.style.transform = `scaleX(${left/duration})`;
        if (left <= 0) {
          clearInterval(tick); viewer.hidden = true; img.removeAttribute('src');
          fetch(`/chats/${once.dataset.conversation}/messages/${once.dataset.message}/ephemeral/consume`, { method:'POST', headers:{ Accept:'application/json' } }).catch(()=>{});
        }
      }, 100);
    }
  });


  window.addEventListener('lumi:message-created', e => {
    if (e.detail?.messageId) fetchAndAppendMessage(e.detail.messageId);
  });

  // Re-clicking Feed explicitly requests a fresh algorithm order.
  document.querySelector('[data-feed-refresh]')?.addEventListener('click', e => {
    if (location.pathname === '/feed') {
      e.preventDefault();
      location.href = `/feed?fresh=${Date.now()}`;
    }
  });

  // Save/bookmark a post without reloading.
  document.querySelectorAll('[data-save-post]').forEach(btn => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const r = await fetch(`/posts/${btn.dataset.savePost}/save`, { method:'POST', headers:{ Accept:'application/json' } });
      const data = await r.json();
      if (data.ok) { btn.classList.toggle('saved', data.saved); toast(data.saved ? 'Post saqlandi' : 'Saqlanganlardan olindi'); }
    } finally { btn.disabled = false; }
  }));

  // Double click/tap desktop image: like quickly.
  document.querySelectorAll('[data-double-like]').forEach(img => img.addEventListener('dblclick', () => {
    const card = img.closest('[data-post-id]');
    const form = card?.querySelector('.ajax-like-form');
    const btn = form?.querySelector('button');
    if (form && btn && !btn.classList.contains('liked')) form.requestSubmit();
  }));

  // Who liked a post.
  const likesSheet = document.querySelector('[data-likes-sheet]');
  const likesList = likesSheet?.querySelector('[data-likes-list]');
  document.querySelectorAll('[data-post-likes-open]').forEach(btn => btn.addEventListener('click', async () => {
    if (!likesSheet || !likesList) return;
    likesList.innerHTML = '<div class="sheet-loading">Yuklanmoqda…</div>';
    likesSheet.hidden = false; document.body.classList.add('sheet-open'); requestAnimationFrame(() => likesSheet.classList.add('open'));
    try {
      const r = await fetch(`/posts/${btn.dataset.postLikesOpen}/likes`, { headers:{ Accept:'application/json' } });
      const data = await r.json();
      likesList.innerHTML = data.users?.length ? data.users.map(u => `<a class="people-row" href="/u/${encodeURIComponent(u.username)}"><span class="avatar">${u.avatarUrl ? `<img src="${esc(u.avatarUrl)}" alt="">` : `<b>${esc((u.name||u.username||'U')[0])}</b>`}</span><span><strong>${esc(u.name || u.username)}</strong><small>@${esc(u.username)}</small></span>${u.isVerified ? '<i data-lucide="badge-check" class="verified"></i>' : ''}</a>`).join('') : '<div class="empty-mini">Hali like yo‘q.</div>';
      icons();
    } catch (_) { likesList.innerHTML = '<div class="empty-mini">Yuklanmadi.</div>'; }
  }));

  // @username autocomplete while creating a post.
  const mentionInput = document.querySelector('[data-mention-input]');
  const mentionBox = document.querySelector('[data-mention-suggestions]');
  let mentionTimer = null;
  mentionInput?.addEventListener('input', () => {
    clearTimeout(mentionTimer);
    const before = mentionInput.value.slice(0, mentionInput.selectionStart);
    const match = before.match(/(?:^|\s)@([a-z0-9._]{0,24})$/i);
    if (!match) { if (mentionBox) mentionBox.hidden = true; return; }
    mentionTimer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(match[1])}`, { headers:{ Accept:'application/json' } });
        const data = await r.json();
        if (!mentionBox) return;
        mentionBox.innerHTML = (data.users || []).map(u => `<button type="button" data-mention-pick="${esc(u.username)}"><span class="avatar">${u.avatarUrl ? `<img src="${esc(u.avatarUrl)}" alt="">` : `<b>${esc((u.name||u.username||'U')[0])}</b>`}</span><span><strong>${esc(u.name)}</strong><small>@${esc(u.username)}</small></span></button>`).join('');
        mentionBox.hidden = !(data.users || []).length;
      } catch (_) {}
    }, 160);
  });
  mentionBox?.addEventListener('click', e => {
    const pick = e.target.closest('[data-mention-pick]');
    if (!pick) return;
    const pos = mentionInput.selectionStart;
    const before = mentionInput.value.slice(0, pos).replace(/@([a-z0-9._]*)$/i, '@' + pick.dataset.mentionPick + ' ');
    mentionInput.value = before + mentionInput.value.slice(pos);
    mentionInput.focus(); mentionInput.selectionStart = mentionInput.selectionEnd = before.length;
    mentionBox.hidden = true;
  });

  // SSE connection + polling fallback.
  if ('EventSource' in window) {
    const es = new EventSource('/api/events');
    es.addEventListener('chat:message', e => {
      const data = JSON.parse(e.data || '{}');
      if (conversationId && data.conversationId === conversationId) {
        fetchAndAppendMessage(data.messageId).then(() => {
          fetch(`/chats/${conversationId}/read`, { method:'POST', headers:{ Accept:'application/json' } }).then(() => refreshBadges()).catch(()=>{});
        });
      } else if (location.pathname === '/chats' && data.conversationId) {
        const row = document.querySelector(`[data-conversation-row="${CSS.escape(String(data.conversationId))}"]`);
        if (row) {
          const preview = row.querySelector('[data-chat-preview]');
          const time = row.querySelector('[data-chat-time]');
          const unread = row.querySelector('[data-chat-unread]');
          if (preview) preview.textContent = data.preview || 'Yangi xabar';
          if (time) time.textContent = 'hozir';
          if (unread) { const n = Math.min(99, (Number(unread.textContent) || 0) + 1); unread.textContent = n >= 99 ? '99+' : String(n); unread.hidden = false; }
          row.parentElement?.prepend(row);
        } else {
          setTimeout(() => location.reload(), 350);
        }
        refreshBadges();
      } else {
        refreshBadges();
        toast(data.preview || 'Yangi xabar', data.conversationId ? `/chats/${data.conversationId}` : '/chats');
      }
    });
    es.addEventListener('chat:reaction', e => {
      const data = JSON.parse(e.data || '{}');
      if (data.conversationId !== conversationId) return;
      const wrap = document.querySelector(`[data-message-wrap][data-message-id="${CSS.escape(String(data.messageId))}"]`);
      const target = wrap?.querySelector('[data-message-reactions]');
      if (target) target.innerHTML = reactionHtml(data.counts || {});
    });
    es.addEventListener('chat:message-updated', e => {
      const data = JSON.parse(e.data || '{}');
      if (data.conversationId !== conversationId) return;
      const wrap = document.querySelector(`[data-message-wrap][data-message-id="${CSS.escape(String(data.messageId))}"]`);
      if (!wrap) return;
      const text = wrap.querySelector('.message-text');
      if (data.deleted) { if (text) text.remove(); if (!wrap.querySelector('.message-deleted')) wrap.querySelector('.message-bubble')?.insertAdjacentHTML('afterbegin','<p class="message-deleted">Xabar o‘chirildi</p>'); }
      else if (data.text != null) { if (text) text.textContent = data.text; else wrap.querySelector('.message-bubble')?.insertAdjacentHTML('afterbegin',`<p class="message-text">${esc(data.text)}</p>`); }
      const time = wrap.querySelector('.message-time'); if (time && data.edited && !time.textContent.includes('tahrirlangan')) time.textContent += ' · tahrirlangan';
    });
    es.addEventListener('chat:pinned', e => { const data=JSON.parse(e.data||'{}'); if(data.conversationId===conversationId) toast(data.messageId?'Xabar pin qilindi':'Pin olib tashlandi'); });
    es.addEventListener('chat:typing', e => {
      const data = JSON.parse(e.data || '{}');
      if (!typingIndicator || data.conversationId !== conversationId || String(data.userId) === String(currentUserId)) return;
      typingIndicator.hidden = !data.typing;
      if (data.typing) messageScroll.scrollTop = messageScroll.scrollHeight;
    });
    es.addEventListener('chat:ephemeral-opened', e => {
      const data = JSON.parse(e.data || '{}');
      const wrap = document.querySelector(`[data-message-wrap][data-message-id="${CSS.escape(String(data.messageId))}"]`);
      const small = wrap?.querySelector('.once-photo-sent small');
      if (small) small.textContent = 'Ochildi · 10 soniya';
    });
    es.addEventListener('chat:ephemeral-consumed', e => {
      const data = JSON.parse(e.data || '{}');
      const wrap = document.querySelector(`[data-message-wrap][data-message-id="${CSS.escape(String(data.messageId))}"]`);
      const small = wrap?.querySelector('.once-photo-sent small');
      if (small) small.textContent = 'Ko‘rildi · surat o‘chirildi';
    });
    es.addEventListener('notification', e => {
      const data = JSON.parse(e.data || '{}');
      refreshBadges();
      if (!conversationId || data.conversation !== conversationId) toast(data.text || 'Yangi bildirishnoma', '/notifications');
    });
    es.addEventListener('story:new', () => {
      if (location.pathname === '/feed' || location.pathname === '/chats') toast('Yangi story bor — yangilash uchun bosing', location.pathname);
    });
    es.onerror = () => {};
  }

  refreshBadges();
  setInterval(refreshBadges, 20000);
  icons();
})();

// v1.6 chat enhancements: cursor history, media/voice, reply/edit/delete/pin.
document.addEventListener('DOMContentLoaded',()=>{
  const room=document.querySelector('[data-chat-room]'); if(!room)return;
  const cid=room.dataset.conversationId, scroll=document.querySelector('[data-message-scroll]');
  const replyId=document.querySelector('[data-chat-reply-id]'), replyBanner=document.querySelector('[data-chat-reply-banner]'), replyLabel=document.querySelector('[data-chat-reply-label]');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons=()=>window.lucide?.createIcons();
  function clearReply(){if(replyId)replyId.value='';if(replyBanner)replyBanner.hidden=true;if(replyLabel)replyLabel.textContent=''}
  document.querySelector('[data-chat-reply-cancel]')?.addEventListener('click',clearReply);
  document.addEventListener('click',async e=>{
    const rb=e.target.closest('[data-message-reply]'); if(rb){replyId.value=rb.dataset.messageReply;replyLabel.textContent=rb.dataset.messagePreview||'Xabarga javob';replyBanner.hidden=false;document.querySelector('[data-chat-input]')?.focus();return}
    const report=e.target.closest('[data-message-report]'); if(report){await fetch(`/chats/${cid}/messages/${report.dataset.messageReport}/report`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({reason:'other'})});report.disabled=true;report.title='Reported';return}
    const pin=e.target.closest('[data-message-pin]'); if(pin){await fetch(`/chats/${cid}/messages/${pin.dataset.messagePin}/pin`,{method:'POST',headers:{Accept:'application/json'}});return}
    const del=e.target.closest('[data-message-delete]'); if(del&&confirm('Xabarni hamma uchun o‘chirasizmi?')){const d=await fetch(`/chats/${cid}/messages/${del.dataset.messageDelete}/delete`,{method:'POST',headers:{Accept:'application/json'}}).then(r=>r.json());if(d.ok){const w=del.closest('[data-message-wrap]');w.querySelector('.message-text')?.remove();const b=w.querySelector('.message-bubble');b.insertAdjacentHTML('afterbegin','<p class="message-deleted">Xabar o‘chirildi</p>')}}
    const edit=e.target.closest('[data-message-edit]'); if(edit){const t=prompt('Xabarni tahrirlash:',edit.dataset.messageText||'');if(t&&t.trim()){await fetch(`/chats/${cid}/messages/${edit.dataset.messageEdit}/edit`,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({text:t.trim()})})}return}
  });
  const oldBtn=document.querySelector('[data-load-older]');
  oldBtn?.addEventListener('click',async()=>{
    const first=scroll.querySelector('[data-message-wrap][data-created-at]');if(!first)return;
    oldBtn.disabled=true;
    const d=await fetch(`/api/chats/${cid}/messages?before=${encodeURIComponent(first.dataset.createdAt)}`,{headers:{Accept:'application/json'}}).then(r=>r.json()).catch(()=>null);
    if(d?.ok){
      const beforeH=scroll.scrollHeight;
      const anchor=scroll.querySelector('.older-messages-wrap');
      const temp=document.createElement('div');
      for(const m of d.messages){
        const mine=String(m.senderId)===String(document.body.dataset.currentUserId);
        const wrap=document.createElement('div');wrap.className=`message-wrap ${mine?'mine':'theirs'}`;wrap.dataset.messageWrap='';wrap.dataset.messageId=m.id;wrap.dataset.createdAt=m.createdAt;
        let body='';if(m.replyTo)body+=`<div class="reply-quote">${esc(m.replyTo.text||'Media')}</div>`;
        if(m.post)body+=`<a class="shared-post" href="/p/${esc(m.post.id||'')}"><img src="${esc(m.post.imageUrl||'')}"><div><strong>@${esc(m.post.authorUsername||'user')}</strong><p>${esc(m.post.caption||'')}</p></div></a>`;
        if(m.media)body+=m.media.type==='image'?`<img class="chat-media-image" src="${esc(m.media.url)}">`:m.media.type==='video'?`<video class="chat-media-video" src="${esc(m.media.url)}" controls></video>`:m.media.type==='audio'?`<audio class="chat-media-audio" src="${esc(m.media.url)}" controls></audio>`:`<a class="chat-file" href="${esc(m.media.url)}">${esc(m.media.name||'Fayl')}</a>`;
        body+=m.deleted?'<p class="message-deleted">Xabar o‘chirildi</p>':m.text?`<p class="message-text">${esc(m.text)}</p>`:'';
        body+=`<small class="message-time">${new Date(m.createdAt).toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'})}${m.edited?' · tahrirlangan':''}</small>`;
        wrap.innerHTML=`<div class="message-bubble">${body}</div>`;temp.appendChild(wrap);
      }
      if(anchor) while(temp.firstChild) anchor.insertAdjacentElement('afterend',temp.lastChild);
      oldBtn.hidden=!d.hasMore;scroll.scrollTop=scroll.scrollHeight-beforeH;icons();
    }
    oldBtn.disabled=false;
  });
  const media=document.querySelector('[data-chat-media]'); media?.addEventListener('change',async()=>{const f=media.files?.[0];if(!f)return;const fd=new FormData();fd.append('media',f);media.disabled=true;const d=await fetch(`/chats/${cid}/media`,{method:'POST',headers:{Accept:'application/json'},body:fd}).then(r=>r.json()).catch(()=>null);media.disabled=false;media.value='';if(d?.messageId)window.dispatchEvent(new CustomEvent('lumi:message-created',{detail:{messageId:d.messageId}}))});
  const voiceBtn=document.querySelector('[data-voice-record]');let recorder=null,chunks=[];voiceBtn?.addEventListener('click',async()=>{if(recorder&&recorder.state==='recording'){recorder.stop();return}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());voiceBtn.classList.remove('recording');const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});const fd=new FormData();fd.append('media',blob,'voice.webm');const d=await fetch(`/chats/${cid}/media`,{method:'POST',headers:{Accept:'application/json'},body:fd}).then(r=>r.json()).catch(()=>null);if(d?.messageId)window.dispatchEvent(new CustomEvent('lumi:message-created',{detail:{messageId:d.messageId}}))};recorder.start();voiceBtn.classList.add('recording')}catch(_){alert('Mikrofonga ruxsat berilmadi.')}});
  window.addEventListener('lumi:message-created',clearReply);
});
