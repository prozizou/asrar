const crypto = require("crypto");
const { httpError } = require("./access");

async function approveMember(db, gid, uid) {
  const memberRef = db.ref(`zikr_members/${gid}/${uid}`);
  const requestRef = db.ref(`zikr_requests/${gid}/${uid}`);
  const request = (await requestRef.once("value")).val();
  if (!request) {
    if ((await memberRef.once("value")).exists()) return;
    throw httpError(404, "Demande introuvable (déjà traitée ?).");
  }
  const now = Date.now();
  const approvalId = crypto.randomUUID();
  const tx = await memberRef.transaction((member) => member || {
    email: request.email || "", name: request.name || "", picture: request.picture || "", phone: request.phone || "",
    fait: 0, rythme: 0, joinedAt: now, updatedAt: now, lastSeenAt: now, approvalId,
  });
  const member = tx.snapshot.val();
  if (member?.approvalId) {
    const counted = await db.ref(`zikr_groups/${gid}`).transaction((group) => {
      if (!group) return null;
      if (group.membershipApplied?.[member.approvalId]) return group;
      return {
        ...group, membersCount: (Number(group.membersCount) || 0) + 1,
        membershipApplied: { ...(group.membershipApplied || {}), [member.approvalId]: true },
      };
    });
    if (!counted.snapshot.exists()) throw httpError(404, "Zikr collectif introuvable.");
  }
  await requestRef.remove();
}

module.exports = { approveMember };
