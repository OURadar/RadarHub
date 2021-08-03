KERNEL := $(shell uname)
MACHINE := $(shell uname -m)
KERNEL_VER := $(shell uname -v)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)

CFLAGS = -std=gnu99 -O2 -I/usr/local/include -I/usr/local/Cellar/openssl@1.1/1.1.1k/include

CFLAGS += -Wall -Wno-unknown-pragmas

LDFLAGS = -L./ -L/usr/local/lib -L/usr/local/Cellar/openssl@1.1/1.1.1k/lib

PROGS = reporter

# The command echo from macOS and Ubuntu needs no -e
ECHO_FLAG = -e
ifneq (, $(findstring Darwin, $(KERNEL_VER)))
	ECHO_FLAG =
endif
ifneq (, $(findstring Ubuntu, $(KERNEL_VER)))
	ECHO_FLAG =
endif

ifeq ($(KERNEL), Darwin)
	# macOS
	CC = clang
	CFLAGS += -D_DARWIN_C_SOURCE -Wno-deprecated-declarations
	LDFLAGS += -lssl
else
	# Old Debian
	ifeq ($(MACHINE), i686)
		CFLAGS += -D_GNU_SOURCE -D_EXPLICIT_INTRINSIC -msse -msse2 -msse3 -msse4 -msse4.1
		LDFLAGS += -L /usr/lib64
	else
		CFLAGS += -D_GNU_SOURCE
		LDFLAGS += -L /usr/lib64
	endif
endif

LDFLAGS += -lm

$(PROGS): %: %.c
ifeq ($(KERNEL), Darwin)
	@echo "\033[38;5;45m$@\033[m"
else
	@echo $(ECHO_FLAG) "\033[38;5;45m$@\033[m"
endif
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)


clean:
	rm -f $(PROGS) *.log
