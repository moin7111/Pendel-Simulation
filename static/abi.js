(function(){
  const STORAGE_KEY = 'abi_mvp_state_v1';
  /** @type {import('./types').State} */
  let state = loadState();
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Navigation
  const sections = ['dashboard','decks','study'];
  function show(section){
    sections.forEach(s => $(s).classList.toggle('hidden', s!==section));
  }
  $('navDashboard').onclick = () => show('dashboard');
  $('navDecks').onclick = () => { renderDecks(); show('decks'); };
  $('navStudy').onclick = () => { prepareStudySelectors(); show('study'); };

  // Quick actions
  $('startQuick').onclick = () => {
    const mode = /** @type {HTMLSelectElement} */($('quickMode')).value;
    prepareStudySelectors();
    /** @type {HTMLSelectElement} */($('studyMode')).value = mode;
    show('study');
  };

  // Import/Export/Seed
  $('exportJson').onclick = () => {
    downloadJson(state, 'abi_mvp_export.json');
  };
  $('importJson').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (validateState(data)) {
          state = data;
          persist();
          renderAll();
          alert('Import erfolgreich.');
        } else {
          alert('Ungültiges JSON‑Format.');
        }
      } catch(err){
        alert('Import fehlgeschlagen: '+ err);
      }
    };
    reader.readAsText(file);
  });
  $('seedDemo').onclick = () => {
    state = seedDemoData();
    persist();
    renderAll();
  };

  // Deck creation
  $('createDeck').onclick = () => {
    const title = /** @type {HTMLInputElement} */($('deckTitle')).value.trim();
    const type = /** @type {HTMLSelectElement} */($('deckType')).value;
    if(!title) { alert('Titel angeben.'); return; }
    const id = uuid();
    state.decks.push({ id, title, deck_type: type, created_at: Date.now() });
    persist();
    $('deckTitle').value = '';
    renderDecks();
    prepareStudySelectors();
  };

  $('addItem').onclick = () => {
    const deckId = /** @type {HTMLSelectElement} */($('itemDeck')).value;
    const front = /** @type {HTMLInputElement} */($('frontInput')).value.trim();
    const back = /** @type {HTMLInputElement} */($('backInput')).value.trim();
    if(!deckId || !front || !back) { alert('Alle Felder ausfüllen.'); return; }
    const id = uuid();
    state.items.push({ id, deck_id: deckId, item_type: inferItemType(deckId), front, back, created_at: Date.now() });
    // initialize mastery for this user (single‑user MVP)
    state.mastery[`${state.user.id}:${id}`] = { easiness: 2.5, repeat_count: 0, prev_interval: 0, next_due: 0, last_seen: 0, mastery_score: 0 };
    persist();
    $('frontInput').value = '';
    $('backInput').value = '';
    renderDecks();
  };

  // Study flow
  let session = null; // {queue: Item[], currentIndex, correctCount}

  $('startStudy').onclick = startSession;
  $('revealBtn').onclick = () => {
    $('cardBack').classList.remove('hidden');
    $('revealBtn').classList.add('hidden');
    $('flipBtn').classList.remove('hidden');
    $('qualityControls').classList.remove('hidden');
    const mode = /** @type {HTMLSelectElement} */($('studyMode')).value;
    $('vocabInputRow').classList.toggle('hidden', mode !== 'vocab');
    if (mode === 'vocab') {
      $('vocabAnswer').focus();
    }
  };
  $('flipBtn').onclick = () => {
    $('cardBack').classList.add('hidden');
    $('revealBtn').classList.remove('hidden');
    $('flipBtn').classList.add('hidden');
    $('qualityControls').classList.add('hidden');
  };
  $('checkVocab').onclick = () => {
    const input = /** @type {HTMLInputElement} */($('vocabAnswer')).value.trim().toLowerCase();
    const expected = String($('cardBack').textContent || '').trim().toLowerCase();
    const ok = lenientMatch(input, expected);
    $('vocabFeedback').textContent = ok ? '✓ korrekt (lenient)' : '✗ falsch';
  };
  $$('#qualityControls [data-q]').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = Number(btn.getAttribute('data-q'));
      const confidence = Number(/** @type {HTMLInputElement} */($('confidence')).value);
      submitAnswer(q, confidence);
    });
  });
  $('speakBtn').onclick = () => {
    const utter = new SpeechSynthesisUtterance(String($('cardFront').textContent || ''));
    utter.rate = 1.0; utter.pitch = 1.0; utter.lang = detectLang(/** @type {HTMLSelectElement} */($('studyMode')).value);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  function startSession(){
    const mode = /** @type {HTMLSelectElement} */($('studyMode')).value;
    const deckId = /** @type {HTMLSelectElement} */($('studyDeck')).value;
    const qty = Number(/** @type {HTMLSelectElement} */($('studyQty')).value);
    const items = dueItems(mode, deckId).slice(0, qty);
    session = { queue: items, currentIndex: 0, correctCount: 0 };
    if (items.length === 0) { alert('Keine fälligen Karten.'); return; }
    renderCard();
  }

  function renderCard(){
    if(!session) return;
    const item = session.queue[session.currentIndex];
    $('cardFront').textContent = item.front;
    $('cardBack').textContent = item.back;
    $('cardBack').classList.add('hidden');
    $('revealBtn').classList.remove('hidden');
    $('flipBtn').classList.add('hidden');
    $('qualityControls').classList.add('hidden');
    $('vocabInputRow').classList.add('hidden');
    $('progressInfo').textContent = `${session.currentIndex+1}/${session.queue.length}`;
  }

  function submitAnswer(quality, confidence){
    if(!session) return;
    const item = session.queue[session.currentIndex];
    const key = `${state.user.id}:${item.id}`;
    const m = state.mastery[key] || { easiness: 2.5, repeat_count: 0, prev_interval: 0, next_due: 0, last_seen: 0, mastery_score: 0 };
    const updated = updateSM2(m, quality, confidence);
    state.mastery[key] = updated;
    if (quality >= 4) session.correctCount++;
    persist();
    nextCard();
  }

  function nextCard(){
    if(!session) return;
    session.currentIndex++;
    if (session.currentIndex >= session.queue.length){
      alert(`Fertig! Richtig: ${session.correctCount}/${session.queue.length}`);
      session = null;
      renderAll();
      return;
    }
    renderCard();
  }

  // SM-2 with confidence (client-side MVP)
  function updateSM2(m, quality, confidence){
    let ef = m.easiness ?? 2.5;
    let rep = m.repeat_count ?? 0;
    const prev = m.prev_interval ?? 0;
    let next_interval = 0;
    if (quality < 3){
      rep = 0; next_interval = 1;
    } else {
      rep += 1;
      ef = Math.max(1.3, ef + 0.1 - (5 - quality) * 0.08 + (confidence - 3) * 0.02);
      if (rep === 1) next_interval = 1;
      else if (rep === 2) next_interval = 6;
      else next_interval = Math.round(prev * ef);
    }
    const next_due = Date.now() + next_interval * 24*3600*1000;
    const mastery_score = Math.min(1, (ef - 1.3) / (2.5 - 1.3));
    return { easiness: ef, repeat_count: rep, prev_interval: next_interval, next_due, last_seen: Date.now(), mastery_score };
  }

  function dueItems(mode, deckId){
    const now = Date.now();
    const byDeck = deckId ? state.items.filter(i => i.deck_id === deckId) : state.items;
    const filtered = byDeck.filter(i => deckTypeOf(i.deck_id) === mode);
    return filtered.filter(i => {
      const m = state.mastery[`${state.user.id}:${i.id}`];
      return !m || !m.next_due || m.next_due <= now;
    });
  }

  function renderDecks(){
    const itemDeck = $('itemDeck');
    const studyDeck = $('studyDeck');
    itemDeck.innerHTML = ''; studyDeck.innerHTML = '';
    state.decks.forEach(d => {
      const opt = new Option(d.title, d.id);
      const opt2 = new Option(d.title, d.id);
      itemDeck.add(opt); studyDeck.add(opt2);
    });
    const tbody = $('deckTable');
    tbody.innerHTML = '';
    state.decks.forEach(d => {
      const cards = state.items.filter(i => i.deck_id === d.id);
      const due = cards.filter(i => {
        const m = state.mastery[`${state.user.id}:${i.id}`];
        return !m || !m.next_due || m.next_due <= Date.now();
      }).length;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(d.title)}</td><td><span class="tag">${d.deck_type}</span></td><td class="pill">${cards.length}</td><td class="pill">${due}</td><td><button data-deck="${d.id}" class="btn">Lernen</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('button[data-deck]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-deck');
        /** @type {HTMLSelectElement} */($('studyDeck')).value = id;
        show('study');
      });
    });
  }

  function prepareStudySelectors(){
    // ensure deck lists up to date
    renderDecks();
    // set default mode based on selected deck
    const deckId = /** @type {HTMLSelectElement} */($('studyDeck')).value;
    if (deckId) {
      /** @type {HTMLSelectElement} */($('studyMode')).value = deckTypeOf(deckId);
    }
  }

  function renderDashboard(){
    const dueFacts = dueItems('facts').length;
    const dueVocab = dueItems('vocab').length;
    $('kpiFacts').textContent = String(dueFacts);
    $('kpiVocab').textContent = String(dueVocab);
    $('kpiLearned').textContent = String(estimateLearnedToday());
    $('kpiStreak').textContent = String(state.streak || 0);
    const list = $('overview');
    list.innerHTML = '';
    state.decks.forEach(d => {
      const due = dueItems(d.deck_type, d.id).length;
      const el = document.createElement('div');
      el.className = 'list-item';
      el.innerHTML = `<div>${escapeHtml(d.title)} <span class="tag">${d.deck_type}</span></div><div class="pill">fällig: ${due}</div>`;
      list.appendChild(el);
    });
  }

  // Utilities and state
  function seedDemoData(){
    const user = { id: 'u1', email: 'demo@example.com', name: 'Demo' };
    const decks = [
      { id: 'd1', title: 'Geschichte – 1848', deck_type: 'facts', created_at: Date.now() },
      { id: 'd2', title: 'Vokabeln – Russisch A1', deck_type: 'vocab', created_at: Date.now() },
      { id: 'd3', title: 'Text – Puschkin', deck_type: 'text', created_at: Date.now() }
    ];
    const items = [
      { id: 'i1', deck_id: 'd1', item_type: 'fact', front: 'Wann war die Märzrevolution?', back: '1848', created_at: Date.now() },
      { id: 'i2', deck_id: 'd2', item_type: 'vocab', front: 'дом', back: 'Haus', created_at: Date.now() },
      { id: 'i3', deck_id: 'd2', item_type: 'vocab', front: 'мама', back: 'Mutter', created_at: Date.now() },
      { id: 'i4', deck_id: 'd3', item_type: 'chunk', front: 'Я вас любил: любовь ещё, быть может...', back: 'Я вас любил...', created_at: Date.now() }
    ];
    const mastery = {};
    return { user, decks, items, mastery, streak: 1 };
  }

  function loadState(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedDemoData();
      const obj = JSON.parse(raw);
      if (validateState(obj)) return obj;
      return seedDemoData();
    } catch { return seedDemoData(); }
  }
  function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function validateState(s){
    return s && Array.isArray(s.decks) && Array.isArray(s.items) && s.user && typeof s.mastery === 'object';
  }
  function downloadJson(obj, filename){
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function inferItemType(deckId){ return deckTypeOf(deckId) === 'vocab' ? 'vocab' : (deckTypeOf(deckId) === 'text' ? 'chunk' : 'fact'); }
  function deckTypeOf(deckId){ return state.decks.find(d => d.id === deckId)?.deck_type || 'facts'; }
  function detectLang(mode){ return mode === 'vocab' ? 'ru-RU' : 'de-DE'; }
  function lenientMatch(input, expected){
    if (!input && !expected) return true;
    const a = normalize(input); const b = normalize(expected);
    const dist = levenshtein(a, b);
    return dist <= Math.max(1, Math.floor(b.length * 0.2));
  }
  function normalize(s){
    return s.toLowerCase().normalize('NFC').replace(/[.,!?:;\-–—]/g,'').replace(/\s+/g,' ').trim();
  }
  function levenshtein(a,b){
    const dp = Array.from({length: a.length+1}, (_,i)=>Array(b.length+1).fill(0));
    for(let i=0;i<=a.length;i++) dp[i][0]=i;
    for(let j=0;j<=b.length;j++) dp[0][j]=j;
    for(let i=1;i<=a.length;i++){
      for(let j=1;j<=b.length;j++){
        const cost = a[i-1]===b[j-1]?0:1;
        dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
      }
    }
    return dp[a.length][b.length];
  }
  function escapeHtml(s){
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }
  function estimateLearnedToday(){
    // rough proxy: number of cards with last_seen today
    const start = new Date(); start.setHours(0,0,0,0);
    const t0 = start.getTime();
    return Object.values(state.mastery).filter(m => (m.last_seen||0) >= t0).length;
  }

  function renderAll(){
    renderDecks();
    renderDashboard();
  }

  // Initial render
  renderAll();
})();
