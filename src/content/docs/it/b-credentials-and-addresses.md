---
title: Appendice B – Credenziali e indirizzi del laboratorio
---

Questa appendice raccoglie in un solo posto le credenziali e gli indirizzi usati in tutto il manuale.

## La password del laboratorio

Nel manuale compare un'unica password segnaposto: **`<password-lab>`**.

- Scegli tu la password prima di iniziare e usala ovunque il manuale indica `<password-lab>`: Administrator del dominio, `root` dei nodi Proxmox VE, NAS, Proxmox Backup Server, utenti di test.
- Rispetta i requisiti di complessità di Windows Server (almeno 8 caratteri, con maiuscole, minuscole, numeri e simboli), così la stessa password è valida ovunque.
- Una password unica va bene **solo in un laboratorio isolato**. In produzione ogni sistema e ogni account di servizio ha la sua password, custodita in un gestore di segreti.

## Account

| Sistema | Utente | Password | Introdotto nel lab |
|---|---|---|---|
| Dominio `proxmox.community` | `Administrator` | `<password-lab>` | 02 |
| Nodi Proxmox VE | `root` (realm `pam`) | `<password-lab>` | 03 |
| Dominio: account di servizio `svc-pve-ldap` (bind LDAPS del realm, OU `PVE/Servizi`) | `svc-pve-ldap@proxmox.community` | `<password-lab>` | 43 |
| Dominio: utenti di prova (OU `PVE/Utenti`) | `mario.rossi` (pve-admins), `laura.bianchi` e `anna.neri` (pve-operators), `paolo.verdi` (pve-auditors) | `<password-lab>` | 43 |
| Dominio: utente fuori dall'OU, escluso dalla sync | `utente.esterno` | `<password-lab>` | 43 |
| Proxmox VE, realm `pve`: utente locale di prova (lettura del pool `web`) | `stagista@pve` | `<password-lab>` | 44 |
| Proxmox VE, realm `pve`: utente per le automazioni, solo API token | `automazione@pve` | nessuna (solo token) | 44 |
| Proxmox Backup Server `desopbs01` | `root` (realm `pam`) | `<password-lab>` | 47 |
| Proxmox Backup Server: utente del cluster, solo API token `pve-backup@pbs!pve` (DatastoreBackup su `/datastore/zpbs`) | `pve-backup@pbs` | nessuna (solo token) | 47 |
| Cluster: chiave di cifratura dello storage `pbs01-cifrato` | file `/etc/pve/priv/storage/pbs01-cifrato.enc` | da copiare fuori dal cluster | 47 |
| NAS TrueNAS | `truenas_admin` | `<password-lab>` | 12 |
| NAS TrueNAS: utente di servizio per la condivisione SMB | `svc-pve` | `<password-lab>` | 12 |
| Server ESXi di origine (solo lab 50) | `root` | `<password-lab>` | 50 |
| Proxmox Datacenter Manager | `root` (realm `pam`) | `<password-lab>` | 53 |
| VM `100` `debian01` | `root`, `labuser` (con sudo dal lab 38) | `<password-lab>` | 07, 38 |
| CT `101` `debian-ct01` | `root` | `<password-lab>` | 07 |
| CT `121`-`123` `vlan-ct1`-`vlan-ct3` | `root` | `<password-lab>` | 20 |
| CT `401`-`404` su `desopve04` | `root` | `<password-lab>` | 23-25 |
| VM `390` `win2025` (Windows Server 2025 Evaluation) | `Administrator` | `<password-lab>` | 39 |
| Template `9000` e VM `104`-`106` `web01`-`web03` | `labuser` (solo chiave SSH del DC, sudo senza password) | – | 40 |
| CT `141` `lxc-unpriv` (non privilegiato; utente `ana` UID 1000) | `root`, `ana` | `<password-lab>` (`ana` senza password) | 41 |
| CT `143` `oci-nginx` (application container OCI) | – | – | 41 |
| CT `271`-`272` `simple-ct1`-`simple-ct2` | `root` | `<password-lab>` | 27 |
| CT `281`-`282` `vlan30-ct1`-`vlan30-ct2` | `root` | `<password-lab>` | 28 |
| CT `291`-`292` `vxlan-ct1`-`vxlan-ct2` | `root` | `<password-lab>` | 29 |
| CT `301`-`302` `evpn-ct1`-`evpn-ct2` | `root` | `<password-lab>` | 30 |
| Router `rtr-core` (MikroTik RouterOS 7) | `admin` | `<password-lab>` | 01 |
| VM `261` `router01` (RouterOS CHR) | `admin` | `<password-lab>` | 26 |
| Server di servizi di rete `netsvc` (Ubuntu Server 24.04) | amministratore locale con `sudo` | a tua scelta | 01 |
| Postazione di amministrazione (DC) | chiave SSH `administrator@proxmox.community` | passphrase `<password-lab>` | 05 |
| Postazione di amministrazione (DC): script di prova del firewall [`fwtest.ps1`](/files/32/fwtest.ps1) in `C:\lab` | `Administrator` | – | 32 |
| Gotify (CT `152`), interfaccia web e API | `admin` (applicazione "Proxmox VE" con token per il target `gotify`) | `<password-lab>` | 51 |
| InfluxDB 2 (CT `153`), organizzazione `proxmox` | `admin`; token `pve-scrittura` (Proxmox VE) e `grafana-lettura` (Grafana) | `<password-lab>` | 51 |
| Grafana (CT `153`) | `admin` | `<password-lab>` | 51 |
| CT `153` `monitor` | `root` | `<password-lab>` | 51 |
| Mailpit (CT `151`) | nessun accesso: riceve tutta la posta senza autenticazione | – | 51 |
| CT `154` `automazione` (Ansible, OpenTofu) | `root` | `<password-lab>` | 52 |
| Proxmox VE (cluster e `desopve04`): utente per PDM, solo API token `pdm@pve!pdm` (`Administrator` su `/`, senza privilege separation) | `pdm@pve` | nessuna (solo token, salvato in PDM) | 53 |
| Proxmox Backup Server: utente per PDM, solo API token `pdm@pbs!pdm` (`Audit` su `/`) | `pdm@pbs` | nessuna (solo token, salvato in PDM) | 53 |
| Proxmox VE: token `automazione@pve!ansible` (privilege separation, ruolo `Automazione` sul pool `automazione`) | `automazione@pve!ansible` | segreto in `/root/.pve-token` nel CT 154 | 52 |

Le altre utenze (account di servizio, utenti di test, API token) vengono create nei rispettivi lab e aggiunte a questa tabella.

## Indirizzi

| Nome host (FQDN) | Ruolo | Rete di gestione | Rete storage |
|---|---|---|---|
| `desopve-dc01.proxmox.community` | Domain controller, DNS | 172.27.199.20 | 172.32.199.20 |
| `desopve01.proxmox.community` | Nodo PVE (cluster) | 172.27.199.21 | 172.32.199.21 |
| `desopve02.proxmox.community` | Nodo PVE (cluster) | 172.27.199.22 | 172.32.199.22 |
| `desopve03.proxmox.community` | Nodo PVE (cluster) | 172.27.199.23 | 172.32.199.23 |
| `desopve04.proxmox.community` | Nodo PVE autonomo | 172.27.199.24 | 172.32.199.24 |
| `desonas.proxmox.community` | NAS TrueNAS Community Edition 25.10 | 172.27.199.10 | 172.32.199.10 (alias, dal lab 15) |
| `netsvc.proxmox.community` (`proxy`, `ntp`) | Proxy HTTP `:3128`, NTP; scheda `lab0` (seconda scheda `uplink0` verso la rete aziendale) | 172.27.199.250 | 172.32.199.250 |
| `rtr-core.proxmox.community` | Router del laboratorio (gateway), entrambi gli indirizzi su `ether1` | 172.27.199.1 | 172.32.199.1 |
| – | PC di amministrazione (facoltativo, per il Desktop remoto verso il DC) | 172.27.199.9 | – |
| `esxi8.proxmox.community` | Server ESXi di origine (solo lab 50) | 172.27.199.30 | – |
| `linux-src01.proxmox.community` | VM Linux sul server ESXi (lab 50) | 172.27.199.31 | – |
| `win-src01.proxmox.community` | VM Windows sul server ESXi (lab 50) | 172.27.199.32 | – |
| `desopbs01.proxmox.community` | Proxmox Backup Server 4.2 | 172.27.199.40 | – |
| `desopdm01.proxmox.community` | Proxmox Datacenter Manager 1.1 (remote: `deso-cluster`, `desopve04`, `desopbs01`) | 172.27.199.41 | – |
| – | Altre VM del server ESXi (lab 50) | 172.27.199.33–39 | – |
| `pve8-test` e il suo container | Nodo di prova dell'aggiornamento e CT di prova, eliminati alla fine ([Appendice A](/it/a-upgrade-8-to-9/)) | 172.27.199.80-81 | – |
| `pve-virt01` | Nodo Proxmox VE di prova in una VM, eliminato alla fine ([Appendice D](/it/d-rebuild-as-virtual/)) | 172.27.199.82 | – |
| `debian01` | VM 100 (lab 07) | 172.27.199.100 | – |
| `debian-ct01` | Container 101 (lab 07) | 172.27.199.101 | – |
| – | VM e container dei lab (ID `1xx` → indirizzo `.1xx`) | 172.27.199.100–199 | – |
| `web01`-`web03` | VM 104-106, linked clone del template 9000 (lab 40) | 172.27.199.104-106 | – |
| `WIN2025` | VM 390 Windows Server 2025, spenta (lab 39) | 172.27.199.190 | – |
| `linux-src01` (importata) | VM 501, importata dall'host ESXi (lab 50); l'originale su ESXi è spenta | 172.27.199.31 | – |
| `win-src01` (importata) | VM 502, importata dall'host ESXi, spenta (lab 50); l'originale su ESXi è spenta | 172.27.199.32 | – |
| `lxc-unpriv` | Container 141 non privilegiato (lab 41) | 172.27.199.141 | – |
| `oci-nginx` | Container 143 da immagine OCI (lab 41) | 172.27.199.143 | – |
| `vlan-ct1`-`vlan-ct3` | Container 121-123 (lab 20-22, gateway `router01` dal lab 26) | – | VLAN 10: 10.10.10.121-122, VLAN 20: 10.20.20.123 |
| `router01.proxmox.community` | VM 261, router tra le VLAN 10 e 20 (lab 26) | 172.27.199.26 | VLAN 10: 10.10.10.1, VLAN 20: 10.20.20.1, DHCP .150-.199 |
| `ovs-ct1` | Container 401 su `desopve04` (lab 23) | – | VLAN 10 su OVS: 10.10.10.124 |
| `nat-ct1` | Container 402 su `desopve04` (lab 24) | dietro NAT, porta 8080 del nodo | rete privata 192.168.100.10 |
| `routed-ct1` | Container 403 su `desopve04` (lab 24) | subnet instradata 10.99.99.2/28 | – |
| `v6-ct1` | Container 404 su `desopve04` (lab 25) | 172.27.199.125 e SLAAC | – |
| `simple-ct1`, `simple-ct2` | Container 271-272 sulla VNet SDN `vnsimp1` (lab 27) | dietro SNAT del nodo | 10.60.60.100-101 (DHCP dell'SDN) |
| `mailpit` | Container 151 da immagine OCI, sink SMTP (lab 51) | 172.27.199.151 (SMTP 1025, web 8025) | – |
| `gotify` | Container 152 da immagine OCI, notifiche push (lab 51) | 172.27.199.152 (web 80) | – |
| `monitor` | Container 153: InfluxDB 2, Grafana, rsyslog centrale (lab 51) | 172.27.199.153 (8086, 3000, TCP 514) | – |
| `automazione` | Container 154: postazione di automazione (lab 52) | 172.27.199.154 | – |
| `ans01`, `tofu01` | VM 155 e 156 di prova, create ed eliminate nel lab 52 | 172.27.199.155-156 | – |
| `perf-341`, `perf-342` | VM 341 e 342 di prova delle misure di rete, create ed eliminate nel lab 34 (indirizzi temporanei, liberi a quel punto del corso; dal lab 41 appartengono ai CT 141 e 142) | 172.27.199.141-142 | – |
| `migra-locale` | VM 480 di prova con disco locale, creata ed eliminata nel lab 48 (eccezione alla regola ID → indirizzo: l'ID 480 ha l'indirizzo `.148`) | 172.27.199.148 | – |

### Reti dei nodi (lab 06, 15, 17, 20-22, 29, 31)

| Rete | VLAN | Subnet | Interfaccia sui nodi | Indirizzi dei nodi | Gateway | Introdotta nel lab |
|---|---|---|---|---|---|---|
| Gestione, Corosync link 0 | senza tag | 172.27.199.0/24 | `vmbr0` (`nic0`), VLAN-aware | .21-.24 | `rtr-core` .1 | 03, 20 |
| Cluster e storage (link 1 di Corosync fino al lab 22, secondo percorso iSCSI) | senza tag | 172.32.199.0/24 | `nic1` | .21-.24 | `rtr-core` .1 | 06, 15 |
| Corosync link 1 | 40 | 10.40.10.0/24 | `nic1.40` | 10.40.10.21-23 | nessuno | 22 |
| Ceph public | 50 | 10.50.10.0/24 | `nic2.50` | 10.50.10.21-23 | nessuno | 17 |
| Ceph cluster | 51 | 10.51.10.0/24 | `nic2.51` | 10.51.10.21-23 | nessuno | 17 |
| Migrazione | 100 | 10.100.10.0/24 | `vmbr1.100` | 10.100.10.21-23 | nessuno | 22 |
| Underlay VXLAN/EVPN | 61 | 10.61.10.0/24 | `vmbr1.61` | 10.61.10.21-23 | nessuno | 29 |
| Fabric OpenFabric `fab1`, collegamenti punto-punto | 81 (01-02), 82 (01-03), 83 (02-03) | 10.80.80.0/24, un `/32` per nodo | `vmbr1.81`-`.83` senza indirizzo proprio, loopback `dummy_fab1` | 10.80.80.1-3 | nessuno (rotte della fabric) | 31 |
| Traffico delle VM | 10, 20, … | per VLAN | `vmbr1` su `bond0` (`nic3` + `nic4`), VLAN-aware, senza IP | – | `router01`: 10.10.10.1 (VLAN 10), 10.20.20.1 (VLAN 20) | 20-21, 26 |

Le reti senza gateway non sono instradate: il loro traffico resta sulla VLAN dedicata.

Lo switch del laboratorio porta queste VLAN sulle porte dei nodi, insieme alla VLAN 30 della zona SDN (lab 28) e alle service VLAN 300 e 301 delle prove QinQ: l'elenco completo, con le regole di configurazione dello switch, è nel [Lab 01](/it/01-lab-architecture/#lo-switch).

### Reti SDN (lab 27-31)

| Zona | Tipo | VNet | Subnet | Gateway | Note |
|---|---|---|---|---|---|
| `simple1` | Simple | `vnsimp1` | 10.60.60.0/24 | 10.60.60.1 su ogni nodo | SNAT, DHCP `.100`-`.200`, IPAM `pve` |
| `vlanz` | VLAN su `vmbr1` | `vnv30` (tag 30) | 10.30.30.0/24 (senza subnet SDN) | nessuno | CT 281-282 `.11`-`.12` |
| `vxz` | VXLAN, MTU 1450; underlay fabric `fab1` dal lab 31 (nel lab 29: peer 10.61.10.21-23) | `vnvx1` (VNI 10062) | 10.62.62.0/24 (senza subnet SDN) | nessuno | CT 291-292 `.11`-`.12`, MTU 1450 |
| `evpnz` | EVPN, controller `evpnctl` (ASN 65000), VRF-VXLAN 10070, MTU 1450 | `vnev1` (VNI 10071) | 10.71.71.0/24 | 10.71.71.1 anycast | SNAT, exit node `desopve01` (principale) e `desopve02`, CT 301 `.11` |
| `evpnz` | | `vnev2` (VNI 10072) | 10.72.72.0/24 | 10.72.72.1 anycast | SNAT, CT 302 `.12` |

### Reti di `desopve04` (lab 23-24)

| Rete | Interfaccia | Indirizzo del nodo | Note |
|---|---|---|---|
| VLAN 10 su Open vSwitch | `vmbr2` (OVS) su `bond1` (`nic2` + `nic3`), porta interna `vlan10` | 10.10.10.24/24 | lab 23 |
| Rete privata con NAT | `vmbr9`, senza porte | 192.168.100.1/24 | masquerading verso `vmbr0`, port forwarding `:8080` → 192.168.100.10:80 |
| Subnet instradata | `vmbr8`, senza porte | 10.99.99.1/28 | route su `rtr-core`: 10.99.99.0/28 via 172.27.199.24 |

### IPv6 (lab 25)

| Sistema | Indirizzo IPv6 |
|---|---|
| Prefisso della rete di gestione | `fd27:199::/64` (ULA), annunciato da `rtr-core` con RA |
| `rtr-core` (gateway) | `fd27:199::1`, link-local `fe80::1` |
| `desopve-dc01` | `fd27:199::20` (statico, RA disattivati) |
| `desopve01`-`desopve04` | `fd27:199::21`-`::24` (statici su `vmbr0`, RA ignorati) |
| Guest su `vmbr0` | SLAAC nel prefisso `fd27:199::/64` |

I record AAAA del DC e dei nodi sono nella zona `proxmox.community`.

### Alta disponibilità (lab 49)

| Risorsa HA | Posizione | Regole |
|---|---|---|
| `vm:104` `web01` | `desopve01` | node affinity verso `desopve01`; separata da `vm:105` (`web-separati`) |
| `vm:105` `web02` | `desopve02` | separata da `vm:104`; insieme a `ct:122` (`web02-con-ct122`) |
| `vm:106` `web03` | `desopve03` | nessuna |
| `ct:122` `vlan-ct2` | `desopve02` | insieme a `vm:105` |

CRS del datacenter: `ha=dynamic`, ribilanciamento automatico e *rebalance on start* attivi.

## Porte di servizio

| Servizio | Indirizzo |
|---|---|
| GUI di Proxmox VE | `https://<nodo>:8006` |
| Proxy HTTP | `http://proxy.proxmox.community:3128` |
| NTP | `ntp.proxmox.community` (UDP 123) |
| DNS | `172.27.199.20` (UDP/TCP 53) |
| Posta di laboratorio (Mailpit) | SMTP `172.27.199.151:1025`, web `http://172.27.199.151:8025` |
| Notifiche push (Gotify) | `http://172.27.199.152` |
| InfluxDB 2 | `http://172.27.199.153:8086` |
| Grafana | `http://172.27.199.153:3000` |
| Proxmox Datacenter Manager | `https://desopdm01.proxmox.community:8443` |
| Log centralizzati (rsyslog) | TCP `172.27.199.153:514`, file in `/var/log/remote/<nodo>/` |
