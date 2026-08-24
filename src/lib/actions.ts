export function confirmDeletion(message: string) {
  return window.confirm(`${message}\n\nEssa ação não pode ser desfeita.`);
}

