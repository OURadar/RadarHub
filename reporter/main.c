#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>

#include "reporter.h"

int main(int argc, const char *argv[]) {

    RKReporter *hope = NULL;

    // ws_frame_header h;

    // h.len = 126;
    // h.xlen_bytes[2] = 10;

    // printf("sizeof(h) = %zu\n", sizeof(h));
    // printf("h.size_16 = %u\n", h.xlen_16);
    // printf("h.size_64 = %" PRIu64 "\n", h.xlen_64);

    if (argc == 1) {
        hope = RKReporterInit("px1000", "localhost:8000", false);
    } else {
        hope = RKReporterInit("px1000", argv[1], false);
    }

    RKReporterRun(hope);

    printf("Wait for a while ...\n");
    sleep(10);

    RKReporterStop(hope);

    RKReporterFree(hope);

    exit(EXIT_SUCCESS);
}
