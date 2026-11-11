# fwtest.ps1 - matrice di connettività verso un guest: HTTP (80), SSH (22) e ping,
# da tre sorgenti:
#   - il DC stesso (rete di gestione);
#   - il CT 121 su desopve01 (VLAN 10, esce attraverso il NAT di router01);
#   - il CT 403 su desopve04 (rete instradata 10.99.99.0/28, senza NAT).
# Si lancia dal DC, in PowerShell. Per le prove dai container entra nei nodi
# con la chiave SSH caricata nell'agente (Lab 05) ed esegue nc e ping dentro il CT.
#
# Uso:  .\fwtest.ps1                     (destinazione predefinita: CT 101)
#       .\fwtest.ps1 -Target 172.27.199.101

param([string]$Target = '172.27.199.101')

function Test-Porta([int]$Porta) {
    $c = New-Object Net.Sockets.TcpClient
    try { if ($c.ConnectAsync($Target, $Porta).Wait(2000)) { 'ok' } else { 'BLOCCATO' } }
    catch { 'BLOCCATO' }
    finally { $c.Close() }
}

$ping = if ((ping -n 1 -w 2000 $Target) -match 'TTL=') { 'ok' } else { 'BLOCCATO' }
'{0,-34} HTTP {1,-9} SSH {2,-9} ping {3}' -f 'DC 172.27.199.20 (admin)', (Test-Porta 80), (Test-Porta 22), $ping

# Lo stesso test, eseguito dentro i container.
$prova = @'
r80=$(nc -zw2 DEST 80 >/dev/null 2>&1 && echo ok || echo BLOCCATO)
r22=$(nc -zw2 DEST 22 >/dev/null 2>&1 && echo ok || echo BLOCCATO)
rp=$(ping -c1 -W2 DEST >/dev/null 2>&1 && echo ok || echo BLOCCATO)
printf "%-34s HTTP %-9s SSH %-9s ping %s\n" "ETICHETTA" $r80 $r22 $rp
'@

$sorgenti = @(
    @{ Nodo = 'desopve01'; Ct = 121; Etichetta = 'CT 121 VLAN 10 (via router01, NAT)' },
    @{ Nodo = 'desopve04'; Ct = 403; Etichetta = 'CT 403 10.99.99.2 (rete instradata)' }
)

foreach ($s in $sorgenti) {
    $script = $prova.Replace('DEST', $Target).Replace('ETICHETTA', $s.Etichetta) -replace "`r", ''
    # Lo script arriva al container in base64: niente problemi di virgolette annidate.
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
    ssh -o BatchMode=yes "root@$($s.Nodo).proxmox.community" "pct exec $($s.Ct) -- bash -c 'echo $b64 | base64 -d | bash'"
}
