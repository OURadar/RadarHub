import os
import sys
import time
import glob
import argparse
import textwrap

__prog__ = os.path.basename(sys.argv[0])
__version__ = "1.0"
prefix_radar = {"PX": "PX1000", "PX10K": "PX10k", "RAXPOL": "RaXPol"}

#


def is_valid_daytime(time_string):
    try:
        time.strptime(time_string, r"%Y%m%d")
        return True
    except:
        return False


def upload(source="/data/moment", target="/mnt/data", user="radarhub", host="dcv01", verbose=1):
    user_host = (f"{user}@{host}:" if user else f"{host}:") if host else ""
    if verbose > 1:
        print(f"user_host = {user_host}")
    data_folders = sorted(glob.glob(os.path.join(source, "20*")))
    for folder in data_folders:
        print("...")
        _, yyyymmdd = os.path.split(folder)
        if verbose > 1:
            print(f"folder = {folder} -> yyyymmdd = {yyyymmdd}")
        pattern = os.path.join(folder, "[A-Z]*.tar.xz")
        if verbose > 1:
            print(f"prefix_finder = {pattern}")
        files = sorted(glob.glob(pattern))
        if len(files):
            prefix = os.path.basename(files[0]).split("-")[0]
            radar = prefix_radar[prefix] if prefix in prefix_radar else "Unknown"
        else:
            continue
        if not is_valid_daytime(yyyymmdd):
            print(f"ERROR: Invalid day folder {yyyymmdd}")
        yyyy = yyyymmdd[:4]
        source_pattern = f"{folder}/{prefix}-*.tar.xz"
        target_pattern = f"{user_host}{target}/{radar}/{yyyy}/{yyyymmdd}/_original/"
        cmd = f"rsync -an --size-only --stats {source_pattern} {target_pattern}"
        if verbose:
            print(f"source = {source_pattern}")
            print(f"target = {target_pattern}")
            if verbose > 1:
                print(cmd)
        lines = os.popen(cmd).read().split("\n")
        count = 0
        for line in lines:
            if verbose > 1:
                print("   ", line)
            if "files transferred" in line:
                count = int(line.split()[-1])
        if verbose:
            print(f"count = {count:,} / {len(files):,}")
        if count == 0:
            print("No transfer necessary")
            continue
        cmd = f"rsync -av --size-only --stats {source_pattern} {target_pattern}"
        cmd += f" | tqdm --unit loc --unit_scale --desc {yyyymmdd} --total {count} --unit files >> /dev/null"
        if verbose:
            print(cmd)
        os.system(cmd)


#

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        prog=__prog__,
        formatter_class=argparse.RawTextHelpFormatter,
        description=textwrap.dedent(
            f"""\
        Upload Tool

           {__prog__} [OPTIONS] [DATA_FOLDER]

           where OPTIONS can be one of the following
             -v    increases verbosity

           DATA_FOLDER is the folder that contains a bunch of day folders, i.e., YYYYMMDD

        Examples:

            {__prog__}
            {__prog__} -v ~/Downloads/gdrive
            {__prog__} -vv /Volumes/seagate1/peril-20230405
        """
        ),
        epilog="Copyright (c) 2022-2023 Boonleng Cheong",
    )
    parser.add_argument("-v", dest="verbose", default=0, action="count", help="increases verbosity")
    parser.add_argument("--version", action="version", version="%(prog)s " + __version__)
    parser.add_argument("source", type=str, nargs="*", help="source(s) to process")
    args = parser.parse_args()

    # main()
    for folder in args.source:
        upload(source=os.path.expanduser(folder), verbose=args.verbose)
    print("all done")
