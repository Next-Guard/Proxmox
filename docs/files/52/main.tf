# Lab 52: una VM dal template 9000 con OpenTofu e il provider bpg/proxmox
terraform {
  required_providers {
    proxmox = {
      source = "bpg/proxmox"
    }
  }
}

variable "token_secret" {
  type      = string
  sensitive = true
}

provider "proxmox" {
  endpoint  = "https://desopve01.proxmox.community:8006/"
  api_token = "automazione@pve!ansible=${var.token_secret}"
  insecure  = false
}

resource "proxmox_virtual_environment_vm" "tofu01" {
  name      = "tofu01"
  node_name = "desopve01"
  vm_id     = 156
  pool_id   = "automazione"

  clone {
    vm_id = 9000
    full  = false
  }

  agent {
    enabled = false
  }

  cpu {
    cores = 1
  }

  memory {
    dedicated = 1024
  }

  network_device {
    bridge = "vmbr0"
  }

  initialization {
    datastore_id = "rbd-vm"
    ip_config {
      ipv4 {
        address = "172.27.199.156/24"
        gateway = "172.27.199.1"
      }
    }
    dns {
      servers = ["172.27.199.20"]
      domain  = "proxmox.community"
    }
    user_account {
      username = "labuser"
      keys     = [trimspace(file("/root/.ssh/id_ed25519.pub"))]
    }
  }
}

output "ip" {
  value = "172.27.199.156"
}
