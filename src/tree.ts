import { Chess, type Move } from 'chess.js';
import type { MoveReview, PositionEval } from './analysis';
import type { Game } from './game';

/**
 * Arbre des coups : la partie principale est la suite des premiers enfants,
 * les autres enfants sont des variantes jouées par l'utilisateur.
 */
export interface TreeNode {
  id: number;
  fen: string;
  /** Coup qui mène à cette position (absent pour la racine). */
  move?: Move;
  parent?: TreeNode;
  children: TreeNode[];
  /** Nombre de demi-coups depuis le début. */
  ply: number;
  /** Fait partie de la partie importée. */
  mainline: boolean;
  eval?: PositionEval;
  /** Profondeur à laquelle `eval` a été calculée. */
  evalDepth?: number;
  review?: MoveReview;
}

let nextId = 0;

function makeNode(fen: string, ply: number, mainline: boolean, parent?: TreeNode, move?: Move): TreeNode {
  return { id: nextId++, fen, ply, mainline, parent, move, children: [] };
}

export function buildTree(game: Game): TreeNode {
  const root = makeNode(game.fens[0], 0, true);
  let node = root;
  game.moves.forEach((move, i) => {
    const child = makeNode(game.fens[i + 1], i + 1, true, node, move);
    node.children.push(child);
    node = child;
  });
  return root;
}

/** Positions de la partie principale, de la racine à la fin. */
export function mainline(root: TreeNode): TreeNode[] {
  const out = [root];
  let n = root;
  while (n.children[0]?.mainline) {
    n = n.children[0];
    out.push(n);
  }
  return out;
}

/** Joue un coup depuis `node` ; réutilise la branche si ce coup existe déjà. */
export function playMove(node: TreeNode, from: string, to: string, promotion?: string): TreeNode | null {
  const chess = new Chess(node.fen);
  let move: Move;
  try {
    move = chess.move({ from, to, promotion });
  } catch {
    return null;
  }
  const existing = node.children.find((c) => c.move?.san === move.san);
  if (existing) return existing;
  const child = makeNode(move.after, node.ply + 1, false, node, move);
  node.children.push(child);
  return child;
}

/** Supprime une variante (le nœud et tout ce qui suit). */
export function deleteNode(node: TreeNode) {
  if (!node.parent || node.mainline) return;
  node.parent.children = node.parent.children.filter((c) => c !== node);
}

export function findNode(root: TreeNode, id: number): TreeNode | undefined {
  if (root.id === id) return root;
  for (const c of root.children) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return undefined;
}
