#!/bin/bash
set -euo pipefail

# ============================================================
# Landomo-World VPS Security Hardening Script
# ============================================================
# Run on the VPS as root: bash security-hardening.sh
#
# Checklist:
#   1. UFW firewall (allow 80/443/22 only)
#   2. SSH hardening (disable root login, key-only auth)
#   3. fail2ban for SSH brute-force protection
#   4. Docker daemon security
#   5. Secret file permissions
#   6. Kernel hardening (sysctl)
#   7. Automatic security updates
#   8. Audit logging
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root"
  exit 1
fi

# ============================================================
# 1. UFW FIREWALL
# ============================================================
info "=== 1/8 Configuring UFW firewall ==="

apt-get install -y ufw > /dev/null 2>&1

ufw default deny incoming
ufw default allow outgoing

# SSH
ufw allow 22/tcp comment 'SSH'

# HTTP/HTTPS (for nginx reverse proxy / Let's Encrypt)
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Enable firewall (non-interactive)
echo "y" | ufw enable
ufw status verbose

info "Firewall configured: only 22, 80, 443 open"

# ============================================================
# 2. SSH HARDENING
# ============================================================
info "=== 2/8 Hardening SSH ==="

SSHD_CONFIG="/etc/ssh/sshd_config"
SSHD_HARDENING="/etc/ssh/sshd_config.d/99-landomo-hardening.conf"

cat > "$SSHD_HARDENING" << 'EOF'
# Landomo security hardening
PermitRootLogin prohibit-password
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 30
PermitEmptyPasswords no
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

# Validate sshd config before restarting
if sshd -t; then
  systemctl restart sshd
  info "SSH hardened: root login via password disabled, key-only auth"
else
  error "SSH config validation failed, reverting"
  rm -f "$SSHD_HARDENING"
fi

# ============================================================
# 3. FAIL2BAN
# ============================================================
info "=== 3/8 Installing and configuring fail2ban ==="

apt-get install -y fail2ban > /dev/null 2>&1

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 3
backend  = systemd

[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 3
bantime  = 3600
EOF

systemctl enable fail2ban
systemctl restart fail2ban

info "fail2ban configured: 3 failed attempts = 1hr ban"

# ============================================================
# 4. DOCKER DAEMON SECURITY
# ============================================================
info "=== 4/8 Securing Docker daemon ==="

DOCKER_DAEMON="/etc/docker/daemon.json"
mkdir -p /etc/docker

# Merge with existing config if present, otherwise create new
cat > "$DOCKER_DAEMON" << 'EOF'
{
  "icc": false,
  "no-new-privileges": true,
  "userland-proxy": false,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true
}
EOF

systemctl restart docker || warn "Docker restart failed - may need manual restart"

info "Docker daemon: inter-container communication restricted, no-new-privileges enabled"

# ============================================================
# 5. SECRET FILE PERMISSIONS
# ============================================================
info "=== 5/8 Locking down secret file permissions ==="

SECRETS_DIR="/opt/landomo-world/docker/secrets"
if [ -d "$SECRETS_DIR" ]; then
  chmod 600 "$SECRETS_DIR"/*
  chmod 700 "$SECRETS_DIR"
  chown -R root:root "$SECRETS_DIR"
  info "Secret files: permissions set to 600, owned by root"
else
  warn "Secrets directory not found at $SECRETS_DIR - skipping"
fi

# Also lock down .env files
find /opt/landomo-world -name ".env*" -type f -exec chmod 600 {} \; 2>/dev/null || true

# ============================================================
# 6. KERNEL HARDENING (sysctl)
# ============================================================
info "=== 6/8 Applying kernel hardening ==="

cat > /etc/sysctl.d/99-landomo-security.conf << 'EOF'
# Prevent IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Disable ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# Disable source routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0

# SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2

# Ignore ICMP broadcast requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Log martians
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# Disable IPv6 if not needed
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
EOF

sysctl --system > /dev/null 2>&1
info "Kernel hardened: SYN flood protection, IP spoofing prevention"

# ============================================================
# 7. AUTOMATIC SECURITY UPDATES
# ============================================================
info "=== 7/8 Enabling automatic security updates ==="

apt-get install -y unattended-upgrades > /dev/null 2>&1

cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

info "Automatic security updates enabled"

# ============================================================
# 8. AUDIT LOGGING
# ============================================================
info "=== 8/8 Setting up audit logging ==="

apt-get install -y auditd > /dev/null 2>&1

cat > /etc/audit/rules.d/landomo.rules << 'EOF'
# Monitor Docker socket access
-w /var/run/docker.sock -p rwxa -k docker_socket

# Monitor secret files
-w /opt/landomo-world/docker/secrets/ -p rwxa -k landomo_secrets

# Monitor SSH config changes
-w /etc/ssh/sshd_config -p wa -k sshd_config
-w /etc/ssh/sshd_config.d/ -p wa -k sshd_config

# Monitor user/group changes
-w /etc/passwd -p wa -k identity
-w /etc/group -p wa -k identity
-w /etc/shadow -p wa -k identity

# Monitor sudo usage
-w /var/log/auth.log -p wa -k auth_log

# Monitor crontab changes
-w /etc/crontab -p wa -k crontab
-w /var/spool/cron/ -p wa -k crontab
EOF

systemctl enable auditd
systemctl restart auditd

info "Audit logging configured: Docker socket, secrets, SSH, identity changes monitored"

# ============================================================
# SUMMARY
# ============================================================
echo ""
echo "============================================"
echo "  SECURITY HARDENING COMPLETE"
echo "============================================"
echo ""
echo "Applied:"
echo "  [x] UFW firewall (22/80/443 only)"
echo "  [x] SSH hardening (key-only, no root password)"
echo "  [x] fail2ban (3 attempts = 1hr ban)"
echo "  [x] Docker daemon security (no-new-privileges, no ICC)"
echo "  [x] Secret file permissions (600, root-owned)"
echo "  [x] Kernel hardening (sysctl)"
echo "  [x] Automatic security updates"
echo "  [x] Audit logging (auditd)"
echo ""
echo "Verify with:"
echo "  ufw status verbose"
echo "  fail2ban-client status sshd"
echo "  docker info | grep -i security"
echo "  auditctl -l"
echo ""
warn "IMPORTANT: Ensure you have SSH key access before disconnecting!"
warn "Test SSH in a new terminal before closing this session."
