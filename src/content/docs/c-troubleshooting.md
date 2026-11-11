---
title: Appendix C – Troubleshooting
---

This appendix collects the problems encountered while building the lab, one by one, with the symptom, the cause and the solution. When the lab could not prove a cause, the row gives it as a hypothesis, as the lab does; a few rows describe a risk that a lab prevented rather than a failure it observed, and say so. Each entry points to the lab in which the problem appeared, where you will find the complete commands and output.

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
| Windows Update cannot be used on the lab DC, which is therefore not updated | The lab proxy lets through only a short list of sites, while Windows Update uses many Microsoft services | In production: update the server before putting it into service, allowing the Windows Update addresses in the proxy or using WSUS | [02](/02-domain-controller/) |
| On the first boot of a UEFI VM, the "Press any key to boot from CD or DVD" prompt expires unanswered and OVMF finds nothing to boot (`No bootable option or device was found`) | On the first boot OVMF initializes the new EFI disk and is slower than usual: the prompt comes and goes if nobody is watching the console | Press a key to open the OVMF **Boot Manager**, choose the drive with the Windows ISO and press a key right away; from the second boot on, OVMF is much faster | [39](/39-windows-vm-virtio/) |
| `pve8to9` reports `FAIL: systemd-boot meta-package installed` | As the check says, the meta-package will cause problems on upgrades of other boot-related packages | Check the bootloader (`proxmox-boot-tool status`), then `apt remove systemd-boot`: with GRUB, as in the test, the node keeps booting with GRUB; with ZFS on UEFI (systemd-boot), keep `systemd-boot-efi` and `systemd-boot-tools` if the script says so | [A](/a-upgrade-8-to-9/) |

### Network

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| iSCSI session on the second path dropping every 10 s, VM stalled for up to 85 s | Consistent with **ARP flux**: two network cards of the same node on the same Ethernet segment (same switch and VLAN, here with different subnets), with Linux answering ARP from the wrong one; `ip neigh` on the NAS shows which MAC address it uses | `arp_ignore=1` and `arp_announce=2` in `/etc/sysctl.d/`; better still, separate networks on VLANs | [15](/15-iscsi-lvm-multipath/) |
| NAT or SNAT rules duplicated after network reloads | `ifreload -a` reruns every `post-up` command, even with the file unchanged: seen with hand-written rules in lab 24. For the SDN SNAT rules of lab 34 the same mechanism is a hypothesis: count the copies before and after an `ifreload -a` | Make hand-written rules idempotent: `iptables -C … \|\| iptables -A …`. The SDN duplicates were left in place: a node reboot clears them | [24](/24-routing-nat/), [34](/34-network-performance-troubleshooting/) |
| Corosync configuration changed, but the link stays the old one | Reloading the configuration is not enough to move a link | Restart Corosync **one node at a time**, checking the quorum between one node and the next | [22](/22-dedicated-networks/) |
| 802.3ad bond without LACP on the switch: the Linux bond works on one link at a time (one aggregator per card, `Number of ports: 1`); the OVS bond disables both members and the guests lose the network | No LACP partner: the lab switch does not negotiate the aggregation | Configure LACP on the switch; if you do not control it, use active-backup. With OVS, `lacp-fallback-ab` keeps the bond up but hides the problem: check that `lacp_status` reads `negotiated` | [21](/21-bonding/), [23](/23-open-vswitch/) |
| In a VXLAN VNet, large pings from a guest at MTU 1500 are lost (in a CT: `No buffer space available`), while TCP works | VXLAN encapsulation adds 50 bytes, so the guest needs MTU 1450. TCP works only because the host answers with an ICMP *fragmentation needed*: with ICMP blocked, or with UDP, connections can hang | MTU 1450 in the VNet and in the guest; in Debian 13 CTs also write it in the CT network file, because ifupdown2 resets it to 1500 | [29](/29-sdn-vxlan/), [34](/34-network-performance-troubleshooting/) |
| Risk, not observed in the lab: with QinQ a 1500-byte IP packet becomes a 1522-byte frame (without FCS), which a switch that drops frames over 1518 bytes would discard without any error | Each tag adds 4 bytes, 8 with the double tag | Before using QinQ, check the MTU of the whole path with `ping -M do`, or set the zone MTU to 1496 | [28](/28-sdn-vlan-qinq/) |
| Two guests in the same Simple VNet cannot see each other | The **Simple** zone is local to each node | Guests on the same node, or VLAN/VXLAN/EVPN zones | [27](/27-sdn-simple/) |
| After the primary EVPN exit node fails, a ping that was already running gets no replies until the link is restored (2 tests out of 4), while a new ping works | Observed on the backup exit node: the flow's conntrack entry had no address translation (`[UNREPLIED]`, reply half addressed to the guest). Why is a hypothesis: the first packets may have reached that node while its own default route still pointed to the primary, missing the SNAT rule (`-o vmbr0`) | Check with `conntrack -E` and `ip -ts monitor route` on the backup node; deleting the entry (`conntrack -D`) shows whether it is the cause. If open flows must survive, plan an exit without SNAT, with the subnets advertised via BGP to the upstream routers (not tested here) | [30](/30-sdn-evpn/) |
| Fabric reconvergence takes 26 s when a link goes down on one side only | With the default timers, the neighbor only notices when the hellos expire | Hello at 1 s: reconvergence in about 6 s | [31](/31-sdn-fabrics/) |
| IPv6 guests do not receive router advertisements (RA): not observed in the lab, where the RAs arrived | Possible cause, to check first: the switch drops RAs from unauthorized ports (*RA Guard*) | Authorize the router port on the switch | [25](/25-ipv6/) |
| The Windows DC registers automatic IPv6 addresses in DNS | Windows accepts RAs and configures itself via SLAAC | Static IPv6 on the DC network cards and RAs disabled | [25](/25-ipv6/) |
| `accept_ra=0` is set, but the network cards present at boot still accept RAs | The `all` and `default` keys do not apply to interfaces that already exist at boot | Use the wildcard: `net.ipv6.conf.*.accept_ra = 0` in `/etc/sysctl.d/` | [25](/25-ipv6/) |
| Routing through the CHR router: 1.07 Mbit/s (iperf3, one TCP flow, receiver side), against 5,367 Mbit/s within the VLAN | Consistent with the 1 Mbit/s per interface of the free license (level `free`), but not separated from the router's other limits (1 vCPU, 512 MiB of RAM) | Check with a trial license (P1 or higher) and `/system resource print`; in production, an appropriate license | [26](/26-virtual-router/) |
| An `.img` image does not show up in the import storage | The import storage only lists the extensions it recognizes | Rename the file to `.raw` | [26](/26-virtual-router/) |
| Jumbo frames: 9000-byte packets between the nodes all lost, with no error, while 8938-byte packets get through | Something on the path drops the larger frames: consistent with the switch's maximum frame size, not located by the test | MTU 1500, as in the lab, or a common MTU that the whole path carries (here at most 8938), checked with `ping -M do` | [21](/21-bonding/) |
| Multiqueue with 4 queues: aggregate bandwidth with 4 streams about 20% lower (from 11.8-12.7 to 9.7-9.8 Gbit/s), no difference established with one stream | Consistent with CPU contention (two VMs with 8 vCPUs on a 4-core node), not proven: CPU usage was not measured | Keep it off unless a before-and-after test shows a gain | [34](/34-network-performance-troubleshooting/) |

### Firewall

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| Risk, prevented in the lab: turning on the Datacenter firewall also turns on the nodes' firewall, and the services on other networks (Ceph, the second Corosync link, BGP and VXLAN, migration, SDN DHCP and DNS) would be blocked | Input policy `DROP`; the automatic rules cover only the management network and Corosync | First create a security group with all the cluster services, then enable one node at a time with an automatic rollback ready | [32](/32-firewall-1/), [33](/33-firewall-2/) |
| With the VNet firewall enabled (`DROP` policy), the guests no longer get an IP address from DHCP or resolve names | The VNet's policy also applies to traffic between the guests and the node, in both directions: the log shows the DNS query and the DHCP reply dropped | Allow DNS to `+sdn/<vnet>-gateway` and DHCP in both directions (`dport 67`; `sport 67` → `dport 68`) | [33](/33-firewall-2/) |
| The VNet firewall does not block outbound traffic | It filters the traffic between guests and to the node, not the traffic routed out of the VNet | Filter it with the guests' outbound rules or with the host's rules | [33](/33-firewall-2/) |
| With nftables, SNAT traffic from a Simple zone to a CT with its firewall enabled on the **same** node is dropped, with no trace in the firewall log; repeated later with the same configuration, it worked | Conntrack drops the packet (`insert_failed`, `drop`). Likely cause, not proven: without the `fwbr` bridges, the SDN rule that tracks this traffic in a separate zone never applies | Intermittent, delicate case: look at `conntrack -S` first; from another node, or without SNAT, the service was reachable | [33](/33-firewall-2/) |
| Gotify notifications to an internal address rejected with `CONNECT proxy failed: 403` | The Gotify target uses the Datacenter proxy even for internal IPs (documented; in the source code the Webhook target uses the same setting, not tested) | Allow the internal destinations on the proxy; the proxy log shows the refused request | [51](/51-notifications-metrics-logs/) |

### Storage

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| Writes blocked for 60 s, then I/O errors and data lost in a container | **Full LVM thin pool**: overprovisioning exceeded the real space | Monitor `Data%` and `Meta%`; recover with `lvextend` + `pct fstrim`; enable automatic extension with an LVM profile | [09](/09-lvm-and-lvm-thin/) |
| Risk, prevented in the lab: a Directory storage whose mount point (here a ZFS dataset) is not mounted would write into the empty folder underneath, on the system file system | Without `is_mountpoint`, PVE uses the folder as it is | Set `is_mountpoint`: with the path not mounted the storage turns `inactive` (`directory is expected to be a mount point but is not mounted`) | [08](/08-storage-model/) |
| NFS service stopped on the NAS: processes in `D` state on the node, VM disk I/O frozen, `nfs: server … not responding` | The NFS mount is `hard`: requests are retried until the server answers | Expected: after the restart the VM was still running and no `D` processes remained; check the guest for I/O errors (`journalctl -k`). Plan the availability of the NAS and of the network to it | [13](/13-nfs/) |
| SMB service stopped on the NAS: writes fail with `Host is down` after about 10 s, storage `inactive` | Proxmox VE always mounts CIFS storages `soft`: operations fail instead of waiting, unlike NFS mounted `hard` (lab 13). Which CIFS client timeouts produce the 10 s was not investigated | Expected: repeat the failed operation; the client reconnects on its own when the service returns. Keep SMB for ISOs, templates and backups, not for VM disks, where the error would be an I/O error in the guest | [14](/14-smb-cifs/) |
| `dd` of zeros in a VM: 2.7 GB/s on NFS, faster than the 762 MB/s on local storage | Consistent with the zeros never reaching the NAS as data (QEMU's `detect_zeroes`, ZFS compression); the test does not tell which mechanism | Do not measure with zeros: use random data or `fio`. To check, compare the bytes sent by `vmbr0` before and after the `dd` | [13](/13-nfs/) |
| NFS/SMB free space dropped from about 95 to 56 GiB after creating a 40 GiB iSCSI zvol | The zvol is thick: it reserves its whole size at once (`zfs get volsize,refreservation` shows it) | Take the reservation out of the pool's free space when you size the other shares | [15](/15-iscsi-lvm-multipath/) |
| I/O pause of about 15 s when an iSCSI path fails | In the test: about 10 s to detect the failure (unanswered NOP-Out, error 1022) plus a 5 s session recovery timeout, consistent with multipathd's `fast_io_fail_tmo` rather than the 15 s of `replacement_timeout` | Expected with these timers; read the values in effect (`/sys/class/iscsi_session/*/recovery_tmo`) before tuning them | [15](/15-iscsi-lvm-multipath/) |
| Rollback refused (`not most recent`) | ZFS and the volume chain only allow a rollback to the latest snapshot | Delete the more recent snapshots, or use qcow2/LVM-thin for snapshot trees | [16](/16-snapshots/) |
| `snapshot feature is not available` on thick LVM, even after enabling the volume chain | Thick LVM has no usable snapshots; the volume chain (technology preview in PVE 9) applies only to disks created from then on, in qcow2 format | Enable **Allow Snapshots as Volume-Chain**, then create the disk or move it with `qm disk move … --format qcow2`; each snapshot takes an LV as large as the disk | [16](/16-snapshots/) |
| After a VM restart the `sdX` names of the SCSI and SATA disks swapped: a test on `/dev/sdX` can hit the wrong disk without any error | The disks can be detected in a different order from one boot to the next | In tests and in `/etc/fstab` use `/dev/disk/by-id/…` (`drive-scsiN` for SCSI disks) | [37](/37-virtual-disks-controllers/) |
| The VM does not start with `aio=native` and `writeback` cache | Combination not supported by QEMU | Use `io_uring` or the default cache | [37](/37-virtual-disks-controllers/) |
| The same benchmark varies from one run to the next (up to ±50% between two runs in lab 19; 8,247-14,864 IOPS on the same disk in lab 37) | Possible causes, not separated by the tests: activity elsewhere in the lab (Ceph, NAS, network), ZFS's periodic flushes, write caches in the disk or controller | Count a difference between configurations only if it is larger than the spread between runs of the same configuration; more and longer runs | [19](/19-fio-benchmark/), [37](/37-virtual-disks-controllers/) |

### Ceph

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| `HEALTH_WARN BLUESTORE_SLOW_OP_ALERT` that persists for hours | With slow disks under load, operations are slow; by default the warning stays visible for 24 hours after the last occurrence | Investigate the disks; to clear it sooner, `ceph config set osd bluestore_slow_ops_warn_lifetime 600` (10 minutes) | [18](/18-ceph-growth-maintenance-failures/) |
| `OSD bench result … not within the threshold` warnings when the OSDs start | At startup the OSD benchmarks the disk and gets IOPS outside the expected threshold | Ceph uses the default value; measure the disks with `fio` and set `osd_mclock_max_capacity_iops_*` | [18](/18-ceph-growth-maintenance-failures/) |
| Risk, prevented in the lab with `noout`: needless rebuilding of copies when a planned reboot lasts more than 600 s | After `mon_osd_down_out_interval` (600 s) the monitors mark the *down* OSDs `out`, and Ceph rebuilds their copies elsewhere | `ceph osd set noout` before the maintenance, `unset` after it | [18](/18-ceph-growth-maintenance-failures/) |
| VM I/O stalled for about 27 s when a node fails abruptly | In the test, the stalled write resumed when the monitors marked the node's OSDs *down*, which happens after the heartbeat grace period (20 s) and the failure reports | Expected; compare it with the timeouts of the guests. Recovery starts after 600 s if the node does not come back | [18](/18-ceph-growth-maintenance-failures/) |

### Cluster and high availability

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| `/etc/pve` read-only on a node (`Permission denied`) | The node has lost quorum (in the test, Corosync stopped on that node) | Restore Corosync communication: once the node rejoins, `/etc/pve` is writable again | [06](/06-cluster-corosync/) |
| After a failure the replicated VM must be recovered manually | ZFS replication is not HA | Only if the failed node is certainly off: move the VM configuration to the node holding the replica; the data written after the snapshot of the last successful run is lost. If you need the writes left on the failed node, disable the job before powering it back on | [11](/11-zfs-replication/) |
| Creating an HA group is rejected | In PVE 9, groups have been replaced by HA rules | Use **node affinity rules** | [49](/49-high-availability/) |
| A resource affinity rule is rejected | The resource is already in a node affinity rule with multiple priorities | Simplify the node affinity or do without the resource affinity | [49](/49-high-availability/) |
| Maintenance mode cannot evacuate a node | A *Keep Separate* rule on 3 VMs with 3 nodes leaves no room | Reduce the rule or add nodes | [49](/49-high-availability/) |
| After a node failure, containers not under HA stay off | Only HA resources are restarted elsewhere | Put under HA whatever must restart on its own | [49](/49-high-availability/) |
| After the abrupt power-off of a node, the HA VM answered again only after 190 s (about three minutes of interruption for a client) | Recovery waits until the lost node is *fenced*: confirmed after 128 s in the CRM log, consistent with the ~2 minutes in the documentation. The other 62 s are compatible with the VM's start and boot, not broken down | Expected: it is the guarantee against running the same guest twice. A service that cannot tolerate minutes of interruption also needs redundancy in the application | [49](/49-high-availability/) |
| Bulk migration moves more guests than expected | The *Bulk Migrate* window preselects **all** guests | Check the selection before confirming | [48](/48-migrations/) |
| `qm remote-migrate` (or a PDM migration) to an external node fails with `no matching import/export format` | In the test: the cloud-init disk, which is not copied live, was offered only in the `zfs` format, and the LVM-thin target cannot import it | Check `export_formats` in the log and pick a target storage with a format in common | [48](/48-migrations/), [53](/53-datacenter-manager/) |
| `qm remote-migrate` fails with `storage 'cephfs' does not exist` | The configuration references a `cicustom` snippet on a storage that does not exist on the target | If the snippet was needed only at the first boot, remove the reference (`qm set <vmid> --delete cicustom`); otherwise make storage and snippet available on the target | [48](/48-migrations/) |
| After a migration from PDM, the source keeps the `migrate` lock | Migration without *Delete Source* | Remove the source or the lock after verification | [53](/53-datacenter-manager/) |

### VMs and containers

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| Hot-plugged CPUs stay offline in the guest | The guest does not bring them online by itself | A udev rule that brings them online | [42](/42-hotplug-resize-limits/) |
| The hot-plugged network card is `DOWN` | No configuration in the guest for the new network card | Configure the interface in the guest | [42](/42-hotplug-resize-limits/) |
| Manual ballooning "does not stick" | `pvestatd` sets the balloon back to the maximum when the node is not under load | Set the minimum and let the automatic mechanism do its work | [36](/36-memory/) |
| A new VM with the ID of a deleted VM silently inherits its backup job | The old VM was removed without *purge*, and the job still lists its VMID | Delete with *purge* (**Purge from job configurations**, `qm destroy <vmid> --purge 1`) | [38](/38-linux-vm-guest-agent/) |
| Windows setup does not find the VirtIO drivers from the root of the CD | The search does not descend into subfolders | Point it to the exact folder (e.g. `vioscsi\2k25\amd64`) | [39](/39-windows-vm-virtio/) |
| cloud-init ends with `degraded done` | Deprecation warning in the generated user-data | Harmless | [40](/40-templates-cloud-init-clones/) |
| Full clone to another node refused: `can't clone to non-shared storage 'local-zfs'` | Cloning to another node requires a shared target storage | Use a shared target storage, or clone on the same node | [40](/40-templates-cloud-init-clones/) |
| Inside an unprivileged CT, the files of a bind mount belong to `nobody` and the CT's `root` cannot write | UID mapping between host and container: the node's `root` (UID 0) is not mapped | Give the folder to the CT's `root` on the node (`chown -R 100000:100000`), or map the required UIDs (`lxc.idmap`, `/etc/subuid`) | [41](/41-lxc-containers/) |
| Mounting NFS from an unprivileged CT: `Operation not permitted` | Mounting network file systems requires privileges | Mount on the host and use a bind mount, or use a privileged CT | [41](/41-lxc-containers/) |
| Downloads of TurnKey templates or OCI images ignore the proxy | `pveam` passes only HTTP requests to the datacenter proxy (TurnKey uses HTTPS); `skopeo` does not use it | "Download from URL", or `skopeo` with `HTTPS_PROXY` | [41](/41-lxc-containers/) |
| Live migration of a container refused: `lxc live migration is currently not implemented` | Not implemented for CTs | Restart migration (`--restart`): in the lab, with the disk on shared storage, a 10 s task and about 3.4 s without ping replies | [41](/41-lxc-containers/) |

### Backup

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| A restored VM starts without network: a file written shortly before the backup is empty | Backup without the guest agent: no *fsfreeze*, the file system was not consistent | Install and enable the QEMU Guest Agent | [47](/47-proxmox-backup-server/) |
| The job deleted more backups than expected: the three taken earlier the same day | `keep-daily` keeps only one backup per day, the most recent | Simulate the retention first with `--dry-run` (`keep-last` counts backups regardless of the day); protect the backups that must survive | [46](/46-vzdump-backup/) |
| Live-restore not available | It requires Proxmox Backup Server | Use a PBS storage | [46](/46-vzdump-backup/) |
| Encrypted restore: `missing key` | The encryption key is not available | Without the key the backup cannot be recovered: keep the key outside the cluster | [47](/47-proxmox-backup-server/) |
| PBS GC does not free space immediately | Chunks are removed only after 24 hours | Expected | [47](/47-proxmox-backup-server/) |
| Backup and fencing notifications do not arrive | In the lab: messages deferred in the Postfix queue, the connection to port 25 of the domain's own address timed out; consistent with a domain without an MX record | Check `postqueue -p` and the reason for the deferral; set a `relayhost` or an SMTP target | [51](/51-notifications-metrics-logs/) |

### Importing from VMware ESXi

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| Imported Windows VM loses its static IP, twice | Each time Windows sees a new adapter: after the import (same e1000e model and MAC, new PCI location: `Connection #2`), then with VirtIO | Write down the IP address and set it again after each change, from the console or with `qm guest exec` once the agent responds | [50](/50-import-from-esxi/) |
| VMware Tools cannot be uninstalled after the import (error 1603) | The uninstaller requires the VMware environment | Uninstall them **on the source**, before the import; after the import, stop and disable their services (`VMTools`, `VGAuthService`) and plan a cleanup | [50](/50-import-from-esxi/) |
| Risk, avoided in the lab: the imported Linux VM would start without network | The network card changes name (here `ens18`, from the virtual PCI slot): a configuration with the exact name, or matching a MAC address that changes (Unique MAC addresses), no longer applies | Before the import, match the cards by name with a wildcard (`e*`, as in the lab), or keep the source MAC; otherwise fix `/etc/netplan/` from the console and run `netplan apply` | [50](/50-import-from-esxi/) |

### Authentication and permissions

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| LDAPS realm: `certificate verify failed` | The domain CA is not installed on the node | Install the CA on all nodes | [43](/43-active-directory-realm-ldaps/) |
| The bind service account shows up among the synced users | The user filter is too broad | Filter by group (`memberOf`) | [43](/43-active-directory-realm-ldaps/) |
| Orphaned permissions that cannot be removed | An API token was deleted while ACLs were still assigned to it | Remove the ACLs first, then the token; if it has already happened, recreate the token and clean up | [44](/44-users-groups-roles-pools-tokens/) |
| Cannot connect a VM network card to a VLAN of the bridge: `Permission check failed (/sdn/zones/localnetwork/vmbr1/10, SDN.Use)` | The `SDN.Use` permission on the bridge and its VLAN is missing | Assign `PVESDNUser` on the bridge (`/sdn/zones/localnetwork/<bridge>`) with propagation, so that it covers all its VLANs | [44](/44-users-groups-roles-pools-tokens/) |
| WebAuthn works on one node and returns 401 on the others | The WebAuthn origin is tied to the name of a single node | A domain origin and `allow-subdomains=1` | [45](/45-two-factor-authentication/) |
| After 8 wrong TOTP codes, even the right one is rejected (`totp-locked: 1`) | The user's TOTP is locked, a protection against brute-force attempts | Unlock by an administrator (**Unlock TFA** in the GUI or `pveum user tfa unlock <user>`), or log in with a recovery key, which also unlocks TOTP | [45](/45-two-factor-authentication/) |
| Realm-enforced TFA: a 32-character base32 key accepted by `pveum` is discarded at login (`bad otp response` in the log) | In the test only a 16-character base32 key, or a 40-character hexadecimal one, worked | Use one of those formats; after clearing the field, remove the leftover `<old userconfig key 0>` entry from the factors | [45](/45-two-factor-authentication/) |

### API and automation

| Symptom | Cause | Solution | Lab |
|---|---|---|---|
| `401` on a POST request with the ticket | The `CSRFPreventionToken` header is missing | Send the CSRF token obtained with the ticket, or use an API token | [52](/52-api-automation/) |
| `403` from an API token | With *privilege separation* the token only has its own permissions, intersected with the user's | Assign the permissions both to the token and to the user, as indicated by *Required permissions* | [44](/44-users-groups-roles-pools-tokens/), [52](/52-api-automation/) |
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
