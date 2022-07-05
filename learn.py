def duo(x):
    day = '20220520'
    hour = 0
    symbol = 'Z'

    # New in Python 3.10
    match x.split('-'):
        case [day]:
            hour, symbol = '0000', 'Z'
        case [day, hour]:
            symbol = 'Z'
        case [day, hour, symbol]:
            pass

    hour = int(hour[:2]) if len(hour) > 2 else int(hour)

    print(f'day = {day}   hour = {hour}  symbol = {symbol}')

#

duo('20220520')
duo('20220520-0100')
duo('20220520-0100-V')
