// lib/dagValidator.ts
/**
 * Simple cycle detection for a directed graph.
 * Graph is represented as adjacency list: Record<nodeId, string[]>.
 */
export function detectCycle(graph: Record<string, string[]>): boolean {
  const visited = new Set<string>();
  const recStack = new Set<string>();

  const dfs = (node: string): boolean => {
    if (!visited.has(node)) {
      visited.add(node);
      recStack.add(node);
      const neighbours = graph[node] ?? [];
      for (const neighbour of neighbours) {
        if (!visited.has(neighbour) && dfs(neighbour)) {
          return true;
        } else if (recStack.has(neighbour)) {
          return true;
        }
      }
    }
    recStack.delete(node);
    return false;
  };

  for (const node of Object.keys(graph)) {
    if (dfs(node)) {
      return true; // cycle found
    }
  }
  return false; // no cycles
}
