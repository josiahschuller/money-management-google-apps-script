/**
 * Node tests for the pure helpers and the Apps Script glue.
 *
 * Apps Script files are plain scripts sharing one global scope, so
 * the tests load them into a single Node `vm` context with stubbed
 * SpreadsheetApp / UrlFetchApp / PropertiesService, exactly as
 * Apps Script would see them. Run with: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'src');
const FILES = [
  'Config.js',
  'Transactions.js',
  'Up API.js',
  'Code.js',
  'Support.js',
  'Menu.js',
];

function load(overrides = {}) {
  const sandbox = {
    console,
    Logger: { log() {} },
    // By default there is no bound spreadsheet / UI; tests that need
    // them pass their own stubs via `overrides`.
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        throw new Error('no active spreadsheet in test stub');
      },
      getUi() {
        throw new Error('UI must not be used in test stub');
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return { getProperty: () => null };
      },
    },
    UrlFetchApp: {
      fetch() {
        throw new Error('UrlFetchApp must not be called in test stub');
      },
    },
    DriveApp: {},
    ...overrides,
  };
  vm.createContext(sandbox);
  for (const file of FILES) {
    vm.runInContext(fs.readFileSync(path.join(SRC, file), 'utf8'), sandbox);
  }
  // Date constructor from the vm realm, so `instanceof Date` checks
  // inside the loaded code behave the same as in Apps Script.
  sandbox.Date_ = vm.runInContext('Date', sandbox);
  return sandbox;
}

function tx(description, value, createdAt) {
  return {
    attributes: { description, amount: { value }, createdAt },
  };
}

/** Minimal fake sheet: records insert/setValues, serves getValue/getValues. */
function fakeSheet(values = []) {
  const sheet = {
    calls: { insertRowsBefore: [], setValues: [] },
    getRange(...args) {
      const [row, col, numRows] = args;
      return {
        getValue() {
          const r = values[row - 1];
          return r ? r[col - 1] : '';
        },
        setValues(rows) {
          sheet.calls.setValues.push(rows);
          assert.equal(rows.length, numRows);
        },
      };
    },
    insertRowsBefore(row, count) {
      sheet.calls.insertRowsBefore.push([row, count]);
    },
    getDataRange() {
      return { getValues: () => values };
    },
  };
  return sheet;
}

function spreadsheetStub(sheetsByName) {
  return {
    getActiveSpreadsheet() {
      return {
        getSheetByName(name) {
          return sheetsByName[name] || null;
        },
      };
    },
  };
}

test('isTransfer: canonical Transfer to/from rule only', () => {
  const { isTransfer } = load();
  assert.equal(isTransfer(tx('Transfer to 2Up', -100, '2025-01-01')), true);
  assert.equal(isTransfer(tx('Transfer from savings', 100, '2025-01-01')), true);
  assert.equal(isTransfer(tx('  transfer to 2up', -100, '2025-01-01')), true);
  // Broader "contains transfer" matches from the old Support.js are kept
  assert.equal(isTransfer(tx('Transfer payment to landlord', -100, '2025-01-01')), false);
  assert.equal(isTransfer(tx('Coffee', -450, '2025-01-01')), false);
});

test('sortByCreatedAt sorts ascending without mutating the input', () => {
  const { sortByCreatedAt } = load();
  const input = [
    tx('b', 1, '2025-01-02T00:00:00Z'),
    tx('a', 1, '2025-01-01T00:00:00Z'),
  ];
  const sorted = sortByCreatedAt(input);
  // Arrays created inside the vm have a different prototype; spread
  // them into this realm before deepStrictEqual.
  assert.deepEqual([...sorted].map((t) => t.attributes.description), ['a', 'b']);
  assert.deepEqual(input.map((t) => t.attributes.description), ['b', 'a']);
});

test('toRowValues writes a numeric amount, not a string', () => {
  const { toRowValues } = load();
  const row = toRowValues(tx('Coffee', -450, '2025-01-01T12:00:00Z'));
  assert.equal(row[0].toISOString(), '2025-01-01T12:00:00.000Z');
  assert.equal(row[1], 'Coffee');
  assert.equal(row[2], null);
  assert.equal(row[3], 450);
  assert.equal(typeof row[3], 'number');
});

test('getMaxDate / addOneSecond handle nulls', () => {
  const sb = load();
  const d1 = new sb.Date_(2025, 0, 1);
  const d2 = new sb.Date_(2025, 0, 3);
  assert.equal(sb.getMaxDate(null, d2).getTime(), d2.getTime());
  assert.equal(sb.getMaxDate(d1, null).getTime(), d1.getTime());
  assert.equal(sb.getMaxDate(d1, d2).getTime(), d2.getTime());
  assert.equal(sb.getMaxDate(null, null), null);
  assert.equal(sb.addOneSecond(d1).getTime(), d1.getTime() + 1000);
  assert.equal(d1.getSeconds(), 0); // input not mutated
});

test('buildRecordedKeys skips header and normalises string amounts', () => {
  const sb = load();
  const day = new sb.Date_(2025, 0, 15, 12);
  const keys = sb.buildRecordedKeys([
    ['Date', 'Description', '', 'Amount'],
    [day, 'Coffee', null, '450'], // string amount, as Sheets may return
    [day, 'Pay', null, 1000],
  ]);
  assert.equal(keys.size, 2);
  assert.ok(keys.has(sb.transactionKey(day, 'Coffee', 450)));
  assert.ok(keys.has(sb.transactionKey(day, 'Pay', 1000)));
});

test('checkForMissingTransactions: Set lookup, zero amounts ignored', () => {
  const day = new (load().Date_)(2025, 0, 15, 12);
  const revenue = fakeSheet([
    ['Date', 'Description', '', 'Amount'],
    [day, 'Pay', null, 1000],
  ]);
  const expense = fakeSheet([
    ['Date', 'Description', '', 'Amount'],
    [day, 'Coffee', null, '450'], // string amount must still match 450
  ]);
  const sb = load({
    SpreadsheetApp: spreadsheetStub({
      'Revenue Log': revenue,
      'Expense Log': expense,
    }),
  });

  const missed = sb.checkForMissingTransactions([
    tx('Pay', 1000, day.toISOString()),
    tx('Coffee', -450, day.toISOString()),
    tx('New expense', -999, day.toISOString()),
    tx('Zero', 0, day.toISOString()),
  ]);
  assert.deepEqual(
    missed.map((t) => t.attributes.description),
    ['New expense']
  );
});

test('insertTransactions: one batch write, newest first, empty is no-op', () => {
  const sb = load();
  const sheet = fakeSheet([['Date', 'Description', '', 'Amount']]);
  const written = sb.insertTransactions(sheet, [
    tx('old', -100, '2025-01-01T00:00:00Z'),
    tx('new', -200, '2025-01-03T00:00:00Z'),
    tx('mid', -300, '2025-01-02T00:00:00Z'),
  ]);
  assert.equal(written, 3);
  assert.deepEqual(sheet.calls.insertRowsBefore, [[2, 3]]);
  assert.equal(sheet.calls.setValues.length, 1);
  assert.deepEqual(
    [...sheet.calls.setValues[0]].map((r) => r[1]),
    ['new', 'mid', 'old']
  );

  const empty = fakeSheet();
  assert.equal(sb.insertTransactions(empty, []), 0);
  assert.deepEqual(empty.calls.insertRowsBefore, []);
  assert.deepEqual(empty.calls.setValues, []);
});

test('retrieveAndUpdateTransactions: empty logs fall back, no UI, returns string', () => {
  const header = [['Date', 'Description', '', 'Amount']];
  const sb = load({
    SpreadsheetApp: spreadsheetStub({
      'Revenue Log': fakeSheet(header),
      'Expense Log': fakeSheet(header),
    }),
  });
  let since;
  sb.getTransactions = (s) => {
    since = s;
    return [];
  };
  const message = sb.retrieveAndUpdateTransactions();
  assert.match(message, /no transactions since/);
  const config = vm.runInContext('Config', sb); // consts aren't sandbox props
  assert.equal(since.getTime(), config.DEFAULT_START_DATE.getTime());
});

test('retrieveAndUpdateTransactions: uses last date + 1s and updates logs', () => {
  const last = new (load().Date_)(2025, 0, 2, 12, 0, 0);
  const revenue = fakeSheet([
    ['Date', 'Description', '', 'Amount'],
    [last, 'Pay', null, 1000],
  ]);
  const expense = fakeSheet([['Date', 'Description', '', 'Amount']]);
  const sb = load({
    SpreadsheetApp: spreadsheetStub({
      'Revenue Log': revenue,
      'Expense Log': expense,
    }),
  });
  let since;
  sb.getTransactions = (s) => {
    since = s;
    return [tx('Coffee', -450, '2025-01-03T00:00:00Z')];
  };
  const message = sb.retrieveAndUpdateTransactions();
  assert.match(message, /Updated logs with 1 transactions/);
  assert.equal(since.getTime(), last.getTime() + 1000);
  assert.equal(expense.calls.setValues.length, 1);
  assert.equal(revenue.calls.setValues.length, 0);
});

test('makeApiRequest: throws on non-2xx with body, propagates net errors', () => {
  const ok = load({
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => 200,
        getContentText: () => '{"ok":true}',
      }),
    },
  });
  assert.equal(ok.makeApiRequest('https://x', 'get', null, {}), '{"ok":true}');

  const failing = load({
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => 500,
        getContentText: () => 'server exploded',
      }),
    },
  });
  assert.throws(
    () => failing.makeApiRequest('https://x', 'get', null, {}),
    /500.*server exploded/
  );

  const netFail = load({
    UrlFetchApp: {
      fetch: () => {
        throw new Error('network down');
      },
    },
  });
  assert.throws(
    () => netFail.makeApiRequest('https://x', 'get', null, {}),
    /network down/
  );
});

test('getTransactions: follows pagination and requires credentials', () => {
  const props = { UP_ACCESS_TOKEN: 'tok', UP_2UP_ACCOUNT_ID: 'acct-1' };
  const urls = [];
  const sb = load({
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (n) => props[n] }),
    },
    UrlFetchApp: {
      fetch(url) {
        urls.push(url);
        if (url.includes('page=2')) {
          return {
            getResponseCode: () => 200,
            getContentText: () =>
              JSON.stringify({ data: [tx('b', 2, '2025-01-02T00:00:00Z')] }),
          };
        }
        return {
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({
              data: [tx('a', 1, '2025-01-01T00:00:00Z')],
              links: { next: 'https://api.up.com.au/next?page=2' },
            }),
        };
      },
    },
  });
  const result = sb.getTransactions(new sb.Date_('2025-01-01T00:00:00Z'));
  assert.deepEqual([...result].map((t) => t.attributes.description), ['a', 'b']);
  assert.match(urls[0], /acct-1\/transactions\?filter\[since\]=/);

  const noCreds = load();
  assert.throws(() => noCreds.getTransactions(null), /Missing script property/);
});

test('updateLogsFromMenu alerts the returned message (UI lives in Menu)', () => {
  const alerts = [];
  const sb = load({
    SpreadsheetApp: {
      getUi: () => ({ alert: (m) => alerts.push(m) }),
    },
  });
  sb.retrieveAndUpdateTransactions = () => 'done message';
  sb.updateLogsFromMenu();
  assert.deepEqual(alerts, ['done message']);

  sb.retrieveAndUpdateTransactions = () => {
    throw new Error('boom');
  };
  sb.updateLogsFromMenu();
  assert.match(alerts[1], /Failed to update logs: boom/);
});
