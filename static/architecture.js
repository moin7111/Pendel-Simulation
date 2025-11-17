const METRICS = [
  { key: "prestige", label: "Prestige" },
  { key: "quality", label: "Studienqualität" },
  { key: "difficulty", label: "Schwierigkeit" },
  { key: "diversity", label: "Vielfalt" },
  { key: "research", label: "Forschung" },
];

const ratingScale = [
  { min: 9, label: "Exzellent" },
  { min: 8, label: "Sehr Gut" },
  { min: 7, label: "Gut" },
  { min: 6, label: "Befriedigend" },
  { min: -Infinity, label: "Ausreichend" },
];

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

const careerPaths = [
  {
    title: "Master-Studium (Empfohlen)",
    badge: { variant: "recommended", text: "Meist gewählt" },
    description:
      "Der klassische Weg zur Architekt:innenlizenz. Ein Master ist in Deutschland für die Eintragung in die Architektenkammer nahezu Pflicht.",
    lists: [
      {
        heading: "Spezialisierungen",
        items: [
          "Architektur & Städtebau",
          "Nachhaltiges Bauen / Green Building",
          "Denkmalpflege",
          "Innenarchitektur & Computational Design",
          "Landschaftsarchitektur",
        ],
      },
      {
        heading: "Vorteile",
        items: [
          "Titel „Architekt:in“ nach 2 Jahren Praxis möglich",
          "Höheres Einstiegsgehalt (+15–25 %)",
          "Bessere Karriere- & Führungsoptionen",
          "Internationale Anerkennung",
        ],
      },
    ],
    stats: [
      { label: "Dauer", value: "2–4 Semester" },
      { label: "Gehalt nach Master", value: "42.000–52.000 € p.a." },
      { label: "Empfehlung", value: "★★★★★" },
    ],
  },
  {
    title: "Direkter Berufseinstieg",
    badge: { variant: "alternative", text: "Praxisorientiert" },
    description:
      "Ideal, wenn Sie schnell in Projekten mitarbeiten und finanzielle Unabhängigkeit gewinnen möchten.",
    lists: [
      {
        heading: "Mögliche Rollen",
        items: [
          "Junior Architekt: Projektmitarbeit",
          "Bauzeichner:in / CAD-Spezialist:in",
          "Projektassistenz im Management",
          "Bauleiter-Assistenz",
        ],
      },
      {
        heading: "Vorteile",
        items: [
          "Sofortiges Einkommen",
          "Frühe Praxiserfahrung",
          "Netzwerkaufbau",
          "Master kann später berufsbegleitend folgen",
        ],
      },
      {
        heading: "Nachteile",
        items: [
          "Kein Architektentitel ohne Master",
          "Langfristig begrenzte Karriereoptionen",
          "Geringeres Einstiegsgehalt",
        ],
      },
    ],
    stats: [
      { label: "Einstiegsgehalt", value: "32.000–42.000 € p.a." },
      { label: "Karrierepotenzial", value: "★★★☆☆" },
    ],
  },
  {
    title: "Promotion & Forschung",
    badge: { variant: "academic", text: "Akademisch" },
    description:
      "Für alle, die Forschung, Lehre und Innovation vorantreiben möchten – an Hochschulen oder in F&E-Abteilungen.",
    lists: [
      {
        heading: "Forschungsfelder",
        items: [
          "Nachhaltiges Bauen & Materialforschung",
          "Digitale Architektur, BIM & KI",
          "Urbanistik & soziale Raumplanung",
          "Bauphysik und Konstruktionstechniken",
        ],
      },
      {
        heading: "Karrieremöglichkeiten",
        items: [
          "Professor:in / Lehrende",
          "Wissenschaftliche Mitarbeit",
          "Forschungsleitung",
          "Beratung für Spezialthemen",
        ],
      },
    ],
    stats: [
      { label: "Promotionsdauer", value: "3–5 Jahre" },
      { label: "Gehalt (Doktorand:in)", value: "45.000–55.000 € p.a." },
      { label: "Empfehlung", value: "★★★★☆" },
    ],
  },
  {
    title: "Alternative Karrierewege",
    badge: { variant: "alternative", text: "Vielfältig" },
    description:
      "Architekturwissen öffnet Türen in Immobilien, Visualisierung, Beratung oder Verwaltung – oft mit attraktiven Gehältern.",
    lists: [
      {
        heading: "Branchen",
        items: [
          "Immobilienentwicklung & Asset Management",
          "Bauprojektmanagement & Stadtplanung",
          "Fachpresse & Architekturkritik",
          "Visualisierung, 3D-Design, VR/AR",
          "Bauproduktindustrie & Beratung",
        ],
      },
      {
        heading: "Vorteile",
        items: [
          "Häufig höhere Gehälter",
          "Bessere Work-Life-Balance",
          "Neue kreative Perspektiven",
          "Transfer des Architektur-Know-hows",
        ],
      },
    ],
    stats: [
      { label: "Gehaltsrange", value: "40.000–80.000 € p.a." },
      { label: "Zusatzqualifikation", value: "oft erforderlich" },
      { label: "Empfehlung", value: "★★★★☆" },
    ],
  },
  {
    title: "Selbstständigkeit / Eigenes Büro",
    badge: { variant: "entrepreneurial", text: "Unternehmerisch" },
    description:
      "Gründen Sie Ihr eigenes Büro oder werden Sie Partner:in – ideal für alle mit Unternehmergeist und klarer Vision.",
    lists: [
      {
        heading: "Voraussetzungen",
        items: [
          "Masterabschluss & 2 Jahre Erfahrung",
          "Eintragung in die Architektenkammer",
          "Betriebswirtschaftliche Kenntnisse",
          "Startkapital von 20.000–50.000 €",
        ],
      },
      {
        heading: "Vorteile & Risiken",
        items: [
          "Volle kreative Freiheit",
          "Unbegrenztes Einkommenspotenzial",
          "Hohe Anfangsinvestitionen",
          "Hohe Arbeitsbelastung in der Aufbauphase",
        ],
      },
    ],
    stats: [
      { label: "Zeitinvestition", value: "7+ Jahre" },
      { label: "Einkommenspotenzial", value: "50.000–150.000+ € p.a." },
      { label: "Empfehlung", value: "★★★★☆" },
    ],
  },
  {
    title: "Internationale Karriere",
    badge: { variant: "international", text: "Global" },
    description:
      "Architektur ist international gefragt. Die Mischung aus sprachlichen Skills, Auslandserfahrung und Spezialisierung eröffnet globale Chancen.",
    lists: [
      {
        heading: "Hotspots",
        items: [
          "Naher Osten: Mega-Projekte, 60–100k € p.a.",
          "Schweiz: 70–90k € p.a., hohe Lebensqualität",
          "USA & Skandinavien: Innovation & Nachhaltigkeit",
          "Asien (Singapur, Hongkong): rasantes Wachstum",
        ],
      },
      {
        heading: "Voraussetzungen",
        items: [
          "Sehr gute Englischkenntnisse",
          "Master von renommierter Uni",
          "Internationale Praktika/ Semester",
          "Anerkennung der Abschlüsse prüfen",
        ],
      },
    ],
    stats: [
      { label: "Vorbereitung", value: "1–2 Jahre" },
      { label: "Gehaltsbonus", value: "+20–80 % vs. DE" },
      { label: "Empfehlung", value: "★★★★★" },
    ],
  },
];

const timelineSteps = [
  {
    title: "Bachelor-Studium (3–4 Jahre)",
    description: "Grundlagen schaffen, Praktika absolvieren, Auslandssemester planen.",
  },
  {
    title: "Master-Studium mit Spezialisierung (1–2 Jahre)",
    description: "Fokus auf Zukunftsthemen wie Nachhaltigkeit oder Digitalisierung.",
  },
  {
    title: "Berufserfahrung (2–5 Jahre)",
    description: "In renommierten Büros Projekte begleiten, Netzwerk ausbauen.",
  },
  {
    title: "Kammereintragung & Spezialisierung",
    description: "Architektentitel sichern, Expertise in einer Nische aufbauen.",
  },
  {
    title: "Eigenes Büro oder Partnerschaft",
    description: "Selbstständigkeit oder Leitung einer Unit ab Jahr 7–10.",
  },
];

const categoryDescriptions = [
  {
    title: "Prestige (Lebenslauf-Impact)",
    description:
      "Reputation bei Arbeitgebern, Rankingpositionen, Alumni-Erfolge und internationale Sichtbarkeit.",
  },
  {
    title: "Studienqualität",
    description:
      "Lehrkonzept, Betreuungsverhältnis, Ausstattung der Studios, digitale Infrastruktur und Praxisnähe.",
  },
  {
    title: "Schwierigkeit",
    description:
      "Zulassungsquoten, Arbeitslast, Projektanforderungen, Abbrecherquoten und Prüfungsniveau.",
  },
  {
    title: "Vielfalt",
    description:
      "Internationalität, Austauschprogramme, Diversität der Studierenden und interdisziplinäre Zusammenarbeit.",
  },
  {
    title: "Forschungsexzellenz",
    description:
      "Publikationen, Drittmittel, Innovationen, Lab-Infrastruktur und Einfluss auf die globale Architekturentwicklung.",
  },
];

const smoothScroll = (selector) => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(selector).forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    link.addEventListener("click", (event) => {
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  });
};

const getRatingLabel = (score) => {
  const match = ratingScale.find((level) => score >= level.min);
  return match ? match.label : "Ausreichend";
};

const createRatingBar = (score) => {
  const percentage = Math.min(100, Math.max(0, (score / 10) * 100));
  const label = getRatingLabel(score);
  const value = score.toFixed(1);
  return `
    <div class="rating-container" role="img" aria-label="${label} (${value}/10)">
      <div class="rating-bar" aria-hidden="true">
        <span class="rating-fill" style="width:${percentage}%"></span>
      </div>
      <span class="rating-label">${label}</span>
    </div>
  `;
};

const createTableRow = (uni) => {
  const metrics = METRICS.map((metric) => `<td>${createRatingBar(uni[metric.key])}</td>`).join("");
  return `
    <tr class="fade-in">
      <td><span class="rank-number">#${uni.rank.toString().padStart(2, "0")}</span></td>
      <td>
        <div class="uni-name">${uni.name}</div>
        <div class="uni-location">${uni.location}</div>
      </td>
      ${metrics}
    </tr>
  `;
};

const createCard = (uni) => {
  const metrics = METRICS.map(
    (metric) => `
      <div class="card-metric">
        <dt>${metric.label}</dt>
        <dd>${createRatingBar(uni[metric.key])}</dd>
      </div>
    `,
  ).join("");

  return `
    <article class="uni-card fade-in">
      <div class="uni-card-header">
        <div class="uni-card-rank">Rang ${uni.rank}</div>
        <div class="uni-name">${uni.name}</div>
        <div class="uni-location">${uni.location}</div>
      </div>
      <dl class="card-metrics">
        ${metrics}
      </dl>
    </article>
  `;
};

const sortUniversities = (universities, criteria) => {
  const sorter =
    criteria === "rank"
      ? (a, b) => a.rank - b.rank
      : (a, b) => (b[criteria] ?? 0) - (a[criteria] ?? 0);
  return [...universities].sort(sorter);
};

const renderUniversities = (universities, tableId, cardsId) => {
  const tbody = document.getElementById(tableId);
  const cards = document.getElementById(cardsId);
  if (tbody) {
    tbody.innerHTML = universities.map((uni) => createTableRow(uni)).join("");
  }
  if (cards) {
    cards.innerHTML = universities.map((uni) => createCard(uni)).join("");
  }
};

const setupFilters = (sectionId, universities, tableId, cardsId) => {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const pills = Array.from(section.querySelectorAll(".pill"));
  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      pills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      const sortCriteria = pill.getAttribute("data-sort") ?? "rank";
      const sorted = sortUniversities(universities, sortCriteria);
      renderUniversities(sorted, tableId, cardsId);
    });
  });
};

const renderCareerPaths = () => {
  const container = document.getElementById("career-grid");
  if (!container) return;
  container.innerHTML = careerPaths
    .map(
      (card) => `
        <article class="career-path-card fade-in">
          <header class="career-path-header">
            <span class="career-badge ${card.badge.variant}">${card.badge.text}</span>
            <h3>${card.title}</h3>
            <p class="career-description">${card.description}</p>
          </header>
          ${card.lists
            .map(
              (list) => `
                <div class="career-details">
                  <h4>${list.heading}</h4>
                  <ul class="career-list">
                    ${list.items.map((item) => `<li>${item}</li>`).join("")}
                  </ul>
                </div>
              `,
            )
            .join("")}
          <div class="career-stats">
            ${card.stats
              .map(
                (stat) => `
                  <div class="stat-item">
                    <span class="stat-label">${stat.label}</span>
                    <span class="stat-value">${stat.value}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");
};

const renderTimeline = () => {
  const container = document.getElementById("timeline");
  if (!container) return;
  container.innerHTML = timelineSteps
    .map(
      (step, index) => `
        <div class="timeline-item fade-in">
          <span class="timeline-marker">${index + 1}</span>
          <div class="timeline-content">
            <h4>${step.title}</h4>
            <p>${step.description}</p>
          </div>
        </div>
      `,
    )
    .join("");
};

const renderCategories = () => {
  const container = document.getElementById("category-grid");
  if (!container) return;
  container.innerHTML = categoryDescriptions
    .map(
      (category) => `
        <article class="category-card fade-in">
          <h3>${category.title}</h3>
          <p>${category.description}</p>
        </article>
      `,
    )
    .join("");
};

document.addEventListener("DOMContentLoaded", () => {
  const sections = [
    {
      sectionId: "german-unis",
      data: germanUniversities,
      tableId: "german-tbody",
      cardsId: "german-cards",
    },
    {
      sectionId: "international-unis",
      data: internationalUniversities,
      tableId: "international-tbody",
      cardsId: "international-cards",
    },
  ];

  sections.forEach(({ sectionId, data, tableId, cardsId }) => {
    renderUniversities(sortUniversities(data, "rank"), tableId, cardsId);
    setupFilters(sectionId, data, tableId, cardsId);
  });

  renderCareerPaths();
  renderTimeline();
  renderCategories();
  smoothScroll('a[href^="#"]');
});

