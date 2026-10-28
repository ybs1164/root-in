/**
 * Opens `dialog` as a modal without focusing its first text field: showModal()
 * would, and on a phone that pops the keyboard up the moment a form opens
 * (group name, alias, category name). The dialog itself takes focus instead,
 * so Esc and Tab still work; a field is edited only once it's tapped.
 */
export function showModalQuietly(dialog: HTMLDialogElement) {
  if (dialog.open) return;
  dialog.showModal();
  if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
  dialog.focus({ preventScroll: true });
}
