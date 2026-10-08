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
  const missionPhotos = [
    {
      image: "A brutal battle of the slippers.HEIC",
      title: "A Brutal Battle of the Slippers",
      memo: "The New Zealand DTS guys decided to play a game called Slipper Toss. Just some good character building and competition, with brutal red marks on our backs afterward from throwing slippers as hard as we could at each other. Man, was it fun. We wanted to play it all the time!",
    },
    {
      image: "A collection of phones.HEIC",
      title: "A Collection of Phones",
      memo: "In a small village in Thailand, I became like a brother to some of these kids. They were always on their phones, so naturally, I started collecting them. This was supposed to be a family photo, but I was holding all their phones hostage. One Logan versus eight kids doesn't go too well. Even when I visited Thailand months later, they still remembered me as the guy who took their phones.",
    },
    {
      image: "A late night Preparing for a Father.HEIC",
      title: "A Late Night Preparing for the Father",
      memo: "After worship, a couple of us guy staff headed back to prepare a space to welcome the Holy Spirit. We set up different stations, including one God put on my heart: getting down on our hands and knees to wash our brothers' and sisters' feet. The next day, I had the blessing of doing exactly that. This photo reminds me of a good night of fellowship and preparing to serve.",
    },
    {
      image: "A Logan stack.JPG",
      title: "A Logan Stack",
      memo: "Simple as that. Both of our names are Logan, and we were stacked.",
    },
    {
      title: "A Mini Legend in Indo",
      memo: "I can't remember this little boy's name, but he followed me everywhere. And the man sitting next to me, Hekskia, became one of my best friends. We couldn't speak a word of each other's languages, but somehow that didn't matter. We just became friends and loved each other so much.",
    },
    {
      image: "A pointless effort to avoid the rain..JPG",
      title: "A Pointless Effort to Avoid the Rain",
      memo: "Raincoat, rainproof pants, umbrella. I thought I was prepared for Thailand's rainy weather. Within seconds, I was completely soaked. So I embraced it and started doing weather reports and a little photo shoot. My phone even got water damage, but three days later, it miraculously started working again!",
    },
    {
      image: "a simple palet and reminder of a good hobbie.HEIC",
      title: "A Simple Palette and Reminder of a Good Hobby",
      memo: "Sometimes it's worth stopping to capture a moment of stillness. The mountains, the train, and the colors just fit together so well. No crazy editing or making things look fake. Just a raw photo of something beautiful. It reminded me why I love photography and why I want to share what I see with others.",
    },
    {
      image: "A skit gone well.JPEG",
      title: "A Skit Gone Well",
      memo: "After our team performed the story of Jonah being swallowed by a whale, the kids decided they wanted to reenact it themselves. And they did an incredible job! This photo was taken as they all bowed at the end of their performance.",
    },
    {
      title: "A Start to Oral Mother Tongue",
      memo: "Somehow, I got an email inviting me to an Oral Mother Tongue Zoom call with only about 200 people from around the world. I still have no idea how I ended up on that email list, but I'm so thankful I did. It stirred something in my heart for Oral Mother Tongue, and I even got people at our base to learn about it and pray into it with me.",
    },
    {
      image: "A trouble maker in the making.JPG",
      title: "A Troublemaker in the Making",
      memo: "This isn't my boy, but man, could I spend all day with him. He's got the best smile and is full of so much joy. I'm so thankful I got to spend not just three months, but six months hanging out with him and teaching him to be a little menace to his parents, in all the best ways.",
    },
    {
      image: "A week of being so on fire everybody had to see.JPG",
      title: "A Week of Being So on Fire, Everybody Had to See",
      memo: "One of our students yelled, 'Why is no one running? That's a soul!' as she ran across a bridge to share the gospel. That was the heart of this week. In this photo, I'm sitting with a homeless woman outside a library, surrounded by these massive buildings. It's crazy how small we are, yet God knows every hair on our heads. I couldn't walk down the street without seeing someone and thinking, they deserve to hear about a God who loves them.",
    },
    {
      image: "Another moo.JPEG",
      title: "Another Moo",
      memo: "I just like cows.",
    },
    {
      image: "Beauty in the quiet.HEIC",
      title: "Beauty in the Quiet",
      memo: "In the middle of Thailand, I came across this beautiful swampy area. The sky, the trees, the sunlight, and the reflection on the water were incredible. It was one of those places that maybe only a few thousand people have ever seen, and I just wanted to share how beautiful God's creation is.",
    },
    {
      image: "Church in the wild.HEIC",
      title: "Church in the Wild",
      memo: "While in Sumba, our team was invited to a church service, but everyone already had plans, so I volunteered to go. I couldn't understand a word, and my phone hadn't worked on the island. But during the service, it suddenly translated everything perfectly, even when I was asked to share my testimony. We rode scooters into the woods, walked through the brush, laid down a tarp, worshiped, ate coconuts, and shared lunch. The pastor had such a heart for his community. You could feel the love he carried.",
    },
    {
      image: "Dancing with the ruth center.JPEG",
      title: "Dancing With the Ruth Center",
      memo: "The Ruth Center is an elderly home in Thailand, and part of their activities included dancing, stretching, and worship. This photo was taken just before the dancing began. Man, was it fun seeing everybody get up and boogie!",
    },
    {
      image: "DTS in New Zealand.HEIC",
      title: "DTS in New Zealand",
      memo: "One of the first photos of our entire DTS together. After a long, hot day of running around playing games, we finally gathered for a picture. Some of us were eating ice cream, some were sweating, but this was our DTS.",
    },
    {
      image: "First time teaching english.heic",
      title: "First Time Teaching English",
      memo: "My handwriting might not be that good, and my English might not be that good either. But hey, I got the point across!",
    },
    {
      image: "holding onto the gifts god gave.jpg",
      title: "Holding Onto the Gifts God Gave Us",
      memo: "I come back to this photo so often. I didn't realize it in the moment, but God has been so faithful in placing me in ministries that make my heart overflow with love, compassion, and joy. And that's exactly what He did here.",
    },
    {
      image: "hot potato powder.jpg",
      title: "Hot Potato Powder",
      memo: "We got to play hot potato with students from a village in Thailand. The catch? If you weren't quick enough with the potato, you ended up with baby powder thrown in your face. There were a lot of powdered faces that day!",
    },
    {
      image: "I teach English not Art.HEIC",
      title: "I Teach English, Not Art",
      memo: "These two kids and the lady on the far left were incredible. We spent so much time drawing each other, laughing, and building relationships. But as you can probably tell from my drawing, there's a reason I was teaching English and not art.",
    },
    {
      image: "Indo team yay.HEIC",
      title: "Indo Team, Yay!",
      memo: "The first time we got together as a team for a photo. This was the group sent to different places across Indonesia. Two other staff and some of the most amazing students I could have asked for. Man, were these guys great.",
    },
    {
      image: "Just a new missionary.HEIC",
      title: "Just a New Missionary",
      memo: "Just me being silly, but I remember feeling so young, so new, and so ready to take on the world. Looking back now, I can see how much God has equipped me through everything He's brought me through.",
    },
    {
      image: "Just human.heic",
      title: "Just Human",
      memo: "Some people might look at this photo and think I look different or don't fit in. But we're all just human. I'm here because these people are just as worthy of hearing the same good news I've been told. Deep down, we're not so different.",
    },
    {
      image: "Moo.HEIC",
      title: "Moo",
      memo: "What can I say? I just like cows.",
    },
    {
      image: "My partner in crime.HEIC",
      title: "My Partner in Crime",
      memo: "This is Nixon. He's been everywhere with me. I stole him from my older sister so many times when I was younger that I basically claimed him as my own. He's my cat, nobody can tell me otherwise, and I love him very much.",
    },
    {
      image: "pukena.HEIC",
      title: "Pūkana",
      memo: "Hanging out with a couple of Māori warriors at the Treaty Grounds in New Zealand after a performance. It was pretty incredible, and man, is this intimidating!",
    },
    {
      image: "surfing and missions.HEIC",
      title: "Surfing and Missions",
      memo: "Who would have thought you could surf, tell people about God, and live in community all at the same time? I never would have pictured myself here, but man, am I grateful.",
    },
    {
      image: "Thai worship.HEIC",
      title: "Thai Worship",
      memo: "Seeing kids around 10 or 11 years old worshiping God was one of the most beautiful things I've witnessed. We set up speakers near the beach and worshiped as tourists stopped to listen. We were filling that town with worship to Jesus.",
    },
    {
      title: "The Best Bible Teacher in the West",
      memo: "This is Bill. He has one arm, and the first thing he asked after finding out where I was from was whether I had any clothes from home that he could wear. I've never heard somebody teach the Bible quite like this man. If he ever teaches a School of Biblical Studies, that's where I want to go.",
    },
    {
      image: "The last supper.JPEG",
      title: "The Last Supper",
      memo: "One of the last times our entire DTS got together to sit down, enjoy a meal, and praise God for everything He had brought us through.",
    },
    {
      image: "The vail is torn.HEIC",
      title: "The Veil Is Torn",
      memo: "This photo captures such a beautiful moment of lordship and surrender. Everyone laying things down before Jesus because of everything He's done for us. Mark Parker taught us so much that week, and I'll always be thankful for it.",
    },
    {
      image: "These kid can tkeep up with me.heic",
      title: "These Kids Can't Keep Up With Me",
      memo: "We were playing musical chairs, and I absolutely loved it. We played so many games together, but this was definitely one of my favorites. What can I say? I'm a little quick on my feet. These kids just can't keep up!",
    },
    {
      image: "These kids Stole My Heart.HEIC",
      title: "These Kids Stole My Heart",
      memo: "Around 30 kids would show up every afternoon at about two o'clock. They made me sweat, and they stole my heart. They reminded me how much I love kids ministry and how deeply I want them to know Jesus. These kids deserve to be loved, served, and given every opportunity to know the life God has for them.",
    },
    {
      image: "Trash baggin.HEIC",
      title: "Trash Baggin'",
      memo: "One rainy New Zealand night, we decided to grab some trash bags, turn them into ponchos, and slide down a hill. Add a little dish soap and a couple of boogie boards, and man, we were flying!",
    },
    {
      image: "Trying to make sence of the Trinity.jpg",
      title: "Trying to Make Sense of the Trinity",
      memo: "Sitting with a beautiful view of the Hawaiian ocean, discussing one of the most difficult topics to wrap our minds around: the Trinity. Man, do I love Diakonos.",
    },
    {
      image: "what the bam bam.HEIC",
      title: "What the Bam Bam?",
      memo: "There was this amazing Jamaican song playing, and this kid started dancing along with me. While everyone else was doing their thing, he and I were just vibing together.",
    },
    {
      image: "Who can loosen orians belt.HEIC",
      title: "Who Can Loosen Orion's Belt?",
      memo: "A glimpse into the Milky Way. Taking this photo reminded me of Job, when God puts everything into perspective and asks who can loosen Orion's belt. He has all authority, all knowledge, and all power. Sometimes looking up at the stars is all it takes to remember how great He is.",
    },
    {
      image: "Who is jesus.HEIC",
      title: "Who Is Jesus?",
      memo: "An incredible day evangelizing at one of the biggest malls I've ever been to in Bangkok with two of my best friends. We had so many responses and conversations. I was just full of the joy of the Lord, and His grace was so evident that day.",
    },
    {
      image: "Why I love photography.HEIC",
      title: "Why I Love Photography",
      memo: "Photography is such a beautiful way to capture the things around us. There's so much to experiment with, especially at night. I took this photo in New Zealand as cars drove up and down the road, capturing their light trails against the night sky.",
    },
    {
      image: "Wing with Billy.JPG",
      title: "Wings With Billy",
      memo: "Billy taught on evangelism during our mini outreach to Spokane. Between his teaching and what God was doing in my heart, I believe that experience is one of the reasons I'm as bold in my faith as I am today. God used that time to prune the right things in my heart and point me in the right direction.",
    },
  ];
  const slides = missionPhotos.filter(({ image }) => image).map(({ image, title, memo }) => ({
    image: `/images/mission/${encodeURIComponent(image.replace(/\.[^.]+$/, ".web.jpg"))}`,
    alt: title,
    title,
    note: memo,
  }));
  const cards = [...missionCarousel.querySelectorAll(".mission-card")];
  const carouselStage = missionCarousel.querySelector(".carousel-stage");
  const previousButton = missionCarousel.querySelector(".carousel-arrow-prev");
  const nextButton = missionCarousel.querySelector(".carousel-arrow-next");
  const dotsContainer = document.querySelector("#mission-carousel-dots");
  const memoCount = document.querySelector("#photo-memo-count");
  const memoTitle = document.querySelector("#photo-memo-title");
  const memoText = document.querySelector("#photo-memo-text");
  const dots = slides.map((slide, slideIndex) => {
    const dot = document.createElement("button");
    dot.className = "carousel-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", `Show photo ${slideIndex + 1} of ${slides.length}: ${slide.title}`);
    dot.addEventListener("click", () => showSlide(slideIndex));
    dotsContainer.append(dot);
    return dot;
  });
  const lightbox = document.querySelector("#mission-lightbox");
  const lightboxImage = document.querySelector("#mission-lightbox-image");
  const lightboxClose = lightbox.querySelector(".mission-lightbox-close");
  let activeIndex = 0;
  let touchStartX = null;
  let suppressPhotoClick = false;

  function setCardSlide(card, slideIndex) {
    const index = (slideIndex + slides.length) % slides.length;
    const slide = slides[index];
    const image = card.querySelector("img");
    const button = card.querySelector(".mission-photo-button");
    image.classList.add("is-changing");
    image.src = slide.image;
    image.alt = slide.alt;
    button.setAttribute("aria-label", `View larger: ${slide.title}`);
    card.querySelector("figcaption").textContent = slide.title;
    card.dataset.slideIndex = String(index);
    card.setAttribute("aria-current", String(card.dataset.cardPosition === "center"));
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => image.classList.remove("is-changing"));
    });
  }

  function updateCarouselCards() {
    const positions = {
      left: activeIndex - 1,
      center: activeIndex,
      right: activeIndex + 1,
    };
    for (const card of cards) setCardSlide(card, positions[card.dataset.cardPosition]);
  }

  function showSlide(slideIndex) {
    activeIndex = (slideIndex + slides.length) % slides.length;
    const slide = slides[activeIndex];

    updateCarouselCards();
    memoCount.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    memoTitle.textContent = slide.title;
    memoText.textContent = slide.note;
    for (const [dotIndex, dot] of dots.entries()) {
      if (dotIndex === activeIndex) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    }
  }

  function showLightbox(slideIndex) {
    const slide = slides[slideIndex];
    lightboxImage.src = slide.image;
    lightboxImage.alt = slide.alt;
    lightbox.showModal();
  }

  for (const card of cards) {
    card.querySelector(".mission-photo-button").addEventListener("click", () => {
      if (suppressPhotoClick) return;
      showLightbox(Number(card.dataset.slideIndex));
    });
  }
  previousButton.addEventListener("click", () => showSlide(activeIndex - 1));
  nextButton.addEventListener("click", () => showSlide(activeIndex + 1));
  carouselStage.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  carouselStage.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const swipeDistance = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(swipeDistance) < 45) return;
    suppressPhotoClick = true;
    showSlide(activeIndex + (swipeDistance < 0 ? 1 : -1));
    window.setTimeout(() => {
      suppressPhotoClick = false;
    }, 350);
  });
  lightboxClose.addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  showSlide(activeIndex);
}
