import re

inp, out = open('words.txt', 'r'), open('nouns.txt', 'w+')
r = re.compile(r'([^/]+)\s+/n')

for word in inp:
    if m := r.match(word):
        out.write(f'{m[1]}\n')

inp.close()
out.close()
