import os
import time
import logging

home = os.path.expanduser('~/log')
logging.Formatter.converter = time.localtime
formatter = logging.Formatter('%(asctime)s : %(message)s', datefmt='%H:%M:%S')

class Logger(logging.Logger):
    def __init__(self, name, home=os.path.expanduser('~/logs')):
        super(Logger, self).__init__(name)
        self.home = home
        self.time = time.localtime(time.time())
        self.day = self.time.tm_mday
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)
        handler.setLevel(logging.CRITICAL)
        self.addHandler(handler)
        self.setLevel(logging.INFO)
        self.refresh()
        # print(f'self.level = {self.level}')

    def refresh(self):
        date = time.strftime('%Y%m%d', self.time)
        logfile = f'{self.home}/{self.name}-{date}.log'
        fileHandler = logging.FileHandler(logfile, 'a')
        fileHandler.setLevel(logging.DEBUG)
        fileHandler.setFormatter(formatter)
        for h in self.handlers:
            if isinstance(h, logging.FileHandler):
                self.removeHandler(h)
        self.addHandler(fileHandler)

    def showLogOnScreen(self):
        for h in self.handlers:
            if isinstance(h, logging.StreamHandler):
                h.setLevel(self.level)

    def check(self):
        self.time = time.localtime(time.time())
        if self.day == self.time.tm_mday:
            return
        self.day = self.time.tm_mday
        self.refresh()

    def info(self, message, *args, **kwargs):
        self.check()
        super(Logger, self).info(message, *args, **kwargs)

##

if __name__ == '__main__':

    logger = DailyLogger('radarhub')

    # logger.setLevel(logging.DEBUG)
    # logger.showLogOnScreen()

    logger.info('===')
    logger.debug('debug message')
    logger.info('info message')
    logger.warning('warning message')
    logger.error('error message')
    logger.critical('critical message')
