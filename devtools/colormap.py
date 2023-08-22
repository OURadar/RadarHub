import colorsys
import numpy as np

def fleximap(count=15, xp=None, cp=None):
    if xp is None and cp is None:
        # Color provided. This array can N x 3 for RGB or N x 4 for RGBA
        cp = [
            [0.5, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [1.0, 1.0, 1.0],
            [0.0, 0.0, 1.0],
            [0.0, 0.0, 0.5],
        ]
        # X-axis provided, the number of elements must be N
        xp = [0.0, 0.2, 0.5, 0.8, 1.0]
    # If x is not supplied
    if xp is None:
        xp = np.linspace(0.0, 1.0, len(cp))
    # If color is not supplied
    if cp is None:
        print('Supply xp and cp.')
        return None
    cp = np.array(cp, dtype=float)
    xi = np.linspace(0.0, 1.0, count)
    rgb = np.array([np.interp(xi, xp, cp[:, i]) for i in range(cp.shape[1])]).transpose((1, 0))
    return rgb

# Extended colormap for reflectivity
# s - shades / element (number of shades for blue, green, etc.)
def zmapext(s=3):
    if (s % 3):
        print('Poor choice of {} shades / element. Recommend either 30, 15, 6 or 3.'.format(s))
    count = round(6.6667 * s) + 2
    n = count - 1
    xp = np.zeros(16)
    for i in range(6):
        xp[2 * i + 1] = round(i * s + 1) / n
        xp[2 * i + 2] = round((i + 1) * s) / n
    xp[13] = round(6 * s + 1) / n
    xp[14] = round(6 * s + 0.6667 * s) / n
    xp[15] = 1.0
    cp = [
        [0.00, 0.00, 0.00, 0.0],
        [0.80, 0.60, 0.80, 1.0],    # light purple
        [0.40, 0.20, 0.40, 1.0],    # dark purple
        [0.80, 0.80, 0.60, 1.0],    # light dirty
        [0.40, 0.40, 0.40, 1.0],    # dark gray
        [0.00, 1.00, 1.00, 1.0],    # cyan
        [0.00, 0.00, 1.00, 1.0],    # dark blue
        [0.00, 1.00, 0.00, 1.0],    # light green
        [0.00, 0.50, 0.00, 1.0],    # dark green
        [1.00, 1.00, 0.00, 1.0],    # yellow
        [1.00, 0.50, 0.00, 1.0],    # orange
        [1.00, 0.00, 0.00, 1.0],    # torch red
        [0.50, 0.00, 0.00, 1.0],    # dark red
        [1.00, 0.00, 1.00, 1.0],    # magenta
        [0.56, 0.35, 1.00, 1.0],    # purple
        [1.00, 1.00, 1.00, 1.0]     # white
         ]
    return fleximap(count, xp, cp)

# Standard colormap for reflectivity
def zmapstd(s=3):
    rgba = zmapext(s)
    rgba = np.concatenate(([[0.00, 0.00, 0.00, 0.0]], rgba[2 * s + 1:,]))
    return rgba

def zmapV1():
    # The body shades starts with cyan at index 74 (75th shade)
    # color[ 74] should be (0, 1, 1) cyan at exactly 5 dBZ    (RadarKit)
    # color[104] should be (0, 1, 0) green at exactly 20 dBZ  (RadarKit)
    zero = np.zeros((4, 4))
    head = fleximap(7, [0.0, 0.5, 1.0], [[0.00, 0.00, 0.00, 0.3765],
                                         [0.25, 0.30, 0.35, 1.0000],
                                         [0.50, 0.60, 0.70, 1.0000]])
    head = np.repeat(np.expand_dims(head, axis=1), 10, axis=1).reshape(70, 4)
    body = zmapstd()[1:-1]
    body = np.repeat(np.expand_dims(body, axis=1), 10, axis=1).reshape(140, 4)
    tail = fleximap(256 - 214, [0.0, 1.0], [[1.00, 1.00, 1.00, 1.00], [0.50, 0.50, 0.50, 0.50]])
    return np.concatenate((zero, head, body, tail))

def zmapx():
    zero = np.zeros((14, 4))
    body = zmapext()[1:-1]
    body = np.repeat(np.expand_dims(body, axis=1), 10, axis=1).reshape(200, 4)
    tail = fleximap(256 - 214, [0.0, 1.0], [[1.00, 1.00, 1.00, 1.00], [0.50, 0.50, 0.50, 0.50]])
    return np.concatenate((zero, body, tail))

def zmap():
    head = fleximap(8, [0.0, 0.5, 1.0], [[0.10, 0.10, 0.10, 0.3],
                                         [0.30, 0.35, 0.40, 1.0000],
                                         [0.50, 0.60, 0.70, 1.0000]])
    head = np.repeat(np.expand_dims(head, axis=1), 10, axis=1).reshape(80, 4)[-74:, :]
    body = zmapstd()[1:-1]
    body = np.repeat(np.expand_dims(body, axis=1), 10, axis=1).reshape(140, 4)
    tail = fleximap(256 - 214, [0.0, 1.0], [[1.00, 1.00, 1.00, 1.00], [0.50, 0.50, 0.50, 0.50]])
    return np.concatenate((head, body, tail))

# Red green map for velocity
def rgmap(count=16):
    xp = [0.0, 0.3, 0.5, 0.7, 1.0]
    cp = [
        [0.00, 0.35, 0.00],
        [0.00, 0.80, 0.00],
        [0.85, 0.85, 0.85],
        [0.80, 0.00, 0.00],
        [0.35, 0.00, 0.00]
    ]
    return fleximap(count, xp, cp)

# Red green map with forced middle 3 shades
def rgmapf(count=16):
    m = count - 1
    c = np.floor(count / 2)
    xp = [0.0, (c - 2) / m, (c - 1) / m, c / m, (c + 1) / m, (c + 2) / m, 1.0]
    cp = [
        [0.00, 1.00, 0.00],
        [0.00, 0.40, 0.00],
        [0.22, 0.33, 0.22],
        [0.40, 0.40, 0.40],
        [0.33, 0.22, 0.22],
        [0.45, 0.00, 0.00],
        [1.00, 0.00, 0.00]
    ]
    return fleximap(count, xp, cp)

def vmap(count=64):
    if count < 32 or count % 2:
        print('Count should be an even number greater or equal to 32\n');
        count = 32
    xp = [0.0,                                  # Hot Magenta
        (count *  5.0 / 32 - 1) / (count - 1),  # Blue
        (count *  8.0 / 32 - 1) / (count - 1),  # Cyan
        (count * 10.0 / 32 - 1) / (count - 1),  # Light Cyan
        (count * 13.0 / 32 - 1) / (count - 1),  # Green
        (count * 15.0 / 32 - 1) / (count - 1),  # Dark Green
        (count * 15.0 / 32) / (count - 1),      # Grayish Green
        0.5,                                    # Middle
        (count * 17.0 / 32 - 1) / (count - 1),  # Grayish Red
        (count * 17.0 / 32) / (count - 1),      # Dark Red
        (count * 19.0 / 32) / (count - 1),      # Red
        (count * 22.0 / 32) / (count - 1),      # Pink
        (count * 24.0 / 32) / (count - 1),      # Light Peach
        (count * 27.0 / 32) / (count - 1),      # Dark Orange
        1.0]                                    # Dark Brown
    cp = [
        [1.00, 0.00, 0.50, 1.0],                # Magenta
        [0.00, 0.00, 0.60, 1.0],                # Blue
        [0.00, 1.00, 1.00, 1.0],                # Cyan
        [0.65, 1.00, 1.00, 1.0],                # Light Cyan
        [0.00, 1.00, 0.00, 1.0],                # Green
        [0.00, 0.40, 0.00, 1.0],                # Dark Green
        [0.35, 0.50, 0.35, 1.0],                # Grayish Green
        [0.55, 0.55, 0.55, 1.0],                # Gray
        [0.50, 0.35, 0.35, 1.0],                # Grayish Red
        [0.40, 0.00, 0.00, 1.0],                # Dark Red
        [1.00, 0.00, 0.00, 1.0],                # Red
        [1.00, 0.50, 0.70, 1.0],                # Pink
        [1.00, 0.90, 0.60, 1.0],                # Light Peach
        [1.00, 0.45, 0.25, 1.0],                # Dark Orange
        [0.30, 0.00, 0.00, 1.0]                 # Dark Brown
    ]
    rgba = fleximap(count, xp, cp)
    if (256 % count) == 0:
        n = 256 / count
        rgba = np.repeat(np.expand_dims(rgba, axis=1), n, axis=1).reshape(256, 4)
    return rgba

def wmap(s=4):
    if s % 2:
        print('Poor choice of {} shades / element. Recommend either 2, 4, 8 or 16.'.format(s))
    rgba = np.concatenate((
        fleximap(s, [0.0, 1.0], [[0.00, 1.00, 1.00, 1.00], [0.00, 0.00, 0.85, 1.00]]),
        fleximap(s, [0.0, 1.0], [[0.00, 0.50, 0.00, 1.00], [0.00, 1.00, 0.00, 1.00]]),
        fleximap(s, [0.0, 1.0], [[1.00, 1.00, 0.00, 1.00], [1.00, 0.50, 0.00, 1.00]]),
        fleximap(s, [0.0, 1.0], [[1.00, 0.00, 0.00, 1.00], [0.50, 0.00, 0.00, 1.00]]),
        fleximap(s, [0.0, 1.0], [[1.00, 0.00, 1.00, 1.00], [0.50, 0.00, 0.50, 1.00]]),
        fleximap(s, [0.0, 1.0], [[0.60, 0.22, 1.00, 1.00], [0.35, 0.11, 0.55, 1.00]])
    ))
    rgba = np.repeat(np.expand_dims(rgba, axis=1), 10, axis=1).reshape(s * 6 * 10, 4)
    tail = fleximap(256 - s * 6 * 10, [0.0, 1.0], [[0.70, 0.70, 0.70, 0.70], [0.50, 0.50, 0.50, 0.50]])
    #np.tile([0.20, 0.45, 0.60], int(s / 2)).reshape(-1, 3),
    return np.concatenate((rgba, tail))

def dmap():
    xp = [0.00,
          9.0 / 254.0,
         10.0 / 254.0,
         39.0 / 254.0,
         40.0 / 254.0,
         69.0 / 254.0,
         70.0 / 254.0,
         99.0 / 254.0,
        100.0 / 254.0,
        129.0 / 254.0,
        130.0 / 254.0,
        159.0 / 254.0,
        160.0 / 254.0,
        189.0 / 254.0,
        190.0 / 254.0,
        219.0 / 254.0,
        220.0 / 254.0,
        249.0 / 254.0,
        250.0 / 254.0,
        1.00]
    cp = [
        [0.30, 0.45, 0.50],    #
        [0.60, 0.90, 1.00],    #
        [0.45, 0.20, 0.80],    #
        [0.70, 0.40, 1.00],    #
        [0.50, 0.20, 0.35],    #
        [1.00, 0.50, 0.85],    #
        [0.70, 0.50, 0.15],    #
        [1.00, 1.00, 0.85],    #
        [1.00, 1.00, 1.00],    # 0dB
        [0.00, 0.35, 1.00],    #
        [0.10, 1.00, 0.50],    # 3dB
        [0.00, 0.50, 0.00],    #
        [1.00, 1.00, 0.00],    # 6dB
        [1.00, 0.50, 0.00],    #
        [1.00, 0.00, 0.00],    #
        [0.50, 0.00, 0.00],    #
        [1.00, 0.00, 1.00],    #
        [0.50, 0.00, 0.50],    #
        [1.00, 1.00, 1.00],    #
        [0.60, 1.00, 1.00]     #
    ]
    rgb = fleximap(51, xp, cp)
    rgb = np.repeat(np.expand_dims(rgb, axis=1), 5, axis=1).reshape(5 * 51, 3)
    rgb = np.concatenate((rgb, rgb[-1, :].reshape(1, 3)))
    rgba = np.concatenate((rgb, np.ones((256, 1))), axis=1)
    rgba[:11, 3] = 220.0 / 255.0
    rgba[-6:, 3] = 220.0 / 255.0
    return rgba

def pmap():
    rgb = zebra(64, b=4)
    rgb = np.expand_dims(rgb, axis=2)
    rgb = np.repeat(rgb, 4, axis=2).transpose((0, 2, 1)).reshape(256, 3)
    rgba = np.concatenate((rgb, np.ones((256, 1))), axis=1)
    return rgba

def rmap():
    c = 6
    lomap = fleximap(7, [0.0, 1.0], [[0.00, 0.00, 0.00, 0.00], [0.50, 0.60, 0.70, 1.0]])
    himap = np.concatenate((
        fleximap(5, [0.0, 1.0], [[0.00, 1.00, 1.00, 1.00], [0.00, 0.00, 0.85, 1.00]]),
        fleximap(5, [0.0, 1.0], [[0.00, 1.00, 0.00, 1.00], [0.00, 0.50, 0.00, 1.00]]),
        fleximap(5, [0.0, 1.0], [[1.00, 1.00, 0.00, 1.00], [1.00, 0.50, 0.00, 1.00]]),
        fleximap(5, [0.0, 1.0], [[1.00, 0.00, 0.00, 1.00], [0.50, 0.00, 0.00, 1.00]]),
        fleximap(5, [0.0, 1.0], [[1.00, 0.00, 1.00, 1.00], [0.50, 0.00, 0.50, 1.00]]),
        fleximap(5, [0.0, 1.0], [[0.60, 0.22, 1.00, 1.00], [0.35, 0.11, 0.55, 1.00]]),
        fleximap(5, [0.0, 1.0], [[0.40, 0.45, 1.00, 1.00], [0.20, 0.22, 0.60, 1.00]])
    ))
    n = 256 - c * (lomap.shape[0] + himap.shape[0])
    rgba = np.zeros((256, 4))
    rgba[n:] = np.concatenate((
        np.repeat(np.expand_dims(lomap, axis=1), c, axis=1).reshape((7 * c, 4)),
        np.repeat(np.expand_dims(himap, axis=1), c, axis=1).reshape((5 * 7 * c, 4))
    ))
    return rgba

def kmap():
    # Four bands in the middle, two tail ends
    s = 10
    t = int((256 - 6 * s * 4) / 4 / 2 + s)
    rgba = np.concatenate((
        fleximap(t, [0.0, 1.0], [[0.35, 0.15, 0.60, 1.00], [0.75, 0.45, 1.00, 1.00]]),
        fleximap(s, [0.0, 1.0], [[0.50, 0.20, 0.35, 1.00], [1.00, 0.50, 0.85, 1.00]]),
        fleximap(s, [0.0, 1.0], [[0.70, 0.50, 0.15, 1.00], [1.00, 1.00, 0.85, 1.00]]),
        fleximap(s, [0.0, 1.0], [[1.00, 1.00, 1.00, 1.00], [0.00, 0.35, 1.00, 1.00]]),
        fleximap(s, [0.0, 1.0], [[0.20, 1.00, 0.00, 1.00], [0.00, 0.50, 0.00, 1.00]]),
        fleximap(t, [0.0, 1.0], [[0.40, 0.45, 1.00, 1.00], [0.20, 0.22, 0.60, 1.00]])
    ))
    # Repeat each color 4 times
    rgba = np.repeat(np.expand_dims(rgba, axis=1), 4, axis=1).reshape(256, 4)
    return rgba

def imap():
    rgb = np.array([
        [0.45, 0.41, 0.28],
        [0.00, 0.75, 1.00],
        [0.00, 1.00, 0.00],
        [0.75, 0.75, 0.75],
        [1.00, 0.00, 0.00],
        [1.00, 0.60, 0.00],
        [0.40, 0.15, 1.00],
        [0.70, 0.15, 0.80]
    ])
    return rgb

def i2map():
    rgb = np.array([
        [1.00, 0.00, 0.00],
        [0.00, 0.50, 1.00]
    ])
    return rgb

def i5map():
    rgba = np.array([
        [0.10, 0.10, 0.10, 0.00],
        [0.00, 0.70, 1.00, 1.00],
        [0.00, 1.00, 0.00, 1.00],
        [0.70, 0.70, 0.70, 1.00],
        [1.00, 0.00, 0.00, 1.00],
        [1.00, 0.70, 0.00, 1.00],
    ])
    s = 256 // rgba.shape[0]
    h = int((256 - (rgba.shape[0] - 1) * s))
    rgba = np.concatenate((
        np.repeat(np.expand_dims(rgba[0], axis=0), h, axis=0),
        np.repeat(np.expand_dims(rgba[1], axis=0), s, axis=0),
        np.repeat(np.expand_dims(rgba[2], axis=0), s, axis=0),
        np.repeat(np.expand_dims(rgba[3], axis=0), s, axis=0),
        np.repeat(np.expand_dims(rgba[4], axis=0), s, axis=0),
        np.repeat(np.expand_dims(rgba[5], axis=0), s, axis=0)
    ))
    return rgba

# From reference:
# Hooker, S. B. et al, Detecting Dipole Ring Separatrices with Zebra
# Palettes, IEEE Transactions on Geosciences and Remote Sensing, vol. 33,
# 1306-1312, 1995
def zebra(n=256, b=4, m=0.5):
    x = np.arange(n)
    saw = np.mod(b * x, b)
    hue = 0.999 * np.exp(-3.0 * x / (n - 1))
    sat = m + (1.0 - m) * 0.5 * (1.0 + saw / (b - 1.0))
    val = m + (1.0 - m) * 0.5 * (1.0 + np.cos(4.0 * b * np.pi * x / n))
    return [colorsys.hsv_to_rgb(h, s, v) for h, s, v in zip(hue, sat, val)]

# RadarScope

def rsz():
    def z2i(v):
        return np.floor(v * 2 + 64) / 255.0
    xp = [0, z2i(-15), z2i(-5), z2i(10), z2i(17.5), z2i(20), z2i(27.0), z2i(32), z2i(39.5),
      z2i(40), z2i(49.5), z2i(50), z2i(59.5), z2i(60), z2i(69.5), z2i(70), z2i(79.5), z2i(80), z2i(89.5), z2i(90),
      1]
    cp = [
        [0.3725, 0.2118, 0.6118, 1.0],  # -32 dB    purple
        [0.4157, 0.4039, 0.2078, 1.0],  # -15 dB    dark dirt
        [0.6392, 0.6471, 0.5333, 1.0],  #  -5 dB    light dirt
        [0.1647, 0.2431, 0.4431, 1.0],  #  10 dB    dark blue
        [0.298 , 0.549 , 0.6196, 1.0],  #  17.5 dB  light blue
        [0.1647, 0.6745, 0.2392, 1.0],  #  20.0 dB  green
        [0.0627, 0.3294, 0.0392, 1.0],  #  27.0 dB  dark green
        [0.9882, 1.    , 0.0392, 1.0],  #  32.0 dB  yellow
        [0.7216, 0.651 , 0.0275, 1.0],  #  39.5 dB  dark yellow
        [0.9647, 0.5059, 0.0314, 1.0],  #  40.0 dB  orange
        [0.6314, 0.2706, 0.051 , 1.0],  #  49.5 dB  dark orange
        [0.9569, 0.    , 0.051 , 1.0],  #  50.0 dB  red
        [0.4275, 0.1059, 0.098 , 1.0],  #  59.5 dB  dark red
        [0.7412, 0.5216, 0.6471, 1.0],  #  60.0 dB  pink
        [0.698 , 0.    , 0.3725, 1.0],  #  69.5 dB  hot pink
        [0.5255, 0.    , 0.8471, 1.0],  #  70.0 dB  purple
        [0.1804, 0.    , 0.4745, 1.0],  #  79.5 dB  dark purple
        [0.4627, 1.    , 1.    , 1.0],  #  80.0 dB  cyan
        [0.2118, 0.3843, 0.4863, 1.0],  #  89.5 dB  dark cyan
        [0.5569, 0.3176, 0.2235, 1.0],  #  90.0 dB  brown
        [0.3686, 0.    , 0.0078, 1.0]   #           dark brown
    ]
    return fleximap(256, xp, cp)

def rsd():
    def d2i(v):
        return np.floor(v * 10 + 100) / 255.0
    xp = [0, d2i(-4), d2i(0), d2i(0.5), d2i(1.0), d2i(1.5), d2i(2.0), d2i(2.5), d2i(3), d2i(4), d2i(5), d2i(6), d2i(8), 1]
    cp = [
        [0.0   , 0.0   , 0.0   , 0.0],  # -X dB    black
        [0.0   , 0.0   , 0.0   , 1.0],  # -4 dB    black
        [0.7412, 0.7412, 0.7412, 1.0],  # 0        gray
        [0.    , 0.    , 0.5255, 1.0],  # 0.5      dark blue
        [0.1255, 0.5216, 0.7882, 1.0],  # 1.0
        [0.251 , 1.    , 0.7843, 1.0],  # 1.5      cyan
        [0.298 , 0.8471, 0.2706, 1.0],  # 2.0      green
        [1.    , 1.    , 0.3059, 1.0],  # 2.5      yellow
        [0.9922, 0.5412, 0.2235, 1.0],  # 3.0      orange
        [0.8392, 0.    , 0.051 , 1.0],  # 4.0      red
        [0.6118, 0.    , 0.0118, 1.0],  # 5.0      dark red
        [0.9255, 0.3725, 0.6392, 1.0],  # 6.0      pink
        [1.0   , 1.    , 1.    , 1. ],  # 8.0      white
        [1.    , 1.    , 1.    , 0.0]   #          white
    ]
    return fleximap(256, xp, cp)

def rsr():
    def r2i(v):
        if v > 0.93:
            return np.round(v * 1000. - 824.) / 255.
        elif v > 0.7:
            return np.round(v * 300. - 173.) / 255.
        return np.round(v * 52.8751) / 255.
    xp = [0, r2i(0.2), r2i(0.455), r2i(0.66), r2i(0.72), r2i(0.8), r2i(0.85), r2i(0.9), r2i(0.95), r2i(0.97), r2i(0.99), r2i(1.05), 1]
    cp = [
        [0.0   , 0.0   , 0.0   , 1.0],  # < 0.2    black
        [0.0   , 0.0   , 0.0   , 1.0],  # 0.2      black
        [0.5137, 0.5059, 0.5412, 1.0],  # 0.455    gray
        [0.0706, 0.    , 0.4745, 1. ],  # 0.66     dark blue
        [0.0196, 0.    , 0.8157, 1. ],  # 0.72     blue
        [0.4627, 0.4392, 0.8   , 1. ],  # 0.80     light blue
        [0.3255, 1.    , 0.2784, 1. ],  # 0.85     green
        [0.5098, 0.7843, 0.0275, 1. ],  # 0.90     dark green
        [0.9961, 0.7255, 0.0353, 1. ],  # 0.95     yellow
        [0.8941, 0.    , 0.0235, 1. ],  # 0.97     red
        [0.5137, 0.    , 0.2667, 1. ],  # 0.99     dark pink red
        [1.    , 1.    , 1.    , 1. ],  # 1.       white
        [1.0   , 1.    , 1.    , 0. ],  # 1.05     white
    ]
    return fleximap(256, xp, cp)
