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
    deleteRows(r, n) { this.data.splice(r - 1, n); }
  }
  class SS {
    constructor(name) { this.id = 'ss' + nextId++; this.name = name; this.sheets = {}; }
    getId() { return this.id; } getUrl() { return 'mock://' + this.id; }
    getSheetByName(n) { return this.sheets[n] || null; }
    insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }
    getSheets() { return Object.values(this.sheets); }
  }
  const props = {};
  const cache = {};
  // ドライブ：共有の状態（sharing・editors・viewers）を持つファイルとフォルダ。テストから drive.share で変えられる
  const drive = {
    meta: {}, folders: {}, triggers: [], seq: 1,
    iter: a => { let i = 0; return { hasNext: () => i < a.length, next: () => a[i++] }; },
    m: id => (drive.meta[id] = drive.meta[id] || { sharing: 'PRIVATE', editors: [], viewers: [], trashed: false, created: new Date(Date.now() + drive.seq++) }),
    wrap: (id, name) => {
      const m = drive.m(id);
      return {
        getId: () => id, getName: () => name(), getUrl: () => 'mock://' + id, getSharingAccess: () => m.sharing,
        getEditors: () => m.editors.map(e => ({ getEmail: () => e })), getViewers: () => m.viewers.map(e => ({ getEmail: () => e })),
        getDateCreated: () => m.created, setTrashed: t => { m.trashed = t; },
        makeCopy: (n, folder) => { const cid = 'copy' + drive.seq++; drive.copies[cid] = n; if (folder) folder._files.push(cid); return drive.file(cid); }
      };
    },
    copies: {},
    file: id => {
      if (files[id]) return drive.wrap(id, () => files[id]);
      if (store[id]) return drive.wrap(id, () => store[id].name);
      if (drive.copies[id]) return drive.wrap(id, () => drive.copies[id]);
      if (id === 'SCRIPT1') return drive.wrap(id, () => 'script');
      return null;
    },
    folder: n => {
      const id = 'folder' + drive.seq++, f = drive.wrap(id, () => n);
      f._files = []; f.getFiles = () => drive.iter(f._files.filter(c => !drive.m(c).trashed).map(c => drive.file(c)));
      return (drive.folders[id] = f);
    },
    share: (id, o) => Object.assign(drive.m(id), o),
    live: () => Object.keys(drive.copies).filter(c => !drive.m(c).trashed)
  };
  const env = {
    user: 'tanaka@edu.nishi.or.jp',
    owner: 'tanaka@edu.nishi.or.jp', // スクリプトの所有者（自分として実行の「自分」）
    SpreadsheetApp: { create: n => { const s = new SS(n); store[s.id] = s; return s; }, openById: id => store[id] },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    DriveApp: {
      getFileById: id => { const f = drive.file(id); if (!f) throw new Error('no access'); return f; },
      getFoldersByName: n => drive.iter(Object.values(drive.folders).filter(f => f.getName() === n)),
      createFolder: n => drive.folder(n)
    },
    ScriptApp: {
      getScriptId: () => 'SCRIPT1',
      getProjectTriggers: () => drive.triggers.map(h => ({ getHandlerFunction: () => h })),
      WeekDay: { SUNDAY: 'SUNDAY' },
      newTrigger: h => { const b = { timeBased: () => b, everyWeeks: () => b, onWeekDay: () => b, atHour: () => b, create: () => { drive.triggers.push(h); return b; } }; return b; }
    },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    Utilities: { formatDate: d => d.toISOString().slice(0, 10) },
    HtmlService: { createHtmlOutput: h => ({ h, setTitle() { return this; } }), createHtmlOutputFromFile: f => ({ f, setTitle() { return this; }, addMetaTag() { return this; } }) },
    console
  };
  env.Session = { getActiveUser: () => ({ getEmail: () => env.user }), getEffectiveUser: () => ({ getEmail: () => env.owner }) };
  const ctx = vm.createContext(env);
  vm.runInContext(src, ctx);
  const call = (fn, ...a) => JSON.parse(ctx[fn](...a));
  const db = () => store[props.CLASS_SPLIT_DB_ID];
  return { ctx, env, call, db, drive, props };
}

