// Menu laterale del sito, ricavato da `nav` e `nav_translations` di mkdocs.yml
// (tools/migrate-mkdocs.mjs). Le etichette tengono il numero del lab; `translations.it` è l'italiano.
export const sidebar = [
	{
		label: "The lab",
		translations: {
			it: "Il laboratorio"
		},
		items: [
			{
				label: "The lab and the path",
				translations: {
					it: "Il laboratorio e il percorso"
				},
				slug: "the-lab"
			}
		]
	},
	{
		label: "Part 0 – The base lab",
		translations: {
			it: "Parte 0 – Il laboratorio di base"
		},
		items: [
			{
				label: "01 Lab architecture",
				translations: {
					it: "01 Architettura del laboratorio"
				},
				slug: "01-lab-architecture"
			},
			{
				label: "02 Domain controller",
				slug: "02-domain-controller"
			},
			{
				label: "03 Installing Proxmox VE",
				translations: {
					it: "03 Installazione di Proxmox VE"
				},
				slug: "03-install-proxmox-ve"
			},
			{
				label: "04 First access, repositories, updates",
				translations: {
					it: "04 Primo accesso, repository, aggiornamenti"
				},
				slug: "04-first-access-repositories-updates"
			},
			{
				label: "05 SSH, shell and CLI",
				translations: {
					it: "05 SSH, shell e CLI"
				},
				slug: "05-ssh-shell-cli"
			},
			{
				label: "06 Cluster and Corosync",
				translations: {
					it: "06 Cluster e Corosync"
				},
				slug: "06-cluster-corosync"
			},
			{
				label: "07 First VM and container",
				translations: {
					it: "07 Prima VM e primo container"
				},
				slug: "07-first-vm-and-container"
			}
		],
		collapsed: true
	},
	{
		label: "A – Storage",
		items: [
			{
				label: "08 The storage model",
				translations: {
					it: "08 Il modello di storage"
				},
				slug: "08-storage-model"
			},
			{
				label: "09 LVM and LVM-thin",
				translations: {
					it: "09 LVM e LVM-thin"
				},
				slug: "09-lvm-and-lvm-thin"
			},
			{
				label: "10 ZFS",
				slug: "10-zfs"
			},
			{
				label: "11 ZFS replication",
				translations: {
					it: "11 Replica ZFS"
				},
				slug: "11-zfs-replication"
			},
			{
				label: "12 TrueNAS NAS",
				translations: {
					it: "12 NAS TrueNAS"
				},
				slug: "12-truenas-nas"
			},
			{
				label: "13 NFS",
				slug: "13-nfs"
			},
			{
				label: "14 SMB/CIFS",
				slug: "14-smb-cifs"
			},
			{
				label: "15 iSCSI, shared LVM, multipath",
				translations: {
					it: "15 iSCSI, LVM condiviso, multipath"
				},
				slug: "15-iscsi-lvm-multipath"
			},
			{
				label: "16 Snapshots",
				translations: {
					it: "16 Snapshot"
				},
				slug: "16-snapshots"
			},
			{
				label: "17 Ceph 1: installation",
				translations: {
					it: "17 Ceph 1: installazione"
				},
				slug: "17-ceph-installation"
			},
			{
				label: "18 Ceph 2: growth, maintenance, failures",
				translations: {
					it: "18 Ceph 2: crescita, manutenzione, guasti"
				},
				slug: "18-ceph-growth-maintenance-failures"
			},
			{
				label: "19 Storage benchmark with fio",
				translations: {
					it: "19 Benchmark dello storage con fio"
				},
				slug: "19-fio-benchmark"
			}
		],
		collapsed: true
	},
	{
		label: "B – Network",
		translations: {
			it: "B – Rete"
		},
		items: [
			{
				label: "20 Bridges, stable names, VLANs",
				translations: {
					it: "20 Bridge, nomi stabili, VLAN"
				},
				slug: "20-bridges-stable-names-vlans"
			},
			{
				label: "21 Bonding",
				translations: {
					it: "21 Bond"
				},
				slug: "21-bonding"
			},
			{
				label: "22 Dedicated networks",
				translations: {
					it: "22 Reti dedicate"
				},
				slug: "22-dedicated-networks"
			},
			{
				label: "23 Open vSwitch",
				slug: "23-open-vswitch"
			},
			{
				label: "24 Routing and NAT",
				translations: {
					it: "24 Routing e NAT"
				},
				slug: "24-routing-nat"
			},
			{
				label: "25 IPv6",
				slug: "25-ipv6"
			},
			{
				label: "26 Virtual router",
				translations: {
					it: "26 Router virtuale"
				},
				slug: "26-virtual-router"
			},
			{
				label: "27 SDN 1: Simple zone",
				translations: {
					it: "27 SDN 1: zona Simple"
				},
				slug: "27-sdn-simple"
			},
			{
				label: "28 SDN 2: VLAN and QinQ",
				translations: {
					it: "28 SDN 2: VLAN e QinQ"
				},
				slug: "28-sdn-vlan-qinq"
			},
			{
				label: "29 SDN 3: VXLAN",
				slug: "29-sdn-vxlan"
			},
			{
				label: "30 SDN 4: EVPN",
				slug: "30-sdn-evpn"
			},
			{
				label: "31 SDN 5: Fabrics",
				slug: "31-sdn-fabrics"
			},
			{
				label: "32 Firewall 1",
				slug: "32-firewall-1"
			},
			{
				label: "33 Firewall 2",
				slug: "33-firewall-2"
			},
			{
				label: "34 Network performance and troubleshooting",
				translations: {
					it: "34 Prestazioni e troubleshooting di rete"
				},
				slug: "34-network-performance-troubleshooting"
			}
		],
		collapsed: true
	},
	{
		label: "C – Compute",
		translations: {
			it: "C – Calcolo"
		},
		items: [
			{
				label: "35 KVM and QEMU",
				translations: {
					it: "35 KVM e QEMU"
				},
				slug: "35-kvm-qemu"
			},
			{
				label: "36 Memory",
				translations: {
					it: "36 Memoria"
				},
				slug: "36-memory"
			},
			{
				label: "37 Virtual disks and controllers",
				translations: {
					it: "37 Dischi e controller virtuali"
				},
				slug: "37-virtual-disks-controllers"
			},
			{
				label: "38 Linux VM and guest agent",
				translations: {
					it: "38 VM Linux e guest agent"
				},
				slug: "38-linux-vm-guest-agent"
			},
			{
				label: "39 Windows VM and VirtIO",
				translations: {
					it: "39 VM Windows e VirtIO"
				},
				slug: "39-windows-vm-virtio"
			},
			{
				label: "40 Templates, cloud-init, clones",
				translations: {
					it: "40 Template, cloud-init, cloni"
				},
				slug: "40-templates-cloud-init-clones"
			},
			{
				label: "41 LXC containers",
				translations: {
					it: "41 Container LXC"
				},
				slug: "41-lxc-containers"
			},
			{
				label: "42 Hotplug, resize, limits",
				translations: {
					it: "42 Hotplug, resize, limiti"
				},
				slug: "42-hotplug-resize-limits"
			}
		],
		collapsed: true
	},
	{
		label: "D – Integrated services",
		translations: {
			it: "D – Servizi integrati"
		},
		items: [
			{
				label: "43 Active Directory realm",
				translations: {
					it: "43 Realm Active Directory"
				},
				slug: "43-active-directory-realm-ldaps"
			},
			{
				label: "44 Users, roles, pools, tokens",
				translations: {
					it: "44 Utenti, ruoli, pool, token"
				},
				slug: "44-users-groups-roles-pools-tokens"
			},
			{
				label: "45 Two-factor authentication",
				translations: {
					it: "45 Autenticazione a due fattori"
				},
				slug: "45-two-factor-authentication"
			},
			{
				label: "46 Backup with vzdump",
				translations: {
					it: "46 Backup con vzdump"
				},
				slug: "46-vzdump-backup"
			},
			{
				label: "47 Proxmox Backup Server",
				slug: "47-proxmox-backup-server"
			},
			{
				label: "48 Migrations",
				translations: {
					it: "48 Migrazioni"
				},
				slug: "48-migrations"
			},
			{
				label: "49 High availability",
				translations: {
					it: "49 Alta disponibilità"
				},
				slug: "49-high-availability"
			},
			{
				label: "50 Import from VMware ESXi",
				translations: {
					it: "50 Import da VMware ESXi"
				},
				slug: "50-import-from-esxi"
			},
			{
				label: "51 Notifications, metrics, logs",
				translations: {
					it: "51 Notifiche, metriche, log"
				},
				slug: "51-notifications-metrics-logs"
			},
			{
				label: "52 API and automation",
				translations: {
					it: "52 API e automazione"
				},
				slug: "52-api-automation"
			},
			{
				label: "53 Datacenter Manager",
				slug: "53-datacenter-manager"
			}
		],
		collapsed: true
	},
	{
		label: "Appendices",
		translations: {
			it: "Appendici"
		},
		items: [
			{
				label: "A Upgrading from 8 to 9",
				translations: {
					it: "A Aggiornamento da 8 a 9"
				},
				slug: "a-upgrade-8-to-9"
			},
			{
				label: "B Credentials and addresses",
				translations: {
					it: "B Credenziali e indirizzi"
				},
				slug: "b-credentials-and-addresses"
			},
			{
				label: "C Troubleshooting",
				translations: {
					it: "C Risoluzione dei problemi"
				},
				slug: "c-troubleshooting"
			},
			{
				label: "D Rebuilding the lab as virtual",
				translations: {
					it: "D Ricostruire il lab in virtuale"
				},
				slug: "d-rebuild-as-virtual"
			}
		],
		collapsed: true
	},
	{
		label: "Contribute",
		translations: {
			it: "Contribuisci"
		},
		slug: "contributing"
	},
	{
		label: "About",
		translations: {
			it: "Chi siamo"
		},
		slug: "about"
	}
];
