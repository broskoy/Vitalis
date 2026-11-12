// Fetches a subtree of the Open Tree of Life synthetic tree and writes it as a
// compact JSON snapshot used by the prototype's SampleProvider.
//
//   node scripts/fetch-sample.mjs [ottId] [outFile]
//
// Uses the "arguson" format because it is the only one that gives every node a
// stable id (unnamed clades get "mrcaottXottY" ids; Newick leaves them blank).

import { writeFile } from 'node:fs/promises';

const API = 'https://api.opentreeoflife.org/v3/tree_of_life/subtree';
const ottId = process.argv[2] ?? '244265'; // Mammalia
const outFile = process.argv[3] ?? 'public/data/mammalia.json';

const res = await fetch(API, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ node_id: `ott${ottId}`, format: 'arguson', height_limit: -1 }),
});
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const { arguson } = await res.json();

// Flat preorder arrays: parents always precede their children.
const ids = [];
const names = []; // display name; '' for unnamed clades
const parents = [];
const rankTable = [];
const ranks = [];
const extinct = []; // indices of extinct nodes

const rankIndex = (r) => {
  let k = rankTable.indexOf(r);
  if (k < 0) k = rankTable.push(r) - 1;
  return k;
};

// Iterative DFS (the tree is deep enough to make recursion uncomfortable).
const stack = [[arguson, -1]];
while (stack.length) {
  const [node, parent] = stack.pop();
  const idx = ids.length;
  ids.push(node.node_id);
  names.push(node.taxon?.name ?? '');
  ranks.push(rankIndex(node.taxon?.rank ?? ''));
  parents.push(parent);
  if (node.extinct) extinct.push(idx);
  const children = node.children ?? [];
  for (let k = children.length - 1; k >= 0; k--) stack.push([children[k], idx]);
}

const out = {
  source: 'Open Tree of Life synthetic tree (CC0)',
  fetched: new Date().toISOString(),
  ids,
  names,
  parents,
  rankTable,
  ranks,
  extinct,
};
await writeFile(outFile, JSON.stringify(out));
const unnamed = names.filter((n) => !n).length;
console.log(`wrote ${outFile}: ${ids.length} nodes (${unnamed} unnamed, ${extinct.length} extinct)`);
