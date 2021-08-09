#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include <signal.h>

#include <RKWebsocket.h>

#include "common.h"

#define RADAR "rose"

typedef struct _reporter {
    RKWebsocket      *ws;
    char             welcome[256];
} RKReporter;

// Global variable
RKReporter *R;

// Local functions
static void handleSignals(int signal) {
    fprintf(stderr, "\nCaught %d\n", signal);
    RKWebsocketStop(R->ws);
}

// The busy run loop - the reporter
void *run(void *in) {
    int j = 0;
    const int len = 32 * 1024 + 1;
    const useconds_t s = 1000000 / 10;
    uint8_t *blob = (uint8_t *)malloc(10 * len);

    while (!R->ws->connected) {
        usleep(100000);
    }
    printf("\033[38;5;203mbusy loop\033[m\n");

    uint8_t *payload = blob;
    for (int k = 0; k < 10 * len; k++) {
        payload[k] = rand();
        // payload[k] = rand();
    }

    while (R->ws->wantActive) {
        uint8_t *payload = &blob[j * len];
        payload[0] = '\5';
        payload[1] = '-';
        payload[2] = '0' + j;
        payload[3] = '-';
        j = (j + 1) % 10;

        RKWebsocketSend(R->ws, payload, len);
        usleep(s);
    }

    free(blob);
    return NULL;
}

void handleOpen(RKWebsocket *W) {
    int r = sprintf(R->welcome, "\1{\"radar\":\"" RADAR "\",\"command\":\"radarConnect\"}");
    RKWebsocketSend(W, R->welcome, r);
}


int main(int argc, const char *argv[]) {
    R = (RKReporter *)malloc(sizeof(RKReporter));
    memset(R, 0, sizeof(RKReporter));

    if (argc == 1) {
        R->ws = RKWebsocketInit("localhost:8000", "/ws/radar/" RADAR "/", RKWebsocketSSLOff);
    } else {
        R->ws = RKWebsocketInit(argv[1], "/ws/radar/" RADAR "/", RKWebsocketSSLAuto);
    }

    RKWebsocketSetOpenHandler(R->ws, &handleOpen);
    R->ws->verbose = 2;

    // Catch Ctrl-C and some signals alternative handling
    signal(SIGINT, handleSignals);

    RKWebsocketStart(R->ws);

    RKWebsocketWait(R->ws);

    pthread_t tid;
    pthread_create(&tid, NULL, run, NULL);

    while (R->ws->wantActive) {
        usleep(100000);
    }

    RKWebsocketFree(R->ws);

    free(R);

    exit(EXIT_SUCCESS);
}
