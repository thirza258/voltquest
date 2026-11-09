"""Networking courses 1 to 3: foundations, IPv4 addressing, Ethernet switching and ARP."""

from networking_courses.common import (
    IEEE_8021Q, IEEE_8023, device, host, lesson, lines, question, rfc, web,
)

# ---------------------------------------------------------------------------------------------
# Course 1
# ---------------------------------------------------------------------------------------------

C1 = "net-foundations"

COURSE_1 = {
    "id": C1,
    "version": 1,
    "order": 1,
    "title": "1. Networks, models and your first LAN",
    "summary": (
        "Meet the parts of a network: hosts, switches and routers. Learn how the OSI and TCP/IP models "
        "split the work into layers, how data is wrapped into segments, packets and frames, and which IP "
        "settings every host needs. Then build a small LAN and prove it works with ping and a web page."
    ),
    "difficulty": "Fundamental",
    "minutes": 35,
    "lessons": [
        lesson(
            f"{C1}-s1",
            "Hosts, switches and routers",
            [
                "A network moves data between end devices, also called hosts. PCs, laptops, phones, printers "
                "and servers are hosts: they create data and consume it. Intermediary devices sit between the "
                "hosts and forward traffic for them. The two you will use most are switches and routers. "
                "Cables, fiber or radio links (the media) join everything together.",
                "A switch connects hosts inside one local area network (LAN). It reads the destination MAC "
                "address of each Ethernet frame and sends the frame only out of the port that leads to that "
                "host. A router joins different IP networks. It reads the destination IP address of each "
                "packet, looks it up in its routing table and forwards the packet toward the right network. "
                "A home \"router\" usually combines a router, a switch, a Wi-Fi access point and more in one box.",
                "The VoltQuest lab models these devices directly. PCs and servers have one Ethernet port, Fa0. "
                "A switch has eight access ports (Fa0/1 to Fa0/8) and two uplinks (Gi0/1 and Gi0/2). A router "
                "has three ports, Gi0/0 to Gi0/2. Hosts have a desktop with a command prompt, and switches and "
                "routers have the router/switch command line.",
            ],
            "pc",
            lines(
                "! Show this host's IP settings",
                r"C:\> ipconfig",
                "! Show the MAC address and DNS server as well",
                r"C:\> ipconfig /all",
                "! List the commands this command prompt understands",
                r"C:\> help",
            ),
            "Expecting a switch to join two different IP networks. A switch only forwards frames inside one "
            "LAN. Hosts with addresses in different subnets need a router between them, even when they are "
            "plugged into the same switch.",
            question(
                f"{C1}-q1",
                "Which device forwards traffic between two different IP networks?",
                [
                    "A switch, using its MAC address table",
                    "A router, using its routing table",
                    "A host, using its ARP cache",
                ],
                "b",
                "Routers connect networks and choose a path by destination IP address. Switches forward frames "
                "inside one LAN, and hosts do not forward other devices' traffic.",
            ),
        ),
        lesson(
            f"{C1}-s2",
            "The OSI and TCP/IP models",
            [
                "Networking is split into layers so that each layer does one job and can change without "
                "breaking the others. The OSI reference model has seven layers: physical, data link, network, "
                "transport, session, presentation and application. The TCP/IP model, which the Internet's "
                "protocols actually follow (RFC 1122), groups the same work into four layers: link (network "
                "access), internet, transport and application.",
                "Each layer offers a service to the layer above it. Ethernet at the data link layer moves "
                "frames across one link. IP at the network (internet) layer carries packets from source to "
                "destination across many links. TCP and UDP at the transport layer deliver data to the right "
                "application, identified by a port number. Application protocols such as HTTP, DNS and DHCP "
                "define what the data means.",
                "Layers also give you a troubleshooting order. When something fails, start at the bottom: is "
                "the cable connected and the port up? Does the host have the right IP settings? Does a route "
                "exist? Only then suspect the service or the application. The lab's step-by-step view lists "
                "the layers inside every frame, so you can see exactly where a packet stops.",
            ],
            "none",
            lines(
                "OSI layer        TCP/IP layer      Data unit   Examples",
                "7 Application    Application       data        HTTP, DNS, DHCP",
                "6 Presentation   Application       data        data formats, encryption",
                "5 Session        Application       data        dialogs between applications",
                "4 Transport      Transport         segment     TCP, UDP, port numbers",
                "3 Network        Internet          packet      IPv4, ICMP",
                "2 Data link      Link              frame       Ethernet, MAC addresses",
                "1 Physical       Link              bits        cables, signals, radio",
            ),
            "Treating the models as rules that every protocol follows exactly. They are reference maps. Some "
            "protocols sit between layers (ARP links layer 3 addresses to layer 2 addresses), so use the models "
            "to organize your thinking and your troubleshooting, not to argue about labels.",
            question(
                f"{C1}-q2",
                "At which layer does a router make its forwarding decision?",
                [
                    "Layer 2, using the destination MAC address",
                    "Layer 3, using the destination IP address",
                    "Layer 4, using the destination port number",
                ],
                "b",
                "A router is a layer 3 device: it compares the destination IP address with its routing table. "
                "It rewrites the layer 2 frame for the next link, but the choice of path comes from layer 3.",
            ),
        ),
        lesson(
            f"{C1}-s3",
            "Encapsulation: from data to frames",
            [
                "When a host sends data, each layer adds its own header in front of what it received from the "
                "layer above. This is encapsulation. A web request becomes a TCP segment (with ports), then an "
                "IP packet (with addresses and a TTL), then an Ethernet frame (with MAC addresses and a frame "
                "check sequence), and finally bits on the wire. The receiver reverses the process, which is "
                "called decapsulation.",
                "Devices only look as deep as their job needs. A switch reads the frame header and forwards the "
                "frame unchanged. A router removes the frame, reads the IP packet, decrements the TTL and builds "
                "a new frame for the next link. That is why MAC addresses change at every router hop, while the "
                "source and destination IP addresses stay the same from end to end, unless NAT rewrites them "
                "(course 10).",
                "In the lab, the step-by-step view lists the headers of each frame as it crosses a cable: "
                "Ethernet II, then IPv4, then ICMP, UDP or TCP, and HTTP, DNS or DHCP at the top. Watching one "
                "web request travel from a PC through a switch to a server is the fastest way to see "
                "encapsulation in action.",
            ],
            "none",
            lines(
                "Application   HTTP request \"GET /\"",
                "Transport     + TCP header: source port 1025, destination port 80",
                "Internet      + IPv4 header: 192.168.1.10 to 192.168.1.20, TTL 128",
                "Link          + Ethernet header: source MAC, destination MAC, type IPv4",
                "              + frame check sequence (FCS) trailer, 4 bytes",
                "Physical      bits on the cable",
            ),
            "Assuming MAC addresses travel end to end. Each router builds a new frame, so the destination MAC "
            "is always the next hop on the current link. Only the IP addresses identify the final source and "
            "destination.",
            question(
                f"{C1}-q3",
                "A packet crosses one router. What does the router change?",
                [
                    "The source and destination IP addresses, so the reply comes back to it",
                    "The TCP ports, so that each session through it stays unique",
                    "The Ethernet header (new source and destination MAC) and the TTL",
                ],
                "c",
                "The router decrements the TTL and wraps the packet in a new frame for the next link, with its "
                "own MAC as the source and the next hop's MAC as the destination. Without NAT, IP addresses and "
                "ports stay the same.",
            ),
        ),
        lesson(
            f"{C1}-s4",
            "IP settings and ping",
            [
                "Every host needs four IPv4 settings. The address identifies the host. The subnet mask tells the "
                "host which other addresses are on its own network. The default gateway is the router address "
                "it uses for every other destination. The DNS server turns names into addresses. You can type "
                "these settings by hand (static) or get them from a DHCP server, which course 8 covers.",
                "Ping tests reachability with ICMP (RFC 792). The sender transmits echo requests and the target "
                "answers with echo replies. `Reply from` with a TTL value means success. `Request timed out.` "
                "means no answer came back. `Destination host unreachable` or `Destination net unreachable` means "
                "a device on the path reported that it could not deliver the packet. The TTL in a reply hints at "
                "distance: hosts in this lab start at "
                "128, like Windows, so TTL=128 means no router was crossed and TTL=127 means one router.",
                "Test from near to far: your own gateway, then a host in your subnet, then a remote host. A host "
                "with no address, or with no gateway for a remote target, prints `PING: transmit failed. General "
                "failure.` That message points at the host's own settings, not at the network.",
            ],
            "pc",
            lines(
                "! Read the address, mask and gateway",
                r"C:\> ipconfig",
                "! Four echo requests to a neighbor on the same LAN",
                r"C:\> ping 192.168.1.11",
                "! Only two echo requests this time",
                r"C:\> ping 192.168.1.11 -n 2",
                "! The IP-to-MAC mappings learned while pinging",
                r"C:\> arp -a",
            ),
            "Testing only inside your own subnet. A host with no default gateway, or the wrong one, still "
            "reaches its neighbors, so local pings pass and hide the problem. Always test one address outside "
            "the subnet as well.",
            question(
                f"{C1}-q4",
                "PC1 gets `Reply from 192.168.2.10: bytes=32 time<1ms TTL=127`. What does TTL=127 tell you?",
                [
                    "The reply crossed one router, because the sender started at 128",
                    "The target is on PC1's own subnet, so no router was involved",
                    "127 packets were lost, so the link is badly overloaded",
                ],
                "a",
                "Each router decrements the TTL by one. Lab hosts start at 128, so 127 means exactly one router "
                "hop. A reply from the same subnet keeps TTL=128.",
            ),
        ),
    ],
    "steps": [
        "Open PC1's IP configuration and set address 192.168.1.10 with mask 255.255.255.0. Leave the gateway "
        "empty: this LAN has no router.",
        "Give PC2 the address 192.168.1.11 with the same mask, 255.255.255.0.",
        "In PC1's command prompt run `ipconfig` and check that the address and mask match what you typed.",
        "Run `ping 192.168.1.11` on PC1. Expect four replies with TTL=128, because no router sits between the PCs.",
        "Run `arp -a` on PC1 to see the MAC address it learned for PC2, then ping PC1 (192.168.1.10) from PC2.",
        "Open http://192.168.1.20 in PC1's web browser, then use the step-by-step view to find the TCP and HTTP "
        "layers inside the frames.",
        "Press Check results.",
    ],
    "expected": (
        "Both PCs show their new addresses in `ipconfig`. Pings succeed in both directions with TTL=128, "
        "`arp -a` on PC1 lists 192.168.1.11 with a MAC address that starts with 00-60, and PC1's browser shows "
        "Server1's page."
    ),
    "challenge": {
        "task": (
            "Course labs cannot be edited, so use \"Open a sandbox copy in a new tab\" under the lab and work in the copy. "
            "Connect a third PC to a free port on S1 and give it 192.168.1.12/24. Prove that it reaches every "
            "other host. Then change its address to 192.168.2.12/24 and explain why the same cable and switch "
            "no longer get it any replies from PC1."
        ),
        "acceptance": [
            "PC3 is cabled to a free S1 port and pings PC1, PC2 and Server1 with TTL=128",
            "With 192.168.2.12/24, PC3's ping to 192.168.1.10 fails",
            "You explain that PC3 is now in another subnet and would need a router and a default gateway",
        ],
    },
    "lab": {
        "title": "Your first LAN: two PCs and a server on one switch",
        "brief": (
            "PC1 and PC2 are cabled to switch S1 but have no IP settings yet. Server1 already uses "
            "192.168.1.20/24 and serves a web page. Give PC1 192.168.1.10/24 and PC2 192.168.1.11/24, then "
            "prove with ping and the web browser that all three hosts can talk."
        ),
        "topology": {
            "devices": [
                device("PC1", "pc", 120, 110),
                device("PC2", "pc", 120, 300),
                device("S1", "switch", 380, 205),
                device("Server1", "server", 640, 205, host("192.168.1.20", "255.255.255.0"),
                       web("Hello from Server1. Your first LAN works.")),
            ],
            "links": ["PC1 Fa0 S1 Fa0/1", "PC2 Fa0 S1 Fa0/2", "Server1 Fa0 S1 Fa0/3"],
        },
        "goals": [
            {"type": "host", "device": "PC1", "ip": "192.168.1.10", "mask": "255.255.255.0",
             "label": "PC1 uses 192.168.1.10 with mask 255.255.255.0"},
            {"type": "host", "device": "PC2", "ip": "192.168.1.11", "mask": "255.255.255.0",
             "label": "PC2 uses 192.168.1.11 with mask 255.255.255.0"},
            {"type": "ping", "from": "PC1", "to": "192.168.1.11", "label": "PC1 gets echo replies from PC2"},
            {"type": "ping", "from": "PC2", "to": "192.168.1.10", "label": "PC2 gets echo replies from PC1"},
            {"type": "http", "from": "PC1", "url": "http://192.168.1.20", "label": "PC1 loads Server1's web page"},
        ],
        "solution": [
            {"device": "PC1", "host": host("192.168.1.10", "255.255.255.0")},
            {"device": "PC2", "host": host("192.168.1.11", "255.255.255.0")},
        ],
    },
    "exam": {
        "passPercent": 80,
        "questions": [
            question(
                f"{C1}-e1",
                "PC1 (192.168.1.10/24) and PC2 (192.168.2.10/24) plug into the same switch. What do they need "
                "to communicate?",
                [
                    "Nothing: the switch forwards frames between any two of its ports",
                    "A second switch, so that each subnet has its own broadcast domain",
                    "A router with an address in each subnet, set as each PC's default gateway",
                ],
                "c",
                "Different subnets need a layer 3 hop. Each PC sends off-subnet traffic to its gateway, so a "
                "router must own an address in both subnets.",
                f"{C1}-s1",
            ),
            question(
                f"{C1}-e2",
                "Which TCP/IP layer delivers packets between networks using IP addresses?",
                ["Transport", "Internet", "Link"],
                "b",
                "The internet layer (OSI layer 3) carries IP packets across routers. The transport layer "
                "identifies applications by port, and the link layer moves frames across one link.",
                f"{C1}-s2",
            ),
            question(
                f"{C1}-e3",
                "In which order does a sending host build its data units?",
                [
                    "Data, segment, packet, frame, bits",
                    "Data, packet, segment, frame, bits",
                    "Bits, frame, packet, segment, data",
                ],
                "a",
                "Encapsulation works top-down: the data gets a transport header (segment), then an IP header "
                "(packet), then an Ethernet header and trailer (frame), and leaves as bits. The last option is "
                "the receiver's decapsulation order.",
                f"{C1}-s3",
            ),
            question(
                f"{C1}-e4",
                "PC1 reaches hosts on its own subnet but not a server on another subnet, and `ipconfig` shows "
                "Default Gateway 0.0.0.0. What is the most likely cause?",
                [
                    "The switch port is shut down",
                    "No default gateway is configured on PC1",
                    "The server's web service is turned off",
                ],
                "b",
                "Local pings prove that the cable, the switch and the address work. Without a gateway PC1 has "
                "nowhere to send off-subnet packets, and the lab prints `PING: transmit failed. General failure.`",
                f"{C1}-s4",
            ),
            question(
                f"{C1}-e5",
                "Which value stays the same while a packet crosses two routers (no NAT)?",
                [
                    "The destination MAC address",
                    "The time-to-live (TTL) value",
                    "The destination IP address",
                ],
                "c",
                "Routers rewrite the frame, including both MAC addresses, and decrement the TTL at every hop. "
                "The destination IP address names the final target and does not change.",
                f"{C1}-s3",
            ),
        ],
    },
    "sources": [
        rfc(1122, "Requirements for Internet Hosts - Communication Layers"),
        rfc(791, "Internet Protocol"),
        rfc(792, "Internet Control Message Protocol"),
        IEEE_8023,
    ],
}

# ---------------------------------------------------------------------------------------------
# Course 2
# ---------------------------------------------------------------------------------------------

C2 = "net-addressing"

R1_TWO_LANS = [
    "enable",
    "configure terminal",
    "interface g0/0",
    "description LAN A",
    "ip address 192.168.10.1 255.255.255.0",
    "no shutdown",
    "interface g0/1",
    "description LAN B",
    "ip address 192.168.20.1 255.255.255.192",
    "no shutdown",
    "end",
]

COURSE_2 = {
    "id": C2,
    "version": 1,
    "order": 2,
    "title": "2. IPv4 addressing and subnetting",
    "summary": (
        "Read IPv4 addresses in binary, turn prefixes into masks, and work out the network, broadcast and "
        "host range of any subnet. Split a network into right-sized subnets, recognize private ranges, and "
        "see why every host needs a gateway inside its own subnet. The lab has you repair wrong masks, "
        "gateways and addresses."
    ),
    "difficulty": "Fundamental",
    "minutes": 45,
    "lessons": [
        lesson(
            f"{C2}-s1",
            "IPv4 addresses in binary",
            [
                "An IPv4 address is a 32-bit number. People write it as four decimal octets separated by dots, "
                "such as 192.168.10.25. Each octet holds 8 bits, so its value runs from 0 to 255. Hosts and "
                "routers work with the bits, so you need to move between decimal and binary quickly.",
                "Each bit in an octet has a place value: 128, 64, 32, 16, 8, 4, 2 and 1, from left to right. To "
                "convert decimal to binary, subtract the largest place values that fit: 192 is 128 + 64, so it "
                "is 11000000. To convert back, add the values of the 1 bits. With practice you will recognize "
                "128, 192, 224, 240, 248, 252, 254 and 255 at sight, because they appear in subnet masks.",
                "Some addresses are special. 127.0.0.0/8 is loopback (the host itself), 0.0.0.0 means \"no "
                "address yet\", 255.255.255.255 is the limited broadcast, and 169.254.0.0/16 is link-local, "
                "which many hosts pick when DHCP fails. The old classes A, B and C are history: since CIDR "
                "(RFC 4632) the mask, not the first octet, decides the size of a network.",
            ],
            "none",
            lines(
                "Place values:  128  64  32  16   8   4   2   1",
                "192 = 128 + 64          = 1100 0000",
                "168 = 128 + 32 + 8      = 1010 1000",
                " 10 = 8 + 2             = 0000 1010",
                " 25 = 16 + 8 + 1        = 0001 1001",
                "192.168.10.25 = 11000000.10101000.00001010.00011001",
            ),
            "Reading bits from the wrong end. The leftmost bit of an octet is worth 128 and the rightmost is "
            "worth 1. 11000000 is 192, while 00000011 is only 3.",
            question(
                f"{C2}-q1",
                "What is 172 in binary?",
                ["10110100", "10101100", "11001010"],
                "b",
                "128 + 32 + 8 + 4 = 172, so the bits for 128, 32, 8 and 4 are set: 10101100. 10110100 is 180 "
                "and 11001010 is 202.",
            ),
        ),
        lesson(
            f"{C2}-s2",
            "Masks, prefixes and CIDR",
            [
                "A subnet mask marks which bits of an address belong to the network. Its 1 bits come first and "
                "run without gaps; the 0 bits that follow mark the host part. CIDR notation counts the 1 bits: "
                "/24 is 255.255.255.0, /26 is 255.255.255.192 and /30 is 255.255.255.252. A device finds an "
                "address's network with a bitwise AND of the address and the mask.",
                "With h host bits, a subnet holds 2^h addresses. The first is the network address and the last "
                "is the broadcast address, so 2^h - 2 are usable for hosts. A /24 has 254 hosts, a /26 has 62 "
                "and a /30 has 2, which is exactly enough for a link between two routers. A /31 (RFC 3021) also "
                "suits point-to-point links, and a /32 names a single host.",
                "A quick method uses the block size: 256 minus the mask's last octet that is not 255. For /26 "
                "the block is 256 - 192 = 64, so subnets start at .0, .64, .128 and .192. Find the block that "
                "contains the address: its first address is the network, the next block's start minus one is "
                "the broadcast, and everything in between is the host range.",
            ],
            "none",
            lines(
                "/24 = 255.255.255.0     = 11111111.11111111.11111111.00000000",
                "/26 = 255.255.255.192   = 11111111.11111111.11111111.11000000",
                "/27 = 255.255.255.224   block size 32, 30 usable hosts",
                "/30 = 255.255.255.252   block size 4, 2 usable hosts",
                "Address 192.168.10.77/26, block size 64",
                "  network     192.168.10.64",
                "  first host  192.168.10.65",
                "  last host   192.168.10.126",
                "  broadcast   192.168.10.127",
            ),
            "Using the network or broadcast address as a host address. 192.168.10.64 and 192.168.10.127 are not "
            "usable in 192.168.10.64/26. A router refuses them, for example with `Bad mask /26 for address "
            "192.168.10.64`.",
            question(
                f"{C2}-q2",
                "How many usable host addresses does a /27 provide?",
                ["32", "62", "30"],
                "c",
                "A /27 leaves 5 host bits: 2^5 = 32 addresses, minus the network and broadcast addresses, gives "
                "30 usable hosts.",
            ),
        ),
        lesson(
            f"{C2}-s3",
            "Subnetting and VLSM",
            [
                "Subnetting borrows host bits to make more, smaller networks. Each borrowed bit doubles the "
                "number of subnets and halves their size. Splitting 192.168.50.0/24 into four equal parts "
                "borrows 2 bits and gives four /26 subnets of 62 hosts each. Smaller broadcast domains keep "
                "broadcasts local and let you apply different rules to different groups.",
                "Real networks rarely need equal sizes. Variable-length subnet masking (VLSM) sizes each subnet "
                "to its need. Start with the largest requirement, place it on a block boundary, then fit the next "
                "largest into the space that remains. Router-to-router links get a /30 (or a /31), so they waste "
                "almost no addresses.",
                "Plan and document before you configure. Write each subnet's network, mask, gateway and "
                "broadcast address in a table. Overlapping subnets are a classic error: a router refuses an "
                "interface address that overlaps a subnet on another of its interfaces, and hosts with "
                "overlapping ranges make wrong decisions about which addresses are local.",
            ],
            "none",
            lines(
                "Need: 4 equal subnets from 192.168.50.0/24, so borrow 2 bits: /26",
                "Subnet 1: 192.168.50.0/26     hosts .1 to .62      broadcast .63",
                "Subnet 2: 192.168.50.64/26    hosts .65 to .126    broadcast .127",
                "Subnet 3: 192.168.50.128/26   hosts .129 to .190   broadcast .191",
                "Subnet 4: 192.168.50.192/26   hosts .193 to .254   broadcast .255",
                "VLSM instead: 100 hosts .0/25, 50 hosts .128/26, 20 hosts .192/27, link .224/30",
            ),
            "Overlapping subnets. If LAN A is 10.1.1.0/24 and LAN B is 10.1.1.128/25, the ranges overlap. A "
            "router refuses the second address with an `overlaps with` message, and hosts in the overlap send "
            "traffic to the wrong place.",
            question(
                f"{C2}-q3",
                "Each subnet must hold 50 hosts. Which is the smallest prefix that fits?",
                ["/26, with 62 usable hosts", "/27, with 30 usable hosts", "/25, with 126 usable hosts"],
                "a",
                "50 hosts need 6 host bits (2^6 - 2 = 62). A /27 is too small, and a /25 wastes 76 addresses per "
                "subnet.",
            ),
        ),
        lesson(
            f"{C2}-s4",
            "Private ranges and the default gateway",
            [
                "RFC 1918 reserves three ranges for private networks: 10.0.0.0/8, 172.16.0.0/12 (172.16.0.0 to "
                "172.31.255.255) and 192.168.0.0/16. Anyone may use them internally, so the public Internet does "
                "not route them; NAT translates them at the edge (course 10). Other reserved blocks include "
                "100.64.0.0/10 for carrier-grade NAT, and 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24 for "
                "documentation, which this track uses as stand-ins for public addresses.",
                "Before sending, a host ANDs the destination with its own mask. If the result equals its own "
                "network, the destination is on-link and the host ARPs for it directly. Otherwise the host ARPs "
                "for its default gateway and hands the packet to the router. So the gateway must be an address "
                "inside the host's own subnet, and the mask must be right, or the host makes the wrong choice.",
                "A wrong mask can hide for a long time. A mask that is too short makes remote hosts look local, "
                "so the host ARPs for them and nobody answers. Many routers enable proxy ARP by default and "
                "answer such requests on behalf of remote hosts, which hides the mistake. The VoltQuest lab's "
                "routers do not, like routers where proxy ARP is turned off as a hardening step.",
            ],
            "pc",
            lines(
                "! Are the address, mask and gateway right?",
                r"C:\> ipconfig",
                "! Can the PC reach its own gateway?",
                r"C:\> ping 192.168.10.1",
                "! Can it reach a host in the other subnet?",
                r"C:\> ping 192.168.20.10",
                "! Which hops does the path take?",
                r"C:\> tracert 192.168.20.10",
            ),
            "A gateway outside the host's subnet. A host with 192.168.10.25/24 and gateway 192.168.1.1 cannot "
            "reach that router, so every remote destination fails even though the router itself is fine.",
            question(
                f"{C2}-q4",
                "Which of these is a private RFC 1918 address?",
                ["172.32.5.9", "192.169.1.1", "172.20.5.9"],
                "c",
                "172.16.0.0/12 runs from 172.16.0.0 to 172.31.255.255, so 172.20.5.9 is private. 172.32.5.9 and "
                "192.169.1.1 are public addresses.",
            ),
        ),
    ],
    "steps": [
        "Run `ipconfig` on each PC and compare it with the plan in the brief. PC1 is the reference: it already "
        "pings 192.168.10.1 and 192.168.20.1.",
        "PC2's default gateway is 192.168.1.1, an address outside LAN A. Change it to 192.168.10.1.",
        "PC3 uses mask 255.255.0.0, so it treats 192.168.10.x as local and ARPs for PC1 directly. Nobody answers, "
        "because this lab's router does not use proxy ARP. Set the mask to 255.255.255.192.",
        "PC4's address 192.168.20.70 lies outside 192.168.20.0/26, whose hosts run from .1 to .62. Change it to "
        "192.168.20.11 with mask 255.255.255.192.",
        "Ping across R1 from every PC. The first ping can show one `Request timed out.` while R1 resolves ARP; "
        "the replies that follow show TTL=127.",
        "Run `tracert 192.168.20.11` on PC1: hop 1 is 192.168.10.1 and hop 2 is PC4.",
        "Press Check results.",
    ],
    "expected": (
        "All four PCs match the plan. Pings between LAN A and LAN B succeed with TTL=127 (the first one may lose "
        "a packet to ARP), and PC1's `tracert 192.168.20.11` lists 192.168.10.1 and then 192.168.20.11."
    ),
    "challenge": {
        "task": (
            "Course labs cannot be edited, so use \"Open a sandbox copy in a new tab\" under the lab and work in the copy. "
            "A new lab room with 25 hosts needs its own subnet. Carve the smallest subnet that fits out of the "
            "unused range 192.168.20.64 to 192.168.20.127, give R1 Gi0/2 the first usable address of it, and "
            "connect a test PC that reaches PC1."
        ),
        "acceptance": [
            "The new subnet is 192.168.20.64/27 (30 usable hosts) and does not overlap 192.168.20.0/26",
            "R1 Gi0/2 has 192.168.20.65 255.255.255.224 and shows up/up after `no shutdown`",
            "A PC with 192.168.20.66/27 and gateway 192.168.20.65 pings 192.168.10.10",
        ],
    },
    "lab": {
        "title": "Repair the addressing plan",
        "brief": (
            "R1 already routes between LAN A (192.168.10.0/24, gateway 192.168.10.1) and LAN B "
            "(192.168.20.0/26, gateway 192.168.20.1). The plan gives PC1 192.168.10.10, PC2 192.168.10.11, PC3 "
            "192.168.20.10 and PC4 192.168.20.11. PC1 is correct, but PC2, PC3 and PC4 each have one wrong "
            "setting: a gateway, a mask or an address. Find each mistake with ipconfig and ping, fix it, and make "
            "every PC reach the other LAN."
        ),
        "topology": {
            "devices": [
                device("PC1", "pc", 80, 100, host("192.168.10.10", "255.255.255.0", "192.168.10.1")),
                device("PC2", "pc", 80, 310, host("192.168.10.11", "255.255.255.0", "192.168.1.1")),
                device("S1", "switch", 230, 205),
                device("R1", "router", 380, 205, config=R1_TWO_LANS),
                device("S2", "switch", 530, 205),
                device("PC3", "pc", 680, 100, host("192.168.20.10", "255.255.0.0", "192.168.20.1")),
                device("PC4", "pc", 680, 310, host("192.168.20.70", "255.255.255.192", "192.168.20.1")),
            ],
            "links": [
                "PC1 Fa0 S1 Fa0/1",
                "PC2 Fa0 S1 Fa0/2",
                "S1 Gi0/1 R1 Gi0/0",
                "R1 Gi0/1 S2 Gi0/1",
                "PC3 Fa0 S2 Fa0/1",
                "PC4 Fa0 S2 Fa0/2",
            ],
        },
        "goals": [
            {"type": "host", "device": "PC2", "gateway": "192.168.10.1",
             "label": "PC2 uses 192.168.10.1, R1's address in LAN A, as its gateway"},
            {"type": "host", "device": "PC3", "mask": "255.255.255.192",
             "label": "PC3 uses the LAN B mask, 255.255.255.192 (/26)"},
            {"type": "host", "device": "PC4", "ip": "192.168.20.11", "mask": "255.255.255.192", "gateway": "192.168.20.1",
             "label": "PC4 uses 192.168.20.11/26, inside 192.168.20.0/26"},
            {"type": "ping", "from": "PC2", "to": "192.168.20.10", "label": "PC2 reaches PC3 across R1"},
            {"type": "ping", "from": "PC3", "to": "192.168.10.10", "label": "PC3 reaches PC1 across R1"},
            {"type": "ping", "from": "PC4", "to": "192.168.10.11", "label": "PC4 reaches PC2 across R1"},
            {"type": "ping", "from": "PC1", "to": "192.168.20.11", "label": "PC1 reaches PC4 across R1"},
        ],
        "solution": [
            {"device": "PC2", "host": host("192.168.10.11", "255.255.255.0", "192.168.10.1")},
            {"device": "PC3", "host": host("192.168.20.10", "255.255.255.192", "192.168.20.1")},
            {"device": "PC4", "host": host("192.168.20.11", "255.255.255.192", "192.168.20.1")},
        ],
    },
    "exam": {
        "passPercent": 80,
        "questions": [
            question(
                f"{C2}-e1",
                "What is 11000000.10101000.00000001.01100100 in dotted decimal?",
                ["192.168.1.68", "192.168.1.100", "192.168.128.100"],
                "b",
                "11000000 is 192, 10101000 is 168, 00000001 is 1, and 01100100 is 64 + 32 + 4 = 100.",
                f"{C2}-s1",
            ),
            question(
                f"{C2}-e2",
                "What is the broadcast address of 10.20.30.40/28?",
                ["10.20.30.47", "10.20.30.255", "10.20.30.48"],
                "a",
                "A /28 has a block size of 16. 40 falls in the block from 32 to 47, so the network is "
                "10.20.30.32 and the broadcast 10.20.30.47. 10.20.30.48 starts the next subnet.",
                f"{C2}-s2",
            ),
            question(
                f"{C2}-e3",
                "You split 172.16.0.0/24 into /26 subnets. Which is the third subnet?",
                ["172.16.0.64/26", "172.16.0.192/26", "172.16.0.128/26"],
                "c",
                "The block size is 64, so the subnets start at .0, .64, .128 and .192. The third one is "
                "172.16.0.128/26.",
                f"{C2}-s3",
            ),
            question(
                f"{C2}-e4",
                "A host has 192.168.10.25/24 and gateway 192.168.1.1. Local pings work; remote ones fail. Why?",
                [
                    "The gateway is outside the host's subnet, so the host cannot reach it",
                    "A /24 mask only allows traffic inside the host's own subnet",
                    "The host has no DNS server, so it cannot resolve the names of remote hosts",
                ],
                "a",
                "Remote traffic goes to the gateway, which must be reachable on the local subnet. 192.168.1.1 is "
                "outside 192.168.10.0/24. DNS plays no part when you ping addresses.",
                f"{C2}-s4",
            ),
            question(
                f"{C2}-e5",
                "Why does a router reject `ip address 192.168.10.64 255.255.255.192`?",
                [
                    "/26 masks are not allowed on router interfaces, only on hosts",
                    "It is the network address of 192.168.10.64/26, not a host address",
                    "It is the broadcast address of the 192.168.10.0/24 network",
                ],
                "b",
                "With a /26, 192.168.10.64 is the first address of its block, the network address. The router "
                "prints `Bad mask /26 for address 192.168.10.64`.",
                f"{C2}-s2",
            ),
        ],
    },
    "sources": [
        rfc(950, "Internet Standard Subnetting Procedure"),
        rfc(4632, "Classless Inter-domain Routing (CIDR)"),
        rfc(1918, "Address Allocation for Private Internets"),
        rfc(5737, "IPv4 Address Blocks Reserved for Documentation"),
    ],
}

# ---------------------------------------------------------------------------------------------
# Course 3
# ---------------------------------------------------------------------------------------------

C3 = "net-switching"

COURSE_3 = {
    "id": C3,
    "version": 1,
    "order": 3,
    "title": "3. Ethernet switching and ARP",
    "summary": (
        "Look inside Ethernet frames and MAC addresses, and see how a switch learns, floods, forwards and "
        "filters. Use ARP to connect IP addresses to MAC addresses, understand broadcast domains, and learn why "
        "redundant links need Spanning Tree. The lab has you read MAC and ARP tables and bring up shut switch "
        "ports."
    ),
    "difficulty": "Fundamental",
    "minutes": 40,
    "lessons": [
        lesson(
            f"{C3}-s1",
            "Ethernet frames and MAC addresses",
            [
                "Ethernet (IEEE 802.3) carries data across a LAN in frames. A frame starts with the destination "
                "MAC address and the source MAC address, followed by an EtherType that says what the payload is: "
                "0x0800 for IPv4, 0x0806 for ARP, or 0x8100 when an 802.1Q VLAN tag follows. The payload holds "
                "the packet, and a 4-byte frame check sequence (FCS) at the end lets the receiver detect "
                "damaged frames.",
                "A MAC address is 48 bits long and written in hexadecimal. The first half is usually the "
                "manufacturer's organizationally unique identifier (OUI); the rest identifies the network card. "
                "A unicast address names one interface, the broadcast address ffff.ffff.ffff reaches every "
                "device in the LAN, and multicast addresses reach a group. Network equipment writes MACs as "
                "0060.1a2b.3c00, while Windows writes 00-60-1A-2B-3C-00.",
                "In the lab every port has a fixed MAC address that starts with 0060 and is derived from its "
                "device, so it stays the same each time you open the lab. Switches print it with dots in `show "
                "mac address-table`; PCs print it with dashes in `ipconfig /all` and `arp -a`.",
            ],
            "none",
            lines(
                "Ethernet II frame, field by field",
                "Destination MAC   6 bytes        ffff.ffff.ffff (broadcast) or one host",
                "Source MAC        6 bytes        always one sender, never broadcast",
                "EtherType         2 bytes        0x0800 IPv4, 0x0806 ARP, 0x8100 802.1Q tag",
                "Payload           46-1500 bytes  the IP packet or ARP message",
                "FCS               4 bytes        CRC-32 check over the frame",
            ),
            "Mixing up the broadcast MAC with broadcast IP addresses. ffff.ffff.ffff tells switches to flood a "
            "frame; 255.255.255.255 or 192.168.1.255 tell hosts that a packet is for everyone in the subnet. "
            "They live in different headers and do different jobs.",
            question(
                f"{C3}-q1",
                "Which EtherType value marks an ARP message?",
                ["0x0806", "0x0800", "0x8100"],
                "a",
                "0x0806 is ARP. 0x0800 marks IPv4, and 0x8100 marks an 802.1Q VLAN tag.",
            ),
        ),
        lesson(
            f"{C3}-s2",
            "How a switch learns, floods, forwards and filters",
            [
                "A switch builds its MAC address table by learning. For every frame that arrives, it records the "
                "source MAC address, the port it came in on and the VLAN. No configuration is needed: the table "
                "fills as hosts talk.",
                "Then it decides what to do with the frame. If the destination MAC is in the table, the switch "
                "forwards the frame out of that one port. If the destination is the broadcast address or an "
                "unknown unicast address, it floods the frame out of every other port in the same VLAN. If the "
                "destination sits behind the port the frame came in on, it filters (drops) the frame. Real "
                "switches also age out silent entries, typically after about five minutes; the lab keeps them "
                "until you clear them.",
                "`show mac address-table` prints the table and `clear mac address-table dynamic` empties it. "
                "After a clear, frames to unknown destinations are flooded again until the switch relearns where "
                "each host lives. The lab's step-by-step view prints each decision: Learned, Broadcast or Unknown "
                "unicast flooded, Forwarded (MAC table), or Filtered.",
            ],
            "switch",
            lines(
                "S1> enable",
                "! Which MAC address sits behind which port, in which VLAN?",
                "S1# show mac address-table",
                "! Forget the learned entries; they return as hosts talk",
                "S1# clear mac address-table dynamic",
                "S1# show mac address-table",
            ),
            "Reading an empty MAC table as a fault. A switch only learns a host when that host sends a frame. A "
            "silent host is missing until it talks, so send some traffic (a ping) before you read `show mac "
            "address-table`.",
            question(
                f"{C3}-q2",
                "A switch receives a frame whose destination MAC address is not in its table. What does it do?",
                [
                    "Drops the frame, because the destination is unknown",
                    "Sends it back out of the port it arrived on",
                    "Floods it out of every other port in the same VLAN",
                ],
                "c",
                "An unknown unicast is flooded within the frame's VLAN, like a broadcast. When the destination "
                "answers, the switch learns its port and later frames go out of that port only.",
            ),
        ),
        lesson(
            f"{C3}-s3",
            "ARP: from IP address to MAC address",
            [
                "To build a frame, a host needs the next hop's MAC address, but it usually knows only an IP "
                "address. The Address Resolution Protocol (ARP, RFC 826) fills the gap. The host broadcasts a "
                "request, \"Who has 192.168.1.11? Tell 192.168.1.10\", and the owner of that address answers "
                "with a unicast reply that carries its MAC. Both sides cache the mapping in their ARP tables.",
                "For a destination in another subnet, the host never ARPs for the destination itself. It ARPs for "
                "its default gateway and sends the frame to the router's MAC address. So `arp -a` on a PC shows "
                "its neighbors and its gateway, never a server behind a router. Routers keep their own ARP "
                "tables, shown with `show ip arp`.",
                "ARP has no authentication. Any device on the LAN can send false replies and pull traffic through "
                "itself (ARP spoofing). Switch features such as dynamic ARP inspection defend against this; the "
                "lab does not simulate them. One lab behavior matters for your tests: like many real routers, a "
                "lab router drops the packet that triggered its ARP request, so the first ping through a router "
                "often shows one `Request timed out.`",
            ],
            "pc",
            lines(
                "! Nothing is cached yet",
                r"C:\> arp -a",
                r"C:\> ping 192.168.1.11",
                "! The neighbor's MAC address is now cached",
                r"C:\> arp -a",
                "! For a remote target the PC resolves its gateway instead",
                r"C:\> ping 192.168.2.10",
                r"C:\> arp -a",
            ),
            "Looking for a remote server's MAC address in `arp -a`. Frames only cross one link, so a PC learns "
            "its gateway's MAC for every remote destination. The server's MAC never leaves the server's own LAN.",
            question(
                f"{C3}-q3",
                "PC1 (192.168.1.10/24, gateway 192.168.1.1) pings 10.5.5.5 for the first time. Which ARP request "
                "does PC1 send?",
                ["Who has 192.168.1.1?", "Who has 10.5.5.5?", "None: ARP is only used between switches"],
                "a",
                "10.5.5.5 is outside PC1's subnet, so PC1 hands the packet to its gateway and needs the "
                "gateway's MAC address.",
            ),
        ),
        lesson(
            f"{C3}-s4",
            "Broadcast domains, loops and Spanning Tree",
            [
                "Every switch port is its own collision domain, and modern full-duplex links have no collisions "
                "at all. Broadcasts are different: a broadcast reaches every device in the same VLAN, across all "
                "connected switches. That set of devices is a broadcast domain. Routers stop broadcasts, and "
                "VLANs (course 5) split one switched network into several broadcast domains.",
                "Ethernet frames have no TTL. If two switches are joined by two cables, a broadcast leaves on one "
                "cable and returns on the other, again and again, multiplying at each pass. The result is a "
                "broadcast storm, a MAC table that keeps moving hosts between ports, and duplicate frames. Real "
                "switches prevent this with the Spanning Tree Protocol (STP, and its faster successor RSTP, now "
                "specified in IEEE 802.1Q): they elect a root bridge and block redundant ports until a link fails.",
                "The VoltQuest lab does not run Spanning Tree. A cabled loop is cut by a guard that drops any "
                "frame after it has crossed 24 switches, and the step-by-step view logs each drop. Avoid loops in "
                "your lab designs. In real networks, also shut down unused switch ports so that nobody can plug in "
                "a rogue device or create an accidental loop.",
            ],
            "switch",
            lines(
                "S1> enable",
                "S1# configure terminal",
                "! Disable an unused port so nobody can plug in",
                "S1(config)# interface fa0/8",
                "S1(config-if)# description unused - disabled",
                "S1(config-if)# shutdown",
                "! Enable a port that was shut by mistake",
                "S1(config-if)# interface fa0/2",
                "S1(config-if)# no shutdown",
                "S1(config-if)# end",
                "S1# show ip interface brief",
            ),
            "Adding a second cable between two switches \"for redundancy\" where no loop prevention runs. "
            "Broadcasts circle without end and the network melts down. Real switches run STP by default; this "
            "lab has none, so a loop shows up as dropped frames and failed pings.",
            question(
                f"{C3}-q4",
                "Why does a switching loop without Spanning Tree cause a broadcast storm?",
                [
                    "Switches turn broadcasts into unicasts that never expire",
                    "Ethernet frames have no TTL, so flooded broadcasts circle and multiply",
                    "ARP replies are always broadcast, so they are sent twice per link",
                ],
                "b",
                "Each switch floods the broadcast again out of every other port, and nothing in the Ethernet "
                "header limits its lifetime. STP breaks the loop by blocking a port.",
            ),
        ),
    ],
    "steps": [
        "Ping PC2 (192.168.1.11) and PC3 (192.168.1.12) from PC1. Both fail, although PC1's own cable works.",
        "On S1 run `show ip interface brief`. FastEthernet0/2 shows `administratively down`: someone typed "
        "`shutdown` on PC2's port. GigabitEthernet0/1 shows `down`, because S2 has shut its end of the link.",
        "Enter `configure terminal`, `interface fa0/2`, `no shutdown` and `end`. The console reports that the "
        "line protocol changed state to up.",
        "On S2 run `show ip interface brief` and bring up the shut uplink Gi0/1 the same way.",
        "Ping every host from PC1 and PC2, then run `show mac address-table` on S1: PC1 and PC2 appear on Fa0/1 "
        "and Fa0/2, while PC3 and Server1 appear behind Gi0/1.",
        "Run `arp -a` on PC1 and match each IP address to a MAC address in the switch table.",
        "Press Check results.",
    ],
    "expected": (
        "After `no shutdown` on S1 Fa0/2 and S2 Gi0/1, every host pings every other host with TTL=128. `show mac "
        "address-table` on S1 lists PC1 on Fa0/1, PC2 on Fa0/2 and the two S2 hosts on Gi0/1, and their MAC "
        "addresses match `arp -a` on PC1."
    ),
    "challenge": {
        "task": (
            "Course labs cannot be edited, so use \"Open a sandbox copy in a new tab\" under the lab and work in the copy. "
            "Add a second cable between S1 Gi0/2 and S2 Gi0/2, clear the MAC tables on both switches, and ping "
            "PC3 from PC1. Use the step-by-step view and `show mac address-table` to explain what happens, then "
            "remove the extra cable."
        ),
        "acceptance": [
            "The step-by-step view shows frames flooded around the loop and dropped after crossing 24 switches",
            "`show mac address-table` on S1 shows host MAC addresses learned on the uplinks instead of their "
            "access ports, and the ping fails",
            "You explain that real switches would block one link with Spanning Tree, which this lab does not "
            "run, and pings work again once the extra cable is gone",
        ],
    },
    "lab": {
        "title": "Bring the dark switch ports back",
        "brief": (
            "Two switches carry the office LAN 192.168.1.0/24. PC1 and PC2 hang off S1; PC3 and Server1 hang off "
            "S2. Users report that PC2 is offline and that nobody can reach PC3 or Server1. Every IP setting is "
            "correct. Find the shut ports with the switch command line, bring them up, and read the MAC and ARP "
            "tables."
        ),
        "topology": {
            "devices": [
                device("PC1", "pc", 80, 110, host("192.168.1.10", "255.255.255.0")),
                device("PC2", "pc", 80, 300, host("192.168.1.11", "255.255.255.0")),
                device("S1", "switch", 260, 205,
                       config=["enable", "configure terminal", "interface fa0/2", "shutdown", "end"]),
                device("S2", "switch", 500, 205,
                       config=["enable", "configure terminal", "interface g0/1", "shutdown", "end"]),
                device("PC3", "pc", 680, 110, host("192.168.1.12", "255.255.255.0")),
                device("Server1", "server", 680, 300, host("192.168.1.20", "255.255.255.0"),
                       web("Office file index")),
            ],
            "links": [
                "PC1 Fa0 S1 Fa0/1",
                "PC2 Fa0 S1 Fa0/2",
                "S1 Gi0/1 S2 Gi0/1",
                "PC3 Fa0 S2 Fa0/1",
                "Server1 Fa0 S2 Fa0/2",
            ],
        },
        "goals": [
            {"type": "ping", "from": "PC2", "to": "192.168.1.10", "label": "PC2 reaches PC1 through S1"},
            {"type": "ping", "from": "PC1", "to": "192.168.1.12", "label": "PC1 reaches PC3 across the S1-S2 link"},
            {"type": "ping", "from": "PC2", "to": "192.168.1.20", "label": "PC2 reaches Server1 on S2"},
            {"type": "http", "from": "PC1", "url": "http://192.168.1.20", "label": "PC1 loads Server1's page"},
        ],
        "solution": [
            {"device": "S1", "cli": ["enable", "configure terminal", "interface fa0/2", "no shutdown", "end"]},
            {"device": "S2", "cli": ["enable", "configure terminal", "interface g0/1", "no shutdown", "end"]},
        ],
    },
    "exam": {
        "passPercent": 80,
        "questions": [
            question(
                f"{C3}-e1",
                "Which field does a switch use to choose the outgoing port for a frame?",
                ["The source IP address", "The destination MAC address", "The destination TCP port"],
                "b",
                "Switches forward on layer 2 information. They look up the destination MAC address in the MAC "
                "address table, which they learned from source MAC addresses.",
                f"{C3}-s1",
            ),
            question(
                f"{C3}-e2",
                "What does a switch do with the source MAC address of each frame it receives?",
                [
                    "Records it with the arrival port and VLAN in its MAC address table",
                    "Replaces it with the switch's own MAC address before forwarding the frame",
                    "Checks it against an ARP cache before forwarding",
                ],
                "a",
                "Learning uses the source address: the switch notes that this MAC lives behind the arrival port, "
                "in that VLAN. Switches neither rewrite MAC addresses nor use ARP to forward frames.",
                f"{C3}-s2",
            ),
            question(
                f"{C3}-e3",
                "Why is an ARP request sent to ffff.ffff.ffff?",
                [
                    "ARP must also reach hosts in other subnets, so routers have to forward it",
                    "Switches only accept ARP messages that are sent to the broadcast address",
                    "The sender does not know the target's MAC yet, so it asks every host",
                ],
                "c",
                "Only the owner of the requested IP address replies, with a unicast. Routers do not forward the "
                "broadcast, so ARP never leaves the subnet.",
                f"{C3}-s3",
            ),
            question(
                f"{C3}-e4",
                "Two switches are joined by one cable, all ports are in VLAN 1, and there is no router. How many "
                "broadcast domains is that?",
                ["One", "Two", "One per switch port"],
                "a",
                "A broadcast from any host floods across both switches, so all hosts share one broadcast domain. "
                "Each port is its own collision domain, which is a different idea.",
                f"{C3}-s4",
            ),
            question(
                f"{C3}-e5",
                "`show ip interface brief` on a switch shows FastEthernet0/2 as `administratively down`. What "
                "fixes it?",
                ["Replacing the cable", "`no shutdown` under interface fa0/2", "`clear mac address-table dynamic`"],
                "b",
                "Administratively down means the port was disabled with `shutdown`. A missing cable or a shut far "
                "end shows `down` instead.",
                f"{C3}-s4",
            ),
        ],
    },
    "sources": [
        IEEE_8023,
        rfc(826, "An Ethernet Address Resolution Protocol"),
        IEEE_8021Q,
    ],
}

COURSES_1_TO_3 = [COURSE_1, COURSE_2, COURSE_3]
