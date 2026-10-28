export const ZIKR_WARNING_DAYS = 7;
export const ZIKR_WARNING_GRACE_MS = ZIKR_WARNING_DAYS * 86400000;
export const ZIKR_WARNING_MAX = 4000;

export function isActiveZikrMember(member) { return !!member && !member.removalId; }

export function warningExpired(member, now) {
  const warning = member?.warning;
  return !!warning && Number(warning.deadline) < now &&
    (Number(member.fait) || 0) <= (Number(warning.fait) || 0);
}

export function zikrWarningMessage(group, member) {
  const fmt = (value) => (Number(value) || 0).toLocaleString('fr-FR');
  const remaining = Math.max(0, (Number(group.target) || 0) - (Number(group.total) || 0));
  const deadline = Number(member.warning?.deadline) || 0;
  const notice = deadline
    ? `Sans nouvelle récitation enregistrée, votre participation sera retirée après le ${new Date(deadline).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC, échéance du premier avertissement.`
    : 'Sans nouvelle récitation enregistrée dans les 7 jours suivant cet avertissement, votre participation sera retirée de ce groupe.';
  return [
    `Assalamou aleykoum ${member.name || member.email || ''},`,
    `Concernant le Zikr collectif « ${group.name || 'Zikr collectif'} » sur ASRAR PRO :`,
    '',
    `Formule à réciter : ${group.arabic || group.transliteration || ''}`,
    'Méthode : ouvrez ASRAR PRO → Zikr → ce groupe → onglet Zikr. Récitez la formule et utilisez le compteur pour chaque récitation. Gardez une connexion pour enregistrer votre progression.',
    '',
    `Votre participation : ${fmt(member.fait)} grains.`,
    `Progression du groupe : ${fmt(group.total)} / ${fmt(group.target)} grains.`,
    `Il reste ${fmt(remaining)} grains à réciter ensemble.`,
    '',
    `Merci de reprendre votre participation. ${notice} Votre compte ASRAR et les grains déjà comptabilisés sont conservés.`,
  ].join('\n');
}
