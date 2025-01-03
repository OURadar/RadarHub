#
#   RadarHub
#
#   Created by Boonleng Cheong
#

import inspect

from pathlib import Path

colors = {
    "red": 197,
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
highlights = {
    "info": "\033[48;5;6;38;5;15m",
    "warning": "\033[48;5;172;38;5;15m",
    "error": "\033[1;48;5;3;38;5;15m",
}
log_format = "%(asctime)s %(levelname)-7s %(message)s"
log_indent = " " * 32


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

    def color_value(value):
        if isinstance(value, list):
            show = colorize("[", "gold")
            for v in value:
                show += color_value(v)
                show += colorize(", ", "white")
            show = show[:-comma_len]
            show += colorize("]", "gold")
            return show
        elif isinstance(value, dict):
            show = colorize("{", "gold")
            for k, v in value.items():
                show += colorize(f"{k}", "yellow")
                show += colorize(": ", "white")
                show += color_value(v)
                show += colorize(", ", "white")
            show = show[:-comma_len]
            show += colorize("}", "gold")
            return show
        elif isinstance(value, int) or isinstance(value, float) or value is None:
            return colorize(f"{value}", "purple")
        elif isinstance(value, str) or isinstance(value, Path):
            return colorize(f"{value}", "yellow")
        else:
            return colorize(f"{value}", "cyan")

    show += color_value(value)
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


#
# colored_variables(*vars, **kwargs)
#
# Inspired by:
# https://stackoverflow.com/questions/2749796/how-to-get-the-original-variable-name-of-variable-passed-to-a-function
#
def colored_variables(*vars, **kwargs):
    """
    Print the variable names and values in color.

    Limitation: This is a hack and does not work when there are multiple parentheses in the same line.
    """
    sep = kwargs.get("sep", "   ")
    frame = inspect.currentframe()
    frame = inspect.getouterframes(frame)[1]
    string = inspect.getframeinfo(frame[0]).code_context[0].strip()
    source = string[string.rfind("(") + 1 : string.find(")")]
    names = source.split(",")
    text = []
    for name, value in zip(names, vars):
        if "=" in name:
            continue
        text.append(color_name_value(name.strip(), value))
    return sep.join(text)


if __name__ == "__main__":
    a = 1
    b = "hello"
    c = [1, 2, 3]
    myname = colorize("main()", "green")
    x = colored_variables(a, b, c, sep="   ")
    print(f"{myname}   {x}")

    print(f"{myname}   {colored_variables(a, b, c, sep='   ')}")
