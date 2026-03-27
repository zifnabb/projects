import os
import psutil

from app.config import DISKS, NETWORK_INTERFACE, CPU_MODEL, CPU_THREADS

# Point psutil at host proc/sys if running in container
os.environ.setdefault("HOST_PROC", "/host/proc")
os.environ.setdefault("HOST_SYS", "/host/sys")
psutil.PROCFS_PATH = os.environ.get("HOST_PROC", "/proc")


def _format_bytes(b: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if b < 1024:
            return f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.1f} PB"


def collect() -> dict:
    # CPU
    cpu_percent = psutil.cpu_percent(interval=0.5)

    # Memory
    mem = psutil.virtual_memory()

    # Disks — use os.statvfs on bind-mounted host paths
    disks = []
    for d in DISKS:
        try:
            st = os.statvfs(d["host_mount"])
            total = st.f_frsize * st.f_blocks
            free = st.f_frsize * st.f_bavail
            used = total - free
            percent = round((used / total) * 100, 1) if total > 0 else 0
            disks.append({
                "label": d["label"],
                "device": d["device"],
                "mount": d["mount"],
                "total": total,
                "used": used,
                "free": free,
                "percent": percent,
                "total_human": _format_bytes(total),
                "used_human": _format_bytes(used),
                "free_human": _format_bytes(free),
            })
        except Exception:
            disks.append({
                "label": d["label"],
                "device": d["device"],
                "mount": d["mount"],
                "total": 0,
                "used": 0,
                "free": 0,
                "percent": 0,
                "total_human": "N/A",
                "used_human": "N/A",
                "free_human": "N/A",
            })

    # Network
    net = {"interface": NETWORK_INTERFACE, "ip": "", "bytes_sent": 0, "bytes_recv": 0}
    try:
        addrs = psutil.net_if_addrs()
        if NETWORK_INTERFACE in addrs:
            for addr in addrs[NETWORK_INTERFACE]:
                if addr.family.name == "AF_INET":
                    net["ip"] = addr.address
                    break

        counters = psutil.net_io_counters(pernic=True)
        if NETWORK_INTERFACE in counters:
            nic = counters[NETWORK_INTERFACE]
            net["bytes_sent"] = nic.bytes_sent
            net["bytes_recv"] = nic.bytes_recv
            net["sent_human"] = _format_bytes(nic.bytes_sent)
            net["recv_human"] = _format_bytes(nic.bytes_recv)
    except Exception:
        pass

    return {
        "hostname": "LavenderTown",
        "cpu": {
            "model": CPU_MODEL,
            "threads": CPU_THREADS,
            "percent": cpu_percent,
        },
        "memory": {
            "total": mem.total,
            "used": mem.used,
            "percent": mem.percent,
            "total_human": _format_bytes(mem.total),
            "used_human": _format_bytes(mem.used),
        },
        "disks": disks,
        "network": net,
    }
