import time

def is_valid_time(time_string):
    if len(time_string) == 8:
        try:
            time.strptime(time_string, r'%Y%m%d')
            return True
        except:
            return False
    elif len(time_string) == 13:
        try:
            time.strptime(time_string, r'%Y%m%d-%H%M')
            return True
        except:
            return False
    elif len(time_string) == 15:
        try:
            time.strptime(time_string, r'%Y%m%d-%H%M%S')
            return True
        except:
            return False
    return False
