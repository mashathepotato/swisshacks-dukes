#!/usr/bin/env python3
"""Export every sheet of the challenge workbooks to CSV (one file per tab).

Usage: python3 extract.py   (run from the data/ directory)
Requires: openpyxl  (pip install openpyxl)
"""
import csv
import os
import re

import openpyxl

JOBS = [
    ("SwissHacks CRM.xlsx", "crm"),
    ("SwissHacks Portfolio Construction.xlsx", "portfolio"),
]


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.strip().lower()).strip("_")


def main():
    for fname, outdir in JOBS:
        os.makedirs(outdir, exist_ok=True)
        wb = openpyxl.load_workbook(fname, data_only=True)
        for ws in wb.worksheets:
            rows = list(ws.iter_rows(values_only=True))
            while rows and all(c is None for c in rows[-1]):
                rows.pop()
            out = os.path.join(outdir, slug(ws.title) + ".csv")
            with open(out, "w", newline="") as f:
                w = csv.writer(f)
                for r in rows:
                    w.writerow(["" if c is None else c for c in r])
            print(f"{ws.title!r} -> {out} ({len(rows)} rows)")


if __name__ == "__main__":
    main()
