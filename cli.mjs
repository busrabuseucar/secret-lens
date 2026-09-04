import {open,lstat} from 'node:fs/promises';
import {scan,validateSizes,decodeFile,exportReport,ScanError,LIMITS} from './dist/scanner.js';
import {sampleFiles} from './dist/sample.js';
const args=process.argv.slice(2);
if(args[0]==='--help'){
 console.log('SecretLens: node cli.mjs --demo | --demo-fixed | [--] file1 file2\nJSON contains masked values and numbered filenames. Exit: 0 no findings, 1 findings, 2 error/incomplete.');
 process.exit(0);
}
try{
 let files;
 if(args.length===1&&['--demo','--demo-fixed'].includes(args[0]))files=sampleFiles(args[0]==='--demo-fixed');
 else{
  const paths=args[0]==='--'?args.slice(1):args;
  if(paths.some(p=>p.startsWith('--'))&&args[0]!=='--')throw new ScanError('Bilinmeyen seçenek. Kullanım için --help.');
  validateSizes(paths.map(()=>0));
  const metadata=await Promise.all(paths.map(p=>lstat(p)));
  if(metadata.some(s=>!s.isFile()))throw new ScanError('Yalnızca normal dosyalar destekleniyor; klasör ve sembolik bağlantı seçme.');
  validateSizes(metadata.map(s=>s.size));files=[];
  for(const path of paths){
   const handle=await open(path,'r');
   try{
    const info=await handle.stat();if(!info.isFile())throw new ScanError('Yalnızca normal metin dosyaları destekleniyor.');
    const buffer=Buffer.alloc(LIMITS.fileBytes+1);let length=0;
    while(length<buffer.length){const {bytesRead}=await handle.read(buffer,length,buffer.length-length,null);if(!bytesRead)break;length+=bytesRead;}
    validateSizes([length]);files.push({name:'input',text:decodeFile(buffer.subarray(0,length))});
   }finally{await handle.close();}
  }
 }
 const result=scan(files);process.stdout.write(exportReport(result));
 process.exitCode=result.truncated?2:result.findings.length?1:0;
}catch(error){
 process.stderr.write((error instanceof ScanError?error.message:'Dosya okunamadı. Dosyanın varlığını ve okuma iznini kontrol et.')+'\n');
 process.exitCode=2;
}
