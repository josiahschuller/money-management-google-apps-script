const UP_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('UP_ACCESS_TOKEN');
const UP_2UP_ACCOUNT_ID = PropertiesService.getScriptProperties().getProperty('UP_2UP_ACCOUNT_ID');




function testAPI() {
  let transactions = getTransactions(UP_ACCESS_TOKEN, UP_2UP_ACCOUNT_ID, new Date("2024-04-10T22:00:30.000Z"));
  transactions.forEach(logTransaction);
}

function makeApiRequest(url, method, body, headers) {
  /*
  Makes an HTTP request

  Input body as null if you want a get request.
  */
  let options = {
    'method' : method,
    'contentType': 'application/json',
    'headers': headers,
    'muteHttpExceptions': true
  };

  if (body !== null) {
    options["payload"] = JSON.stringify(body);
  }

  try {
    var response = UrlFetchApp.fetch(url, options);
    return response.getContentText();
  } catch (error) {
    Logger.log('Error making API request: ' + error);
    return null;
  }
}

/**
 * Gets transactions for a specified Up bank account.
 *
 * @param {string} up_access_token - The access token for the Up banking API. This token is used for authorization.
 * @param {string} up_account_id - The unique identifier for the Up bank account. Used to specify which account's transactions are fetched.
 * @param {Date|null} since_timestamp - A JavaScript Date object representing the starting point for fetching transactions. 
 *                                      If provided, only transactions since this timestamp are fetched. If null, all transactions are fetched.
 * @returns {Array} An array of transaction objects for the specified account and time period.
 */
function getTransactions(up_access_token, up_account_id, since_timestamp) {
  /*
  Gets transactions for an account
  */
  let url = `https://api.up.com.au/api/v1/accounts/${up_account_id}/transactions`;
  if (since_timestamp !== null) {
    url += `?filter[since]=${since_timestamp.toISOString()}`;
  }
  let headers = {"Authorization": `Bearer ${up_access_token}`};
  let transactions = JSON.parse(makeApiRequest(url, "get", null, headers));
  let transactionsData = transactions.data;

  // If there are still more transactions (because of truncation), get them too
  while (transactions.links && transactions.links.next) {
    Logger.log("There are more transactions to fetch!");
    transactions = JSON.parse(makeApiRequest(transactions.links.next, "get", null, headers));
    // Concatenate data from this API call to the previous-retrived data
    transactionsData = transactionsData.concat(transactions.data);
  }
  return transactionsData;
}


function logTransaction(transaction) {
  /*
  Logs a transaction as a simple readable string
  */

  Logger.log(`${transaction.attributes.createdAt}: ${transaction.attributes.description}: $${transaction.attributes.amount.value}`);
}





