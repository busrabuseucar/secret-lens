import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
function runWorker(files){return new Promise((resolve,reject)=>{
 const url=new URL('../dist/worker.js',import.meta.url).href;
 // Adapt browser message globals, then run the real compiled worker module.
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.postMessage=x=>parentPort.postMessage(x);import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>globalThis.onmessage({data})));`,{eval:true});
 const timer=setTimeout(()=>{worker.terminate();reject(Error('Worker timeout'));},5000);
 worker.once('message',message=>{clearTimeout(timer);worker.terminate();resolve(message);});
 worker.once('error',error=>{clearTimeout(timer);worker.terminate();reject(error);});worker.postMessage({files});
});}
test('real worker boundary returns only masked findings',async()=>{
 const result=await runWorker([{name:'PRIVATE_FILENAME',text:'password="WORKER_SECRET_123"'}]);assert.equal(result.ok,true);assert.equal(result.result.findings.length,1);assert.ok(!JSON.stringify(result).includes('WORKER_SECRET_123'));assert.ok(!JSON.stringify(result).includes('PRIVATE_FILENAME'));
});
test('worker error response does not echo malformed source',async()=>{
 const result=await runWorker([{name:'PRIVATE_FILENAME',text:'SECRET_BODY\0'}]);assert.equal(result.ok,false);assert.ok(!JSON.stringify(result).includes('SECRET_BODY'));assert.ok(!JSON.stringify(result).includes('PRIVATE_FILENAME'));
});
