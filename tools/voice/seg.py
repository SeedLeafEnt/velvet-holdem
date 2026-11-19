import subprocess, re, sys, json
def segs(path, noise=-40, d=0.6):
    out = subprocess.run(['ffmpeg','-hide_banner','-i',path,'-af',f'silencedetect=noise={noise}dB:d={d}','-f','null','-'],capture_output=True,text=True).stderr
    dur = float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',path],capture_output=True,text=True).stdout)
    st=[float(x) for x in re.findall(r'silence_start: ([\d.]+)',out)]
    en=[float(x) for x in re.findall(r'silence_end: ([\d.]+)',out)]
    # speech segments between silences
    res=[]; cur=0.0
    for s,e in zip(st,en):
        if s-cur>0.05: res.append((cur,s))
        cur=e
    if dur-cur>0.05: res.append((cur,dur))
    gaps=[e-s for s,e in zip(st,en)]
    return res,gaps,dur
if __name__=='__main__':
    s=json.load(open('script.json'))
    for w in sys.argv[1:]:
        for d in (0.6,0.45,0.3):
            r,g,dur=segs(f'in/{w}.mp3',d=d)
            print(w,'d',d,'segs',len(r),'expected',len(s[w]['lines']))
