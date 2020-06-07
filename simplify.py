#!/usr/bin/env python
import re

path = 'nouns.txt'
inp = open(path, 'rt')
out = open('nouns_simplified.txt', 'w+')

res = set()
for nth, word in enumerate(inp):
    if nth % 10000:
        print(nth)
    if any(w in word for w in res):
        continue
    res.add(word)

for w in res:
    out.write(f'{w}\n')

inp.close()
out.close()
