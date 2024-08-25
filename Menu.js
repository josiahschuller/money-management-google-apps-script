
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Josiah Magic')
      .addItem('Update revenue and expense logs', 'retrieveAndUpdateTransactions')
      .addToUi();
}
