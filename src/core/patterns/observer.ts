// Observer Pattern - Defines a subscription mechanism to notify multiple objects about any events

export interface Observer<T> {
  update(data: T): void;
}

export interface Subject<T> {
  subscribe(observer: Observer<T>): void;
  unsubscribe(observer: Observer<T>): void;
  notify(data: T): void;
}

export class EventManager<T> implements Subject<T> {
  private observers: Observer<T>[] = [];

  subscribe(observer: Observer<T>): void {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
  }

  unsubscribe(observer: Observer<T>): void {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
    }
  }

  notify(data: T): void {
    this.observers.forEach(observer => observer.update(data));
  }

  getObserverCount(): number {
    return this.observers.length;
  }

  clear(): void {
    this.observers = [];
  }
}

// Example: Stock Level Observer
export interface StockLevelEvent {
  itemId: string;
  itemName: string;
  currentLevel: number;
  threshold: number;
  timestamp: Date;
}

export class StockLevelObserver implements Observer<StockLevelEvent> {
  constructor(private notificationService: any) {}

  update(event: StockLevelEvent): void {
    if (event.currentLevel <= event.threshold) {
      this.notificationService.sendAlert({
        type: 'LOW_STOCK',
        message: `Item ${event.itemName} is below threshold`,
        data: event
      });
    }
  }
}

// Example: Sync Status Observer
export interface SyncStatusEvent {
  status: 'online' | 'offline' | 'syncing' | 'error';
  pendingCount: number;
  lastSyncedAt: string | null;
}

export class SyncStatusObserver implements Observer<SyncStatusEvent> {
  constructor(private uiUpdater: any) {}

  update(event: SyncStatusEvent): void {
    this.uiUpdater.updateSyncStatus(event);
  }
}

// Example: Data Change Observer
export interface DataChangeEvent<T extends { id?: string }> {
  entityType: string;
  action: 'create' | 'update' | 'delete';
  entity: T;
  timestamp: Date;
}

export class DataChangeObserver<T extends { id?: string }> implements Observer<DataChangeEvent<T>> {
  private cache: Map<string, T> = new Map();

  update(event: DataChangeEvent<T>): void {
    const cacheKey = `${event.entityType}_${event.entity.id || 'temp'}`;
    
    switch (event.action) {
      case 'create':
      case 'update':
        this.cache.set(cacheKey, event.entity);
        break;
      case 'delete':
        this.cache.delete(cacheKey);
        break;
    }
  }

  getCachedItem(entityType: string, id: string): T | undefined {
    return this.cache.get(`${entityType}_${id}`);
  }
}