export interface RealtimeSubscriber {
  id: string;
  userId: string;
  coupleId: string | null;
  send: (event: string, data: unknown) => void;
}

interface RealtimeHub {
  subscribers: Map<string, RealtimeSubscriber>;
}

const globalForRealtime = globalThis as typeof globalThis & {
  __foreverUsRealtimeHub?: RealtimeHub;
};

function getHub(): RealtimeHub {
  if (!globalForRealtime.__foreverUsRealtimeHub) {
    globalForRealtime.__foreverUsRealtimeHub = {
      subscribers: new Map(),
    };
  }
  return globalForRealtime.__foreverUsRealtimeHub;
}

export function addSubscriber(sub: RealtimeSubscriber): () => void {
  const hub = getHub();
  hub.subscribers.set(sub.id, sub);
  return () => {
    hub.subscribers.delete(sub.id);
  };
}

export function emitToCouple(
  coupleId: string,
  event: string,
  data: unknown,
  excludeUserId?: string
): void {
  const hub = getHub();
  for (const sub of hub.subscribers.values()) {
    if (sub.coupleId === coupleId && sub.userId !== excludeUserId) {
      try {
        sub.send(event, data);
      } catch {
        hub.subscribers.delete(sub.id);
      }
    }
  }
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  const hub = getHub();
  for (const sub of hub.subscribers.values()) {
    if (sub.userId === userId) {
      try {
        sub.send(event, data);
      } catch {
        hub.subscribers.delete(sub.id);
      }
    }
  }
}

export function isUserConnectedRealtime(userId: string): boolean {
  const hub = getHub();
  for (const sub of hub.subscribers.values()) {
    if (sub.userId === userId) return true;
  }
  return false;
}
