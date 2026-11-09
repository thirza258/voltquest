"""Networking courses 4 to 6: router configuration and static routes, VLANs and trunks, inter-VLAN routing."""

from networking_courses.common import (
    IEEE_8021Q, IEEE_8023, device, host, lesson, lines, question, rfc, web,
)

# ---------------------------------------------------------------------------------------------
# Course 4
# ---------------------------------------------------------------------------------------------

C4 = "net-routing"

R1_STUB = [
    "enable",
    "configure terminal",
    "interface g0/0",
    "description LAN 192.168.1.0/24",
    "ip address 192.168.1.1 255.255.255.0",
    "no shutdown",
    "interface g0/1",
    "description Link to R2",
    "ip address 10.0.12.1 255.255.255.252",
    "end",
]
R2_CORE = [
    "enable",
    "configure terminal",
    "interface g0/0",
    "description Link to R1",
    "ip address 10.0.12.2 255.255.255.252",
    "no shutdown",
    "interface g0/1",
    "description Link to R3",
    "ip address 10.0.23.1 255.255.255.252",
    "no shutdown",
    "interface g0/2",
    "description LAN 192.168.2.0/24",
    "ip address 192.168.2.1 255.255.255.0",
    "no shutdown",
    "end",
]
R3_STUB = [
    "enable",
    "configure terminal",
    "interface g0/0",
    "description Link to R2",
    "ip address 10.0.23.2 255.255.255.252",
    "no shutdown",
    "interface g0/1",
    "description LAN 192.168.3.0/24",
    "ip address 192.168.3.1 255.255.255.0",
    "no shutdown",
    "end",
]

COURSE_4 = {
    "id": C4,
    "version": 1,
    "order": 4,
    "title": "4. Router configuration and static routes",
    "summary": (
        "Work in the router command line: move between modes, configure and enable interfaces, and save your "
        "work. Read connected and local routes, add static and default routes, and use ping and traceroute to "
        "prove that packets have a path there and back. The lab joins three LANs across three routers."
    ),
    "difficulty": "Intermediate",
    "minutes": 50,
    "lessons": [
        lesson(
            f"{C4}-s1",
            "Command line modes and saving your work",
            [
                "The router/switch command line has a hierarchy of modes, and the prompt shows where you are. "
                "`R1>` is user EXEC, for basic checks. `enable` moves to privileged EXEC, `R1#`, where every "
                "`show` command works. `configure terminal` enters global configuration, `R1(config)#`, and "
                "commands such as `interface g0/0` open sub-modes like `R1(config-if)#`.",
                "`exit` goes up one level and `end` returns straight to privileged EXEC. In any configuration "
                "mode you can run an EXEC command by putting `do` in front of it, for example `do show ip "
                "interface brief`. Keywords may be shortened to any unique prefix (`conf t`, `int g0/0`, `sh ip "
                "int br`). A prefix that fits several commands gives `% Ambiguous command`, and a typo is marked "
                "with `% Invalid input detected at '^' marker.`",
                "Changes take effect at once in the running configuration, which lives in RAM. To keep them "
                "after a reload, copy them to the startup configuration with `copy running-config "
                "startup-config` (or `write memory`). Real devices also need passwords, SSH and a login banner "
                "before they go into service; the lab does not model passwords or line settings, so it focuses "
                "on the commands that move traffic.",
            ],
            "router",
            lines(
                "Router> enable",
                "Router# configure terminal",
                "Router(config)# hostname R1",
                "R1(config)# interface g0/0",
                "R1(config-if)# description LAN A",
                "R1(config-if)# end",
                "R1# show running-config",
                "R1# copy running-config startup-config",
            ),
            "Forgetting to save. The running configuration changes immediately, but it is lost at the next "
            "reload unless you copy it to the startup configuration. Check with `show startup-config` before you "
            "walk away.",
            question(
                f"{C4}-q1",
                "Which prompt lets you type `ip address` for an interface?",
                ["R1#", "R1(config-if)#", "R1(config)#"],
                "b",
                "Interface settings live in interface configuration mode, which `interface g0/0` opens from "
                "global configuration.",
            ),
        ),
        lesson(
            f"{C4}-s2",
            "Interfaces, connected and local routes",
            [
                "Router interfaces start administratively down. To use one, give it an address with `ip address "
                "<address> <mask>` and enable it with `no shutdown`. `show ip interface brief` lists every "
                "interface with its address and two states, Status and Protocol. `up up` is healthy, "
                "`administratively down down` means `shutdown` is configured, and `down down` usually means no "
                "cable or a disabled port at the far end.",
                "As soon as an interface is up with an address, the router installs two routes. A connected "
                "route (code C) covers the whole subnet, such as 192.168.1.0/24, and a local route (code L) is a "
                "/32 for the interface's own address. These are the only routes a router has until you add "
                "static routes or run a routing protocol. Shut the interface or pull the cable and both routes "
                "disappear.",
                "Address router-to-router links with small subnets. A /30 such as 10.0.12.0/30 has exactly two "
                "usable addresses, .1 and .2, one for each end. The router refuses an address that overlaps a "
                "subnet on another of its interfaces, and it refuses a subnet's network or broadcast address.",
            ],
            "router",
            lines(
                "R1> enable",
                "R1# configure terminal",
                "R1(config)# interface g0/0",
                "R1(config-if)# ip address 192.168.1.1 255.255.255.0",
                "R1(config-if)# no shutdown",
                "R1(config-if)# interface g0/1",
                "R1(config-if)# ip address 10.0.12.1 255.255.255.252",
                "R1(config-if)# no shutdown",
                "R1(config-if)# end",
                "R1# show ip interface brief",
                "R1# show ip route",
            ),
            "Configuring the address but not typing `no shutdown`. The interface stays `administratively "
            "down`, no connected route appears, and every host behind it is unreachable, even though the "
            "address looks right in the running configuration.",
            question(
                f"{C4}-q2",
                "An interface is up with `ip address 192.168.1.1 255.255.255.0`. Which routes does the router "
                "install?",
                [
                    "S 192.168.1.0/24 and S* 0.0.0.0/0",
                    "Only L 192.168.1.0/24",
                    "C 192.168.1.0/24 and L 192.168.1.1/32",
                ],
                "c",
                "The connected route covers the subnet and the local route covers the router's own address. "
                "Static and default routes only appear when you configure them.",
            ),
        ),
        lesson(
            f"{C4}-s3",
            "Static and default routes",
            [
                "A router only knows its connected subnets. For any other network you add a static route: `ip "
                "route <network> <mask> <next-hop>`. The next hop is the neighbor router's address on a shared "
                "link, and the router installs the route only while it can reach that next hop, which in the lab "
                "means through a connected subnet. You can name an exit interface instead, but on Ethernet a "
                "next-hop address is the clearer choice.",
                "A default route, `ip route 0.0.0.0 0.0.0.0 <next-hop>`, matches every destination. `show ip "
                "route` marks it `S*` and reports a `Gateway of last resort`. When several routes match, the "
                "router picks the longest prefix: a /24 beats a /16, and anything beats the /0 default. That is "
                "why a stub router with one exit needs only a default route, while a router in the middle needs "
                "specific routes.",
                "In the widely used router CLI style, connected routes have an administrative distance of 0 and "
                "static routes 1, which beats every dynamic routing protocol. Real routers also accept a distance "
                "at the end of `ip route` to build a floating backup route that only appears when the main path "
                "fails; the lab's command line does not accept that argument.",
            ],
            "router",
            lines(
                "R1> enable",
                "R1# configure terminal",
                "! A remote LAN, reached through the neighbor at 10.0.12.2",
                "R1(config)# ip route 192.168.3.0 255.255.255.0 10.0.12.2",
                "! Everything else goes to the same neighbor",
                "R1(config)# ip route 0.0.0.0 0.0.0.0 10.0.12.2",
                "! Remove a route that is no longer needed",
                "R1(config)# no ip route 192.168.3.0 255.255.255.0 10.0.12.2",
                "R1(config)# end",
                "R1# show ip route",
            ),
            "Adding a route on one router only. The request reaches the far LAN, but the reply needs a route "
            "back, hop by hop. If any router on the return path lacks a route to the source subnet, the ping "
            "times out even though the forward path is perfect.",
            question(
                f"{C4}-q3",
                "R1 has `S 10.0.0.0/8 via 10.0.12.2` and `S 10.1.1.0/24 via 10.0.13.2`. Where does it send a "
                "packet for 10.1.1.50?",
                [
                    "To 10.0.13.2, because the /24 is the longest matching prefix",
                    "To 10.0.12.2, because that route was configured first",
                    "To both next hops in turn, because both routes match",
                ],
                "a",
                "Routers choose the most specific match. 10.1.1.50 matches both routes, and /24 is longer than /8.",
            ),
        ),
        lesson(
            f"{C4}-s4",
            "Testing paths with ping and traceroute",
            [
                "A ping succeeds only if the request and the reply both get through. A router's ping prints one "
                "character per echo: `!` for a reply, `.` for a timeout and `U` for an unreachable message. A "
                "first test through a fresh path often prints `.!!!!`, because in the lab, as on many real "
                "routers, a router drops the echo that triggered its ARP request. A lab path that crosses three "
                "routers can lose three echoes the first time.",
                "Traceroute shows the path. It sends probes with TTL 1, 2, 3 and so on. Each router that "
                "decrements a probe's TTL to zero drops it and returns an ICMP time exceeded message from its own "
                "address, so each line of output reveals one hop. Finally the destination answers the probe "
                "itself. Windows calls the command `tracert`; routers call it `traceroute`.",
                "Read failures carefully. `Destination net unreachable` means a router on the way has no route. "
                "Timeouts after the first hop often mean a missing return route. If two addresses alternate in a "
                "traceroute and pings report `TTL expired in transit`, two routers are pointing at each other: a "
                "routing loop.",
            ],
            "pc",
            lines(
                "! The hop-by-hop path to the far LAN",
                r"C:\> tracert 192.168.3.10",
                "! Four echoes; the first may time out while a router resolves ARP",
                r"C:\> ping 192.168.3.10",
                "! Repeat the test before you change anything",
                r"C:\> ping 192.168.3.10 -n 2",
            ),
            "Changing the configuration after one lost ping. A first ping through routers can lose packets while "
            "ARP resolves. Repeat the test; only a failure that persists points at a real fault.",
            question(
                f"{C4}-q4",
                "A traceroute shows the same two addresses alternating until the hop limit, and pings report `TTL "
                "expired in transit`. What is wrong?",
                [
                    "The destination host is switched off, so no router answers for it",
                    "Two routers point at each other for that destination: a routing loop",
                    "The PC's default gateway is missing, so packets go nowhere",
                ],
                "b",
                "Each router sends the packet back to the other until the TTL runs out. Find the route that points "
                "the wrong way and correct it.",
            ),
        ),
    ],
    "steps": [
        "On R1 run `show ip interface brief`. Gi0/1 has 10.0.12.1 but is `administratively down`. Enable it with "
        "`configure terminal`, `interface g0/1` and `no shutdown`.",
        "Run `show ip route` on R1: only C and L routes for its own subnets. Nothing leads to 192.168.2.0/24 or "
        "192.168.3.0/24 yet.",
        "R1 has a single way out, so add `ip route 0.0.0.0 0.0.0.0 10.0.12.2`. On R3 add `ip route 0.0.0.0 "
        "0.0.0.0 10.0.23.1`.",
        "On R2 add `ip route 192.168.1.0 255.255.255.0 10.0.12.1` and `ip route 192.168.3.0 255.255.255.0 "
        "10.0.23.2`.",
        "From PC1 run `tracert 192.168.3.10`. Expect 192.168.1.1, 10.0.12.2, 10.0.23.2 and then 192.168.3.10.",
        "Ping between all three LANs. The first ping from PC1 to Server1 can lose up to three echoes, one for "
        "each router that resolves ARP; repeat it.",
        "Press Check results.",
    ],
    "expected": (
        "`show ip route` on R1 shows `Gateway of last resort is 10.0.12.2 to network 0.0.0.0` and `S*    "
        "0.0.0.0/0 [1/0] via 10.0.12.2`. R2 lists static routes to 192.168.1.0/24 and 192.168.3.0/24. PC1's "
        "tracert to 192.168.3.10 shows 192.168.1.1, 10.0.12.2, 10.0.23.2 and 192.168.3.10, and every LAN reaches "
        "every other LAN."
    ),
    "challenge": {
        "task": (
            "Break the path on purpose to learn the failure signatures. Remove R2's route to 192.168.1.0/24 and "
            "ping Server1 from PC1, then restore it. Next add `ip route 192.168.3.10 255.255.255.255 10.0.12.1` "
            "on R2 and run the same ping and a tracert. Remove the /32 route when you are done."
        ),
        "acceptance": [
            "Without R2's route back to 192.168.1.0/24, PC1's pings to 192.168.3.10 time out although the "
            "requests still reach Server1",
            "With the /32 route, PC1 sees `TTL expired in transit` and tracert alternates between 10.0.12.2 and "
            "10.0.12.1",
            "You explain that the /32 wins by longest prefix match and that removing it restores the /24 path",
        ],
    },
    "lab": {
        "title": "Three LANs, three routers, static routes",
        "brief": (
            "R1, R2 and R3 form a chain. R1 serves LAN 192.168.1.0/24 (PC1), R2 serves 192.168.2.0/24 (PC2) and "
            "R3 serves 192.168.3.0/24 (Server1). The links use 10.0.12.0/30 (R1-R2) and 10.0.23.0/30 (R2-R3). "
            "Every interface is addressed, but R1's link to R2 is still shut and no router has a static route. "
            "R1 and R3 are stub routers: give each one a default route toward R2. R2 sits in the middle: give it "
            "specific routes to 192.168.1.0/24 and 192.168.3.0/24."
        ),
        "topology": {
            "devices": [
                device("PC1", "pc", 70, 310, host("192.168.1.10", "255.255.255.0", "192.168.1.1")),
                device("R1", "router", 190, 150, config=R1_STUB),
                device("R2", "router", 380, 150, config=R2_CORE),
                device("PC2", "pc", 380, 320, host("192.168.2.10", "255.255.255.0", "192.168.2.1")),
                device("R3", "router", 570, 150, config=R3_STUB),
                device("Server1", "server", 690, 310, host("192.168.3.10", "255.255.255.0", "192.168.3.1"),
                       web("Server1 in LAN 192.168.3.0/24")),
            ],
            "links": [
                "PC1 Fa0 R1 Gi0/0",
                "R1 Gi0/1 R2 Gi0/0",
                "R2 Gi0/1 R3 Gi0/0",
                "PC2 Fa0 R2 Gi0/2",
                "Server1 Fa0 R3 Gi0/1",
            ],
        },
        "goals": [
            {"type": "interface", "device": "R1", "iface": "g0/1", "ip": "10.0.12.1", "up": True,
             "label": "R1 Gi0/1 (10.0.12.1/30) is up"},
            {"type": "route", "device": "R1", "prefix": "0.0.0.0/0", "code": "S",
             "label": "R1 has a static default route"},
            {"type": "route", "device": "R2", "prefix": "192.168.1.0/24", "code": "S",
             "label": "R2 has a static route to 192.168.1.0/24"},
            {"type": "route", "device": "R2", "prefix": "192.168.3.0/24", "code": "S",
             "label": "R2 has a static route to 192.168.3.0/24"},
            {"type": "route", "device": "R3", "prefix": "0.0.0.0/0", "code": "S",
             "label": "R3 has a static default route"},
            {"type": "ping", "from": "PC1", "to": "192.168.3.10", "label": "PC1 reaches Server1 across all three routers"},
            {"type": "ping", "from": "PC2", "to": "192.168.1.10", "label": "PC2 reaches PC1"},
            {"type": "ping", "from": "Server1", "to": "192.168.2.10", "label": "Server1 reaches PC2"},
        ],
        "solution": [
            {"device": "R1", "cli": ["enable", "configure terminal", "interface g0/1", "no shutdown", "exit",
                                     "ip route 0.0.0.0 0.0.0.0 10.0.12.2", "end"]},
            {"device": "R2", "cli": ["enable", "configure terminal", "ip route 192.168.1.0 255.255.255.0 10.0.12.1",
                                     "ip route 192.168.3.0 255.255.255.0 10.0.23.2", "end"]},
            {"device": "R3", "cli": ["enable", "configure terminal", "ip route 0.0.0.0 0.0.0.0 10.0.23.1", "end"]},
        ],
    },
    "exam": {
        "passPercent": 80,
        "questions": [
            question(
                f"{C4}-e1",
                "Which command keeps your configuration after a reload?",
                [
                    "`show startup-config`",
                    "`copy running-config startup-config`",
                    "`end` from global configuration",
                ],
                "b",
                "Copying the running configuration to the startup configuration saves it to non-volatile memory. "
                "`end` only leaves configuration mode, and `show startup-config` only displays the saved copy.",
                f"{C4}-s1",
            ),
            question(
                f"{C4}-e2",
                "`show ip interface brief` shows Gi0/1 as `administratively down down`. What is wrong?",
                [
                    "The interface has `shutdown` configured; enable it with `no shutdown`",
                    "The cable at the far end is unplugged, so the line protocol stays down",
                    "The IP address overlaps a subnet on another interface",
                ],
                "a",
                "Administratively down always means a local `shutdown`. A missing cable or a disabled far end "
                "shows `down down`, and an overlapping address is rejected when you type it.",
                f"{C4}-s2",
            ),
            question(
                f"{C4}-e3",
                "R1's table holds only connected routes and `S* 0.0.0.0/0 [1/0] via 10.0.12.2`. A packet arrives "
                "for 8.8.8.8. What does R1 do?",
                [
                    "Drops it, because no specific route exists",
                    "Floods it out of every interface",
                    "Forwards it to 10.0.12.2 using the default route",
                ],
                "c",
                "The default route matches every destination that no longer prefix matches, so R1 sends the "
                "packet to its gateway of last resort.",
                f"{C4}-s3",
            ),
            question(
                f"{C4}-e4",
                "PC1 pings PC2 across R1 and R2. R1 has a route to PC2's LAN, but R2 has no route to PC1's LAN. "
                "What does PC1 see?",
                [
                    "Timeouts: the request arrives, but R2 cannot route the reply back",
                    "Replies, because R1 already knows the way to PC2's LAN and back",
                    "`Destination host unreachable`, sent back by PC2 for every echo",
                ],
                "a",
                "Each router decides on its own, in each direction. PC2's reply reaches R2, which has no route to "
                "PC1's subnet, so the reply never returns.",
                f"{C4}-s3",
            ),
            question(
                f"{C4}-e5",
                "Why does traceroute reveal each router on a path?",
                [
                    "Routers broadcast their names and addresses to every host that asks",
                    "Traceroute downloads the routing table of each router along the path",
                    "Each router where a probe's TTL hits zero answers with ICMP time exceeded",
                ],
                "c",
                "Probes start with TTL 1 and grow by one. The router where a probe expires answers and so reveals "
                "itself, until the destination itself replies.",
                f"{C4}-s4",
            ),
        ],
    },
    "sources": [
        rfc(1812, "Requirements for IP Version 4 Routers"),
        rfc(791, "Internet Protocol"),
        rfc(792, "Internet Control Message Protocol"),
    ],
}

# ---------------------------------------------------------------------------------------------
# Course 5
# ---------------------------------------------------------------------------------------------

C5 = "net-vlans"

S1_TWO_VLANS = [
    "enable",
    "configure terminal",
    "vlan 10",
    "name STAFF",
    "vlan 20",
    "name GUEST",
    "vlan 99",
    "name NATIVE",
    "exit",
    "interface fa0/1",
    "switchport mode access",
    "switchport access vlan 10",
    "interface fa0/2",
    "switchport mode access",
    "switchport access vlan 20",
    "interface g0/1",
    "switchport mode trunk",
    "switchport trunk native vlan 99",
    "switchport trunk allowed vlan 10,20,99",
    "end",
]

COURSE_5 = {
    "id": C5,
    "version": 1,
    "order": 5,
    "title": "5. VLANs and 802.1Q trunks",
    "summary": (
        "Split one switched network into separate broadcast domains with VLANs. Create VLANs, assign access "
        "ports, carry several VLANs between switches on an 802.1Q trunk, and keep native VLANs and allowed "
        "lists consistent. The lab stretches STAFF and GUEST VLANs across a second switch."
    ),
    "difficulty": "Intermediate",
    "minutes": 45,
    "lessons": [
        lesson(
            f"{C5}-s1",
            "Why VLANs",
            [
                "A VLAN (virtual LAN) is a separate broadcast domain on shared switches. Ports in VLAN 10 and "
                "ports in VLAN 20 may sit on the same switch, but frames never pass between them at layer 2. "
                "Each VLAN normally carries one IP subnet, and traffic between VLANs has to go through a router "
                "or a layer 3 switch, where you can filter it (courses 6 and 9).",
                "VLANs group users by role instead of by location: staff, guests, servers, phones or cameras. "
                "Smaller broadcast domains carry less broadcast noise, and segmentation limits what a compromised "
                "or untrusted device can reach. VLAN IDs run from 1 to 4094. VLAN 1 is the default, and every "
                "switch port starts in it.",
                "Create a VLAN in global configuration with `vlan 10`, then name it at the VLAN configuration "
                "prompt, `S1(config-vlan)#`, with `name STAFF`. Names are local labels for people; switches match "
                "VLANs by number. `show vlan brief` lists each VLAN with its name and its access ports.",
            ],
            "switch",
            lines(
                "S1> enable",
                "S1# configure terminal",
                "S1(config)# vlan 10",
                "S1(config-vlan)# name STAFF",
                "S1(config-vlan)# vlan 20",
                "S1(config-vlan)# name GUEST",
                "S1(config-vlan)# end",
                "S1# show vlan brief",
            ),
            "Creating a VLAN and expecting ports to join it. `vlan 10` only adds VLAN 10 to the database. Nothing "
            "changes until you assign ports with `switchport access vlan 10`, so `show vlan brief` still lists "
            "every port in VLAN 1.",
            question(
                f"{C5}-q1",
                "What does a VLAN create on a switch?",
                ["A separate routing table", "A separate broadcast domain", "A faster physical link"],
                "b",
                "Broadcasts and unknown unicasts stay inside their VLAN. Reaching another VLAN takes a layer 3 "
                "device.",
            ),
        ),
        lesson(
            f"{C5}-s2",
            "Access ports",
            [
                "An access port belongs to exactly one VLAN and carries its frames untagged. The host on the port "
                "has no idea which VLAN it is in: the switch adds that context when a frame arrives and removes "
                "it when the frame leaves through another access port. Configure one with `switchport mode "
                "access` and `switchport access vlan <id>`.",
                "`interface range fa0/1 - 4` applies the same commands to several ports at once and opens the "
                "`(config-if-range)#` prompt. If you assign a VLAN that does not exist yet, the switch creates it "
                "and says so: `% Access VLAN does not exist. Creating vlan 30`. Give it a name afterwards so the "
                "next engineer knows what it is for.",
                "Treat unused ports as a risk. A common practice is to move them to an unused VLAN and shut them "
                "down, so a visitor who plugs a laptop into a wall socket lands nowhere. Real switches also offer "
                "port security, which limits the MAC addresses allowed on a port; the lab does not simulate it.",
            ],
            "switch",
            lines(
                "S1> enable",
                "S1# configure terminal",
                "S1(config)# interface range fa0/1 - 4",
                "S1(config-if-range)# switchport mode access",
                "S1(config-if-range)# switchport access vlan 10",
                "S1(config-if-range)# exit",
                "S1(config)# interface fa0/5",
                "S1(config-if)# switchport mode access",
                "S1(config-if)# switchport access vlan 20",
                "S1(config-if)# end",
                "S1# show vlan brief",
            ),
            "Configuring the wrong port. One typo in `interface fa0/2` puts a host in the wrong VLAN, where it "
            "gets no replies from its own subnet. Confirm with `show vlan brief` that each port sits in the VLAN "
            "you intended.",
            question(
                f"{C5}-q2",
                "A PC on an access port in VLAN 20 sends a frame. How does the frame leave the PC?",
                [
                    "Untagged; the switch associates it with VLAN 20",
                    "Tagged with VLAN 20 by the PC's network card",
                    "Tagged with VLAN 1, the default VLAN of every port",
                ],
                "a",
                "Hosts on access ports send ordinary Ethernet frames. The access port's VLAN decides which VLAN "
                "the frame belongs to inside the switch.",
            ),
        ),
        lesson(
            f"{C5}-s3",
            "802.1Q trunks",
            [
                "A trunk carries many VLANs over one link, usually between switches or from a switch to a router. "
                "IEEE 802.1Q marks each frame by inserting a 4-byte tag after the source MAC address: the 0x8100 "
                "tag type, a 3-bit priority, a 1-bit drop-eligible flag and a 12-bit VLAN ID. The receiving "
                "switch reads the VLAN ID and keeps the frame in that VLAN.",
                "Make a port a trunk with `switchport mode trunk`. A trunk allows all VLANs by default. Limit it "
                "with `switchport trunk allowed vlan 10,20`, and change the list later with `add`, `remove` or "
                "`except`. A VLAN reaches the far side only if it exists on both switches and is allowed at both "
                "ends of the trunk.",
                "`show interfaces trunk` lists each working trunk with its mode, encapsulation, status and native "
                "VLAN, then the allowed VLANs and the VLANs that are both allowed and active on that switch. Real "
                "switches can also negotiate trunking automatically; the lab supports only the static "
                "`switchport mode trunk`, shown as mode `on`, which many networks prefer anyway.",
            ],
            "switch",
            lines(
                "S1> enable",
                "S1# configure terminal",
                "S1(config)# interface g0/1",
                "S1(config-if)# switchport mode trunk",
                "S1(config-if)# switchport trunk allowed vlan 10,20",
                "S1(config-if)# switchport trunk allowed vlan add 30",
                "S1(config-if)# end",
                "S1# show interfaces trunk",
            ),
            "Leaving out `add` when you extend the allowed list. `switchport trunk allowed vlan 30` replaces the "
            "whole list with VLAN 30 alone and silently cuts VLANs 10 and 20. Use `switchport trunk allowed vlan "
            "add 30`.",
            question(
                f"{C5}-q3",
                "Which part of the 802.1Q tag tells the receiving switch which VLAN a frame belongs to?",
                ["The 3-bit priority field", "The 0x8100 tag type", "The 12-bit VLAN ID"],
                "c",
                "The 12-bit VLAN ID allows 4094 usable VLANs. The tag type only says that a tag follows, and the "
                "priority field is for quality of service.",
            ),
        ),
        lesson(
            f"{C5}-s4",
            "Native VLAN and trunk troubleshooting",
            [
                "Frames in a trunk's native VLAN cross the link untagged, and any untagged frame that arrives on a "
                "trunk joins the native VLAN. The default native VLAN is 1. Both ends of a trunk must use the "
                "same native VLAN. With a mismatch, untagged frames from VLAN 1 on one switch land in VLAN 99 on "
                "the other, so traffic leaks between VLANs. Many real switches warn about a mismatch; the lab "
                "merges the two VLANs silently.",
                "The native VLAN also matters for security. In a double-tagging (VLAN hopping) attack, a host in "
                "the native VLAN sends a frame with two tags; the first switch strips the outer tag, and the frame "
                "arrives in another VLAN. Defend by setting every trunk's native VLAN to an unused VLAN that holds "
                "no hosts, and never put user ports in it.",
                "Troubleshoot VLAN problems in order. Does the VLAN exist on every switch on the path (`show vlan "
                "brief`)? Is each access port in the right VLAN? Is the link between switches a trunk at both "
                "ends, with the VLAN allowed and the same native VLAN (`show interfaces trunk`)? Only when layer 2 "
                "is right should you look at IP addresses and gateways.",
            ],
            "switch",
            lines(
                "S1> enable",
                "S1# configure terminal",
                "S1(config)# vlan 99",
                "S1(config-vlan)# name NATIVE",
                "S1(config-vlan)# exit",
                "S1(config)# interface g0/1",
                "S1(config-if)# switchport mode trunk",
                "! Untagged frames on this trunk belong to VLAN 99, on both switches",
                "S1(config-if)# switchport trunk native vlan 99",
                "S1(config-if)# end",
                "S1# show interfaces trunk",
            ),
            "A native VLAN mismatch. If S1's trunk uses native VLAN 1 and S2's end uses native VLAN 99, untagged "
            "traffic crosses between two different VLANs. Set the same native VLAN on both ends of every trunk.",
            question(
                f"{C5}-q4",
                "S1's trunk uses native VLAN 1 and S2's end of the same trunk uses native VLAN 99. What happens to "
                "untagged frames that S1 sends from VLAN 1?",
                [
                    "S2 places them in VLAN 99, so traffic leaks between VLANs",
                    "S2 drops every tagged frame on the trunk until the mismatch is fixed",
                    "Nothing: the native VLAN only matters on routers",
                ],
                "a",
                "Untagged frames carry no VLAN ID, so S2 assumes its own native VLAN. Tagged VLANs keep working, "
                "which makes the fault easy to miss.",
            ),
        ),
    ],
    "steps": [
        "On S1 run `show vlan brief` and `show interfaces trunk` to read the design: STAFF and GUEST with their "
        "ports, and Gi0/1 trunking with native VLAN 99.",
        "Ping PC3 (192.168.10.12) from PC1. It fails: S1 tags VLAN 10 frames on the trunk, and S2's Gi0/1 is "
        "still an access port, which drops tagged frames.",
        "On S2 create the VLANs: `vlan 10`, `name STAFF`, `vlan 20`, `name GUEST`, `vlan 99`, `name NATIVE`.",
        "Put S2 Fa0/1 in VLAN 10 and Fa0/2 in VLAN 20 with `switchport mode access` and `switchport access vlan`.",
        "On S2 Gi0/1 enter `switchport mode trunk`, `switchport trunk native vlan 99` and `switchport trunk "
        "allowed vlan 10,20,99`.",
        "Ping PC3 from PC1 and PC4 (192.168.20.12) from PC2. In the step-by-step view, frames on the S1-S2 "
        "cable show `802.1Q VLAN 10` or `802.1Q VLAN 20`.",
        "Run `show mac address-table` on S2 and find PC1's MAC address in VLAN 10 on Gi0/1, then press Check "
        "results.",
    ],
    "expected": (
        "`show vlan brief` on S2 lists STAFF with Fa0/1 and GUEST with Fa0/2. `show interfaces trunk` shows Gi0/1 "
        "as `on`, `802.1q`, `trunking` with native VLAN 99 and allowed VLANs 10,20,99. PC1 reaches PC3 and PC2 "
        "reaches PC4, while STAFF and GUEST stay separate."
    ),
    "challenge": {
        "task": (
            "Prune VLAN 20 from S1's trunk with `switchport trunk allowed vlan remove 20` and observe what breaks, "
            "then add it back. Next move PC4's port on S2 into VLAN 10 and explain why PC4 still cannot reach "
            "PC1."
        ),
        "acceptance": [
            "With VLAN 20 removed on S1 Gi0/1, PC2 cannot reach PC4 while PC1 still reaches PC3",
            "`show interfaces trunk` on S1 lists 10,99 as the allowed VLANs until you add 20 back",
            "You explain that PC4 in VLAN 10 shares PC1's broadcast domain but still needs an address in "
            "192.168.10.0/24 to talk to it",
        ],
    },
    "lab": {
        "title": "Stretch STAFF and GUEST across two switches",
        "brief": (
            "S1 already has VLAN 10 (STAFF) on Fa0/1, VLAN 20 (GUEST) on Fa0/2, and a trunk on Gi0/1 with native "
            "VLAN 99 (NATIVE) and allowed VLANs 10, 20 and 99. S2 is still in factory state. Configure S2 to "
            "match: the same VLANs and names, PC3's port Fa0/1 in VLAN 10, PC4's port Fa0/2 in VLAN 20, and a "
            "matching trunk on Gi0/1. STAFF uses 192.168.10.0/24 and GUEST uses 192.168.20.0/24."
        ),
        "topology": {
            "devices": [
                device("PC1", "pc", 80, 110, host("192.168.10.11", "255.255.255.0")),
                device("PC2", "pc", 80, 300, host("192.168.20.11", "255.255.255.0")),
                device("S1", "switch", 260, 205, config=S1_TWO_VLANS),
                device("S2", "switch", 500, 205),
                device("PC3", "pc", 680, 110, host("192.168.10.12", "255.255.255.0")),
                device("PC4", "pc", 680, 300, host("192.168.20.12", "255.255.255.0")),
            ],
            "links": [
                "PC1 Fa0 S1 Fa0/1",
                "PC2 Fa0 S1 Fa0/2",
                "S1 Gi0/1 S2 Gi0/1",
                "PC3 Fa0 S2 Fa0/1",
                "PC4 Fa0 S2 Fa0/2",
            ],
        },
        "goals": [
            {"type": "vlan", "device": "S2", "vlan": 10, "name": "STAFF", "label": "S2 has VLAN 10 named STAFF"},
            {"type": "vlan", "device": "S2", "vlan": 20, "name": "GUEST", "label": "S2 has VLAN 20 named GUEST"},
            {"type": "port", "device": "S2", "port": "Fa0/1", "mode": "access", "vlan": 10,
             "label": "S2 Fa0/1 (PC3) is an access port in VLAN 10"},
            {"type": "port", "device": "S2", "port": "Fa0/2", "mode": "access", "vlan": 20,
             "label": "S2 Fa0/2 (PC4) is an access port in VLAN 20"},
            {"type": "port", "device": "S2", "port": "Gi0/1", "mode": "trunk", "native": 99,
             "label": "S2 Gi0/1 is a trunk with native VLAN 99, like S1"},
            {"type": "ping", "from": "PC1", "to": "192.168.10.12", "label": "PC1 reaches PC3 in STAFF across the trunk"},
            {"type": "ping", "from": "PC2", "to": "192.168.20.12", "label": "PC2 reaches PC4 in GUEST across the trunk"},
        ],
        "solution": [
            {"device": "S2", "cli": [
                "enable", "configure terminal",
                "vlan 10", "name STAFF", "vlan 20", "name GUEST", "vlan 99", "name NATIVE", "exit",
                "interface fa0/1", "switchport mode access", "switchport access vlan 10",
                "interface fa0/2", "switchport mode access", "switchport access vlan 20",
                "interface g0/1", "switchport mode trunk", "switchport trunk native vlan 99",
                "switchport trunk allowed vlan 10,20,99", "end",
            ]},
        ],
    },
    "exam": {
        "passPercent": 80,
        "questions": [
            question(
                f"{C5}-e1",
                "Why put guests in VLAN 20 and staff in VLAN 10 on the same switches?",
                [
                    "VLANs encrypt each group's traffic, so guests cannot read staff frames on shared cables",
                    "Each VLAN is a broadcast domain; guests reach staff only through a router that can filter",
                    "VLANs give each group its own IP addresses, so no router is needed to keep them apart",
                ],
                "b",
                "Separate VLANs keep guest frames away from staff hosts. Any traffic between the groups has to be "
                "routed, which is where you apply policy.",
                f"{C5}-s1",
            ),
            question(
                f"{C5}-e2",
                "You type `switchport access vlan 30`, but VLAN 30 does not exist. What does the switch do?",
                [
                    "Rejects the command, because the VLAN must exist first",
                    "Leaves the port in VLAN 1 until you create VLAN 30",
                    "Creates VLAN 30 with a default name and assigns the port",
                ],
                "c",
                "The switch prints `% Access VLAN does not exist. Creating vlan 30`, creates the VLAN with a default "
                "name and assigns the port. Name the VLAN afterwards so the design stays readable.",
                f"{C5}-s2",
            ),
            question(
                f"{C5}-e3",
                "A trunk is configured with `switchport trunk allowed vlan 10,20`. A frame tagged with VLAN 30 "
                "arrives on it. What happens?",
                [
                    "The switch drops it",
                    "The switch forwards it in VLAN 1",
                    "The switch forwards it in VLAN 30 anyway",
                ],
                "a",
                "Only allowed VLANs cross a trunk. A frame tagged with any other VLAN is dropped at the trunk port.",
                f"{C5}-s3",
            ),
            question(
                f"{C5}-e4",
                "Which command adds VLAN 40 to a trunk's allowed list and keeps the VLANs already allowed?",
                [
                    "`switchport trunk allowed vlan 40`",
                    "`switchport trunk allowed vlan add 40`",
                    "`switchport access vlan 40`",
                ],
                "b",
                "Without `add`, the command replaces the whole list with VLAN 40. `switchport access vlan` sets "
                "an access port's VLAN and does nothing for a trunk.",
                f"{C5}-s3",
            ),
            question(
                f"{C5}-e5",
                "PC1 (VLAN 10 on S1) cannot reach PC3 (VLAN 10 on S2). Both access ports are correct. What do you "
                "check next?",
                [
                    "That VLAN 10 has exactly the same name on both switches",
                    "That PC1 has both a DNS server and a default gateway configured",
                    "That the S1-S2 link is a trunk at both ends and allows VLAN 10",
                ],
                "c",
                "Traffic for a VLAN crosses between switches only on a trunk that carries it at both ends. VLAN "
                "names are local labels, and DNS plays no part in a ping by address.",
                f"{C5}-s4",
            ),
        ],
    },
    "sources": [IEEE_8021Q, IEEE_8023],
}

# ---------------------------------------------------------------------------------------------
# Course 6
# ---------------------------------------------------------------------------------------------

C6 = "net-intervlan"

S1_THREE_VLANS = [
    "enable",
    "configure terminal",
    "vlan 10",
    "name STAFF",
    "vlan 20",
    "name GUEST",
    "vlan 30",
    "name SERVERS",
    "exit",
    "interface fa0/1",
    "switchport mode access",
    "switchport access vlan 10",
    "interface fa0/2",
    "switchport mode access",
    "switchport access vlan 20",
    "interface fa0/3",
    "switchport mode access",
    "switchport access vlan 30",
    "end",
]

COURSE_6 = {
    "id": C6,
    "version": 1,
    "order": 6,
    "title": "6. Inter-VLAN routing with router-on-a-stick",
    "summary": (
        "Route between VLANs with one router port: split it into 802.1Q subinterfaces, give each VLAN its "
        "gateway, and trunk the switch port that faces the router. Follow a packet as it crosses the trunk "
        "twice, and troubleshoot the usual mismatches. The lab connects STAFF, GUEST and SERVERS VLANs through R1."
    ),
    "difficulty": "Intermediate",
    "minutes": 45,
    "lessons": [
        lesson(
            f"{C6}-s1",
            "Why VLANs need a router",
            [
                "VLANs isolate traffic at layer 2, and each VLAN normally holds its own IP subnet. A host in VLAN "
                "10 sends every packet for another subnet to its default gateway, so a device with an address in "
                "each VLAN must route between them. That device is a router or a layer 3 switch.",
                "There are three common designs. One router interface per VLAN works, but it uses many ports and "
                "cables. Router-on-a-stick uses a single router interface split into subinterfaces, one per VLAN, "
                "over an 802.1Q trunk. A layer 3 switch routes between VLANs internally with switched virtual "
                "interfaces (SVIs). The VoltQuest lab supports the first two; its switches have no IP "
                "interfaces, so SVIs are concept-only here.",
                "Router-on-a-stick is cheap and simple, but all traffic between VLANs shares one physical link "
                "and crosses it twice: once into the router and once back out. For a small branch that is fine; "
                "busy campus networks route on layer 3 switches instead.",
            ],
            "pc",
            lines(
                "! PC1 in VLAN 10 checks its address, mask and gateway",
                r"C:\> ipconfig",
                "! Same VLAN and subnet: the switch delivers it alone",
                r"C:\> ping 192.168.10.12",
                "! Another VLAN: the packet must go through the gateway",
                r"C:\> ping 192.168.20.11",
                r"C:\> tracert 192.168.20.11",
            ),
            "Giving hosts a gateway from another VLAN. Each host's gateway must be the router address in its own "
            "VLAN's subnet, such as 192.168.10.1 for VLAN 10 and 192.168.20.1 for VLAN 20.",
            question(
                f"{C6}-q1",
                "What lets a host in VLAN 10 reach a host in VLAN 20?",
                [
                    "An 802.1Q trunk between the two switches that carries both VLANs",
                    "A layer 2 switch with a larger MAC table",
                    "A router or layer 3 switch with an address in each VLAN",
                ],
                "c",
                "A trunk only carries VLANs; it does not connect them. Traffic between VLANs must be routed by a "
                "device that has a gateway address in each one.",
            ),
        ),
        lesson(
            f"{C6}-s2",
            "Subinterfaces and dot1Q encapsulation",
            [
                "A subinterface is a logical interface on a physical port, written with a dot: `interface "
                "g0/0.10`. Each one gets a VLAN with `encapsulation dot1Q 10` and an address with `ip address`. "
                "The subinterface then accepts frames tagged with VLAN 10 and tags the frames it sends. The "
                "number after the dot is only a label, but matching it to the VLAN ID keeps configurations "
                "readable.",
                "Order matters: type `encapsulation dot1Q` before `ip address`. Until the subinterface knows its "
                "VLAN, the router refuses the address with a message saying the subinterface must first belong to "
                "an IEEE 802.1Q VLAN. Enable the physical interface with `no shutdown` as well, because "
                "subinterfaces cannot work while their parent port is down.",
                "Each subinterface address becomes the default gateway for its VLAN and adds a connected route, so "
                "`show ip route` lists one C route per VLAN subnet. Real routers can also mark one subinterface as "
                "the handler for untagged native VLAN frames; in the lab, give every routed VLAN a tagged "
                "subinterface and keep user hosts out of the native VLAN.",
            ],
            "router",
            lines(
                "R1> enable",
                "R1# configure terminal",
                "R1(config)# interface g0/0",
                "R1(config-if)# no shutdown",
                "R1(config-if)# interface g0/0.10",
                "R1(config-subif)# description STAFF gateway",
                "R1(config-subif)# encapsulation dot1Q 10",
                "R1(config-subif)# ip address 192.168.10.1 255.255.255.0",
                "R1(config-subif)# interface g0/0.20",
                "R1(config-subif)# description GUEST gateway",
                "R1(config-subif)# encapsulation dot1Q 20",
                "R1(config-subif)# ip address 192.168.20.1 255.255.255.0",
                "R1(config-subif)# end",
                "R1# show ip interface brief",
            ),
            "Typing `ip address` before `encapsulation dot1Q`. The router refuses the address on a LAN "
            "subinterface until it knows the VLAN. Set the encapsulation first, then enter the address again.",
            question(
                f"{C6}-q2",
                "What does `encapsulation dot1Q 20` do on interface g0/0.20?",
                [
                    "Binds the subinterface to VLAN 20 for tagged frames in and out",
                    "Creates VLAN 20 in the database of the connected switch",
                    "Makes VLAN 20 the native, untagged VLAN of the trunk",
                ],
                "a",
                "The encapsulation command binds the subinterface to one VLAN tag. VLANs on the switch are "
                "configured on the switch itself.",
            ),
        ),
        lesson(
            f"{C6}-s3",
            "The switch side: a trunk to the router",
            [
                "The router's subinterfaces send and expect tagged frames, so the switch port that faces the "
                "router must be a trunk that allows every routed VLAN. If that port stays an access port, the "
                "switch drops the router's tagged frames: hosts still reach each other inside a VLAN, but never "
                "their gateway.",
                "Follow a packet from PC1 in VLAN 10 to PC2 in VLAN 20. PC1 sends an untagged frame to its "
                "gateway's MAC address. The switch tags it with VLAN 10 on the trunk. R1 receives it on g0/0.10, "
                "routes it to 192.168.20.0/24 and sends it out of g0/0.20 tagged with VLAN 20. The switch removes "
                "the tag and delivers the frame to PC2's access port. The packet crosses the trunk twice.",
                "Every VLAN on the path must exist on the switch, and each host port must be in the right VLAN. "
                "`show vlan brief` and `show interfaces trunk` on the switch, plus `show ip interface brief` on "
                "the router, find most problems in a few seconds.",
            ],
            "switch",
            lines(
                "S1> enable",
                "S1# configure terminal",
                "S1(config)# vlan 10",
                "S1(config-vlan)# name STAFF",
                "S1(config-vlan)# vlan 20",
                "S1(config-vlan)# name GUEST",
                "S1(config-vlan)# exit",
                "S1(config)# interface fa0/1",
                "S1(config-if)# switchport access vlan 10",
                "S1(config-if)# interface fa0/2",
                "S1(config-if)# switchport access vlan 20",
                "! The port facing R1 carries both VLANs, tagged",
                "S1(config-if)# interface g0/2",
                "S1(config-if)# switchport mode trunk",
                "S1(config-if)# end",
                "S1# show interfaces trunk",
            ),
            "Leaving the router-facing port as an access port. The router sends tagged frames and the switch "
            "drops them, so hosts can ping each other inside a VLAN but never reach their gateway.",
            question(
                f"{C6}-q3",
                "In router-on-a-stick, how many times does a packet from VLAN 10 to VLAN 20 cross the link between "
                "the switch and the router?",
                [
                    "Once, from the switch to the router",
                    "Twice: tagged 10 toward the router, tagged 20 on the way back",
                    "Never: the switch forwards it between the VLANs itself",
                ],
                "b",
                "The router receives the packet on the VLAN 10 subinterface and sends it back out on the VLAN 20 "
                "subinterface, over the same physical link.",
            ),
        ),
        lesson(
            f"{C6}-s4",
            "Verifying and securing inter-VLAN routing",
            [
                "Verify from the bottom up. On the switch, check VLAN membership and the trunk. On the router, "
                "`show ip interface brief` should list each subinterface up/up with its gateway address, and "
                "`show ip route` should hold one connected route per VLAN. Then ping each gateway from a host in "
                "its VLAN, and finally a host in another VLAN.",
                "Typical faults are small. A subinterface with the wrong VLAN number (`encapsulation dot1Q 21` "
                "instead of 20) never sees its VLAN's frames. A VLAN missing from the trunk's allowed list cuts "
                "that VLAN only. A host with a gateway from another subnet reaches its own VLAN and nothing else. "
                "A shut physical port takes every subinterface down with it.",
                "Once the router routes between VLANs, every VLAN can reach every other VLAN. Routing restores "
                "connectivity; it does not decide who should talk to whom. To keep guests away from staff devices "
                "or servers, add access lists on the router (course 9). Segmentation only helps security when the "
                "routed paths between segments are filtered.",
            ],
            "router",
            lines(
                "R1> show ip interface brief",
                "R1> show ip route",
                "! Test hosts in each VLAN from the router itself",
                "R1> ping 192.168.10.11",
                "R1> ping 192.168.20.11",
                "R1> enable",
                "R1# show running-config",
            ),
            "A subinterface tied to the wrong VLAN. If g0/0.20 says `encapsulation dot1Q 30`, guest frames tagged "
            "20 find no subinterface. The guest PCs cannot reach their gateway, although every address is correct.",
            question(
                f"{C6}-q4",
                "Inter-VLAN routing works, and now a guest PC can open the staff file server. Why?",
                [
                    "The router forwards all traffic between VLANs until you add an access list",
                    "The trunk is misconfigured, so it leaks frames from one VLAN into another",
                    "The guest VLAN shares the staff VLAN's MAC address table on the switch",
                ],
                "a",
                "A router forwards every packet it has a route for. Policy between VLANs comes from access lists "
                "or a firewall, not from the VLANs themselves.",
            ),
        ),
    ],
    "steps": [
        "On S1 run `show vlan brief`: STAFF (10), GUEST (20) and SERVERS (30) exist with their host ports. Then "
        "make Gi0/2, the port facing R1, a trunk with `switchport mode trunk`.",
        "On R1 bring up the parent port: `interface g0/0`, `no shutdown`.",
        "Create `interface g0/0.10`, type `encapsulation dot1Q 10`, then `ip address 192.168.10.1 255.255.255.0`. "
        "Repeat for g0/0.20 (192.168.20.1) and g0/0.30 (192.168.30.1).",
        "Run `show ip interface brief` and `show ip route` on R1: three subinterfaces up/up and three connected "
        "VLAN subnets.",
        "From PC1 ping PC2 (192.168.20.11) and Server1 (192.168.30.10). The first echo may time out while R1 "
        "resolves ARP.",
        "Open http://192.168.30.10 in PC1's browser. In the step-by-step view the request crosses the R1-S1 "
        "cable twice: tagged with VLAN 10 toward R1 and with VLAN 30 back toward S1.",
        "Press Check results.",
    ],
    "expected": (
        "R1 lists GigabitEthernet0/0.10, 0/0.20 and 0/0.30 up/up with the three gateway addresses, and `show "
        "interfaces trunk` on S1 lists Gi0/2. PC1 reaches PC2 and Server1 with TTL=127, and the intranet page "
        "loads in PC1's browser."
    ),
    "challenge": {
        "task": (
            "Course labs cannot be edited, so use \"Open a sandbox copy in a new tab\" under the lab and work in the copy. "
            "Add VLAN 40 PRINTERS: create it on S1, connect a stand-in PC on Fa0/5 with 192.168.40.10/24 and "
            "gateway 192.168.40.1, and add the matching subinterface on R1. Then explain why GUEST can reach the "
            "printer too, and what would stop it."
        ),
        "acceptance": [
            "VLAN 40 exists on S1 with Fa0/5 assigned, and R1 g0/0.40 uses `encapsulation dot1Q 40` with "
            "192.168.40.1/24",
            "PC1 pings 192.168.40.10 across R1",
            "You explain that PC2 (GUEST) can reach the printer as well until an access list on R1 filters that "
            "traffic (course 9)",
        ],
    },
    "lab": {
        "title": "Router-on-a-stick for STAFF, GUEST and SERVERS",
        "brief": (
            "S1 already holds VLAN 10 STAFF (PC1 on Fa0/1), VLAN 20 GUEST (PC2 on Fa0/2) and VLAN 30 SERVERS "
            "(Server1 on Fa0/3). Each host uses the .1 address of its subnet as gateway: 192.168.10.1, "
            "192.168.20.1 and 192.168.30.1. R1 is blank. Trunk S1's Gi0/2 to R1, build one subinterface per VLAN "
            "on R1 g0/0, and make all three VLANs reach each other."
        ),
        "topology": {
            "devices": [
                device("R1", "router", 380, 70),
                device("S1", "switch", 380, 210, config=S1_THREE_VLANS),
                device("PC1", "pc", 130, 340, host("192.168.10.11", "255.255.255.0", "192.168.10.1")),
                device("PC2", "pc", 380, 340, host("192.168.20.11", "255.255.255.0", "192.168.20.1")),
                device("Server1", "server", 630, 340, host("192.168.30.10", "255.255.255.0", "192.168.30.1"),
                       web("SERVERS VLAN: intranet home page")),
            ],
            "links": [
                "PC1 Fa0 S1 Fa0/1",
                "PC2 Fa0 S1 Fa0/2",
                "Server1 Fa0 S1 Fa0/3",
                "S1 Gi0/2 R1 Gi0/0",
            ],
        },
        "goals": [
            {"type": "port", "device": "S1", "port": "Gi0/2", "mode": "trunk",
             "label": "S1 Gi0/2, the port facing R1, is a trunk"},
            {"type": "interface", "device": "R1", "iface": "g0/0.10", "ip": "192.168.10.1", "vlan": 10, "up": True,
             "label": "R1 g0/0.10 is up as the VLAN 10 gateway"},
            {"type": "interface", "device": "R1", "iface": "g0/0.20", "ip": "192.168.20.1", "vlan": 20, "up": True,
             "label": "R1 g0/0.20 is up as the VLAN 20 gateway"},
            {"type": "interface", "device": "R1", "iface": "g0/0.30", "ip": "192.168.30.1", "vlan": 30, "up": True,
             "label": "R1 g0/0.30 is up as the VLAN 30 gateway"},
            {"type": "ping", "from": "PC1", "to": "192.168.20.11", "label": "PC1 (STAFF) reaches PC2 (GUEST)"},
            {"type": "ping", "from": "PC2", "to": "192.168.30.10", "label": "PC2 (GUEST) reaches Server1 (SERVERS)"},
            {"type": "http", "from": "PC1", "url": "http://192.168.30.10", "label": "PC1 loads the intranet page"},
        ],
        "solution": [
            {"device": "S1", "cli": ["enable", "configure terminal", "interface g0/2", "switchport mode trunk", "end"]},
            {"device": "R1", "cli": [
                "enable", "configure terminal",
                "interface g0/0", "no shutdown",
                "interface g0/0.10", "encapsulation dot1Q 10", "ip address 192.168.10.1 255.255.255.0",
                "interface g0/0.20", "encapsulation dot1Q 20", "ip address 192.168.20.1 255.255.255.0",
                "interface g0/0.30", "encapsulation dot1Q 30", "ip address 192.168.30.1 255.255.255.0",
                "end",
            ]},
        ],
    },
    "exam": {
        "passPercent": 80,
        "questions": [
            question(
                f"{C6}-e1",
                "Why does router-on-a-stick need only one router port for several VLANs?",
                [
                    "The router merges all the VLANs into one broadcast domain on that port",
                    "The link is an 802.1Q trunk, and each VLAN gets its own subinterface",
                    "The switch routes on behalf of the router",
                ],
                "b",
                "Tags keep the VLANs apart on the shared link, and each subinterface acts as the gateway for one "
                "VLAN.",
                f"{C6}-s1",
            ),
            question(
                f"{C6}-e2",
                "You type `ip address 192.168.20.1 255.255.255.0` on g0/0.20 before any `encapsulation dot1Q` "
                "line. What happens?",
                [
                    "The router refuses the address until the subinterface belongs to a VLAN",
                    "The router applies the address to VLAN 1, the default VLAN of every port",
                    "The physical interface g0/0 takes the address instead",
                ],
                "a",
                "A LAN subinterface needs its VLAN first. Type `encapsulation dot1Q 20`, then the address.",
                f"{C6}-s2",
            ),
            question(
                f"{C6}-e3",
                "PCs in VLAN 10 ping each other but not their gateway 192.168.10.1 on R1 g0/0.10. The switch port "
                "to R1 is `switchport mode access`. What fixes it?",
                [
                    "Changing the PCs' masks to /16",
                    "Making the switch port to R1 a trunk",
                    "Adding a static route on R1",
                ],
                "b",
                "The router's subinterfaces send and expect tagged frames. An access port drops them, so the "
                "gateway stays unreachable until the port is a trunk.",
                f"{C6}-s3",
            ),
            question(
                f"{C6}-e4",
                "Guests cannot reach 192.168.20.1. R1 shows g0/0.20 up with the right address and `encapsulation "
                "dot1Q 21`. What is wrong?",
                [
                    "The subinterface mask does not match the guests' mask",
                    "R1 needs a default route before it answers the guests",
                    "It expects VLAN 21, so frames tagged 20 never reach it",
                ],
                "c",
                "The router matches a frame's tag to a subinterface. With the wrong VLAN number, guest frames find "
                "no matching subinterface.",
                f"{C6}-s4",
            ),
            question(
                f"{C6}-e5",
                "Which statement about security after enabling inter-VLAN routing is true?",
                [
                    "All VLANs can now reach each other; filter routed traffic with access lists",
                    "VLANs still block all traffic between them until you allow it per VLAN",
                    "The 802.1Q trunk encrypts all the traffic that it carries between VLANs",
                ],
                "a",
                "Routing connects the VLANs completely. Policy, such as keeping guests away from servers, needs "
                "access lists or a firewall.",
                f"{C6}-s4",
            ),
        ],
    },
    "sources": [IEEE_8021Q, rfc(1812, "Requirements for IP Version 4 Routers")],
}

COURSES_4_TO_6 = [COURSE_4, COURSE_5, COURSE_6]
