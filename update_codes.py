import json
import unicodedata

files=['administracion.json','contaduria.json']
all_data={}
for file in files:
    with open(file, 'r', encoding='utf8') as f:
        all_data[file]=json.load(f)

# Normalize name to remove spaces and accents
def normalize(name):
    nfkd=unicodedata.normalize('NFD', name)
    cleaned=''.join(c for c in nfkd if unicodedata.category(c)!='Mn')
    return cleaned.replace(' ','').replace('-','')

used=set()  # store codes without prefix
old_to_new={}

for file in files:
    prefix='ADMI' if file=='administracion.json' else 'CONTA'
    for subs in all_data[file].values():
        for sub in subs:
            base=normalize(sub['nombre'])
            credits=sub['creditos']
            left=4
            right=0
            body=base[:left]
            code_no_prefix=f"{body}C{credits}"
            if code_no_prefix in used:
                right=4
                body=base[:left]+base[-right:]
                code_no_prefix=f"{body}C{credits}"
                while code_no_prefix in used and left+right < len(base):
                    left=min(left+2, len(base))
                    body=base[:left]+base[-right:]
                    code_no_prefix=f"{body}C{credits}"
                idx=1
                unique=code_no_prefix
                while unique in used:
                    idx+=1
                    unique=f"{code_no_prefix}{idx}"
                code_no_prefix=unique
            used.add(code_no_prefix)
            code=f"{prefix}-{code_no_prefix}"
            old_to_new[sub['code']]=code
            sub['code']=code

# Update prerequisites to new codes
for file in files:
    for subs in all_data[file].values():
        for sub in subs:
            pre=sub.get('pre-requisite')
            if pre in old_to_new:
                sub['pre-requisite']=old_to_new[pre]

for file in files:
    with open(file,'w',encoding='utf8') as f:
        json.dump(all_data[file], f, ensure_ascii=False, indent=2)
