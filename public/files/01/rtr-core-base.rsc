# rtr-core – configurazione di base (Lab 01)
# MikroTik RouterOS 7. Prima azzera il router senza la configurazione di fabbrica:
#   /system reset-configuration no-defaults=yes skip-backup=yes
# poi carica questo file (Files) e importalo:
#   /import file-name=rtr-core-base.rsc
# La password di admin si imposta a mano, non sta nel file:
#   /user set admin password=<password-lab>
/system identity
set name=rtr-core
/ip address
add address=172.27.199.1/24 comment="rete di gestione" interface=ether1 \
    network=172.27.199.0
add address=172.32.199.1/24 comment=\
    "rete cluster/storage, sulla stessa porta della gestione" interface=ether1 \
    network=172.32.199.0
