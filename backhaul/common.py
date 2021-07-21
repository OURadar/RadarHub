def hex2rgba(strs):
    for str in strs:
        r = int(str[:2], 16) / 255
        g = int(str[2:4], 16) / 255
        b = int(str[4:6], 16) / 255
        print('[{:.3f}, {:.3f}, {:.3f}, 1.0]'.format(r, g, b))
