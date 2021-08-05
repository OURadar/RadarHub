#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>

#include "reporter.h"

int main(int argc, const char *argv[]) {

    RKReporter *hope = NULL;

    if (argc == 1) {
        hope = RKReporterInit("px1000", "localhost:8000", false);
    } else {
        hope = RKReporterInit("px1000", argv[1], false);
    }

    RKReporterStart(hope);

    usleep(100000);
    const int len = 150;
    uint8_t *ray = (uint8_t *)malloc(len);
    for (int k = 0; k < len; k++) {
        ray[k] = k + 2;
    }
    RKReporterSend(hope, ray, len);

    sleep(3600);

    printf("Stopping ...\n");

    RKReporterStop(hope);

    RKReporterFree(hope);

    exit(EXIT_SUCCESS);
}
