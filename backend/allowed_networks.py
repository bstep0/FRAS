"""Network configuration for the University of North Texas EagleNet allowlist.

Campus deployments should use the official UNT EagleNet CIDRs below. Demo or
at-home runs can layer in temporary ranges via the backend's
``HOME_CIDR_STRINGS``/``HOME_CIDRS`` environment variables (see ``app.py``),
but production should remain limited to these campus networks.
"""

from ipaddress import ip_network


UNT_EAGLENET_CIDR_STRINGS = (
    "129.120.0.0/16",
    "108.192.43.112/32",
    # Additional EagleNet ranges can be appended here as needed.
)


UNT_EAGLENET_NETWORKS = tuple(ip_network(cidr) for cidr in UNT_EAGLENET_CIDR_STRINGS)

