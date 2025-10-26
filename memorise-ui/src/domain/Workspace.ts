export class Workspace {
  id: string;
  name: string;
  owner: string;
  text: string;
  isTemporary: boolean;
  updatedAt: number;

  constructor(
    id: string,
    name: string,
    owner: string,
    text: string = '',
    isTemporary: boolean = false,
    updatedAt: number = Date.now()
  ) {
    this.id = id;
    this.name = name;
    this.owner = owner;
    this.text = text;
    this.isTemporary = isTemporary;
    this.updatedAt = updatedAt;
  }
  
  // Business methods
  updateText(newText: string): Workspace {
    const updated = new Workspace(
      this.id,
      this.name,
      this.owner,
      newText,
      this.isTemporary,
      Date.now()
    );
    return updated;
  }
  
  markAsPermanent(): Workspace {
    const updated = new Workspace(
      this.id,
      this.name,
      this.owner,
      this.text,
      false,
      this.updatedAt
    );
    return updated;
  }
}
