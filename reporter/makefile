KERNEL := $(shell uname)
MACHINE := $(shell uname -m)
KERNEL_VER := $(shell uname -v)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_VER := $(shell python version.py)

CFLAGS = -std=gnu99 -O2 -Wall -Wno-unknown-pragmas -I./ -I/usr/local/include -DVERSION=\"$(PROJECT_VER)\"
LDFLAGS = -L./ -L/usr/local/lib

OBJS = common.o RKWebSocket.o
OBJS_PATH = objects
OBJS_WITH_PATH = $(addprefix $(OBJS_PATH)/, $(OBJS))

PROGS = simple dgen

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

all: showinfo radarhub.a $(PROGS)

showinfo:
	@echo "KERNEL_VER = \033[38;5;15m$(KERNEL_VER)\033[0m"
	@echo "KERNEL = \033[38;5;15m$(KERNEL)\033[0m"
	@echo "MACHINE = \033[38;5;220m$(MACHINE)\033[0m"
	@echo "GIT_BRANCH = \033[38;5;46m$(GIT_BRANCH)\033[0m"
	@echo "PROJECT_VER = \033[38;5;214m$(PROJECT_VER)\033[0m"

radarhub.a: $(OBJS_WITH_PATH)
	@echo "\033[38;5;141m$@\033[m"
	ar rvcs $@ $(OBJS_WITH_PATH)

$(OBJS_PATH):
	mkdir -p $@

$(OBJS_PATH)/%.o: %.c | $(OBJS_PATH)
	$(CC) $(CFLAGS) -I headers/ -c $< -o $@

$(PROGS): %: %.c $(OBJS_WITH_PATH)
	@echo "\033[38;5;45m$@\033[m"
	$(CC) $(CFLAGS) -o $@ $< $(OBJS_WITH_PATH) $(LDFLAGS)

clean:
	rm -f $(PROGS) *.log $(OBJS_PATH)/*.o
