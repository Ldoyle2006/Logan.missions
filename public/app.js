const signupForm = document.querySelector("#signup-form");
const formMessage = document.querySelector("#form-message");
const donationMessage = document.querySelector("#donation-message");

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

async function loadDonationStatus() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    setMessage(donationMessage, "Donation checkout is temporarily unavailable.", true);
    return;
  }

  const config = await response.json();
  if (!config.donationsConfigured) {
    document.querySelectorAll('a[href="/donate"]').forEach((link) => {
      link.setAttribute("aria-disabled", "true");
      link.addEventListener("click", (event) => {
        event.preventDefault();
        setMessage(donationMessage, "Giving will be available once the Stripe payment link is configured.");
      });
    });
  }
}

async function loadLinks() {
  const container = document.querySelector("#link-list");
  const response = await fetch("/links.json");
  if (!response.ok) throw new Error("The link list could not be loaded.");

  const data = await response.json();
  const links = Array.isArray(data.links) ? data.links : [];
  if (links.length === 0) return;

  container.replaceChildren();
  for (const item of links) {
    if (!item || typeof item.label !== "string" || typeof item.url !== "string") continue;
    let destination;
    try {
      destination = new URL(item.url);
    } catch {
      continue;
    }
    if (destination.protocol !== "https:" && destination.protocol !== "mailto:") continue;

    const anchor = document.createElement("a");
    anchor.className = "link-card";
    anchor.href = destination.toString();
    const number = document.createElement("span");
    number.className = "link-card-number";
    number.textContent = String(links.indexOf(item) + 1).padStart(2, "0");
    anchor.append(number);
    const copy = document.createElement("span");
    copy.className = "link-card-copy";
    const title = document.createElement("strong");
    title.textContent = item.label;
    const description = document.createElement("small");
    description.textContent = typeof item.description === "string" ? item.description : "";
    copy.append(title, description);
    const arrow = document.createElement("span");
    arrow.className = "link-card-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    anchor.append(copy, arrow);
    if (destination.protocol === "https:") {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    container.append(anchor);
  }

  if (container.childElementCount === 0) {
    container.innerHTML = '<p class="empty-links">No links are configured yet. Add HTTPS or mailto links in <code>public/links.json</code>.</p>';
  }
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(formMessage, "Adding you to the update list…");
  const button = signupForm.querySelector('button[type="submit"]');
  button.disabled = true;

  const formData = new FormData(signupForm);
  const payload = {
    firstName: formData.get("firstName"),
    email: formData.get("email"),
    consent: formData.get("consent") === "on",
    website: formData.get("website"),
  };

  try {
    const response = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(formMessage, result.message || "Signup could not be completed. Please try again.", true);
      return;
    }
    setMessage(formMessage, result.message);
    signupForm.reset();
  } catch {
    setMessage(formMessage, "We could not reach the signup service. Please try again later.", true);
  } finally {
    button.disabled = false;
  }
});

loadDonationStatus().catch(() => {
  setMessage(donationMessage, "Donation checkout is temporarily unavailable.", true);
});
loadLinks().catch(() => {
  document.querySelector("#link-list").innerHTML =
    '<p class="empty-links">The link list could not be loaded. Please try again later.</p>';
});

const missionCarousel = document.querySelector("#mission-carousel");
if (missionCarousel) {
  const slides = [
    {
      image: "/images/field/baptism.jpg",
      alt: "Friends gather around a young person in the water during a baptism",
      title: "A moment of faith",
      note: "Faith is often experienced in community, through meaningful moments shared with one another.",
    },
    {
      image: "/images/field/care-and-connection.jpg",
      alt: "A missionary shares a caring moment with a young person",
      title: "Care in the little moments",
      note: "Showing up, sharing encouragement, and being present can help build trust and friendship.",
    },
    {
      image: "/images/field/shared-meal.jpg",
      alt: "Friends and teammates share food around a table",
      title: "Room around the table",
      note: "Sharing a meal makes space for conversation, laughter, and getting to know one another.",
    },
    {
      image: "/images/field/outdoor-gathering.jpg",
      alt: "A small group gathers outdoors with a view of the ocean",
      title: "Learning together",
      note: "Time outdoors can make room to reflect, ask questions, and learn alongside one another.",
    },
    {
      image: "/images/field/team-service.jpg",
      alt: "A team works together on a practical community project",
      title: "Serving side by side",
      note: "Practical service is one way to care for the people and places that welcome us.",
    },
    {
      image: "/images/field/group-community.jpg",
      alt: "A large group of friends gathers together for a photo",
      title: "Growing in community",
      note: "Every journey brings new friendships and people to learn from along the way.",
    },
  ];
  const cards = [...missionCarousel.querySelectorAll(".mission-card")];
  const previousButton = missionCarousel.querySelector(".carousel-arrow-prev");
  const nextButton = missionCarousel.querySelector(".carousel-arrow-next");
  const memoCount = document.querySelector("#photo-memo-count");
  const memoTitle = document.querySelector("#photo-memo-title");
  const memoText = document.querySelector("#photo-memo-text");

  function wrapIndex(index) {
    return (index + slides.length) % slides.length;
  }

  function setCardSlide(card, slideIndex) {
    const slide = slides[slideIndex];
    const image = card.querySelector("img");
    image.src = slide.image;
    image.alt = slide.alt;
    card.querySelector("figcaption").textContent = slide.title;
    card.dataset.slideIndex = String(slideIndex);
  }

  for (const card of cards) {
    const slideIndex = card.dataset.cardPosition === "left" ? slides.length - 1 : card.dataset.cardPosition === "right" ? 1 : 0;
    setCardSlide(card, slideIndex);
  }

  function updateActiveMemo() {
    const activeCard = cards.find((card) => card.dataset.cardPosition === "center");
    const activeIndex = Number(activeCard.dataset.slideIndex);
    const slide = slides[activeIndex];

    for (const card of cards) {
      const isActive = card === activeCard;
      card.setAttribute("aria-current", String(isActive));
      card.setAttribute("aria-hidden", String(!isActive));
    }

    memoCount.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    memoTitle.textContent = slide.title;
    memoText.textContent = slide.note;
  }

  function moveCarousel(direction) {
    const nextPosition = direction === "next"
      ? { left: "right", center: "left", right: "center" }
      : { left: "center", center: "right", right: "left" };
    const activeCard = cards.find((card) => card.dataset.cardPosition === "center");
    const offset = direction === "next" ? 1 : -1;
    const nextCenterIndex = wrapIndex(Number(activeCard.dataset.slideIndex) + offset);
    const nextSlideIndexes = {
      left: wrapIndex(nextCenterIndex - 1),
      center: nextCenterIndex,
      right: wrapIndex(nextCenterIndex + 1),
    };

    for (const card of cards) {
      card.dataset.cardPosition = nextPosition[card.dataset.cardPosition];
      setCardSlide(card, nextSlideIndexes[card.dataset.cardPosition]);
    }
    updateActiveMemo();
  }

  previousButton.addEventListener("click", () => moveCarousel("previous"));
  nextButton.addEventListener("click", () => moveCarousel("next"));
  updateActiveMemo();
}
