import json, subprocess, numpy as np, re
SR=44100
S=json.load(open('segs_final.json'))
def load(path):
    raw=subprocess.run(['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout
    return np.frombuffer(raw,dtype=np.float32).copy()
def lufs(path):
    e=subprocess.run(['ffmpeg','-hide_banner','-i',path,'-af','loudnorm=print_format=json','-f','null','-'],capture_output=True,text=True).stderr
    return json.loads(e[e.rindex('{'):])
meta={}
for w,v in S.items():
    x=load(f'in/{w}.mp3'); N=len(x); seg=v['seg']; parts=[]; newseg=[]; t=0.0
    for i,(a,b) in enumerate(seg):
        prev_end = seg[i-1][1] if i else 0.0
        next_start = seg[i+1][0] if i+1<len(seg) else N/SR
        a2=max(a-0.05,(prev_end+a)/2, 0); b2=min(b+0.16,(b+next_start)/2, N/SR)
        c=x[int(a2*SR):int(b2*SR)].copy()
        fi=int(0.006*SR); fo=int(0.04*SR)
        c[:fi]*=np.linspace(0,1,fi); c[-fo:]*=np.linspace(1,0,fo)
        gap=np.zeros(int(0.08*SR),dtype=np.float32)
        parts += [c,gap]; newseg.append([round(t,3), round(t+len(c)/SR,3)]); t+=(len(c)+len(gap))/SR
    y=np.concatenate(parts)
    open(f'out/{w}.f32','wb').write(y.astype(np.float32).tobytes())
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i',f'out/{w}.f32',f'out/{w}_raw.wav'])
    L=lufs(f'out/{w}_raw.wav'); g=-17.0-float(L['input_i'])
    subprocess.run(['ffmpeg','-v','error','-y','-i',f'out/{w}_raw.wav','-af',f'volume={g:.2f}dB,alimiter=limit=0.89:level=false','-ac','1','-ar',str(SR),'-c:a','libmp3lame','-b:a','128k',f'out/{w}.mp3'])
    L2=lufs(f'out/{w}.mp3')
    meta[w]={'seg':newseg,'len':round(t,2),'in_lufs':L['input_i'],'out_lufs':L2['input_i'],'peak':L2['input_tp']}
    print(w, f"{len(newseg)} clips, {t:.1f}s, LUFS {L['input_i']} -> {L2['input_i']}, peak {L2['input_tp']} dBTP")
json.dump(meta,open('out/meta.json','w'))
