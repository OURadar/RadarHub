#
#   RadarHub
# 
#   Created by Boonleng Cheong
#

def hex2rgba(strs):
    for str in strs:
        r = int(str[:2], 16) / 255
        g = int(str[2:4], 16) / 255
        b = int(str[4:6], 16) / 255
        print(f'[{r:.3f}, {g:.3f}, {b:.3f}, 1.0]')

