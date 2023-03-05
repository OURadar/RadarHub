import os

from cosmetics import byte_string

x = b'\x03{"Transceiver":{"Value":true,"Enum":0}, "Pedestal":{"Value":true,"Enum":0}, "Time":1570804516}'

print(byte_string(x))

x = b'\x05\x01}\xff|\x02}\x22\x33\x44\x55\x66\x77\x00}\x00}\x02}\xfe|\x00}\x01}\x00\x22\x33\x44\x55\x01\x00'

print(byte_string(x))
