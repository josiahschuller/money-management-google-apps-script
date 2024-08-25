const MONEY_MANAGEMENT_SHEET = SpreadsheetApp.openById("1-YuxT4eZD0FbMv21y5OAnW8HGvZWlcrxfICc1U_3m6s");
const REVENUE_SHEET = MONEY_MANAGEMENT_SHEET.getSheetByName("Revenue Log");
const EXPENSE_SHEET = MONEY_MANAGEMENT_SHEET.getSheetByName("Expense Log");

function retrieveAndUpdateTransactions() {
  // Get the date of the last transaction
  let lastTransactionDate = getMaxDate(
    getLastTransactionDate(REVENUE_SHEET), getLastTransactionDate(EXPENSE_SHEET)
  );

  if (lastTransactionDate === null) {
    throw new ReferenceError("No transactions to get a date from!");
  }

  // Increase reference date by a minimal amount (to avoid retrieving already-retrieved transactions)
  let referenceDate = addOneSecond(lastTransactionDate);

  // Get transactions
  let transactions = getTransactions(UP_ACCESS_TOKEN, UP_2UP_ACCOUNT_ID, referenceDate);

  // Filter out transfer transactions
  transactions = transactions.filter(
    transaction => !transaction.attributes.description.startsWith("Transfer to ") && !transaction.attributes.description.startsWith("Transfer from ")
  );

  if (transactions.length === 0) {
    Logger.log(`No transactions since ${referenceDate}`);
    SpreadsheetApp.getUi().alert(`There have been no transactions since ${referenceDate}`);
  } else {
    // Update logs with transactions
    updateLogs(transactions);

    SpreadsheetApp.getUi().alert(`Updated logs with ${transactions.length} transactions since ${referenceDate}`);
  }
}


function getLastTransactionDate(sheet) {
  /*
  Gets the date of the last transaction in a sheet
  */
  const DATE_COL_INDEX = 1;
  const TOP_ROW = 2;

  let value = sheet.getRange(TOP_ROW, DATE_COL_INDEX).getValue()

  if (value === "Date") {
    return null;
  } else {
    return value;
  }
}

function getMaxDate(date1, date2) {
  if (date1 === null) return date2;
  if (date2 === null) return date1;
  return (date1 > date2) ? date1 : date2;
}

function addOneSecond(date) {
  /*
  Adds a second to a date
  */
  let newDate = new Date(date);
  newDate.setSeconds(newDate.getSeconds() + 1);
  return newDate;
}

function insertTransaction(sheet, transaction) {
  /*
  Inserts a transaction into a sheet
  */

  logTransaction(transaction);

  const TOP_ROW = 2;
  sheet.insertRowBefore(TOP_ROW);

  let rowValues = [
    new Date(transaction.attributes.createdAt),
    transaction.attributes.description,
    null,
    `${Math.abs(transaction.attributes.amount.value)}`,
  ];

  sheet.getRange(TOP_ROW, 1, 1, 4).setValues([rowValues]);
}

function updateLogs(transactions) {
  /*
  Inserts all relevant transactions into the revenue and expense logs in the spreadsheet
  */

  // Sort the transactions by their creation date (ascending)
  transactions = transactions.sort((a, b) => {
    if (a.attributes.createdAt < b.attributes.createdAt) {
      return -1;
    } else if (a.attributes.createdAt > b.attributes.createdAt) {
      return 1;
    } else {
      return 0;
    }
  });

  // Insert revenue transactions
  transactions.filter(transaction => transaction.attributes.amount.value > 0).forEach(transaction => insertTransaction(REVENUE_SHEET, transaction));

  // Insert expense transactions
  transactions.filter(transaction => transaction.attributes.amount.value < 0).forEach(transaction => insertTransaction(EXPENSE_SHEET, transaction));
}
