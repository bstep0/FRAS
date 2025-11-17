"""Network configuration for the University of North Texas EagleNet allowlist."""

from ipaddress import ip_network


UNT_EAGLENET_CIDR_STRINGS = (
    #"129.120.0.0/16",
    "108.192.43.112/32",
    # Additional EagleNet ranges can be appended here as needed.
)


UNT_EAGLENET_NETWORKS = tuple(ip_network(cidr) for cidr in UNT_EAGLENET_CIDR_STRINGS)

