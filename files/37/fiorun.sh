#!/bin/bash
# fiorun.sh - esegue un job fio su un disco e stampa una riga di riepilogo:
# IOPS, banda e latenza di completamento (clat), media e 99° percentile.
#
# Che cosa stampa, esattamente (dal JSON di fio, lettura o scrittura a seconda del job):
#   IOPS=       jobs[0].<read|write>.iops, operazioni completate al secondo
#   MB/s=       jobs[0].<read|write>.bw / 1024: fio riporta bw in KiB/s, quindi il valore e' in MiB/s
#   lat media=  clat_ns.mean in microsecondi: latenza di completamento, senza la sottomissione (slat)
#   p99=        99° percentile di clat_ns in microsecondi
# Con --fsync=1 la latenza stampata e' quella della sola scrittura: il tempo degli fsync
# fio lo riporta a parte (jobs[0].sync) e questo script non lo stampa.
#
# Si esegue DENTRO la VM di prova (Lab 37), come utente con sudo, dopo aver installato
# fio (sudo apt-get install -y fio). ATTENZIONE: scrive direttamente sul disco indicato,
# che deve essere un disco di prova vuoto.
#
# Uso: ./fiorun.sh <disco> <nome> <rw> <bs> <iodepth> <secondi> [opzioni fio extra]
#   <disco>  percorso sotto /dev, meglio il nome stabile: disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1
#   <rw>     randread | randwrite | read | write
#   esempio: ./fiorun.sh disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1 r4k randread 4k 32 15
#            ./fiorun.sh disk/by-id/scsi-0QEMU_QEMU_HARDDISK_drive-scsi1 w4k-qd1-fsync randwrite 4k 1 15 --fsync=1
dev=$1; name=$2; rw=$3; bs=$4; qd=$5; t=$6; shift 6
sudo fio --name="$name" --filename=/dev/$dev --rw=$rw --bs=$bs --iodepth=$qd --numjobs=1 --direct=1 \
  --ioengine=libaio --size=2G --time_based --runtime=$t --ramp_time=2 --group_reporting \
  --output-format=json "$@" 2>/dev/null |
python3 -c '
import json, sys
j = json.load(sys.stdin)["jobs"][0]
d = j["write"] if j["write"]["io_bytes"] > 0 else j["read"]
lat = d["clat_ns"]
p99 = lat.get("percentile", {}).get("99.000000", 0) / 1000
print("%-28s IOPS=%8.0f  MB/s=%7.1f  lat media=%7.0f us  p99=%7.0f us"
      % (sys.argv[1], d["iops"], d["bw"] / 1024, lat["mean"] / 1000, p99))
' "$name"
