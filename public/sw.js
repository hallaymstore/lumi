const CACHE='lumi-shell-v1.6.1';
const STATIC=['/offline.html','/css/app.css','/js/app.js','/js/realtime.js','/js/pwa.js','/js/v16.js','/icons/icon-192.png','/icons/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).catch(()=>{}).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==location.origin)return;
  if(url.pathname.startsWith('/css/')||url.pathname.startsWith('/js/')||url.pathname.startsWith('/icons/')||url.pathname==='/manifest.webmanifest'){e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));return r})));return}
  if(req.mode==='navigate'){e.respondWith(fetch(req).catch(()=>caches.match('/offline.html')))}
});
self.addEventListener('push',e=>{let data={};try{data=e.data?.json()||{}}catch{data={body:e.data?.text()||'Yangi bildirishnoma'}};e.waitUntil(self.registration.showNotification(data.title||'Lumi',{body:data.body||'Yangi faollik',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{url:data.url||'/notifications'},tag:data.tag||'lumi-notification',renotify:true}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=e.notification.data?.url||'/notifications';e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){c.navigate(url);return c.focus()}}return clients.openWindow(url)}))});
self.addEventListener('message',e=>{if(e.data?.type==='SET_BADGE'&&'setAppBadge'in navigator)navigator.setAppBadge(Number(e.data.count||0)).catch(()=>{})});
