---
name: fix-issues
description: Analizza e risolve le issue GitHub aperte del repository. Usa quando l'utente invoca /fix-issues, chiede di fixare issue aperte, o vuole lavorare su bug/feature tracciati su GitHub.
disable-model-invocation: true
---

# Fix Issues

Skill Cursor per analizzare, pianificare e risolvere le issue GitHub aperte di questo repository.

## Repository

- **Repo:** `riccardo0326/gff-development-dashboard`
- **App:** `gff-dashboard/` (Next.js, TypeScript, Tailwind)
- **Convenzioni:** leggi `gff-dashboard/AGENTS.md`, `gff-dashboard/CLAUDE.md` e il codice circostante prima di modificare

## Quando usare

- L'utente invoca `/fix-issues`
- L'utente chiede di fixare issue aperte, bug tracciati o feature request su GitHub
- L'utente menziona numeri di issue senza specificare il workflow

## Regole Cursor (obbligatorie)

### Domande a scelta chiusa

Quando mancano dettagli, **non** fare domande aperte in chat. Usa sempre lo **strumento AskQuestion** (ask questions tool) di Cursor con opzioni cliccabili:

- Una o più domande per volta, con `options` concrete
- `allowMultiple: false` per scelta singola, `true` solo se serve multi-selezione
- Se lo strumento non è disponibile, elenca le opzioni numerate e chiedi di rispondere con l'ID dell'opzione scelta

### Conferma prima di implementare

**Non iniziare mai a modificare codice** finché l'utente non conferma esplicitamente il piano.

1. Presenta un **piano di fix** strutturato (issue, file coinvolti, approccio, rischi)
2. Chiedi conferma con AskQuestion oppure in chat, aspettando una risposta equivalente a **"procedi"**
3. Opzioni di conferma consigliate:
   - `procedi` — esegui il piano
   - `modifica` — l'utente vuole cambiare qualcosa nel piano
   - `annulla` — interrompi senza modifiche
4. Se l'utente sceglie `modifica`, aggiorna il piano e ripeti la richiesta di conferma
5. Solo dopo **"procedi"** (o selezione equivalente) passa alla fase di implementazione

## Workflow

### Fase 1 — Raccolta issue

1. Recupera le issue aperte:

   ```bash
   gh issue list --repo riccardo0326/gff-development-dashboard --state open --json number,title,labels,body
   ```

2. Se l'utente ha indicato numeri specifici, filtra su quelli. Altrimenti usa **AskQuestion** per chiedere:
   - Quali issue affrontare (elenca ogni issue aperta come opzione; abilita multi-selezione se ha senso)
   - Priorità se ce ne sono molte (es. "tutte", "solo la più recente", "seleziona manualmente")

3. Per ogni issue selezionata, carica i dettagli:

   ```bash
   gh issue view <numero> --repo riccardo0326/gff-development-dashboard --json title,body,labels,comments
   ```

### Fase 2 — Chiarimenti mancanti

Usa **AskQuestion** quando servono decisioni non deducibili dal codice o dall'issue:

| Ambiguità | Esempio di opzioni |
|-----------|-------------------|
| Scope del fix | Solo UI / Solo backend / Entrambi |
| Comportamento non specificato nell'issue | Opzione A / Opzione B / Chiedi chiarimento al maintainer |
| Issue troppo vaga | Procedi con interpretazione X / Procedi con interpretazione Y / Salta questa issue |
| Ordine di esecuzione | Issue #N prima / Issue #M prima / Una PR per issue / Una PR unica |

Se dopo l'analisi del codice il fix è ovvio, **non** chiedere dettagli superflui: vai direttamente al piano.

### Fase 3 — Analisi e piano

Per ogni issue:

1. Esplora il codebase (`gff-dashboard/src/`, componenti, API routes, lib)
2. Identifica file da modificare e approccio tecnico
3. Valuta rischi (regressioni, test mancanti, dipendenze)

Presenta il piano in questo formato:

```markdown
## Piano di fix

### Issue #<numero>: <titolo>
- **Problema:** ...
- **Approccio:** ...
- **File da modificare:** ...
- **Test/verifica:** ...

### Issue #<numero>: ...
...

### Strategia git
- Branch: `cursor/fix-issue-<numero>-c6e7` (o branch unico se più issue)
- PR: draft verso `main`
```

Poi chiedi conferma e **attendi "procedi"**.

### Fase 4 — Implementazione (solo dopo conferma)

1. Crea branch: `cursor/fix-issue-<numero>-c6e7` (prefisso `cursor/`, suffisso `-c6e7`)
2. Implementa seguendo le convenzioni del progetto
3. Verifica:
   ```bash
   cd gff-dashboard && npm run lint
   ```
   Esegui altri test pertinenti se disponibili
4. Commit descrittivi, push:
   ```bash
   git push -u origin <branch-name>
   ```
5. Apri PR draft verso `main` con riferimento alle issue:
   ```bash
   gh pr create --draft --title "..." --body "Fixes #<numero>\n\n..."
   ```

### Fase 5 — Report

Al termine, riassumi:

- Issue risolte e PR create (con link)
- Modifiche principali
- Eventuali issue saltate o follow-up necessari

## Vincoli

- **Minimizza lo scope:** fix mirati, niente refactor non richiesti
- **Una conferma per piano:** non implementare parzialmente prima di "procedi"
- **Non chiudere issue manualmente** se la PR non è ancora mergiata (usa `Fixes #N` nel body della PR)
- **Non modificare** file fuori da `gff-dashboard/` salvo la skill stessa o config strettamente necessaria
- Se un fix è impossibile o l'issue è ambigua, spiegalo nel piano e proponi alternative via AskQuestion

## Comandi utili

```bash
# Issue aperte
gh issue list --repo riccardo0326/gff-development-dashboard --state open

# Dettaglio issue
gh issue view <N> --repo riccardo0326/gff-development-dashboard

# Commento su issue (solo se utile per chiarimenti)
gh issue comment <N> --repo riccardo0326/gff-development-dashboard --body "..."

# PR collegata
gh pr list --repo riccardo0326/gff-development-dashboard --search "issue:<N>"
```
