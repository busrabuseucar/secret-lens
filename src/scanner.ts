export const LIMITS = {files:20, fileBytes:524288, totalBytes:2097152, lineLength:16384, lines:50000, findings:500} as const;
export type RuleId = 'github-token'|'aws-access-id'|'private-key'|'credential-url'|'secret-assignment';
export type Severity = 'high'|'review';
export type SourceFile = {name:string; text:string};
export type Finding = {id:number; fileIndex:number; line:number; column:number; rule:RuleId; severity:Severity; masked:string};
export type ScanResult = {version:1; files:number; processedFiles:number; bytes:number; lines:number; truncated:boolean; findings:Finding[]};
export const RULES:Record<RuleId,{name:string; severity:Severity; explanation:string; action:string}> = {
 'github-token':{name:'GitHub classic token biçimi',severity:'high',explanation:'ghp_, gho_, ghu_, ghs_ veya ghr_ önekiyle 36 alfasayısal karakter eşleşti. Geçerlilik kontrol edilmez.',action:'Gerçek ve açığa çıkmış bir token ise GitHub ayarlarında iptal et, yenisini oluştur ve kullanıldığı uygulamaları güncelle.'},
 'aws-access-id':{name:'AWS erişim anahtarı kimliği',severity:'review',explanation:'AKIA veya ASIA ile başlayan 20 karakterli kimlik eşleşti. Bu kimlik tek başına gizli erişim anahtarı değildir.',action:'Yanında secret access key olup olmadığını ve paylaşımın uygunluğunu incele. Gerçek kimlik bilgileri açığa çıktıysa ilgili anahtarı değiştir.'},
 'private-key':{name:'Özel anahtar başlığı',severity:'high',explanation:'PEM özel anahtar başlangıcı bulundu. Başlığın bulunması, geçerli veya tam bir anahtar olduğu anlamına gelmez.',action:'Gerçek anahtar açığa çıktıysa anahtarı değiştir ve bağlı sertifika/erişimleri güncelle. Dosyayı depodan çıkarmak tek başına yeterli değildir.'},
 'credential-url':{name:'URL içinde kullanıcı parolası',severity:'high',explanation:'Bağlantı adresinde kullanıcı adı ve sabit parola biçimi bulundu. Sunucuya bağlantı yapılmaz.',action:'Gerçek parolayı değiştir; bağlantı bilgisini koddan çıkarıp ortam değişkeni veya secret yöneticisinden oku.'},
 'secret-assignment':{name:'Sabit gizli değer ataması',severity:'review',explanation:'Parola, secret veya API anahtarı benzeri değişkene sabit bir değer atanmış. Örnek değerler de eşleşebilir.',action:'Değerin gerçekten hassas olup olmadığını incele. Gerçekse koddan çıkar; açığa çıktıysa önce iptal et veya değiştir.'},
};
export class ScanError extends Error { constructor(message:string){super(message);this.name='ScanError';} }
export function validateSizes(sizes:readonly number[]):void {
 if(!sizes.length)throw new ScanError('En az bir metin dosyası seç veya kod yapıştır.');
 if(sizes.length>LIMITS.files)throw new ScanError('Bir taramada en fazla 20 dosya seçebilirsin.');
 if(sizes.some(n=>!Number.isSafeInteger(n)||n<0||n>LIMITS.fileBytes))throw new ScanError('Her dosya en fazla 512 KiB olabilir.');
 if(sizes.reduce((a,b)=>a+b,0)>LIMITS.totalBytes)throw new ScanError('Toplam dosya boyutu en fazla 2 MiB olabilir.');
}
export function decodeFile(bytes:Uint8Array):string {
 let text:string;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new ScanError('Dosyalar UTF-8 metin olmalı. Geçersiz kodlama bulundu.');}
 if(text.includes('\0'))throw new ScanError('İkili dosyalar desteklenmiyor. UTF-8 metin dosyası seç.');
 return text;
}
function placeholder(value:string):boolean {
 return /^(?:\$\{[A-Za-z_][\w]*\}|<[^<>\r\n]{1,100}>|YOUR_[A-Z_]+|CHANGEME|REPLACE_ME)$/i.test(value);
}
type Hit={start:number;end:number;rule:RuleId};
function hitsForLine(line:string):Hit[] {
 const hits:Hit[]=[];
 const add=(start:number,value:string,rule:RuleId)=>hits.push({start,end:start+value.length,rule});
 for(const m of line.matchAll(/\bgh[pousr]_[A-Za-z0-9]{36}\b/g))add(m.index!,m[0],'github-token');
 for(const m of line.matchAll(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g))add(m.index!,m[0],'aws-access-id');
 for(const m of line.matchAll(/-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g))add(m.index!,m[0],'private-key');
 for(const m of line.matchAll(/\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/([^\s/@:'"<>]{1,256}):([^\s/@'"<>]{1,512})@/gi)) {
   if(!placeholder(m[2]!))add(m.index!,m[0],'credential-url');
 }
 // Deliberately bounded, single-line literals; comments are scanned too.
 const assignment=/\b(?:[a-z0-9]{1,32}_){0,3}(?:password|passwd|pwd|secret|api_?key|access_?token|auth_?token|client_?secret)\b["']?\s*[:=]\s*(?:"([^"\r\n]{1,512})"|'([^'\r\n]{1,512})'|([^\s"'`,;#}{]{1,512})(?![^\s"'`,;#}{]))/gi;
 for(const m of line.matchAll(assignment)) {
   const value=m[1]??m[2]??m[3]??'';
   // Code references are not literals. Known explicit placeholders are ignored.
   if(value.length<4||placeholder(value))continue;
   const unquoted=m[3]!==undefined;
   if(unquoted&&/^(?:process\.env\.|os\.(?:getenv|environ)|import\.meta\.env\.|env\[|getenv\(|\$\{)/.test(value))continue;
   if(unquoted&&/^(?:true|false|null|undefined|none)$/i.test(value))continue;
   const start=m.index!+m[0].lastIndexOf(value);
   if(hits.some(h=>start<h.end&&start+value.length>h.start))continue;
   add(start,value,'secret-assignment');
 }
 return hits.sort((a,b)=>a.start-b.start);
}
export function scan(files:readonly SourceFile[]):ScanResult {
 const sizes=files.map(f=>new TextEncoder().encode(f.text).length);validateSizes(sizes);
 const prepared=files.map(f=>{
   if(f.text.includes('\0'))throw new ScanError('İkili dosyalar desteklenmiyor.');
   const lines=f.text.split(/\r\n|\n|\r/);
   if(lines.some(l=>l.length>LIMITS.lineLength))throw new ScanError('Bir satır 16.384 karakteri aşıyor. Küçük kaynak dosyaları seç.');
   return lines;
 });
 const lineCount=prepared.reduce((n,ls)=>n+ls.length,0);
 if(lineCount>LIMITS.lines)throw new ScanError('Toplam satır sayısı 50.000 sınırını aşıyor.');
 const result:ScanResult={version:1,files:files.length,processedFiles:0,bytes:sizes.reduce((a,b)=>a+b,0),lines:lineCount,truncated:false,findings:[]};
 for(let fi=0;fi<prepared.length;fi++) {
   result.processedFiles=fi+1;
   const lines=prepared[fi]!;
   for(let li=0;li<lines.length;li++) for(const hit of hitsForLine(lines[li]!)) {
     if(result.findings.length===LIMITS.findings){result.truncated=true;return result;}
     result.findings.push({id:result.findings.length+1,fileIndex:fi,line:li+1,column:hit.start+1,rule:hit.rule,severity:RULES[hit.rule].severity,masked:'[MASKELENDİ]'});
   }
 }
 return result;
}
// Explicit allowlist: no original filename, source, snippet, match or partial token.
export function exportReport(result:ScanResult):string {
 return JSON.stringify({tool:'SecretLens',schemaVersion:1,scope:'Heuristic scan; no credential validity check.',files:result.files,processedFiles:result.processedFiles,bytes:result.bytes,lines:result.lines,truncated:result.truncated,findings:result.findings.map(f=>({file:`dosya-${String(f.fileIndex+1).padStart(2,'0')}`,line:f.line,column:f.column,rule:f.rule,severity:f.severity,value:'[MASKELENDİ]'}))},null,2)+'\n';
}
