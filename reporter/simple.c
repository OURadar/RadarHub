#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include <signal.h>

#include "reporter.h"

// Global variable
RKReporter *R = NULL;

// Local functions
static void handleSignals(int signal) {
    fprintf(stderr, "\nCaught %d\n", signal);
    RKReporterStop(R);
}

// The busy run loop
void *run(void *in) {
    int j = 0;
    const int len = 32 * 1024;
    // const useconds_t s = 1000000 * 2;
    // const int len = 100;
    const useconds_t s = 1000000 / 20;
    uint8_t *blob = (uint8_t *)malloc(10 * len);

    while (!R->connected) {
        usleep(100000);
    }
    printf("\033[38;5;203mbusy loop\033[m\n");

    while (R->wantActive) {
        uint8_t *ray = &blob[j * len];
        ray[0] = 2;
        ray[1] = '-';
        ray[2] = '0' + j;
        ray[3] = '-';
        for (int k = 4; k < len; k++) {
            ray[k] = 32 + rand() % 60;
        }
        j = (j + 1) % 10;

        RKReporterSend(R, ray, len);
        usleep(s);
    }

    free(blob);
    return NULL;
}

int main(int argc, const char *argv[]) {
    if (argc == 1) {
        R = RKReporterInit("px1000", "localhost:8000", false);
    } else {
        R = RKReporterInit("px1000", argv[1], false);
    }
    R->verbose = 2;

    // Catch Ctrl-C and some signals alternative handling
    signal(SIGINT, handleSignals);

    RKReporterStart(R);

    pthread_t tid;
    pthread_create(&tid, NULL, run, NULL);

    while (R->wantActive) {
        usleep(100000);
    }

    RKReporterFree(R);

    exit(EXIT_SUCCESS);
}
