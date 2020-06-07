#!/usr/bin/env python
import re

path = '/home/kraftwerk28/projects/java/dict_uk/out/dict_corp_lt.txt'
inp = open(path, 'rt')
out = open('nouns.txt', 'w+')

forbid_props = [':p:', 'prop', 'abbr']
allow_props = ['noun', 'v_naz']

for nth, line in enumerate(inp):
    if nth % 1000000:
        print(f'{nth} line processed.')
    word, _, propstring = line.split()

    if any(prop not in propstring for prop in allow_props):
        continue
    if any(prop in propstring for prop in forbid_props):
        continue

    out.write(f'{word}\n')

inp.close()
out.close()
