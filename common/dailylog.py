import os
import time
import logging
import traceback

logging.Formatter.converter = time.localtime


# Adopted from
# https://stackoverflow.com/questions/58590731/how-to-indent-multiline-message-printed-by-python-loggerclass MultiLineFormatter(logging.Formatter):
class MultiLineFormatter(logging.Formatter):
    def get_header_length(self, record):
        return len(
            super().format(
                logging.LogRecord(
                    name=record.name,
                    level=record.levelno,
                    pathname=record.pathname,
                    lineno=record.lineno,
                    msg="",
                    args=(),
                    exc_info=None,
                )
            )
        )

    def format(self, record):
        indent = " " * self.get_header_length(record)
        head, *trailing = super().format(record).splitlines(True)
        return head + "".join(indent + line for line in trailing)


class Logger(logging.Logger):
    def __init__(self, name, home=os.path.expanduser("~/logs"), dailyfile=True):
        super(Logger, self).__init__(name)
        self.home = home
        self.dailyfile = dailyfile
        self.time = time.localtime(time.time())
        self.day = self.time.tm_mday
        if dailyfile:
            self.formatter = MultiLineFormatter("%(asctime)s : %(message)s", datefmt=r"%H:%M:%S")
        else:
            self.formatter = MultiLineFormatter("%(asctime)s : %(message)s", datefmt=r"%y/%m/%d %H:%M:%S")
        self.init = False
        handler = logging.StreamHandler()
        handler.setFormatter(self.formatter)
        handler.setLevel(logging.DEBUG)
        self.streamHandler = handler
        self.addHandler(handler)
        self.setLevel(logging.INFO)
        self.refresh()
        self.init = True
        # print(f'self.level = {self.level}')

    def refresh(self):
        if self.init and not self.dailyfile:
            return
        for h in self.handlers:
            if isinstance(h, logging.FileHandler):
                self.removeHandler(h)
        postfix = time.strftime(r"-%Y%m%d", self.time) if self.dailyfile else ""
        logfile = f"{self.home}/{self.name}{postfix}.log"
        fileHandler = logging.FileHandler(logfile, "a")
        fileHandler.setLevel(logging.DEBUG)
        fileHandler.setFormatter(self.formatter)
        self.addHandler(fileHandler)

    def showLogOnScreen(self):
        self.streamHandler.setLevel(self.level)

    def hideLogOnScreen(self):
        self.streamHandler.setLevel(logging.WARNING)

    def check(self):
        self.time = time.localtime(time.time())
        if self.day == self.time.tm_mday:
            return
        self.day = self.time.tm_mday
        self.refresh()

    def info(self, message, *args, **kwargs):
        self.check()
        super(Logger, self).info(message, *args, **kwargs)

    def traceback(self, ex):
        for line in traceback.format_exception(ex.__class__, ex, ex.__traceback__):
            if "\n" in line:
                sublines = line.split("\n")
                for subline in sublines:
                    self.error(subline.rstrip("\n"))
            else:
                self.error(line)

    def indent(self):
        return self.formatter.get_header_length(
            logging.LogRecord(name=self.name, level=self.level, pathname=self.home, lineno=0, msg="", args=(), exc_info=None)
        )


##

if __name__ == "__main__":

    logger = Logger("dailylog")

    # logger.setLevel(logging.DEBUG)
    # logger.showLogOnScreen()

    logger.info("===")
    logger.debug("debug message")
    logger.info("info message")
    logger.warning("warning message")
    logger.error("error message")
    logger.critical("critical message")
