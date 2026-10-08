import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workspace = readFileSync(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8');
const lockfile = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function policyEntries(source) {
  const content = source.match(/^allowBuilds:\s*\n((?:^[ \t]+[^\n]*\n|^\s*#.*\n)*)/m)?.[1] || '';
  return Object.fromEntries([...content.matchAll(/^ {2}([\w@./-]+):\s*(true|false)\s*$/gm)].map(([, key, val]) => [key, val === 'true']));
}

test('Vercel install scripts receive specific approvals while strict gate stays on', () => {
  const policies = policyEntries(workspace);
  assert.equal(policies['sharp'], true);
  assert.match(workspace, /^strictDepBuilds: true$/m);
  assert.doesNotMatch(workspace, /^dangerouslyAllowAllBuilds:\s*true$/m);
});

test('local translation runtime is explicitly versioned and lockfile matches', () => {
  assert.match(pkg.dependencies['@huggingface/transformers'], /3\.8\.1/);
  assert.match(pkg.packageManager, /^pnpm@11\./);
  assert.match(lockfile, /^lockfileVersion: ['"]?9/m);
});
