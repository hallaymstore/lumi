const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
let checked = 0;
let failed = 0;
function verify(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const p = path.join(dir,entry.name);
    if (entry.isDirectory()) { verify(p); continue; }
    if (!p.endsWith('.ejs')) continue;
    try { ejs.compile(fs.readFileSync(p,'utf8'),{filename:p}); checked++; }
    catch (error) { failed++; process.stderr.write(p+': '+error.message+'\n'); }
  }
}
verify(path.resolve(__dirname,'../views'));
process.stdout.write('Checked '+checked+' EJS files. Failed: '+failed+'\n');
if (failed) process.exitCode=1;
