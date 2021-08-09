#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include <signal.h>

#include <RKWebsocket.h>

#include "common.h"

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
    const int len = 32 * 1024;
    // const useconds_t s = 1000000 * 2;
    // const int len = 100;
    const useconds_t s = 1000000 / 3;
    uint8_t *blob = (uint8_t *)malloc(10 * len);

    while (!R->ws->connected) {
        usleep(100000);
    }
    printf("\033[38;5;203mbusy loop\033[m\n");

    while (R->ws->wantActive) {
        uint8_t *ray = &blob[j * len];
        ray[0] = 4;
        ray[1] = '-';
        ray[2] = '0' + j;
        ray[3] = '-';
        for (int k = 4; k < len; k++) {
            ray[k] = 32 + rand() % 60;
        }
        j = (j + 1) % 10;

        RKWebsocketSend(R->ws, ray, len);
        usleep(s);
    }

    free(blob);
    return NULL;
}

void handleOpen(RKWebsocket *W) {
    int r = sprintf(R->welcome, "\1{\"radar\":\"demo\",\"command\":\"radarConnect\"}");
    RKWebsocketSend(W, R->welcome, r);
}


int main(int argc, const char *argv[]) {
    R = (RKReporter *)malloc(sizeof(RKReporter));
    memset(R, 0, sizeof(RKReporter));

    if (argc == 1) {
        R->ws = RKWebsocketInit("localhost:8000", "/ws/radar/demo/", RKWebsocketSSLOff);
    } else {
        R->ws = RKWebsocketInit(argv[1], "/ws/radar/demo/", RKWebsocketSSLAuto);
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
