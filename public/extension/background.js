chrome.runtime.onInstalled.addListener(() => {
  console.log('Gota a Gota Extension Installed');
});

// Keep the extension alive
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('Extension heartbeat');
  }
});

// Listen for messages from the web app
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_EXTENSION') {
    sendResponse({ status: 'active', version: '1.0' });
  }
});
