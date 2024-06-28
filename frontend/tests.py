from django.test import TestCase

# from .models import Sweep
from . import archives


# Create your tests here.
class LocationTest(TestCase):
    def setUp(self):
        origin = archives.location("px1000")
        print(f"origin = {origin}")
        self.assertIsNotNone(origin)
