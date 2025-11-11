import fs from "node:fs"; import path from "node:path";
const repo = process.cwd();
const allowed = new Set(JSON.parse(fs.readFileSync(path.join(repo,"analytics","events.json"),"utf8")).allowed);
const roots = [path.join(repo,"services","orchestrator","src")];
let bad=[]; function scan(p){ const st=fs.statSync(p);
  if(st.isDirectory()){ for(const f of fs.readdirSync(p)) scan(path.join(p,f)); }
  else if(/\.(t|j)sx?$/.test(p)){ const txt=fs.readFileSync(p,"utf8");
    const re=/emitAnalytics\s*\(\s*['"]([^'"]+)['"]/g; let m; while((m=re.exec(txt))) if(!allowed.has(m[1])) bad.push({file:p,event:m[1]}); } }
for(const r of roots) if(fs.existsSync(r)) scan(r);
if(bad.length){ console.error("Unknown analytics events:"); for(const b of bad) console.error(` - ${b.event} in ${b.file}`); process.exit(1); }
console.log("Analytics events check passed.");