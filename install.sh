#!/bin/bash

# Colors (mempertahankan warna asli untuk fungsi)
REDBLD="\033[0m\033[91;1m"
Green="\e[92;1m"
RED="\033[1;31m"
YELLOW="\033[33;1m"
BLUE="\033[36;1m"
FONT="\033[0m"
GREENBG="\033[42;37m"
REDBG="\033[41;37m"
NC='\e[0m'
CYAN="\033[96;1m"
WHITE="\033[97;1m"
GRAY="\033[1;30m"

# Warna gaya setup.sh
neutral="${NC}"
orange="\e[38;5;130m"
purple="\e[38;5;141m"
bold_white="\e[1;37m"
pink="\e[38;5;205m"
reset="\e[0m"

# Warna modern untuk efek
MODERN_CYAN="\033[38;2;0;255;255m"
MODERN_PURPLE="\033[38;2;156;0;255m"
MODERN_GREEN="\033[38;2;0;255;128m"
MODERN_RED="\033[38;2;255;50;50m"
MODERN_ORANGE="\033[38;2;255;128;0m"
MODERN_DIM="\033[2m"
MODERN_BOLD="\033[1m"
RESET_ALL="\033[0m"

# Animasi characters
SPINNER=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
CHECK_ICON="✓"
CROSS_ICON="✗"

# ==================== VARIABLES ====================
ZIVPN_UDP_PORT="5667"
ZIVPN_NODE_API_PORT="8585"
GITHUB_REPO="https://raw.githubusercontent.com/rifg67/zivpn-rifts/main"
ZIP_PASSWORD="rifgan67"

# ==================== MODERN LOADING FUNCTIONS ====================

show_loading_animation() {
    local pid=$1
    local message=$2
    local i=0
    
    while kill -0 $pid 2>/dev/null; do
        printf "\r${MODERN_CYAN}${SPINNER[$i]}${RESET_ALL} ${MODERN_DIM}${message}...${RESET_ALL}"
        i=$(( (i+1) % 10 ))
        sleep 0.1
    done
    printf "\r\033[K"
}

run_task() {
    local message="$1"
    local command="$2"
    
    printf "${MODERN_CYAN}◐${RESET_ALL} ${MODERN_DIM}${message}...${RESET_ALL}"
    
    bash -c "$command" &>/tmp/zivpn_install.log &
    local task_pid=$!
    
    show_loading_animation $task_pid "$message"
    wait $task_pid
    
    if [ $? -eq 0 ]; then
        printf "\r${MODERN_GREEN}${CHECK_ICON}${RESET_ALL} ${MODERN_BOLD}${message}${RESET_ALL} ${MODERN_GREEN}${CHECK_ICON}${RESET_ALL}\n"
        return 0
    else
        printf "\r${MODERN_RED}${CROSS_ICON}${RESET_ALL} ${MODERN_BOLD}${message}${RESET_ALL} ${MODERN_RED}${CROSS_ICON}${RESET_ALL}\n"
        echo -e "${MODERN_RED}  Error log: /tmp/zivpn_install.log${RESET_ALL}"
        return 1
    fi
}

print_section_header() {
    local title="$1"
    echo ""
    echo -e "${MODERN_PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET_ALL}"
    echo -e "${MODERN_BOLD}${WHITE}  ${title}${RESET_ALL}"
    echo -e "${MODERN_PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET_ALL}"
}

print_success() {
    echo -e "${MODERN_GREEN}  ${CHECK_ICON}${RESET_ALL} ${MODERN_BOLD}$1${RESET_ALL}"
}

print_error() {
    echo -e "${MODERN_RED}  ${CROSS_ICON}${RESET_ALL} ${MODERN_BOLD}$1${RESET_ALL}"
}

print_info() {
    echo -e "${MODERN_CYAN}  •${RESET_ALL} $1"
}

print_warning() {
    echo -e "${MODERN_ORANGE}  ⚠${RESET_ALL} ${MODERN_BOLD}$1${RESET_ALL}"
}

print_value() {
    local label="$1"
    local value="$2"
    printf "  ${MODERN_CYAN}${label}:${RESET_ALL} ${MODERN_BOLD}${WHITE}${value}${RESET_ALL}\n"
}

# ==================== FUNGSI BAWAHAN (TIDAK DIUBAH) ====================

print_task() {
  echo -ne "${GRAY}•${RESET} $1..."
}

print_done() {
  echo -e "\r${Green}✓${RESET} $1      "
}

print_fail() {
  echo -e "\r${RED}✗${RESET} $1      "
  exit 1
}

run_silent() {
  local msg="$1"
  local cmd="$2"
  
  print_task "$msg"
  bash -c "$cmd" &>/tmp/zivpn_install.log
  if [ $? -eq 0 ]; then
    print_done "$msg"
  else
    print_fail "$msg (Check /tmp/zivpn_install.log)"
  fi
}

# ==================== PING OPTIMIZATION ====================
optimize_ping() {
    print_section_header "⚡ Network Optimization"
    
    cp /etc/sysctl.conf /etc/sysctl.conf.bak 2>/dev/null
    sed -i '/# ========== PING OPTIMIZATION ZIVPN ==========/,/# ==============================================/d' /etc/sysctl.conf
    
    cat >> /etc/sysctl.conf <<'END'

# ========== PING OPTIMIZATION ZIVPN ==========
net.ipv4.tcp_timestamps = 1
net.ipv4.tcp_sack = 1
net.ipv4.tcp_window_scaling = 1
net.ipv4.tcp_no_metrics_save = 1
net.ipv4.tcp_moderate_rcvbuf = 1
net.ipv4.tcp_low_latency = 1
net.ipv4.tcp_thin_linear_timeouts = 1
net.ipv4.tcp_thin_dupack = 1
net.core.rmem_max = 8388608
net.core.wmem_max = 8388608
net.core.rmem_default = 65536
net.core.wmem_default = 65536
net.ipv4.tcp_rmem = 4096 87380 8388608
net.ipv4.tcp_wmem = 4096 65536 8388608
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_max_syn_backlog = 1024
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_reordering = 3
net.ipv4.tcp_retries1 = 3
net.ipv4.tcp_retries2 = 5
net.ipv4.tcp_syn_retries = 2
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_mem = 65536 131072 262144
net.ipv4.udp_mem = 65536 131072 262144
net.core.optmem_max = 65536
net.ipv4.tcp_mtu_probing = 1
net.ipv4.tcp_fastopen = 3
net.ipv4.tcp_early_retrans = 1
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.conf.all.rp_filter = 2
net.ipv4.conf.default.rp_filter = 2
net.ipv4.ip_no_pmtu_disc = 0
net.ipv4.udp_rmem_min = 16384
net.ipv4.udp_wmem_min = 16384
# ==============================================
END

    sysctl -p &>/dev/null || true
    
    for iface in $(ls /sys/class/net/ 2>/dev/null | grep -v lo); do
        if [ -f /sys/class/net/$iface/queues/rx-0/rps_cpus ]; then
            cpu_count=$(nproc)
            if [ $cpu_count -ge 4 ]; then
                echo "f" > /sys/class/net/$iface/queues/rx-0/rps_cpus 2>/dev/null || true
            elif [ $cpu_count -ge 2 ]; then
                echo "3" > /sys/class/net/$iface/queues/rx-0/rps_cpus 2>/dev/null || true
            else
                echo "1" > /sys/class/net/$iface/queues/rx-0/rps_cpus 2>/dev/null || true
            fi
        fi
        
        if [ -f /sys/class/net/$iface/queues/tx-0/xps_cpus ]; then
            cpu_count=$(nproc)
            if [ $cpu_count -ge 4 ]; then
                echo "f" > /sys/class/net/$iface/queues/tx-0/xps_cpus 2>/dev/null || true
            elif [ $cpu_count -ge 2 ]; then
                echo "3" > /sys/class/net/$iface/queues/tx-0/xps_cpus 2>/dev/null || true
            else
                echo "1" > /sys/class/net/$iface/queues/tx-0/xps_cpus 2>/dev/null || true
            fi
        fi
        
        if command -v ethtool &>/dev/null; then
            ethtool -G $iface rx 4096 tx 4096 2>/dev/null || true
        fi
    done
    
    if [ -f /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor ]; then
        for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor; do
            echo "performance" > $cpu 2>/dev/null || true
        done
    fi
    
    if ! grep -q "optimasi untuk ping stabil" /etc/security/limits.conf; then
        cat >> /etc/security/limits.conf <<'END'

# Optimasi untuk ping stabil
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535
root soft nofile 65535
root hard nofile 65535
END
    fi
    
    if [ -f /etc/rc.local ]; then
        if ! grep -q "PING OPTIMIZATION" /etc/rc.local; then
            sed -i '/exit 0/d' /etc/rc.local
            cat >> /etc/rc.local <<'END'

# PING OPTIMIZATION - Apply network settings
for iface in $(ls /sys/class/net/ | grep -v lo); do
    echo "performance" > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null
done
exit 0
END
            chmod +x /etc/rc.local
        fi
    fi
    
    echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
    echo never > /sys/kernel/mm/transparent_hugepage/defrag 2>/dev/null || true
    
    if ! command -v ethtool &>/dev/null; then
        apt-get install -y ethtool &>/dev/null
    fi
    
    print_success "Network optimized for stable ping"
    sleep 1
}

# ==================== CEKIP FUNCTION ====================
CEKIP () {
MYIP=$(curl -sS ipv4.icanhazip.com)
IPVPS=$(curl -sS https://raw.githubusercontent.com/rifg67/script-rifts/main/ipx | grep "$MYIP" | awk '{print $4}')
USERNAME=$(curl -sS https://raw.githubusercontent.com/rifg67/script-rifts/main/ipx | grep "$MYIP" | awk '{print $2}')
EXPIRED=$(curl -sS https://raw.githubusercontent.com/rifg67/script-rifts/main/ipx | grep "$MYIP" | awk '{print $3}')

if [[ "$MYIP" == "$IPVPS" ]]; then
  today=$(date -d "0 days" +%Y-%m-%d)
  d1=$(date -d "$EXPIRED" +%s 2>/dev/null)
  d2=$(date -d "$today" +%s)
  
  if [[ -z "$EXPIRED" ]]; then
    return 0
  elif [[ $d1 -lt $d2 ]]; then
    clear
    echo -e "${purple}┌───────────────────────────────────────────────┐${neutral}"
    echo -e "${purple}│${RED}              ACCOUNT EXPIRED !${FONT}"
    echo -e "${purple}└───────────────────────────────────────────────┘${neutral}"
    echo -e "${purple}│${NC}"
    echo -e "${purple}│${NC}  ${RED}Masa berlaku script Anda telah habis!${NC}"
    echo -e "${purple}│${NC}  ${YELLOW}Silakan perpanjang ke admin${NC}"
    echo -e "${purple}│${NC}"
    echo -e "${purple}│${NC}  ${CYAN}Telegram : https://t.me/PeyxDev${NC}"
    echo -e "${purple}└───────────────────────────────────────────────┘${neutral}"
    exit 1
  else
    return 0
  fi
else
  clear
  echo -e "${purple}┌───────────────────────────────────────────────┐${neutral}"
  echo -e "${purple}│${RED}              PERMISSION DENIED !${FONT}"
  echo -e "${purple}└───────────────────────────────────────────────┘${neutral}"
  echo -e "${purple}│${NC}"
  echo -e "${purple}│${NC}  ${RED}IP Anda tidak terdaftar!${NC}"
  echo -e "${purple}│${NC}  ${YELLOW}Silakan hubungi admin untuk izin akses${NC}"
  echo -e "${purple}│${NC}"
  echo -e "${purple}│${NC}  ${CYAN}Telegram : https://t.me/PeyxDev${NC}"
  echo -e "${purple}└───────────────────────────────────────────────┘${neutral}"
  exit 1
fi
}

function PX_Banner() {
clear
echo -e "${purple} ┌───────────────────────────────────────────────┐${neutral}"
echo -e "${purple} │                     ${bold_white}ZIVPN${neutral}                     ${purple}│${neutral}"
echo -e "${purple} │         ${green}┌─┐┬ ┬┌┬┐┌─┐┌─┐┌─┐┬─┐┬┌─┐┌┬┐          ${purple}│${neutral}"
echo -e "${purple} │         ${green}├─┤│ │ │ │ │└─┐│  ├┬┘│├─┘ │           ${purple}│${neutral}"
echo -e "${purple} │         ${green}┴ ┴└─┘ ┴ └─┘└─┘└─┘┴└─┴┴   ┴           ${neutral}${purple}│${neutral}"
echo -e "${purple} │        ${YELLOW}Copyright${reset} (C)${GRAY} https://t.me/PeyxDev     ${purple}│${neutral}"
echo -e "${purple} └───────────────────────────────────────────────┘${neutral}"
}

function Service_System_Operating() {
echo -e "${purple}┌────────────────────────────────────────────────┐${neutral}"
echo -e "${purple}│${WHITE} SYSTEM OS       : $(cat /etc/os-release | grep -w PRETTY_NAME | head -n1 | sed 's/=//g' | sed 's/"//g' | sed 's/PRETTY_NAME//g') ${NC}"
echo -e "${purple}│${WHITE} IP VPS          : $(curl -s ipv4.icanhazip.com) ${NC}"
echo -e "${purple}└────────────────────────────────────────────────┘${neutral}"
}

# ==================== MAIN INSTALLATION ====================

PX_Banner
Service_System_Operating
CEKIP

if [[ "$(uname -s)" != "Linux" ]] || [[ "$(uname -m)" != "x86_64" ]]; then
  print_fail "System not supported (Linux AMD64 only)"
fi

if [ -f /usr/local/bin/zivpn ]; then
  echo ""
  print_warning "ZiVPN detected. Reinstalling..."
  systemctl stop zivpn.service &>/dev/null
  systemctl stop zivpn-api-js.service &>/dev/null
  systemctl stop zivpn-bot.service &>/dev/null
fi

echo ""
print_section_header "📦 System Preparation"

# Update system dengan loading animation
run_task "Updating system packages" "sudo apt-get update -y"

# Install dependencies dengan loading animation
run_task "Installing dependencies" "sudo apt-get install -y wget curl openssl jq ufw zip unzip p7zip-full ethtool dos2unix"

# Install Node.js 20.x (LTS)
if ! command -v node &> /dev/null; then
  run_task "Installing Node.js 20.x" "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs"
else
  print_info "Node.js already installed: $(node --version)"
fi

# Jalankan optimasi ping
optimize_ping

# Input Domain dengan garis sederhana
print_section_header "🌐 Domain Configuration"
echo ""
echo -e "${MODERN_DIM}────────────────────────────────────────────────${RESET_ALL}"
echo -ne "${MODERN_CYAN}  Enter Domain${RESET_ALL} ${MODERN_DIM}(e.g., pxstore.web.id):${RESET_ALL} "
read -p "" domain

while [[ -z "$domain" ]]; do
  echo -e "${MODERN_RED}  Domain cannot be empty!${RESET_ALL}"
  echo -ne "${MODERN_CYAN}  Enter Domain${RESET_ALL} ${MODERN_DIM}(e.g., pxstore.web.id):${RESET_ALL} "
  read -p "" domain
done

echo -e "${MODERN_DIM}────────────────────────────────────────────────${RESET_ALL}"
print_success "Domain set to: $domain"

# Tampilkan port info
print_section_header "🔌 Port Configuration"
print_value "UDP Port" "$ZIVPN_UDP_PORT"
print_value "Node.js API Port" "$ZIVPN_NODE_API_PORT"

# Stop existing service
systemctl stop zivpn.service &>/dev/null

# Download Core
run_task "Downloading ZiVPN Core" "wget -q https://github.com/zahidbd2/udp-zivpn/releases/download/udp-zivpn_1.4.9/udp-zivpn-linux-amd64 -O /usr/local/bin/zivpn && chmod +x /usr/local/bin/zivpn"

mkdir -p /etc/zivpn
echo "$domain" > /etc/zivpn/domain
echo "[]" > /etc/zivpn/users.json

run_task "Downloading configuration" "wget -q ${GITHUB_REPO}/config.json -O /etc/zivpn/config.json"
sed -i "s/:5667/:${ZIVPN_UDP_PORT}/" /etc/zivpn/config.json

# Generate SSL certificate dengan lokasi Sukabumi dan PX STORE
run_task "Generating SSL certificate for ZIVPN" "openssl req -new -newkey rsa:4096 -days 365 -nodes -x509 -subj '/C=ID/ST=Jawa Barat/L=Sukabumi/O=PX STORE/OU=IT Department/CN=$domain' -keyout /etc/zivpn/zivpn.key -out /etc/zivpn/zivpn.crt 2>/dev/null"

# Create systemd service for ZiVPN
cat <<EOF > /etc/systemd/system/zivpn.service
[Unit]
Description=ZIVPN UDP VPN Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/etc/zivpn
ExecStart=/usr/local/bin/zivpn server -c /etc/zivpn/config.json
Restart=always
RestartSec=3
LimitNOFILE=65535
Environment=ZIVPN_LOG_LEVEL=info
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

# ==================== GENERATE API KEY ====================
print_section_header "🔑 API Key Generation"

# Generate API Key format PX- + random 32 karakter
generate_api_key() {
    echo "PX-$(openssl rand -hex 10)"
}

API_KEY=$(generate_api_key)
echo "$API_KEY" > /etc/zivpn/apikey
chmod 600 /etc/zivpn/apikey

echo ""
print_value "API Key" "$API_KEY"
print_info "API Key saved to: /etc/zivpn/apikey"
sleep 1

# ==================== INSTALL NODE.JS API ====================
print_section_header "📡 Installing Node.js API"

mkdir -p /etc/zivpn/api

# Download api.js dari repo
run_task "Downloading Node.js API" "wget -q ${GITHUB_REPO}/api/api.js -O /etc/zivpn/api/api.js"

# Update api.js dengan API Key yang benar
sed -i "s/const API_KEY = .*/const API_KEY = '$API_KEY';/" /etc/zivpn/api/api.js
sed -i "s/const PORT = .*/const PORT = $ZIVPN_NODE_API_PORT;/" /etc/zivpn/api/api.js

# Install express
cd /etc/zivpn/api
run_task "Installing express module" "npm install express"

# Create Node.js API service
cat <<EOF > /etc/systemd/system/zivpn-api-js.service
[Unit]
Description=ZiVPN Node.js API Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/etc/zivpn/api
ExecStart=/usr/bin/node /etc/zivpn/api/api.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Start services
run_task "Starting Node.js API Service" "systemctl daemon-reload && systemctl enable zivpn-api-js.service && systemctl start zivpn-api-js.service"
run_task "Starting ZiVPN Core" "systemctl enable zivpn.service && systemctl start zivpn.service"

# Firewall rules
iface=$(ip -4 route ls | grep default | grep -Po '(?<=dev )(\S+)' | head -1)
iptables -t nat -A PREROUTING -i "$iface" -p udp --dport 6000:19999 -j DNAT --to-destination :${ZIVPN_UDP_PORT} &>/dev/null
ufw allow 6000:19999/udp &>/dev/null
ufw allow ${ZIVPN_UDP_PORT}/udp &>/dev/null
ufw allow ${ZIVPN_NODE_API_PORT}/tcp &>/dev/null

# ==================== INSTALL XRAY + PEYX ====================
print_section_header "🚀 Installing XRAY PEYX"

# HAPUS SEMUA KONFIGURASI LAMA
print_info "Cleaning old configurations..."

systemctl stop xray 2>/dev/null
systemctl disable xray 2>/dev/null
rm -rf /usr/local/etc/xray
rm -rf /etc/xray
rm -rf /var/log/xray
rm -f /etc/systemd/system/xray.service
rm -f /etc/systemd/system/xray@.service
rm -rf /etc/peyx
rm -f /etc/nginx/sites-available/xray
rm -f /etc/nginx/sites-enabled/xray
rm -f /etc/nginx/sites-enabled/default

print_success "Old configurations cleaned"

# ==================== CEK DAN INSTALL NGINX ====================
print_info "Checking Nginx installation..."
if ! command -v nginx &> /dev/null; then
    print_info "Installing Nginx..."
    apt update
    apt install nginx -y
    systemctl enable nginx
    systemctl start nginx
fi
print_success "Nginx is ready"

# Install Xray Core
run_task "Installing Xray Core" "bash -c \"\$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)\" @ install"

# Buat struktur folder PEYX
run_task "Creating /etc/peyx folder structure" "mkdir -p /etc/peyx/limit/{vmess,vless,trojan}/ip && mkdir -p /etc/peyx/{vmess,vless,trojan} && mkdir -p /etc/peyx/log && mkdir -p /etc/peyx/config"

# Buat database users
run_task "Creating user databases" "touch /etc/peyx/vmess.db /etc/peyx/vless.db /etc/peyx/trojan.db && chmod 644 /etc/peyx/*.db"

# Buat config default
run_task "Creating default configs" "echo '100' > /etc/peyx/config/default_quota && echo '2' > /etc/peyx/config/default_ip_limit && echo '30' > /etc/peyx/config/default_duration"

# ==================== AMBIL DOMAIN ====================
if [[ -f /etc/zivpn/domain ]]; then
    domain=$(cat /etc/zivpn/domain)
else
    domain="localhost"
fi
print_info "Domain: $domain"

# ==================== GENERATE SSL CERTIFICATE (SELF-SIGNED) ====================
run_task "Generating SSL certificate for Xray" "
mkdir -p /etc/xray
openssl req -new -newkey rsa:4096 -days 365 -nodes -x509 \
    -subj '/C=ID/ST=Jawa Barat/L=Sukabumi/O=PEYX TUNNEL/OU=IT Department/CN=$domain' \
    -keyout /etc/xray/xray.key \
    -out /etc/xray/xray.crt 2>/dev/null
chmod 644 /etc/xray/xray.crt /etc/xray/xray.key
"

print_success "SSL certificate generated"

# ==================== KONFIGURASI XRAY ====================
run_task "Creating Xray configuration" "mkdir -p /usr/local/etc/xray"

# UUID tetap untuk konsistensi
uuid_vmess="1d1c1d94-6987-4658-a4dc-8821a30fe7e0"
uuid_vless="1d1c1d94-6987-4658-a4dc-8821a30fe7e0"
pass_trojan="1d1c1d94-6987-4658-a4dc-8821a30fe7e0"

cat > /usr/local/etc/xray/config.json << EOF
{
  "log": {
    "access": "/var/log/xray/access.log",
    "error": "/var/log/xray/error.log",
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "listen": "127.0.0.1",
      "port": 10000,
      "protocol": "dokodemo-door",
      "settings": { "address": "127.0.0.1" },
      "tag": "api"
    },
    {
      "listen": "127.0.0.1",
      "port": 10001,
      "protocol": "vless",
      "settings": {
        "decryption": "none",
        "clients": [
          {
            "id": "$uuid_vless",
            "email": "vless1"
          }
        ]
      },
      "streamSettings": {
        "network": "ws",
        "wsSettings": { "path": "/vless" }
      },
      "tag": "vless"
    },
    {
      "listen": "127.0.0.1",
      "port": 10002,
      "protocol": "vmess",
      "settings": {
        "clients": [
          {
            "id": "$uuid_vmess",
            "alterId": 0,
            "email": "vmess1"
          }
        ]
      },
      "streamSettings": {
        "network": "ws",
        "wsSettings": { "path": "/vmess" }
      },
      "tag": "vmess"
    },
    {
      "listen": "127.0.0.1",
      "port": 10003,
      "protocol": "trojan",
      "settings": {
        "clients": [
          {
            "password": "$pass_trojan",
            "email": "trojan1"
          }
        ]
      },
      "streamSettings": {
        "network": "ws",
        "wsSettings": { "path": "/trojan" }
      },
      "tag": "trojan"
    }
  ],
  "outbounds": [
    { "protocol": "freedom", "settings": {}, "tag": "direct" },
    { "protocol": "blackhole", "settings": {}, "tag": "blocked" }
  ],
  "routing": {
    "rules": [
      { "type": "field", "ip": ["geoip:private"], "outboundTag": "blocked" }
    ]
  },
  "policy": {
    "levels": { "0": { "statsUserUplink": true, "statsUserDownlink": true } }
  },
  "stats": {},
  "api": { "services": ["StatsService"], "tag": "api" }
}
EOF

# ==================== SETUP NGINX (HTTP + HTTPS) ====================
run_task "Setting up Nginx configuration" "
rm -f /etc/nginx/sites-available/xray /etc/nginx/sites-enabled/xray 2>/dev/null

cat > /etc/nginx/sites-available/xray << 'NGINXEOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_PLACEHOLDER;
    
    ssl_certificate /etc/xray/xray.crt;
    ssl_certificate_key /etc/xray/xray.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    location /vmess {
        proxy_pass http://127.0.0.1:10002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host \$host;
    }
    
    location /vless {
        proxy_pass http://127.0.0.1:10001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host \$host;
    }
    
    location /trojan {
        proxy_pass http://127.0.0.1:10003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host \$host;
    }
}
NGINXEOF

sed -i \"s/DOMAIN_PLACEHOLDER/$domain/g\" /etc/nginx/sites-available/xray
ln -sf /etc/nginx/sites-available/xray /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration (if nginx exists)
if command -v nginx &> /dev/null; then
    nginx -t
fi
"

# Buat service Xray
run_task "Creating Xray service" "cat > /etc/systemd/system/xray.service << 'SEOF'
[Unit]
Description=Xray Service
After=network.target

[Service]
User=www-data
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
ExecStart=/usr/local/bin/xray run -config /usr/local/etc/xray/config.json
Restart=on-failure

[Install]
WantedBy=multi-user.target
SEOF
systemctl daemon-reload"

# Buat folder log Xray
run_task "Setting up Xray logs" "mkdir -p /var/log/xray && touch /var/log/xray/access.log /var/log/xray/error.log && chown -R www-data:www-data /var/log/xray"

# Start semua service
run_task "Starting Xray service" "systemctl enable xray && systemctl restart xray"
run_task "Starting Nginx service" "systemctl restart nginx"

# Firewall
run_task "Configuring firewall" "
ufw allow 80/tcp 2>/dev/null
ufw allow 443/tcp 2>/dev/null
ufw allow 10000:10003/tcp 2>/dev/null
"

# Simpan user ke database
echo "### vmess1 $(date -d '30 days' +%Y-%m-%d) $uuid_vmess 10 2" >> /etc/peyx/vmess.db
echo "### vless1 $(date -d '30 days' +%Y-%m-%d) $uuid_vless 10 2" >> /etc/peyx/vless.db
echo "### trojan1 $(date -d '30 days' +%Y-%m-%d) $pass_trojan 10 2" >> /etc/peyx/trojan.db

echo "2" > /etc/peyx/limit/vmess/ip/vmess1
echo "2" > /etc/peyx/limit/vless/ip/vless1
echo "2" > /etc/peyx/limit/trojan/ip/trojan1

# ==================== SCRIPT MONITORING ====================
cat > /usr/local/bin/cek-xray << 'CEOF'
#!/bin/bash
domain=$(cat /etc/zivpn/domain 2>/dev/null)
echo "=========================="
echo "     XRAY STATUS"
echo "=========================="
systemctl is-active xray && echo "✅ Xray: Running" || echo "❌ Xray: Not Running"
systemctl is-active nginx && echo "✅ Nginx: Running" || echo "❌ Nginx: Not Running"
echo ""
echo "=========================="
echo "     PORTS"
echo "=========================="
netstat -tlnp 2>/dev/null | grep -E ":80|:443|:10001|:10002|:10003"
echo ""
CEOF

chmod +x /usr/local/bin/cek-xray

print_success "XRAY BY PeyxDev installation completed"
print_info "Xray config: /usr/local/etc/xray/config.json"
print_info "Data folder: /etc/peyx"
print_info "SSL certificate: /etc/xray/xray.crt"
print_info "Domain: https://$domain"

# ==================== AUTO DELETE EXPIRED ACCOUNTS DAEMON ====================
print_section_header "🗑️ Installing Auto Delete Expired Accounts Daemon"

# Buat script auto delete daemon
cat > /usr/local/bin/auto-delete-daemon << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const { exec } = require('child_process');

const USERS_FILE = '/etc/zivpn/users.json';
const LOG_FILE = '/var/log/zivpn-auto-delete.log';
const BOT_CONFIG = '/etc/zivpn/bot-config.json';
const CHECK_INTERVAL = 60000; // Cek setiap 60 detik (1 menit)

function logMessage(message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLine = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logLine);
    console.log(logLine.trim());
}

function getSystemInfo() {
    return new Promise((resolve) => {
        exec('curl -s ipinfo.io/org | cut -d " " -f 2-10', (err, stdout) => {
            const isp = err ? 'Unknown ISP' : stdout.trim() || 'Unknown ISP';
            exec('curl -sS ipv4.icanhazip.com', (err2, stdout2) => {
                const ip = err2 ? 'Unknown IP' : stdout2.trim() || 'Unknown IP';
                
                let domain = 'Not configured';
                if (fs.existsSync('/etc/zivpn/domain')) {
                    domain = fs.readFileSync('/etc/zivpn/domain', 'utf8').trim();
                } else if (fs.existsSync('/etc/xray/domain')) {
                    domain = fs.readFileSync('/etc/xray/domain', 'utf8').trim();
                }
                
                resolve({ isp, ip, domain });
            });
        });
    });
}

function sendTelegramNotification(username, expired) {
    return new Promise((resolve) => {
        if (!fs.existsSync(BOT_CONFIG)) {
            resolve(false);
            return;
        }
        
        try {
            const botConfig = JSON.parse(fs.readFileSync(BOT_CONFIG, 'utf8'));
            const botToken = botConfig.bot_token;
            const adminId = botConfig.admin_id;
            
            if (!botToken || !adminId) {
                resolve(false);
                return;
            }
            
            getSystemInfo().then(({ isp, ip, domain }) => {
                const datetimeNow = new Date().toLocaleString('id-ID', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }).replace(/\//g, '-');
                
                const message = `🗑️ *USER EXPIRED & DELETED* 🗑️
━━━━━━━━━━━━━━━━━━━━
👤 *Username:* \`${username}\`
📅 *Expired Date:* ${expired}
⏰ *Deleted At:* ${datetimeNow}
🌐 *Domain:* ${domain}
🖧 *IP Address:* \`${ip}\`
🏢 *ISP:* ${isp}
━━━━━━━━━━━━━━━━━━━━
✅ Expired user has been automatically removed from system!`;
                
                const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
                const params = new URLSearchParams();
                params.append('chat_id', adminId);
                params.append('text', message);
                params.append('parse_mode', 'Markdown');
                
                fetch(url, { method: 'POST', body: params })
                    .then(() => resolve(true))
                    .catch(() => resolve(false));
            });
        } catch (error) {
            logMessage(`Telegram error: ${error.message}`);
            resolve(false);
        }
    });
}

function deleteExpiredAccounts() {
    try {
        if (!fs.existsSync(USERS_FILE)) {
            return;
        }
        
        // Backup sebelum modify
        fs.copyFileSync(USERS_FILE, `${USERS_FILE}.bak`);
        
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        const users = JSON.parse(data);
        const today = new Date().toISOString().split('T')[0];
        
        let deletedUsers = [];
        let activeUsers = [];
        
        for (const user of users) {
            const expired = user.expired;
            const status = user.status || 'active';
            const username = user.username || user.password || 'unknown';
            
            // Cek apakah expired
            if (expired && expired !== '-' && expired < today && status !== 'locked') {
                deletedUsers.push({
                    username: username,
                    password: user.password || 'unknown',
                    expired: expired
                });
                continue;
            } else {
                activeUsers.push(user);
            }
        }
        
        // Simpan users yang masih aktif
        if (deletedUsers.length > 0) {
            fs.writeFileSync(USERS_FILE, JSON.stringify(activeUsers, null, 2));
            logMessage(`✅ Deleted ${deletedUsers.length} expired account(s):`);
            
            deletedUsers.forEach(async (user) => {
                logMessage(`   - ${user.username} (expired: ${user.expired})`);
                // Kirim notifikasi Telegram untuk setiap user yang dihapus
                await sendTelegramNotification(user.username, user.expired);
            });
        }
        
    } catch (error) {
        logMessage(`❌ Error: ${error.message}`);
    }
}

// Jalankan sekali saat start
logMessage('🚀 Auto Delete Daemon Started');
logMessage(`📁 Users file: ${USERS_FILE}`);
logMessage(`⏱️  Check interval: ${CHECK_INTERVAL / 1000} seconds`);
deleteExpiredAccounts();

// Set interval untuk cek berkala
setInterval(() => {
    deleteExpiredAccounts();
}, CHECK_INTERVAL);

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logMessage('🛑 Auto Delete Daemon Stopped (SIGTERM)');
    process.exit(0);
});

process.on('SIGINT', () => {
    logMessage('🛑 Auto Delete Daemon Stopped (SIGINT)');
    process.exit(0);
});
EOF

chmod +x /usr/local/bin/auto-delete-daemon

# Buat systemd service untuk daemon
cat > /etc/systemd/system/zivpn-auto-delete.service << 'EOF'
[Unit]
Description=ZiVPN Auto Delete Expired Accounts Daemon
After=network.target zivpn.service
Wants=zivpn.service

[Service]
Type=simple
User=root
WorkingDirectory=/etc/zivpn
ExecStart=/usr/bin/node /usr/local/bin/auto-delete-daemon
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable dan start service
run_task "Enabling auto-delete daemon" "systemctl daemon-reload && systemctl enable zivpn-auto-delete.service && systemctl start zivpn-auto-delete.service"

print_success "Auto Delete Expired Accounts Daemon installed"
print_info "Daemon runs continuously and checks every 60 seconds"
print_info "Log file: /var/log/zivpn-auto-delete.log"
print_info "Telegram notifications will be sent when accounts are deleted"

# ==================== DOWNLOAD MENU MANAGER ====================
print_section_header "📦 Installing Menu Manager"

# Download ZIP file
run_task "Downloading Menu Package" "wget -q ${GITHUB_REPO}/menu.zip -O /tmp/menu.zip"

# Extract dengan 7zip
run_task "Extracting Menu Package" "rm -rf /tmp/menu && 7z x -p'${ZIP_PASSWORD}' /tmp/menu.zip -o/tmp/menu/ -y"

# Copy semua file menu ke /usr/local/bin
run_task "Installing Menu Files" "find /tmp/menu -type f -exec cp -f {} /usr/local/bin/ \;"

# Convert ke format Unix (UNIVERSAL)
run_task "Converting to Unix format" "find /usr/local/bin -maxdepth 1 -type f -exec dos2unix {} + 2>/dev/null"

# Beri izin eksekusi (UNIVERSAL)
run_task "Setting execute permissions" "find /usr/local/bin -maxdepth 1 -type f -exec chmod +x {} \; 2>/dev/null"

# Bersihkan file temporary
run_task "Cleaning up" "rm -rf /tmp/menu /tmp/menu.zip"

# ==================== AUTO MENU ON LOGIN ====================
print_section_header "⚙️ Configuring Auto-Start"

# Hapus semua konfigurasi lama
sed -i '/# ========== AUTO MENU ZIVPN ==========/,/# ======================================/d' /root/.bashrc 2>/dev/null
sed -i '/# ========== AUTO MENU ZIVPN ==========/,/# ======================================/d' /root/.profile 2>/dev/null
sed -i '/alias menu=/d' /root/.bashrc 2>/dev/null
rm -f /etc/profile.d/menu.sh 2>/dev/null

# Gunakan profile.d method
cat > /etc/profile.d/menu.sh << 'EOF'
#!/bin/bash
# ZiVPN Auto Menu - Hanya tampil sekali saat login
if [ -t 0 ] && [ -f /usr/local/bin/menu ] && [ -z "$ZIVPN_MENU_SHOWN" ]; then
    export ZIVPN_MENU_SHOWN=1
    clear
    /usr/local/bin/menu
fi
EOF
chmod +x /etc/profile.d/menu.sh

# Tambahkan alias untuk manual menu
echo "alias menu='bash /usr/local/bin/menu'" >> /root/.bashrc

print_success "Auto menu on login has been configured"

rm -f "$0" install.tmp install.log &>/dev/null

# ==================== SEND TELEGRAM NOTIFICATION ON SUCCESS ====================
send_install_notification() {
    # Ambil token dan ID dari URL
    local bot_token=$(curl -s http://pxstore.web.id/bot-token 2>/dev/null | tr -d '\n\r')
    local admin_id=$(curl -s http://pxstore.web.id/bot-id 2>/dev/null | tr -d '\n\r')
    
    if [ -z "$bot_token" ] || [ -z "$admin_id" ]; then
        print_warning "Failed to get bot token/id from server"
        return 1
    fi
    
    # Get system info
    local ISP=$(curl -s ipinfo.io/org | cut -d " " -f 2-10 2>/dev/null || echo "Unknown ISP")
    local IP=$(curl -sS ipv4.icanhazip.com 2>/dev/null || echo "Unknown IP")
    local CITY=$(curl -s ipinfo.io/city 2>/dev/null || echo "Unknown")
    local COUNTRY=$(curl -s ipinfo.io/country 2>/dev/null || echo "Unknown")
    local HOSTNAME=$(hostname)
    local datetime_now=$(date '+%Y-%m-%d %H:%M:%S')
    local date_now=$(date '+%A, %d %B %Y')
    
    # Ambil info expired dari fungsi CEKIP
    local MYIP=$(curl -sS ipv4.icanhazip.com)
    local EXPIRED=$(curl -sS https://raw.githubusercontent.com/rifg67/script-rifts/main/ipx | grep "$MYIP" | awk '{print $3}')
    local USERNAME=$(curl -sS https://raw.githubusercontent.com/rifg67/script-rifts/main/ipx | grep "$MYIP" | awk '{print $2}')
    
    if [ -z "$EXPIRED" ]; then
        local expired_status="Permanent (No Expiry)"
    else
        local expired_status="$EXPIRED"
    fi
    
    if [ -z "$USERNAME" ]; then
        local username_status="Not Registered"
    else
        local username_status="$USERNAME"
    fi
    
    local message="✅ *ZIVPN INSTALLATION SUCCESSFUL* ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *INSTALLATION DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *User:* $username_status
📅 *Expired:* $expired_status
🌐 *Domain:* $domain
🔌 *UDP Port:* $ZIVPN_UDP_PORT
📡 *API Port:* $ZIVPN_NODE_API_PORT
🔑 *API Key:* \`$API_KEY\`
⏰ *Time:* $datetime_now
📅 *Date:* $date_now

🖥️ *SERVER INFORMATION*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖧 *IP Address:* \`$IP\`
🏢 *ISP:* $ISP
📍 *Location:* $CITY, $COUNTRY
💻 *Hostname:* $HOSTNAME

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *Services Installed:*
✅ ZiVPN Core Service
✅ Node.js API Service  
✅ Auto Delete Expired Daemon
✅ Menu Manager
✅ Network Optimization

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 *Script By PeyxDev*
📢 *Telegram:* https://t.me/PeyxDev"
    
    local url="https://api.telegram.org/bot${bot_token}/sendMessage"
    curl -s -X POST "$url" \
        -d "chat_id=${admin_id}" \
        -d "text=${message}" \
        -d "parse_mode=Markdown" \
        -d "disable_web_page_preview=true" >/dev/null
    
    if [ $? -eq 0 ]; then
        print_success "Installation notification sent to Telegram"
    else
        print_warning "Failed to send Telegram notification"
    fi
}

# Kirim notifikasi Telegram (langsung ambil dari URL, tanpa file config)
print_info "Sending installation notification to Telegram..."
send_install_notification

# ==================== INSTALLATION SUMMARY ====================
clear
PX_Banner
echo ""
echo -e "${purple} ┌───────────────────────────────────────────────┐${neutral}"
echo -e "${purple} │${Green}              INSTALLATION COMPLETE!${FONT}"
echo -e "${purple} └───────────────────────────────────────────────┘${neutral}"
echo ""
echo -e "${purple} │${CYAN}  Domain           : ${domain}${FONT}"
echo -e "${purple} │${CYAN}  UDP Port         : ${ZIVPN_UDP_PORT}${FONT}"
echo -e "${purple} │${CYAN}  Node.js API Port : ${ZIVPN_NODE_API_PORT}${FONT}"
echo -e "${purple} │${CYAN}  API Key          : ${API_KEY}${FONT}"
echo -e "${purple} │${CYAN}  API Key File     : /etc/zivpn/apikey${FONT}"
echo -e "${purple} │${CYAN}  Config Dir       : /etc/zivpn${FONT}"
echo -e "${purple} ────────────────────────────────────────────────${neutral}"
echo ""
echo -e "${purple} ┌───────────────────────────────────────────────┐${neutral}"
echo -e "${purple} │${YELLOW}  Menu Manager:${FONT}"
echo -e "${purple} │${Green}    menu${FONT}"
echo -e "${purple} └───────────────────────────────────────────────┘${neutral}"
echo ""
echo -e "${purple} ┌───────────────────────────────────────────────┐${neutral}"
echo -e "${purple} │${Green}  ✓ Network Optimized for Stable Ping${FONT}"
echo -e "${purple} └───────────────────────────────────────────────┘${neutral}"
echo ""
echo -e "${purple} ┌───────────────────────────────────────────────┐${neutral}"
echo -e "${purple} │${GRAY}  Telegram : https://t.me/PeyxDev${FONT}"
echo -e "${purple} └───────────────────────────────────────────────┘${neutral}"
echo ""
echo -e "${YELLOW}  Tekan Enter untuk melanjutkan ke menu...${NC}"
read -r

# Run menu
bash /usr/local/bin/menu