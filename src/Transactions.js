/**
 * Pure helpers for working with Up transactions.
 *
 * These have no Apps Script dependencies, so they can be unit-tested
 * with plain Node (see tests/). Previously this logic was duplicated
 * across Code.js and Support.js with subtly different rules.
 */

/**
 * Whether a transaction is an internal transfer between own accounts.
 * Canonical rule (formerly Code.js): descriptions starting with
 * "Transfer to " or "Transfer from ". Support.js used a broader
 * case-insensitive `includes("transfer")`; the stricter rule is kept
 * so e.g. "Transfer payment to landlord" is not dropped by accident.
 */
function isTransfer(transaction) {
  const description =
    transaction && transaction.attributes
      ? String(transaction.attributes.description || '')
      : '';
  const normalized = description.trim().toLowerCase();
  return (
    normalized.startsWith('transfer to ') ||
    normalized.startsWith('transfer from ')
  );
}

/** Comparator: ascending by createdAt (ISO strings sort lexicographically). */
function byCreatedAt(a, b) {
  const aTime = new Date(a.attributes.createdAt).getTime();
  const bTime = new Date(b.attributes.createdAt).getTime();
  if (!isNaN(aTime) && !isNaN(bTime)) {
    return aTime - bTime;
  }
  return String(a.attributes.createdAt).localeCompare(
    String(b.attributes.createdAt)
  );
}

/** Returns a new array sorted ascending by createdAt; does not mutate input. */
function sortByCreatedAt(transactions) {
  return [...transactions].sort(byCreatedAt);
}

/**
 * The row written to a log sheet for a transaction.
 * Amount is a number (not a string) so it can be summed/formatted
 * in Sheets and compared reliably (see transactionKey).
 */
function toRowValues(transaction) {
  return [
    new Date(transaction.attributes.createdAt),
    transaction.attributes.description,
    null,
    Math.abs(transaction.attributes.amount.value),
  ];
}

/** Later of two dates, ignoring nulls. Returns null if both are null. */
function getMaxDate(date1, date2) {
  const dates = [date1, date2]
    .filter((d) => d !== null && d !== undefined)
    .map((d) => new Date(d));
  if (dates.length === 0) {
    return null;
  }
  return dates.reduce((max, d) => (d > max ? d : max));
}

/** A new Date one second after the given date. */
function addOneSecond(date) {
  const newDate = new Date(date);
  newDate.setSeconds(newDate.getSeconds() + 1);
  return newDate;
}

/** 'YYYY-MM-DD' in local time for a Date/string/number, or null if invalid. */
function dateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    return null;
  }
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Canonical identity for a transaction, used to check whether it is
 * already recorded in a sheet. Amount is coerced with Number() so
 * sheet values stored as strings ("403") match API values (403).
 */
function transactionKey(date, description, amount) {
  return `${dateKey(date)}|${description}|${Number(amount)}`;
}

/**
 * Set of transactionKeys for all data rows in sheet data
 * (as returned by sheet.getDataRange().getValues()), skipping the header.
 */
function buildRecordedKeys(sheetData) {
  const keys = new Set();
  for (let i = 1; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row || row.length < Config.AMOUNT_COL) {
      continue;
    }
    const key = transactionKey(row[0], row[1], row[3]);
    if (dateKey(row[0]) !== null) {
      keys.add(key);
    }
  }
  return keys;
}
