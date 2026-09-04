import {scan,ScanError,type SourceFile} from './scanner.js';
const scope=globalThis as unknown as {onmessage:((event:MessageEvent<{files:SourceFile[]}>)=>void)|null;postMessage:(message:unknown)=>void};
scope.onmessage=(event)=>{
 try {scope.postMessage({ok:true,result:scan(event.data.files)});}
 catch(error){scope.postMessage({ok:false,error:error instanceof ScanError?error.message:'Tarama tamamlanamadı. Daha küçük metin dosyalarıyla yeniden dene.'});}
};
