import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const run=args=>spawnSync(process.execPath,['cli.mjs',...args],{encoding:'utf8',timeout:10000});
async function withFile(contents,task){const dir=await mkdtemp(join(tmpdir(),'secretlens-test-'));try{const file=join(dir,'private-name.txt');await writeFile(file,contents);await task(file,dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('CLI demo produces masked JSON and exit 1; fixed sample exits 0',()=>{
 const before=run(['--demo']);assert.equal(before.status,1);assert.equal(JSON.parse(before.stdout).findings.length,5);assert.equal(before.stderr,'');
 const after=run(['--demo-fixed']);assert.equal(after.status,0);assert.equal(JSON.parse(after.stdout).findings.length,0);
});
test('CLI reads actual UTF-8 files without exposing values or paths',async()=>withFile('password="CLI_SENTINEL_441"',async file=>{
 const r=run([file]);assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).findings[0].file,'dosya-01');assert.ok(!(r.stdout+r.stderr).includes('CLI_SENTINEL_441'));assert.ok(!(r.stdout+r.stderr).includes('private-name'));
}));
test('CLI missing file error never leaks the supplied path',()=>{
 const r=run(['/missing/SENSITIVE_DIRECTORY_123']);assert.equal(r.status,2);assert.equal(r.stdout,'');assert.ok(!r.stderr.includes('SENSITIVE_DIRECTORY_123'));
});
test('CLI rejects binary and oversized files with no partial JSON',async()=>{
 for(const data of [Buffer.from([0xff,0xfe]),Buffer.alloc(524289,65)])await withFile(data,async file=>{const r=run([file]);assert.equal(r.status,2);assert.equal(r.stdout,'');});
});
test('CLI refuses directories and symbolic links',async()=>withFile('hello',async(file,dir)=>{
 assert.equal(run([dir]).status,2);const link=join(dir,'link');await symlink(file,link);assert.equal(run([link]).status,2);
}));
test('CLI incomplete scan returns exit 2 with explicitly truncated JSON',async()=>withFile('password="demoPass"\n'.repeat(501),async file=>{
 const r=run([file]);assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).truncated,true);
}));
test('CLI no input and unknown options return an error, help exits successfully',()=>{
 assert.equal(run([]).status,2);assert.equal(run(['--unknown']).status,2);assert.equal(run(['--help']).status,0);
});
