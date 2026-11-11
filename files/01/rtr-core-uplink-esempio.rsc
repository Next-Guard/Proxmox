# ESEMPIO – uscita diretta verso Internet su ether2, NON attiva nel laboratorio
# del manuale. Adattala alla tua rete (DHCP o indirizzo statico, firewall).
#
# Attenzione: nel manuale i server escono verso Internet solo tramite il proxy
# di netsvc. Se attivi questa uscita, alcuni comportamenti descritti nei lab
# cambiano: per esempio un download senza proxy riesce invece di fallire.
/ip dhcp-client
add comment="uplink verso Internet (esempio)" interface=ether2
/ip firewall nat
add action=masquerade chain=srcnat comment="uscita del laboratorio (esempio)" \
    out-interface=ether2
/ip firewall filter
add action=accept chain=input connection-state=established,related \
    comment="risposte alle connessioni del router"
add action=drop chain=input in-interface=ether2 \
    comment="nessun accesso al router da Internet"
