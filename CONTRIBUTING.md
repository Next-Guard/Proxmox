# Contributing / Contribuire

**English** – Thank you for helping Proxmox Community grow! The full contribution guide, with the guide template and the rules for screenshots, sensitive data and languages, is on the website: <https://proxmox.community/contributing/>. In short: open an issue for mistakes and questions, or fork the repository, add or edit Markdown files as described below, check them with `npm run build` and open a pull request.

**Italiano** – Grazie per aiutare Proxmox Community a crescere! La guida completa per contribuire, con il modello di guida e le regole su screenshot, dati sensibili e lingue, è sul sito: <https://proxmox.community/it/contributing/>. In breve: apri una issue per errori e domande, oppure fai il fork del repository, aggiungi o modifica i file Markdown come descritto sotto, verificali con `npm run build` e apri una pull request.

## Where things go / Dove vanno i file

| What / Cosa | Where / Dove |
|---|---|
| English pages / Pagine in inglese | `src/content/docs/<name>.md` → `https://proxmox.community/<name>/` |
| Italian pages / Pagine in italiano | `src/content/docs/it/<name>.md` → `https://proxmox.community/it/<name>/` |
| Screenshots / Screenshot | `src/assets/images/<guide>/NN-name.png`, linked with a relative path / collegati con un percorso relativo: `../../assets/images/…` (EN), `../../../assets/images/…` (IT) |
| Downloadable files / File da scaricare | `public/files/<guide>/`, linked as / collegati come `/files/<guide>/<file>` |
| Menu (sidebar) / Menu laterale | `src/sidebar.mjs` (label in English, `translations.it` in Italian) |
| Home page | `src/content/docs/index.mdx`, `src/content/docs/it/index.mdx` |

A translated page has **the same file name** in both languages: this is how the language selector links them. File names are lowercase, hyphen-separated, in English; no file or folder may start with `.` or `_` (the site is published on GitHub Pages without Jekyll processing).
Una pagina tradotta ha **lo stesso nome file** nelle due lingue: così il selettore di lingua le collega. Nomi in minuscolo, con trattini, in inglese; nessun file o cartella può iniziare con `.` o `_` (il sito è pubblicato su GitHub Pages senza Jekyll).

Every page starts with a frontmatter instead of a `# Title`; labs also have level and duration. / Ogni pagina inizia con un frontmatter invece di `# Titolo`; i lab hanno anche livello e durata:

```markdown
---
title: Lab 17 – Ceph 1: architecture, installation, RBD pools and CephFS
level: advanced
duration: 2 hours
---
```

## Code blocks / Blocchi di codice

- **Command / Comando**: the title is the machine where it runs; the site shows a terminal with a copy button. / Il titolo è la macchina su cui si esegue; il sito mostra un terminale con il pulsante di copia.
- **Output**: the block right after, marked `output`: muted frame, **no copy button**. / Il blocco subito dopo, marcato `output`: cornice attenuata, **senza pulsante di copia**.

````markdown
```bash title="root@desopve01"
pvecm status | grep -E "^Quorate|Total votes"
```

```text output
Quorate:          Yes
Total votes:      3
```
````

- Non-shell consoles / Console che non sono una shell: `` ```text title="RouterOS — rtr-core" frame="terminal" ``.
- Configuration files and scripts / File di configurazione e script: language only, no title / solo il linguaggio, senza titolo (`yaml`, `json`, `toml`, `hcl`…).
- Notes / Note: `:::note`, `:::tip`, `:::caution`, `:::danger`, optional title / titolo facoltativo `:::caution[Title]`, closed by / chiuse da `:::`.
- Diagrams / Schemi: `` ```mermaid ``.
- Links between pages / Link tra le pagine: `/10-zfs/#anchor` (EN), `/it/10-zfs/#ancora` (IT).

## Check before the pull request / Verifica prima della pull request

```bash
npm ci
npm run dev     # preview / anteprima: http://localhost:4321
npm run build   # build in ../nextguard-starlight-site: broken links, anchors or images stop it
npm test        # browser checks (Playwright; once: npx playwright install chromium): copy buttons, diagrams, search, language selector
```

Contributions are published under CC BY-SA 4.0 (content) and MIT (code). / I contributi sono pubblicati con licenza CC BY-SA 4.0 (contenuti) e MIT (codice).
