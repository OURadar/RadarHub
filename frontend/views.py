import json
import struct
from django.shortcuts import render
from django.http import HttpResponse

# Create your views here.
def index(request):
    return radar(request, radar='demo')

def radar(request, radar):
    return render(request, 'frontend/index.html', {'radar': radar})

def archive_radar(request, radar, profileGL):
    obj = {'radar': radar, 'profileGL': profileGL}
    return render(request, 'frontend/archive.html', {'params': obj})

def archive(request):
    return archive_radar(request, "demo", False)

def archive_profile(request):
    return archive_radar(request, "demo", True)

def binary(request, name):
    print(f'views.binary() name={name}')
    elev = 0.5
    elev_bin = bytearray(struct.pack('f', elev));
    payload = elev_bin + b'\x00\x01\x02\x00\x00\x00\xfd\xfe\xff'
    if not isinstance(payload, bytes):
        payload = bytes(payload);
    response = HttpResponse(payload, content_type='application/octet-stream')
    return response

def header(requst, name):
    print(f'views.header() name =${name}')
    data = {'elev': 0.5, 'count': 2000}
    payload = json.dumps(data)
    response = HttpResponse(payload, content_type='application/json')
    return response
