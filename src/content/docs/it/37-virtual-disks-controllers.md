---
title: "Lab 37 – Dischi e controller virtuali: VirtIO SCSI e Block, cache, aio, discard e limiti"
level: avanzato
duration: 1 ora e 30 minuti
---

## Dipendenze

- **Lab precedenti:**
  - [Lab 35](/it/35-kvm-qemu/): processo QEMU, `qm showcmd` e monitor;
  - [Lab 09](/it/09-lvm-and-lvm-thin/): thin pool LVM e il suo riempimento;
  - [Lab 19](/it/19-fio-benchmark/): metodo di misura con `fio`.
- **Nodo e storage:** `desopve04`, nodo autonomo, con lo storage `local-lvm` (thin pool `pve/data`), così le prove non pesano sul cluster.
- **Risorse:** l'immagine cloud `debian-13-genericcloud-amd64.qcow2` in `local:import` di `desopve04`, scaricata nel [Lab 19](/it/19-fio-benchmark/), e la chiave SSH del DC ([Lab 05](/it/05-ssh-shell-cli/)). Con l'immagine si crea una VM con cloud-init (approfondito nel Lab 40).
- **Indirizzi:** VM di prova 370 su 172.27.199.170.
- **Credenziali:** `root` / `<password-lab>` → [Appendice B](/it/b-credentials-and-addresses/).

## Obiettivi

- Confrontare **VirtIO SCSI**, **VirtIO Block** e **SATA** sullo stesso storage.
- Capire le cinque modalità di **cache** e cosa rischia ognuna in caso di caduta del nodo.
- Sapere cosa cambia tra le modalità di **Async IO** (`io_uring`, `native`, `threads`).
- Far tornare spazio al thin pool con **discard** e **fstrim**, ed esporre il disco come SSD.
- Limitare banda e IOPS di un disco, anche a caldo.

## Come funziona

Un disco virtuale passa da tre livelli:

```text
guest: driver del disco ──► controller virtuale (SCSI / VirtIO Block / SATA)
QEMU:  blockdev ──► cache (page cache del nodo sì/no, flush sì/no) ──► aio (io_uring / native / threads)
nodo:  volume sullo storage (qui un thin LV di LVM)
```

**Controller.**

- **VirtIO SCSI:** controller paravirtualizzato; con **VirtIO SCSI single** ogni disco ha il proprio controller e può avere un **IO thread** dedicato. Supporta discard, molti dischi e l'hotplug. È il default consigliato.
- **VirtIO Block:** paravirtualizzato anche lui, più semplice: un dispositivo PCI per disco (`/dev/vdX`), senza il livello SCSI.
- **SATA (e IDE):** controller emulati, che ogni sistema operativo riconosce senza driver. Ogni operazione costa di più al processo QEMU. Si usano per installare sistemi senza driver VirtIO o per compatibilità.

**IO thread.** Con `iothread=1` l'I/O del disco gira in un thread dedicato invece che nel thread principale di QEMU. Con più dischi lavorano in parallelo, e l'I/O non rallenta la gestione della VM.

**Cache.** Decide se QEMU usa la page cache del nodo e se rispetta i *flush* che il guest invia per mettere i dati al sicuro:

| Modalità | Page cache del nodo | Flush del guest | Rischio se il nodo cade |
|---|---|---|---|
| `none` (default) | no (O_DIRECT) | rispettati | nessuno oltre al guest stesso |
| `writethrough` | sì, solo lettura | ogni scrittura è sincrona | nessuno, ma scritture lente |
| `writeback` | sì | rispettati | si perde solo ciò che il guest non ha ancora confermato con un flush |
| `directsync` | no | ogni scrittura è sincrona | nessuno, scritture più lente |
| `unsafe` | sì | **ignorati** | si possono perdere dati che il guest crede già scritti |

**Async IO.**

- **`io_uring`:** il default, l'interfaccia asincrona moderna di Linux.
- **`native`:** l'AIO classico del kernel; funziona solo con O_DIRECT, cioè con `cache=none` o `directsync`.
- **`threads`:** un pool di thread che fa I/O sincrono, il più compatibile.

**Discard.** Quando il guest cancella dati può dire al disco "questi blocchi sono liberi" (TRIM/UNMAP). Con `discard=on` QEMU passa la richiesta allo storage, e un thin pool rilascia lo spazio. Con il default `discard=ignore` il guest crede di aver liberato lo spazio, ma il nodo non se ne accorge.

## Procedura

### 1. La VM di prova

Una VM con il disco di sistema e tre dischi da 4 GiB sullo stesso storage, ognuno con un controller diverso:

```bash
qm create 370 --name disk-370 --memory 2048 --cores 2 --cpu host --ostype l26 \
  --net0 virtio,bridge=vmbr0 --scsihw virtio-scsi-single \
  --scsi0 local-lvm:0,import-from=local:import/debian-13-genericcloud-amd64.qcow2,iothread=1 \
  --ide2 local-lvm:cloudinit --boot order=scsi0 \
  --ipconfig0 ip=172.27.199.170/24,gw=172.27.199.1 --nameserver 172.27.199.20 \
  --ciuser labuser --sshkeys /root/.ssh/authorized_keys --serial0 socket --vga serial0
qm resize 370 scsi0 8G
qm set 370 --scsi1 local-lvm:4,iothread=1 --virtio1 local-lvm:4,iothread=1 --sata1 local-lvm:4
qm start 370
```

```text output
  WARNING: Sum of all thin volume sizes (36.00 GiB) exceeds the size of thin pool pve/data and the amount of free space in volume group (<6.13 GiB).
scsi1: local-lvm:vm-370-disk-1,iothread=1,size=4G
virtio1: local-lvm:vm-370-disk-3,iothread=1,size=4G
sata1: local-lvm:vm-370-disk-2,size=4G
```

L'avviso è l'overprovisioning del [Lab 09](/it/09-lvm-and-lvm-thin/): i volumi sommano 36 GiB su un pool da 14. Durante il lab si scrive al massimo una parte di ogni disco e si controlla il pool con `lvs`.

Nel guest:

```text
NAME SIZE ROTA TRAN   MODEL         DISC-MAX
sda    8G    1        QEMU HARDDISK       1G
sdb    4G    1 sata   QEMU HARDDISK       2G
sdc    4G    1        QEMU HARDDISK       1G
vda    4G    1 virtio                     2G
```

`ROTA 1`: tutti i dischi si presentano come dischi rotativi.

:::caution[Attenzione ai nomi dei dischi nel guest]
Dopo un riavvio della VM, nel laboratorio `sdb` e `sdc` si sono scambiati: il disco SCSI e quello SATA vengono rilevati in ordine diverso a ogni avvio. Un test lanciato su `/dev/sdX` può così finire sul disco sbagliato senza alcun errore. Nei test e in `/etc/fstab` si usano i nomi stabili in `/dev/disk/by-id`: Proxmox VE dà a ogni disco SCSI l'identificativo `drive-scsiN`.

```text
ata-QEMU_HARDDISK_QM00007 -> ../../sdc
scsi-0QEMU_QEMU_HARDDISK_drive-scsi1 -> ../../sdb
```
:::

Le misure usano `fio` con O_DIRECT nel guest, su una zona da 2 GiB di ogni disco riempita prima del test. Ogni prova dura 12-20 secondi. Le prove le lancia lo script [`fiorun.sh`](/files/37/fiorun.sh), da copiare nel guest (per esempio con `scp` dal DC, che entra con `ssh labuser@172.27.199.170`). Esegue `fio` con `--direct=1 --ioengine=libaio --size=2G --time_based --ramp_time=2` e stampa una riga con IOPS, MB/s e latenza media e al 99° percentile. `fio` si installa nel guest tramite il proxy del laboratorio, impostato come nel [Lab 36](/it/36-memory/):

```bash
sudo apt-get install -y fio
./fiorun.sh disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1 r4k randread 4k 32 15
```

### 2. Controller: VirtIO SCSI, VirtIO Block e SATA

Due giri consecutivi:

```text
== giro 1
VirtIO-SCSI+iothread randread4k IOPS=   26867  MB/s=  105.0  lat media=   1161 us  p99=   2998 us
VirtIO-SCSI+iothread randwrite4k IOPS=    8247  MB/s=   32.2  lat media=   3865 us  p99=  45351 us
VirtIO-SCSI+iothread write1M IOPS=     284  MB/s=  284.9  lat media=  27874 us  p99= 379585 us
VirtIO-Block+iothread randread4k IOPS=   30766  MB/s=  120.2  lat media=   1014 us  p99=   2736 us
VirtIO-Block+iothread randwrite4k IOPS=    7546  MB/s=   29.5  lat media=   4220 us  p99=  32637 us
VirtIO-Block+iothread write1M IOPS=     563  MB/s=  563.1  lat media=  14024 us  p99=  71827 us
SATA randread4k              IOPS=    8155  MB/s=   31.9  lat media=   3804 us  p99=   6193 us
SATA randwrite4k             IOPS=    5767  MB/s=   22.5  lat media=   5436 us  p99=  32375 us
SATA write1M                 IOPS=     468  MB/s=  468.7  lat media=  17126 us  p99= 114819 us
== giro 2
VirtIO-SCSI+iothread randread4k IOPS=   29085  MB/s=  113.6  lat media=   1072 us  p99=   2671 us
VirtIO-SCSI+iothread randwrite4k IOPS=   10540  MB/s=   41.2  lat media=   3007 us  p99=  23200 us
VirtIO-SCSI+iothread write1M IOPS=     652  MB/s=  652.1  lat media=  12245 us  p99=  78119 us
VirtIO-Block+iothread randread4k IOPS=   29454  MB/s=  115.1  lat media=   1060 us  p99=   2736 us
VirtIO-Block+iothread randwrite4k IOPS=    7146  MB/s=   27.9  lat media=   4451 us  p99=  28705 us
VirtIO-Block+iothread write1M IOPS=     628  MB/s=  628.9  lat media=  12534 us  p99=  63701 us
SATA randread4k              IOPS=    7748  MB/s=   30.3  lat media=   4003 us  p99=   6128 us
SATA randwrite4k             IOPS=    2646  MB/s=   10.3  lat media=  11972 us  p99= 304087 us
SATA write1M                 IOPS=     344  MB/s=  344.2  lat media=  22930 us  p99= 214958 us
```

| Controller | Letture casuali 4k | Scritture casuali 4k | Scrittura sequenziale 1M |
|---|---|---|---|
| VirtIO SCSI + iothread | 26.900-29.100 IOPS | 8.200-10.500 IOPS | 285-652 MB/s |
| VirtIO Block + iothread | 29.500-30.800 IOPS | 7.100-7.500 IOPS | 563-629 MB/s |
| SATA | 7.700-8.200 IOPS | 2.600-5.800 IOPS | 344-469 MB/s |

- **VirtIO SCSI e VirtIO Block** si equivalgono: le differenze stanno dentro la variabilità tra un giro e l'altro.
- **SATA** fa circa **un quarto** delle letture casuali, con latenza tre volte più alta: è il costo dell'emulazione di un controller fisico.
- **La scrittura sequenziale** varia molto tra i due giri sullo stesso disco: la velocità del disco del nodo cambia nel tempo (cache del disco e del controller, scritture in background). In un laboratorio si confrontano solo prove ravvicinate, e si ripetono.

### 3. Le modalità di cache

**Hardware → Hard Disk → Edit**, con **Advanced**, mostra tutte le opzioni del disco:

![Finestra Edit Hard Disk (scsi1) con Cache, Discard, IO thread, SSD emulation e Async IO](../../../assets/images/37/01-disco-opzioni-avanzate.png)

Per `scsi1` si provano le cinque modalità. Ogni cambio richiede di spegnere e riaccendere la VM:

```bash
qm set 370 --scsi1 local-lvm:vm-370-disk-1,iothread=1,cache=writeback
qm stop 370 && qm start 370
```

Quattro prove per modalità sul disco `/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1`. La prima è una scrittura alla volta, seguita ogni volta da un `fsync`: è il comportamento di un database che conferma le transazioni.

```text
== cache=none
fsync ogni scrittura QD1     IOPS=     545  MB/s=    2.1  lat media=   1418 us  p99=   4014 us
randwrite 4k QD32            IOPS=    8693  MB/s=   34.0  lat media=   3654 us  p99=  22938 us
randread 4k QD32             IOPS=   26063  MB/s=  101.8  lat media=   1200 us  p99=   3097 us
write 1M QD8                 IOPS=     317  MB/s=  317.5  lat media=  24870 us  p99= 160432 us
== cache=writeback
fsync ogni scrittura QD1     IOPS=     575  MB/s=    2.2  lat media=    182 us  p99=    692 us
randwrite 4k QD32            IOPS=   30334  MB/s=  118.5  lat media=   1025 us  p99=   1679 us
randread 4k QD32             IOPS=   32097  MB/s=  125.4  lat media=    971 us  p99=   2867 us
write 1M QD8                 IOPS=    2508  MB/s= 2508.7  lat media=   3018 us  p99=   9241 us
== cache=writethrough
fsync ogni scrittura QD1     IOPS=     501  MB/s=    2.0  lat media=   1901 us  p99=  13042 us
randwrite 4k QD32            IOPS=    9728  MB/s=   38.0  lat media=   3366 us  p99=  17695 us
randread 4k QD32             IOPS=   27700  MB/s=  108.2  lat media=   1129 us  p99=   4686 us
write 1M QD8                 IOPS=     537  MB/s=  537.4  lat media=  15002 us  p99=  56361 us
== cache=directsync
fsync ogni scrittura QD1     IOPS=     717  MB/s=    2.8  lat media=   1315 us  p99=   3686 us
randwrite 4k QD32            IOPS=    5583  MB/s=   21.8  lat media=   5725 us  p99=  41157 us
randread 4k QD32             IOPS=   29685  MB/s=  116.0  lat media=   1054 us  p99=   2966 us
write 1M QD8                 IOPS=     430  MB/s=  430.6  lat media=  18228 us  p99=  57934 us
== cache=unsafe
fsync ogni scrittura QD1     IOPS=    4399  MB/s=   17.2  lat media=    101 us  p99=    387 us
randwrite 4k QD32            IOPS=   30261  MB/s=  118.2  lat media=   1028 us  p99=   1876 us
randread 4k QD32             IOPS=   30653  MB/s=  119.7  lat media=   1015 us  p99=   2310 us
write 1M QD8                 IOPS=    2386  MB/s= 2386.9  lat media=   3172 us  p99=   9241 us
```

| Cache | Scrittura + fsync (QD1) | Scritture casuali 4k QD32 | Scrittura sequenziale 1M |
|---|---|---|---|
| `none` | 545 IOPS | 8.700 IOPS | 318 MB/s |
| `writethrough` | 501 IOPS | 9.700 IOPS | 537 MB/s |
| `directsync` | 717 IOPS | 5.600 IOPS | 431 MB/s |
| `writeback` | 575 IOPS | 30.300 IOPS | 2.509 MB/s |
| `unsafe` | **4.399 IOPS** | 30.300 IOPS | 2.387 MB/s |

- **`writeback` e `unsafe`:** le scritture finiscono nella RAM del nodo, da cui le velocità "impossibili" (2,5 GB/s su questo storage).
- **Con il `fsync` a ogni scrittura** `writeback` torna lento come `none`, perché ogni flush del guest costringe il nodo a scrivere davvero. Solo `unsafe` resta veloce: il flush viene **ignorato**.
- **`none`, `writethrough` e `directsync`** restano alla velocità dello storage. Le letture si equivalgono perché la zona di prova è piccola e lo storage sotto ha la sua cache.

Il monitor conferma che con `unsafe` i flush vengono scartati:

```text title="qm monitor" frame="terminal"
info block -n
```

```text output
    Cache mode:       writeback
    Cache mode:       writeback, ignore flushes
    Cache mode:       writeback, ignore flushes
```

**Dove stanno i dati quando il guest crede di averli scritti.** Nel guest si scrive 1 GiB direttamente sul disco, con `fsync` finale (`conv=fsync`), e subito dopo si guarda sul nodo la memoria "sporca", cioè i dati ancora da scrivere sul disco:

```bash
dd if=/dev/urandom of=/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1 bs=1M count=1024 oflag=direct conv=fsync   # nel guest
grep ^Dirty: /proc/meminfo                                                                                         # sul nodo
```

```text output
== cache=writeback
1073741824 bytes (1.1 GB, 1.0 GiB) copied, 6.10631 s, 176 MB/s
  nodo subito dopo: Dirty: 1456 kB
== cache=unsafe
1073741824 bytes (1.1 GB, 1.0 GiB) copied, 4.60421 s, 233 MB/s
  nodo subito dopo: Dirty: 1050036 kB
```

- **`writeback`:** quando il `fsync` del guest ritorna, i dati sono sul disco del nodo.
- **`unsafe`:** il guest ha finito e crede che il suo GiB sia al sicuro, ma è tutto ancora nella RAM del nodo. Un'interruzione di corrente in quel momento lo cancellerebbe, e il guest non lo saprebbe mai.

`unsafe` va bene solo per dati usa e getta, per esempio durante l'installazione di una VM da template. `writeback` è accettabile con un nodo protetto da UPS e sistemi che usano correttamente i flush. Il default `none` è la scelta sicura.

### 4. Async IO

`scsi1` con `cache=none`, due giri per modalità:

```text
== aio=io_uring
randread 4k QD32             IOPS=   27460  MB/s=  107.3  lat media=   1137 us  p99=   3064 us
randwrite 4k QD32            IOPS=   13340  MB/s=   52.1  lat media=   2385 us  p99=  13959 us
randread 4k QD32             IOPS=   27121  MB/s=  106.0  lat media=   1155 us  p99=   3293 us
randwrite 4k QD32            IOPS=   14864  MB/s=   58.1  lat media=   2179 us  p99=  11600 us
== aio=native
randread 4k QD32             IOPS=   32438  MB/s=  126.7  lat media=    967 us  p99=   2933 us
randwrite 4k QD32            IOPS=    6043  MB/s=   23.6  lat media=   5268 us  p99=  50594 us
randread 4k QD32             IOPS=   33112  MB/s=  129.4  lat media=    948 us  p99=   3031 us
randwrite 4k QD32            IOPS=   12222  MB/s=   47.8  lat media=   2594 us  p99=  16908 us
== aio=threads
randread 4k QD32             IOPS=   31479  MB/s=  123.0  lat media=    996 us  p99=   2769 us
randwrite 4k QD32            IOPS=    6368  MB/s=   24.9  lat media=   4995 us  p99=  31326 us
randread 4k QD32             IOPS=   30716  MB/s=  120.0  lat media=   1021 us  p99=   3064 us
randwrite 4k QD32            IOPS=    7674  MB/s=   30.0  lat media=   4142 us  p99=  57410 us
```

Le letture stanno tra 27.000 e 33.000 IOPS con tutte e tre le modalità. Le scritture variano più tra un giro e l'altro (da 6.000 a 12.200 con `native`) che tra una modalità e l'altra: in questo laboratorio non c'è un vincitore misurabile. `io_uring` resta il default sensato. `threads` serve per gli storage con cui le altre modalità danno problemi.

`native` ha un vincolo, e Proxmox VE non lo controlla prima dell'avvio:

```bash
qm stop 370
qm set 370 --scsi1 local-lvm:vm-370-disk-1,iothread=1,aio=native,cache=writeback
qm start 370
```

```text output
kvm: -blockdev {...,"file":{"aio":"native","cache":{"direct":false,"no-flush":false},...,"driver":"host_device","filename":"/dev/pve/vm-370-disk-1",...}: aio=native was specified, but it requires cache.direct=on, which was not specified.
start failed: QEMU exited with code 1
```

La configurazione viene accettata, ma la VM non parte: `native` richiede `cache=none` o `directsync`.

### 5. Discard, fstrim ed emulazione SSD

Su `scsi1` si crea un filesystem ext4. Si scrive un file da 1 GiB, lo si cancella e si chiede al guest di segnalare i blocchi liberi con `fstrim`. Sul nodo si guarda l'occupazione del volume thin:

```bash
# nel guest
D=/dev/disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1
sudo mkfs.ext4 -F $D && sudo mkdir -p /mnt/t && sudo mount $D /mnt/t
sudo dd if=/dev/urandom of=/mnt/t/prova bs=1M count=1024 conv=fsync
sudo rm /mnt/t/prova && sudo fstrim -v /mnt/t
# sul nodo, prima e dopo
lvs pve/vm-370-disk-1
```

**Con il default `discard=ignore`:**

```text
 vm-370-disk-1 50.00          ← prima (zona riempita per i test)
file-1GiB-scritto
 vm-370-disk-1 50.79
/mnt/t: 2.9 GiB (3068858368 bytes) trimmed
 vm-370-disk-1 50.79          ← dopo fstrim: nessun cambiamento
```

Il guest dichiara di aver liberato 2,9 GiB, ma il nodo non riceve niente: QEMU scarta le richieste.

**Con `discard=on` e `ssd=1`** (spegnendo e riaccendendo la VM):

```bash
qm set 370 --scsi1 local-lvm:vm-370-disk-1,iothread=1,discard=on,ssd=1
```

```text output
sdb rotational=0
/mnt/t: 3.9 GiB (4142604288 bytes) trimmed
 vm-370-disk-1 3.46           ← il volume restituisce 1,9 GiB al pool
file-1GiB-scritto
 vm-370-disk-1 28.46
/mnt/t: 6 MiB (6283264 bytes) trimmed
 vm-370-disk-1 28.46          ← fstrim lanciato subito dopo rm
/mnt/t: 1.1 GiB (1197453312 bytes) trimmed
 vm-370-disk-1 3.46           ← fstrim dopo sync e qualche secondo
 data 65.69                   ← thin pool del nodo: era al 79%
```

- **`ssd=1`:** il guest vede un disco non rotativo (`rotational=0`) e adatta scheduler e comportamento del filesystem.
- **`discard=on`:** lo spazio liberato nel guest torna davvero al thin pool.
- Il `fstrim` lanciato subito dopo `rm` libera solo 6 MiB: ext4 rilascia i blocchi del file cancellato solo al commit del journal, dopo qualche secondo. Debian lancia `fstrim` ogni settimana con `fstrim.timer` (`enabled`), quindi lo spazio torna da solo.

Con uno storage thin (LVM-thin, ZFS, Ceph, qcow2), senza `discard=on` i dischi delle VM crescono e non scendono più. È la prima causa dei thin pool che si riempiono "senza motivo" visti nel [Lab 09](/it/09-lvm-and-lvm-thin/).

### 6. Limiti di banda e IOPS

Nella scheda **Bandwidth** della stessa finestra si limitano lettura e scrittura, in MB/s e in operazioni al secondo, con un eventuale *burst* temporaneo:

![Scheda Bandwidth del disco scsi1 con Write limit 20 MB/s e Read limit 500 ops/s](../../../assets/images/37/02-disco-limiti-banda.png)

I limiti si applicano **a caldo**, senza riavviare la VM:

```bash
qm set 370 --scsi1 local-lvm:vm-370-disk-1,iothread=1,discard=on,ssd=1,mbps_wr=20,iops_rd=500
```

```text output
== senza limiti
write 1M QD8                 IOPS=     723  MB/s=  724.0  lat media=  10849 us  p99=  67633 us
randread 4k QD32             IOPS=   27229  MB/s=  106.4  lat media=   1148 us  p99=   3031 us
update VM 370: -scsi1 local-lvm:vm-370-disk-1,iothread=1,discard=on,ssd=1,mbps_wr=20,iops_rd=500
status: running
== con limiti (applicati a caldo)
write 1M QD8                 IOPS=      19  MB/s=   20.0  lat media= 403898 us  p99= 599785 us
randread 4k QD32             IOPS=     497  MB/s=    2.0  lat media=  64070 us  p99=  66322 us
```

Il limite è preciso: 20,0 MB/s e 497 IOPS. Il guest non riceve errori: le sue richieste aspettano in coda, e infatti la latenza sale a 400 ms per le scritture e a 64 ms per le letture. Serve a evitare che una VM rumorosa saturi uno storage condiviso con le altre; i limiti di CPU e il resto si vedono nel Lab 42.

## Verifica e test

- VirtIO SCSI e VirtIO Block danno risultati equivalenti; SATA ha circa un quarto delle letture casuali.
- `unsafe` ignora i flush (`ignore flushes` nel monitor) e lascia 1 GiB nella RAM del nodo dopo un `fsync` del guest; `writeback` no.
- `aio=native` con cache diversa da `none`/`directsync` impedisce l'avvio della VM.
- Con `discard=on` il `fstrim` del guest restituisce lo spazio al thin pool; con il default no.
- I limiti di banda e IOPS si applicano a caldo e sono rispettati.

## Stato finale del lab

- **VM 370 `disk-370`:** eliminata con i suoi quattro dischi (`qm stop 370 && qm destroy 370 --purge`).
- **Thin pool `pve/data` di `desopve04`:** tornato al 23,7%, come prima del lab.
- Nessuna modifica ai nodi del cluster.

## Cosa hai imparato

- Con dischi paravirtualizzati (VirtIO SCSI single o VirtIO Block) con IO thread si hanno le prestazioni migliori; SATA solo quando il guest non ha i driver.
- La cache `writeback` accelera le scritture usando la RAM del nodo ma rispetta i flush; `unsafe` li ignora e può far perdere dati che il guest considera scritti.
- `aio=native` funziona solo con O_DIRECT; `io_uring` è il default giusto.
- Senza `discard=on` lo spazio liberato nei guest non torna mai allo storage thin.
- I limiti di I/O si cambiano a caldo e proteggono gli storage condivisi dalle VM più rumorose.
- Nei guest i dischi si identificano con `/dev/disk/by-id`, non con `sdX`.

## Riferimenti

- [Proxmox VE – Virtual Machines: Hard Disk](https://pve.proxmox.com/pve-docs/chapter-qm.html#qm_hard_disk)
- [Proxmox VE wiki – Performance Tweaks (cache modes)](https://pve.proxmox.com/wiki/Performance_Tweaks)
- [QEMU – Block device options (cache, aio, discard)](https://www.qemu.org/docs/master/system/qemu-block-drivers.html)
- [fio – Flexible I/O Tester](https://fio.readthedocs.io/)
