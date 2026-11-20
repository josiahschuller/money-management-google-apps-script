/**
 * Shared configuration for the money-management script.
 *
 * Everything here used to be a hardcoded global (sheet objects, a
 * spreadsheet ID, magic row/column numbers). Keeping it in one place
 * makes the script follow whichever spreadsheet it is bound to and
 * makes the layout of the logs explicit.
 */
const Config = {
  SHEET_NAMES: {
    REVENUE: 'Revenue Log',
    EXPENSE: 'Expense Log',
    MISSED: 'Missed Log',
  },

  // Logs have a header row; data starts at row 2, newest first.
  FIRST_DATA_ROW: 2,
  DATE_COL: 1,
  DESCRIPTION_COL: 2,
  // Column C is unused, but rows are written as [date, description, null, amount].
  AMOUNT_COL: 4,
  TRANSACTION_ROW_WIDTH: 4,

  // Fallback start date when both logs are empty (e.g. first run on a
  // new spreadsheet), instead of failing. Adjust to taste.
  DEFAULT_START_DATE: new Date(2024, 0, 1),

  // Script properties holding the Up API credentials.
  UP_ACCESS_TOKEN_PROPERTY: 'UP_ACCESS_TOKEN',
  UP_ACCOUNT_ID_PROPERTY: 'UP_2UP_ACCOUNT_ID',
};

/**
 * Returns the spreadsheet this script is bound to.
 * Throws a clear error if run outside a container-bound context
 * (e.g. from a standalone script), since there is no active sheet.
 */
function getSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error(
      'No active spreadsheet. This script must be run from a spreadsheet ' +
      'it is bound to (Extensions > Apps Script), not as a standalone project.'
    );
  }
  return spreadsheet;
}

/**
 * Returns a sheet by name from the active spreadsheet, or throws a
 * clear error if it does not exist.
 */
function getSheet(name) {
  const sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error(
      `Sheet not found: "${name}". Expected sheets: ` +
      Object.values(Config.SHEET_NAMES).join(', ')
    );
  }
  return sheet;
}
