HOSTNAME = "LavenderTown"
DOMAIN = "cooldad.top"
SERVER_IP = "192.168.1.222"
NETWORK_INTERFACE = "enp6s0"
CPU_MODEL = "AMD Ryzen 7 5800X"
CPU_THREADS = 16

STACKS = {
    "bigstackd": {"label": "Core Services", "color": "#e74c3c"},
    "infra": {"label": "Infrastructure", "color": "#3498db"},
    "databases": {"label": "Databases", "color": "#2ecc71"},
    "media": {"label": "Media & Streaming", "color": "#9b59b6"},
    "mailserver": {"label": "Email", "color": "#e67e22"},
    "system": {"label": "System", "color": "#95a5a6"},
}

DISKS = [
    {
        "label": "Boot Drive",
        "device": "nvme0n1p2",
        "mount": "/",
        "host_mount": "/host/home",
    },
    {
        "label": "Shigawire",
        "device": "nvme1n1p1",
        "mount": "/mnt/Shigawire",
        "host_mount": "/host/mnt/Shigawire",
    },
    {
        "label": "Memory Card",
        "device": "sdb",
        "mount": "/mnt/Memory Card",
        "host_mount": "/host/mnt/Memory Card",
    },
    {
        "label": "Bill's Computer",
        "device": "sda",
        "mount": "/mnt/Bill's Computer",
        "host_mount": "/host/mnt/Bill's Computer",
    },
]

SUBDOMAINS = [
    {"subdomain": "auth", "service": "Authentik", "container": "authentik-server", "port": 9010, "auth": False, "stack": "bigstackd"},
    {"subdomain": "celadon", "service": "Homepage", "container": "homepage", "port": 7575, "auth": True, "stack": "infra"},
    {"subdomain": "cerulean", "service": "Jellyfin", "container": "jellyfin", "port": 8096, "auth": False, "stack": "media"},
    {"subdomain": "ceruleancave", "service": "Sonarr", "container": "sonarr", "port": 8989, "auth": True, "stack": "media"},
    {"subdomain": "cinnabar", "service": "Vaultwarden", "container": "vaultwarden", "port": 8084, "auth": False, "stack": "bigstackd"},
    {"subdomain": "fuschia", "service": "Pi-hole", "container": "pihole", "port": 8088, "auth": True, "stack": "bigstackd"},
    {"subdomain": "mtmoon", "service": "Prowlarr", "container": "prowlarr", "port": 9696, "auth": True, "stack": "media"},
    {"subdomain": "nuggetbridge", "service": "Jellyseerr", "container": "jellyseerr", "port": 5055, "auth": True, "stack": "media"},
    {"subdomain": "pallet", "service": "Dockge", "container": "dockge-dockge-1", "port": 5001, "auth": True, "stack": "system"},
    {"subdomain": "pewter", "service": "Uptime Kuma", "container": "uptime-kuma", "port": 3001, "auth": True, "stack": "infra"},
    {"subdomain": "photos", "service": "Immich", "container": "immich-server", "port": 2283, "auth": False, "stack": "media"},
    {"subdomain": "powerplant", "service": "qBittorrent", "container": "qbittorrent", "port": 8090, "auth": True, "stack": "media"},
    {"subdomain": "rocketcorner", "service": "Piped API", "container": "piped-backend", "port": 8081, "auth": False, "stack": "media"},
    {"subdomain": "rockethideout", "service": "Piped Proxy", "container": "piped-proxy", "port": 8080, "auth": False, "stack": "media"},
    {"subdomain": "rocktunnel", "service": "Radarr", "container": "radarr", "port": 7878, "auth": True, "stack": "media"},
    {"subdomain": "silphco", "service": "Piped", "container": "piped-frontend", "port": 8889, "auth": True, "stack": "media"},
    {"subdomain": "viridian", "service": "Baikal", "container": "baikal", "port": 8085, "auth": False, "stack": "infra"},
    {"subdomain": "webmail", "service": "SnappyMail", "container": "snappymail", "port": 8888, "auth": False, "stack": "mailserver"},
]

# Containers not exposed via subdomain but still tracked
INTERNAL_SERVICES = [
    "authentik-worker",
    "authentik-postgres",
    "immich-machine-learning",
    "immich-postgres",
    "immich-redis",
    "piped-postgres",
    "piped-redis",
    "flaresolverr",
    "cloudflared",
    "npm",
    "mailserver",
]

# Containers that have subdomains but should NOT be linked from the dashboard
NO_LINK = [
    "sonarr",
    "radarr",
    "prowlarr",
]
