import type { Sql } from "./db.ts";
import { personFrom } from "./store.ts";

// A share is visible to every account reachable through accepted requests, not
// just direct contacts. Pending/rejected requests never grant access.
export async function connectedAccounts(db: Sql, userId: string) {
  const links = await db.all(
    "SELECT sender_id,recipient_id FROM family_link_requests WHERE status='accepted'",
  );
  const connected = new Set([userId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const link of links) {
      if (connected.has(link.sender_id) && !connected.has(link.recipient_id)) {
        connected.add(link.recipient_id);
        changed = true;
      }
      if (connected.has(link.recipient_id) && !connected.has(link.sender_id)) {
        connected.add(link.sender_id);
        changed = true;
      }
    }
  }
  return connected;
}

export async function sharedTree(db: Sql, userId: string) {
  const connected = await connectedAccounts(db, userId);
  const shared = await db.all(
    "SELECT s.user_id,p.*,u.username FROM shared_tree_people s JOIN people p ON p.id=s.person_id JOIN app_users u ON u.id=s.user_id JOIN app_family_members m ON m.user_id=s.user_id AND m.family_id=p.family_id",
  );
  const visible = shared.filter(
    (row) => row.user_id !== userId && connected.has(row.user_id),
  );
  const unique = new Map<string, (typeof visible)[number]>();
  for (const row of visible) if (!unique.has(row.id)) unique.set(row.id, row);
  const people = [...unique.values()].map((row) => ({
    ...personFrom(row),
    candidateIds: [],
    sharedBy: row.username,
  }));
  const ids = new Set(people.map((p) => p.id));
  const relations = await db.all(
    "SELECT id,person_a,person_b,type,claim_id FROM relationships UNION ALL SELECT id,person_a,person_b,type,claim_id FROM document_relationships",
  );
  const relationships = relations
    .filter((r) => ids.has(r.person_a) && ids.has(r.person_b))
    .map((r) => ({
      id: r.id,
      fromId: r.person_a,
      toId: r.person_b,
      type: r.type,
      claimId: r.claim_id,
    }));
  return { people, relationships };
}
