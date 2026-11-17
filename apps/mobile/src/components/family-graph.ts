import type { Person, Relationship } from "@raices/shared";

export type FamilyGraph = {
  parentsByChild: Map<string, Set<string>>;
  partners: [string, string][];
  inferredSiblingParents: boolean;
};

export function familyGraph(
  people: Person[],
  relationships: Relationship[],
): FamilyGraph {
  const ids = new Set(people.map((person) => person.id));
  const parentsByChild = new Map<string, Set<string>>();
  const partners = new Map<string, [string, string]>();
  const siblings: [string, string][] = [];
  for (const relation of relationships) {
    if (
      !ids.has(relation.fromId) ||
      !ids.has(relation.toId) ||
      relation.fromId === relation.toId
    )
      continue;
    const kind = relation.type
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/^(es |su )/, "");
    let parent: string | undefined;
    let child: string | undefined;
    if (
      /^(padre|madre|progenitor(?:a)?|father|mother|parent)(?:\b|$)/.test(kind)
    ) {
      [parent, child] = [relation.fromId, relation.toId];
    } else if (/^(hijo|hija|son|daughter|child)(?:\b|$)/.test(kind)) {
      [parent, child] = [relation.toId, relation.fromId];
    } else if (
      /^(pareja|conyuge|espos[oa]|marido|mujer|casad[oa]|partner|spouse|husband|wife)(?:\b|$)/.test(
        kind,
      )
    ) {
      const pair = [relation.fromId, relation.toId].sort() as [string, string];
      partners.set(pair.join("|"), pair);
    } else if (/^(hermano|hermana|brother|sister|sibling)(?:\b|$)/.test(kind)) {
      siblings.push([relation.fromId, relation.toId]);
    }
    if (parent && child) {
      const parents = parentsByChild.get(child) || new Set<string>();
      parents.add(parent);
      parentsByChild.set(child, parents);
    }
  }
  // Sibling links provide a possible shared branch, not proof of parentage.
  // Only extend an unambiguous recorded parent set to siblings with no parents.
  let inferredSiblingParents = false;
  const adjacent = new Map<string, Set<string>>();
  for (const [a, b] of siblings) {
    if (!adjacent.has(a)) adjacent.set(a, new Set());
    if (!adjacent.has(b)) adjacent.set(b, new Set());
    adjacent.get(a)!.add(b);
    adjacent.get(b)!.add(a);
  }
  const visited = new Set<string>();
  for (const id of adjacent.keys()) {
    if (visited.has(id)) continue;
    const queue = [id],
      group: string[] = [];
    visited.add(id);
    while (queue.length) {
      const member = queue.pop()!;
      group.push(member);
      for (const next of adjacent.get(member) || [])
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
    }
    const known = group
      .map((member) => parentsByChild.get(member))
      .filter(
        (parents): parents is Set<string> => !!parents && parents.size > 0,
      );
    const sets = new Map(
      known.map((parents) => [[...parents].sort().join("|"), parents]),
    );
    if (sets.size !== 1) continue;
    const shared = [...sets.values()][0];
    for (const member of group)
      if (!parentsByChild.has(member) && !shared.has(member)) {
        parentsByChild.set(member, new Set(shared));
        inferredSiblingParents = true;
      }
  }
  return {
    parentsByChild,
    partners: [...partners.values()],
    inferredSiblingParents,
  };
}
