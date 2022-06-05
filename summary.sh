#!/bin/bash
#
# This script generates a summary of important process and shows the
# latest logs from selected processes
#
# Requirement:
# blib-sh (https://git.arrc.ou.edu/cheo4524/blib-sh.git)
#

if [ "${1}" == "bbot" ]; then
	export TERM=xterm-256color
	export SCREEN_WIDTH=120
fi

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
if [ ${DJANGO_DEBUG} == "true" ]; then
	folder="${HOME}/log"
else
	folder="/var/log/radarhub"
fi
if [ -d ${folder} ]; then
	# show_log_by_latest_line_count frontend 10 228
	echo -e "\033[4;38;5;214m${folder}/frontend.log\033[m"
	tail -n 10 ${folder}/frontend.log
	# show_log_by_latest_line_count backhaul 10 214
	echo -e "\033[4;38;5;214m${folder}/backhaul.log\033[m"
	tail -n 10 ${folder}/backhaul.log
fi

# Logs through common.dailylog
folder="${HOME}/logs"
if [ -d ${folder} ]; then
	logfile=$(ls -t ${folder}/fifo2db-* | sort | tail -n 1)
	echo -e "\033[1;4;38;5;45m${logfile}\033[m"
	tail -n 10 ${logfile}
	echo
fi

