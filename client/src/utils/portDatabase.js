// Port mapping database for IPDR analysis
export const portDB = {
  20: { name: "FTP Data", risk: "low", category: "File Transfer" },
  21: { name: "FTP Control", risk: "low", category: "File Transfer" },
  22: { name: "SSH", risk: "medium", category: "Remote Access" },
  23: { name: "Telnet", risk: "high", category: "Remote Access" },
  25: { name: "SMTP", risk: "low", category: "Email" },
  53: { name: "DNS", risk: "low", category: "Network" },
  80: { name: "HTTP", risk: "low", category: "Web" },
  110: { name: "POP3", risk: "low", category: "Email" },
  143: { name: "IMAP", risk: "low", category: "Email" },
  443: { name: "HTTPS", risk: "low", category: "Secure Web" },
  445: { name: "SMB", risk: "high", category: "File Sharing" },
  993: { name: "IMAPS", risk: "low", category: "Email" },
  995: { name: "POP3S", risk: "low", category: "Email" },
  1433: { name: "MSSQL", risk: "medium", category: "Database" },
  1521: { name: "Oracle", risk: "medium", category: "Database" },
  3306: { name: "MySQL", risk: "medium", category: "Database" },
  3389: { name: "RDP", risk: "high", category: "Remote Desktop" },
  4444: { name: "Metasploit", risk: "critical", category: "Potential Backdoor" },
  5060: { name: "SIP", risk: "medium", category: "VoIP" },
  5061: { name: "SIP-TLS", risk: "medium", category: "VoIP" },
  5432: { name: "PostgreSQL", risk: "medium", category: "Database" },
  5900: { name: "VNC", risk: "high", category: "Remote Access" },
  8080: { name: "HTTP-Proxy", risk: "medium", category: "Web" },
  8443: { name: "HTTPS-Alt", risk: "low", category: "Web" },
  27017: { name: "MongoDB", risk: "medium", category: "Database" },
  5000: { name: "UPnP", risk: "medium", category: "Network" },
  5001: { name: "Slingbox", risk: "low", category: "Media" },
  5004: { name: "RTP", risk: "medium", category: "VoIP" },
  5005: { name: "RTP", risk: "medium", category: "VoIP" },
  1723: { name: "PPTP", risk: "high", category: "VPN" },
  1194: { name: "OpenVPN", risk: "medium", category: "VPN" },
  4500: { name: "IPSec", risk: "medium", category: "VPN" },
  1080: { name: "SOCKS Proxy", risk: "high", category: "Proxy" },
  3128: { name: "HTTP Proxy", risk: "medium", category: "Proxy" },
  8000: { name: "HTTP-Alt", risk: "low", category: "Web" },
  8888: { name: "HTTP-Alt", risk: "low", category: "Web" },
  9999: { name: "Distinct", risk: "medium", category: "Network" },
  1337: { name: "Waste", risk: "high", category: "Suspicious" },
  31337: { name: "Back Orifice", risk: "critical", category: "Malware" },
  12345: { name: "NetBus", risk: "critical", category: "Malware" },
  6667: { name: "IRC", risk: "medium", category: "Chat" },
  6668: { name: "IRC", risk: "medium", category: "Chat" },
  6669: { name: "IRC", risk: "medium", category: "Chat" },
  7000: { name: "IRC", risk: "medium", category: "Chat" },
  161: { name: "SNMP", risk: "medium", category: "Network" },
  162: { name: "SNMP Trap", risk: "medium", category: "Network" },
  514: { name: "Syslog/Shell", risk: "medium", category: "Network/Remote Access" },
  69: { name: "TFTP", risk: "medium", category: "File Transfer" },
  137: { name: "NetBIOS", risk: "medium", category: "Network" },
  138: { name: "NetBIOS", risk: "medium", category: "Network" },
  139: { name: "NetBIOS", risk: "medium", category: "Network" },
  135: { name: "MSRPC", risk: "high", category: "Remote Access" },
  636: { name: "LDAPS", risk: "low", category: "Directory" },
  389: { name: "LDAP", risk: "low", category: "Directory" },
  2049: { name: "NFS", risk: "high", category: "File Sharing" },
  873: { name: "Rsync", risk: "medium", category: "File Transfer" },
  515: { name: "Printer", risk: "low", category: "Network" },
  548: { name: "AFP", risk: "medium", category: "File Sharing" },
};

// VoIP-related ports
export const voipPorts = {
  sip: [5060, 5061],
  rtp: [5004, 5005, 16384, 16385, 16386, 16387, 16388, 16389, 16390, 16391],
  h323: [1720],
  mgcp: [2427, 2727],
  iax: [4569],
};

// Get port information
export function getPortInfo(port) {
  return portDB[port] || {
    name: "Unknown",
    risk: "unknown",
    category: "Unknown",
  };
}

// Check if port is VoIP-related
export function isVoIPPort(port) {
  return Object.values(voipPorts).some(ports => ports.includes(port));
}

// Get risk level color
export function getRiskColor(risk) {
  const colors = {
    low: "#28a745",
    medium: "#ffc107",
    high: "#fd7e14",
    critical: "#dc3545",
    unknown: "#6c757d",
  };
  return colors[risk] || colors.unknown;
}

