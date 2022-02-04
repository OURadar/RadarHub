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
    'mint': 43,
    'teal': 87,
    'cyan': 14,
    'blue': 33,
    'pink': 170,
    'purple': 134,
    'white': 15
}

def colorize(text, color='white'):

    if isinstance(color, int):
        return f'\033[38;5;{color}m{text}\033[m'
    elif color in colors:
        num = colors[color]
        return f'\033[38;5;{num}m{text}\033[m'
    else:
        return text

def hex2rgba(strs):
    for str in strs:
        r = int(str[:2], 16) / 255
        g = int(str[2:4], 16) / 255
        b = int(str[4:6], 16) / 255
        print(f'[{r:.3f}, {g:.3f}, {b:.3f}, 1.0]')

def color_name_value(name, value):
    show = colorize(name, 'orange')
    show += colorize(' = ', 'red')
    show += colorize(value, 'yellow' if isinstance(value, str) else 'purple')
    return show
