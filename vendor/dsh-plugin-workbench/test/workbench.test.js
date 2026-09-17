import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import yaml from 'js-yaml';

test('bundle mounts official scheduling and persistent opt-in search', async () => {
  const schema = yaml.DEFAULT_SCHEMA.extend([new yaml.Type('tag:yaml.org,2002:js', {kind: 'scalar', construct: value => value})]);
  const patch = yaml.load(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'), {schema});
  assert.deepEqual(patch[0].insert.map(row => row.id), ['time-context', 'schedule']);
  assert.equal(patch.find(row => row.id === 'ui-schedule').disabled, false);
  assert.deepEqual(patch.find(row => row.id === 'session-query-sqlite').config, {path: "dshHomePath('workbench-session-search.sqlite')", openAt: 'first-search'});
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  for (const row of patch[0].insert) assert.equal(manifest.dependencies[row.name], '0.1.5-rc.2');
});
