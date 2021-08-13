import json

with open('../frontend/package.json') as fid:
    tmp = json.load(fid)
    print(tmp['version'])
