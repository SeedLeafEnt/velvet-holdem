import json, re, os
from check import rec, strip, sim, S
M=json.load(open('out/meta.json')); tot=0; low=[]
for w,m in M.items():
    lines=[strip(t) for _,t in S[w]['lines']]
    assert len(m['seg'])==len(lines)
    for i,(a,b) in enumerate(m['seg']):
        h=rec(f'out/{w}.mp3',a,b); s=sim(h,lines[i]); tot+=1
        nb=max([sim(h,lines[j]) for j in (i-1,i+1) if 0<=j<len(lines)]+[0])
        if s<nb and s<0.5: low.append((w,i,lines[i],h))
print('clips checked',tot); print('suspicious:'); [print(' ',x) for x in low]
