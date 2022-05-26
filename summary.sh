#!/bin/bash
#
# This script generates a summary of important process and shows the
# latest logs from selected processes
#

if [ -z "${BLIB_HOME}" ]; then BLIB_HOME="${HOME}/Developer/blib-sh"; fi; . ${BLIB_HOME}/blib.sh

##############
#
#   M A I N
#
##############

clear

check_user_process radarhub python dgen fifoshare fiforead fifo2db | textout "Processes" seagreen

if [ -f /lib/systemd/system/redis-server.service ]; then
	echo
	systemctl status redis --no-pager --lines 4
fi

if [ -f /lib/systemd/system/supervisor.service ]; then
	echo
	systemctl status supervisor --no-pager --lines 4
fi

echo

# Supervisord logging
folder="${HOME}/log"
if [ -d ${folder} ]; then
	show_log_by_latest_line_count frontend 10 228
	show_log_by_latest_line_count bbot 10 228
	#show_log_by_latest_line_count backhaul 10 214
	echo -e "\033[4;38;5;214m/home/radarhub/log/backhaul.log\033[m"
	tail -n 10 /home/radarhub/log/backhaul.log
fi

# BLIB logging
folder="${HOME}/logs"
if [ -d ${folder} ]; then
	logfile=$(ls -t ${folder}/fifo2db-* | sort | tail -n 1)
	echo -e "\033[1;4;38;5;45m${logfile}\033[m"
	tail -n 10 ${logfile}
	echo
fi

