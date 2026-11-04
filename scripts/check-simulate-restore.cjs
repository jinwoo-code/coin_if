// Run with: node scripts/check-simulate-restore.cjs
// Exercise the actual page's mount effect without a browser or paid API calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../app/simulate/page.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

for (const mainId of ['', 'hired:0>promotion:1']) {
  const effects = [];
  const states = [];
  let requests = 0;
  const scenes = [{ worldId: 'developer', lineId: mainId, station: 0, label: '첫 번째 역' },
    { worldId: 'developer', lineId: mainId, station: 1, label: '마지막 역' }];
  const store = {
    getProfile: () => ({}),
    getSelection: () => ({ worldIds: ['developer'], months: 6, startYm: '2026-12' }),
    getMultiverses: () => ({ developer: { lines: [{ id: mainId, isMain: true }] } }),
    getLines: () => ({ developer: { [mainId]: scenes } }),
    // Visiting another world can change this; main-line restoration must not depend on it.
    getActive: () => ({ developer: 'another-world' }),
  };
  const react = {
    useState(initial) {
      const index = states.length;
      states.push(initial);
      return [initial, (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef: (current) => ({ current }),
    useEffect: (effect) => { effects.push(effect); },
  };
  const exports = {};
  const noop = () => null;
  const imports = {
    react,
    'react/jsx-runtime': { jsx: noop, jsxs: noop },
    'next/navigation': { useRouter: () => ({ replace: () => assert.fail('Unexpected redirect') }) },
    'next/link': noop,
    'lucide-react': {},
    '@/components/ui': {},
    '@/lib/calendar': {},
    '@/lib/store': { store },
    '@/lib/worlds': { getWorld: (id) => ({ id }) },
  };
  vm.runInNewContext(compiled, {
    exports,
    require: (id) => { assert.ok(id in imports, `Unexpected import: ${id}`); return imports[id]; },
    fetch: () => { requests++; return Promise.reject(new Error('Unexpected simulation restart')); },
  });
  exports.default();
  effects[0]();
  assert.equal(requests, 0, `Saved main line ${JSON.stringify(mainId)} must not restart the simulation`);
  assert.ok(states.some((value) => Array.isArray(value) && value.length === 2 && value[0]?.events?.[0] === scenes[0]), 'All saved stations must be restored together');
  console.log(`PASS: saved main line ${JSON.stringify(mainId)} restores all stations without an API request`);
}
