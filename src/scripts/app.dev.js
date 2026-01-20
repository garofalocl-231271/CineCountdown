const ENV = location.pathname.startsWith("/dev/") ? "dev" : "prod";

const FLAGS = { DEBUG: ENV === "dev",
				NOTIFICATIONS: true,
				TEST_TOOLS: ENV === "dev",
				LOGS: ENV === "dev"
				};
if (FLAGS.DEBUG) console.log("DEBUD MODE");
				

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(() => console.log("SW registrato"))
    .catch(err => console.error("SW errore", err));
}

// ===============================
// 🧪 BLOCCO TEST (NOTIFICHE + ORARIO)
// ===============================

  // Elementi UI
  const testToggleNotifications = document.getElementById("testToggleNotifications");
  const testFilmTimeInput = document.getElementById("testFilmTime");
  const applyTestTimeBtn = document.getElementById("applyTestTime");
  window.notificationsEnabled =
  typeof window.notificationsEnabled === "boolean"
    ? window.notificationsEnabled
    : Notification.permission === "granted";


  // Stato notifiche (solo test)
  window.notificationsEnabled = Notification.permission === "granted";

  // 🔔 TOGGLE NOTIFICHE (TEST)
  if (testToggleNotifications) {
    testToggleNotifications.checked = notificationsEnabled;

    testToggleNotifications.addEventListener("change", async () => {
      if (testToggleNotifications.checked) {
        const perm = await Notification.requestPermission();
        notificationsEnabled = perm === "granted";
        testToggleNotifications.checked = notificationsEnabled;

        if (!notificationsEnabled) {
          alert("Permesso notifiche negato");
        }
      } else {
        notificationsEnabled = false;
      }

      console.log("🔔 NotificationsEnabled (test):", notificationsEnabled);
    });
  }
console.log("BTN:", applyTestTimeBtn);
  console.log("INPUT:", testFilmTimeInput);

  if (!applyTestTimeBtn || !testFilmTimeInput) {
    console.warn("⛔ Test controls non trovati nel DOM");
    return;
  }

  applyTestTimeBtn.addEventListener("click", () => {
    const testTime = testFilmTimeInput.value;

    if (!testTime) {
      alert("Inserisci un orario valido");
      return;
    }

    const favs = getFavs();
    if (!favs.length) {
      alert("Aggiungi almeno un film ai preferiti");
      return;
    }

    // 🔧 Forza ORARIO + GIORNO coerente (oggi)
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");

favs[0].day = `${yyyy}-${mm}-${dd}`; // stesso formato che usi altrove
favs[0].time = testTime;
saveFavs(favs);

    
/*renderProgrammazione();
renderPreferiti();
renderSummary();
syncAllCountdownStates();*/

    if (window.notifiedSessions) {
      notifiedSessions.clear();
    }
    window.scheduledNotificationKey = null;

    alert("⏱ Orario di test applicato: " + testTime);
    console.log("🕒 Orario film forzato a:", testTime);
  });
