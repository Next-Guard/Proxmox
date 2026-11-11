---
title: Appendix C – Troubleshooting
---

This appendix collects the **real** problems encountered while building the lab, one by one, with the symptom, the cause and the solution. Each entry points to the lab in which the problem appeared, where you will find the complete commands and output.

The second part shows **where to look** when something does not work: logs, status commands and Proxmox VE diagnostic tools.

## The method

When you face a problem, it pays to always proceed the same way:

1. **Describe the symptom precisely**: what does not work, since when, on which nodes or guests, with which error message.
2. **Narrow down the scope**: a single guest or all of them? A single node or the whole cluster? Only from one network or from everywhere?
3. **Read the logs before changing anything**: the task log in the GUI, then the journal of the service involved (see [Where to look](#where-to-look)).
4. **Form a hypothesis and verify it with a single test**, without changing several things at once.
5. **Prepare the way back** before every change: a backup of the configuration, a snapshot, an SSH session already open.
6. **Write down the cause and the solution**: next time the problem is solved in a few minutes.

## Real problems, by area

### Installation and updates

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| `hostname -f` returns a domain different from the one entered in the installer | In the installer you went back after the network screen, and the name confirmed earlier stayed in `/etc/hosts` | Fix `/etc/hosts` (and `resolv.conf`, Postfix) **before** creating the cluster, then run `pvecm updatecerts --force` | [03](/03-install-proxmox-ve/) |
| `error reading cached package status in '/var/lib/pve-manager/pkgupdates'` | Update cache not yet created on a freshly installed node | Harmless: it disappears after the first `pveupdate` or an update check from the GUI | [04](/04-first-access-repositories-updates/) |
| `pveam update` fails, while `apt` works | `apt` uses the proxy from `/etc/apt/apt.conf.d/`, `pveam` the datacenter one | Set **Datacenter → Options → HTTP proxy** (or `pvesh set /cluster/options --http_proxy …`) | [04](/04-first-access-repositories-updates/), [A](/a-upgrade-8-to-9/) |
| Windows Update on the DC fails behind the lab proxy | The proxy only lets a restricted list of sites through | In production: allow the Windows Update addresses or use WSUS | [02](/02-domain-controller/) |
| On the first boot of a UEFI VM, the "Press any key to boot from CD" prompt times out before it appears | On the first boot OVMF initializes the new EFI disk, and the prompt times out before it can be seen | Boot from the OVMF **Boot Manager**; from the second boot on, the firmware is fast | [39](/39-windows-vm-virtio/) |
| `pve8to9` reports `FAIL: systemd-boot meta-package installed` | On Debian 13 the `systemd-boot` meta-package interferes with the bootloader at every update | If the node boots with GRUB, remove `systemd-boot` before the upgrade | [A](/a-upgrade-8-to-9/) |

### Network

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| iSCSI session on the second path dropping every 10 s, VM stalled for up to 85 s | Consistent with **ARP flux**: two network cards of the same node on the same Ethernet segment (same switch and VLAN, here with different subnets), with Linux answering ARP from the wrong one; `ip neigh` on the NAS shows which MAC address it uses | `arp_ignore=1` and `arp_announce=2` in `/etc/sysctl.d/`; better still, separate networks on VLANs | [15](/15-iscsi-lvm-multipath/) |
| NAT or SNAT rules duplicated at every `ifreload` | The `post-up` commands run again at every network reload | Make the rules idempotent: `iptables -C … \|\| iptables -A …` | [24](/24-routing-nat/), [34](/34-network-performance-troubleshooting/) |
| Corosync configuration changed, but the link stays the old one | Reloading the configuration is not enough to move a link | Restart Corosync **one node at a time**, checking the quorum between one node and the next | [22](/22-dedicated-networks/) |
| 802.3ad bond with a single active link (Linux) or bond completely down (OVS) | No LACP partner: the switch does not negotiate the aggregation | Configure LACP on the switch; with OVS, `lacp-fallback-ab` keeps the bond from going down | [21](/21-bonding/), [23](/23-open-vswitch/) |
| Large ping packets lost, TCP slow or stuck in a VXLAN/EVPN VNet | Guest MTU too high: VXLAN encapsulation adds 50 bytes | MTU 1450 in the VNet and in the guest; in Debian 13 CTs also write it in the CT network file, because ifupdown2 resets it to 1500 | [29](/29-sdn-vxlan/) |
| QinQ frames dropped by a switch with MTU 1500 | The double tag adds 4 bytes to the frame | MTU 1496 in the guests, or a larger MTU on the switches | [28](/28-sdn-vlan-qinq/) |
| Two guests in the same Simple VNet cannot see each other | The **Simple** zone is local to each node | Guests on the same node, or VLAN/VXLAN/EVPN zones | [27](/27-sdn-simple/) |
| After the EVPN exit node goes down, an already open connection stays stuck | The other exit node does not have the NAT state of that connection | SNAT is *stateful*: in production avoid SNAT and have the subnets announced via BGP to the upstream routers, so that replies come back through any exit node | [30](/30-sdn-evpn/) |
| Fabric reconvergence takes 26 s when a link goes down on one side only | With the default timers, the neighbor only notices when the hellos expire | Hello at 1 s: reconvergence in about 6 s | [31](/31-sdn-fabrics/) |
| IPv6 guests do not receive router advertisements (RA) | The switch drops the RAs (*RA Guard*) | Authorize the router port on the switch | [25](/25-ipv6/) |
| The Windows DC registers automatic IPv6 addresses in DNS | Windows accepts RAs and configures itself via SLAAC | Static IPv6 on the DC network cards and RAs disabled | [25](/25-ipv6/) |
| `accept_ra=0` is set, but the network cards present at boot still accept RAs | The `all` and `default` keys do not apply to interfaces that already exist at boot | Use the wildcard: `net.ipv6.conf.*.accept_ra = 0` in `/etc/sysctl.d/` | [25](/25-ipv6/) |
| Routing through the CHR router runs at about 1 Mbit/s | Limit of the free RouterOS CHR license | An appropriate license for a production router | [26](/26-virtual-router/) |
| An `.img` image does not show up in the import storage | The import storage only lists the extensions it recognizes | Rename the file to `.raw` | [26](/26-virtual-router/) |
| Jumbo frames: 100% loss with MTU 9000 | The switch, or a segment of the path, does not support jumbo frames | MTU 1500 everywhere, or jumbo frames enabled along the whole path | [21](/21-bonding/), [34](/34-network-performance-troubleshooting/) |
| Multiqueue does not improve (it actually worsens) a VM's bandwidth | In the lab the extra queues brought no benefit: the result depends on CPU, network card and load | Always measure before and after | [34](/34-network-performance-troubleshooting/) |

### Firewall

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| After enabling the host firewall, the cluster loses services (Ceph, BGP, migration) | `DROP` input policy without rules for the traffic between the nodes | First create a security group with all the cluster services, then enable one node at a time with an automatic rollback ready | [32](/32-firewall-1/), [33](/33-firewall-2/) |
| With the VNet firewall enabled, the guests no longer get an IP address from DHCP or resolve names | The VNet firewall also filters the traffic to the gateway on the node | Explicitly allow DHCP and DNS to the VNet gateway | [33](/33-firewall-2/) |
| The VNet firewall does not block outbound traffic | It filters the traffic between guests and to the node, not the traffic routed out of the VNet | Filter outbound traffic on the guest firewall or on a router | [33](/33-firewall-2/) |
| With nftables, SNAT traffic from a Simple zone to a CT with its firewall enabled on the **same** node is dropped | Conntrack drops the connection (`insert_failed`) | Open issue: avoid the combination, or disable the firewall of the destination CT | [33](/33-firewall-2/) |
| Gotify notifications to an internal address rejected with `CONNECT proxy failed: 403` | The Gotify target uses the Datacenter proxy even for internal IPs (documented; in the source code the Webhook target uses the same setting, not tested) | Allow the internal destinations on the proxy; the proxy log shows the refused request | [51](/51-notifications-metrics-logs/) |

### Storage

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| Writes blocked for 60 s, then I/O errors and data lost in a container | **Full LVM thin pool**: overprovisioning exceeded the real space | Monitor `Data%` and `Meta%`; recover with `lvextend` + `pct fstrim`; enable automatic extension with an LVM profile | [09](/09-lvm-and-lvm-thin/) |
| A Directory storage writes to the system disk when the dedicated disk is not mounted | Without `is_mountpoint`, PVE uses the empty folder | Set `is_mountpoint` on the Directory storage | [08](/08-storage-model/) |
| NFS NAS down: processes in `D` state, VMs stuck, high *load average* | The NFS mount is `hard`: I/O waits for the server indefinitely | Expected: when the NAS comes back everything resumes; plan for NAS redundancy | [13](/13-nfs/) |
| SMB down: `Host is down` error after about 10 s | The CIFS mount is `soft` | Writes fail instead of waiting: decide which behavior you prefer for VM disks | [14](/14-smb-cifs/) |
| `dd` with zeros gives unrealistic performance | Compression and zero detection on the NAS | Measure with random data or with `fio` | [13](/13-nfs/), [19](/19-fio-benchmark/) |
| NFS/SMB free space dropped after creating an iSCSI LUN | The zvol is thick and reserves all its space immediately | Account for the reservation when sizing, or consider a *sparse* (thin) zvol | [15](/15-iscsi-lvm-multipath/) |
| I/O pause of about 15 s when an iSCSI path fails | In the test: about 10 s to detect the failure (unanswered NOP-Out, error 1022) plus a 5 s session recovery timeout, consistent with multipathd's `fast_io_fail_tmo` rather than the 15 s of `replacement_timeout` | Expected with these timers; read the values in effect (`/sys/class/iscsi_session/*/recovery_tmo`) before tuning them | [15](/15-iscsi-lvm-multipath/) |
| Rollback refused (`not most recent`) | ZFS and the volume chain only allow a rollback to the latest snapshot | Delete the more recent snapshots, or use qcow2/LVM-thin for snapshot trees | [16](/16-snapshots/) |
| `snapshot feature is not available` on LVM | Thick LVM does not support classic snapshots | Enable the volume chain (each snapshot takes as much space as the disk) or use LVM-thin | [16](/16-snapshots/) |
| fio measurements on the wrong disk inside a VM | The `sdX` names swap from one boot to the next when SATA and SCSI controllers are used together | Always use `/dev/disk/by-id/…` | [37](/37-virtual-disks-controllers/) |
| The VM does not start with `aio=native` and `writeback` cache | Combination not supported by QEMU | Use `io_uring` or the default cache | [37](/37-virtual-disks-controllers/) |
| Benchmark values differ from one test to the next | Cache, background activity (scrub, Ceph rebalancing) and shared load on the NAS and Ceph | Only compare repeated tests run close together | [19](/19-fio-benchmark/), [37](/37-virtual-disks-controllers/) |

### Ceph

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| `HEALTH_WARN BLUESTORE_SLOW_OP_ALERT` that persists for hours | Slow disks generate slow operations; by default the warning stays visible for 24 hours | Investigate the disks; in the lab, `bluestore_slow_ops_warn_lifetime 600` | [22](/22-dedicated-networks/) |
| `OSD bench result … not within the threshold` warnings when the OSDs start | At startup the OSD benchmarks the disk and gets IOPS outside the expected threshold | Ceph uses the default value; measure the disks with `fio` and set `osd_mclock_max_capacity_iops_*` | [18](/18-ceph-growth-maintenance-failures/) |
| Needless rebalancing during a planned reboot | Without `noout`, the OSDs are marked `out` after 600 s | `ceph osd set noout` before the maintenance, `unset` after it | [18](/18-ceph-growth-maintenance-failures/) |
| VM I/O stalled for about 27 s when a node fails abruptly | Time Ceph needs to detect the failure | Expected; recovery starts after 600 s if the node does not come back | [18](/18-ceph-growth-maintenance-failures/) |

### Cluster and high availability

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| `/etc/pve` read-only on a node | The node has lost quorum | Restore Corosync communication; do not force `pvecm expected` unless you know what you are doing | [06](/06-cluster-corosync/) |
| After a failure the replicated VM must be recovered manually | ZFS replication is not HA | Move the VM configuration to the node holding the replica; the data written after the snapshot of the last successful run is lost. If you need the writes left on the failed node, disable the job before powering it back on | [11](/11-zfs-replication/) |
| Creating an HA group is rejected | In PVE 9, groups have been replaced by HA rules | Use **node affinity rules** | [49](/49-high-availability/) |
| A resource affinity rule is rejected | The resource is already in a node affinity rule with multiple priorities | Simplify the node affinity or do without the resource affinity | [49](/49-high-availability/) |
| Maintenance mode cannot evacuate a node | A *Keep Separate* rule on 3 VMs with 3 nodes leaves no room | Reduce the rule or add nodes | [49](/49-high-availability/) |
| After a node failure, containers not under HA stay off | Only HA resources are restarted elsewhere | Put under HA whatever must restart on its own | [49](/49-high-availability/) |
| HA recovery takes about 2 minutes | The failed node must be *fenced* before the recovery | Expected: it is the guarantee against running the same guest twice | [49](/49-high-availability/) |
| Bulk migration moves more guests than expected | The *Bulk Migrate* window preselects **all** guests | Check the selection before confirming | [48](/48-migrations/) |
| `qm remote-migrate` (or a PDM migration) to an external node fails with `no matching import/export format` | In the test: the cloud-init disk, which is not copied live, was offered only in the `zfs` format, and the LVM-thin target cannot import it; in another attempt, a `cicustom` snippet missing on the target | Check `export_formats` in the log and pick a target storage with a format in common; prepare the snippets on the target | [48](/48-migrations/), [53](/53-datacenter-manager/) |
| After a migration from PDM, the source keeps the `migrate` lock | Migration without *Delete Source* | Remove the source or the lock after verification | [53](/53-datacenter-manager/) |

### VMs and containers

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| Hot-plugged CPUs stay offline in the guest | The guest does not bring them online by itself | A udev rule that brings them online | [42](/42-hotplug-resize-limits/) |
| The hot-plugged network card is `DOWN` | No configuration in the guest for the new network card | Configure the interface in the guest | [42](/42-hotplug-resize-limits/) |
| Manual ballooning "does not stick" | `pvestatd` sets the balloon back to the maximum when the node is not under load | Set the minimum and let the automatic mechanism do its work | [36](/36-memory/) |
| A new VM inherits the backup or replication jobs of a deleted VM | The old VM was removed without *purge* | Always delete with *purge* | [38](/38-linux-vm-guest-agent/) |
| Windows setup does not find the VirtIO drivers from the root of the CD | The search does not descend into subfolders | Point it to the exact folder (e.g. `vioscsi\2k25\amd64`) | [39](/39-windows-vm-virtio/) |
| cloud-init ends with `degraded done` | Deprecation warning in the generated user-data | Harmless | [40](/40-templates-cloud-init-clones/) |
| Full clone to another node refused | Cloning to another node requires shared storage | Clone on the local node and then migrate, or use shared storage | [40](/40-templates-cloud-init-clones/) |
| Inside an unprivileged CT, the files of a bind mount belong to `nobody` | UID mapping between host and container | Map the required UIDs (`lxc.idmap`, `/etc/subuid`) | [41](/41-lxc-containers/) |
| Mounting NFS from an unprivileged CT: `Operation not permitted` | Mounting network file systems requires privileges | Mount on the host and use a bind mount, or use a privileged CT | [41](/41-lxc-containers/) |
| Downloads of TurnKey templates or OCI images ignore the proxy | `pveam` passes only HTTP requests to the datacenter proxy (TurnKey uses HTTPS); `skopeo` does not use it | "Download from URL", or `skopeo` with `HTTPS_PROXY` | [41](/41-lxc-containers/) |
| Live migration of a container is refused | Not implemented for CTs | Restart migration (a few seconds of downtime) | [41](/41-lxc-containers/) |

### Backup

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| A restored VM starts without network: a file written shortly before the backup is empty | Backup without the guest agent: no *fsfreeze*, the file system was not consistent | Install and enable the QEMU Guest Agent | [47](/47-proxmox-backup-server/) |
| The job deleted more backups than expected | `keep-daily` keeps only one backup per day | Use `keep-last` for copies made on the same day; protect important backups | [46](/46-vzdump-backup/) |
| Live-restore not available | It requires Proxmox Backup Server | Use a PBS storage | [46](/46-vzdump-backup/) |
| Encrypted restore: `missing key` | The encryption key is not available | Without the key the backup cannot be recovered: keep the key outside the cluster | [47](/47-proxmox-backup-server/) |
| PBS GC does not free space immediately | Chunks are removed only after 24 hours | Expected | [47](/47-proxmox-backup-server/) |
| Backup and fencing notifications do not arrive | In the lab: messages deferred in the Postfix queue, the connection to port 25 of the domain's own address timed out; consistent with a domain without an MX record | Check `postqueue -p` and the reason for the deferral; set a `relayhost` or an SMTP target | [51](/51-notifications-metrics-logs/) |

### Importing from VMware ESXi

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| Imported Windows VM loses its static IP, twice | Every network card change (e1000e, then VirtIO) creates a new network adapter | Write down the IP address and set it again after each change | [50](/50-import-from-esxi/) |
| VMware Tools cannot be uninstalled after the import (error 1603) | The uninstaller requires the VMware environment | Uninstall them **on the source**, before the import | [50](/50-import-from-esxi/) |
| The imported Linux VM has no network | The network card name changes (e.g. `ens18`) | A network configuration that matches by generic name or by MAC address | [50](/50-import-from-esxi/) |

### Authentication and permissions

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| LDAPS realm: `certificate verify failed` | The domain CA is not installed on the node | Install the CA on all nodes | [43](/43-active-directory-realm-ldaps/) |
| The bind service account shows up among the synced users | The user filter is too broad | Filter by group (`memberOf`) | [43](/43-active-directory-realm-ldaps/) |
| Orphaned permissions that cannot be removed | An API token was deleted while ACLs were still assigned to it | Remove the ACLs first, then the token; if it has already happened, recreate the token and clean up | [44](/44-users-groups-roles-pools-tokens/) |
| Cannot connect a VM network card to a VLAN of the bridge | The `SDN.Use` permission on the VLAN path is missing | Assign `PVESDNUser` on the path shown in the error | [44](/44-users-groups-roles-pools-tokens/) |
| WebAuthn works on one node and returns 401 on the others | The WebAuthn origin is tied to the name of a single node | A domain origin and `allow-subdomains=1` | [45](/45-two-factor-authentication/) |
| User locked out after too many wrong TOTP codes | Protection against repeated attempts | Unlock by an administrator: **Unlock TFA** in the GUI or `pveum user tfa unlock <utente>` | [45](/45-two-factor-authentication/) |
| Realm-enforced TFA rejects a valid key | Keys must be 16-character base32 strings | Use the correct format; remove the `<old userconfig key 0>` entry separately | [45](/45-two-factor-authentication/) |

### API and automation

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| `401` on a POST request with the ticket | The `CSRFPreventionToken` header is missing | Send the CSRF token obtained with the ticket, or use an API token | [52](/52-api-automation/) |
| `403` from an API token | With *privilege separation* the token only has its own permissions, intersected with the user's | Assign the permissions to the token, as indicated by *Required permissions* | [44](/44-users-groups-roles-pools-tokens/), [52](/52-api-automation/) |
| Ansible reports `changed` even on the second run | The VM update task always reports itself as changed | Expected with that module: evaluate idempotency task by task | [52](/52-api-automation/) |

## Where to look

### Web interface

- **Tasks** (at the bottom): every operation has its complete log. Double-click the row to open it.
- **Node → System → System Log**: the node journal.
- **Datacenter → Ceph**, **Datacenter → HA**, **Node → Firewall → Log**: the status of the individual subsystems.
- **Summary** of nodes and VMs: load, memory and **pressure** graphs (PSI), useful to understand whether a guest is waiting for CPU, memory or I/O.

### Proxmox VE services

| Service | What it does | Log |
|---|---|---|
| `pveproxy` | Web interface and API (port 8006) | `journalctl -u pveproxy` |
| `pvedaemon` | Runs the operations requested through the API | `journalctl -u pvedaemon` |
| `pvestatd` | Collects the status of nodes, guests and storage | `journalctl -u pvestatd` |
| `pve-cluster` | Cluster file system `/etc/pve` (pmxcfs) | `journalctl -u pve-cluster` |
| `corosync` | Cluster communication and quorum | `journalctl -u corosync` |
| `pve-ha-crm`, `pve-ha-lrm` | High availability management | `journalctl -u pve-ha-crm -u pve-ha-lrm` |
| `pve-firewall`, `proxmox-firewall` | Firewall (iptables / nftables) | `journalctl -u pve-firewall -u proxmox-firewall` |
| `pvescheduler` | Scheduled jobs (backup, replication) | `journalctl -u pvescheduler` |
| `ceph-mon@…`, `ceph-osd@…` | Ceph services | `journalctl -u ceph-osd@<id>` |
| `frr` | Routing for SDN EVPN and Fabrics | `journalctl -u frr` |

To see only the errors since the last boot: `journalctl -b -p err`.

### Status commands

| Area | Command |
|---|---|
| Installed versions | `pveversion -v` |
| Complete node report (to attach to a support request) | `pvereport` |
| Recent node tasks | `pvenode task list` (details: `pvenode task log <UPID>`) |
| Cluster and quorum | `pvecm status`, `corosync-cfgtool -s` |
| High availability | `ha-manager status` |
| Ceph | `ceph -s`, `ceph health detail`, `ceph osd tree`, `ceph -w` |
| Storage | `pvesm status`, `lvs`, `zpool status`, `multipath -ll` |
| Network | `ip -br a`, `ip -d link`, `bridge vlan show`, `bridge fdb`, `ss -tulpn` |
| SDN and routing | `pvesh get /cluster/sdn`, `vtysh -c 'show bgp summary'` |
| Firewall | `pve-firewall status`, `nft list ruleset`, `conntrack -L` |
| VM | `qm config <id>`, `qm showcmd <id> --pretty`, `qm monitor <id>` |
| Container | `pct config <id>`, `pct enter <id>` |
| Backup | `cat /var/log/vzdump/qemu-<id>.log` |
| Major version upgrade | `pve8to9 --full` |

### Capture tools

- **`tcpdump -eni <interfaccia>`** on the `tap<vmid>i<n>`, `veth<vmid>i<n>` and `fwbr…` interfaces, on the bond and on the bridges, to follow a packet along its path ([Lab 34](/34-network-performance-troubleshooting/)).
- **`iperf3`** for the bandwidth between guests and between nodes, **`fio`** for storage ([Lab 19](/19-fio-benchmark/)).
- **`ping -M do -s <dimensione>`** to find the real MTU of a path ([Lab 29](/29-sdn-vxlan/)).

## References

- [Proxmox VE Administration Guide](https://pve.proxmox.com/pve-docs/pve-admin-guide.html)
- [Proxmox VE – Troubleshooting and FAQ](https://pve.proxmox.com/wiki/FAQ)
- [Proxmox community forum](https://forum.proxmox.com/)
- [Proxmox Bugzilla](https://bugzilla.proxmox.com/)
