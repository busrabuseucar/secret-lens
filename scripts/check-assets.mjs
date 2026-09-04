import {readFile,access,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const html=await readFile('dist/index.html','utf8');
for(const m of html.matchAll(/(?:src|href)="(\/[^"#?]*)"/g))if(m[1]!=='/')await access(resolve('dist','.'+m[1]));
for(const name of await readdir('dist'))if(name.endsWith('.js')){
 const source=await readFile('dist/'+name,'utf8');
 for(const m of source.matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+)['"]/g))await access(resolve('dist',m[1]));
}
await access('dist/worker.js');
const css=await readFile('dist/styles.css','utf8');
for(const m of css.matchAll(/url\(['"]?(\/[^)'"\s]+)['"]?\)/g))await access(resolve('dist','.'+m[1]));
if(JSON.parse(await readFile('.openai/hosting.json','utf8')).static?.directory!=='dist')throw Error('Expected dist manifest.');
console.log('Static entrypoint, imports, worker and download assets verified.');
