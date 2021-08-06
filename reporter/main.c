#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>

#include "reporter.h"

void *run(void *in) {
    RKReporter *R = (RKReporter *)in;

    while (!R->connected) {
        usleep(100000);
    }
    printf("\033[38;5;203mbusy loop\033[m\n");

    const int len = 256;
    uint8_t *ray = (uint8_t *)malloc(len);
    for (int k = 0; k < len; k++) {
        ray[k] = k + 2;
    }

    while (R->wantActive) {
        RKReporterSend(R, ray, len);
        sleep(rand() % 60);
    }

    free(ray);

    return NULL;
}

int main(int argc, const char *argv[]) {

    RKReporter *hope = NULL;

    if (argc == 1) {
        hope = RKReporterInit("px1000", "localhost:8000", false);
    } else {
        hope = RKReporterInit("px1000", argv[1], false);
    }

    RKReporterStart(hope);

    pthread_t tid;
    pthread_create(&tid, NULL, run, hope);

    sleep(3600);

    printf("Stopping ...\n");

    RKReporterStop(hope);

    pthread_join(tid, NULL);

    RKReporterFree(hope);

    exit(EXIT_SUCCESS);
}
