import glob, re

urls = set()
for p in glob.glob(r'C:\Users\leneker\.gemini\antigravity-ide\brain\*\.system_generated\logs\transcript*.jsonl'):
    try:
        with open(p, 'r', encoding='utf-8') as f:
            for line in f:
                for m in re.findall(r'https?://[a-zA-Z0-9\-\.]+\.onrender\.com[^\s"\'\<\>]*', line):
                    urls.add(m)
    except:
        pass

for u in sorted(urls):
    print(u)
