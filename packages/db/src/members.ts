import { asc, eq, inArray } from "drizzle-orm";
import { type Database, members } from "./schema.ts";
import type { Member, MemberRole } from "./shared.ts";

type MemberRow = typeof members.$inferSelect;

function toMember(row: MemberRow): Member {
  return {
    email: row.email,
    id: String(row.id),
    joinedAt: row.joinedAt,
    name: row.name,
    role: row.role,
  };
}

/** Members ordered by join date, oldest first. */
export async function listMembers(db: Database): Promise<Member[]> {
  const rows = await db.select().from(members).orderBy(asc(members.name));
  return rows.map(toMember);
}

export async function getMember(
  db: Database,
  id: string
): Promise<Member | null> {
  const [row] = await db
    .select()
    .from(members)
    .where(eq(members.id, Number(id)))
    .limit(1);
  return row ? toMember(row) : null;
}

/** The members among `ids` that exist. Unknown ids are left out. */
export async function getMembersByIds(
  db: Database,
  ids: string[]
): Promise<Member[]> {
  if (ids.length === 0) {
    return [];
  }
  const rows = await db
    .select()
    .from(members)
    .where(inArray(members.id, ids.map(Number)));
  return rows.map(toMember);
}

export async function getMemberByEmail(
  db: Database,
  email: string
): Promise<Member | null> {
  const [row] = await db
    .select()
    .from(members)
    .where(eq(members.email, email))
    .limit(1);
  return row ? toMember(row) : null;
}

export async function createMember(
  db: Database,
  input: { email: string; name: string; role: MemberRole }
): Promise<Member> {
  const [row] = await db
    .insert(members)
    .values({ ...input, joinedAt: new Date().toISOString() })
    .returning();
  if (!row) {
    throw new Error("Member was inserted but could not be read back.");
  }
  return toMember(row);
}

export async function updateMemberRole(
  db: Database,
  id: string,
  role: MemberRole
): Promise<Member | null> {
  const [row] = await db
    .update(members)
    .set({ role })
    .where(eq(members.id, Number(id)))
    .returning();
  return row ? toMember(row) : null;
}
