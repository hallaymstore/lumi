const fs=require('fs');const path=require('path');const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');let bad=0;
function walk(d){for(const n of fs.readdirSync(d)){if(n==='node_modules'||n.startsWith('.git'))continue;const p=path.join(d,n),st=fs.statSync(p);if(st.isDirectory())walk(p);else if(p.endsWith('.js')){try{execFileSync(process.execPath,['--check',p],{stdio:'pipe'})}catch(e){bad++;console.error('JS syntax:',path.relative(root,p),e.stderr?.toString()||e.message)}}}}
walk(root);
const renderNames=[];for(const file of fs.readdirSync(path.join(root,'routes')).filter(x=>x.endsWith('.js')).concat(['../app.js'])){const p=file==='../app.js'?path.join(root,'app.js'):path.join(root,'routes',file);const s=fs.readFileSync(p,'utf8');for(const m of s.matchAll(/res\.render\(['\"]([^'\"]+)/g))renderNames.push(m[1])}
for(const v of new Set(renderNames)){const p=path.join(root,'views',v+'.ejs');if(!fs.existsSync(p)){bad++;console.error('Missing view:',v)}}
console.log(bad?'Project check FAILED':'Project static check OK');process.exitCode=bad?1:0;
