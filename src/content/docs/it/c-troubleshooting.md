---
title: Appendice C – Risoluzione dei problemi
---

Questa appendice raccoglie i problemi **reali** incontrati durante la costruzione del laboratorio, uno per uno, con il sintomo, la causa e la soluzione. Ogni voce rimanda al lab in cui il problema è comparso e dove trovi i comandi completi e l'output.

Nella seconda parte trovi **dove guardare** quando qualcosa non funziona: log, comandi di stato e strumenti di diagnosi di Proxmox VE.

## Il metodo

Davanti a un problema conviene procedere sempre allo stesso modo:

1. **Descrivi il sintomo con precisione**: cosa non funziona, da quando, su quali nodi o guest, con quale messaggio di errore.
2. **Delimita il perimetro**: un solo guest o tutti? Un solo nodo o il cluster? Solo da una rete o da ovunque?
3. **Leggi i log prima di cambiare qualcosa**: il log del task nella GUI, poi il journal del servizio coinvolto (vedi [Dove guardare](#dove-guardare)).
4. **Formula un'ipotesi e verificala con una prova sola**, senza cambiare più cose insieme.
5. **Prepara il ritorno indietro** prima di ogni modifica: un backup della configurazione, uno snapshot, una sessione SSH già aperta.
6. **Annota causa e soluzione**: la prossima volta il problema si risolve in pochi minuti.

## Problemi reali, per area

### Installazione e aggiornamenti

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| `hostname -f` restituisce un dominio diverso da quello inserito nell'installer | Nell'installer si è tornati indietro dopo la schermata di rete e il nome confermato prima è rimasto in `/etc/hosts` | Correggi `/etc/hosts` (e `resolv.conf`, Postfix) **prima** di creare il cluster, poi `pvecm updatecerts --force` | [03](/it/03-install-proxmox-ve/) |
| `error reading cached package status in '/var/lib/pve-manager/pkgupdates'` | Cache degli aggiornamenti non ancora creata su un nodo appena installato | Innocuo: sparisce dopo il primo `pveupdate` o un controllo degli aggiornamenti dalla GUI | [04](/it/04-first-access-repositories-updates/) |
| `pveam update` fallisce, mentre `apt` funziona | `apt` usa il proxy di `/etc/apt/apt.conf.d/`, `pveam` quello del datacenter | Imposta **Datacenter → Options → HTTP proxy** (o `pvesh set /cluster/options --http_proxy …`) | [04](/it/04-first-access-repositories-updates/), [A](/it/a-upgrade-8-to-9/) |
| Windows Update del DC fallisce dietro il proxy del lab | Il proxy lascia passare solo una lista ristretta di siti | In produzione: consentire gli indirizzi di Windows Update o usare WSUS | [02](/it/02-domain-controller/) |
| Al primo avvio di una VM UEFI il "Press any key to boot from CD" scade prima che compaia | Al primo avvio OVMF inizializza il disco EFI nuovo, e la richiesta scade prima di essere vista | Avvia dal **Boot Manager** di OVMF; dal secondo avvio il firmware è veloce | [39](/it/39-windows-vm-virtio/) |
| `pve8to9` segnala `FAIL: systemd-boot meta-package installed` | Su Debian 13 il meta-pacchetto `systemd-boot` interviene sul bootloader a ogni aggiornamento | Se il nodo avvia con GRUB, rimuovi `systemd-boot` prima dell'upgrade | [A](/it/a-upgrade-8-to-9/) |

### Rete

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Sessione iSCSI del secondo percorso che cade ogni 10 s, VM ferma fino a 85 s | Compatibile con l'**ARP flux**: due schede dello stesso nodo sullo stesso segmento Ethernet (stesso switch e VLAN, qui con subnet diverse), e Linux risponde all'ARP da quella sbagliata; `ip neigh` sul NAS mostra quale MAC usa | `arp_ignore=1` e `arp_announce=2` in `/etc/sysctl.d/`; meglio ancora reti separate su VLAN | [15](/it/15-iscsi-lvm-multipath/) |
| Regole NAT o SNAT duplicate a ogni `ifreload` | I comandi `post-up` vengono rieseguiti a ogni ricarica della rete | Rendi le regole idempotenti: `iptables -C … \|\| iptables -A …` | [24](/it/24-routing-nat/), [34](/it/34-network-performance-troubleshooting/) |
| Cambiata la configurazione di Corosync ma il link resta quello vecchio | Ricaricare la configurazione non basta per spostare un link | Riavvia Corosync **un nodo alla volta**, controllando il quorum tra un nodo e l'altro | [22](/it/22-dedicated-networks/) |
| Bond 802.3ad con un solo link attivo (Linux) o bond spento del tutto (OVS) | Nessun partner LACP: lo switch non negozia l'aggregazione | Configura LACP sullo switch; con OVS, `lacp-fallback-ab` evita lo spegnimento | [21](/it/21-bonding/), [23](/it/23-open-vswitch/) |
| Ping con pacchetti grandi persi, TCP lento o bloccato in una VNet VXLAN/EVPN | MTU del guest troppo alta: l'incapsulamento VXLAN aggiunge 50 byte | MTU 1450 nella VNet e nel guest; nei CT Debian 13 scrivila anche nel file di rete del CT, perché ifupdown2 la riporta a 1500 | [29](/it/29-sdn-vxlan/) |
| Frame QinQ scartati da uno switch con MTU 1500 | Il doppio tag aggiunge 4 byte al frame | MTU 1496 nei guest, oppure MTU maggiore sugli switch | [28](/it/28-sdn-vlan-qinq/) |
| Due guest nella stessa VNet Simple non si vedono | La zona **Simple** è locale a ogni nodo | Guest sullo stesso nodo, oppure zone VLAN/VXLAN/EVPN | [27](/it/27-sdn-simple/) |
| Dopo la caduta dell'exit node EVPN una connessione già aperta resta bloccata | L'altro exit node non ha lo stato del NAT di quella connessione | L'SNAT è *stateful*: in produzione evita l'SNAT e fai annunciare le subnet via BGP ai router di upstream, così le risposte tornano da qualunque exit node | [30](/it/30-sdn-evpn/) |
| Riconvergenza della fabric di 26 s quando un collegamento cade da un solo lato | Con i timer predefiniti il vicino se ne accorge solo allo scadere degli hello | Hello a 1 s: riconvergenza in circa 6 s | [31](/it/31-sdn-fabrics/) |
| I guest IPv6 non ricevono gli annunci del router (RA) | Lo switch scarta gli RA (*RA Guard*) | Autorizza la porta del router sullo switch | [25](/it/25-ipv6/) |
| Il DC Windows registra nel DNS indirizzi IPv6 automatici | Windows accetta gli RA e si configura in SLAAC | IPv6 statico sulle schede del DC e RA disattivati | [25](/it/25-ipv6/) |
| `accept_ra=0` impostato ma le schede presenti all'avvio accettano ancora gli RA | Le chiavi `all` e `default` non si applicano alle interfacce già esistenti al boot | Usa il carattere jolly: `net.ipv6.conf.*.accept_ra = 0` in `/etc/sysctl.d/` | [25](/it/25-ipv6/) |
| Il routing attraverso il router CHR va a circa 1 Mbit/s | Limite della licenza gratuita di RouterOS CHR | Licenza adeguata per un router in produzione | [26](/it/26-virtual-router/) |
| Un'immagine `.img` non compare nello storage di import | Lo storage di import elenca solo le estensioni che riconosce | Rinomina il file in `.raw` | [26](/it/26-virtual-router/) |
| Jumbo frame: 100% di perdita con MTU 9000 | Lo switch, o un tratto del percorso, non supporta i jumbo frame | MTU 1500 ovunque, oppure jumbo frame abilitati su tutto il percorso | [21](/it/21-bonding/), [34](/it/34-network-performance-troubleshooting/) |
| Multiqueue non migliora (anzi peggiora) la banda di una VM | Nel laboratorio le code in più non hanno dato vantaggi: il risultato dipende da CPU, scheda e carico | Misura sempre prima e dopo | [34](/it/34-network-performance-troubleshooting/) |

### Firewall

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Dopo l'attivazione del firewall degli host il cluster perde servizi (Ceph, BGP, migrazione) | Policy di ingresso `DROP` senza regole per il traffico tra i nodi | Prima crea un security group con tutti i servizi del cluster, poi attiva un nodo alla volta con un rientro automatico pronto | [32](/it/32-firewall-1/), [33](/it/33-firewall-2/) |
| Con il firewall della VNet attivo i guest non prendono più l'IP dal DHCP né risolvono i nomi | Il firewall della VNet filtra anche il traffico verso il gateway del nodo | Consenti esplicitamente DHCP e DNS verso il gateway della VNet | [33](/it/33-firewall-2/) |
| Il firewall della VNet non blocca il traffico verso l'esterno | Filtra il traffico tra i guest e verso il nodo, non quello instradato fuori dalla VNet | Filtra l'uscita sul firewall dei guest o su un router | [33](/it/33-firewall-2/) |
| Con nftables il traffico in SNAT da una zona Simple verso un CT con firewall sullo **stesso** nodo viene scartato | Conntrack scarta la connessione (`insert_failed`) | Problema aperto: evita la combinazione, o disattiva il firewall del CT di destinazione | [33](/it/33-firewall-2/) |
| Notifiche Gotify verso un indirizzo interno rifiutate con `CONNECT proxy failed: 403` | Il target Gotify usa il proxy del Datacenter anche verso gli IP interni (documentato; nel codice sorgente il target Webhook usa la stessa impostazione, non provato) | Consenti le destinazioni interne sul proxy; il log del proxy mostra la richiesta rifiutata | [51](/it/51-notifications-metrics-logs/) |

### Storage

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Scritture bloccate per 60 s, poi errori di I/O e dati persi in un container | **Thin pool LVM pieno**: l'overprovisioning ha superato lo spazio reale | Monitora `Data%` e `Meta%`; recupera con `lvextend` + `pct fstrim`; attiva l'estensione automatica con un profilo LVM | [09](/it/09-lvm-and-lvm-thin/) |
| Uno storage Directory scrive sul disco di sistema quando il disco dedicato non è montato | Senza `is_mountpoint` PVE usa la cartella vuota | Imposta `is_mountpoint` sullo storage Directory | [08](/it/08-storage-model/) |
| NAS NFS fermo: processi in stato `D`, VM bloccate, *load average* alto | Il mount NFS è `hard`: l'I/O aspetta il server all'infinito | Atteso: al ritorno del NAS tutto riparte; pianifica la ridondanza del NAS | [13](/it/13-nfs/) |
| SMB fermo: errore `Host is down` dopo circa 10 s | Il mount CIFS è `soft` | Le scritture falliscono invece di aspettare: valuta cosa preferisci per i dischi delle VM | [14](/it/14-smb-cifs/) |
| `dd` con zeri dà prestazioni irrealistiche | Compressione e zero-detection del NAS | Misura con dati casuali o con `fio` | [13](/it/13-nfs/), [19](/it/19-fio-benchmark/) |
| Spazio libero di NFS/SMB sceso dopo la creazione di una LUN iSCSI | Lo zvol è thick e riserva subito tutto lo spazio | Considera la riserva nel dimensionamento, o valuta uno zvol *sparse* (thin) | [15](/it/15-iscsi-lvm-multipath/) |
| Pausa di I/O di circa 15 s alla caduta di un percorso iSCSI | Nella prova: circa 10 s per rilevare il guasto (NOP-Out senza risposta, errore 1022) più 5 s di tempo di recupero della sessione, compatibili con il `fast_io_fail_tmo` di multipathd invece dei 15 s di `replacement_timeout` | Atteso con questi timer; leggi i valori in vigore (`/sys/class/iscsi_session/*/recovery_tmo`) prima di regolarli | [15](/it/15-iscsi-lvm-multipath/) |
| Rollback rifiutato (`not most recent`) | ZFS e la volume chain permettono il rollback solo all'ultimo snapshot | Elimina gli snapshot più recenti, o usa qcow2/LVM-thin per gli alberi di snapshot | [16](/it/16-snapshots/) |
| `snapshot feature is not available` su LVM | LVM thick non supporta gli snapshot classici | Attiva la volume chain (ogni snapshot occupa quanto il disco) o usa LVM-thin | [16](/it/16-snapshots/) |
| Misure fio sul disco sbagliato dentro una VM | I nomi `sdX` si scambiano tra un avvio e l'altro con controller SATA e SCSI insieme | Usa sempre `/dev/disk/by-id/…` | [37](/it/37-virtual-disks-controllers/) |
| La VM non parte con `aio=native` e cache `writeback` | Combinazione non supportata da QEMU | Usa `io_uring` o la cache di default | [37](/it/37-virtual-disks-controllers/) |
| Valori di benchmark diversi tra una prova e l'altra | Cache, attività di fondo (scrub, ribilanciamento Ceph) e carico condiviso su NAS e Ceph | Confronta solo prove ravvicinate e ripetute | [19](/it/19-fio-benchmark/), [37](/it/37-virtual-disks-controllers/) |

### Ceph

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| `HEALTH_WARN BLUESTORE_SLOW_OP_ALERT` che resta per ore | I dischi lenti generano operazioni lente; l'avviso di default resta visibile 24 ore | Indaga i dischi; nel laboratorio `bluestore_slow_ops_warn_lifetime 600` | [22](/it/22-dedicated-networks/) |
| Avvisi `OSD bench result … not within the threshold` all'avvio degli OSD | All'avvio l'OSD misura il disco e ottiene IOPS fuori dalla soglia attesa | Ceph usa il valore predefinito; misura i dischi con `fio` e imposta `osd_mclock_max_capacity_iops_*` | [18](/it/18-ceph-growth-maintenance-failures/) |
| Ribilanciamento inutile durante un riavvio programmato | Senza `noout` gli OSD vengono marcati `out` dopo 600 s | `ceph osd set noout` prima della manutenzione, `unset` dopo | [18](/it/18-ceph-growth-maintenance-failures/) |
| I/O della VM fermo per circa 27 s alla caduta brutale di un nodo | Tempo di rilevamento del guasto da parte di Ceph | Atteso; la ricostruzione parte dopo 600 s se il nodo non torna | [18](/it/18-ceph-growth-maintenance-failures/) |

### Cluster e alta disponibilità

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| `/etc/pve` in sola lettura su un nodo | Il nodo ha perso il quorum | Ripristina la comunicazione Corosync; non forzare `pvecm expected` se non sai cosa stai facendo | [06](/it/06-cluster-corosync/) |
| Dopo un guasto la VM replicata va recuperata a mano | La replica ZFS non è HA | Sposta la configurazione della VM sul nodo con la replica; si perdono i dati scritti dopo lo snapshot dell'ultimo giro riuscito. Se servono le scritture rimaste sul nodo guasto, disattiva il job prima di riaccenderlo | [11](/it/11-zfs-replication/) |
| La creazione di un gruppo HA viene rifiutata | In PVE 9 i gruppi sono stati sostituiti dalle HA rules | Usa le **node affinity rules** | [49](/it/49-high-availability/) |
| Una resource affinity rule viene rifiutata | La risorsa ha già una node affinity con più priorità | Semplifica la node affinity o rinuncia alla resource affinity | [49](/it/49-high-availability/) |
| La manutenzione di un nodo non riesce a evacuarlo | Una regola *Keep Separate* su 3 VM con 3 nodi non lascia posto | Riduci la regola o aggiungi nodi | [49](/it/49-high-availability/) |
| Dopo il guasto di un nodo i container non in HA restano spenti | Solo le risorse HA vengono riavviate altrove | Metti in HA ciò che deve ripartire da solo | [49](/it/49-high-availability/) |
| Il recupero HA richiede circa 2 minuti | Il nodo guasto deve essere *fenced* prima del recupero | Atteso: è la garanzia contro la doppia esecuzione | [49](/it/49-high-availability/) |
| La migrazione in blocco sposta più guest del previsto | La finestra *Bulk Migrate* preseleziona **tutti** i guest | Controlla la selezione prima di confermare | [48](/it/48-migrations/) |
| `qm remote-migrate` (o la migrazione da PDM) fallisce verso un nodo esterno con `no matching import/export format` | Nella prova: il disco cloud-init, che non si copia a caldo, era offerto solo nel formato `zfs`, e la destinazione LVM-thin non lo importa; in un altro tentativo, uno snippet `cicustom` inesistente sulla destinazione | Controlla `export_formats` nel log e scegli uno storage di destinazione con un formato in comune; prepara gli snippet sulla destinazione | [48](/it/48-migrations/), [53](/it/53-datacenter-manager/) |
| Dopo una migrazione da PDM l'origine resta con il lock `migrate` | Migrazione senza *Delete Source* | Rimuovi l'origine o il lock dopo la verifica | [53](/it/53-datacenter-manager/) |

### VM e container

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Le CPU aggiunte a caldo restano spente nel guest | Il guest non le porta online da solo | Regola udev che le attiva | [42](/it/42-hotplug-resize-limits/) |
| La scheda di rete aggiunta a caldo è `DOWN` | Nessuna configurazione nel guest per la nuova scheda | Configura l'interfaccia nel guest | [42](/it/42-hotplug-resize-limits/) |
| Il ballooning manuale "non tiene" | `pvestatd` riporta il balloon al massimo quando il nodo è scarico | Imposta il minimo e lascia lavorare l'automatismo | [36](/it/36-memory/) |
| Una nuova VM eredita i job di backup o replica di una VM eliminata | La vecchia VM è stata rimossa senza *purge* | Elimina sempre con *purge* | [38](/it/38-linux-vm-guest-agent/) |
| Il setup di Windows non trova i driver VirtIO dalla radice del CD | La ricerca non entra nelle sottocartelle | Indica la cartella esatta (es. `vioscsi\2k25\amd64`) | [39](/it/39-windows-vm-virtio/) |
| cloud-init termina con `degraded done` | Avviso di deprecazione nello user-data generato | Innocuo | [40](/it/40-templates-cloud-init-clones/) |
| Clone completo verso un altro nodo rifiutato | Il clone su un altro nodo richiede uno storage condiviso | Clona sul nodo locale e poi migra, o usa uno storage condiviso | [40](/it/40-templates-cloud-init-clones/) |
| Dentro un CT non privilegiato i file di un bind mount sono di `nobody` | Mappatura degli UID tra host e container | Mappa gli UID necessari (`lxc.idmap`, `/etc/subuid`) | [41](/it/41-lxc-containers/) |
| Montare NFS da un CT non privilegiato: `Operation not permitted` | Il mount di file system di rete richiede privilegi | Monta sull'host e usa un bind mount, o un CT privilegiato | [41](/it/41-lxc-containers/) |
| Download di template TurnKey o immagini OCI che ignorano il proxy | `pveam` passa al proxy del datacenter solo le richieste HTTP (TurnKey è in HTTPS); `skopeo` non lo usa | "Download from URL", oppure `skopeo` con `HTTPS_PROXY` | [41](/it/41-lxc-containers/) |
| La migrazione dal vivo di un container viene rifiutata | Non implementata per i CT | Migrazione con riavvio (pochi secondi di fermo) | [41](/it/41-lxc-containers/) |

### Backup

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Restore di una VM partita senza rete: un file scritto poco prima del backup è vuoto | Backup senza guest agent: nessun *fsfreeze*, il file system non era coerente | Installa e abilita il QEMU Guest Agent | [47](/it/47-proxmox-backup-server/) |
| Il job ha cancellato più backup del previsto | `keep-daily` conserva un solo backup per giorno | Usa `keep-last` per le copie dello stesso giorno; proteggi i backup importanti | [46](/it/46-vzdump-backup/) |
| Live-restore non disponibile | Richiede Proxmox Backup Server | Usa uno storage PBS | [46](/it/46-vzdump-backup/) |
| Restore cifrato: `missing key` | La chiave di cifratura non è disponibile | Senza chiave il backup è irrecuperabile: conserva la chiave fuori dal cluster | [47](/it/47-proxmox-backup-server/) |
| La GC di PBS non libera spazio subito | I chunk vengono rimossi solo dopo 24 ore | Atteso | [47](/it/47-proxmox-backup-server/) |
| Le notifiche di backup e fencing non arrivano | Nel laboratorio: messaggi rinviati nella coda di Postfix, connessione alla porta 25 dell'indirizzo del dominio scaduta per timeout; compatibile con un dominio senza record MX | Controlla `postqueue -p` e il motivo del rinvio; imposta un `relayhost` o un target SMTP | [51](/it/51-notifications-metrics-logs/) |

### Importazione da VMware ESXi

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| VM Windows importata senza l'IP statico, due volte | Ogni cambio di scheda (e1000e, poi VirtIO) crea una scheda di rete nuova | Annota l'IP e reimpostalo dopo ogni passaggio | [50](/it/50-import-from-esxi/) |
| I VMware Tools non si disinstallano dopo l'importazione (errore 1603) | Il programma di disinstallazione richiede l'ambiente VMware | Disinstallali **sull'origine**, prima dell'import | [50](/it/50-import-from-esxi/) |
| La VM Linux importata non ha rete | Il nome della scheda cambia (es. `ens18`) | Configurazione di rete che corrisponde per nome generico o per MAC | [50](/it/50-import-from-esxi/) |

### Autenticazione e permessi

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Realm LDAPS: `certificate verify failed` | La CA del dominio non è installata sul nodo | Installa la CA su tutti i nodi | [43](/it/43-active-directory-realm-ldaps/) |
| L'account di servizio del bind compare tra gli utenti sincronizzati | Il filtro utenti è troppo largo | Filtra per gruppo (`memberOf`) | [43](/it/43-active-directory-realm-ldaps/) |
| Permessi orfani impossibili da rimuovere | È stato eliminato un API token con ACL ancora assegnate | Prima rimuovi le ACL, poi il token; se è già successo ricrea il token e ripulisci | [44](/it/44-users-groups-roles-pools-tokens/) |
| Impossibile collegare la scheda di una VM a una VLAN del bridge | Manca il permesso `SDN.Use` sul percorso della VLAN | Assegna `PVESDNUser` sul percorso indicato nell'errore | [44](/it/44-users-groups-roles-pools-tokens/) |
| WebAuthn funziona su un nodo e dà 401 sugli altri | L'origin WebAuthn è legato al nome di un solo nodo | Origin di dominio e `allow-subdomains=1` | [45](/it/45-two-factor-authentication/) |
| Utente bloccato dopo troppi codici TOTP sbagliati | Protezione contro i tentativi ripetuti | Sblocco da un amministratore: **Unlock TFA** nella GUI o `pveum user tfa unlock <utente>` | [45](/it/45-two-factor-authentication/) |
| TFA imposta dal realm che rifiuta una chiave valida | Le chiavi devono essere base32 da 16 caratteri | Usa il formato corretto; rimuovi a parte la voce `<old userconfig key 0>` | [45](/it/45-two-factor-authentication/) |

### API e automazione

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| `401` su una richiesta POST con il ticket | Manca l'header `CSRFPreventionToken` | Invia il token CSRF ottenuto con il ticket, oppure usa un API token | [52](/it/52-api-automation/) |
| `403` da un API token | Con *privilege separation* il token ha solo i permessi propri, intersecati con quelli dell'utente | Assegna i permessi al token, come indicato da *Required permissions* | [44](/it/44-users-groups-roles-pools-tokens/), [52](/it/52-api-automation/) |
| Ansible riporta `changed` anche alla seconda esecuzione | Il task di aggiornamento della VM si dichiara sempre modificato | Atteso con quel modulo: valuta l'idempotenza task per task | [52](/it/52-api-automation/) |

## Dove guardare

### Interfaccia web

- **Task** (in basso): ogni operazione ha il suo log completo. Doppio clic sulla riga per aprirlo.
- **Nodo → System → System Log**: il journal del nodo.
- **Datacenter → Ceph**, **Datacenter → HA**, **Nodo → Firewall → Log**: lo stato dei singoli sottosistemi.
- **Summary** di nodi e VM: carico, memoria e grafici di **pressione** (PSI), utili per capire se un guest aspetta CPU, memoria o I/O.

### Servizi di Proxmox VE

| Servizio | Cosa fa | Log |
|---|---|---|
| `pveproxy` | Interfaccia web e API (porta 8006) | `journalctl -u pveproxy` |
| `pvedaemon` | Esegue le operazioni richieste dall'API | `journalctl -u pvedaemon` |
| `pvestatd` | Raccoglie lo stato di nodi, guest e storage | `journalctl -u pvestatd` |
| `pve-cluster` | File system del cluster `/etc/pve` (pmxcfs) | `journalctl -u pve-cluster` |
| `corosync` | Comunicazione e quorum del cluster | `journalctl -u corosync` |
| `pve-ha-crm`, `pve-ha-lrm` | Gestione dell'alta disponibilità | `journalctl -u pve-ha-crm -u pve-ha-lrm` |
| `pve-firewall`, `proxmox-firewall` | Firewall (iptables / nftables) | `journalctl -u pve-firewall -u proxmox-firewall` |
| `pvescheduler` | Job pianificati (backup, replica) | `journalctl -u pvescheduler` |
| `ceph-mon@…`, `ceph-osd@…` | Servizi Ceph | `journalctl -u ceph-osd@<id>` |
| `frr` | Routing per SDN EVPN e Fabrics | `journalctl -u frr` |

Per vedere solo gli errori dall'ultimo avvio: `journalctl -b -p err`.

### Comandi di stato

| Area | Comando |
|---|---|
| Versioni installate | `pveversion -v` |
| Rapporto completo del nodo (da allegare a una richiesta di supporto) | `pvereport` |
| Task recenti del nodo | `pvenode task list` (dettaglio: `pvenode task log <UPID>`) |
| Cluster e quorum | `pvecm status`, `corosync-cfgtool -s` |
| Alta disponibilità | `ha-manager status` |
| Ceph | `ceph -s`, `ceph health detail`, `ceph osd tree`, `ceph -w` |
| Storage | `pvesm status`, `lvs`, `zpool status`, `multipath -ll` |
| Rete | `ip -br a`, `ip -d link`, `bridge vlan show`, `bridge fdb`, `ss -tulpn` |
| SDN e routing | `pvesh get /cluster/sdn`, `vtysh -c 'show bgp summary'` |
| Firewall | `pve-firewall status`, `nft list ruleset`, `conntrack -L` |
| VM | `qm config <id>`, `qm showcmd <id> --pretty`, `qm monitor <id>` |
| Container | `pct config <id>`, `pct enter <id>` |
| Backup | `cat /var/log/vzdump/qemu-<id>.log` |
| Aggiornamento di versione maggiore | `pve8to9 --full` |

### Strumenti di cattura

- **`tcpdump -eni <interfaccia>`** sulle interfacce `tap<vmid>i<n>`, `veth<vmid>i<n>`, `fwbr…`, sul bond e sui bridge, per seguire un pacchetto lungo il percorso ([Lab 34](/it/34-network-performance-troubleshooting/)).
- **`iperf3`** per la banda tra guest e tra nodi, **`fio`** per lo storage ([Lab 19](/it/19-fio-benchmark/)).
- **`ping -M do -s <dimensione>`** per trovare l'MTU reale di un percorso ([Lab 29](/it/29-sdn-vxlan/)).

## Riferimenti

- [Proxmox VE Administration Guide](https://pve.proxmox.com/pve-docs/pve-admin-guide.html)
- [Proxmox VE – Troubleshooting e FAQ](https://pve.proxmox.com/wiki/FAQ)
- [Forum della community Proxmox](https://forum.proxmox.com/)
- [Bugzilla di Proxmox](https://bugzilla.proxmox.com/)
