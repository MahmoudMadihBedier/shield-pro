// Command Pattern - Encapsulates requests as objects

export interface Command<T = any> {
  execute(): Promise<T>;
  undo?(): Promise<void>;
  canExecute?(): boolean;
}

export class CommandInvoker {
  private commandHistory: Command[] = [];
  private currentIndex: number = -1;

  async executeCommand<T>(command: Command<T>): Promise<T> {
    if (command.canExecute && !command.canExecute()) {
      throw new Error('Command cannot be executed');
    }

    const result = await command.execute();
    
    // Remove any commands after current index (for redo)
    this.commandHistory = this.commandHistory.slice(0, this.currentIndex + 1);
    this.commandHistory.push(command);
    this.currentIndex++;

    return result;
  }

  async undo(): Promise<void> {
    if (this.currentIndex < 0) {
      throw new Error('No commands to undo');
    }

    const command = this.commandHistory[this.currentIndex];
    if (command.undo) {
      await command.undo();
    }
    this.currentIndex--;
  }

  async redo(): Promise<void> {
    if (this.currentIndex >= this.commandHistory.length - 1) {
      throw new Error('No commands to redo');
    }

    this.currentIndex++;
    const command = this.commandHistory[this.currentIndex];
    await command.execute();
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.commandHistory.length - 1;
  }

  clearHistory(): void {
    this.commandHistory = [];
    this.currentIndex = -1;
  }
}

// Example command implementations
export class CreateItemCommand implements Command<any> {
  constructor(
    private itemRepository: any,
    private itemData: any
  ) {}

  async execute() {
    return await this.itemRepository.create(this.itemData);
  }

  async undo() {
    const createdItem = await this.execute();
    await this.itemRepository.delete(createdItem.id);
  }

  canExecute(): boolean {
    return !!this.itemData.name;
  }
}

export class UpdateItemCommand implements Command<any> {
  constructor(
    private itemRepository: any,
    private itemId: string,
    private updates: any
  ) {}

  private previousState: any = null;

  async execute() {
    this.previousState = await this.itemRepository.findById(this.itemId);
    return await this.itemRepository.update(this.itemId, this.updates);
  }

  async undo() {
    if (this.previousState) {
      await this.itemRepository.update(this.itemId, this.previousState);
    }
  }

  canExecute(): boolean {
    return !!this.itemId && !!this.updates;
  }
}