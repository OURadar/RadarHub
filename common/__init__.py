from .cosmetics import *

def radar_prefix(radar):
    radarDict = {
        'px1000': 'PX-',
        'raxpol': 'RAXPOL-',
        'px10k': 'PX10K-',
        'horus': 'HORUS-',
    }
    return radarDict[radar] if radar in radarDict else None
