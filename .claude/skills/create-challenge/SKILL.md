---
name: create-challenge
description: Erstellt eine Challenge-Definition für den Deutschinator 3000. Schreibt/aktualisiert exercises/challenges.json mit Stufen und Sets, erstellt bei Bedarf neue Regeldateien in rules/. Trigger mit /create-challenge.
trigger: /create-challenge
---

# Create Challenge

Erstelle oder aktualisiere eine Challenge-Definition für den Deutschinator 3000. Eine Challenge ist ein mehrstufiger Lernpfad mit Unlock-Mechanismus.

## Eingabe

Du bekommst folgende Informationen (vom Benutzer oder von `manage-challenge`):

- **Challenge-Name**: Anzeigename (z.B. "Konjunktiv II Meistern")
- **Challenge-ID**: Slug (z.B. `konjunktiv-ii`)
- **Stufen**: Array von Stufen, jede mit Name und Exercise-Set-IDs
- **Regel-Bedarf**: Welche Grammatik-Themen abgedeckt werden und ob neue Regeldateien nötig sind

Falls Informationen fehlen, frage nach.

## Vorgehen

### Schritt 1: Codebase lesen

1. `exercises/challenges.json` — bestehende Challenge prüfen
2. `exercises/index.json` — prüfe dass alle referenzierten Set-IDs existieren
3. `rules/` — prüfe welche Regeldateien existieren

### Schritt 2: Regeldateien erstellen (wenn nötig)

Wenn das Challenge-Thema keine passende Regeldatei in `rules/` hat:

1. Erstelle eine neue Markdown-Datei in `rules/`
2. Format: `{thema-slug}.md`
3. Inhalt-Struktur (orientiere dich an `rules/passiv-grundlagen.md`):
   - Überschrift mit Thema
   - Grundkonzept in 2-3 Sätzen
   - Tabelle mit Formen/Beispielen
   - Bildungsregeln
   - **Merke**-Abschnitt mit Eselsbrücken

**Regeldatei-Qualität:**
- Sprache: Deutsch, altersgerecht für 12-Jährige
- Kurz und übersichtlich — maximal eine Bildschirmseite
- Tabellen bevorzugen, Fließtext minimieren
- Eselsbrücken und Merksprüche wo möglich
- Keine Fachsprache ohne Erklärung

### Schritt 3: Challenge-Definition schreiben

Lies `exercises/challenges.json` (Array von Challenges). Füge neue Challenge zum Array hinzu oder aktualisiere bestehende (gleiche ID).

**Format jeder Challenge:**

```json
{
  "id": "challenge-id",
  "name": "Challenge Anzeigename",
  "stages": [
    {
      "name": "Stufe 1: Erkennen",
      "sets": ["set-id-1", "set-id-2"]
    },
    {
      "name": "Stufe 2: Anwenden",
      "sets": ["set-id-3", "set-id-4"]
    },
    {
      "name": "Stufe 3: Meistern",
      "sets": ["set-id-5"]
    }
  ]
}
```

**Regeln:**
- Immer mehrstufig (mindestens 2 Stufen)
- Progressive Schwierigkeit: Erkennen → Anwenden → Meistern
- Maximal 3 Sets pro Stufe (Überforderung vermeiden)
- Stufennamen: "Stufe N: {Beschreibung}" — klar und motivierend
- Jede Stufe muss abgeschlossen werden, bevor die nächste freigeschaltet wird (App-Logik)
- Challenge-ID ändern = Fortschritt zurücksetzen (localStorage key)

### Schritt 4: Validierung

Prüfe:
1. Alle Set-IDs in der Challenge existieren in `exercises/index.json`
2. Challenge-ID ist einzigartig (oder bewusster Reset)
3. Regeldateien, die in Exercise-Sets referenziert werden (`rules`-Feld), existieren in `rules/`
4. `challenges.json` ist valides JSON

### Schritt 5: Zusammenfassung

Gib eine Zusammenfassung:
- Challenge-Name und ID
- Anzahl Stufen und Sets pro Stufe
- Neu erstellte Regeldateien
- Referenzierte Exercise-Sets (mit Typ und Anzahl Übungen)

## Wichtige Hinweise

- `challenges.json` ist ein Array von Challenge-Objekten. Neue Challenges werden zum Array hinzugefügt. Bei gleicher ID wird die bestehende Challenge ersetzt.
- Regeldateien werden von Exercise-Sets über das `rules`-Feld referenziert, nicht von der Challenge selbst. Stelle sicher, dass die Exercise-Sets die richtigen `rules`-Referenzen haben.
- Ändere die Challenge-ID, wenn sich der Inhalt ändert — sonst sieht das Kind alten Fortschritt.
