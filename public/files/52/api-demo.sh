#!/bin/bash
# Lab 52: prove dell'API REST con ticket e con API token (da eseguire nel CT 154)
API=https://desopve01.proxmox.community:8006/api2/json
SECRET=$(cat /root/.pve-token)
echo "== 1. ticket"
R=$(curl -s -d "username=root@pam" --data-urlencode "password=$PW" $API/access/ticket)
TICKET=$(echo "$R" | jq -r .data.ticket); CSRF=$(echo "$R" | jq -r .data.CSRFPreventionToken)
echo "ticket: ${TICKET:0:24}… (valido 2 ore)"; echo "CSRFPreventionToken: ${CSRF:0:12}…"
echo "== 2. GET con il cookie"
curl -s -b "PVEAuthCookie=$TICKET" $API/nodes | jq -r '.data[] | "\(.node) \(.status) cpu=\(.cpu*100|floor)% mem=\(.mem/1073741824|floor)/\(.maxmem/1073741824|floor) GiB"' | sort
echo "== 3. scrittura senza e con CSRF"
curl -s -o /dev/null -w "POST /pools senza CSRF: HTTP %{http_code}\n" -b "PVEAuthCookie=$TICKET" -X POST -d "poolid=prova-api" $API/pools
curl -s -o /dev/null -w "POST /pools con CSRF: HTTP %{http_code}\n" -b "PVEAuthCookie=$TICKET" -H "CSRFPreventionToken: $CSRF" -X POST -d "poolid=prova-api" $API/pools
curl -s -o /dev/null -w "DELETE /pools/prova-api con CSRF: HTTP %{http_code}\n" -b "PVEAuthCookie=$TICKET" -H "CSRFPreventionToken: $CSRF" -X DELETE $API/pools/prova-api
echo "== 4. API token"
H="Authorization: PVEAPIToken=automazione@pve!ansible=$SECRET"
curl -s -H "$H" "$API/cluster/resources?type=vm" | jq -r '.data[] | "\(.vmid) \(.name) \(.node) template=\(.template)"'
curl -s -o /dev/null -w "GET config della VM 100 con il token: HTTP %{http_code}\n" -H "$H" $API/nodes/desopve01/qemu/100/config
curl -s -w "\n" -H "$H" -X POST -d "poolid=prova-token" $API/pools | jq -c .
