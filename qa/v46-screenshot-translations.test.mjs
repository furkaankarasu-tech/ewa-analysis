import test from 'node:test';
import assert from 'node:assert/strict';
import { knownSapTranslation } from '../lib/local-translation.ts';
import { recommendationDisplay } from '../lib/recommendation-presentation.ts';
import { sapSourceLabel } from '../lib/sap-terminology.ts';
const kernel='Consider updating to the latest SP Stack Kernel. For details see SAP Note 2083594 , 3116151 , and 19466 .';
const admin='Remove the DATA ADMIN privilege from all user accounts except the SYSTEM und _SYS_REPO users.';
test('screenshot recommendations translate on request, preserving notes and account exceptions',()=>{
 for(const text of [kernel,admin]) {
  const translated=knownSapTranslation(text);
  assert.ok(translated);
  const view=recommendationDisplay(text,undefined,true);
  assert.equal(view.kind,'translation');
  assert.equal(view.english,text);
  assert.equal(view.turkish,translated);
  assert.equal(recommendationDisplay(text,undefined,false).kind,'source');
 }
 assert.match(knownSapTranslation(kernel),/2083594, 3116151, 19466/);
 assert.equal(knownSapTranslation(admin),'SYSTEM ve _SYS_REPO kullanıcıları dışındaki tüm kullanıcı hesaplarından DATA ADMIN yetkisini kaldırın.');
});
test('spacing and note-number variants do not hard-code screenshot values',()=>{
 const result=knownSapTranslation('Consider updating to the latest SP Stack Kernel. For details see SAP Notes 12345, 67890 and 54321.');
 assert.match(result,/12345, 67890, 54321/);
 assert.doesNotMatch(result,/2083594/);
 assert.equal(knownSapTranslation(admin.replace('und','and')),knownSapTranslation(admin));
 assert.equal(knownSapTranslation(admin.replace('SYSTEM und _SYS_REPO','OTHER_ADMIN')),null);
});
test('both source paths translate while keeping SID and technical names',()=>{
 const a=sapSourceLabel('Software Configuration for CAP > SAP Kernel Version > Newer SP Stack Kernel Available');
 assert.match(a,/CAP sistemi yazılım yapılandırması/);
 assert.match(a,/Daha güncel SP Stack Kernel sürümü mevcut/);
 const b=sapSourceLabel('Security > SAP HANA Database CAP > SAP HANA System Privilege DATA ADMIN > Users with DATA ADMIN Privilege');
 assert.equal(b,'Güvenlik › SAP HANA veritabanı CAP › SAP HANA DATA ADMIN sistem yetkisi › DATA ADMIN yetkisine sahip kullanıcılar');
});
