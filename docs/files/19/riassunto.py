#!/usr/bin/env python3
"""Riassume i risultati JSON di bench.sh (lab 19) in una tabella Markdown.

Uso, dentro la VM di test:  python3 riassunto.py ~/res
Per ogni storage e ogni job calcola la media delle due ripetizioni e,
tra parentesi, la meta' dello scarto tra le due (variabilita').
"""
import json, glob, os, sys, statistics as st
d = sys.argv[1]
labs = []
for f in sorted(glob.glob(f"{d}/*-fill.json")):
    labs.append(os.path.basename(f)[:-10])
jobs = [("rr4k", "read", "iops"), ("rw4k", "write", "iops"), ("rw4kqd1", "write", "lat"), ("sr1m", "read", "bw"), ("sw1m", "write", "bw")]
print("| Storage | Lettura casuale 4k QD32 (IOPS) | Scrittura casuale 4k QD32 (IOPS) | Scrittura 4k QD1 (latenza media, ms) | Lettura sequenziale 1M (MB/s) | Scrittura sequenziale 1M (MB/s) |")
print("|---|---|---|---|---|---|")
for lab in labs:
    row = [lab]
    for j, kind, metric in jobs:
        vals = []
        for run in (1, 2):
            fn = f"{d}/{lab}-{j}-{run}.json"
            if not os.path.exists(fn): continue
            r = json.load(open(fn))["jobs"][0][kind]
            if metric == "iops": vals.append(r["iops"])
            elif metric == "bw": vals.append(r["bw_bytes"] / 1e6)
            else: vals.append(r["clat_ns"]["mean"] / 1e6)
        if not vals: row.append("–"); continue
        m = st.mean(vals); spread = (max(vals) - min(vals)) / m * 100 if m else 0
        fmt = "{:,.0f}" if metric != "lat" else "{:.2f}"
        row.append(fmt.format(m).replace(",", ".") + f" (±{spread/2:.0f}%)")
    print("| " + " | ".join(row) + " |")
