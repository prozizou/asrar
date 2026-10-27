const MAX_PER_USER = 200;

async function storeNotification(db, uid, record) {
  const ref = db.ref("notifications/" + uid);
  const key = ref.push().key;
  // Insertion et purge partagent la même transaction. Une publication
  // concurrente ne peut pas être effacée par une lecture-écriture périmée.
  await ref.transaction((current) => {
    const items = { ...(current || {}), [key]: record };
    const keys = Object.keys(items).sort((a, b) =>
      (items[a].createdAt || 0) - (items[b].createdAt || 0) || a.localeCompare(b));
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_PER_USER))) delete items[old];
    return items;
  });
  return key;
}

module.exports = { storeNotification, MAX_PER_USER };
