KERNEL := $(shell uname)
MACHINE := $(shell uname -m)
KERNEL_VER := $(shell uname -v)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD)
PROJECT_VER := $(shell python version.py)

CFLAGS = -O2
CFLAGS += -std=c11
CFLAGS += -Wall
CFLAGS += -Wno-unknown-pragmas
CFLAGS += -DVERSION=\"$(PROJECT_VER)\"

ifeq ($(KERNEL), Darwin)
	# macOS
	CFLAGS += -D_DARWIN_C_SOURCE
else
	CFLAGS += -D_GNU_SOURCE
endif

ifeq ($(PREFIX), )
	ifeq ($(MACHINE), arm64)
		PREFIX = /opt/homebrew
	else
		PREFIX = /usr/local
	endif
endif

CFLAGS += -I./
CFLAGS += -I${PREFIX}/include
CFLAGS += -I${PREFIX}/opt/openssl@1.1/include

LDFLAGS += -L./
LDFLAGS += -L${PREFIX}/lib
LDFLAGS += -L${PREFIX}/opt/openssl@1.1/lib
LDFLAGS += -lm -lssl -lpthread

OBJS = common.o RKWebSocket.o
OBJS_PATH = objects
OBJS_WITH_PATH = $(addprefix $(OBJS_PATH)/, $(OBJS))

PROGS = simple dgen

all: showinfo radarhub.a $(PROGS)

showinfo:
	@echo "\
	KERNEL_VER = \033[38;5;15m$(KERNEL_VER)\033[0m\n\
	KERNEL = \033[38;5;15m$(KERNEL)\033[0m\n\
	MACHINE = \033[38;5;87m$(MACHINE)\033[0m\n\
	VERSION = \033[38;5;46m$(PROJECT_VER)\033[0m\n\
	GIT_BRANCH = \033[38;5;226m$(GIT_BRANCH)\033[0m\n\
	PREFIX = \033[38;5;214m$(PREFIX)\033[0m\n\
	OBJS = \033[38;5;213m$(OBJS)\033[0m\n\
	PROGS = \033[38;5;45m$(PROGS)\033[0m\n\
	"

radarhub.a: $(OBJS_WITH_PATH)
	@echo "\033[38;5;118m$@\033[m"
	ar rvcs $@ $(OBJS_WITH_PATH)

$(OBJS_PATH):
	@mkdir -p $@

$(OBJS_PATH)/%.o: %.c | $(OBJS_PATH)
	@echo "\033[38;5;213m$@\033[m"
	$(CC) $(CFLAGS) -I headers/ -c $< -o $@

$(PROGS): %: %.c $(OBJS_WITH_PATH)
	@echo "\033[38;5;45m$@\033[m"
	$(CC) $(CFLAGS) -o $@ $< $(OBJS_WITH_PATH) $(LDFLAGS)

clean:
	rm -f $(PROGS) *.log $(OBJS_PATH)/*.o
