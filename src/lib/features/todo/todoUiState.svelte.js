// @ts-nocheck
class TodoUiState {
  showTodoNumbers = $state(false);
  selectedTodoIds = $state([]);
  selectionAnchorId = $state("");

  toggleTodoNumbers() {
    this.showTodoNumbers = !this.showTodoNumbers;
  }

  get hasSelection() {
    return this.selectedTodoIds.length > 0;
  }

  isSelected(id) {
    return this.selectedTodoIds.includes(id);
  }

  clearSelection() {
    this.selectedTodoIds = [];
    this.selectionAnchorId = "";
  }

  setSelection(ids, anchorId = "") {
    this.selectedTodoIds = [...new Set(ids)];
    this.selectionAnchorId = anchorId;
  }

  setAnchor(id) {
    this.selectionAnchorId = id;
  }

  toggleSelection(id) {
    this.selectedTodoIds = this.isSelected(id)
      ? this.selectedTodoIds.filter((item) => item !== id)
      : [...this.selectedTodoIds, id];
    this.selectionAnchorId = id;
  }

  selectRange(visibleTodoIds, id) {
    const anchorId = this.selectionAnchorId || id;
    const anchorIndex = visibleTodoIds.indexOf(anchorId);
    const targetIndex = visibleTodoIds.indexOf(id);
    if (anchorIndex === -1 || targetIndex === -1) {
      this.setSelection([id], id);
      return;
    }
    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);
    this.setSelection(visibleTodoIds.slice(start, end + 1), anchorId);
  }

  pruneSelection(existingTodoIds) {
    const existing = new Set(existingTodoIds);
    const nextSelected = this.selectedTodoIds.filter((id) => existing.has(id));
    const nextAnchor = existing.has(this.selectionAnchorId) ? this.selectionAnchorId : "";
    if (nextSelected.length !== this.selectedTodoIds.length) {
      this.selectedTodoIds = nextSelected;
    }
    if (nextAnchor !== this.selectionAnchorId) {
      this.selectionAnchorId = nextAnchor;
    }
  }
}

export const todoUiState = new TodoUiState();
