#!/bin/bash

# Colors
RED="\033[1;31m"
Green="\e[92;1m"
FONT="\033[0m"
CYAN="\033[96;1m"

# Rainbow colors
RAINBOW=(
    "\033[38;5;196m" "\033[38;5;202m" "\033[38;5;208m" "\033[38;5;214m"
    "\033[38;5;220m" "\033[38;5;226m" "\033[38;5;190m" "\033[38;5;154m"
    "\033[38;5;118m" "\033[38;5;82m"  "\033[38;5;46m"  "\033[38;5;47m"
    "\033[38;5;48m"  "\033[38;5;49m"  "\033[38;5;87m"  "\033[38;5;86m"
    "\033[38;5;85m"  "\033[38;5;84m"  "\033[38;5;83m"  "\033[38;5;44m"
    "\033[38;5;43m"  "\033[38;5;42m"  "\033[38;5;41m"  "\033[38;5;40m"
    "\033[38;5;39m"  "\033[38;5;38m"  "\033[38;5;37m"  "\033[38;5;36m"
)

# ==================== VARIABLES ====================
GITHUB_REPO="https://raw.githubusercontent.com/rifg67/zivpn-rifts/main"
ZIP_PASSWORD="rifgan67"

# Rainbow header satu baris
rainbow_header() {
    clear
    local left="⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙"
    local right="⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙⁙"
    local name="PeyxDev"
    local full="${left}${name}${right}"
    local len=${#full}
    local colors_len=${#RAINBOW[@]}
    
    # Animasi rainbow
    for i in {1..3}; do
        printf "\r"
        for ((j=0; j<len; j++)); do
            local color_idx=$(( (j + i * 2) % colors_len ))
            printf "${RAINBOW[$color_idx]}${full:$j:1}"
        done
        sleep 0.12
    done
    
    # Hasil akhir
    printf "\r"
    for ((j=0; j<len; j++)); do
        local color_idx=$(( j % colors_len ))
        printf "${RAINBOW[$color_idx]}${full:$j:1}"
    done
    printf "${FONT}\n\n"
}

# Loading spinner
loading_spinner() {
    local pid=$1
    local msg=$2
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local delay=0.08
    
    while ps -p $pid > /dev/null 2>&1; do
        for ((i=0; i<${#spinstr}; i++)); do
            printf "\r   ${CYAN}${spinstr:$i:1}${FONT}   ${msg}"
            sleep $delay
        done
    done
    printf "\r   ${Green}✓${FONT}   ${msg}\n"
}

run_with_spinner() {
    local msg="$1"
    local cmd="$2"
    
    eval "$cmd" > /dev/null 2>&1 &
    loading_spinner $! "$msg"
}

# ==================== CEKIP FUNCTION ====================
CEKIP () {
MYIP=$(curl -sS ipv4.icanhazip.com)
IPVPS=$(curl -sS https://raw.githubusercontent.com/rifg67/script-rifts/main/ipx | grep "$MYIP" | awk '{print $4}')
EXPIRED=$(curl -sS https://raw.githubusercontent.com/rifg67/script-rifts/main/ipx | grep "$MYIP" | awk '{print $3}')

if [[ "$MYIP" == "$IPVPS" ]]; then
  today=$(date -d "0 days" +%Y-%m-%d)
  d1=$(date -d "$EXPIRED" +%s 2>/dev/null)
  d2=$(date -d "$today" +%s)
  
  if [[ -z "$EXPIRED" ]]; then
    return 0
  elif [[ $d1 -lt $d2 ]]; then
    clear
    printf "\n   ${RED}ACCOUNT EXPIRED !${FONT}\n"
    exit 1
  else
    return 0
  fi
else
  clear
  printf "\n   ${RED}PERMISSION DENIED !${FONT}\n"
  exit 1
fi
}

# Main
rainbow_header
CEKIP

# Install dependencies
if ! command -v 7z &> /dev/null; then
    run_with_spinner "Preparing environment" "apt update && apt install p7zip-full -y"
fi

if ! command -v dos2unix &> /dev/null; then
    run_with_spinner "Configuring system" "apt install dos2unix -y"
fi

# Update process
run_with_spinner "Downloading update" "wget -q ${GITHUB_REPO}/menu.zip -O /tmp/menu.zip"
run_with_spinner "Extracting files" "rm -rf /tmp/menu && mkdir -p /tmp/menu && 7z x -p'$ZIP_PASSWORD' /tmp/menu.zip -o/tmp/menu/ -y"
run_with_spinner "Installing files" "find /tmp/menu -type f -exec cp -f {} /usr/local/bin/ \;"
run_with_spinner "Converting format" "dos2unix /usr/local/bin/* > /dev/null 2>&1"
run_with_spinner "Setting permissions" "chmod +x /usr/local/bin/* > /dev/null 2>&1"
run_with_spinner "Cleaning up" "rm -rf /tmp/menu /tmp/menu.zip"

printf "\n   ${Green}✓ Update complete!${FONT}\n\n"
sleep 1
clear

bash /usr/local/bin/menu