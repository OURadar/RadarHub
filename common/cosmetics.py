#
#   RadarHub
# 
#   Created by Boonleng Cheong
#

colors = {
    'red': 9,
    'orange': 214,
    'yellow': 227,
    'green': 118,
    'teal': 87,
    'cyan': 14,
    'blue': 33,
    'pink': 170,
    'purple': 134,
    'white': 15
}

def colorize(text, color='white'):
    num = colors[color] if color in colors else 15
    return f'\033[38;5;{num}m{text}\033[m'

def hex2rgba(strs):
    for str in strs:
        r = int(str[:2], 16) / 255
        g = int(str[2:4], 16) / 255
        b = int(str[4:6], 16) / 255
        print(f'[{r:.3f}, {g:.3f}, {b:.3f}, 1.0]')

def show_variable(name, value):
    show = colorize(name, 'orange')
    show += colorize(' = ', 'red')
    show += colorize(value, 'yellow' if isinstance(value, str) else 'purple')
    return show
