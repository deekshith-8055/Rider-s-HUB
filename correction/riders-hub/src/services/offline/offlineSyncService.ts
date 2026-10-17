import type { OfflineQueueItem } from '../../types';
import { generateId } from '../../utils/format';

const QUEUE_KEY = 'ridershub_offline_queue_v1';

type FlushHandler = (item: OfflineQueueItem) => Promise<void>;
type QueueListener = (queue: OfflineQueueItem[]) => void;

/**
 * offlineSyncService: a small, storage-backed write queue.
 *
 * Any write that should survive a dropped connection (GPS points, chat
 * messages, status updates, ride events) is enqueued here first. When the
 * browser reports `online` again, the queue is flushed in order through a
 * registered handler (normally `api.*` calls).
 */
class OfflineSyncService {
  private queue: OfflineQueueItem[] = [];
  private handler: FlushHandler | null = null;
  private listeners: QueueListener[] = [];
  private flushing = false;

  constructor() {
    this.queue = this.load();
    window.addEventListener('online', () => this.flush());
  }

  private load(): OfflineQueueItem[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? (JSON.parse(raw) as OfflineQueueItem[]) : [];
    } catch {
      return [];
    }
  }

  private persist() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // storage unavailable — queue stays in memory for this session
    }
  }

  registerHandler(handler: FlushHandler) {
    this.handler = handler;
    if (navigator.onLine) this.flush();
  }

  onChange(cb: QueueListener) {
    this.listeners.push(cb);
    cb(this.queue);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private emit() {
    this.listeners.forEach((cb) => cb(this.queue));
  }

  enqueue(kind: OfflineQueueItem['kind'], payload: unknown) {
    const item: OfflineQueueItem = { id: generateId('q'), kind, payload, createdAt: Date.now() };
    this.queue.push(item);
    this.persist();
    this.emit();
    if (navigator.onLine) this.flush();
    return item;
  }

  get size() {
    return this.queue.length;
  }

  async flush() {
    if (this.flushing || !this.handler || this.queue.length === 0) return;
    this.flushing = true;
    try {
      while (this.queue.length > 0 && navigator.onLine) {
        const item = this.queue[0];
        await this.handler(item);
        this.queue.shift();
        this.persist();
        this.emit();
      }
    } finally {
      this.flushing = false;
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
