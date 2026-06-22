// @ts-nocheck
class PersistenceRegistry {
  constructor() {
    this.documents = new Set();
  }

  register(document) {
    this.documents.add(document);
    return () => this.documents.delete(document);
  }

  async flushAll() {
    const results = await Promise.all([...this.documents].map((document) => document.flushSave()));
    return results.every(Boolean);
  }

  async checkActive(activeView) {
    const document = [...this.documents].find((item) => item.view === activeView);
    return document ? await document.checkExternalChanges() : false;
  }
}

export const persistenceRegistry = new PersistenceRegistry();
