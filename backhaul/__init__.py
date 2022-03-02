# import os

# print(f'\033[38;5;214m{__name__}\033[m init {os.getpid()}')

# print(dir())
# print(__loader__)
from . import consumers

consumers.reset()
