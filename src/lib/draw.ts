import crypto from 'node:crypto';

export interface ExclusionRule {
  giver_id: string;
  excluded_receiver_id: string;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generates a Secret Santa assignment map (giverId -> receiverId) that guarantees:
 * 1. Every participant gives a gift to exactly one person (out-degree = 1).
 * 2. Every participant receives a gift from exactly one person (in-degree = 1).
 * 3. Nobody is assigned to themselves (giverId !== receiverId).
 * 4. All exclusion rules are strictly respected.
 * 5. Prefers a single Hamiltonian cycle (A -> B -> C -> ... -> A) so there are no isolated 2-person loops,
 *    falling back to a general valid derangement if exclusions prevent a single cycle.
 */
export function computeSecretSantaDraw(
  memberIds: string[],
  exclusions: ExclusionRule[] = []
): Record<string, string> | null {
  const n = memberIds.length;
  if (n < 2) return null;

  // Build forbidden set: "giverId->receiverId"
  const forbidden = new Set<string>();
  for (const id of memberIds) {
    forbidden.add(`${id}->${id}`); // Never self
  }
  for (const ex of exclusions) {
    forbidden.add(`${ex.giver_id}->${ex.excluded_receiver_id}`);
  }

  const isAllowed = (giver: string, receiver: string): boolean => {
    return !forbidden.has(`${giver}->${receiver}`);
  };

  // Phase 1: Attempt to find a randomized single Hamiltonian cycle (best Secret Santa experience)
  if (n >= 3) {
    const startNode = memberIds[0];
    const visited = new Set<string>([startNode]);
    const path: string[] = [startNode];

    const findCycle = (): boolean => {
      if (path.length === n) {
        const lastNode = path[path.length - 1];
        return isAllowed(lastNode, startNode);
      }

      const currentNode = path[path.length - 1];
      const candidates = shuffleArray(
        memberIds.filter((cand) => !visited.has(cand) && isAllowed(currentNode, cand))
      );

      for (const nextNode of candidates) {
        visited.add(nextNode);
        path.push(nextNode);
        if (findCycle()) return true;
        path.pop();
        visited.delete(nextNode);
      }
      return false;
    };

    if (findCycle()) {
      const result: Record<string, string> = {};
      for (let i = 0; i < n; i++) {
        result[path[i]] = path[(i + 1) % n];
      }
      return result;
    }
  }

  // Phase 2: Fallback to general valid derangement (perfect matching where nobody is left without giving or receiving)
  // Order givers by most constrained first (fewest allowed receivers) to prune search tree fast
  const givers = [...memberIds].sort((a, b) => {
    const countA = memberIds.filter((r) => isAllowed(a, r)).length;
    const countB = memberIds.filter((r) => isAllowed(b, r)).length;
    return countA - countB;
  });

  const assignedReceivers = new Set<string>();
  const assignment: Record<string, string> = {};

  const backtrack = (index: number): boolean => {
    if (index === n) {
      return true;
    }

    const giver = givers[index];
    const candidates = shuffleArray(
      memberIds.filter((r) => !assignedReceivers.has(r) && isAllowed(giver, r))
    );

    for (const receiver of candidates) {
      assignment[giver] = receiver;
      assignedReceivers.add(receiver);
      if (backtrack(index + 1)) {
        return true;
      }
      assignedReceivers.delete(receiver);
      delete assignment[giver];
    }

    return false;
  };

  if (backtrack(0)) {
    return assignment;
  }

  return null;
}
