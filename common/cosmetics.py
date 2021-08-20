#
#   RadarHub
# 
#   Created by Boonleng Cheong
#

def colorize(text, color='white'):
    colors = {
        'red': 9,
        'orange': 214,
        'yellow': 227,
        'green': 154,
        'teal': 87,
        'blue': 33,
        'pink': 170,
        'purple': 134,
        'white': 15
    }
    num = colors[color] if color in colors else 15
    return f'\033[38;5;{num}m{text}\033[m'

def hex2rgba(strs):
    for str in strs:
        r = int(str[:2], 16) / 255
        g = int(str[2:4], 16) / 255
        b = int(str[4:6], 16) / 255
        print(f'[{r:.3f}, {g:.3f}, {b:.3f}, 1.0]')
