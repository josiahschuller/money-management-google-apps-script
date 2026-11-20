/**
 * Entry point (wired to the menu in Menu.js).
 *
 * Returns a human-readable summary string instead of alerting
 * directly, so it also works headless (e.g. time-driven triggers).
 * The menu wrapper is responsible for showing the result.
 */
function retrieveAndUpdateTransactions() {
  const revenueSheet = getSheet(Config.SHEET_NAMES.REVENUE);
  const expenseSheet = getSheet(Config.SHEET_NAMES.EXPENSE);

  const lastTransactionDate = getMaxDate(
    getLastTransactionDate(revenueSheet),
    getLastTransactionDate(expenseSheet)
  );

  // First run on an empty/new spreadsheet: fall back to the
  // configured start date instead of throwing.
  const referenceDate = lastTransactionDate
    ? addOneSecond(lastTransactionDate)
    : new Date(Config.DEFAULT_START_DATE.getTime());

  const transactions = getTransactions(referenceDate).filter(
    (transaction) => !isTransfer(transaction)
  );

  let message;
  if (transactions.length === 0) {
    message = `There have been no transactions since ${referenceDate}`;
  } else {
    updateLogs(transactions);
    message =
      `Updated logs with ${transactions.length} transactions ` +
      `since ${referenceDate}`;
  }

  Logger.log(message);
  return message;
}

/**
 * Date of the most recent transaction in a log sheet (row 2),
 * or null if the sheet is empty / has no parseable date.
 */
function getLastTransactionDate(sheet) {
  const value = sheet
    .getRange(Config.FIRST_DATA_ROW, Config.DATE_COL)
    .getValue();

  if (value === null || value === undefined || value === '' || value === 'Date') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Batch-inserts transactions at the top of a sheet (newest first)
 * with a single insert + a single setValues, instead of one
 * insertRowBefore/setValues pair per transaction.
 * Returns the number of rows written.
 */
function insertTransactions(sheet, transactions) {
  if (!transactions || transactions.length === 0) {
    return 0;
  }

  transactions.forEach(logTransaction);

  // Logs are newest-first, so write the ascending sort in reverse.
  const rows = sortByCreatedAt(transactions)
    .map(toRowValues)
    .reverse();

  sheet.insertRowsBefore(Config.FIRST_DATA_ROW, rows.length);
  sheet
    .getRange(
      Config.FIRST_DATA_ROW,
      1,
      rows.length,
      Config.TRANSACTION_ROW_WIDTH
    )
    .setValues(rows);

  return rows.length;
}

/** Single-transaction wrapper, kept for existing callers. */
function insertTransaction(sheet, transaction) {
  return insertTransactions(sheet, [transaction]);
}

/**
 * Inserts all non-transfer transactions into the revenue/expense logs.
 * Returns counts per log.
 */
function updateLogs(transactions) {
  const revenue = transactions.filter(
    (t) => t.attributes.amount.value > 0
  );
  const expense = transactions.filter(
    (t) => t.attributes.amount.value < 0
  );

  insertTransactions(getSheet(Config.SHEET_NAMES.REVENUE), revenue);
  insertTransactions(getSheet(Config.SHEET_NAMES.EXPENSE), expense);

  return { revenue: revenue.length, expense: expense.length };
}
