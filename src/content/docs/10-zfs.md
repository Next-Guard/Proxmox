---
title: "Lab 10 – ZFS: pools, redundancy, compression, snapshots and failures"
level: intermediate
duration: 2 hours
---

## Dependencies

- **Previous labs:** [Lab 09](/09-lvm-and-lvm-thin/). On `desopve04` the four 20 GB disks (`sdb`, `sdc`, `sdd`, `sde`) are empty.
- **Nodes:** `desopve04` as the test bed and `desopve01` (installed on ZFS, lab 03) for sending snapshots to a remote node.
- **Template:** `debian-13-standard_13.6-1_amd64.tar.zst` in the `local` storage of `desopve04` (lab 09).
- **Addresses:** `172.27.199.141` for the test container.
- **Hardware for the failure tests:** the disks of `desopve04` sit in hot-swap bays and can be pulled while the node is running. Have a fifth, new 20 GB disk ready to insert in Test 2 as a spare disk (see the [lab hardware](/01-lab-architecture/#lab-hardware)).
- **Credentials:** `root` / `<lab-password>` → [Appendix B](/b-credentials-and-addresses/).

## Objectives

- A `tank` pool on `desopve04`, created first as a mirror from the web interface and then rebuilt from the command line as a three-disk RAIDZ1 on stable `by-path` names, and registered as the `tank` storage: `zpool status` shows it ONLINE and `pvesm status` shows the storage active.
- A deliberately corrupted mirror disk repaired by a scrub, with the test file's checksum unchanged and the pool reported healthy.
- The raw space, usable space and compression ratio of the RAIDZ1 read with `zpool list` and `zfs list`, for three datasets with different compression settings.
- A dataset restored with a rollback and copied with `zfs send`/`receive`, in full and incrementally, within the pool and to `desopve01`, with the received data checked.
- The ARC of `desopve04` capped at 2 GiB, both on the fly and in `/etc/modprobe.d/zfs.conf`.
- A disk pulled from the running RAIDZ1: the DEGRADED pool keeps serving the container and returns ONLINE after `zpool replace`; a spare disk is then added to the pool.

## How it works

### Pools, vdevs and datasets

ZFS does the job of a RAID, a volume manager and a file system all at once:

```text
 pool (zpool)           tank
                         │
 vdev               raidz1-0  (or mirror-0, or a single disk)
                    ┌────┼────┐
 disks            sdb   sdc   sdd

 dataset and zvol   tank/dati            file system, mounted at /tank/dati
                    tank/vm-990-disk-0   zvol: a block device, /dev/zvol/tank/vm-990-disk-0
```

- A **pool** is made of one or more **vdevs**. Redundancy lives *inside* each vdev: if you lose an entire vdev, you lose the pool.
- A vdev can be a single disk, a **mirror** (2 or more identical copies), a **RAIDZ1/2/3** (distributed parity, survives the loss of 1, 2 or 3 disks) or a **dRAID**. There are also special vdevs (`log`, `cache`, `special`) and spare disks (`spare`).
- In the pool you create **datasets** (file systems) and **zvols** (block devices). Properties, such as compression, are inherited from the parent and can be changed for each one.

In Proxmox VE a `zfspool` storage puts VM disks in **zvols** and container disks in **datasets** (`subvol`), with a quota equal to the disk size.

### Why ZFS does not lose data silently

- **Copy-on-write:** ZFS never overwrites a block; it writes a new one and then updates the pointers. An interrupted write does not leave the file system half-updated, and snapshots are instant and take up no space when they are created.
- **A checksum for every block**, stored in the parent block: ZFS notices when a disk returns wrong data, even without I/O errors.
- **Self-healing:** if the vdev is redundant, ZFS reads the good copy and rewrites the damaged one. A **scrub** rereads the entire pool to find and fix latent errors.

### Mirror or RAIDZ?

| | Mirror (2 disks) | RAIDZ1 (3 disks) | RAIDZ2 (4+ disks) |
|---|---|---|---|
| Usable space | 50% | about 66% | about 50% with 4 disks, more with many disks |
| Disks that can fail without data loss | 1 per mirror | 1 | 2 |
| Random performance (IOPS) | writes: about one disk per mirror; reads: more, growing with the disks in the mirror. Both grow with the number of mirrors | roughly that of one disk per vdev | roughly that of one disk per vdev |
| Rebuild (resilver) | copy from a single disk | recomputed from parity across all disks | recomputed from parity |

The Proxmox VE documentation points out that for running VMs IOPS are usually the metric that matters most, and that a RAIDZ vdev delivers roughly the IOPS of a single disk. For VM disks this points to **mirrors** or striped mirrors (RAID10); RAIDZ is a better fit for backups and archives, where capacity matters more. On RAIDZ, small blocks also take more space than the nominal parity ratio suggests, because each one needs at least one parity sector: step 5 shows the effect.

:::note
ZFS must see the disks directly: no hardware RAID controller underneath, at most an HBA in IT/passthrough mode.
:::

### ARC

The **ARC** is the ZFS read cache in RAM. The larger it is, the more reads it can serve without touching the disks, but the RAM it holds is not available to the VMs until ZFS gives it back. Since version 8.1 the Proxmox VE installer caps the ARC at **10% of the RAM**, with a maximum of 16 GiB, and writes the limit to `/etc/modprobe.d/zfs.conf`.

### Test environment and versions

The outputs in this lab come from a run on 9 November 2026, the date shown in the logs, with the configuration below. The space, compression and timing figures depend on it: with other versions, disks or data they change.

| Component | Configuration used |
|---|---|
| Proxmox VE | 9.2.26, kernel `7.0.14-28-pve` ([Lab 04](/04-first-access-repositories-updates/)) |
| ZFS | the version shipped for that kernel. It was not recorded on `desopve04` during the test: `zfs version` shows it. For reference, [Appendix A](/a-upgrade-8-to-9/) shows `zfsutils-linux 2.4.4-pve1` on a test node running the same kernel |
| Test node | `desopve04`: 4 cores, 16 GB of RAM (15.6 GiB according to `arc_summary`), system on ext4/LVM on a 50 GB disk, four 20 GB disks in hot-swap bays on the same controller (`pci-0000:02:00.0`), plus a fifth 20 GB disk for Test 2 ([Lab 01](/01-lab-architecture/#lab-hardware)) |
| `tank` | first a two-disk mirror (`compression=on`, i.e. LZ4, `ashift=12`), then a three-disk RAIDZ1 with `ashift=12`, `compression=lz4` and `atime=off`; `zfspool` storage with `sparse 1` |
| ARC on `desopve04` | 1.6 GiB maximum set by the installer, raised to 2 GiB in step 9 |
| Remote node | `desopve01`, system pool `rpool`: a ZFS mirror on two 50 GB disks ([Lab 03](/03-install-proxmox-ve/)) |
| Test data | 1,500 MiB of random data for the scrub; a copy of the node's `/usr/share/doc` and `/usr/lib/python3` (112 MiB of logical data) for compression, snapshots and send/receive |

Disk and controller models are redacted, as explained in the [manual's conventions](/the-lab/#conventions).

**What the tests show, and what they do not.** They show how ZFS behaves on a small, nearly empty pool on a single node: detecting and repairing damage, accounting for space, recovering from a failed disk. The times (a 5-second scrub, a 12-second resilver) and the space figures hold for these amounts of data, from about a hundred megabytes to 1.5 GB, and for this disk layout. They are not performance measurements: they do not tell you how long a scrub or a resilver takes on large, full disks or under load, nor what compression costs in CPU.

## Procedure

### 1. The system pool of `desopve01`

The installation in lab 03 created `rpool`, a mirror on partition 3 of the two 50 GB disks:

```bash title="root@desopve01"
zpool status rpool
```

```text output
  pool: rpool
 state: ONLINE
config:

	NAME                                   STATE     READ WRITE CKSUM
	rpool                                  ONLINE       0     0     0
	  mirror-0                             ONLINE       0     0     0
	    scsi-<seriale-disco-sda>-part3     ONLINE       0     0     0
	    scsi-<seriale-disco-sdb>-part3     ONLINE       0     0     0

errors: No known data errors
```

```bash title="root@desopve01"
zpool list
```

```text output
NAME    SIZE  ALLOC   FREE  CKPOINT  EXPANDSZ   FRAG    CAP  DEDUP    HEALTH  ALTROOT
rpool    49G  5.44G  43.6G        -         -     3%    11%  1.00x    ONLINE  -
```

The installer uses the names in `/dev/disk/by-id`, which contain the model and serial number of the disk and do not change if the `sda`, `sdb`… order changes. In the manual the serial numbers are replaced by placeholders, because they depend on the hardware.

### 2. Create a mirror from the web interface

1. On `desopve04` open **Disks** → **ZFS** → **Create: ZFS**.
2. **Name** `tank`, **RAID Level** `Mirror`, **Compression** `on` (i.e. LZ4), **ashift** `12` (4 KiB sectors), **Add Storage** enabled. Select `/dev/sdb` and `/dev/sdc`.

   ![Creating the mirror pool](../../assets/images/10/01-create-zfs.png)

3. Click **Create**. The pool appears in the list; **Detail** shows the state of the disks, like `zpool status`.

   ![Status of the tank pool](../../assets/images/10/02-zfs-detail.png)

4. From the command line:

   ```bash title="root@desopve04"
   zpool status tank
   ```

   ```text output
     pool: tank
    state: ONLINE
   config:

   	NAME                           STATE     READ WRITE CKSUM
   	tank                           ONLINE       0     0     0
   	  mirror-0                     ONLINE       0     0     0
   	    scsi-<seriale-disco-sdb>   ONLINE       0     0     0
   	    scsi-<seriale-disco-sdc>   ONLINE       0     0     0

   errors: No known data errors
   ```

   ```bash title="root@desopve04"
   grep -A4 "zfspool: tank" /etc/pve/storage.cfg
   ```

   ```text output
   zfspool: tank
   	pool tank
   	content rootdir,images
   	mountpoint /tank
   	nodes desopve04
   ```

### 3. Self-healing: corrupt a mirror disk

This step **deliberately destroys** part of the data on a disk. Only do it on a test pool.

1. Create a dataset, write 1.5 GB of random data and note the file's checksum:

   ```bash title="root@desopve04"
   zfs create tank/dati
   dd if=/dev/urandom of=/tank/dati/archivio.bin bs=1M count=1500 status=none
   md5sum /tank/dati/archivio.bin
   ```

   ```text output
   15bd171a50378dae9c3153c9c48bdb00  /tank/dati/archivio.bin
   ```

2. Overwrite 3 GB of the data partition of `sdc` with zeros, starting at 64 MiB so as not to touch the ZFS labels at the beginning of the disk:

   ```bash title="root@desopve04"
   dd if=/dev/zero of=/dev/sdc1 bs=1M seek=64 count=3000 oflag=direct status=none
   ```

3. Start a scrub and wait for it to finish (`-w`):

   ```bash title="root@desopve04"
   zpool scrub -w tank
   zpool status tank
   ```

   ```text output
     pool: tank
    state: ONLINE
   status: One or more devices has experienced an unrecoverable error.  An
   	attempt was made to correct the error.  Applications are unaffected.
   action: Determine if the device needs to be replaced, and clear the errors
   	using 'zpool clear' or replace the device with 'zpool replace'.
      see: https://openzfs.github.io/openzfs-docs/msg/ZFS-8000-9P
     scan: scrub repaired 962M in 00:00:05 with 0 errors on Mon Nov  9 14:06:41 2026
   config:

   	NAME                           STATE     READ WRITE CKSUM
   	tank                           ONLINE       0     0     0
   	  mirror-0                     ONLINE       0     0     0
   	    scsi-<seriale-disco-sdb>   ONLINE       0     0     0
   	    scsi-<seriale-disco-sdc>   ONLINE       0     0 7.57K

   errors: No known data errors
   ```

   - **Measured:** the scrub ends with `repaired 962M in 00:00:05 with 0 errors`. On the second disk the `CKSUM` counter reads 7.57K, while `READ` and `WRITE` stay at 0.
   - **Interpretation:** the disk returned zeros in place of the data without reporting any I/O error, and only the block checksums gave it away; ZFS rewrote the damaged blocks from the good copy on the first disk. The 962 MiB repaired are less than the 3,000 MiB overwritten: this is consistent with a scrub that reads only allocated blocks, so the zeros written over free space go unnoticed and do no harm.
   - **How to check:** `zpool list tank` before the test shows how much space is allocated; `zpool events -v` lists the checksum error events, with the device and the offsets involved.

4. The file is intact. Reset the counters:

   ```bash title="root@desopve04"
   md5sum /tank/dati/archivio.bin
   ```

   ```text output
   15bd171a50378dae9c3153c9c48bdb00  /tank/dati/archivio.bin
   ```

   ```bash title="root@desopve04"
   zpool clear tank
   zpool status -x tank
   ```

   ```text output
   pool 'tank' is healthy
   ```

   In production, keep an eye on a disk with checksum errors, and replace it if the errors come back. The `zfsutils-linux` package schedules a monthly scrub of all pools (`/etc/cron.d/zfsutils-linux`), and `zfs-zed` can report problems by email to `root`: whether that mail actually arrives depends on the node's mail setup, which [Lab 51](/51-notifications-metrics-logs/) covers.

### 4. Create a RAIDZ1 from the command line

Now rebuild `tank` as a RAIDZ1 on three disks. First remove the storage and the mirror pool:

```bash title="root@desopve04"
pvesm remove tank
zpool destroy tank
```

To specify the disks, instead of `sdb`… (which can change at every boot) use `/dev/disk/by-path`, which identifies the controller port. It is a stable alternative to `by-id`, handy when you want to know which slot a disk is in:

```bash title="root@desopve04"
ls -l /dev/disk/by-path/ | grep -v part | awk '{print $9, $11}' | grep scsi
```

```text output
pci-0000:02:00.0-scsi-0:0:0:0 ../../sda
pci-0000:02:00.0-scsi-0:0:1:0 ../../sdb
pci-0000:02:00.0-scsi-0:0:2:0 ../../sdc
pci-0000:02:00.0-scsi-0:0:3:0 ../../sdd
pci-0000:02:00.0-scsi-0:0:4:0 ../../sde
```

```bash title="root@desopve04"
cd /dev/disk/by-path
zpool create -o ashift=12 -O compression=lz4 -O atime=off tank raidz1 pci-0000:02:00.0-scsi-0:0:1:0 pci-0000:02:00.0-scsi-0:0:2:0 pci-0000:02:00.0-scsi-0:0:3:0
zpool status tank
```

```text output
  pool: tank
 state: ONLINE
config:

	NAME                               STATE     READ WRITE CKSUM
	tank                               ONLINE       0     0     0
	  raidz1-0                         ONLINE       0     0     0
	    pci-0000:02:00.0-scsi-0:0:1:0  ONLINE       0     0     0
	    pci-0000:02:00.0-scsi-0:0:2:0  ONLINE       0     0     0
	    pci-0000:02:00.0-scsi-0:0:3:0  ONLINE       0     0     0

errors: No known data errors
```

```bash title="root@desopve04:/dev/disk/by-path"
zpool list tank
```

```text output
NAME   SIZE  ALLOC   FREE  CKPOINT  EXPANDSZ   FRAG    CAP  DEDUP    HEALTH  ALTROOT
tank  59.5G   856K  59.5G        -         -     0%     0%  1.00x    ONLINE  -
```

```bash title="root@desopve04:/dev/disk/by-path"
zfs list tank
```

```text output
NAME   USED  AVAIL  REFER  MOUNTPOINT
tank   512K  38.4G   128K  /tank
```

- `-o ashift=12` is a **pool** property, fixed for good at creation time; `-O` sets properties of the root **dataset**, which its children inherit.
- `atime=off` avoids a write on every file read.
- `zpool list` shows the **raw** space of the three disks, parity included: 59.5 GiB. `zfs list` shows the **usable** space, what the datasets can actually fill: 38.4 GiB. Two thirds of 59.5 GiB would be 39.7 GiB: one disk's worth goes to parity, and the remaining gap is consistent with the small share of the pool (1/32 by default, the *slop space*) that ZFS keeps in reserve and never reports as available. The module parameter that sets it is `spa_slop_shift` (`cat /sys/module/zfs/parameters/spa_slop_shift`).

Add the storage, with the `sparse` option like `local-zfs`:

```bash title="root@desopve04"
pvesm add zfspool tank --pool tank --content images,rootdir --sparse 1 --nodes desopve04
pvesm status
```

```text output
Name             Type     Status     Total (KiB)      Used (KiB) Available (KiB)        %
local             dir     active        22203544         5768732        15281584   25.98%
local-lvm     lvmthin     active        14217216               0        14217216    0.00%
tank          zfspool     active        40265280             543        40264736    0.00%
```

### 5. Compression compared

Create three datasets with different compression and copy the same files into each one (documentation and Python libraries, i.e. text and code):

```bash title="root@desopve04"
for c in off lz4 zstd; do zfs create -o compression=$c tank/comp-$c; cp -a /usr/share/doc /usr/lib/python3 /tank/comp-$c/; done
zfs list -o name,compression,used,logicalused,compressratio -r tank | grep -E "NAME|comp-"
```

```text output
NAME            COMPRESS         USED  LUSED  RATIO
tank/comp-lz4   lz4              111M   112M  1.63x
tank/comp-off   off              157M   112M  1.00x
tank/comp-zstd  zstd             103M   112M  1.83x
```

- **Measured:** on the same 112 MiB of logical data (`LUSED`), the compression ratio (`compressratio`, the `RATIO` column) is 1.83x with zstd and 1.63x with LZ4. Without compression it is 1.00x, and the space used in the pool (`USED`) is 157 MiB: **more** than the logical data.
- **Interpretation:**
  - on these files, text and code, zstd compresses more than LZ4. The test does not measure what either algorithm costs in CPU or time. `compression=on`, which on this pool means LZ4, is the default that the OpenZFS documentation describes as balancing speed and compression ratio;
  - the extra space without compression is consistent with the allocation overhead of small blocks: every block takes a whole number of 4 KiB sectors (`ashift=12`), and on RAIDZ1 it also needs at least one parity sector. With many small files, as here, this overhead shows in `USED`, and compression absorbs part of it. This is also consistent with `USED` (111 MiB) being close to `LUSED` (112 MiB) for LZ4 despite a 1.63x ratio: the ratio describes the compression alone, while `USED` also includes the allocation overhead. The test does not separate the share due to sector rounding from the share due to RAIDZ.
- **How to check:** to compare what the algorithms cost, time the same copy into each dataset (`time cp -a …`) on an otherwise idle node. To separate the two shares, copy the same files into an uncompressed dataset on a mirror with the same `ashift` and compare `used` with `logicalused`: what remains is the share due to sector rounding.

### 6. Zvols and subvols: the guests' disks

Allocate a disk for a VM (test VMID `990`) and create a container on the `tank` storage:

```bash title="root@desopve04"
pvesm alloc tank 990 vm-990-disk-0 4G
```

```text output
successfully created 'tank:vm-990-disk-0'
```

```bash title="root@desopve04"
pct create 941 local:vztmpl/debian-13-standard_13.6-1_amd64.tar.zst --hostname lab10-ct --rootfs tank:4 --memory 512 --unprivileged 1 --features nesting=1 --ostype debian --net0 name=eth0,bridge=vmbr0,ip=172.27.199.141/24,gw=172.27.199.1
pvesm list tank
```

```text output
Volid                  Format  Type            Size VMID
tank:subvol-941-disk-0 subvol  rootdir   4294967296 941
tank:vm-990-disk-0     raw     images    4294967296 990
```

```bash title="root@desopve04"
zfs list -t all -o name,type,volsize,refquota,used,mountpoint -r tank | grep -E "NAME|990|941"
```

```text output
NAME                    TYPE        VOLSIZE  REFQUOTA   USED  MOUNTPOINT
tank/subvol-941-disk-0  filesystem        -        4G   346M  /tank/subvol-941-disk-0
tank/vm-990-disk-0      volume           4G         -  74.6K  -
```

```bash title="root@desopve04"
pct start 941
pct exec 941 -- df -h /
```

```text output
Filesystem              Size  Used Avail Use% Mounted on
tank/subvol-941-disk-0  4.0G  351M  3.7G   9% /
```

- The VM disk is a 4 GiB **zvol** (`volume`), thin: it takes up 75 KiB.
- The container disk is a **dataset** (`filesystem`) with a 4 GiB `refquota`: the container sees a 4 GiB file system, and the node sees its files directly in `/tank/subvol-941-disk-0`.

### 7. Snapshots and rollback

1. Create a test dataset, take a snapshot and delete the files:

   ```bash title="root@desopve04"
   zfs create tank/snapdemo; cp -a /usr/share/doc /tank/snapdemo/
   zfs snapshot tank/snapdemo@a
   rm -rf /tank/snapdemo/doc; sync
   zfs list -t snapshot -o name,used,refer tank/snapdemo
   ```

   ```text output
   NAME              USED  REFER
   tank/snapdemo@a  64.6M  64.7M
   ```

   ```bash title="root@desopve04"
   zfs list -o space tank/snapdemo
   ```

   ```text output
   NAME           AVAIL   USED  USEDSNAP  USEDDS  USEDREFRESERV  USEDCHILD
   tank/snapdemo  37.5G  64.7M     64.6M    128K             0B         0B
   ```

   A new snapshot shares all its blocks with the dataset, so at first it takes up no space of its own. When the files are deleted, their blocks stay with the snapshot: now the dataset uses 128 KiB (`USEDDS`) and the snapshot 64.6 MiB (`USEDSNAP`). The `USED` column of a snapshot counts only the blocks that belong to **that snapshot alone**: if several snapshots share the same blocks, each one shows `0B` and the space appears only in `USEDSNAP`.

2. The files of the snapshot can be read, read-only, in the hidden `.zfs/snapshot` directory. With `zfs rollback` the dataset goes back exactly to how it was. Try it on `tank/comp-zstd`:

   ```bash title="root@desopve04"
   zfs snapshot tank/comp-zstd@prima
   rm -rf /tank/comp-zstd/doc
   ls /tank/comp-zstd
   ```

   ```text output
   python3
   ```

   ```bash title="root@desopve04"
   ls /tank/comp-zstd/.zfs/snapshot/prima/
   ```

   ```text output
   doc
   python3
   ```

   ```bash title="root@desopve04"
   zfs rollback tank/comp-zstd@prima
   ls /tank/comp-zstd
   ```

   ```text output
   doc
   python3
   ```

   ```bash title="root@desopve04"
   zfs destroy -r tank/snapdemo
   ```

   `zfs rollback` only goes back to the **most recent** snapshot: to go back to an earlier one you have to destroy the later ones (`-r`). Snapshots of VM and container disks are managed from the web interface, which relies on ZFS snapshots (lab 16).

### 8. `zfs send` and `zfs receive`

`zfs send` turns a snapshot into a data stream, `zfs receive` recreates it elsewhere. This is the foundation of Proxmox VE replication (lab 11).

1. **Full and incremental copy within the same pool:**

   ```bash title="root@desopve04"
   zfs snapshot tank/comp-zstd@s1
   zfs send tank/comp-zstd@s1 | zfs receive tank/copia
   date > /tank/comp-zstd/nuovo.txt
   zfs snapshot tank/comp-zstd@s2
   zfs send -v -i @s1 tank/comp-zstd@s2 | zfs receive tank/copia
   ```

   ```text output
   send from tank/comp-zstd@s1 to tank/comp-zstd@s2 estimated size is 49.1K
   total estimated size is 49.1K
   TIME        SENT   SNAPSHOT tank/comp-zstd@s2
   ```

   ```bash title="root@desopve04"
   zfs list -t snapshot -o name,used,refer -r tank/comp-zstd tank/copia
   ```

   ```text output
   NAME                   USED  REFER
   tank/comp-zstd@prima     0B   103M
   tank/comp-zstd@s1        0B   103M
   tank/comp-zstd@s2        0B   103M
   tank/copia@s1         95.9K   111M
   tank/copia@s2            0B   111M
   ```

   ```bash title="root@desopve04"
   cat /tank/copia/nuovo.txt
   ```

   ```text output
   Mon Nov  9 02:07:58 PM CET 2026
   ```

   The incremental send (`-i @s1`) carries only the blocks that changed between the two snapshots: `zfs send -v` estimates the stream at 49.1 KiB, while the dataset references 103 MiB. That figure is an estimate printed before the transfer, and the size of the full stream sent first was not measured: `zfs send -nvP tank/comp-zstd@s1` (a dry run) prints it without sending anything.

   `tank/copia` references 111 MiB, more than the 103 MiB of the source. This is consistent with a stream sent without `-c`: its data travel uncompressed and are compressed again on arrival, with the property `tank/copia` inherits from `tank` (LZ4, the same 111 MiB as `tank/comp-lz4`). To check: `zfs get compression,compressratio tank/copia`.

2. **To another node, over SSH.** `desopve04` is not part of the cluster, so it first needs an authorized key on `desopve01`. `ssh-copy-id` asks once for the `root` password of `desopve01`:

   ```bash title="root@desopve04"
   ssh-copy-id -o StrictHostKeyChecking=accept-new root@desopve01.proxmox.community
   ```

   ```text output
   /usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "/root/.ssh/id_rsa.pub"
   /usr/bin/ssh-copy-id: INFO: attempting to log in with the new key(s), to filter out any that are already installed
   /usr/bin/ssh-copy-id: INFO: 1 key(s) remain to be installed -- if you are prompted now it is to install the new keys

   Number of key(s) added: 1
   ...
   ```

   ```bash title="root@desopve04"
   zfs send tank/comp-zstd@s2 | ssh root@desopve01.proxmox.community zfs receive rpool/lab10-copia
   ssh root@desopve01.proxmox.community zfs list -t all -o name,used,refer -r rpool/lab10-copia
   ```

   ```text output
   NAME                   USED  REFER
   rpool/lab10-copia     93.5M  93.5M
   rpool/lab10-copia@s2     0B  93.5M
   ```

   The dataset arrives on `desopve01` along with its snapshot, and there it uses 93.5 MiB, against 111 MiB for the copy received on `tank`. The difference is consistent with the absence of RAIDZ overhead on `rpool`, which is a mirror, but the test does not rule out other differences between the two pools, such as the compression property inherited from `rpool` or its `ashift`. To check: `zfs get compression,compressratio,logicalreferenced rpool/lab10-copia` on `desopve01`, and `zpool get ashift` on both pools.

   :::note
   On the cluster nodes, `/root/.ssh/authorized_keys` is a link to the shared `/etc/pve/priv/authorized_keys` ([Lab 05](/05-ssh-shell-cli/)): the key of `desopve04` now opens **all** the nodes of the cluster. Remove it at the end of the lab (see *Cleanup*).
   :::

### 9. Size the ARC

1. The current limit is in the file created by the installer and in the module parameter:

   ```bash title="root@desopve04"
   cat /etc/modprobe.d/zfs.conf
   ```

   ```text output
   options zfs zfs_arc_max=1676673024
   ```

   ```bash title="root@desopve04"
   arc_summary -s arc | sed -n 7,12p
   ```

   ```text output
   ARC status:
           Total memory size:                                      15.6 GiB
           Min target size:                                3.1 %  499.7 MiB
           Max target size:                               10.0 %    1.6 GiB
           Target size (adaptive):                        44.1 %    1.6 GiB
           Current size:                                  44.1 %  705.3 MiB
   ```

   1,676,673,024 bytes is 1.6 GiB, 10% of the 15.6 GiB of RAM that ZFS sees on the node. On `desopve01`, with 32 GB of RAM, the same rule gives about 3.1 GiB: the exact value is in `/etc/modprobe.d/zfs.conf` on that node.

2. Raise the limit to 2 GiB on the fly by writing to the module parameter, and make it permanent in `zfs.conf`:

   ```bash title="root@desopve04"
   echo $((2*1024*1024*1024)) > /sys/module/zfs/parameters/zfs_arc_max
   sed -i "s/^options zfs zfs_arc_max=.*/options zfs zfs_arc_max=2147483648/" /etc/modprobe.d/zfs.conf
   arc_summary -s arc | sed -n 8,12p
   ```

   ```text output
           Total memory size:                                      15.6 GiB
           Min target size:                                3.1 %  499.7 MiB
           Max target size:                               12.8 %    2.0 GiB
           Target size (adaptive):                        33.2 %    1.6 GiB
           Current size:                                  33.2 %  679.9 MiB
   ```

   ```bash title="root@desopve04"
   arcstat 1 3
   ```

   ```text output
       time  read  ddread  ddh%  dmread  dmh%  pread  ph%   size      c  avail
   14:08:38     0       0     0       0     0      0    0   680M   1.6G  12.2G
   14:08:39     0       0     0       0     0      0    0   680M   1.6G  12.2G
   14:08:40     0       0     0       0     0      0    0   680M   1.6G  12.2G
   ```

   The maximum is now 2.0 GiB, but the target (`c` in `arcstat`, *Target size* in `arc_summary`) stays at 1.6 GiB and the ARC holds 680 MiB. With no reads during the sample (the `read` column is 0), this is consistent with an ARC that only grows when there is data to cache: the new limit matters under load. To see it, watch `arcstat 1` while reading more data than the ARC can hold.

   On nodes with the **system on ZFS** (like `desopve01-03`) the module is loaded from the initramfs: after changing `zfs.conf` you must run `update-initramfs -u -k all`, otherwise the old limit applies again after a reboot. `desopve04` has its system on ext4, so this is not needed. This lab does not reboot `desopve04`: after its next reboot, `cat /sys/module/zfs/parameters/zfs_arc_max` should print `2147483648`.

## Verification and tests

The lab has succeeded when every check in the table gives the expected result. The last column shows what this run observed.

| Check | Counts as success | Observed in this run |
|---|---|---|
| `tank` pool and storage | `zpool status tank` ONLINE with the three `by-path` disks; `tank` active in `pvesm status` | ONLINE; storage active |
| Scrub after corrupting a mirror disk | `scrub repaired … with 0 errors`, the file's `md5sum` unchanged, `pool 'tank' is healthy` after `zpool clear` | 962 MiB repaired in 5 seconds, `CKSUM` 7.57K on the corrupted disk, same `md5sum` |
| Space of the RAIDZ1 | the usable space in `zfs list` is about two thirds of the raw space in `zpool list`, or a little less | 38.4 GiB usable out of 59.5 GiB raw |
| Compression | `compressratio` above 1.00x on the compressed datasets | LZ4 1.63x, zstd 1.83x, off 1.00x |
| Rollback | the deleted directory is back after `zfs rollback` | `doc` back in `tank/comp-zstd` |
| `zfs send`/`receive` | the received datasets carry their snapshots, and the file written after `@s1` is in `tank/copia` | `tank/copia@s1`, `@s2` and `nuovo.txt`; `rpool/lab10-copia@s2` on `desopve01` |
| ARC | `arc_summary` shows a *Max target size* of 2.0 GiB, and `zfs.conf` holds `2147483648` | 2.0 GiB on the fly; persistence after a reboot not checked in this lab |
| Disk failure (Test 1) | the pool DEGRADED but writable, ONLINE after `zpool replace`, resilver with 0 errors | write succeeded during the failure; `resilvered 435M in 00:00:12 with 0 errors` |
| Spare disk (Test 2) | the disk listed under `spares` as `AVAIL`, `autoreplace=on` | `AVAIL`; automatic activation not tested |

### Test 1 – A RAIDZ disk fails

**Configuration tried.** `tank` is a RAIDZ1 on three disks, named by bay (`by-path`), so it can survive the loss of one of them. Container `941` is running with its disk on `tank`. The disk in bay `scsi-0:0:3:0` is pulled while the node is running.

1. **Hot-remove** the disk in bay `scsi-0:0:3:0` (`sdd`). **Behaviour observed:** the disk disappears from the system and the pool marks it `REMOVED`:

   ```bash title="root@desopve04"
   lsblk -d -o NAME,SIZE | grep sd
   ```

   ```text output
   sda    50G
   sdb    20G
   sdc    20G
   sde    20G
   ```

   ```bash title="root@desopve04"
   zpool status tank
   ```

   ```text output
     pool: tank
    state: DEGRADED
   status: One or more devices have been removed.
   	Sufficient replicas exist for the pool to continue functioning in a
   	degraded state.
   action: Online the device using zpool online' or replace the device with
   	'zpool replace'.
   config:

   	NAME                               STATE     READ WRITE CKSUM
   	tank                               DEGRADED     0     0     0
   	  raidz1-0                         DEGRADED     0     0     0
   	    pci-0000:02:00.0-scsi-0:0:1:0  ONLINE       0     0     0
   	    pci-0000:02:00.0-scsi-0:0:2:0  ONLINE       0     0     0
   	    pci-0000:02:00.0-scsi-0:0:3:0  REMOVED      0     0     0

   errors: No known data errors
   ```

   ```bash title="root@desopve04"
   journalctl -u zfs-zed --since "-15 min" --no-hostname | tail -2
   ```

   ```text output
   Nov 09 14:09:18 zed[24608]: eid=246 class=statechange pool='tank' vdev=pci-0000:02:00.0-scsi-0:0:3:0-part1 vdev_state=REMOVED
   Nov 09 14:09:19 zed[24927]: eid=247 class=removed pool='tank' vdev=pci-0000:02:00.0-scsi-0:0:3:0-part1 vdev_state=REMOVED
   ```

   `zfs-zed`, the ZFS event daemon, logged the removal at 14:09:18 and 14:09:19. The test does not record the exact moment the disk was pulled, so it does not measure how long ZFS took to notice: the kernel log (`journalctl -k`) shows when the disk left the SCSI bus. ZED can also email `root` (`ZED_EMAIL_ADDR` in `/etc/zfs/zed.d/zed.rc`), but this lab does not check the delivery: in [Lab 51](/51-notifications-metrics-logs/) the notifications of the earlier labs turn out to be stuck in the Postfix queue of the cluster nodes, and `postqueue -p` on `desopve04` shows whether this one is stuck too.

2. The pool is **DEGRADED** but still in service: inside the container a write, a `sync` and a read all succeed.

   ```bash title="root@desopve04"
   pct exec 941 -- sh -c "date > /root/durante-il-guasto.txt; sync; cat /root/durante-il-guasto.txt"
   ```

   ```text output
   Mon Nov  9 13:10:55 UTC 2026
   ```

   The container's clock is in UTC: 13:10:55 UTC is 14:10:55 on the node, about a minute and a half after ZED logged the removal. A single write is a functional check, not a performance test: it does not tell you how much slower the pool is while degraded.

   In **Disks** → **ZFS** → **Detail** the pool and the vdev are shown in yellow, with the disk `REMOVED`:

   ![The degraded pool](../../assets/images/10/03-tank-degraded.png)

3. **Decision:** the pulled disk does not go back into the node, so the missing disk is **replaced** with the free disk `sde` (bay `scsi-0:0:4:0`). ZFS rebuilds the missing data from parity (**resilver**), working only on the blocks in use:

   ```bash title="root@desopve04"
   zpool replace tank pci-0000:02:00.0-scsi-0:0:3:0 /dev/disk/by-path/pci-0000:02:00.0-scsi-0:0:4:0
   zpool status tank
   ```

   ```text output
     pool: tank
    state: DEGRADED
   status: One or more devices is currently being resilvered.  The pool will
   	continue to function, possibly in a degraded state.
   action: Wait for the resilver to complete.
     scan: resilver in progress since Mon Nov  9 14:11:25 2026
   	1.22G / 1.22G scanned, 345M / 1.12G issued at 173M/s
   	100M resilvered, 30.18% done, 00:00:04 to go
   config:

   	NAME                                 STATE     READ WRITE CKSUM
   	tank                                 DEGRADED     0     0     0
   	  raidz1-0                           DEGRADED     0     0     0
   	    pci-0000:02:00.0-scsi-0:0:1:0    ONLINE       0     0     0
   	    pci-0000:02:00.0-scsi-0:0:2:0    ONLINE       0     0     0
   	    replacing-2                      DEGRADED     0     0     0
   	      pci-0000:02:00.0-scsi-0:0:3:0  REMOVED      0     0     0
   	      pci-0000:02:00.0-scsi-0:0:4:0  ONLINE       0     0     0  (resilvering)

   errors: No known data errors
   ```

   ```bash title="root@desopve04"
   zpool wait -t resilver tank
   ```

4. **Result:** when the resilver completes, ZFS detaches the old disk by itself and the pool goes back **ONLINE**:

   ```bash title="root@desopve04"
   zpool status tank
   ```

   ```text output
     pool: tank
    state: ONLINE
     scan: resilvered 435M in 00:00:12 with 0 errors on Mon Nov  9 14:11:37 2026
   config:

   	NAME                               STATE     READ WRITE CKSUM
   	tank                               ONLINE       0     0     0
   	  raidz1-0                         ONLINE       0     0     0
   	    pci-0000:02:00.0-scsi-0:0:1:0  ONLINE       0     0     0
   	    pci-0000:02:00.0-scsi-0:0:2:0  ONLINE       0     0     0
   	    pci-0000:02:00.0-scsi-0:0:4:0  ONLINE       0     0     0

   errors: No known data errors
   ```

   ```bash title="root@desopve04"
   md5sum /tank/copia/nuovo.txt /tank/comp-zstd/nuovo.txt
   ```

   ```text output
   2b697b63aba1f00e8edd33f831903cf2  /tank/copia/nuovo.txt
   2b697b63aba1f00e8edd33f831903cf2  /tank/comp-zstd/nuovo.txt
   ```

   ```bash title="root@desopve04"
   pct exec 941 -- cat /root/durante-il-guasto.txt
   ```

   ```text output
   Mon Nov  9 13:10:55 UTC 2026
   ```

   ![The pool healthy again](../../assets/images/10/04-tank-online.png)

   - **Measured:** `resilvered 435M in 00:00:12 with 0 errors`. During the resilver the progress line showed 1.22G to scan and, at that moment, an issue rate of 173M/s. Afterwards the two copies of `nuovo.txt` have the same `md5sum`, the file written during the failure reads back unchanged, and `zpool status` reports `No known data errors`.
   - **Interpretation:** the checks show no data loss, not even for the data written while the pool was degraded; they cover the files that were checked, though, not every block in the pool. The resilver scanned 1.22 GiB, a small fraction of a 20 GB disk, consistent with a resilver that works only on allocated blocks. The 12 seconds hold for this amount of data: on a fuller pool, or under load, a resilver takes longer, and this test does not say how much longer.
   - **How to check:** a scrub after the resilver (`zpool scrub -w tank`) rereads every block and verifies its checksum. To see how the time grows, note `ALLOC` in `zpool list tank` before pulling the disk and repeat the test with more data.

### Test 2 – A spare disk

Insert the new 20 GB disk into the free bay `scsi-0:0:5:0` (if the kernel doesn't see it, repeat the bus rescan from [Lab 09](/09-lvm-and-lvm-thin/#2-the-nodes-disks)). The kernel gives it the first free name, `sdd`: the same name as the removed disk, but it is a different disk. That is why pools are built with stable names (`by-path` or `by-id`) and not with `sdX`.

```bash title="root@desopve04"
ls -l /dev/disk/by-path/ | grep -v part | awk '{print $9, $11}' | grep scsi
```

```text output
pci-0000:02:00.0-scsi-0:0:0:0 ../../sda
pci-0000:02:00.0-scsi-0:0:1:0 ../../sdb
pci-0000:02:00.0-scsi-0:0:2:0 ../../sdc
pci-0000:02:00.0-scsi-0:0:4:0 ../../sde
pci-0000:02:00.0-scsi-0:0:5:0 ../../sdd
```

```bash title="root@desopve04"
zpool add tank spare /dev/disk/by-path/pci-0000:02:00.0-scsi-0:0:5:0
zpool set autoreplace=on tank
zpool status tank
```

```text output
  pool: tank
 state: ONLINE
  scan: resilvered 435M in 00:00:12 with 0 errors on Mon Nov  9 14:11:37 2026
config:

	NAME                               STATE     READ WRITE CKSUM
	tank                               ONLINE       0     0     0
	  raidz1-0                         ONLINE       0     0     0
	    pci-0000:02:00.0-scsi-0:0:1:0  ONLINE       0     0     0
	    pci-0000:02:00.0-scsi-0:0:2:0  ONLINE       0     0     0
	    pci-0000:02:00.0-scsi-0:0:4:0  ONLINE       0     0     0
	spares
	  pci-0000:02:00.0-scsi-0:0:5:0    AVAIL

errors: No known data errors
```

- The **spare** (`AVAIL`) stays idle. According to the OpenZFS documentation, when a pool disk fails the spare replaces it automatically, without waiting for an operator; on Linux it is `zfs-zed` that starts the replacement and the resilver. The failed disk must then be replaced, and the spare becomes available again.
- **`autoreplace=on`** does something else: a new disk inserted in the **same bay**, the same physical location as a disk that belonged to the pool, is formatted and used as its replacement automatically. This too needs `zfs-zed` running.
- This lab does not test either behaviour. To see them, pull a pool disk again and watch `zpool status`: the spare should go `INUSE` and a resilver start without any `zpool replace`; then insert a new disk in the bay of the pulled one.

### Cleanup

Remove the container, the test disk and the lab datasets, the dataset received on `desopve01` and the key of `desopve04` from the cluster. The `tank` pool stays: it will be used in lab 19.

```bash title="root@desopve04"
pct stop 941 && pct destroy 941 --purge 1
```

```text output
purging CT 941 from related configurations..
```

```bash title="root@desopve04"
pvesm free tank:vm-990-disk-0
```

```text output
Removed volume 'tank:vm-990-disk-0'
```

```bash title="root@desopve04"
for d in comp-off comp-lz4 comp-zstd copia; do zfs destroy -r tank/$d; done
zfs list -r tank
```

```text output
NAME   USED  AVAIL  REFER  MOUNTPOINT
tank   794K  38.4G   139K  /tank
```

```bash title="root@desopve04"
ssh root@desopve01.proxmox.community 'zfs destroy -r rpool/lab10-copia; sed -i "/ root@desopve04$/d" /etc/pve/priv/authorized_keys'
ssh -o BatchMode=yes root@desopve01.proxmox.community true
```

```text output
root@desopve01.proxmox.community: Permission denied (publickey,password).
```

The connection is now refused: the key of `desopve04` no longer opens `desopve01`.

## Final lab state

- Nothing changed on the cluster: the received dataset was removed from `desopve01` and the key of `desopve04` was removed from the cluster's `authorized_keys`.
- **`desopve04`:**
  - pool **`tank`**: RAIDZ1 on the disks `pci-0000:02:00.0-scsi-0:0:1:0`, `0:2:0` and `0:4:0`, with the spare `0:5:0`. Properties `compression=lz4`, `atime=off`, `autoreplace=on`; it is empty, with 38.4 GiB usable;
  - storage **`tank`** (`zfspool`, content `images,rootdir`, `sparse`, `desopve04` only);
  - bay `scsi-0:0:3:0` is empty: the disk pulled in Test 1 does not go back into the node;
  - ARC limited to **2 GiB** in `/etc/modprobe.d/zfs.conf`;
  - template `debian-13-standard_13.6-1_amd64.tar.zst` in the `local` storage.

## What you learned

- **Choosing the vdev layout.** Redundancy lives inside each vdev, and losing a vdev means losing the pool. For VM disks, where IOPS count, choose mirrors or striped mirrors; choose RAIDZ where capacity counts, as for backups and archives.
- **Naming the disks.** Build pools on stable names (`by-id` or `by-path`), never on `sdX`: in Test 2 the new disk got the name `sdd`, the same as the disk pulled in Test 1.
- **Planning capacity.** Plan on the usable space shown by `zfs list`, not on the raw space of `zpool list`. On RAIDZ, small files cost more than the parity ratio suggests: without compression, 112 MiB of data took up 157 MiB.
- **Enabling compression.** Keep it on by default (LZ4 or zstd) and compare the algorithms on your own data with `compressratio`; if CPU matters, measure its cost separately, because the ratio does not show it.
- **Reacting to checksum errors.** `CKSUM` errors without `READ` or `WRITE` errors mean that a disk returned wrong data without reporting it: run a scrub, keep an eye on the disk and replace it if the errors come back. Keep the monthly scrub, and make sure the ZED notifications actually arrive ([Lab 51](/51-notifications-metrics-logs/)).
- **Using snapshots and send/receive.** Read the space held by snapshots in `USEDSNAP`; remember that a rollback only goes back to the latest snapshot; use incremental sends to move only the changes, as replication does ([Lab 11](/11-zfs-replication/)).
- **Sizing the ARC.** Set `zfs_arc_max` according to the RAM the guests need and to the size of the pools (the Proxmox VE documentation suggests at least 2 GiB plus 1 GiB per TiB of storage), both on the fly and in `/etc/modprobe.d/zfs.conf`, adding `update-initramfs -u -k all` on nodes that boot from ZFS, and check the value after the next reboot.
- **Handling a failed disk.** A degraded RAIDZ1 keeps working but has no redundancy left: replace the disk promptly with `zpool replace`, confirm with a scrub, and consider a spare so that the rebuild starts without waiting for an operator. Judge resilver times on your own data: the 12 seconds seen here hold for 1.22 GiB.

## References

- [Proxmox VE – ZFS on Linux](https://pve.proxmox.com/pve-docs/pve-admin-guide.html#chapter_zfs)
- [Proxmox VE – ZFS RAID level considerations: performance, space and parity of small blocks](https://pve.proxmox.com/pve-docs/pve-admin-guide.html#sysadmin_zfs_raid_considerations)
- [Proxmox VE – Email notification from ZED](https://pve.proxmox.com/pve-docs/pve-admin-guide.html#_configure_e_mail_notification)
- [Proxmox VE – Limit ZFS Memory Usage](https://pve.proxmox.com/pve-docs/pve-admin-guide.html#sysadmin_zfs_limit_memory_usage)
- [Proxmox VE – Local ZFS Pool Backend](https://pve.proxmox.com/pve-docs/pve-admin-guide.html#storage_zfspool)
- [OpenZFS 2.4 – `zpool scrub`: what scrub and resilver examine](https://openzfs.github.io/openzfs-docs/man/v2.4/8/zpool-scrub.8.html)
- [OpenZFS 2.4 – `zpool replace`](https://openzfs.github.io/openzfs-docs/man/v2.4/8/zpool-replace.8.html)
- [OpenZFS 2.4 – Hot spares](https://openzfs.github.io/openzfs-docs/man/v2.4/7/zpoolconcepts.7.html#Hot_Spares) and [the `autoreplace` property](https://openzfs.github.io/openzfs-docs/man/v2.4/7/zpoolprops.7.html#autoreplace)
- [OpenZFS 2.4 – The `compression` property and rounding to whole sectors](https://openzfs.github.io/openzfs-docs/man/v2.4/7/zfsprops.7.html#compression)
- [OpenZFS 2.4 – Space accounting: `used`, `usedbysnapshots`, `logicalused`](https://openzfs.github.io/openzfs-docs/man/v2.4/7/zfsprops.7.html#used)
- [OpenZFS 2.4 – `zfs send`: incremental, compressed and dry-run streams](https://openzfs.github.io/openzfs-docs/man/v2.4/8/zfs-send.8.html)
- [OpenZFS 2.4 – Module parameters: `spa_slop_shift`](https://openzfs.github.io/openzfs-docs/man/v2.4/4/zfs.4.html#spa_slop_shift)
- [OpenZFS 2.4 – `zpool` and `zfs` manual pages](https://openzfs.github.io/openzfs-docs/man/v2.4/index.html)
