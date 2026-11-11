#!/bin/bash
# Lab 42: core di CPU usati da due VM in contesa e pressione della CPU (PSI).
# Uso, come root sul nodo, mentre nelle due VM gira il carico:
#   contesa.sh <vmid1> <vmid2> [secondi]
a=$1; b=$2; dur=${3:-30}
cg() { echo "/sys/fs/cgroup/qemu.slice/$1.scope"; }
use() { awk '/^usage_usec/{print $2}' "$(cg "$1")/cpu.stat"; }
psi() { awk '/^some/{split($2, x, "="); print x[2]}' "$1"; }   # media degli ultimi 10 s
a0=$(use "$a"); b0=$(use "$b")
sleep "$dur"
a1=$(use "$a"); b1=$(use "$b")
awk -v a="$a" -v b="$b" -v da=$((a1 - a0)) -v db=$((b1 - b0)) -v t="$dur" 'BEGIN {
  ca = da / (t * 1e6); cb = db / (t * 1e6)
  printf "VM %s: %.2f core   VM %s: %.2f core   totale %.2f core   rapporto %s/%s = %.2f\n", a, ca, b, cb, ca + cb, b, a, cb / ca }'
for v in "$a" "$b"; do
  echo "cpu.weight $v=$(cat "$(cg "$v")/cpu.weight")  cpu.max $v=$(cat "$(cg "$v")/cpu.max")"
done
echo "PSI cpu some avg10: VM $a $(psi "$(cg "$a")/cpu.pressure") %  VM $b $(psi "$(cg "$b")/cpu.pressure") %  nodo $(psi /proc/pressure/cpu) %"
