import { test } from "node:test";
import assert from "node:assert/strict";
import { familyGraph } from "../../mobile/src/components/family-graph.ts";
import type { Person, Relationship } from "@raices/shared";

const people: Person[] = ["father", "mother", "first", "second", "other"].map(
  (id) => ({ id, name: id, aliases: [], candidateIds: [] }),
);
const relation = (
  fromId: string,
  toId: string,
  type: string,
): Relationship => ({
  id: `${fromId}-${toId}-${type}`,
  fromId,
  toId,
  type,
  claimId: "claim",
});

test("dibuja la familia cuando las relaciones están en inglés", () => {
  const graph = familyGraph(people, [
    relation("first", "father", "son"),
    relation("first", "mother", "son"),
    relation("first", "second", "brother"),
  ]);
  assert.deepEqual([...graph.parentsByChild.get("first")!].sort(), [
    "father",
    "mother",
  ]);
  assert.deepEqual([...graph.parentsByChild.get("second")!].sort(), [
    "father",
    "mother",
  ]);
  assert.equal(graph.inferredSiblingParents, true);
});

test("no deduce los padres cuando hay conjuntos contradictorios", () => {
  const graph = familyGraph(people, [
    relation("first", "father", "hijo"),
    relation("second", "other", "hija"),
    relation("first", "second", "hermana"),
  ]);
  assert.deepEqual([...graph.parentsByChild.get("second")!], ["other"]);
  assert.equal(graph.inferredSiblingParents, false);
});
