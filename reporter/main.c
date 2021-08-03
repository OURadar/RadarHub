#include "reporter.h"

int main(int argc, const char *argv[]) {

    RKReporter *hope = NULL;

    if (argc == 1) {
        hope = RKReporterInit("px1000", "localhost:8000", false);
    } else {
        hope = RKReporterInit("px1000", argv[1], false);
    }

    RKReporterFree(hope);

    exit(EXIT_SUCCESS);
}
