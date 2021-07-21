import os

print('{} init {}'.format(__name__, os.getpid()))

from . import data
data.reset()
