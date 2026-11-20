/**
 * Reads a required script property, with a clear error if it is missing
 * instead of failing obscurely downstream (e.g. "Bearer null").
 */
function getScriptProperty(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throw new Error(
      `Missing script property "${name}". Set it in Project Settings > ` +
      'Script properties.'
    );
  }
  return value;
}

function testAPI() {
  const transactions = getTransactions(
    new Date('2024-04-10T22:00:30.000Z')
  );
  transactions.forEach(logTransaction);
}

/**
 * Makes an HTTP request and returns the response body as text.
 *
 * HTTP errors are no longer swallowed: with muteHttpExceptions the
 * response status is checked and a non-2xx status throws, including
 * the response body. Network-level errors from UrlFetchApp also
 * propagate instead of being logged and turned into `null`.
 */
function makeApiRequest(url, method, body, headers) {
  const options = {
    'method': method.toUpperCase(),
    'contentType': 'application/json',
    'headers': headers,
    'muteHttpExceptions': true,
  };

  if (body !== null && body !== undefined) {
    options['payload'] = JSON.stringify(body);
  }

  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(
      `Up API request failed (${status}) for ` +
      `${method.toUpperCase()} ${url}: ${text}`
    );
  }

  return text;
}

/**
 * Gets transactions for the configured Up account.
 *
 * @param {Date|null} [sinceTimestamp] - If provided, only transactions
 *   since this timestamp are fetched. If null/omitted, all are fetched.
 * @returns {Array} Array of transaction objects, following pagination.
 */
function getTransactions(sinceTimestamp) {
  const upAccessToken = getScriptProperty(Config.UP_ACCESS_TOKEN_PROPERTY);
  const upAccountId = getScriptProperty(Config.UP_ACCOUNT_ID_PROPERTY);

  let url = `https://api.up.com.au/api/v1/accounts/${upAccountId}/transactions`;
  if (sinceTimestamp !== null && sinceTimestamp !== undefined) {
    url += `?filter[since]=${sinceTimestamp.toISOString()}`;
  }
  const headers = { 'Authorization': `Bearer ${upAccessToken}` };

  let transactions = JSON.parse(makeApiRequest(url, 'get', null, headers));
  let transactionsData = transactions.data || [];

  // If there are still more transactions (because of truncation), get them too
  while (transactions.links && transactions.links.next) {
    Logger.log('There are more transactions to fetch!');
    transactions = JSON.parse(
      makeApiRequest(transactions.links.next, 'get', null, headers)
    );
    // Concatenate data from this API call to the previous-retrieved data
    transactionsData = transactionsData.concat(transactions.data || []);
  }
  return transactionsData;
}

/**
 * Logs a transaction as a simple readable string
 */
function logTransaction(transaction) {
  Logger.log(
    `${transaction.attributes.createdAt}: ` +
    `${transaction.attributes.description}: ` +
    `$${transaction.attributes.amount.value}`
  );
}
