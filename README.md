# Pendel‑Simulator – Web App (Render)

Einfacher Doppel-/Einzelpendel‑Simulator als Web‑App. Server: Flask, Frontend: Canvas/JavaScript. Bereit für Deployment auf Render.

## Lokal starten

Voraussetzungen: Python 3.10+.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
# Öffnen: http://localhost:8000
```

## Struktur

- `app.py` – Flask‑Server (liefert `templates/index.html` und `/static`)
- `templates/index.html` – UI, Canvas und Controls
- `static/sim.js` – Pendel‑Physik (RK4) + Rendering & Interaktion im Browser
- `static/styles.css` – Styles
- `requirements.txt` – Python Abhängigkeiten
- `render.yaml` – Render Blueprint (Infrastructure‑as‑Code)

## Deployment auf Render

### Option A: Blueprint (empfohlen)
1. Repository zu GitHub/GitLab pushen.
2. In Render: New → Blueprint → Repository auswählen.
3. Render liest `render.yaml` und erstellt den Web‑Service automatisch.
4. Deploy startet mit:
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn -w 2 -k gthread -b 0.0.0.0:$PORT app:app`

Hinweis: `PORT` wird von Render gesetzt. `name` im `render.yaml` kannst du anpassen.

### Option B: Manuell (ohne Blueprint)
1. New → Web Service → Repo auswählen → Environment: Python.
2. Build Command: `pip install -r requirements.txt`
3. Start Command: `gunicorn -w 2 -k gthread -b 0.0.0.0:$PORT app:app`
4. Erstellen & deployen.

## Anpassungen
- Simulationsparameter (Standardwerte) in `templates/index.html` (Inputs) bzw. `static/sim.js` (`this.params`, `this.dt`).
- UI/Text/Styles in `templates/index.html` und `static/styles.css`.

## Hinweise
- Die ursprüngliche Datei `Simulation 0.1` nutzte ein Python‑UI‑Framework. Die Physik wurde schlank in JS portiert, um sie direkt im Browser zu berechnen und ruckelfrei zu rendern.
- Server tut lediglich statisches Ausliefern; keine Backend‑Rechenlast nötig.