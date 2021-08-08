#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include <signal.h>

#include <RKWebsocket.h>

#include "common.h"

// Global variable
RKWebsocket *W = NULL;

// Local functions
static void handleSignals(int signal) {
    fprintf(stderr, "\nCaught %d\n", signal);
    RKWebsocketStop(W);
}

// The busy run loop - the reporter
void *run(void *in) {
    int j = 0;
    const int len = 32 * 1024;
    // const useconds_t s = 1000000 * 2;
    // const int len = 100;
    const useconds_t s = 1000000 / 3;
    uint8_t *blob = (uint8_t *)malloc(10 * len);

    while (!W->connected) {
        usleep(100000);
    }
    printf("\033[38;5;203mbusy loop\033[m\n");

    while (W->wantActive) {
        uint8_t *ray = &blob[j * len];
        ray[0] = 2;
        ray[1] = '-';
        ray[2] = '0' + j;
        ray[3] = '-';
        for (int k = 4; k < len; k++) {
            ray[k] = 32 + rand() % 60;
        }
        j = (j + 1) % 10;

        RKWebsocketSend(W, ray, len);
        usleep(s);
    }

    free(blob);
    return NULL;
}

void handleOpen(RKWebsocket *R) {
    char *message = (char *)malloc(64);
    int r = sprintf(message, "\1{\"radar\":\"px1000\",\"command\":\"radarConnect\"}");
    r = RKWebsocketSend(R, message, r);
    free(message);
}


int main(int argc, const char *argv[]) {
    if (argc == 1) {
        W = RKWebsocketInit("localhost:8000", "/ws/radar/px1000/", RKWebsocketSSLOff);
    } else {
        W = RKWebsocketInit(argv[1], "/ws/radar/px1000/", RKWebsocketSSLAuto);
    }
    RKWebsocketSetOpenHandler(W, &handleOpen);
    W->verbose = 2;

    // Catch Ctrl-C and some signals alternative handling
    signal(SIGINT, handleSignals);

    RKWebsocketStart(W);

    pthread_t tid;
    pthread_create(&tid, NULL, run, NULL);

    while (W->wantActive) {
        usleep(100000);
    }

    RKWebsocketFree(W);

    exit(EXIT_SUCCESS);
}
