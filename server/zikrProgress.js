const crypto = require("crypto");
const { normalizeFait, normalizeRythme, utcDateKey } = require("../lib/zikrLogic");
const { httpError } = require("./access");

async function recordProgress(db, gid, uid, rawFait, rawRythme, now = Date.now()) {
  const memberRef = db.ref(`zikr_members/${gid}/${uid}`);
  const epoch = crypto.randomUUID();
  const today = utcDateKey(now);
  const memberTx = await memberRef.transaction((member) => {
    if (!member) return null; // laisse Firebase relire un cache initial vide
    const previous = Number(member.fait) || 0;
    const fait = Math.max(previous, normalizeFait(rawFait));
    const daily = member.daily?.date === today ? Number(member.daily.total) || 0 : 0;
    return {
      ...member,
      // Migration paresseuse : les récitations historiques sont déjà dans
      // le total du groupe. Une réadhésion reçoit une nouvelle génération.
      progressEpoch: member.progressEpoch || epoch,
      progressBase: member.progressBase ?? previous,
      fait, rythme: normalizeRythme(rawRythme), updatedAt: now, lastSeenAt: now,
      daily: { date: today, total: daily + fait - previous },
    };
  });
  const member = memberTx.snapshot.val();
  if (!member) throw httpError(403, "Rejoignez d'abord ce zikr collectif.");

  const totalTx = await db.ref(`zikr_groups/${gid}`).transaction((group) => {
    if (!group) return null;
    const applied = group.progressApplied || {};
    const account = applied[uid] || {};
    const previous = account[member.progressEpoch] ?? member.progressBase;
    const next = Math.max(previous, member.fait);
    // Le total et le repère appliqué sont atomiques. Après une panne entre
    // les deux transactions, le prochain appel rattrape le delta manquant.
    return {
      ...group,
      total: (Number(group.total) || 0) + next - previous,
      progressApplied: { ...applied, [uid]: { ...account, [member.progressEpoch]: next } },
    };
  });
  const group = totalTx.snapshot.val();
  if (!group) throw httpError(404, "Zikr collectif introuvable.");
  return { fait: member.fait, total: Number(group.total) || 0 };
}

module.exports = { recordProgress };
