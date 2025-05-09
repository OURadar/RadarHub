import os
import sys

from .cosmetics import *
from .dailylog import *
from .fifobuffer import *
from .network import *
from .sanity import *

__prog__ = os.path.basename(sys.argv[0])


def get_logger():
    return Logger(__prog__.split(".")[0] if "." in __prog__ else __prog__)
