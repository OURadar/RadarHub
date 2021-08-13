KERNEL := $(shell uname)
MACHINE := $(shell uname -m)
KERNEL_VER := $(shell uname -v)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_VER := $(shell python version.py)

CFLAGS = -std=gnu99 -O2 -Wall -Wno-unknown-pragmas -I./ -I/usr/local/include -DVERSION=\"$(PROJECT_VER)\"
LDFLAGS = -L./ -L/usr/local/lib

OBJS = common.o RKWebsocket.o
OBJS_PATH = objects
OBJS_WITH_PATH = $(addprefix $(OBJS_PATH)/, $(OBJS))

PROGS = simple dgen

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
	CC = clang -o myTool-x86_64 -arch x86_64
	CFLAGS += -I/usr/local/opt/openssl@1.1/include -D_DARWIN_C_SOURCE -Wno-deprecated-declarations
	LDFLAGS += -L/usr/local/opt/openssl@1.1/lib
else
	CFLAGS += -D_GNU_SOURCE
	LDFLAGS += -L /usr/lib64
endif

LDFLAGS += -lm -lssl -lpthread

all: showinfo $(PROGS)

showinfo:
	@echo $(ECHO_FLAG) "KERNEL_VER = \033[38;5;15m$(KERNEL_VER)\033[0m"
	@echo $(ECHO_FLAG) "KERNEL = \033[38;5;15m$(KERNEL)\033[0m"
	@echo $(ECHO_FLAG) "MACHINE = \033[38;5;220m$(MACHINE)\033[0m"
	@echo $(ECHO_FLAG) "GIT_BRANCH = \033[38;5;46m$(GIT_BRANCH)\033[0m"
	@echo $(ECHO_FLAG) "PROJECT_VER = \033[38;5;214m$(PROJECT_VER)\033[0m"

$(OBJS_PATH):
	mkdir -p $@

$(OBJS_PATH)/%.o: %.c | $(OBJS_PATH)
	$(CC) $(CFLAGS) -I headers/ -c $< -o $@

$(PROGS): %: %.c $(OBJS_WITH_PATH)
ifeq ($(KERNEL), Darwin)
	@echo "\033[38;5;45m$@\033[m"
else
	@echo $(ECHO_FLAG) "\033[38;5;45m$@\033[m"
endif
	$(CC) $(CFLAGS) -o $@ $< $(OBJS_WITH_PATH) $(LDFLAGS)

clean:
	rm -f $(PROGS) *.log $(OBJS_PATH)/*.o
