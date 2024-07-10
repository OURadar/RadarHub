import os
import re
import sys
import logging

from django.apps import AppConfig
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from common import color_name_value
from common.cosmetics import colorize
from common.dailylog import MultiLineFormatter

logger = logging.getLogger("frontend")

worker_started = False


class FrontendConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "frontend"

    def ready(self):
        prog = " ".join(sys.argv[:3])
        if "runserver" not in prog and "daphne" not in prog:
            return

        # Django 5 discourages access of database in ready() method
        # if not tablesExist():
        #     return

        root_logger = logging.getLogger()
        if len(root_logger.handlers):
            for h in root_logger.handlers:
                h.setFormatter(MultiLineFormatter("%(asctime)s %(levelname)-8s %(message)s"))
                h.setLevel(logging.DEBUG if settings.VERBOSE > 1 else logging.INFO)
        elif settings.DEBUG and settings.VERBOSE:
            h = logging.StreamHandler()
            h.setFormatter(MultiLineFormatter("%(levelname)-8s %(message)s"))
            logger.addHandler(h)
            logger.setLevel(logging.DEBUG if settings.VERBOSE > 1 else logging.INFO)

        if "daphne" in prog:
            prog = "daphne " + " ".join(sys.argv[1:6])

        # Look for RUN_MAIN == "true" in development mode. Otherwise, it should None
        run_main = os.environ.get("RUN_MAIN", None)
        show = colorize(prog, "teal")
        show += "   " + color_name_value("run_main", run_main)
        logger.info(show)
        if "runserver" in prog and run_main is None:
            return

        show = color_name_value("DEBUG", settings.DEBUG)
        show += "   " + color_name_value("SIMULATE", settings.SIMULATE)
        show += "   " + color_name_value("VERBOSE", settings.VERBOSE)
        logger.info(show)

        if "data" in settings.DATABASES and "postgresql" in settings.DATABASES["data"]["ENGINE"]:
            logger.info("Using 🐘 \033[48;5;25;38;5;15m PostgreSQL \033[m ...")
        else:
            logger.info("Using 🪶 \033[48;5;29;38;5;15m SQLite \033[m ...")

        if "django-insecure" not in settings.SECRET_KEY:
            logger.info("Using 🔒 \033[48;5;22;38;5;15m settings.json \033[m secret key ...")
        else:
            logger.info("Using 🔓 \033[48;5;88;38;5;15m insecure \033[m secret key ...")

        global worker_started
        if worker_started:
            show = color_name_value("worker_started", worker_started)
            logger.info(f"Already has a worker   {show}")
            return
        worker_started = True

        if "daphne" in prog:
            tid = re.search(r"(?<=/daphne)[0-9]{1,2}(?=.sock)", prog)
            bail = tid[0] != "0" if tid else False
            if bail:
                return

        # Check map assets
        if not os.path.exists("frontend/static/maps"):
            file_dst = "~maps.tgz"
            if not os.path.exists(file_dst):
                logger.info("No map assets. Retrieving from RadarHub ...")
                import urllib

                file_url = "https://radarhub.arrc.ou.edu/static/maps.tgz"
                urllib.request.urlretrieve(file_url, file_dst)
            if not os.path.exists(file_dst):
                raise ImproperlyConfigured("Unable to continue")
            logger.info("Extracting maps ...")
            import tarfile

            with tarfile.open(file_dst) as aid:
                aid.extractall("frontend/static/")
            os.remove(file_dst)

        from . import monitor

        monitor.launch(sender=self)
