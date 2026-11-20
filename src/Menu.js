function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Josiah Magic')
    .addItem('Update revenue and expense logs', 'updateLogsFromMenu')
    .addToUi();
}

/**
 * Menu wrapper for retrieveAndUpdateTransactions: all UI (alerts)
 * lives here, so the update logic itself stays headless-friendly.
 */
function updateLogsFromMenu() {
  const ui = SpreadsheetApp.getUi();
  try {
    ui.alert(retrieveAndUpdateTransactions());
  } catch (error) {
    ui.alert(`Failed to update logs: ${error.message || error}`);
  }
}
