---
title: Contribuisci
description: Come correggere un errore, migliorare un lab, tradurre una pagina o proporre una guida nuova per Proxmox Community.
---

Proxmox Community è aperto a tutti: puoi correggere un errore, migliorare un lab, tradurre una pagina o proporre una guida nuova. Ogni contributo passa da GitHub e viene rivisto prima della pubblicazione.

## Come contribuire

- **Hai trovato un errore o hai una domanda?** Apri una [issue](https://github.com/Next-Guard/Proxmox/issues) descrivendo la pagina, il passo e cosa hai osservato.
- **Vuoi proporre una modifica o una guida?** Usa una *pull request*:
  1. fai il *fork* del [repository](https://github.com/Next-Guard/Proxmox) e crea un branch;
  2. modifica o aggiungi i file Markdown in `src/content/docs/it/` (italiano) e/o `src/content/docs/` (inglese);
  3. controlla l'anteprima in locale (vedi sotto);
  4. apri la pull request spiegando cosa cambia e su quale versione di Proxmox l'hai provato.

Le guide nuove della community vanno in `src/content/docs/it/guides/` o `src/content/docs/guides/`; chi cura il progetto le aggiunge al menu (`src/sidebar.mjs`) dopo la revisione.

## Anteprima in locale

Serve Node.js 22.23 o successivo:

```bash
npm ci
npm run dev
```

Il sito è su `http://localhost:4321`. Prima di aprire la pull request esegui `npm run build`: deve terminare senza errori. Il build si ferma su link e ancore non valide tra le pagine e su immagini mancanti, poi controlla il sito generato.

## Il modello di una guida

Ogni lab e ogni guida seguono la stessa struttura. Copia questo modello in un nuovo file `.md`:

```markdown
---
title: Titolo della guida
level: base | intermedio | avanzato
duration: circa N minuti
---

## Dipendenze

- **Lab o guide precedenti:** …
- **Macchine e servizi:** … e in che stato devono essere
- **Software e immagini:** …
- **Credenziali:** `<password-lab>`

## Obiettivi

- Cosa saprai fare alla fine.

## Come funziona

La teoria essenziale per capire cosa succede, con uno schema se aiuta.

## Procedura

1. Passi numerati. Ogni azione nell'interfaccia web ha il suo screenshot,
   ogni comando ha il suo output reale.

## Verifica e test

Prove che dimostrano che funziona, anche con guasti simulati.

## Stato finale

Cosa resta configurato alla fine, per chi prosegue con altre guide.

## Cosa hai imparato

- I concetti chiave in poche righe.

## Riferimenti

- Link alla documentazione ufficiale.
```

Il titolo va nel campo `title`, non in un titolo `# Titolo`: il sito lo mostra in cima alla pagina, con il livello e la durata.

## Comandi, output e note

Un blocco di **comandi** ha come titolo la macchina su cui si esegue: il sito lo mostra come un terminale con il pulsante di copia. L'**output** che segue va in un blocco marcato `output`: ha una cornice più tenue e nessun pulsante di copia, così chi copia prende solo il comando.

````markdown
```bash title="root@desopve01"
pvecm status | grep -E "^Quorate|Total votes"
```

```text output
Quorate:          Yes
Total votes:      3
```
````

- Le console che non sono una shell (RouterOS, `qm monitor`) usano `text` con `frame="terminal"`: `` ```text title="RouterOS — rtr-core" frame="terminal" ``.
- File di configurazione e script che non sono comandi usano il nome del linguaggio senza titolo (`yaml`, `json`, `toml`, `hcl`…).
- Note e avvertenze sono *aside*: `:::note`, `:::tip`, `:::caution` o `:::danger`, con un titolo facoltativo tra parentesi quadre, chiusi da `:::`.

  ```markdown
  :::caution[Attenzione agli indirizzi]
  `172.32.199.0/24` **non** è un indirizzo privato.
  :::
  ```

- Gli schemi si scrivono in Mermaid, in un blocco `` ```mermaid ``.

## Regole

- **Prove reali.** Pubblica solo procedure eseguite davvero: comandi, output e screenshot devono venire dal tuo sistema. Indica la versione di Proxmox VE usata.
- **Screenshot.** Formato PNG, solo quelli rilevanti, uno per ogni azione significativa. Mettili in `src/assets/images/<nome-guida>/` e collegali con un percorso relativo: `../../../assets/images/<nome-guida>/01-schermata.png` da una pagina italiana, `../../assets/images/<nome-guida>/01-schermata.png` da una pagina inglese. Il sito li converte e li ridimensiona.
- **Link tra le pagine.** Usa l'indirizzo della pagina con la barra finale: `/it/10-zfs/#ancora` in italiano, `/10-zfs/#anchor` in inglese. I file da scaricare vanno in `public/files/<nome-guida>/` e si collegano come `/files/<nome-guida>/nome-file`.
- **Nessun dato sensibile.** Mai password, token, chiavi, indirizzi IP pubblici o nomi reali di persone e aziende. Usa segnaposto come `<password-lab>` e oscura negli screenshot numeri di serie e indirizzi MAC.
- **Lingua.** Puoi scrivere in italiano, in inglese o in entrambe. La pagina tradotta deve avere **lo stesso nome file** nelle due cartelle (`src/content/docs/it/…` e `src/content/docs/…`): così il selettore di lingua le collega.
- **Nomi dei file.** Minuscole, parole separate da trattini, in inglese: per esempio `ceph-pool-encryption.md`. Nessun file o cartella può iniziare con `.` o `_`.
- **Stile.** Frasi brevi e chiare, passi numerati, un'idea per paragrafo. Spiega il *perché*, non solo il *come*.

## Licenza dei contributi

Inviando un contributo accetti che venga pubblicato con le licenze del progetto: **CC BY-SA 4.0** per i contenuti e **MIT** per il codice. Vedi [Chi siamo](/it/about/#licenze).
