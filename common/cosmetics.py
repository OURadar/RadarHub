#
#   RadarHub
#
#   Created by Boonleng Cheong
#

colors = {
    'red': 196,
    'orange': 214,
    'yellow': 227,
    'green': 118,
    'mint': 43,
    'teal': 87,
    'cyan': 14,
    'blue': 33,
    'pink': 170,
    'purple': 141,
    'white': 15
}

highlights = {
    'warning': '\033[1;48;5;1;38;5;15m'
}

def colorize(text, color='white', end='\033[m'):
    if isinstance(color, int):
        return f'\033[38;5;{color}m{text}{end}'
    elif color in colors:
        num = colors[color]
        return f'\033[38;5;{num}m{text}{end}'
    elif color in highlights:
        code = highlights[color]
        return f'{code}{text}{end}'
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
