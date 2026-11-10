# Contribuisci

Proxmox Community è aperto a tutti: puoi correggere un errore, migliorare un lab, tradurre una pagina o proporre una guida nuova. Ogni contributo passa da GitHub e viene rivisto prima della pubblicazione.

## Come contribuire

- **Hai trovato un errore o hai una domanda?** Apri una [issue](https://github.com/Next-Guard/Proxmox/issues) descrivendo la pagina, il passo e cosa hai osservato.
- **Vuoi proporre una modifica o una guida?** Usa una *pull request*:
  1. fai il *fork* del [repository](https://github.com/Next-Guard/Proxmox) e crea un branch;
  2. modifica o aggiungi i file Markdown in `docs/it/` (italiano) e/o `docs/en/` (inglese);
  3. controlla l'anteprima in locale (vedi sotto);
  4. apri la pull request spiegando cosa cambia e su quale versione di Proxmox l'hai provato.

Le guide nuove della community vanno in `docs/it/guides/` o `docs/en/guides/`; chi cura il progetto le aggiunge al menu dopo la revisione.

## Anteprima in locale

Serve Python 3:

```bash
python3 -m venv ~/venv-proxmox-community
~/venv-proxmox-community/bin/pip install -r requirements.txt
~/venv-proxmox-community/bin/mkdocs serve
```

Il sito è su `http://127.0.0.1:8000`. Prima di aprire la pull request verifica che `mkdocs build --strict` termini senza avvisi: link e immagini mancanti vengono segnalati.

## Il modello di una guida

Ogni lab e ogni guida seguono la stessa struttura. Copia questo modello:

```markdown
# Titolo della guida

**Livello:** base | intermedio | avanzato · **Durata:** circa N minuti

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

## Regole

- **Prove reali.** Pubblica solo procedure eseguite davvero: comandi, output e screenshot devono venire dal tuo sistema. Indica la versione di Proxmox VE usata.
- **Screenshot.** Formato PNG, solo quelli rilevanti, uno per ogni azione significativa. Mettili in `docs/images/<nome-guida>/` e collegali con un percorso relativo, per esempio `../images/<nome-guida>/01-schermata.png`.
- **Nessun dato sensibile.** Mai password, token, chiavi, indirizzi IP pubblici o nomi reali di persone e aziende. Usa segnaposto come `<password-lab>` e oscura negli screenshot numeri di serie e indirizzi MAC.
- **Lingua.** Puoi scrivere in italiano, in inglese o in entrambe. La pagina tradotta deve avere **lo stesso nome file** nelle due cartelle (`docs/it/…` e `docs/en/…`): così il selettore di lingua le collega.
- **Nomi dei file.** Minuscole, parole separate da trattini, in inglese: per esempio `ceph-pool-encryption.md`.
- **Stile.** Frasi brevi e chiare, passi numerati, un'idea per paragrafo. Spiega il *perché*, non solo il *come*.

## Licenza dei contributi

Inviando un contributo accetti che venga pubblicato con le licenze del progetto: **CC BY-SA 4.0** per i contenuti e **MIT** per il codice. Vedi [Chi siamo](about.md#licenze).
