#!/usr/bin/env python
import re

path = 'nouns_simplified.txt'
inp = open(path, 'rt')
out = open('nouns_simplified2.txt', 'w+')

res = set()
for nth, word in enumerate(inp):
    if word.endswith('ізм'):
        continue
    if word.__len__() < 10:
        res.add(word)
    # if nth % 10000:
    #     print(nth)
    # if any(w in word for w in res):
    #     continue
    # res.add(word)

for w in res:
    out.write(f'{w}')

inp.close()
out.close()
