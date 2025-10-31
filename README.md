# Simulations-Hub – Flask + React/Vite

Lokaler Playground für das Pendel (Canvas-basiert) und die neue Lyapunov/Logistik-Karte (React + WebWorker). Backend liefert statische Assets via Flask, Deployment-Ziel ist Render.

## Lokal starten

Voraussetzungen: Python 3.10+, Node 18+.

```bash
# Backend (Flask)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend (React/Vite)
cd frontend
npm install
npm run dev   # optional für Vite Dev-Server
npm run build # erzeugt /static/logistic-app

# Backend starten (liefert statische Assets inkl. Build)
cd ..
python app.py
# Öffnen: http://localhost:8000
```

## Struktur

- `app.py` – Flask‑Server (liefert Templates + statische Assets, inkl. React-Build unter `/logistic`)
- `frontend/` – React + TypeScript (Vite), Chart.js Live-Plots, WebWorker für Lyapunov
- `static/logistic-app/` – gebuildete React-App (wird via `npm run build` erzeugt)
- `templates/index.html` – Canvas-basierter Pendel-Simulator
- `static/sim.js` – Pendel-Physik (RK4) + Rendering & Interaktion im Browser
- `static/styles.css` – Styles
- `requirements.txt` – Python Abhängigkeiten
- `render.yaml` – Render Blueprint (Infrastructure‑as‑Code)

## Deployment auf Render

### Option A: Blueprint (empfohlen)
1. Repository zu GitHub/GitLab pushen.
2. In Render: New → Blueprint → Repository auswählen.
3. Render liest `render.yaml` und erstellt den Web‑Service automatisch.
4. Deploy startet mit:
   - Build: `pip install -r requirements.txt && cd frontend && npm install && npm run build`
   - Start: `gunicorn -w 2 -k gthread -b 0.0.0.0:$PORT app:app`

Hinweis: `PORT` wird von Render gesetzt. `name` im `render.yaml` kannst du anpassen.

### Option B: Manuell (ohne Blueprint)
1. New → Web Service → Repo auswählen → Environment: Python.
2. Build Command: `pip install -r requirements.txt && cd frontend && npm install && npm run build`
3. Start Command: `gunicorn -w 2 -k gthread -b 0.0.0.0:$PORT app:app`
4. Erstellen & deployen.

## Anpassungen
- Pendel-Parameter (Standardwerte) in `templates/index.html`/`static/sim.js`.
- Lyapunov/Logistik UI in `frontend/src/App.tsx` (Charts, Modal, Worker-Anbindung).
- Styles: Canvas (`static/styles.css`) bzw. React (`frontend/src/App.css`).

## Hinweise
- Lyapunov-Rechnung läuft clientseitig im WebWorker (Benettin-Renormierung + ln-Fit). Währenddessen bleibt die UI responsiv, Fortschritt/Plots erscheinen im Modal.
- Flask liefert die gebaute React-App (`/static/logistic-app`). Falls kein Build vorhanden ist, fällt `/logistic` auf das Legacy-Template zurück.