---
title: Appendix B – Lab credentials and addresses
---

This appendix gathers in one place the credentials and the addresses used throughout the manual.

## The lab password

The manual uses a single placeholder password: **`<lab-password>`**.

- Choose the password yourself before you start and use it wherever the manual shows `<lab-password>`: the domain Administrator, `root` on the Proxmox VE nodes, the NAS, Proxmox Backup Server, test users.
- Meet the Windows Server complexity requirements (at least 8 characters, with uppercase and lowercase letters, numbers and symbols), so that the same password is valid everywhere.
- A single shared password is acceptable **only in an isolated lab**. In production, every system and every service account has its own password, kept in a secrets manager.

## Accounts

| System | User | Password | Introduced in lab |
|---|---|---|---|
| Domain `proxmox.community` | `Administrator` | `<lab-password>` | 02 |
| Proxmox VE nodes | `root` (realm `pam`) | `<lab-password>` | 03 |
| Domain: service account `svc-pve-ldap` (LDAPS bind of the realm, OU `PVE/Servizi`) | `svc-pve-ldap@proxmox.community` | `<lab-password>` | 43 |
| Domain: test users (OU `PVE/Utenti`) | `mario.rossi` (pve-admins), `laura.bianchi` and `anna.neri` (pve-operators), `paolo.verdi` (pve-auditors) | `<lab-password>` | 43 |
| Domain: user outside the OU, excluded from the sync | `utente.esterno` | `<lab-password>` | 43 |
| Proxmox VE, realm `pve`: local test user (read access to the `web` pool) | `stagista@pve` | `<lab-password>` | 44 |
| Proxmox VE, realm `pve`: automation user, API token only | `automazione@pve` | none (token only) | 44 |
| Proxmox Backup Server `desopbs01` | `root` (realm `pam`) | `<lab-password>` | 47 |
| Proxmox Backup Server: user for the cluster, API token `pve-backup@pbs!pve` only (DatastoreBackup on `/datastore/zpbs`) | `pve-backup@pbs` | none (token only) | 47 |
| Cluster: encryption key of the `pbs01-cifrato` storage | file `/etc/pve/priv/storage/pbs01-cifrato.enc` | to be copied outside the cluster | 47 |
| TrueNAS NAS | `truenas_admin` | `<lab-password>` | 12 |
| TrueNAS NAS: service user for the SMB share | `svc-pve` | `<lab-password>` | 12 |
| Source ESXi server (lab 50 only) | `root` | `<lab-password>` | 50 |
| Proxmox Datacenter Manager | `root` (realm `pam`) | `<lab-password>` | 53 |
| VM `100` `debian01` | `root`, `labuser` (with sudo from lab 38) | `<lab-password>` | 07, 38 |
| CT `101` `debian-ct01` | `root` | `<lab-password>` | 07 |
| CT `121`-`123` `vlan-ct1`-`vlan-ct3` | `root` | `<lab-password>` | 20 |
| CT `401`-`404` on `desopve04` | `root` | `<lab-password>` | 23-25 |
| VM `390` `win2025` (Windows Server 2025 Evaluation) | `Administrator` | `<lab-password>` | 39 |
| Template `9000` and VMs `104`-`106` `web01`-`web03` | `labuser` (only the DC's SSH key, passwordless sudo) | – | 40 |
| CT `141` `lxc-unpriv` (unprivileged; user `ana` UID 1000) | `root`, `ana` | `<lab-password>` (`ana` without a password) | 41 |
| CT `143` `oci-nginx` (OCI application container) | – | – | 41 |
| CT `271`-`272` `simple-ct1`-`simple-ct2` | `root` | `<lab-password>` | 27 |
| CT `281`-`282` `vlan30-ct1`-`vlan30-ct2` | `root` | `<lab-password>` | 28 |
| CT `291`-`292` `vxlan-ct1`-`vxlan-ct2` | `root` | `<lab-password>` | 29 |
| CT `301`-`302` `evpn-ct1`-`evpn-ct2` | `root` | `<lab-password>` | 30 |
| Router `rtr-core` (MikroTik RouterOS 7) | `admin` | `<lab-password>` | 01 |
| VM `261` `router01` (RouterOS CHR) | `admin` | `<lab-password>` | 26 |
| Network services server `netsvc` (Ubuntu Server 24.04) | local administrator with `sudo` | of your choice | 01 |
| Admin workstation (DC) | SSH key `administrator@proxmox.community` | passphrase `<lab-password>` | 05 |
| Admin workstation (DC): firewall test script [`fwtest.ps1`](/files/32/fwtest.ps1) in `C:\lab` | `Administrator` | – | 32 |
| Gotify (CT `152`), web interface and API | `admin` ("Proxmox VE" application with a token for the `gotify` target) | `<lab-password>` | 51 |
| InfluxDB 2 (CT `153`), organization `proxmox` | `admin`; tokens `pve-scrittura` (Proxmox VE) and `grafana-lettura` (Grafana) | `<lab-password>` | 51 |
| Grafana (CT `153`) | `admin` | `<lab-password>` | 51 |
| CT `153` `monitor` | `root` | `<lab-password>` | 51 |
| Mailpit (CT `151`) | no login: it accepts all mail without authentication | – | 51 |
| CT `154` `automazione` (Ansible, OpenTofu) | `root` | `<lab-password>` | 52 |
| Proxmox VE (cluster and `desopve04`): user for PDM, API token `pdm@pve!pdm` only (`Administrator` on `/`, without privilege separation) | `pdm@pve` | none (token only, stored in PDM) | 53 |
| Proxmox Backup Server: user for PDM, API token `pdm@pbs!pdm` only (`Audit` on `/`) | `pdm@pbs` | none (token only, stored in PDM) | 53 |
| Proxmox VE: token `automazione@pve!ansible` (privilege separation, `Automazione` role on the `automazione` pool) | `automazione@pve!ansible` | secret in `/root/.pve-token` in CT 154 | 52 |

The other accounts (service accounts, test users, API tokens) are created in their respective labs and added to this table.

## Addresses

| Host name (FQDN) | Role | Management network | Storage network |
|---|---|---|---|
| `desopve-dc01.proxmox.community` | Domain controller, DNS | 172.27.199.20 | 172.32.199.20 |
| `desopve01.proxmox.community` | PVE node (cluster) | 172.27.199.21 | 172.32.199.21 |
| `desopve02.proxmox.community` | PVE node (cluster) | 172.27.199.22 | 172.32.199.22 |
| `desopve03.proxmox.community` | PVE node (cluster) | 172.27.199.23 | 172.32.199.23 |
| `desopve04.proxmox.community` | Standalone PVE node | 172.27.199.24 | 172.32.199.24 |
| `desonas.proxmox.community` | TrueNAS Community Edition 25.10 NAS | 172.27.199.10 | 172.32.199.10 (alias, from lab 15) |
| `netsvc.proxmox.community` (`proxy`, `ntp`) | HTTP proxy `:3128`, NTP; network card `lab0` (second network card `uplink0` toward the corporate network) | 172.27.199.250 | 172.32.199.250 |
| `rtr-core.proxmox.community` | Lab router (gateway), both addresses on `ether1` | 172.27.199.1 | 172.32.199.1 |
| – | Admin PC (optional, for Remote Desktop to the DC) | 172.27.199.9 | – |
| `esxi8.proxmox.community` | Source ESXi server (lab 50 only) | 172.27.199.30 | – |
| `linux-src01.proxmox.community` | Linux VM on the ESXi server (lab 50) | 172.27.199.31 | – |
| `win-src01.proxmox.community` | Windows VM on the ESXi server (lab 50) | 172.27.199.32 | – |
| `desopbs01.proxmox.community` | Proxmox Backup Server 4.2 | 172.27.199.40 | – |
| `desopdm01.proxmox.community` | Proxmox Datacenter Manager 1.1 (remotes: `deso-cluster`, `desopve04`, `desopbs01`) | 172.27.199.41 | – |
| – | Other VMs on the ESXi server (lab 50) | 172.27.199.33–39 | – |
| `pve8-test` and its container | Upgrade test node and test CT, deleted at the end ([Appendix A](/a-upgrade-8-to-9/)) | 172.27.199.80-81 | – |
| `pve-virt01` | Proxmox VE test node in a VM, deleted at the end ([Appendix D](/d-rebuild-as-virtual/)) | 172.27.199.82 | – |
| `debian01` | VM 100 (lab 07) | 172.27.199.100 | – |
| `debian-ct01` | Container 101 (lab 07) | 172.27.199.101 | – |
| – | Lab VMs and containers (ID `1xx` → address `.1xx`) | 172.27.199.100–199 | – |
| `web01`-`web03` | VMs 104-106, linked clones of template 9000 (lab 40) | 172.27.199.104-106 | – |
| `WIN2025` | VM 390 Windows Server 2025, powered off (lab 39) | 172.27.199.190 | – |
| `linux-src01` (imported) | VM 501, imported from the ESXi host (lab 50); the original on ESXi is powered off | 172.27.199.31 | – |
| `win-src01` (imported) | VM 502, imported from the ESXi host, powered off (lab 50); the original on ESXi is powered off | 172.27.199.32 | – |
| `lxc-unpriv` | Unprivileged container 141 (lab 41) | 172.27.199.141 | – |
| `oci-nginx` | Container 143 from an OCI image (lab 41) | 172.27.199.143 | – |
| `vlan-ct1`-`vlan-ct3` | Containers 121-123 (labs 20-22, gateway `router01` from lab 26) | – | VLAN 10: 10.10.10.121-122, VLAN 20: 10.20.20.123 |
| `router01.proxmox.community` | VM 261, router between VLANs 10 and 20 (lab 26) | 172.27.199.26 | VLAN 10: 10.10.10.1, VLAN 20: 10.20.20.1, DHCP .150-.199 |
| `ovs-ct1` | Container 401 on `desopve04` (lab 23) | – | VLAN 10 on OVS: 10.10.10.124 |
| `nat-ct1` | Container 402 on `desopve04` (lab 24) | behind NAT, port 8080 of the node | private network 192.168.100.10 |
| `routed-ct1` | Container 403 on `desopve04` (lab 24) | routed subnet 10.99.99.2/28 | – |
| `v6-ct1` | Container 404 on `desopve04` (lab 25) | 172.27.199.125 and SLAAC | – |
| `simple-ct1`, `simple-ct2` | Containers 271-272 on the SDN VNet `vnsimp1` (lab 27) | behind the node's SNAT | 10.60.60.100-101 (SDN DHCP) |
| `mailpit` | Container 151 from an OCI image, SMTP sink (lab 51) | 172.27.199.151 (SMTP 1025, web 8025) | – |
| `gotify` | Container 152 from an OCI image, push notifications (lab 51) | 172.27.199.152 (web 80) | – |
| `monitor` | Container 153: InfluxDB 2, Grafana, central rsyslog (lab 51) | 172.27.199.153 (8086, 3000, TCP 514) | – |
| `automazione` | Container 154: automation workstation (lab 52) | 172.27.199.154 | – |
| `ans01`, `tofu01` | Test VMs 155 and 156, created and deleted in lab 52 | 172.27.199.155-156 | – |
| `perf-341`, `perf-342` | Test VMs 341 and 342 for the network measurements, created and deleted in lab 34 (temporary addresses, free at that point of the course; from lab 41 on they belong to CTs 141 and 142) | 172.27.199.141-142 | – |
| `migra-locale` | Test VM 480 with a local disk, created and deleted in lab 48 (an exception to the ID → address rule: ID 480 has the address `.148`) | 172.27.199.148 | – |

### Node networks (labs 06, 15, 17, 20-22, 29, 31)

| Network | VLAN | Subnet | Interface on the nodes | Node addresses | Gateway | Introduced in lab |
|---|---|---|---|---|---|---|
| Management, Corosync link 0 | untagged | 172.27.199.0/24 | `vmbr0` (`nic0`), VLAN-aware | .21-.24 | `rtr-core` .1 | 03, 20 |
| Cluster and storage (Corosync link 1 until lab 22, second iSCSI path) | untagged | 172.32.199.0/24 | `nic1` | .21-.24 | `rtr-core` .1 | 06, 15 |
| Corosync link 1 | 40 | 10.40.10.0/24 | `nic1.40` | 10.40.10.21-23 | none | 22 |
| Ceph public | 50 | 10.50.10.0/24 | `nic2.50` | 10.50.10.21-23 | none | 17 |
| Ceph cluster | 51 | 10.51.10.0/24 | `nic2.51` | 10.51.10.21-23 | none | 17 |
| Migration | 100 | 10.100.10.0/24 | `vmbr1.100` | 10.100.10.21-23 | none | 22 |
| VXLAN/EVPN underlay | 61 | 10.61.10.0/24 | `vmbr1.61` | 10.61.10.21-23 | none | 29 |
| OpenFabric fabric `fab1`, point-to-point links | 81 (01-02), 82 (01-03), 83 (02-03) | 10.80.80.0/24, one `/32` per node | `vmbr1.81`-`.83` with no address of their own, loopback `dummy_fab1` | 10.80.80.1-3 | none (fabric routes) | 31 |
| VM traffic | 10, 20, … | per VLAN | `vmbr1` on `bond0` (`nic3` + `nic4`), VLAN-aware, no IP | – | `router01`: 10.10.10.1 (VLAN 10), 10.20.20.1 (VLAN 20) | 20-21, 26 |

Networks without a gateway are not routed: their traffic stays on the dedicated VLAN.

The lab switch carries these VLANs on the node ports, together with VLAN 30 of the SDN zone (lab 28) and the service VLANs 300 and 301 of the QinQ tests: the complete list, with the switch configuration rules, is in [Lab 01](/01-lab-architecture/#the-switch).

### SDN networks (labs 27-31)

| Zone | Type | VNet | Subnet | Gateway | Notes |
|---|---|---|---|---|---|
| `simple1` | Simple | `vnsimp1` | 10.60.60.0/24 | 10.60.60.1 on every node | SNAT, DHCP `.100`-`.200`, IPAM `pve` |
| `vlanz` | VLAN on `vmbr1` | `vnv30` (tag 30) | 10.30.30.0/24 (no SDN subnet) | none | CTs 281-282 `.11`-`.12` |
| `vxz` | VXLAN, MTU 1450; underlay fabric `fab1` from lab 31 (in lab 29: peers 10.61.10.21-23) | `vnvx1` (VNI 10062) | 10.62.62.0/24 (no SDN subnet) | none | CTs 291-292 `.11`-`.12`, MTU 1450 |
| `evpnz` | EVPN, controller `evpnctl` (ASN 65000), VRF-VXLAN 10070, MTU 1450 | `vnev1` (VNI 10071) | 10.71.71.0/24 | 10.71.71.1 anycast | SNAT, exit nodes `desopve01` (primary) and `desopve02`, CT 301 `.11` |
| `evpnz` | | `vnev2` (VNI 10072) | 10.72.72.0/24 | 10.72.72.1 anycast | SNAT, CT 302 `.12` |

### `desopve04` networks (labs 23-24)

| Network | Interface | Node address | Notes |
|---|---|---|---|
| VLAN 10 on Open vSwitch | `vmbr2` (OVS) on `bond1` (`nic2` + `nic3`), internal port `vlan10` | 10.10.10.24/24 | lab 23 |
| Private network with NAT | `vmbr9`, no ports | 192.168.100.1/24 | masquerading toward `vmbr0`, port forwarding `:8080` → 192.168.100.10:80 |
| Routed subnet | `vmbr8`, no ports | 10.99.99.1/28 | route on `rtr-core`: 10.99.99.0/28 via 172.27.199.24 |

### IPv6 (lab 25)

| System | IPv6 address |
|---|---|
| Management network prefix | `fd27:199::/64` (ULA), advertised by `rtr-core` with RAs |
| `rtr-core` (gateway) | `fd27:199::1`, link-local `fe80::1` |
| `desopve-dc01` | `fd27:199::20` (static, RAs disabled) |
| `desopve01`-`desopve04` | `fd27:199::21`-`::24` (static on `vmbr0`, RAs ignored) |
| Guests on `vmbr0` | SLAAC in the `fd27:199::/64` prefix |

The AAAA records of the DC and of the nodes are in the `proxmox.community` zone.

### High availability (lab 49)

| HA resource | Location | Rules |
|---|---|---|
| `vm:104` `web01` | `desopve01` | node affinity to `desopve01`; kept apart from `vm:105` (`web-separati`) |
| `vm:105` `web02` | `desopve02` | kept apart from `vm:104`; together with `ct:122` (`web02-con-ct122`) |
| `vm:106` `web03` | `desopve03` | none |
| `ct:122` `vlan-ct2` | `desopve02` | together with `vm:105` |

Datacenter CRS: `ha=dynamic`, with automatic rebalancing and *rebalance on start* enabled.

## Service ports

| Service | Address |
|---|---|
| Proxmox VE GUI | `https://<nodo>:8006` |
| HTTP proxy | `http://proxy.proxmox.community:3128` |
| NTP | `ntp.proxmox.community` (UDP 123) |
| DNS | `172.27.199.20` (UDP/TCP 53) |
| Lab mail (Mailpit) | SMTP `172.27.199.151:1025`, web `http://172.27.199.151:8025` |
| Push notifications (Gotify) | `http://172.27.199.152` |
| InfluxDB 2 | `http://172.27.199.153:8086` |
| Grafana | `http://172.27.199.153:3000` |
| Proxmox Datacenter Manager | `https://desopdm01.proxmox.community:8443` |
| Centralized logs (rsyslog) | TCP `172.27.199.153:514`, files in `/var/log/remote/<nodo>/` |
