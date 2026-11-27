// xlsx（zip）を画面の中で開き、作り直す（試行の画面で、選んだ様式の Excel に書き込むため）。外の部品は使わない。
// 読み：中央ディレクトリから各ファイルを取り出し、圧縮（deflate）はブラウザの DecompressionStream でほどく。
// 書き：圧縮せずに格納する（Excel はそのまま開ける。大きさは少し増える）
(function (g) {
  'use strict';
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function inflate(u8) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('このブラウザでは Excel を開けません'));
    var s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function read(buf) {
    var u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), e = -1;
    for (var i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) return Promise.reject(new Error('Excel のファイルではありません'));
    var n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true), list = [], dec = new TextDecoder();
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) return Promise.reject(new Error('Excel のファイルが読めません'));
      var method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nl)), start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      list.push({ name: name, method: method, raw: u8.subarray(start, start + size) });
      p += 46 + nl + xl + cl;
    }
    return Promise.all(list.map(function (f) {
      if (f.method === 0) return Promise.resolve({ name: f.name, data: f.raw });
      if (f.method === 8) return inflate(f.raw).then(function (d) { return { name: f.name, data: d }; });
      return Promise.reject(new Error('Excel のファイルの圧縮の形が読めません'));
    }));
  }
  function write(files) {
    var enc = new TextEncoder(), parts = [], cen = [], off = 0;
    var h = function (n, w) { var a = new Uint8Array(n), v = new DataView(a.buffer); w(v); return a; };
    files.forEach(function (f) {
      var nm = enc.encode(f.name), d = f.data, c = crc32(d);
      var loc = h(30, function (v) { v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint32(14, c, true); v.setUint32(18, d.length, true); v.setUint32(22, d.length, true); v.setUint16(26, nm.length, true); });
      cen.push(h(46, function (v) { v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true); v.setUint16(8, 0x0800, true); v.setUint32(16, c, true); v.setUint32(20, d.length, true); v.setUint32(24, d.length, true); v.setUint16(28, nm.length, true); v.setUint32(42, off, true); }), nm);
      parts.push(loc, nm, d); off += 30 + nm.length + d.length;
    });
    var cs = cen.reduce(function (t, a) { return t + a.length; }, 0);
    var end = h(22, function (v) { v.setUint32(0, 0x06054b50, true); v.setUint16(8, files.length, true); v.setUint16(10, files.length, true); v.setUint32(12, cs, true); v.setUint32(16, off, true); });
    return new Blob(parts.concat(cen, [end]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  g.Zip = { read: read, write: write, crc32: crc32 };
})(typeof globalThis !== 'undefined' ? globalThis : this);
