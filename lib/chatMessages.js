// Firebase push keys use code-point ordering, not locale collation. A stale
// poll must also never replace a newer edit/deletion with an older version.
export function mergeChatMessages(previous, incoming) {
  const map = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) {
    if (!map.has(message.id) || (message.version || 0) >= (map.get(message.id)?.version || 0)) map.set(message.id, message);
  }
  return [...map.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
