# rtr-core – configurazione completa alla fine del manuale
# Esportata con "/export hide-sensitive" (RouterOS 7.25.1). Rispetto alla base
# del Lab 01 contiene le aggiunte del Lab 24 (route verso la subnet instradata)
# e del Lab 25 (IPv6 con Router Advertisement).
#
# Lab 25: link-local automatico disattivato, al suo posto fe80::1 fisso
/ipv6 settings
set disable-link-local-address=yes
# Lab 01: le due reti del laboratorio sulla stessa porta ether1
/ip address
add address=172.27.199.1/24 comment="rete di gestione" interface=ether1 \
    network=172.27.199.0
add address=172.32.199.1/24 comment=\
    "rete cluster/storage, sulla stessa porta della gestione" interface=ether1 \
    network=172.32.199.0
# Lab 24: la subnet 10.99.99.0/28 vive dietro desopve04
/ip route
add comment="subnet instradata verso desopve04 (lab 24)" dst-address=\
    10.99.99.0/28 gateway=172.27.199.24
# Lab 25: prefisso ULA della rete di gestione, annunciato con RA
/ipv6 address
add address=fd27:199::1 comment="lab 25: rete di gestione" interface=ether1
add address=fe80::1 advertise=no comment="link-local fisso del gateway" \
    interface=ether1
/ipv6 nd
set [ find default=yes ] ra-interval=20s-1m
/system identity
set name=rtr-core
