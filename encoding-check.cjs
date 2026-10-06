const fs=require('fs');const g=require('child_process');
const files=g.execSync('git ls-files -co --exclude-standard',{encoding:'utf8'}).trim().split(/\r?\n/).map(f=>f.trim()).filter(f=>/\.(ts|tsx|css|md|sql)$/.test(f));
let bad=[];for(const f of files){if(!fs.existsSync(f))continue;const s=fs.readFileSync(f,'utf8');const m=(s.match(/\u00c3|\u00e2\u20ac|\u00f0\u0178|\uFFFD/g)||[]).length;if(m)bad.push(f+' ('+m+')');}
console.log(bad.length?'CORRUPTOS: '+bad.join(', '):'OK: '+files.length+' archivos limpios');
