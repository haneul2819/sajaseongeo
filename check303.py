import json
d = json.load(open('data/idioms/303_조강지처.json', encoding='utf-8'))
for i, p in enumerate(d['story']):
    print(i, len(p))
print('total', sum(len(p) for p in d['story']))
print('meaning len', len(d['meaning']))
print('lesson len', len(d['lesson']))
for e in d['examples']:
    print('ex len', len(e), '조강지처' in e)
print('hanja len', len(d['hanja']))
print('hangul len', len(d['hangul']))
