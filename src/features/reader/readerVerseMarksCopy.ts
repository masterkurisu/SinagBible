/** Reader highlights, underlines, and per-verse notes — shared user-facing copy. */
export const READER_ANNOTATIONS_PHRASE = "highlights, underlines, and notes";

/** Full local backup scope (journal + favorites + reader annotations). */
export const READER_BACKUP_SCOPE_PHRASE = `journal, favorite verses, and ${READER_ANNOTATIONS_PHRASE}`;

export const READER_BACKUP_MENU_SUBTITLE = `Back up or restore your ${READER_BACKUP_SCOPE_PHRASE}.`;

export const READER_BACKUP_IMPORT_PICKER_SUBTITLE =
  `Choose a backup file to restore your ${READER_BACKUP_SCOPE_PHRASE}.`;

export const READER_BACKUP_IMPORT_CONFIRM_BODY =
  `Importing will replace your ${READER_BACKUP_SCOPE_PHRASE} with the contents of the backup file. This cannot be undone.`;

export const READER_BACKUP_IMPORT_ROW_DESCRIPTION = `Replace ${READER_BACKUP_SCOPE_PHRASE}`;

export const READER_DELETE_DATA_BACKUP_REMINDER_BODY =
  `Deleting removes your ${READER_BACKUP_SCOPE_PHRASE} from this device. Export a backup now if you may want them later.`;

export const READER_DELETE_DATA_SETTINGS_DESCRIPTION =
  `Permanently clear your ${READER_ANNOTATIONS_PHRASE} and journal from this device.`;

export const READER_ACTION_BAR_MARK_STEP_DESCRIPTION =
  "Mark verses with a highlighter or underline — straight or squiggly, in light and dark colors.";

export const READER_LONG_PRESS_MARK_HINT =
  "Long press a verse to apply your last mark — highlight or underline.";

export const READER_CLEAR_SELECTION_MARKED_HINT = "Or tap the marked verse again.";
