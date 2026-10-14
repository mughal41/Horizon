import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

for (const file of readdirSync('src/tests').filter(f => f.endsWith('.test.ts')).sort()) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', `src/tests/${file}`], { encoding: 'utf8' });
  if (result.error) throw result.error;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  console.log(`${file}: ${result.status === 0 ? 'PASS' : 'FAIL'}`);
  console.log(output.split('\n').filter(line => /^(All |Tests completed:|✓ All |Journey acceptance)/.test(line)).join('\n'));
  if (result.status !== 0) {
    console.error(output.slice(-4000));
    process.exit(result.status || 1);
  }
}
