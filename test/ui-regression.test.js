const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Post options menu is accessible and rendered through portal',()=>{
 const v=read('views/partials/postcard.ejs'),ui=read('public/js/lumi-ui-fixes-v14.js'),css=read('public/css/lumi-ui-fixes-v14.css');
 assert.match(v,/data-post-menu-toggle/);assert.match(v,/class="post-menu-pop"[^>]*hidden/);
 assert.doesNotMatch(v,/<details class="post-menu"/);assert.match(ui,/document\.body\.appendChild\(pop\)/);
 assert.match(ui,/e\.key!=='Escape'/);assert.match(css,/\.post-menu-pop:not\(\[hidden\]\)/);
});
test('Clips integrates Feed comments and share sheets',()=>{
 const c=read('views/clips/index.ejs')+read('views/clips/cards.ejs'),a=read('public/js/app.js');
 assert.match(c,/data-comments-open/);assert.match(c,/data-share-open/);
 assert.match(c,/partials\/postsheets/);
 assert.doesNotMatch(c,/href="\/p\/<%=p\._id%>" aria-label="Izohlar"/);
 assert.match(a,/commentPostId === btn\.dataset\.commentsOpen/);
 assert.match(a,/lumi:sheet-open/);assert.match(a,/lumi:sheet-close/);
});
test('Video is paused on dialog and keyboard ignores focused form fields',()=>{
 const c=read('public/js/lumi-clips-v15.js');
 assert.match(c,/overlay/);assert.match(c,/lumi:sheet-open/);assert.match(c,/lumi:sheet-close/);
 assert.match(c,/document\.querySelector\('\.sheet-backdrop\.open'\)/);
});
test('Polish CSS comes after legacy CSS and reserves navbar space',()=>{
 const h=read('views/partials/head.ejs'),c=read('public/css/lumi-ui-fixes-v14.css');
 assert.match(h,/lumi-ui-fixes-v14\.css/);assert.match(h,/lumi-ui-fixes-v14\.js/);
 assert.ok(h.lastIndexOf('/css/lumi-ui-fixes-v14.css')>h.lastIndexOf('/css/lumi-clips.css'));
 assert.match(c,/\.lumi-clips-page \.lumi-clips-list/);assert.match(c,/\.comments-sheet/);
});

test('Clips like count updates with shared AJAX and authenticated share list is provided',()=>{
 const c=read('views/clips/index.ejs')+read('views/clips/cards.ejs'),route=read('routes/clips.js');
 assert.match(c,/data-like-count/);
 assert.match(c,/postsheets',\{shareTargets\}/);
 assert.match(route,/getShareTargets\(req\.currentUser\._id,30\)/);
});
