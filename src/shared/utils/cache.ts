// Simple LRU (Least Recently Used) Cache implementation for performance optimization

interface CacheNode<T> {
  key: string;
  value: T;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
}

export class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, CacheNode<T>>;
  private head: CacheNode<T> | null;
  private tail: CacheNode<T> | null;

  constructor(capacity: number = 100) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
  }

  get(key: string): T | undefined {
    const node = this.cache.get(key);
    if (!node) return undefined;

    // Move to front (most recently used)
    this.moveToFront(node);
    return node.value;
  }

  set(key: string, value: T): void {
    const existingNode = this.cache.get(key);
    
    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      this.moveToFront(existingNode);
    } else {
      // Create new node
      const newNode: CacheNode<T> = {
        key,
        value,
        prev: null,
        next: null
      };

      this.cache.set(key, newNode);
      this.addToFront(newNode);

      // Check capacity
      if (this.cache.size > this.capacity) {
        this.removeLast();
      }
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  size(): number {
    return this.cache.size;
  }

  private moveToFront(node: CacheNode<T>): void {
    this.removeNode(node);
    this.addToFront(node);
  }

  private addToFront(node: CacheNode<T>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: CacheNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private removeLast(): void {
    if (!this.tail) return;

    const lastNode = this.tail;
    this.removeNode(lastNode);
    this.cache.delete(lastNode.key);
  }
}

// Global cache instances for different data types
export const itemCache = new LRUCache<any>(200);
export const customerCache = new LRUCache<any>(100);
export const supplierCache = new LRUCache<any>(100);
export const accountCache = new LRUCache<any>(50);