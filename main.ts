import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';
const root=fileURLToPath(new URL('.',import.meta.url));
function arg(k:string,f:string){const i=process.argv.indexOf('--'+k);if(i>=0&&process.argv[i+1])return process.argv[i+1];const e=process.argv.find(x=>x.startsWith('--'+k+'='));return e?e.slice(k.length+3):f}
const inp=arg('input','/input'),src=inp.endsWith('.json')?inp:join(inp,'snapshot.json'),out=arg('output',process.env.MAKEFUN_OUTPUT_DIR||'/output');
if(!existsSync(src)){process.stderr.write(`token radar: snapshot not found: ${src}\n`);process.exit(1)}
const snapshot=parseSnapshot(readFileSync(src,'utf8')),{board,radar}=buildRadar(snapshot),issue=boardIssue(board,snapshot);if(issue){process.stderr.write(`token radar: ${issue}\n`);process.exit(1)}
mkdirSync(out,{recursive:true});writeFileSync(join(out,'board.json'),JSON.stringify({rows:board})+'\n');writeFileSync(join(out,'data.js'),dataScript(radar));
function copyTree(from:string,to:string){mkdirSync(to,{recursive:true});let files=0;for(const name of readdirSync(from).sort()){if(name.startsWith('.'))continue;const a=join(from,name),b=join(to,name),st=statSync(a);if(st.isFile()){copyFileSync(a,b);files++}else if(st.isDirectory())files+=copyTree(a,b)}return files}
const dashboardFiles=copyTree(join(root,'dashboard'),join(out,'dashboard'));const shots=copyTree(join(root,'screenshots'),join(out,'screenshots'));const names=readdirSync(join(root,'screenshots')).filter(n=>!n.startsWith('.')).sort();if(names.length<3)throw Error(`screenshots requires at least 3; found ${names.length}`);for(const n of names)if(!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(n))throw Error(`invalid screenshot name ${n}`);
writeFileSync(join(out,'dossier.json'),buildDossier(out,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}}));
process.stdout.write(`${snapshot.protocols.length} protocols; ${snapshot.watchlist.length} watchlist; ${board.length} rows (${radar.early_size} early; ${radar.live.length} live)\nWrote board.json, data.js, dashboard (${dashboardFiles} files), screenshots (${shots} files), dossier.json\n`);
