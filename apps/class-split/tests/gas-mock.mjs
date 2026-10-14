// GAS の各サービス（SpreadsheetApp・PropertiesService・LockService・Session・DriveApp・HtmlService）を
// メモリ上で真似る部品。tests/gas.test.mjs と tests/gas-ui.test.mjs が使う。
import vm from 'node:vm';

export function makeGas(src) {
  const files = { DOC1234567890abcdefghijXYZ: '10月2日 休み時間の件' };
  const store = {};
  let nextId = 1;
  class Range {
    constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
    setValues(v) { for (let i = 0; i < this.nr; i++) { const row = this.sh.data[this.r - 1 + i] || (this.sh.data[this.r - 1 + i] = []); for (let j = 0; j < this.nc; j++) row[this.c - 1 + j] = v[i][j]; } return this; }
    setValue(x) { return this.setValues([[x]]); }
    getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = this.sh.data[this.r - 1 + i] || []; const o = []; for (let j = 0; j < this.nc; j++) o.push(row[this.c - 1 + j] ?? ''); out.push(o); } return out; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.data = []; }
    getName() { return this.name; }
    width() { return Math.max(0, ...this.data.map(r => r.length)); }
    getDataRange() { return new Range(this, 1, 1, this.data.length, this.width()); }
    getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
    getLastRow() { return this.data.length; }
    getLastColumn() { return this.width(); }
    deleteRow(r) { this.data.splice(r - 1, 1); }
  }
  class SS {
    constructor(name) { this.id = 'ss' + nextId++; this.name = name; this.sheets = {}; }
    getId() { return this.id; } getUrl() { return 'mock://' + this.id; }
    getSheetByName(n) { return this.sheets[n] || null; }
    insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }
    getSheets() { return Object.values(this.sheets); }
  }
  const props = {};
  const env = {
    user: 'tanaka@edu.nishi.or.jp',
    SpreadsheetApp: { create: n => { const s = new SS(n); store[s.id] = s; return s; }, openById: id => store[id] },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    DriveApp: { getFileById: id => { if (!files[id]) throw new Error('no access'); return { getName: () => files[id] }; } },
    Utilities: { formatDate: d => d.toISOString().slice(0, 10) },
    HtmlService: { createHtmlOutput: h => ({ h, setTitle() { return this; } }), createHtmlOutputFromFile: f => ({ f, setTitle() { return this; }, addMetaTag() { return this; } }) },
    console
  };
  env.Session = { getActiveUser: () => ({ getEmail: () => env.user }) };
  const ctx = vm.createContext(env);
  vm.runInContext(src, ctx);
  const call = (fn, ...a) => JSON.parse(ctx[fn](...a));
  const db = () => store[props.CLASS_SPLIT_DB_ID];
  return { ctx, env, call, db };
}

