class TodoUiState {
  showTodoNumbers = $state(false);

  toggleTodoNumbers() {
    this.showTodoNumbers = !this.showTodoNumbers;
  }
}

export const todoUiState = new TodoUiState();
