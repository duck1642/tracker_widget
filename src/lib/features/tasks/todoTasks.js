/**
 * @param {number} [indent]
 */
export function createTask(indent = 0) {
  const newId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  return {
    id: newId,
    isTask: true,
    checked: false,
    text: "",
    indent
  };
}
