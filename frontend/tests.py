import json
import radar
import pprint
import logging

from django.test import TestCase
from django.conf import settings

from .models import Sweep, Day
from common import colorize, colored_variables
from common import log_format

from . import archives, views

logger = logging.getLogger("frontend")
pp = pprint.PrettyPrinter(indent=1, depth=3, width=120, sort_dicts=False)

radar.set_logger(logger)


# Create your tests here.
class FrontendTestCase(TestCase):
    databases = list(settings.DATABASES.keys())

    def setUp(self):
        Sweep.objects.create(time="2021-01-01 01:23:45Z", name="PX", scan="E4.0")
        file = "/mnt/data/PX1000/2024/20241225/_original/PX-20241225-235939-E4.0.txz"
        data, tarinfo = radar.read(file, want_tarinfo=True)
        Sweep.objects.create(
            time="2024-12-25 23:59:39Z",
            name="PX",
            scan="E4.0",
            kind=Sweep.Kind.CF1,
            path=file,
            symbols=" ".join(list(data["products"].keys())),
            tarinfo=tarinfo,
        )
        hourly_count = ",".join(["0"] * 23) + ",1"
        Day.objects.create(date="2024-12-25", name="PX", count=1, hourly_count=hourly_count)
        level = logging.DEBUG if settings.VERBOSE > 1 else logging.INFO
        logging.basicConfig(level=level, format=log_format)

    def testHello(self):
        if settings.VERBOSE > 1:
            print("Hello")

    def testGetLocation(self):
        myname = colorize("testGetLocation", "green")
        for name in ["px1000", "raxpol", "xyz"]:
            origin = archives.location(name)
            logger.debug(f"{myname}   {colored_variables(origin)}")
            self.assertIsNotNone(origin)

    def testLoadDisplay(self):
        myname = colorize("testLoadDisplayDataBySourceString", "green")
        source = "PX-20241225-235939-E4.0-Z"
        logger.debug(f"{myname} loading a valid source string ...")
        payload = archives.load_display_data_by_source_string(source)
        self.assertIsNotNone(payload)

        source = "PX-20210101-012345-E4.0-Z"
        logger.debug(f"{myname} loading an invalid source string ...")
        payload = archives.load_display_data_by_source_string(source)
        self.assertIsNone(payload)

    def testRead(self):
        source = "PX-20241225-235939-E4.0-Z"
        data = Sweep.read(source)
        if settings.VERBOSE > 1:
            pp.pprint(data)
        self.assertIsNotNone(data)

    def testMonth(self):
        for pathway, month, expectedStatusCode in [
            ("px1000", "202412", 200),
            ("raxpol", "202413", 204),
            ("abcde", "214501", 204),
            ("xyz", "2011", 204),
        ]:
            result = archives.month("django-test", pathway, month)
            if result.status_code == 200 and settings.VERBOSE > 1:
                print(result.content)
            self.assertEqual(result.status_code, expectedStatusCode)

    def testCount(self):
        for pathway, day, expectedStatusCode in [
            ("px1000", "20241225", 200),
            ("raxpol", "20240524", 200),
            ("abcde", "20241225", 204),
            ("xyz", "20241225", 204),
        ]:
            result = archives.count("django-test", pathway, day)
            if result.status_code == 200 and settings.VERBOSE > 1:
                print(result.content)
            self.assertEqual(result.status_code, expectedStatusCode)

    def testTable(self):
        for pathway, day_hour, expectedStatusCode in [
            ("px1000", "20241225-2200", 200),
            ("px1000", "20241225-2300", 200),
            ("raxpol", "20240524-0000", 200),
            ("abcde", "20241225-23", 204),
            ("xyz", "20241225-23", 204),
        ]:
            result = archives.table("django-test", pathway, day_hour)
            if result.status_code == 200 and settings.VERBOSE > 1:
                print(result.content)
            self.assertEqual(result.status_code, expectedStatusCode)

    def testLoad(self):
        for pathway, locator, expectedStatusCode in [
            ("px1000", "20241225-235939-E4.0-Z", 200),
            ("px1000", "20241225-235939-E4.0-I", 205),
            ("px1000", "20241225-235939-E4.0-DBZ", 205),
            ("abcde", "20241225-235939-E4.0-Z", 204),
        ]:
            result = archives.load("django-test", pathway, locator)
            logger.debug(f"Received {len(result.content):,d} bytes")
            if result.status_code != 200:
                contentType = result.headers.get("Content-Type", "")
                if "text" in contentType and "utf-8" in contentType:
                    message = result.content.decode("utf-8")
                    logger.debug(colorize(message, "mint"))
            self.assertEqual(result.status_code, expectedStatusCode)

    def testLatest(self):
        for name in ["PX", "RAXPOL", "XYZ"]:
            ymd, hour = archives.latest(name)
            if name == "PX":
                self.assertIsNotNone(ymd)
                self.assertIsNotNone(hour)
            else:
                self.assertIsNone(ymd)
                self.assertIsNone(hour)
