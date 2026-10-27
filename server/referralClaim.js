const POINTS_PER_INVITE = 10;

async function claimReferral(db, uid, sponsor, isFresh) {
  const ref = db.ref(`referred/${uid}`);
  const existing = (await ref.once("value")).val();
  if (existing && (existing.by !== sponsor || existing.credited)) {
    return { credited: false, reason: "deja_parraine" };
  }
  // Une panne de l'annuaire ne doit pas rendre définitivement inéligible
  // un nouveau compte. Ne réserver qu'après vérification réussie.
  if (!existing?.eligible && !(await isFresh())) return { credited: false, reason: "compte_existant" };
  const reserved = await ref.transaction((current) => {
    if (current?.by && current.by !== sponsor) return current;
    return { ...(current || { by: sponsor, at: Date.now(), credited: false }), eligible: true };
  });
  const entry = reserved.snapshot.val();
  if (entry.by !== sponsor) return { credited: false, reason: "deja_parraine" };
  await db.ref(`referrals/${sponsor}`).transaction((value) => {
    const account = value || {};
    if (account.creditedReferrals?.[uid]) return account;
    return {
      ...account,
      points: (Number(account.points) || 0) + POINTS_PER_INVITE,
      invited: (Number(account.invited) || 0) + 1, lastAt: Date.now(),
      creditedReferrals: { ...(account.creditedReferrals || {}), [uid]: true },
    };
  });
  await ref.update({ credited: true, points: POINTS_PER_INVITE });
  return { credited: true, points: POINTS_PER_INVITE };
}

module.exports = { claimReferral, POINTS_PER_INVITE };
