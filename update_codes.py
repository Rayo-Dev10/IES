import json

files=[('administracion.json','ADMI'),('contaduria.json','CONTA')]

for fname,prefix in files:
    with open(fname,'r',encoding='utf8') as f:
        data=json.load(f)
    old_to_new={}
    counter=1
    # Assign new sequential codes
    for sem in sorted(data.keys(), key=lambda x:int(x)):
        for sub in data[sem]:
            code=f"{prefix}-{counter:03d}C{sub['creditos']}"
            old_to_new[sub['code']]=code
            sub['code']=code
            counter+=1
    # Update prerequisites
    for sem in data:
        for sub in data[sem]:
            pre=sub.get('pre-requisite')
            if pre in old_to_new:
                sub['pre-requisite']=old_to_new[pre]
    with open(fname,'w',encoding='utf8') as f:
        json.dump(data,f,ensure_ascii=False,indent=2)
