/* ===== Antwerk 2026 – Immo Spot : site configuration =====
   Edit the values below. After changing PUBLIC_URL run:  python3 make_qr.py   */
window.ANTWERK_CONFIG = {
  // 1) Paste the Google Apps Script Web App URL here (ends with /exec). See README.
  //    While empty, the forms show "not connected, nothing saved" and keep the visitor's data on screen.
  ENDPOINT_URL: "https://script.google.com/macros/s/AKfycbxb7DjkKMy8j65O7n-V-nTgmDUKYjecIB9ZdiXvhylgNhQo-4IWFFWxHtwcU9I1d8LRGQ/exec",

  // 2) The public web address visitors open (used by make_qr.py to build qr.png).
  PUBLIC_URL: "https://antwerk.immo-spot.be/",

  // Event + draw (texts on the site itself come from js/i18n.js; Code.gs has its own copy for the e-mails)
  EXPO_NAME: "Antwerk",
  EXPO_DATE: "2026-11-04",
  DRAW_DATE: "2026-11-05",
  PRIZE: "Shabbat getaway for two at Villa Altol",

  // Company
  COMPANY_NAME: "Immo Spot",
  CONTACT_EMAIL: "info@immo-spot.be",

  // Kiosk / tablet behaviour
  DEFAULT_LANG: "nl",
  THANKYOU_RESET_SECONDS: 20
};
