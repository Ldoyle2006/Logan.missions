(() => {
  const measurementId = "G-FVB86SM3MB";
  const clarityProjectId = "yvw7ivzevg";
  const storageKey = "loganMissions.analyticsConsent";
  const acceptedValue = "accepted";
  const rejectedValue = "rejected";
  let consentChoice = null;
  let banner;
  let status;

  function showStatus(message) {
    status.textContent = message;
  }

  function saveChoice(choice) {
    try {
      window.localStorage.setItem(storageKey, choice);
      consentChoice = choice;
      return true;
    } catch (error) {
      console.error("Could not save the analytics preference:", error);
      showStatus("Your choice could not be saved. Analytics will stay off on this page.");
      return false;
    }
  }

  function clearAnalyticsCookies() {
    const hostnameParts = window.location.hostname.split(".");
    const cookieDomains = hostnameParts.length > 1
      ? hostnameParts.map((_, index) => hostnameParts.slice(index).join("."))
      : [];

    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0].trim();
      if (name.startsWith("_ga") || name.startsWith("_cl")) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
        for (const domain of cookieDomains) {
          document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}; SameSite=Lax`;
        }
      }
    }
  }

  function loadAnalytics() {
    if (document.getElementById("google-gtag")) return;

    const pageLocation = `${window.location.origin}${window.location.pathname}`;
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const pageReferrer = referrer ? `${referrer.origin}${referrer.pathname}` : undefined;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    window.gtag("event", "page_view", {
      page_location: pageLocation,
      page_path: window.location.pathname,
      page_title: document.title,
      page_referrer: pageReferrer,
    });

    const script = document.createElement("script");
    script.id = "google-gtag";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.onerror = () => {
      console.error("Google Analytics could not be loaded.");
      showStatus("Analytics could not be loaded. Your choice is saved; you can continue browsing.");
    };
    document.head.append(script);
  }

  function loadClarity() {
    if (document.getElementById("microsoft-clarity")) return;

    window.clarity = window.clarity || function () {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };

    const script = document.createElement("script");
    script.id = "microsoft-clarity";
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${clarityProjectId}`;
    script.onerror = () => {
      console.error("Microsoft Clarity could not be loaded.");
      showStatus("Analytics could not be loaded. Your choice is saved; you can continue browsing.");
    };
    document.head.append(script);
  }

  function closeBanner() {
    banner.hidden = true;
  }

  function choose(choice) {
    if (!saveChoice(choice)) return;

    closeBanner();
    if (choice === acceptedValue) {
      loadAnalytics();
      loadClarity();
      return;
    }

    clearAnalyticsCookies();
    if (document.getElementById("google-gtag") || document.getElementById("microsoft-clarity")) {
      window.location.reload();
    }
  }

  function openBanner(focusFirstButton = true) {
    banner.hidden = false;
    if (focusFirstButton) banner.querySelector("[data-analytics-accept]").focus();
  }

  function createBanner() {
    banner = document.createElement("section");
    banner.className = "analytics-consent";
    banner.setAttribute("aria-label", "Analytics preferences");
    banner.hidden = true;

    const copy = document.createElement("div");
    copy.className = "analytics-consent-copy";

    const heading = document.createElement("h2");
    heading.textContent = "Help improve this website";

    const description = document.createElement("p");
    description.append(
      document.createTextNode("Optional Google Analytics and Microsoft Clarity help understand site usage. They stay off unless you choose to allow them. "),
    );
    const privacyLink = document.createElement("a");
    privacyLink.href = "/privacy.html";
    privacyLink.textContent = "Privacy details";
    description.append(privacyLink);

    status = document.createElement("p");
    status.className = "analytics-consent-status";
    status.setAttribute("aria-live", "polite");

    const actions = document.createElement("div");
    actions.className = "analytics-consent-actions";

    const rejectButton = document.createElement("button");
    rejectButton.className = "analytics-consent-button analytics-consent-reject";
    rejectButton.type = "button";
    rejectButton.textContent = "No thanks";
    rejectButton.addEventListener("click", () => choose(rejectedValue));

    const acceptButton = document.createElement("button");
    acceptButton.className = "analytics-consent-button analytics-consent-accept";
    acceptButton.type = "button";
    acceptButton.dataset.analyticsAccept = "";
    acceptButton.textContent = "Allow analytics";
    acceptButton.addEventListener("click", () => choose(acceptedValue));

    actions.append(rejectButton, acceptButton);
    copy.append(heading, description, status);
    banner.append(copy, actions);
    document.body.append(banner);
  }

  function initialize() {
    createBanner();

    try {
      const savedChoice = window.localStorage.getItem(storageKey);
      if (savedChoice === acceptedValue || savedChoice === rejectedValue) {
        consentChoice = savedChoice;
      }
    } catch (error) {
      console.error("Could not read the analytics preference:", error);
    }

    if (consentChoice === acceptedValue) {
      loadAnalytics();
      loadClarity();
    } else if (consentChoice !== rejectedValue) {
      openBanner(false);
    }

    for (const button of document.querySelectorAll("[data-analytics-consent-settings]")) {
      button.addEventListener("click", openBanner);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
