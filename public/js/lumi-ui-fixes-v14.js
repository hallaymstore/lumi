/* Lumi UI repairs v1.14: accessible post-menu portal and consistent dialogs. */
document.addEventListener('DOMContentLoaded',()=>{
  const menus=[...document.querySelectorAll('[data-post-menu]')];
  let opened=null;
  function hideMenu(returnFocus=false){
    if(!opened)return;
    const {wrapper,pop,button}=opened;
    opened=null;
    pop.hidden=true;
    wrapper.appendChild(pop);
    button.setAttribute('aria-expanded','false');
    wrapper.classList.remove('menu-open');
    if(returnFocus)button.focus({preventScroll:true});
  }
  function showMenu(wrapper){
    if(opened?.wrapper===wrapper){hideMenu(true);return}
    hideMenu();
    const button=wrapper.querySelector('[data-post-menu-toggle]');
    const pop=wrapper.querySelector('.post-menu-pop');
    if(!button||!pop)return;
    document.body.appendChild(pop);
    pop.hidden=false;
    wrapper.classList.add('menu-open');
    button.setAttribute('aria-expanded','true');
    opened={wrapper,pop,button};
    const rect=button.getBoundingClientRect();
    const width=Math.min(246,window.innerWidth-16);
    pop.style.width=width+'px';
    const height=pop.offsetHeight;
    pop.style.left=Math.max(8,Math.min(window.innerWidth-width-8,rect.right-width))+'px';
    pop.style.top=Math.max(8,Math.min(window.innerHeight-height-8,rect.bottom+7+height>window.innerHeight-8?rect.top-height-7:rect.bottom+7))+'px';
    const first=pop.querySelector('a,button');
    if(first)first.focus({preventScroll:true});
  }
  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-post-menu-toggle]');
    if(trigger){e.preventDefault();showMenu(trigger.closest('[data-post-menu]'));return}
    if(!opened)return;
    if(opened.pop.contains(e.target)){
      if(e.target.closest('a,[data-share-open],[data-not-interested],[data-hide-author],form button'))hideMenu();
      return;
    }
    hideMenu();
  });
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(opened){e.preventDefault();hideMenu(true);return}
    const sheets=[...document.querySelectorAll('.sheet-backdrop.open')];
    const sheet=sheets.at(-1);
    if(sheet){e.preventDefault();sheet.querySelector('[data-sheet-close]')?.click()}
  });
  window.addEventListener('resize',()=>hideMenu());
  document.addEventListener('scroll',e=>{
    if(opened&&!opened.pop.contains(e.target))hideMenu();
  },true);
  document.querySelectorAll('.post-menu-pop form[action$="/delete"]').forEach(f=>f.addEventListener('submit',e=>{
    if(!window.confirm('Postni butunlay o‘chirishni tasdiqlaysizmi?'))e.preventDefault();
  }));
});
