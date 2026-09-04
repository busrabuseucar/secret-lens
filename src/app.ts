import {RULES,validateSizes,decodeFile,exportReport,ScanError,type RuleId,type SourceFile,type ScanResult} from './scanner.js';
import {sampleFiles} from './sample.js';
function get<T extends HTMLElement>(id:string):T {const e=document.getElementById(id);if(!e)throw new Error('Missing UI element');return e as T;}
function element<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string):HTMLElementTagNameMap[K]{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
const code=get<HTMLTextAreaElement>('code'), fileInput=get<HTMLInputElement>('files'), scanButton=get<HTMLButtonElement>('scan'), exportButton=get<HTMLButtonElement>('export'), filter=get<HTMLSelectElement>('filter');
let mode:'before'|'after'|'paste'|'files'='before';
let result:ScanResult|null=null, names:string[]=[];
let generation=0, worker:Worker|null=null, timer:number|undefined;
function status(text:string,error=false){const e=get('status');e.textContent=text;e.classList.toggle('error',error);}
function stop(){generation++;worker?.terminate();worker=null;clearTimeout(timer);timer=undefined;scanButton.disabled=false;get('results-panel').setAttribute('aria-busy','false');}
function resetResults(){result=null;names=[];exportButton.disabled=true;for(const id of ['count-total','count-high','count-files'])get(id).textContent='—';get('findings').replaceChildren(element('p','Sonuçları görmek için içeriği tara.','empty'));get('result-note').textContent='Beş kural, yalnızca olası eşleşmeleri gösterir.';}
function setMode(next:typeof mode){mode=next;get('sample-before').setAttribute('aria-pressed',String(mode==='before'));get('sample-after').setAttribute('aria-pressed',String(mode==='after'));get('mode').textContent=mode==='before'||mode==='after'?'SENTETİK ÖRNEK':'SENİN İÇERİĞİN';}
function invalidate(next:typeof mode){stop();setMode(next);resetResults();status('İçerik değişti. Yeni bir tarama başlat.');}
function render(){
 if(!result)return;
 get('count-total').textContent=String(result.findings.length)+(result.truncated?'+':'');
 get('count-high').textContent=String(result.findings.filter(f=>f.severity==='high').length);
 get('count-files').textContent=`${result.processedFiles}/${result.files}`;
 get('result-note').textContent=result.truncated?'Bulgu sınırına ulaşıldı: ilk 500 bulgu gösteriliyor. Tarama eksik; dosyaları daha küçük gruplar hâlinde tara.':`${result.lines.toLocaleString('tr-TR')} satır tarandı. ${mode==='before'||mode==='after'?'Bu bulgular sentetik örneğe aittir.':'Geçerlilik kontrolü yapılmadı.'}`;
 const visible=result.findings.filter(f=>filter.value==='all'||f.severity===filter.value);
 const container=get('findings');container.replaceChildren();
 if(!visible.length){container.append(element('p',result.findings.length?'Bu filtrede bulgu yok.':'Bu beş kurala uyan bulgu bulunamadı. Bu sonuç güvenlik garantisi değildir.','empty'));return;}
 for(const f of visible){
   const rule=RULES[f.rule], article=element('article',undefined,'finding'), head=element('div',undefined,'finding-head');
   head.append(element('h3',rule.name),element('span',f.severity==='high'?'Öncelikli':'İncele',`badge ${f.severity}`));
   article.append(head,element('p',`${names[f.fileIndex]??'dosya'} · Satır ${f.line}, sütun ${f.column}`,'location'),element('code','[MASKELENDİ]','masked'));
   const detail=element('details');detail.append(element('summary','Neden eşleşti, ne yapmalıyım?'),element('p',rule.explanation));
   const action=element('p');action.append(element('strong','Sonraki adım: '),document.createTextNode(rule.action));detail.append(action);article.append(detail);container.append(article);
 }
}
async function run(){
 stop();resetResults();const current=generation;scanButton.disabled=true;get('results-panel').setAttribute('aria-busy','true');status('İçerik cihazında taranıyor…');
 try{
   let files:SourceFile[];
   if(mode==='before'||mode==='after')files=sampleFiles(mode==='after');
   else if(mode==='paste'){
     if(!code.value.trim())throw new ScanError('Önce kod yapıştır veya dosya seç.');
     files=[{name:'yapistirilan-kod.txt',text:code.value}];
   }else{
     const selected=Array.from(fileInput.files??[]);validateSizes(selected.map(f=>f.size));files=[];
     for(const file of selected){const bytes=new Uint8Array(await file.arrayBuffer());if(current!==generation)return;files.push({name:file.name,text:decodeFile(bytes)});}
   }
   if(current!==generation)return;
   names=files.map(f=>f.name);worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
   worker.onmessage=(event:MessageEvent<{ok:true;result:ScanResult}|{ok:false;error:string}>)=>{
     if(current!==generation)return;
     const data=event.data;stop();
     if(!data.ok){resetResults();status(data.error,true);return;}
     result=data.result;exportButton.disabled=false;render();status(result.truncated?'Tarama kısmen tamamlandı. Bulgu sınırını incele.':'Tarama tamamlandı. Bulgularda ham değerler gösterilmiyor.');
   };
   worker.onerror=(event)=>{event.preventDefault();if(current!==generation)return;stop();resetResults();status('Tarama başlatılamadı. Sayfayı yenileyip yeniden dene.',true);};
   timer=window.setTimeout(()=>{if(current!==generation)return;stop();resetResults();status('Tarama süre sınırını aştı. Daha küçük dosyalarla yeniden dene.',true);},8000);
   worker.postMessage({files});
 }catch(error){if(current!==generation)return;stop();resetResults();status(error instanceof ScanError?error.message:'Dosya okunamadı. UTF-8 metin dosyası seçip tekrar dene.',true);}
}
code.addEventListener('input',()=>{fileInput.value='';invalidate('paste');get('selection').textContent='Kaynak: yapıştırılan metin';});
fileInput.addEventListener('change',()=>{code.value='';invalidate('files');get('selection').textContent=Array.from(fileInput.files??[]).map(f=>f.name).join(' · ')||'Dosya seçilmedi.';});
scanButton.addEventListener('click',()=>void run());filter.addEventListener('change',render);
get('clear').addEventListener('click',()=>{code.value='';fileInput.value='';invalidate('paste');get('selection').textContent='';status('İçerik ve sonuçlar temizlendi.');code.focus();});
function chooseSample(fixed:boolean){code.value='';fileInput.value='';setMode(fixed?'after':'before');get('selection').textContent=fixed?'config.fixed.ts · ortam değişkenleriyle okuma':'config.demo.ts + keys.demo.txt · tamamı sentetik';void run();}
get('sample-before').addEventListener('click',()=>chooseSample(false));get('sample-after').addEventListener('click',()=>chooseSample(true));
exportButton.addEventListener('click',()=>{if(!result)return;const url=URL.createObjectURL(new Blob([exportReport(result)],{type:'application/json;charset=utf-8'}));const a=element('a');a.href=url;a.download='secretlens-masked-report.json';document.body.append(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);});
for(const id of Object.keys(RULES) as RuleId[]){const rule=RULES[id], item=element('div');item.append(element('h3',rule.name),element('p',rule.explanation));get('rule-list').append(item);}
window.addEventListener('pagehide',()=>{stop();code.value='';fileInput.value='';result=null;names=[];get('findings').replaceChildren();get('selection').textContent='';});
window.addEventListener('pageshow',event=>{if(event.persisted){invalidate('paste');get('selection').textContent='';status('Önceki içerik temizlendi. Yeni bir tarama başlatabilirsin.');}});
chooseSample(false);
