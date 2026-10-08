import test from 'node:test';
import assert from 'node:assert/strict';
import { knownSapTranslation } from '../lib/local-translation.ts';
test('complete kernel recommendation preserves source versions, including an alternative pair',()=>{
 for(const [a,b] of [['749','753'],['789','791']]) {
  const source=`To avoid the potential risks associated with running an outdated SAP kernel version, replace this version with downward-compatible SAP kernel ${a} or ${b}. The downward- compatible kernel is a special validated SAP kernel that improves the stability of your system.`;
  const result=knownSapTranslation(source);
  assert.ok(result.includes(`${a} veya ${b}`));
 }
 assert.equal(knownSapTranslation('To avoid the potential risks associated with running an outdated SAP kernel'),null);
});
