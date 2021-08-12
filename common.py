def colorize(text, color):
    colors = {
        'red': 9,
        'orange': 214,
        'yellow': 227,
        'green': 154,
        'teal': 87,
        'blue': 33,
        'pink': 170,
        'purple': 134,
    }
    num = colors[color] if color in colors else 15
    return f'\033[38;5;{num}m{text}\033[m'
