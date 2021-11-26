packer {
  required_plugins {
    vultr = {
      version = ">=v2.3.2"
      source  = "github.com/vultr/vultr"
    }
  }
}

variable "vultr_api_key" {
  type    = string
  default = ""
}

source "vultr" "ubuntu-20" {
  api_key              = "${var.vultr_api_key}"
  region_id            = "atl"
  plan_id              = "vc2-1c-1gb"
  os_id                = "387"
  snapshot_description = "docker_snapshot"
  state_timeout        = "10m"
  ssh_username         = "root"
}

build {
  sources = ["source.vultr.ubuntu-20"]

  provisioner "ansible" {
    playbook_file = "./install_docker.yaml"
  }
}
