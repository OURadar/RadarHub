#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include <signal.h>

#include "types.h"
#include "common.h"
#include "RKWebSocket.h"

#define RADAR "rose"

typedef struct _reporter {
    RKWebSocket      *ws;
    char             welcome[256];
    bool             wantActive;
    bool             connected;
} RKReporter;

// Global variable
RKReporter *R;

// Local functions
static void handleSignals(int signal) {
    fprintf(stderr, "\nCaught %d\n", signal);
    R->wantActive = false;
}

// The busy run loop - the reporter
void *run(void *in) {
    int j = 0;
    const int len = 32 * 1024 + 1;
    const useconds_t s = 1000000 / 3;
    uint8_t *blob = (uint8_t *)malloc(10 * len);

    // Some random numbers
    uint8_t *payload = blob;
    for (int k = 0; k < 10 * len; k++) {
        payload[k] = rand();
    }
    for (int j = 0; j < 10; j++) {
        uint8_t *payload = &blob[j * len];
        payload[0] = RadarHubTypeScope;
        payload[1] = '-';
        payload[2] = '0' + j;
        payload[3] = '-';
    }

    // Wait until the welcome message is received
    while (!R->connected) {
        usleep(100000);
    }
    printf("\033[38;5;203mBusy run loop\033[m\n");

    while (R->wantActive) {
        uint8_t *payload = &blob[j * len];
        j = (j + 1) % 10;

        RKWebSocketSend(R->ws, payload, len);
        usleep(s);
    }

    free(blob);
    return NULL;
}

void handleOpen(RKWebSocket *W) {
    int r = sprintf(R->welcome, "\1{\"radar\":\"" RADAR "\",\"command\":\"radarConnect\"}");
    RKWebSocketSend(W, R->welcome, r);
}

void handleMessage(RKWebSocket *W, void *payload, size_t size) {
    // printf("message = %s\n", (char *)payload);
    if (strstr(payload, "Welcome")) {
        R->connected = true;
    }
}

int main(int argc, const char *argv[]) {
    R = (RKReporter *)malloc(sizeof(RKReporter));
    memset(R, 0, sizeof(RKReporter));
    R->wantActive = true;

    if (argc == 1) {
        R->ws = RKWebSocketInit("localhost:8000", "/ws/radar/" RADAR "/", RKWebSocketFlagSSLOff);
    } else {
        R->ws = RKWebSocketInit(argv[1], "/ws/radar/" RADAR "/", RKWebSocketFlagSSLAuto);
    }

    RKWebSocketSetOpenHandler(R->ws, &handleOpen);
    RKWebSocketSetMessageHandler(R->ws, &handleMessage);
    R->ws->verbose = 2;

    // Catch Ctrl-C and some signals alternative handling
    signal(SIGINT, handleSignals);

    RKWebSocketStart(R->ws);

    pthread_t tid;
    pthread_create(&tid, NULL, run, NULL);

    while (R->wantActive) {
        usleep(100000);
    }

    RKWebSocketStop(R->ws);
    RKWebSocketFree(R->ws);

    free(R);

    exit(EXIT_SUCCESS);
}
