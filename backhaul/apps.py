import sys
import logging

from django.conf import settings

from django.apps import AppConfig

logger = logging.getLogger('backhaul')

class BackhaulConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'backhaul'

    def ready(self):
        prog = ' '.join(sys.argv[:3])
        if 'runworker' not in prog:
            return

        if settings.DEBUG and settings.VERBOSE:
            console = logging.StreamHandler()
            console.setFormatter(logging.Formatter('%(asctime)s %(levelname)-8s %(message)s'))
            console.setLevel(logging.DEBUG if settings.VERBOSE > 1 else logging.INFO)
            logger.addHandler(console)
            logger.setLevel(logging.DEBUG if settings.VERBOSE > 1 else logging.INFO)

        logger.debug('Resetting Backhaul consumers ...')

        from . import consumers

        consumers.reset()
