import type {SourceFile} from './scanner.js';
// Synthetic teaching strings: never issued or verified with a provider.
export function sampleFiles(fixed=false):SourceFile[] {
 if(fixed)return [{name:'config.fixed.ts',text:['// Eğitim örneği: değerleri koddan çıkar.','const api_key = process.env.API_KEY;','const password = process.env.DB_PASSWORD;','const connection = process.env.DATABASE_URL;','// Özel anahtar dosyasını secret yöneticisinden al.'].join('\n')}];
 return [{name:'config.demo.ts',text:['// TAMAMI SENTETİK: çalışan kimlik bilgisi içermez.',`const api_key = "ghp_${'DEMO'.repeat(9)}";`,'const db_password = "OnlyForDemo_482!";','const connection = "postgres://demo:OnlyForDemo@db.invalid/demo";'].join('\n')},{name:'keys.demo.txt',text:['# Geçerli anahtar değil; yalnızca örnek biçimler.','AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE','-----BEGIN PRIVATE KEY-----','SYNTHETIC-DEMO-NOT-A-KEY','-----END PRIVATE KEY-----'].join('\n')}];
}
