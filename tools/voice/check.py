import json, re, subprocess, os, sys, wave
from seg import segs
from pocketsphinx import Decoder, get_model_path
S=json.load(open('script.json'))
mp=get_model_path()
dec=Decoder(hmm=os.path.join(mp,'en-us/en-us'), lm=os.path.join(mp,'en-us/en-us.lm.bin'), dict=os.path.join(mp,'en-us/cmudict-en-us.dict'), loglevel='FATAL')
def strip(t): return re.sub(r'\[[^\]]*\]\s*','',t).strip()
def words(t): return set(re.findall(r"[a-z']+",t.lower()))
def rec(path,a,b):
    raw=subprocess.run(['ffmpeg','-v','error','-ss',str(max(0,a-0.05)),'-t',str(b-a+0.1),'-i',path,'-ac','1','-ar','16000','-f','s16le','-'],capture_output=True).stdout
    dec.start_utt(); dec.process_raw(raw,full_utt=True); dec.end_utt()
    h=dec.hyp(); return h.hypstr if h else ''
def sim(a,b):
    A,B=words(a),words(b)
    return len(A&B)/max(1,len(B))
out={}
for w in (sys.argv[1:] if __name__=="__main__" else []):
    lines=[strip(t) for _,t in S[w]['lines']]
    for d in (0.6,0.45,0.5,0.55,0.4,0.35):
        r,g,dur=segs(f'in/{w}.mp3',d=d)
        if len(r)==len(lines): break
    print(f'== {w}: {len(r)} segments / {len(lines)} lines (d={d}, total {dur:.1f}s)')
    hyps=[rec(f'in/{w}.mp3',a,b) for a,b in r]
    bad=0
    for i,((a,b),h) in enumerate(zip(r,hyps)):
        s0=sim(h,lines[i]); nb=max([sim(h,lines[j]) for j in (i-1,i+1) if 0<=j<len(lines)]+[0])
        flag='' if s0>=nb or s0>=0.5 else '  <-- check'
        if flag: bad+=1
        print(f'{i:2d} {a:6.2f}-{b:6.2f} ({b-a:4.2f}s) exp: {lines[i][:46]:46s} | heard: {h[:50]}{flag}')
    out[w]={'d':d,'seg':[[round(a,3),round(b,3)] for a,b in r]}
    print('flags',bad)
if __name__=="__main__": json.dump(out,open('segs.json','w'))
