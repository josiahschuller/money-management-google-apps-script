/**
 * Diagnostic: compares transactions exported to a Drive file against
 * the revenue/expense logs and records anything missing in the
 * Missed Log. Returns a summary string (see retrieveAndUpdateTransactions).
 */
function runCheck() {
  // Get transactions from file
  const FILE_ID = '1l5qUsi42LjbH3YCRTofYGW7r6pimlFYv';
  const file = DriveApp.getFileById(FILE_ID);
  const transactions = JSON.parse(file.getBlob().getDataAsString()).filter(
    (transaction) => !isTransfer(transaction)
  );

  const missedTransactions = sortByCreatedAt(
    checkForMissingTransactions(transactions)
  );

  insertTransactions(getSheet(Config.SHEET_NAMES.MISSED), missedTransactions);

  const message =
    `Checked ${transactions.length} transactions - ` +
    `${missedTransactions.length} transactions were missing!`;
  Logger.log(message);
  return message;
}

/**
 * Transactions that are not recorded in the revenue/expense logs.
 * Recorded entries are indexed once into Sets (O(n + m)) instead of
 * linearly scanning every sheet row for every transaction (O(n * m)).
 * Zero-amount transactions are ignored (they belong to neither log).
 */
function checkForMissingTransactions(transactions) {
  const revenueKeys = buildRecordedKeys(
    getSheet(Config.SHEET_NAMES.REVENUE).getDataRange().getValues()
  );
  const expenseKeys = buildRecordedKeys(
    getSheet(Config.SHEET_NAMES.EXPENSE).getDataRange().getValues()
  );

  return transactions.filter((transaction) => {
    const value = transaction.attributes.amount.value;
    const recordedKeys =
      value > 0 ? revenueKeys : value < 0 ? expenseKeys : null;
    if (!recordedKeys) {
      return false;
    }
    return !recordedKeys.has(
      transactionKey(
        new Date(transaction.attributes.createdAt),
        transaction.attributes.description,
        Math.abs(value)
      )
    );
  });
}
