#
#   RadarHub
#
#   Created by Boonleng Cheong
#

colors = {
    "red": 196,
    "orange": 214,
    "yellow": 228,
    "green": 154,
    "mint": 43,
    "teal": 87,
    "cyan": 14,
    "blue": 33,
    "pink": 170,
    "purple": 141,
    "white": 15,
    "gray": 239,
    "gold": 220,
    "black": 232,
    "skyblue": 45,
}

highlights = {"info": "\033[48;5;6;38;5;15m", "warning": "\033[48;5;172;38;5;15m", "error": "\033[1;48;5;3;38;5;15m"}


def colorize(text, color="white", end="\033[m"):
    if isinstance(color, int):
        return f"\033[38;5;{color}m{text}{end}"
    elif color in colors:
        num = colors[color]
        return f"\033[38;5;{num}m{text}{end}"
    elif color in highlights:
        code = highlights[color]
        return f"{code}{text}{end}"
    else:
        return text


def pretty_object_name(classname, name, origin=None):
    g = f"\033[38;5;{colors['green']}m"
    y = f"\033[38;5;{colors['gold']}m"
    p = f"\033[38;5;{colors['purple']}m"
    w = f"\033[38;5;{colors['white']}m"
    b = f"\033[38;5;{colors['cyan']}m"
    if origin is None:
        return f"{g}{classname}{y}[{p}{name}{y}]\033[m"
    return f"{g}{classname}{y}[{p}{name}{w}:{b}{origin}{y}]\033[m"


def hex2rgba(strs):
    for str in strs:
        r = int(str[:2], 16) / 255
        g = int(str[2:4], 16) / 255
        b = int(str[4:6], 16) / 255
        print(f"[{r:.3f}, {g:.3f}, {b:.3f}, 1.0]")


def color_name_value(name, value):
    show = colorize(name, "orange")
    show += colorize(" = ", "red")
    comma_len = len(colorize(", ", "red"))
    if isinstance(value, list):
        show += colorize("[", "gold")
        for v in value:
            show += colorize(f'"{v}"', "yellow" if isinstance(v, str) else "purple")
            show += colorize(", ", "red")
        show = show[:-comma_len]
        show += colorize("]", "gold")
    else:
        show += colorize(value, "yellow" if isinstance(value, str) else "purple")
    return show


def byte_string(payload):
    lower_bound = int.from_bytes(b"\x20", "big")
    upper_bound = int.from_bytes(b"\x73", "big")
    count = 0
    bound = min(25, len(payload))
    for s in bytes(payload[:bound]):
        if lower_bound <= s <= upper_bound:
            count += 1
    if len(payload) < 30:
        return f"{payload}"
    if count > bound / 2:
        return f"{payload[:25]} ... {payload[-5:]}"
    else:

        def payload_binary(payload):
            h = [f"{d:02x}" for d in payload]
            return "[." + ".".join(h) + "]"

        p = f"{payload[0:1]}"
        return p + payload_binary(payload[1:8]) + " ... " + payload_binary(payload[-3:])


def truncate_array(arr, front=3, back=3):
    if len(arr) > front + back:
        truncated = arr[:front] + ["..."] + arr[-back:]
    else:
        truncated = arr
    return truncated


def test_byte_string():
    x = b'\x03{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Time":1570804516}'
    print(byte_string(x))
    x = b"\x05\x01}\xff|\x02}\x22\x33\x44\x55\x66\x77\x00}\x00}\x02}\xfe|\x00}\x01}\x00\x22\x33\x44\x55\x01\x00"
    print(byte_string(x))


cross = colorize("✗", "red")
check = colorize("✓", "green")
ignore = colorize("✓", "yellow")
missing = colorize("✗", "orange")
processed = colorize("✓✓", "green")
