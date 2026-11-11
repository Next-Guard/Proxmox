---
title: Appendice C – Risoluzione dei problemi
---

Questa appendice raccoglie i problemi incontrati durante la costruzione del laboratorio, uno per uno, con il sintomo, la causa e la soluzione. Quando il lab non ha potuto dimostrare una causa, la voce la riporta come ipotesi, come fa il lab; alcune voci descrivono un rischio che un lab ha evitato invece di un guasto osservato, e lo dichiarano. Ogni voce rimanda al lab in cui il problema è comparso e dove trovi i comandi completi e l'output.

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
| Windows Update non è utilizzabile sul DC del lab, che quindi non viene aggiornato | Il proxy del lab lascia passare solo una lista ristretta di siti, mentre Windows Update usa molti servizi Microsoft | In produzione: aggiorna il server prima di metterlo in servizio, consentendo nel proxy gli indirizzi di Windows Update o usando WSUS | [02](/it/02-domain-controller/) |
| Al primo avvio di una VM UEFI il "Press any key to boot from CD or DVD" scade senza risposta e OVMF non trova nulla da avviare (`No bootable option or device was found`) | Al primo avvio OVMF inizializza il disco EFI nuovo ed è più lento del solito: la richiesta compare e scade se nessuno guarda la console | Premi un tasto per aprire il **Boot Manager** di OVMF, scegli l'unità con la ISO di Windows e premi subito un tasto; dal secondo avvio OVMF è molto più veloce | [39](/it/39-windows-vm-virtio/) |
| `pve8to9` segnala `FAIL: systemd-boot meta-package installed` | Come dice il controllo, il meta-pacchetto causerà problemi negli aggiornamenti degli altri pacchetti di avvio | Controlla il bootloader (`proxmox-boot-tool status`), poi `apt remove systemd-boot`: con GRUB, come nella prova, il nodo continua ad avviarsi con GRUB; con ZFS in UEFI (systemd-boot) tieni `systemd-boot-efi` e `systemd-boot-tools` se lo script lo chiede | [A](/it/a-upgrade-8-to-9/) |

### Rete

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Sessione iSCSI del secondo percorso che cade ogni 10 s, VM ferma fino a 85 s | Compatibile con l'**ARP flux**: due schede dello stesso nodo sullo stesso segmento Ethernet (stesso switch e VLAN, qui con subnet diverse), e Linux risponde all'ARP da quella sbagliata; `ip neigh` sul NAS mostra quale MAC usa | `arp_ignore=1` e `arp_announce=2` in `/etc/sysctl.d/`; meglio ancora reti separate su VLAN | [15](/it/15-iscsi-lvm-multipath/) |
| Regole NAT o SNAT duplicate dopo le ricariche della rete | `ifreload -a` riesegue tutti i comandi `post-up`, anche con il file invariato: visto con regole scritte a mano nel lab 24. Per le regole SNAT dell'SDN nel lab 34 lo stesso meccanismo è un'ipotesi: conta le copie prima e dopo un `ifreload -a` | Rendi idempotenti le regole scritte a mano: `iptables -C … \|\| iptables -A …`. I duplicati dell'SDN sono stati lasciati: li elimina un riavvio del nodo | [24](/it/24-routing-nat/), [34](/it/34-network-performance-troubleshooting/) |
| Cambiata la configurazione di Corosync ma il link resta quello vecchio | Ricaricare la configurazione non basta per spostare un link | Riavvia Corosync **un nodo alla volta**, controllando il quorum tra un nodo e l'altro | [22](/it/22-dedicated-networks/) |
| Bond 802.3ad senza LACP sullo switch: il bond Linux lavora su un link alla volta (un aggregatore per scheda, `Number of ports: 1`); il bond OVS disattiva entrambi i membri e i guest perdono la rete | Nessun partner LACP: lo switch del lab non negozia l'aggregazione | Configura LACP sullo switch; se non lo controlli, usa active-backup. Con OVS, `lacp-fallback-ab` tiene su il bond ma nasconde il problema: controlla che `lacp_status` indichi `negotiated` | [21](/it/21-bonding/), [23](/it/23-open-vswitch/) |
| In una VNet VXLAN i ping grandi da un guest con MTU 1500 vanno persi (in un CT: `No buffer space available`), mentre il TCP funziona | L'incapsulamento VXLAN aggiunge 50 byte, quindi il guest ha bisogno di MTU 1450. Il TCP funziona solo perché l'host risponde con un ICMP *fragmentation needed*: con l'ICMP bloccato, o con UDP, le connessioni possono bloccarsi | MTU 1450 nella VNet e nel guest; nei CT Debian 13 scrivila anche nel file di rete del CT, perché ifupdown2 la riporta a 1500 | [29](/it/29-sdn-vxlan/), [34](/it/34-network-performance-troubleshooting/) |
| Rischio, non osservato nel lab: con QinQ un pacchetto IP da 1500 byte diventa un frame da 1522 byte (senza FCS), che uno switch che scarta i frame oltre i 1518 byte eliminerebbe senza errori | Ogni tag aggiunge 4 byte, 8 con il doppio tag | Prima di usare QinQ verifica l'MTU di tutto il percorso con `ping -M do`, oppure imposta l'MTU della zona a 1496 | [28](/it/28-sdn-vlan-qinq/) |
| Due guest nella stessa VNet Simple non si vedono | La zona **Simple** è locale a ogni nodo | Guest sullo stesso nodo, oppure zone VLAN/VXLAN/EVPN | [27](/it/27-sdn-simple/) |
| Dopo la caduta dell'exit node EVPN principale un ping già in corso non riceve più risposte fino al ripristino del collegamento (2 prove su 4), mentre un ping nuovo funziona | Osservato sull'exit node di riserva: la voce conntrack del flusso era senza traduzione degli indirizzi (`[UNREPLIED]`, metà della risposta indirizzata al guest). Il perché è un'ipotesi: i primi pacchetti potrebbero essere arrivati a quel nodo quando la sua route di default puntava ancora al principale, senza passare dalla regola SNAT (`-o vmbr0`) | Verifica con `conntrack -E` e `ip -ts monitor route` sul nodo di riserva; cancellare la voce (`conntrack -D`) mostra se la causa è quella. Se i flussi aperti devono sopravvivere, progetta un'uscita senza SNAT, con le subnet annunciate via BGP ai router di upstream (non provata qui) | [30](/it/30-sdn-evpn/) |
| Riconvergenza della fabric di 26 s quando un collegamento cade da un solo lato | Con i timer predefiniti il vicino se ne accorge solo allo scadere degli hello | Hello a 1 s: riconvergenza in circa 6 s | [31](/it/31-sdn-fabrics/) |
| I guest IPv6 non ricevono gli annunci del router (RA): non osservato nel lab, dove gli RA sono arrivati | Causa possibile, da controllare per prima: lo switch scarta gli RA delle porte non autorizzate (*RA Guard*) | Autorizza la porta del router sullo switch | [25](/it/25-ipv6/) |
| Il DC Windows registra nel DNS indirizzi IPv6 automatici | Windows accetta gli RA e si configura in SLAAC | IPv6 statico sulle schede del DC e RA disattivati | [25](/it/25-ipv6/) |
| `accept_ra=0` impostato ma le schede presenti all'avvio accettano ancora gli RA | Le chiavi `all` e `default` non si applicano alle interfacce già esistenti al boot | Usa il carattere jolly: `net.ipv6.conf.*.accept_ra = 0` in `/etc/sysctl.d/` | [25](/it/25-ipv6/) |
| Routing attraverso il router CHR: 1,07 Mbit/s (iperf3, un flusso TCP, lato ricevente), contro 5.367 Mbit/s dentro la VLAN | Compatibile con il limite di 1 Mbit/s per interfaccia della licenza gratuita (livello `free`), ma non separato dagli altri limiti del router (1 vCPU, 512 MiB di RAM) | Verifica con una licenza di prova (P1 o superiore) e `/system resource print`; in produzione, una licenza adeguata | [26](/it/26-virtual-router/) |
| Un'immagine `.img` non compare nello storage di import | Lo storage di import elenca solo le estensioni che riconosce | Rinomina il file in `.raw` | [26](/it/26-virtual-router/) |
| Jumbo frame: i pacchetti da 9000 byte tra i nodi vanno tutti persi, senza errori, mentre quelli da 8938 passano | Qualcosa sul percorso scarta i frame più grandi: compatibile con la dimensione massima dei frame dello switch, non localizzato dalla prova | MTU 1500, come nel lab, oppure un'MTU comune che tutto il percorso porta (qui al massimo 8938), verificata con `ping -M do` | [21](/it/21-bonding/) |
| Multiqueue con 4 code: banda aggregata con 4 flussi più bassa di circa il 20% (da 11,8-12,7 a 9,7-9,8 Gbit/s), nessuna differenza stabilita con un flusso | Compatibile con una contesa di CPU (due VM con 8 vCPU su un nodo da 4 core), non dimostrata: l'uso della CPU non è stato misurato | Lascialo spento, salvo che una prova prima e dopo mostri un guadagno | [34](/it/34-network-performance-troubleshooting/) |

### Firewall

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Rischio, evitato nel lab: attivare il firewall del Datacenter attiva anche quello dei nodi, e i servizi su altre reti (Ceph, il secondo link di Corosync, BGP e VXLAN, migrazione, DHCP e DNS dell'SDN) verrebbero bloccati | Policy di ingresso `DROP`; le regole automatiche coprono solo la rete di gestione e Corosync | Prima crea un security group con tutti i servizi del cluster, poi attiva un nodo alla volta con un rientro automatico pronto | [32](/it/32-firewall-1/), [33](/it/33-firewall-2/) |
| Con il firewall della VNet attivo (policy `DROP`) i guest non prendono più l'IP dal DHCP né risolvono i nomi | La policy della VNet vale anche per il traffico tra i guest e il nodo, in entrambe le direzioni: il log mostra scartate la query DNS e la risposta DHCP | Consenti il DNS verso `+sdn/<vnet>-gateway` e il DHCP nei due sensi (`dport 67`; `sport 67` → `dport 68`) | [33](/it/33-firewall-2/) |
| Il firewall della VNet non blocca il traffico verso l'esterno | Filtra il traffico tra i guest e verso il nodo, non quello instradato fuori dalla VNet | Filtralo con le regole in uscita dei guest o con quelle dell'host | [33](/it/33-firewall-2/) |
| Con nftables il traffico in SNAT da una zona Simple verso un CT con firewall sullo **stesso** nodo viene scartato, senza tracce nel log del firewall; ripetuta più tardi con la stessa configurazione, la connessione è riuscita | Conntrack scarta il pacchetto (`insert_failed`, `drop`). Causa probabile, non dimostrata: senza i bridge `fwbr` la regola dell'SDN che traccia questo traffico in una zona separata non si applica mai | Caso delicato e intermittente: guarda prima `conntrack -S`; da un altro nodo, o senza SNAT, il servizio era raggiungibile | [33](/it/33-firewall-2/) |
| Notifiche Gotify verso un indirizzo interno rifiutate con `CONNECT proxy failed: 403` | Il target Gotify usa il proxy del Datacenter anche verso gli IP interni (documentato; nel codice sorgente il target Webhook usa la stessa impostazione, non provato) | Consenti le destinazioni interne sul proxy; il log del proxy mostra la richiesta rifiutata | [51](/it/51-notifications-metrics-logs/) |

### Storage

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Scritture bloccate per 60 s, poi errori di I/O e dati persi in un container | **Thin pool LVM pieno**: l'overprovisioning ha superato lo spazio reale | Monitora `Data%` e `Meta%`; recupera con `lvextend` + `pct fstrim`; attiva l'estensione automatica con un profilo LVM | [09](/it/09-lvm-and-lvm-thin/) |
| Rischio, evitato nel lab: uno storage Directory il cui punto di mount (qui un dataset ZFS) non è montato scriverebbe nella cartella vuota sottostante, sul file system di sistema | Senza `is_mountpoint` PVE usa la cartella così com'è | Imposta `is_mountpoint`: con il percorso non montato lo storage diventa `inactive` (`directory is expected to be a mount point but is not mounted`) | [08](/it/08-storage-model/) |
| Servizio NFS fermo sul NAS: processi in stato `D` sul nodo, I/O del disco della VM bloccato, `nfs: server … not responding` | Il mount NFS è `hard`: le richieste vengono ripetute finché il server risponde | Atteso: alla ripartenza la VM era ancora accesa e non restavano processi in `D`; controlla gli errori di I/O nel guest (`journalctl -k`). Pianifica la disponibilità del NAS e della rete verso di esso | [13](/it/13-nfs/) |
| Servizio SMB fermo sul NAS: le scritture falliscono con `Host is down` dopo circa 10 s, storage `inactive` | Proxmox VE monta sempre gli storage CIFS `soft`: le operazioni falliscono invece di aspettare, a differenza di NFS montato `hard` (lab 13). Quali timeout del client CIFS diano i 10 s non è stato indagato | Atteso: ripeti l'operazione fallita; il client si riconnette da solo al ritorno del servizio. Usa SMB per ISO, template e backup, non per i dischi delle VM, dove l'errore sarebbe un errore di I/O nel guest | [14](/it/14-smb-cifs/) |
| `dd` di zeri in una VM: 2,7 GB/s su NFS, più dei 762 MB/s dello storage locale | Compatibile con zeri che non arrivano al NAS come dati (`detect_zeroes` di QEMU, compressione ZFS); la prova non dice quale meccanismo | Non misurare con gli zeri: usa dati casuali o `fio`. Per verificarlo, confronta i byte inviati da `vmbr0` prima e dopo il `dd` | [13](/it/13-nfs/) |
| Spazio libero di NFS/SMB sceso da circa 95 a 56 GiB dopo la creazione di uno zvol iSCSI da 40 GiB | Lo zvol è thick: riserva subito tutta la sua dimensione (lo mostra `zfs get volsize,refreservation`) | Togli la riserva dallo spazio libero del pool quando dimensioni le altre condivisioni | [15](/it/15-iscsi-lvm-multipath/) |
| Pausa di I/O di circa 15 s alla caduta di un percorso iSCSI | Nella prova: circa 10 s per rilevare il guasto (NOP-Out senza risposta, errore 1022) più 5 s di tempo di recupero della sessione, compatibili con il `fast_io_fail_tmo` di multipathd invece dei 15 s di `replacement_timeout` | Atteso con questi timer; leggi i valori in vigore (`/sys/class/iscsi_session/*/recovery_tmo`) prima di regolarli | [15](/it/15-iscsi-lvm-multipath/) |
| Rollback rifiutato (`not most recent`) | ZFS e la volume chain permettono il rollback solo all'ultimo snapshot | Elimina gli snapshot più recenti, o usa qcow2/LVM-thin per gli alberi di snapshot | [16](/it/16-snapshots/) |
| `snapshot feature is not available` su LVM thick, anche dopo aver attivato la volume chain | LVM thick non ha snapshot utilizzabili; la volume chain (anteprima tecnologica in PVE 9) vale solo per i dischi creati da quel momento, in formato qcow2 | Attiva **Allow Snapshots as Volume-Chain**, poi crea il disco o spostalo con `qm disk move … --format qcow2`; ogni snapshot occupa un LV grande quanto il disco | [16](/it/16-snapshots/) |
| Dopo un riavvio della VM i nomi `sdX` dei dischi SCSI e SATA si sono scambiati: una prova su `/dev/sdX` può colpire il disco sbagliato senza errori | I dischi possono essere rilevati in un ordine diverso da un avvio all'altro | Nelle prove e in `/etc/fstab` usa `/dev/disk/by-id/…` (`drive-scsiN` per i dischi SCSI) | [37](/it/37-virtual-disks-controllers/) |
| La VM non parte con `aio=native` e cache `writeback` | Combinazione non supportata da QEMU | Usa `io_uring` o la cache di default | [37](/it/37-virtual-disks-controllers/) |
| Lo stesso benchmark varia da un giro all'altro (fino a ±50% tra due giri nel lab 19; 8.247-14.864 IOPS sullo stesso disco nel lab 37) | Cause possibili, non separate dalle prove: attività nel resto del lab (Ceph, NAS, rete), scritture periodiche di ZFS, cache in scrittura del disco o del controller | Considera una differenza tra configurazioni solo se supera lo scarto tra giri della stessa configurazione; più giri, più lunghi | [19](/it/19-fio-benchmark/), [37](/it/37-virtual-disks-controllers/) |

### Ceph

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| `HEALTH_WARN BLUESTORE_SLOW_OP_ALERT` che resta per ore | Con dischi lenti sotto carico le operazioni sono lente; di default l'avviso resta visibile 24 ore dopo l'ultima occorrenza | Indaga i dischi; per farlo sparire prima, `ceph config set osd bluestore_slow_ops_warn_lifetime 600` (10 minuti) | [18](/it/18-ceph-growth-maintenance-failures/) |
| Avvisi `OSD bench result … not within the threshold` all'avvio degli OSD | All'avvio l'OSD misura il disco e ottiene IOPS fuori dalla soglia attesa | Ceph usa il valore predefinito; misura i dischi con `fio` e imposta `osd_mclock_max_capacity_iops_*` | [18](/it/18-ceph-growth-maintenance-failures/) |
| Rischio, evitato nel lab con `noout`: ricostruzione inutile delle copie quando un riavvio programmato dura più di 600 s | Dopo `mon_osd_down_out_interval` (600 s) i monitor marcano `out` gli OSD *down*, e Ceph ricostruisce altrove le loro copie | `ceph osd set noout` prima della manutenzione, `unset` dopo | [18](/it/18-ceph-growth-maintenance-failures/) |
| I/O della VM fermo per circa 27 s alla caduta brutale di un nodo | Nella prova la scrittura bloccata è ripartita quando i monitor hanno marcato *down* gli OSD del nodo, cosa che avviene dopo il periodo di grazia degli heartbeat (20 s) e le segnalazioni di guasto | Atteso; confrontalo con i timeout dei guest. La ricostruzione parte dopo 600 s se il nodo non torna | [18](/it/18-ceph-growth-maintenance-failures/) |

### Cluster e alta disponibilità

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| `/etc/pve` in sola lettura su un nodo (`Permission denied`) | Il nodo ha perso il quorum (nella prova, Corosync fermato su quel nodo) | Ripristina la comunicazione Corosync: quando il nodo rientra, `/etc/pve` torna scrivibile | [06](/it/06-cluster-corosync/) |
| Dopo un guasto la VM replicata va recuperata a mano | La replica ZFS non è HA | Solo se il nodo guasto è sicuramente spento: sposta la configurazione della VM sul nodo con la replica; si perdono i dati scritti dopo lo snapshot dell'ultimo giro riuscito. Se servono le scritture rimaste sul nodo guasto, disattiva il job prima di riaccenderlo | [11](/it/11-zfs-replication/) |
| La creazione di un gruppo HA viene rifiutata | In PVE 9 i gruppi sono stati sostituiti dalle HA rules | Usa le **node affinity rules** | [49](/it/49-high-availability/) |
| Una resource affinity rule viene rifiutata | La risorsa ha già una node affinity con più priorità | Semplifica la node affinity o rinuncia alla resource affinity | [49](/it/49-high-availability/) |
| La manutenzione di un nodo non riesce a evacuarlo | Una regola *Keep Separate* su 3 VM con 3 nodi non lascia posto | Riduci la regola o aggiungi nodi | [49](/it/49-high-availability/) |
| Dopo il guasto di un nodo i container non in HA restano spenti | Solo le risorse HA vengono riavviate altrove | Metti in HA ciò che deve ripartire da solo | [49](/it/49-high-availability/) |
| Dopo lo spegnimento brutale di un nodo la VM in HA ha risposto di nuovo solo dopo 190 s (circa tre minuti di interruzione per un client) | Il recupero aspetta che il nodo perso sia *fenced*: conferma dopo 128 s nel log del CRM, compatibile con i circa 2 minuti della documentazione. Gli altri 62 s sono compatibili con l'avvio e il boot della VM, non scomposti | Atteso: è la garanzia contro la doppia esecuzione. Un servizio che non tollera minuti di interruzione ha bisogno di ridondanza anche nell'applicazione | [49](/it/49-high-availability/) |
| La migrazione in blocco sposta più guest del previsto | La finestra *Bulk Migrate* preseleziona **tutti** i guest | Controlla la selezione prima di confermare | [48](/it/48-migrations/) |
| `qm remote-migrate` (o la migrazione da PDM) fallisce verso un nodo esterno con `no matching import/export format` | Nella prova: il disco cloud-init, che non si copia a caldo, era offerto solo nel formato `zfs`, e la destinazione LVM-thin non lo importa | Controlla `export_formats` nel log e scegli uno storage di destinazione con un formato in comune | [48](/it/48-migrations/), [53](/it/53-datacenter-manager/) |
| `qm remote-migrate` fallisce con `storage 'cephfs' does not exist` | La configurazione cita uno snippet `cicustom` su uno storage che sulla destinazione non esiste | Se lo snippet serviva solo al primo avvio, togli il riferimento (`qm set <vmid> --delete cicustom`); altrimenti rendi disponibili storage e snippet sulla destinazione | [48](/it/48-migrations/) |
| Dopo una migrazione da PDM l'origine resta con il lock `migrate` | Migrazione senza *Delete Source* | Rimuovi l'origine o il lock dopo la verifica | [53](/it/53-datacenter-manager/) |

### VM e container

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Le CPU aggiunte a caldo restano spente nel guest | Il guest non le porta online da solo | Regola udev che le attiva | [42](/it/42-hotplug-resize-limits/) |
| La scheda di rete aggiunta a caldo è `DOWN` | Nessuna configurazione nel guest per la nuova scheda | Configura l'interfaccia nel guest | [42](/it/42-hotplug-resize-limits/) |
| Il ballooning manuale "non tiene" | `pvestatd` riporta il balloon al massimo quando il nodo è scarico | Imposta il minimo e lascia lavorare l'automatismo | [36](/it/36-memory/) |
| Una nuova VM con l'ID di una VM eliminata eredita in silenzio il suo job di backup | La vecchia VM è stata rimossa senza *purge*, e il job contiene ancora il suo VMID | Elimina con *purge* (**Purge from job configurations**, `qm destroy <vmid> --purge 1`) | [38](/it/38-linux-vm-guest-agent/) |
| Il setup di Windows non trova i driver VirtIO dalla radice del CD | La ricerca non entra nelle sottocartelle | Indica la cartella esatta (es. `vioscsi\2k25\amd64`) | [39](/it/39-windows-vm-virtio/) |
| cloud-init termina con `degraded done` | Avviso di deprecazione nello user-data generato | Innocuo | [40](/it/40-templates-cloud-init-clones/) |
| Clone completo verso un altro nodo rifiutato: `can't clone to non-shared storage 'local-zfs'` | Il clone su un altro nodo richiede uno storage di destinazione condiviso | Usa uno storage di destinazione condiviso, oppure clona sullo stesso nodo | [40](/it/40-templates-cloud-init-clones/) |
| Dentro un CT non privilegiato i file di un bind mount sono di `nobody` e il `root` del CT non può scrivere | Mappatura degli UID tra host e container: il `root` del nodo (UID 0) non è mappato | Assegna la cartella al `root` del CT sul nodo (`chown -R 100000:100000`), o mappa gli UID necessari (`lxc.idmap`, `/etc/subuid`) | [41](/it/41-lxc-containers/) |
| Montare NFS da un CT non privilegiato: `Operation not permitted` | Il mount di file system di rete richiede privilegi | Monta sull'host e usa un bind mount, o un CT privilegiato | [41](/it/41-lxc-containers/) |
| Download di template TurnKey o immagini OCI che ignorano il proxy | `pveam` passa al proxy del datacenter solo le richieste HTTP (TurnKey è in HTTPS); `skopeo` non lo usa | "Download from URL", oppure `skopeo` con `HTTPS_PROXY` | [41](/it/41-lxc-containers/) |
| La migrazione dal vivo di un container viene rifiutata: `lxc live migration is currently not implemented` | Non implementata per i CT | Migrazione con riavvio (`--restart`): nel lab, con il disco su storage condiviso, task di 10 s e circa 3,4 s senza risposte al ping | [41](/it/41-lxc-containers/) |

### Backup

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Restore di una VM partita senza rete: un file scritto poco prima del backup è vuoto | Backup senza guest agent: nessun *fsfreeze*, il file system non era coerente | Installa e abilita il QEMU Guest Agent | [47](/it/47-proxmox-backup-server/) |
| Il job ha cancellato più backup del previsto: i tre fatti prima nello stesso giorno | `keep-daily` conserva un solo backup per giorno, il più recente | Simula prima la retention con `--dry-run` (`keep-last` conta i backup indipendentemente dal giorno); proteggi i backup che devono sopravvivere | [46](/it/46-vzdump-backup/) |
| Live-restore non disponibile | Richiede Proxmox Backup Server | Usa uno storage PBS | [46](/it/46-vzdump-backup/) |
| Restore cifrato: `missing key` | La chiave di cifratura non è disponibile | Senza chiave il backup è irrecuperabile: conserva la chiave fuori dal cluster | [47](/it/47-proxmox-backup-server/) |
| La GC di PBS non libera spazio subito | I chunk vengono rimossi solo dopo 24 ore | Atteso | [47](/it/47-proxmox-backup-server/) |
| Le notifiche di backup e fencing non arrivano | Nel laboratorio: messaggi rinviati nella coda di Postfix, connessione alla porta 25 dell'indirizzo del dominio scaduta per timeout; compatibile con un dominio senza record MX | Controlla `postqueue -p` e il motivo del rinvio; imposta un `relayhost` o un target SMTP | [51](/it/51-notifications-metrics-logs/) |

### Importazione da VMware ESXi

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| VM Windows importata senza l'IP statico, due volte | Ogni volta Windows vede una scheda nuova: dopo l'import (stesso modello e1000e e stesso MAC, posizione PCI diversa: `Connection #2`), poi con VirtIO | Annota l'IP e reimpostalo dopo ogni passaggio, dalla console o con `qm guest exec` quando l'agent risponde | [50](/it/50-import-from-esxi/) |
| I VMware Tools non si disinstallano dopo l'importazione (errore 1603) | Il programma di disinstallazione richiede l'ambiente VMware | Disinstallali **sull'origine**, prima dell'import; dopo l'import, ferma e disattiva i loro servizi (`VMTools`, `VGAuthService`) e pianifica una pulizia | [50](/it/50-import-from-esxi/) |
| Rischio, evitato nel lab: la VM Linux importata partirebbe senza rete | La scheda cambia nome (qui `ens18`, dallo slot PCI virtuale): una configurazione con il nome esatto, o con il match su un MAC che cambia (Unique MAC addresses), non si applica più | Prima dell'import seleziona le schede per nome con un carattere jolly (`e*`, come nel lab), o mantieni il MAC d'origine; altrimenti correggi `/etc/netplan/` dalla console e lancia `netplan apply` | [50](/it/50-import-from-esxi/) |

### Autenticazione e permessi

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| Realm LDAPS: `certificate verify failed` | La CA del dominio non è installata sul nodo | Installa la CA su tutti i nodi | [43](/it/43-active-directory-realm-ldaps/) |
| L'account di servizio del bind compare tra gli utenti sincronizzati | Il filtro utenti è troppo largo | Filtra per gruppo (`memberOf`) | [43](/it/43-active-directory-realm-ldaps/) |
| Permessi orfani impossibili da rimuovere | È stato eliminato un API token con ACL ancora assegnate | Prima rimuovi le ACL, poi il token; se è già successo ricrea il token e ripulisci | [44](/it/44-users-groups-roles-pools-tokens/) |
| Impossibile collegare la scheda di una VM a una VLAN del bridge: `Permission check failed (/sdn/zones/localnetwork/vmbr1/10, SDN.Use)` | Manca il permesso `SDN.Use` sul bridge e sulla sua VLAN | Assegna `PVESDNUser` sul bridge (`/sdn/zones/localnetwork/<bridge>`) con propagazione, così vale per tutte le sue VLAN | [44](/it/44-users-groups-roles-pools-tokens/) |
| WebAuthn funziona su un nodo e dà 401 sugli altri | L'origin WebAuthn è legato al nome di un solo nodo | Origin di dominio e `allow-subdomains=1` | [45](/it/45-two-factor-authentication/) |
| Dopo 8 codici TOTP sbagliati anche quello giusto viene rifiutato (`totp-locked: 1`) | Il TOTP dell'utente è bloccato, una protezione contro i tentativi a forza bruta | Sblocco da un amministratore (**Unlock TFA** nella GUI o `pveum user tfa unlock <utente>`), oppure accesso con un codice di recupero, che sblocca anche il TOTP | [45](/it/45-two-factor-authentication/) |
| TFA imposta dal realm: una chiave base32 da 32 caratteri accettata da `pveum` viene scartata al login (`bad otp response` nel log) | Nella prova ha funzionato solo una chiave base32 da 16 caratteri, o una esadecimale da 40 | Usa uno di questi formati; dopo aver svuotato il campo, rimuovi a parte la voce `<old userconfig key 0>` rimasta tra i fattori | [45](/it/45-two-factor-authentication/) |

### API e automazione

| Sintomo | Causa | Soluzione | Lab |
|---|---|---|---|
| `401` su una richiesta POST con il ticket | Manca l'header `CSRFPreventionToken` | Invia il token CSRF ottenuto con il ticket, oppure usa un API token | [52](/it/52-api-automation/) |
| `403` da un API token | Con *privilege separation* il token ha solo i permessi propri, intersecati con quelli dell'utente | Assegna i permessi sia al token sia all'utente, come indicato da *Required permissions* | [44](/it/44-users-groups-roles-pools-tokens/), [52](/it/52-api-automation/) |
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
