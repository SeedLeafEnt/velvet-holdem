"""Run every test one after another and print a short summary.
Usage: python run_all.py   (set VELVET_GPU=1 to use the graphics card; much faster)"""
import subprocess, sys, time, pathlib

HERE = pathlib.Path(__file__).resolve().parent
TESTS = [
    ["selfplay3d.py"], ["selfplay_ko.py"], ["pwa.py"], ["gamecal.py", "0"], ["gamecal.py", "1"], ["bank.py", "0"], ["bank.py", "1"], ["drinks.py", "0"], ["drinks.py", "1"], ["police.py", "0"], ["police.py", "1"], ["city.py", "0"], ["city.py", "1"],
    ["act.py", "0"], ["act.py", "1"],
    ["casino.py", "0"], ["casino.py", "1"], ["casino2.py"], ["casino2rl.py"], ["rlcam.py", "0", "bj", "rl"], ["rlcam.py", "1", "bj", "rl"],
    ["stage1.py"], ["stage2s.py", "0"], ["stage2s.py", "1"], ["stage3.py"],
    ["angertest.py", "0"], ["angertest.py", "1"], ["tricks.py"], ["seats2.py"],
]
BAD = ("Traceback", "PAGEERR", "Error:", "AssertionError")
summary = []
for t in TESTS:
    t0 = time.time()
    try:
        p = subprocess.run([sys.executable, *t], cwd=HERE, capture_output=True, text=True, timeout=600)
        out, code = (p.stdout or "") + (p.stderr or ""), p.returncode
    except subprocess.TimeoutExpired as e:  # a stuck test fails instead of stopping the whole run
        out, code = f"TIMEOUT after 600s\n{e.stdout or ''}", 1
    bad = code != 0 or any(b in out for b in BAD) or ("viol" in out and "viol: []" not in out and '"viol": []' not in out)
    summary.append((" ".join(t), "FAIL" if bad else "ok", round(time.time() - t0)))
    print(f"--- {' '.join(t)}: {'FAIL' if bad else 'ok'} ({round(time.time() - t0)}s)")
    print("\n".join(out.strip().splitlines()[-6:]))
print("\n=== summary ===")
for name, res, s in summary: print(f"{res:4}  {name}  ({s}s)")
sys.exit(1 if any(r == "FAIL" for _, r, _ in summary) else 0)
