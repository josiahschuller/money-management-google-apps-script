
const MISSED_SHEET = MONEY_MANAGEMENT_SHEET.getSheetByName("Missed Log");

function runCheck() {

  // Get transactions from API
  // const START_DATE = new Date(2024, 0, 1);
  // let transactions = getTransactions(UP_ACCESS_TOKEN, UP_2UP_ACCOUNT_ID, START_DATE);

  // Save transactions to file
  // const DRIVE_FOLDER_ID = '1dthnH65WSWy2JpR_nrImylUjEoKP_ex4';
  // let folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  // folder.createFile('transactions.txt', JSON.stringify(transactions));

  // Get transactions from file
  const FILE_ID = '1l5qUsi42LjbH3YCRTofYGW7r6pimlFYv';
  let file = DriveApp.getFileById(FILE_ID);
  let transactions = JSON.parse(file.getBlob().getDataAsString());

  // Filter out transactions with "transfer" in the description
  const TRANSFER_STRING = "transfer";
  transactions = transactions.filter((transaction) => !transaction.attributes.description.toLowerCase().includes(TRANSFER_STRING));

  // Check for missing transactions
  let missedTransactions = checkForMissingTransactions(transactions);

  // Sort the transactions by their creation date (ascending)
  missedTransactions = missedTransactions.sort((a, b) => {
    if (a.attributes.createdAt < b.attributes.createdAt) {
      return -1;
    } else if (a.attributes.createdAt > b.attributes.createdAt) {
      return 1;
    } else {
      return 0;
    }
  });

  // Record missed transactions
  missedTransactions.forEach((transaction) => {
    insertTransaction(MISSED_SHEET, transaction);
  });
}

function checkForMissingTransactions(transactions) {
  /*
  Check if there are transactions in Up that are not in the spreadsheet
  */
  let missedTransactions = [];

  const EXPENSE_DATA = EXPENSE_SHEET.getDataRange().getValues();
  const REVENUE_DATA = REVENUE_SHEET.getDataRange().getValues();

  transactions.forEach((transaction) => {
    let relevantData;
    if (transaction.attributes.amount.value > 0) {
      relevantData = REVENUE_DATA;
    } else if (transaction.attributes.amount.value < 0) {
      relevantData = EXPENSE_DATA;
    }

    if (
      !isTransactionRecorded(
        relevantData,
        new Date(transaction.attributes.createdAt),
        transaction.attributes.description,
        Math.abs(transaction.attributes.amount.value)
      )
    ) {
      missedTransactions.push(transaction);
    }
  });

  Logger.log(`Checked ${transactions.length} transactions - ${missedTransactions.length} transactions were missing!`);

  return missedTransactions;
}

function isTransactionRecorded(sheetData, date, description, amount) {
  /*
  Check if the given transaction is recorded in the spreadsheet
  */
  const FIRST_ROW_NUM = 1; // Skip top row

  for (let i = FIRST_ROW_NUM; i < sheetData.length; i++) {
    let row = sheetData[i];

    if (areDatesSame(row[0], date) && row[1] === description && row[3] === Math.abs(amount)) {
      return true;
    }
  }
  return false;
}

function areDatesSame(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}
