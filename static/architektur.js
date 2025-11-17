const germanUniversities = [
  {
    rank: 1,
    name: "Technische Universität München",
    location: "München, Bayern",
    prestige: 9.5,
    quality: 9.0,
    difficulty: 8.5,
    diversity: 8.0,
    research: 9.5,
  },
  {
    rank: 2,
    name: "Universität Stuttgart",
    location: "Stuttgart, Baden-Württemberg",
    prestige: 8.5,
    quality: 9.0,
    difficulty: 8.0,
    diversity: 7.5,
    research: 9.0,
  },
  {
    rank: 3,
    name: "Karlsruher Institut für Technologie (KIT)",
    location: "Karlsruhe, Baden-Württemberg",
    prestige: 8.5,
    quality: 8.5,
    difficulty: 8.5,
    diversity: 7.0,
    research: 9.0,
  },
  {
    rank: 4,
    name: "RWTH Aachen",
    location: "Aachen, Nordrhein-Westfalen",
    prestige: 8.5,
    quality: 8.5,
    difficulty: 9.0,
    diversity: 8.5,
    research: 9.0,
  },
  {
    rank: 5,
    name: "Technische Universität Darmstadt",
    location: "Darmstadt, Hessen",
    prestige: 8.0,
    quality: 8.0,
    difficulty: 8.0,
    diversity: 7.0,
    research: 8.5,
  },
  {
    rank: 6,
    name: "Technische Universität Berlin",
    location: "Berlin, Brandenburg",
    prestige: 8.0,
    quality: 8.5,
    difficulty: 7.5,
    diversity: 9.0,
    research: 8.5,
  },
  {
    rank: 7,
    name: "Bauhaus-Universität Weimar",
    location: "Weimar, Thüringen",
    prestige: 7.5,
    quality: 8.5,
    difficulty: 7.0,
    diversity: 7.5,
    research: 7.0,
  },
  {
    rank: 8,
    name: "Technische Universität Dresden",
    location: "Dresden, Sachsen",
    prestige: 7.5,
    quality: 8.0,
    difficulty: 7.5,
    diversity: 7.0,
    research: 8.0,
  },
];

const internationalUniversities = [
  {
    rank: 1,
    name: "The Bartlett School of Architecture (UCL)",
    location: "London, Vereinigtes Königreich",
    prestige: 10.0,
    quality: 10.0,
    difficulty: 9.5,
    diversity: 9.5,
    research: 10.0,
  },
  {
    rank: 2,
    name: "Massachusetts Institute of Technology (MIT)",
    location: "Cambridge, USA",
    prestige: 10.0,
    quality: 10.0,
    difficulty: 10.0,
    diversity: 9.0,
    research: 10.0,
  },
  {
    rank: 3,
    name: "Delft University of Technology",
    location: "Delft, Niederlande",
    prestige: 9.5,
    quality: 9.5,
    difficulty: 9.0,
    diversity: 9.5,
    research: 9.5,
  },
  {
    rank: 4,
    name: "ETH Zürich",
    location: "Zürich, Schweiz",
    prestige: 9.5,
    quality: 9.5,
    difficulty: 9.5,
    diversity: 9.0,
    research: 10.0,
  },
  {
    rank: 5,
    name: "Harvard University",
    location: "Cambridge, USA",
    prestige: 10.0,
    quality: 9.5,
    difficulty: 10.0,
    diversity: 8.5,
    research: 9.5,
  },
  {
    rank: 6,
    name: "University of California, Berkeley (UCB)",
    location: "Berkeley, USA",
    prestige: 9.5,
    quality: 9.0,
    difficulty: 9.0,
    diversity: 9.5,
    research: 9.5,
  },
  {
    rank: 7,
    name: "Tsinghua University",
    location: "Peking, China",
    prestige: 9.0,
    quality: 9.0,
    difficulty: 9.5,
    diversity: 7.0,
    research: 9.5,
  },
  {
    rank: 8,
    name: "National University of Singapore (NUS)",
    location: "Singapur",
    prestige: 9.0,
    quality: 9.0,
    difficulty: 8.5,
    diversity: 9.5,
    research: 9.0,
  },
  {
    rank: 9,
    name: "Politecnico di Milano",
    location: "Mailand, Italien",
    prestige: 8.5,
    quality: 8.5,
    difficulty: 8.0,
    diversity: 8.5,
    research: 8.5,
  },
  {
    rank: 10,
    name: "Columbia University",
    location: "New York, USA",
    prestige: 9.5,
    quality: 9.0,
    difficulty: 9.5,
    diversity: 9.0,
    research: 9.0,
  },
];

const rankingConfigs = {
  german: {
    sectionId: "german-unis",
    tbodyId: "german-tbody",
    cardsId: "german-cards",
    data: germanUniversities,
  },
  international: {
    sectionId: "international-unis",
    tbodyId: "international-tbody",
    cardsId: "international-cards",
    data: internationalUniversities,
  },
};

let closeMobileNav = () => {};

function getRatingLabel(score) {
  if (score >= 9.0) return "Exzellent";
  if (score >= 8.0) return "Sehr Gut";
  if (score >= 7.0) return "Gut";
  if (score >= 6.0) return "Befriedigend";
  return "Ausreichend";
}

function createRatingBar(score, maxScore = 10) {
  const percentage = Math.round((score / maxScore) * 100);
  const label = `${score.toFixed(1)} / 10 – ${getRatingLabel(score)}`;
  return `
    <div class="rating-container">
      <div class="rating-bar" role="progressbar" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${score.toFixed(
        1,
      )}" aria-label="${label}">
        <div class="rating-fill" style="width: ${percentage}%"></div>
      </div>
      <span class="rating-label">${label}</span>
    </div>
  `;
}

function createTableRow(uni) {
  return `
    <tr>
      <td><span class="rank-number">#${uni.rank}</span></td>
      <td>
        <div class="uni-name">${uni.name}</div>
        <div class="uni-location">${uni.location}</div>
      </td>
      <td>${createRatingBar(uni.prestige)}</td>
      <td>${createRatingBar(uni.quality)}</td>
      <td>${createRatingBar(uni.difficulty)}</td>
      <td>${createRatingBar(uni.diversity)}</td>
      <td>${createRatingBar(uni.research)}</td>
    </tr>
  `;
}

function createCard(uni) {
  return `
    <article class="uni-card">
      <div class="uni-card-header">
        <div class="uni-card-rank">Rang ${uni.rank}</div>
        <div class="uni-name">${uni.name}</div>
        <div class="uni-location">${uni.location}</div>
      </div>
      ${createCategoryRow("Prestige", uni.prestige)}
      ${createCategoryRow("Studienqualität", uni.quality)}
      ${createCategoryRow("Schwierigkeit", uni.difficulty)}
      ${createCategoryRow("Vielfalt", uni.diversity)}
      ${createCategoryRow("Forschung", uni.research)}
    </article>
  `;
}

function createCategoryRow(label, score) {
  return `
    <div class="category-row">
      <span class="category-name">${label}</span>
      <div class="category-value">
        ${createRatingBar(score)}
      </div>
    </div>
  `;
}

function sortUniversities(universities, criteria) {
  const sorted = [...universities];
  if (criteria === "rank") {
    return sorted.sort((a, b) => a.rank - b.rank);
  }
  return sorted.sort((a, b) => b[criteria] - a[criteria]);
}

function renderUniversities(config, criteria = "rank") {
  const sortedUnis = sortUniversities(config.data, criteria);
  const tbody = document.getElementById(config.tbodyId);
  const cards = document.getElementById(config.cardsId);

  if (tbody) {
    tbody.innerHTML = sortedUnis.map(createTableRow).join("");
  }

  if (cards) {
    cards.innerHTML = sortedUnis.map(createCard).join("");
  }
}

function setupFilterPills(config) {
  const section = document.getElementById(config.sectionId);
  if (!section) return;

  const pills = Array.from(section.querySelectorAll(".pill"));

  const setActive = (target) => {
    pills.forEach((pill) => {
      const isActive = pill === target;
      pill.classList.toggle("active", isActive);
      pill.setAttribute("aria-pressed", String(isActive));
    });
  };

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const sortCriteria = pill.getAttribute("data-sort") || "rank";
      setActive(pill);
      renderUniversities(config, sortCriteria);
    });
  });
}

function initRankings() {
  Object.values(rankingConfigs).forEach((config) => {
    renderUniversities(config, "rank");
    setupFilterPills(config);
  });
}

function initNavigation() {
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector(".nav-toggle");
  if (!header || !navToggle) return;

  closeMobileNav = () => {
    header.dataset.navState = "closed";
    navToggle.setAttribute("aria-expanded", "false");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = header.dataset.navState === "open";
    header.dataset.navState = isOpen ? "closed" : "open";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  document
    .querySelectorAll("#primary-nav a")
    .forEach((link) => link.addEventListener("click", () => closeMobileNav()));

  document.addEventListener("keyup", (event) => {
    if (event.key === "Escape") {
      closeMobileNav();
    }
  });
}

function initSmoothScroll() {
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const triggers = document.querySelectorAll(
    'a[href^="#"]:not([href="#"]), [data-scroll-target]',
  );

  const scrollToTarget = (selector) => {
    if (!selector || selector === "#") return;
    const target = document.querySelector(selector);
    if (!target) return;
    target.scrollIntoView({
      behavior: reduceMotionQuery.matches ? "auto" : "smooth",
      block: "start",
    });
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      const selector =
        trigger.getAttribute("href")?.startsWith("#")
          ? trigger.getAttribute("href")
          : trigger.dataset.scrollTarget;

      if (!selector || !selector.startsWith("#")) return;

      event.preventDefault();
      scrollToTarget(selector);
      closeMobileNav();

      if (history.replaceState) {
        history.replaceState(null, "", selector);
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initRankings();
  initNavigation();
  initSmoothScroll();
});
