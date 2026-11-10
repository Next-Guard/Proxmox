#!/bin/bash
# fwenable.sh - attiva il firewall dell'host con il motore nftables, protetto da un
# rientro automatico ("dead man's switch"): se dopo 4 minuti il timer non è stato
# annullato, il nodo spegne da solo il firewall.
#
# Si esegue SUL NODO, come root, un nodo alla volta (per esempio via SSH dal DC):
#   ./fwenable.sh
# Se tutte le verifiche sono a posto, si annulla il rientro:
#   systemctl stop fw-dms.timer
#
# Il rientro lavora solo in locale: ferma proxmox-firewall e cancella le sue tabelle
# PRIMA di provare a cambiare la configurazione in /etc/pve. Se il nodo ha perso il
# quorum, /etc/pve è in sola lettura e "pvesh set" fallisce, ma il nodo torna comunque
# raggiungibile. Per riaccendere il firewall dopo un rientro:
#   pvesh set /nodes/<nodo>/firewall/options --enable 1 --nftables 1
#   systemctl start proxmox-firewall
set -u
N=$(hostname)

systemd-run --quiet --unit=fw-dms --on-active=240 /bin/sh -c "\
  systemctl stop proxmox-firewall; \
  nft delete table inet proxmox-firewall 2>/dev/null; \
  nft delete table bridge proxmox-firewall-guests 2>/dev/null; \
  pvesh set /nodes/$N/firewall/options --enable 0 --nftables 0 || true"
systemctl list-timers fw-dms.timer --no-pager | sed -n 2p | cut -c1-60

pvesh set /nodes/$N/firewall/options --enable 1 --nftables 1
systemctl start proxmox-firewall
echo "attivato: $(date +%T)"

# Si lascia al firewall il tempo di applicare le regole, poi si controlla tutto.
sleep 25
echo "== $N: $(date +%T)"
pve-firewall status
nft list tables
pvecm status | grep -E "Quorate"
corosync-cfgtool -s | grep -c connected
ceph -s | grep -E "health:|osd:"
vtysh -c "show bgp summary" | grep -E "^desopve" | awk '{print $1, $NF, $(NF-1)}'
vtysh -c "show openfabric neighbor" 2>/dev/null | grep -c Up
multipath -ll | grep -c "active ready"
