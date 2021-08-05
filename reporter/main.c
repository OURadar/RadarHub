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

    printf("Wait for a while ...\n");
    
    sleep(3600);

    printf("Stopping ...\n");

    RKReporterStop(hope);

    RKReporterFree(hope);

    exit(EXIT_SUCCESS);
}
