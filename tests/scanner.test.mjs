import test from 'node:test';
import assert from 'node:assert/strict';
import {scan,decodeFile,validateSizes,exportReport,LIMITS} from '../dist/scanner.js';
import {sampleFiles} from '../dist/sample.js';
const one=text=>scan([{name:'input',text}]);
const token='ghp_'+'SYNTHETIC'.repeat(4);
test('synthetic before sample covers five rules without duplicate generic token finding',()=>{
 const r=scan(sampleFiles());assert.equal(r.findings.length,5);assert.equal(r.findings.filter(f=>f.severity==='high').length,3);assert.equal(new Set(r.findings.map(f=>f.rule)).size,5);assert.equal(r.processedFiles,2);
});
test('fixed sample uses environment references and matches no rules',()=>assert.equal(scan(sampleFiles(true)).findings.length,0));
test('classic GitHub prefix family, exact body length and boundaries',()=>{
 for(const p of ['ghp_','gho_','ghu_','ghs_','ghr_'])assert.equal(one(p+'X'.repeat(36)).findings[0]?.rule,'github-token');
 for(const text of ['ghp_'+'X'.repeat(35),'ghp_'+'X'.repeat(37),'aghp_'+'X'.repeat(36),'ghp_'+'X'.repeat(36)+'_'])assert.equal(one(text).findings.length,0);
});
test('AWS access IDs use review severity, including temporary IDs',()=>{
 const r=one('AKIAIOSFODNN7EXAMPLE\nASIAIOSFODNN7EXAMPLE');assert.equal(r.findings.length,2);assert.ok(r.findings.every(f=>f.severity==='review'&&f.rule==='aws-access-id'));
 assert.equal(one('AKIAIOSFODNN7EXAMPLEx').findings.length,0);
});
test('PEM private header variants match but public headers do not',()=>{
 for(const type of ['','RSA ','EC ','DSA ','OPENSSH ','ENCRYPTED '])assert.equal(one(`-----BEGIN ${type}PRIVATE KEY-----`).findings[0]?.rule,'private-key');
 assert.equal(one('-----BEGIN PUBLIC KEY-----').findings.length,0);
});
test('credential URLs detect a password but not anonymous URLs',()=>{
 for(const protocol of ['https','postgres','postgresql','mysql','mongodb+srv','redis','amqps'])assert.equal(one(`${protocol}://user:demoPass@host.invalid/db`).findings[0]?.rule,'credential-url');
 assert.equal(one('https://user@host.invalid').findings.length,0);
});
test('quoted JSON, dotenv and prefixed assignment literals match',()=>{
 for(const text of ['"api_key": "demo_value_123"','DB_PASSWORD=demo_value_123',"client_secret = 'demo_value_123'",'password: demo_value_123'])assert.equal(one(text).findings[0]?.rule,'secret-assignment');
});
test('explicit placeholders and environment references are ignored',()=>{
 for(const text of ['password="<PASSWORD>"','API_KEY="YOUR_API_KEY"','password=CHANGEME','secret=REPLACE_ME','password="${DB_PASSWORD}"','api_key=process.env.API_KEY','password=os.getenv("PASSWORD")','password=import.meta.env.PASSWORD','password=null'])assert.equal(one(text).findings.length,0,text);
});
test('ordinary example literals still match; comments are not trusted exclusions',()=>{
 assert.equal(one('# password = "example123"').findings.length,1);
 assert.equal(one('// '+token).findings.length,1);
});
test('line and column positions support CRLF, CR and multiple matches',()=>{
 const r=one('first\r\n  '+token+' '+token+'\rpassword="demoPass"');
 assert.deepEqual(r.findings.map(f=>[f.line,f.column]),[[2,3],[2,44],[3,11]]);
});
test('repeated occurrences retain separate locations and file identities',()=>{
 const r=scan([{name:'same',text:token+'\n'+token},{name:'same',text:token}]);
 assert.deepEqual(r.findings.map(f=>[f.id,f.fileIndex,f.line]),[[1,0,1],[2,0,2],[3,1,1]]);
});
test('entire engine result and report omit source, filenames, token and neighboring content',()=>{
 const secret='RareSentinel_918283';const filename='PRIVATE_CLIENT_DIRECTORY';const neighboring='INTERNAL_BILLING_DATA';
 const r=scan([{name:filename,text:`password="${secret}" # ${neighboring}\n${token}`}]);
 for(const output of [JSON.stringify(r),exportReport(r)])for(const raw of [secret,filename,neighboring,token])assert.ok(!output.includes(raw));
 const report=JSON.parse(exportReport(r));assert.equal(report.findings[0].file,'dosya-01');assert.equal(report.findings[0].value,'[MASKELENDİ]');
});
test('report uses an explicit allowlist even if extra raw fields are present',()=>{
 const r=one('password="SentinelSecret88"');r.source='RAW_EXTRA';r.findings[0].raw='RAW_FINDING';r.findings[0].masked='RAW_MASK';
 const report=exportReport(r);for(const raw of ['SentinelSecret88','RAW_EXTRA','RAW_FINDING','RAW_MASK'])assert.ok(!report.includes(raw));
});
test('UTF-8 decoding rejects invalid bytes and binary NUL; preserves Unicode and BOM content',()=>{
 assert.throws(()=>decodeFile(new Uint8Array([0xc3,0x28])),/UTF-8/);assert.throws(()=>decodeFile(new Uint8Array([0])),/İkili/);
 assert.equal(decodeFile(new TextEncoder().encode('\ufeffşifre=örnek')),'şifre=örnek');assert.throws(()=>one('abc\0def'),/İkili/);
});
test('file counts and per-file and total byte limits are inclusive',()=>{
 assert.throws(()=>validateSizes([]));validateSizes(Array(20).fill(0));assert.throws(()=>validateSizes(Array(21).fill(0)));
 validateSizes([LIMITS.fileBytes]);assert.throws(()=>validateSizes([LIMITS.fileBytes+1]));validateSizes(Array(4).fill(LIMITS.fileBytes));assert.throws(()=>validateSizes([...Array(4).fill(LIMITS.fileBytes),1]));
});
test('size validation rejects impossible sizes',()=>{for(const n of [-1,NaN,Infinity,0.5])assert.throws(()=>validateSizes([n]));});
test('engine counts UTF-8 bytes rather than only characters',()=>assert.throws(()=>one('ş'.repeat(262145)),/512 KiB/));
test('line length boundary prevents oversized single lines',()=>{
 assert.equal(one('x'.repeat(LIMITS.lineLength)).findings.length,0);assert.throws(()=>one('x'.repeat(LIMITS.lineLength+1)),/satır/);
});
test('line count boundary is enforced across files',()=>{
 assert.equal(one('\n'.repeat(LIMITS.lines-1)).lines,LIMITS.lines);assert.throws(()=>scan([{name:'a',text:'\n'.repeat(25000)},{name:'b',text:'\n'.repeat(25000)}]),/50.000/);
});
test('finding cap distinguishes exactly 500 from incomplete scans',()=>{
 const row='password="demoPass"\n';const full=one(row.repeat(500));assert.equal(full.findings.length,500);assert.equal(full.truncated,false);
 const partial=scan([{name:'a',text:row.repeat(501)},{name:'b',text:token}]);assert.equal(partial.findings.length,500);assert.equal(partial.truncated,true);assert.equal(partial.processedFiles,1);assert.equal(partial.files,2);
});
test('all files are validated before a partial result can be produced',()=>{
 assert.throws(()=>scan([{name:'a',text:'password="demoPass"\n'.repeat(501)},{name:'b',text:'\0'}]),/İkili/);
});

test('quoted environment-looking and primitive-looking values remain literals',()=>{
 for(const value of ['process.env.PASSWORD','os.getenv(PASSWORD)','import.meta.env.PASSWORD','false','null','None']) {
   const result=one(`password="${value}"`);
   assert.equal(result.findings.length,1,value);
   assert.equal(result.findings[0].rule,'secret-assignment');
 }
 for(const text of ['password=process.env.PASSWORD','password=false','password=null'])assert.equal(one(text).findings.length,0);
});

test('assignment length bound never reports a prefix of an oversized value',()=>{
 for(const quote of ['', '"', "'"]){
  assert.equal(one('password='+quote+'x'.repeat(512)+quote).findings.length,1);
  assert.equal(one('password='+quote+'x'.repeat(513)+quote).findings.length,0);
 }
});
