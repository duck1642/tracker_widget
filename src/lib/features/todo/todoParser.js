/**
 * Parses a markdown string into a flat list of todo objects and raw lines.
 * Handles todos (lines starting with "- [ ]" or "- [x]") and their indentation.
 * Preserves non-todo lines (headers, notes, empty lines) to avoid data loss.
 *
 * @param {string} markdown - The markdown content.
 * @returns {any[]} List of line objects.
 */
export function markdownToTodos(markdown) {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);
  
  // Keep track of the last element to handle trailing newlines gracefully
  const hasTrailingNewline = lines.length > 1 && lines[lines.length - 1] === "";
  const linesToParse = hasTrailingNewline ? lines.slice(0, -1) : lines;
  
  return linesToParse.map((line) => {
    const match = line.match(/^(\s*)-\s+\[([ xX])\]\s*(.*)$/);
    const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    
    if (match) {
      const leadingWhitespace = match[1];
      const checkChar = match[2];
      const text = match[3];
      
      // Standardize indent levels (usually 2 spaces per tab/level)
      let spaces = 0;
      for (let i = 0; i < leadingWhitespace.length; i++) {
        if (leadingWhitespace[i] === "\t") {
          spaces += 2;
        } else {
          spaces += 1;
        }
      }
      const indent = Math.max(0, Math.floor(spaces / 2));
      
      return {
        id,
        isTodo: true,
        checked: checkChar.toLowerCase() === "x",
        text: text,
        indent: indent
      };
    } else {
      return {
        id,
        isTodo: false,
        raw: line
      };
    }
  });
}

/**
 * Converts a list of line objects back to a markdown string.
 *
 * @param {any[]} todos - The line objects.
 * @returns {string} The markdown content.
 */
export function todosToMarkdown(todos) {
  if (!todos || todos.length === 0) return "";
  return todos.map((todo) => {
    if (todo.isTodo) {
      const indentSpaces = "  ".repeat(todo.indent);
      const checkChar = todo.checked ? "x" : " ";
      return `${indentSpaces}- [${checkChar}] ${todo.text}`;
    } else {
      return todo.raw;
    }
  }).join("\n") + "\n";
}
