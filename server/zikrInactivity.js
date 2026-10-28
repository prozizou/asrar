const crypto = require('crypto');
const { httpError } = require('./access');
const { ZIKR_WARNING_GRACE_MS, warningExpired, isActiveZikrMember } = require('../lib/zikrWarning');

async function warnParticipant(db, gid, uid, author, message, now = Date.now()) {
  const id = crypto.randomUUID();
  const ref = db.ref(`zikr_members/${gid}/${uid}`);
  const provisionalTask = db.ref(`zikr_inactivity/${id}`);
  // Préparer la tâche AVANT l'avertissement évite un avis durable sans
  // nettoyage planifié après une panne. Une tâche sans avis reste sans effet.
  await provisionalTask.set({ gid, uid, id, deadline: now + ZIKR_WARNING_GRACE_MS });
  const tx = await ref.transaction((member) => {
    if (!isActiveZikrMember(member)) return member;
    // Répéter un avertissement ne repousse pas l'échéance existante.
    const warning = member.warning || { id, at: now, deadline: now + ZIKR_WARNING_GRACE_MS, fait: Number(member.fait) || 0 };
    return { ...member, avertissement: message, warning: { ...warning, by: author } };
  });
  const member = tx.snapshot.val();
  if (!isActiveZikrMember(member)) throw httpError(404, "Ce compte n'est plus dans le groupe.");
  const warning = member.warning;
  // Une entrée par avertissement : un ancien traitement ne peut pas supprimer
  // la tâche d'un nouvel avertissement reçu après une reprise d'activité.
  if (warning.id !== id) {
    await db.ref(`zikr_inactivity/${warning.id}`).set({ gid, uid, id: warning.id, deadline: warning.deadline });
    await provisionalTask.remove().catch(() => {});
  }
  return warning;
}

async function processZikrInactivity(db, now = Date.now()) {
  const stats = { removed: 0, skipped: 0 };
  const stopAt = Date.now() + 30000;
  for (let batch = 0; batch < 20 && Date.now() < stopAt; batch++) {
    const snap = await db.ref('zikr_inactivity').orderByChild('deadline').endAt(now - 1).limitToFirst(50).once('value');
    const jobs = []; snap.forEach((job) => { jobs.push({ ...job.val(), key: job.key }); });
    for (const job of jobs) {
      if (Date.now() >= stopAt) return stats;
      const task = db.ref(`zikr_inactivity/${job.key}`);
      const groupRef = db.ref(`zikr_groups/${job.gid}`);
      const group = (await groupRef.once('value')).val();
      if (!group) {
        await task.remove(); stats.skipped++; continue;
      }
      const ref = db.ref(`zikr_members/${job.gid}/${job.uid}`);
      const tx = await ref.transaction((member) => {
        if (!member) return null;
        if (member.removalId === job.id) return member;
        if (group.ownerUid === job.uid || (Number(group.total) || 0) >= Number(group.target)) return member;
        if (member.removalId || member.warning?.id !== job.id || !warningExpired(member, now)) return member;
        return { ...member, removalId: job.id };
      });
      const member = tx.snapshot.val();
      if (member?.removalId !== job.id) {
        if (member?.warning?.id === job.id && (group.ownerUid === job.uid || (Number(group.total) || 0) >= Number(group.target))) {
          await ref.transaction((current) => current?.warning?.id === job.id && !current.removalId ? { ...current, warning: null, avertissement: null } : current);
        }
        await task.remove(); stats.skipped++; continue;
      }
      // Le marqueur de retrait est durable : reprise après panne et passages
      // concurrents ne décrémentent le compteur qu'une fois. Le total récité
      // n'est jamais modifié. Une réadhésion attend la fin de ce retrait.
      const counted = await groupRef.transaction((current) => {
        if (!current) return null;
        if (current.ownerUid === job.uid) return;
        if ((Number(current.total) || 0) >= Number(current.target) && !current.membershipRemovals?.[job.id]) return;
        if (current.membershipRemovals?.[job.id]) return current;
        return { ...current, membersCount: Math.max(1, (Number(current.membersCount) || 1) - 1),
          membershipRemovals: { ...(current.membershipRemovals || {}), [job.id]: true } };
      });
      const latest = counted.snapshot.val();
      if (latest && !latest.membershipRemovals?.[job.id]) {
        await ref.transaction((current) => current?.removalId === job.id ? { ...current, removalId: null, warning: null, avertissement: null } : current);
        await task.remove(); stats.skipped++; continue;
      }
      await ref.transaction((current) => current?.removalId === job.id ? null : current);
      await task.remove(); stats.removed++;
    }
    if (jobs.length < 50) break;
  }
  return stats;
}

module.exports = { warnParticipant, processZikrInactivity };
