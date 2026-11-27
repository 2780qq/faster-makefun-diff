// makefun-diff 1.0.0's own search, with its string comparisons replaced by integer ones. The control
// flow, the tie-break, the bounds and the patch writer are the reference's, kept line for line, so the
// answer is the same by construction; only what the inner loop compares is cheaper.
const FORMAT = 'makefun-diff/1';
const CONTEXT = 3;
const KEEP = '=';
const DELETE = '-';
const INSERT = '+';

/** The text's lines, each with its "\n" (the last without, when the text does not end in one). */
function tokenize(text) {
  const parts = text.split('\n');
  const lines = [];
  const last = parts.length - 1;
  for (let i = 0; i < last; i++) lines.push(parts[i] + '\n');
  if (parts[last] !== '') lines.push(parts[last]);
  return lines;
}

/** The path extended by one deletion or insertion (the reference's addToPath). */
function addToPath(path, kind, oldPosInc) {
  const last = path.lastComponent;
  if (last !== undefined && last.kind === kind) {
    return { oldPos: path.oldPos + oldPosInc, lastComponent: { count: last.count + 1, kind, previousComponent: last.previousComponent } };
  }
  return { oldPos: path.oldPos + oldPosInc, lastComponent: { count: 1, kind, previousComponent: last } };
}

/** The equal run from the path's position (the reference's extractCommon). */
function extractCommon(path, newIds, oldIds, diagonal) {
  const newLen = newIds.length;
  const oldLen = oldIds.length;
  let oldPos = path.oldPos;
  let newPos = oldPos - diagonal;
  let common = 0;
  while (newPos + 1 < newLen && oldPos + 1 < oldLen && oldIds[oldPos + 1] === newIds[newPos + 1]) {
    newPos++;
    oldPos++;
    common++;
  }
  if (common > 0) path.lastComponent = { count: common, kind: KEEP, previousComponent: path.lastComponent };
  path.oldPos = oldPos;
  return newPos;
}

/** The edit runs of oldIds into newIds (the reference's editRuns, comparing integers). */
function editRuns(oldIds, newIds) {
  const oldLen = oldIds.length;
  const newLen = newIds.length;
  const runsOf = (lastComponent) => {
    const runs = [];
    for (let c = lastComponent; c !== undefined; c = c.previousComponent) runs.push({ kind: c.kind, count: c.count });
    return runs.reverse();
  };
  const maxEdit = oldLen + newLen;
  const offset = maxEdit + 1;
  const bestPath = new Array(2 * maxEdit + 3);
  bestPath[offset] = { oldPos: -1, lastComponent: undefined };
  let newPos = extractCommon(bestPath[offset], newIds, oldIds, 0);
  if (bestPath[offset].oldPos + 1 >= oldLen && newPos + 1 >= newLen) return runsOf(bestPath[offset].lastComponent);
  for (let d = 1; d <= maxEdit; d++) {
    for (let k = -d; k <= d; k += 2) {
      const removePath = bestPath[offset + k - 1];
      const addPath = bestPath[offset + k + 1];
      if (removePath !== undefined) bestPath[offset + k - 1] = undefined;
      const canRemove = removePath !== undefined && removePath.oldPos + 1 < oldLen;
      const canAdd = addPath !== undefined && addPath.oldPos - k < newLen;
      if (!canRemove && !canAdd) {
        bestPath[offset + k] = undefined;
        continue;
      }
      const byDeletion = canRemove ? removePath.oldPos + 1 : -2;
      const byInsertion = canAdd ? addPath.oldPos : -2;
      const path = byDeletion >= byInsertion ? addToPath(removePath, DELETE, 1) : addToPath(addPath, INSERT, 0);
      newPos = extractCommon(path, newIds, oldIds, k);
      if (path.oldPos + 1 >= oldLen && newPos + 1 >= newLen) return runsOf(path.lastComponent);
      bestPath[offset + k] = path;
    }
  }
  throw new Error('makefun-diff: the search ended without reaching both ends');
}

/** A line as the patch writes it. */
function written(op, line) {
  return line.charCodeAt(line.length - 1) === 10 ? op + line : op + line + '\n%\n';
}

/** make.fun's own patch of input.old into input.new. */
export function run(input) {
  if (input === null || typeof input !== 'object' || typeof input.old !== 'string' || typeof input.new !== 'string') {
    throw new TypeError('makefun-diff: the input is { old, new }, two strings');
  }
  const a = tokenize(input.old);
  const b = tokenize(input.new);
  const n = a.length;
  const m = b.length;
  let prefix = 0;
  while (prefix < n && prefix < m && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < n - prefix && suffix < m - prefix && a[n - 1 - suffix] === b[m - 1 - suffix]) suffix++;

  // one map for both texts, so an equal line is the same number in both; one pass per text
  const shared = new Map();
  const ai = new Int32Array(n);
  const bi = new Int32Array(m);
  let next = 0;
  for (let i = 0; i < n; i++) { const s = a[i]; let id = shared.get(s); if (id === undefined) { id = next++; shared.set(s, id); } ai[i] = id; }
  for (let i = 0; i < m; i++) { const s = b[i]; let id = shared.get(s); if (id === undefined) { id = next++; shared.set(s, id); } bi[i] = id; }

  const runs = [];
  if (prefix > 0) runs.push({ kind: KEEP, count: prefix });
  // the middle is a view, not a copy
  runs.push(...editRuns(ai.subarray(prefix, n - suffix), bi.subarray(prefix, m - suffix)));
  if (suffix > 0) runs.push({ kind: KEEP, count: suffix });

  const changes = [];
  let o = 0, p = 0, deleted = 0, inserted = 0;
  for (const r of runs) {
    if (r.kind === KEEP) { o += r.count; p += r.count; continue; }
    let c = changes[changes.length - 1];
    if (c === undefined || c.o + c.dels !== o || c.p + c.ins !== p) {
      c = { o, p, dels: 0, ins: 0 };
      changes.push(c);
    }
    if (r.kind === DELETE) { c.dels += r.count; o += r.count; deleted += r.count; }
    else { c.ins += r.count; p += r.count; inserted += r.count; }
  }

  const hunks = [];
  for (const c of changes) {
    const h = hunks[hunks.length - 1];
    const prev = h !== undefined ? h[h.length - 1] : undefined;
    if (prev !== undefined && c.o - (prev.o + prev.dels) <= 2 * CONTEXT) h.push(c);
    else hunks.push([c]);
  }

  const out = [`${FORMAT} old=${n} new=${m} hunks=${hunks.length} deleted=${deleted} inserted=${inserted}\n`];
  for (const h of hunks) {
    const first = h[0];
    const last = h[h.length - 1];
    const oldStart = Math.max(0, first.o - CONTEXT);
    const newStart = first.p - (first.o - oldStart);
    const after = Math.min(CONTEXT, n - (last.o + last.dels));
    const oldEnd = last.o + last.dels + after;
    const newEnd = last.p + last.ins + after;
    out.push(`@ ${oldStart + 1} ${oldEnd - oldStart} ${newStart + 1} ${newEnd - newStart}\n`);
    let at = oldStart;
    for (const c of h) {
      for (; at < c.o; at++) out.push(written(KEEP, a[at]));
      for (let i = 0; i < c.dels; i++) out.push(written(DELETE, a[c.o + i]));
      for (let i = 0; i < c.ins; i++) out.push(written(INSERT, b[c.p + i]));
      at = c.o + c.dels;
    }
    for (; at < oldEnd; at++) out.push(written(KEEP, a[at]));
  }
  return out.join('');
}
