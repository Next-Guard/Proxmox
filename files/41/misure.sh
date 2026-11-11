#!/bin/bash
# Misure del lab 41 (container LXC), da lanciare come root sul nodo che ospita il container.
#
#   misure.sh cpu <ctid> <comando...>   CPU consumata dal cgroup del container mentre gira <comando>
#   misure.sh mem <ctid> [secondi]      memory.current e memory.swap.current ogni 3 s, poi gli OOM kill
#   misure.sh pinggap <ip> [secondi]    un ping ogni 0,2 s: quante risposte mancano (buco di rete)
set -e
mode=$1; shift
case "$mode" in
  cpu)
    ct=$1; shift
    f=/sys/fs/cgroup/lxc/$ct/cpu.stat
    a=$(awk '/^usage_usec/{print $2}' "$f"); t0=$(date +%s%N)
    "$@"
    b=$(awk '/^usage_usec/{print $2}' "$f"); t1=$(date +%s%N)
    awk -v u=$((b - a)) -v t=$(((t1 - t0) / 1000)) 'BEGIN {
      printf "CPU usata dal cgroup: %.1f s su %.1f s di orologio = %d%% di un core\n", u/1e6, t/1e6, u*100/t }'
    ;;
  mem)
    ct=$1; dur=${2:-15}; d=/sys/fs/cgroup/lxc/$ct
    k0=$(awk '/^oom_kill /{print $2}' "$d/memory.events")
    for ((s = 3; s <= dur; s += 3)); do
      sleep 3
      printf 't+%ss memory.current=%d MiB swap.current=%d MiB\n' "$s" \
        $(( $(cat "$d/memory.current") / 1048576 )) $(( $(cat "$d/memory.swap.current") / 1048576 ))
    done
    echo "oom_kill: $k0 -> $(awk '/^oom_kill /{print $2}' "$d/memory.events")"
    ;;
  pinggap)
    ip=$1; dur=${2:-30}; n=$((dur * 5))
    ping -n -i 0.2 -c "$n" -W 1 "$ip" | awk -v n="$n" '/icmp_seq=/{ok++} END {
      printf "buco nei ping: %d risposte perse, circa %.1f s\n", n - ok, (n - ok) * 0.2 }'
    ;;
  *) echo "uso: $0 cpu|mem|pinggap ..." >&2; exit 1 ;;
esac
