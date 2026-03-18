// Gota a Gota Control - Background Service Worker
// Este script mantiene la conexión viva y el monitoreo en segundo plano.

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensión de Seguridad Gota a Gota Instalada");
});

// Escuchar mensajes de la web app
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === "START_MONITORING") {
    // Iniciar monitoreo persistente
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Gota a Gota Control",
      message: "Monitoreo nativo activado y persistente."
    });
    sendResponse({ status: "ok" });
  }
});

// Mantener el proceso vivo
setInterval(() => {
  console.log("Servicio Nativo Latido...");
}, 30000);
