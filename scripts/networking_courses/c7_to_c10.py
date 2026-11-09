"""Networking courses 7 to 10: OSPF, DHCP and DNS, access control lists, NAT and the branch capstone."""

from networking_courses.common import (
    NIST_80041, device, dhcp_client, host, lesson, lines, question, rfc, web,
)

# ---------------------------------------------------------------------------------------------
# Course 7
# ---------------------------------------------------------------------------------------------

C7 = "net-ospf"

R1_OSPF = [
    "enable", "configure terminal",
    "interface g0/0", "description LAN 10.1.1.0/24", "ip address 10.1.1.1 255.255.255.0", "no shutdown",
    "interface g0/1", "description Link to R2", "ip address 10.0.12.1 255.255.255.252", "no shutdown",
    "exit",
    "router ospf 1", "router-id 1.1.1.1",
    "network 10.1.1.0 0.0.0.255 area 0", "network 10.0.12.0 0.0.0.3 area 0",
    "end",
]
R2_OSPF = [
    "enable", "configure terminal",
    "interface g0/0", "description Link to R1", "ip address 10.0.12.2 255.255.255.252", "no shutdown",
    "interface g0/1", "description Link to R3", "ip address 10.0.23.1 255.255.255.252", "no shutdown",
    "interface g0/2", "description LAN 10.2.2.0/24", "ip address 10.2.2.1 255.255.255.0", "no shutdown",
    "exit",
    "router ospf 1", "router-id 2.2.2.2",
    "network 10.0.12.0 0.0.0.3 area 0", "network 10.0.23.0 0.0.0.3 area 1",
    "end",
]
R3_EDGE = [
    "enable", "configure terminal",
    "interface g0/0", "description Link to R2", "ip address 10.0.23.2 255.255.255.252", "no shutdown",
    "interface g0/1", "description Server LAN 10.3.3.0/24", "ip address 10.3.3.1 255.255.255.0", "no shutdown",
    "interface g0/2", "description Uplink to the provider", "ip address 203.0.113.1 255.255.255.252", "no shutdown",
    "end",
]
R4_PROVIDER = [
    "enable", "configure terminal",
    "interface g0/0", "description Link to the branch", "ip address 203.0.113.2 255.255.255.252", "no shutdown",
    "interface g0/1", "description Web server LAN", "ip address 198.51.100.1 255.255.255.0", "no shutdown",
    "exit",
    "ip route 10.0.0.0 255.0.0.0 203.0.113.1",
    "end",
]

COURSE_7 = {
    "id": C7,
    "version": 1,
    "order": 7,
    "title": "7. Dynamic routing with OSPF",
    "summary": (
        "Let routers learn routes by themselves with OSPF, a link-state protocol. Enable it with network "
        "statements and wildcard masks, form neighbor adjacencies in area 0, read costs and administrative "
        "distance, quiet LAN interfaces with passive-interface, and share a default route. The lab repairs and "
        "finishes OSPF across three routers with an Internet edge."
    ),
    "difficulty": "Advanced",
    "minutes": 60,
    "lessons": [
        lesson(
            f"{C7}-s1",
            "Link-state routing",
            [
                "Static routes do not scale: every new subnet means editing every router, and nothing reroutes "
                "around a failed link. Dynamic routing protocols let routers share what they know and adapt by "
                "themselves. Distance-vector protocols pass on lists of destinations and distances. Link-state "
                "protocols such as OSPF give every router a full map instead.",
                "OSPF version 2 (RFC 2328) routes IPv4. Each router describes its own links in link-state "
                "advertisements (LSAs) and floods them to its neighbors, so every router in an area builds the "
                "same link-state database. Each router then runs the shortest path first (SPF) algorithm, "
                "Dijkstra's algorithm, with itself as the root, and installs the lowest-cost path to every network.",
                "The metric is cost. By default, the widely used router CLI style divides a reference bandwidth "
                "of 100 Mbit/s by the interface bandwidth, so Fast Ethernet and Gigabit Ethernet links both cost "
                "1 unless you raise the reference. The VoltQuest lab gives every link a cost of 1, so a route's "
                "metric counts the links from the router to the destination network, including that network's "
                "own LAN.",
            ],
            "none",
            lines(
                "Router  Links it describes in its LSAs",
                "R1      10.1.1.0/24 (LAN), 10.0.12.0/30 to R2",
                "R2      10.0.12.0/30 to R1, 10.0.23.0/30 to R3, 10.2.2.0/24 (LAN)",
                "R3      10.0.23.0/30 to R2, 10.3.3.0/24 (LAN)",
                "Every router holds this same database and runs SPF from itself.",
                "R1's best path to 10.3.3.0/24: R1, R2, R3, cost 1 + 1 + 1 = 3",
            ),
            "Assuming OSPF picks the path through the fewest routers. It picks the lowest total cost. With the "
            "default reference bandwidth, a 1 Gbit/s link and a 100 Mbit/s link both cost 1, so real networks "
            "raise the reference bandwidth or set interface costs to make OSPF prefer the faster path.",
            question(
                f"{C7}-q1",
                "What does each OSPF router run on its link-state database to choose best paths?",
                [
                    "A hop-count vote among its neighbors",
                    "The SPF (Dijkstra) shortest-path algorithm",
                    "A DNS lookup for each network",
                ],
                "b",
                "Every router in the area holds the same map and computes its own shortest-path tree with "
                "Dijkstra's algorithm, using cost as the distance.",
            ),
        ),
        lesson(
            f"{C7}-s2",
            "Network statements and wildcard masks",
            [
                "Start OSPF with `router ospf <process-id>`. The process ID is local to the router and does not "
                "have to match the neighbors. Then tell OSPF which interfaces to use with `network <address> "
                "<wildcard> area <area-id>`. Every interface whose address matches the statement joins that "
                "area: OSPF sends hellos on it and advertises its subnet.",
                "A wildcard mask is an inverted subnet mask: a 0 bit means \"must match\" and a 1 bit means "
                "\"ignore\". Subtract the mask from 255.255.255.255 to get it, so /24 becomes 0.0.0.255 and /30 "
                "becomes 0.0.0.3. A wildcard of 0.0.0.0 matches one exact address, as in `network 10.0.12.1 "
                "0.0.0.0 area 0`, which is the most precise way to enable a single interface.",
                "Each router needs a unique router ID, a 32-bit number written like an IP address. Set it with "
                "`router-id 1.1.1.1`, or the router picks one: the highest loopback address on real routers, "
                "otherwise the highest address of an active interface. The lab has no loopbacks, so it uses the "
                "highest interface address. Real routers apply a changed ID only after the OSPF process restarts, "
                "so they print a reminder to run `clear ip ospf process`. The lab accepts that command too, but it "
                "applies a new ID at once anyway.",
            ],
            "router",
            lines(
                "R1> enable",
                "R1# configure terminal",
                "R1(config)# router ospf 1",
                "R1(config-router)# router-id 1.1.1.1",
                "R1(config-router)# network 10.1.1.0 0.0.0.255 area 0",
                "R1(config-router)# network 10.0.12.0 0.0.0.3 area 0",
                "R1(config-router)# end",
                "! Real routers use a new router ID only after the process restarts",
                "R1# clear ip ospf process",
                "R1# show running-config",
            ),
            "A wildcard that misses the interface. `network 10.0.12.0 0.0.0.0 area 0` matches only the address "
            "10.0.12.0 itself, so the interface 10.0.12.1 never joins OSPF and no neighbor appears. Use 0.0.0.3 "
            "for the /30, or the interface's exact address with 0.0.0.0.",
            question(
                f"{C7}-q2",
                "Which wildcard mask matches every address in 172.16.8.0/22?",
                ["255.255.252.0", "0.0.7.255", "0.0.3.255"],
                "c",
                "A /22 mask is 255.255.252.0. Subtracting it from 255.255.255.255 gives 0.0.3.255. The wildcard "
                "0.0.7.255 would cover a /21.",
            ),
        ),
        lesson(
            f"{C7}-s3",
            "Neighbors, adjacencies and areas",
            [
                "OSPF routers find each other with hello packets sent to 224.0.0.5. To become neighbors, two "
                "routers must share a subnet and agree on the area ID, the subnet mask, the hello and dead timers, "
                "the authentication settings and the area type, and their router IDs must differ. Neighbors then "
                "exchange their databases and reach the FULL state, which `show ip ospf neighbor` displays.",
                "On multi-access segments such as Ethernet, real OSPF elects a designated router (DR) and a backup "
                "(BDR) to reduce flooding; point-to-point links need no DR. The VoltQuest lab models a single area "
                "without DR/BDR elections or timers: an adjacency forms when the subnet, the mask and the area "
                "match, and the neighbor table shows `FULL/  -` with a dead time of `--`.",
                "Areas let OSPF scale. Area 0 is the backbone, and every other area must connect to it through an "
                "area border router, which can summarize routes between areas. Small networks use area 0 alone, "
                "as this course does. If two routers put their shared link in different areas, they never become "
                "neighbors, even though they can ping each other.",
            ],
            "router",
            lines(
                "R2> enable",
                "R2# configure terminal",
                "R2(config)# router ospf 1",
                "R2(config-router)# router-id 2.2.2.2",
                "R2(config-router)# network 10.0.12.0 0.0.0.3 area 0",
                "R2(config-router)# network 10.0.23.0 0.0.0.3 area 0",
                "R2(config-router)# end",
                "R2# show ip ospf neighbor",
                "R2# show ip route",
            ),
            "Mismatched area numbers. If R1 puts 10.0.12.0/30 in area 0 and R2 puts it in area 1, the routers "
            "never form an adjacency, and `show ip ospf neighbor` stays empty. To move a statement to another "
            "area, remove it with `no network` first: the router refuses the same network in a second area.",
            question(
                f"{C7}-q3",
                "R1 and R2 share 10.0.12.0/30. R1's statement says area 0 and R2's says area 1. What do you "
                "observe?",
                [
                    "No OSPF neighbor on that link, although ping across it works",
                    "A FULL adjacency, with routes passed between area 0 and area 1",
                    "OSPF moves R2's interface into area 0 automatically to match R1",
                ],
                "a",
                "The area ID is carried in every hello and must match. Plain IP connectivity is unaffected, which "
                "is why ping still works.",
            ),
        ),
        lesson(
            f"{C7}-s4",
            "Metrics, administrative distance, passive interfaces and default routes",
            [
                "`show ip route` prints OSPF routes with code O and two numbers in brackets, such as `[110/3]`: "
                "the administrative distance and the metric. Administrative distance ranks route sources when "
                "several offer the same prefix. In the widely used router CLI style, connected routes have 0, "
                "static routes 1 and OSPF 110, so a static route for a prefix replaces the OSPF route for that "
                "prefix.",
                "LAN interfaces need OSPF so that their subnet is advertised, but no other router lives there. "
                "`passive-interface g0/0` keeps the subnet in OSPF while stopping hellos on that interface. That "
                "saves work and stops a rogue device on the LAN from forming an adjacency and injecting false "
                "routes, so passive LAN interfaces are a security habit as well.",
                "The router at the Internet edge usually has a static default route. `default-information "
                "originate` under `router ospf` advertises that default to every other OSPF router, which installs "
                "it as `O*E2 0.0.0.0/0`. The edge router advertises the default only while it has one itself; real "
                "routers can force it with the `always` keyword, which the lab does not support.",
            ],
            "router",
            lines(
                "R3> enable",
                "R3# configure terminal",
                "R3(config)# router ospf 1",
                "! No routers live on the server LAN: advertise it, but send no hellos there",
                "R3(config-router)# passive-interface g0/1",
                "R3(config-router)# exit",
                "! The edge router knows the way out and shares it through OSPF",
                "R3(config)# ip route 0.0.0.0 0.0.0.0 203.0.113.2",
                "R3(config)# router ospf 1",
                "R3(config-router)# default-information originate",
                "R3(config-router)# end",
                "R3# show ip route",
            ),
            "Making a transit interface passive. `passive-interface` on the link to another router stops the "
            "hellos there, the adjacency drops, and every route learned through that neighbor disappears. Only "
            "make LAN or stub interfaces passive.",
            question(
                f"{C7}-q4",
                "R3 learns 10.1.1.0/24 through OSPF and also has a static route for 10.1.1.0/24. Which route does "
                "it install?",
                [
                    "The OSPF route, because dynamic routes are preferred",
                    "The static route, because distance 1 beats OSPF's 110",
                    "Both routes, sharing the load between them",
                ],
                "b",
                "For the same prefix, the source with the lower administrative distance wins. Metrics are only "
                "compared between routes from the same source.",
            ),
        ),
    ],
    "steps": [
        "On R2 run `show ip ospf neighbor`: only 1.1.1.1 (R1) appears. Read R2's `show running-config`: the R2-R3 "
        "link sits in area 1, and the LAN 10.2.2.0/24 is missing.",
        "On R2 enter `router ospf 1`, remove the wrong statement with `no network 10.0.23.0 0.0.0.3 area 1`, then "
        "add `network 10.0.23.0 0.0.0.3 area 0` and `network 10.2.2.0 0.0.0.255 area 0`. If you skip the removal, "
        "R2 refuses with `% OSPF: network 10.0.23.0 0.0.0.3 is already in area 1; remove it with \"no network\" "
        "first`.",
        "On R3 start `router ospf 1` with `router-id 3.3.3.3` and network statements for 10.0.23.0/30 and "
        "10.3.3.0/24 in area 0. R2's neighbor table now lists 1.1.1.1 and 3.3.3.3.",
        "Make the LAN interfaces passive: R1 g0/0, R2 g0/2 and R3 g0/1. The LAN subnets stay in OSPF, but no "
        "hellos go to the hosts.",
        "On R3 add `ip route 0.0.0.0 0.0.0.0 203.0.113.2`, then `default-information originate` under `router "
        "ospf 1`. R1 and R2 now show an `O*E2 0.0.0.0/0` route.",
        "Ping Server1 (10.3.3.10) and the provider's server (198.51.100.10) from PC1, and 198.51.100.10 from PC2. "
        "A first ping can lose one echo per router while ARP resolves; from PC1 the provider's server is four "
        "routers away, so ping it twice.",
        "Press Check results.",
    ],
    "expected": (
        "R2 lists neighbors 1.1.1.1 and 3.3.3.3 in state `FULL/  -`. R1's table shows `10.3.3.0/24 [110/3] via "
        "10.0.12.2` and `O*E2  0.0.0.0/0 [110/1] via 10.0.12.2`. PC1 reaches Server1 and, on a second ping, "
        "198.51.100.10; PC2 reaches 198.51.100.10, and Server1 reaches PC1."
    ),
    "challenge": {
        "task": (
            "Compare route sources and watch OSPF react. Add `ip route 10.3.3.0 255.255.255.0 10.0.12.2` on R1, "
            "read `show ip route`, then remove it. Next shut R2 g0/1 and read R1's table again, then bring the "
            "interface back with `no shutdown`."
        ),
        "acceptance": [
            "While the static route exists, R1 lists 10.3.3.0/24 as an S route `[1/0] via 10.0.12.2` instead of the "
            "OSPF route, because distance 1 beats 110",
            "After `no ip route 10.3.3.0 255.255.255.0 10.0.12.2`, the O route with `[110/3]` returns",
            "With R2 g0/1 shut, R1 loses 10.3.3.0/24 and the default route, and both return after `no shutdown`",
        ],
    },
    "lab": {
        "title": "Finish and repair OSPF in area 0",
        "brief": (
            "R1, R2 and R3 connect three LANs: 10.1.1.0/24 (PC1), 10.2.2.0/24 (PC2) and 10.3.3.0/24 (Server1). "
            "R3 is the edge router toward R4, which stands in for an upstream provider with a web server at "
            "198.51.100.10; R4 already routes 10.0.0.0/8 back to R3, because NAT is not part of this course. R1 "
            "runs OSPF correctly. R2 runs OSPF with a fault, and R3 has no OSPF at all. Repair R2, configure R3 "
            "with router ID 3.3.3.3, make the LAN interfaces passive, and let R3 share a default route toward R4 "
            "(203.0.113.2)."
        ),
        "topology": {
            "devices": [
                device("R1", "router", 130, 150, config=R1_OSPF),
                device("R2", "router", 310, 150, config=R2_OSPF),
                device("R3", "router", 490, 150, config=R3_EDGE),
                device("R4", "router", 670, 150, config=R4_PROVIDER),
                device("PC1", "pc", 130, 320, host("10.1.1.10", "255.255.255.0", "10.1.1.1")),
                device("PC2", "pc", 310, 320, host("10.2.2.10", "255.255.255.0", "10.2.2.1")),
                device("Server1", "server", 490, 320, host("10.3.3.10", "255.255.255.0", "10.3.3.1"),
                       web("Server1 on 10.3.3.0/24")),
                device("Server2", "server", 670, 320, host("198.51.100.10", "255.255.255.0", "198.51.100.1"),
                       web("Provider test web server")),
            ],
            "links": [
                "PC1 Fa0 R1 Gi0/0",
                "R1 Gi0/1 R2 Gi0/0",
                "R2 Gi0/1 R3 Gi0/0",
                "PC2 Fa0 R2 Gi0/2",
                "Server1 Fa0 R3 Gi0/1",
                "R3 Gi0/2 R4 Gi0/0",
                "Server2 Fa0 R4 Gi0/1",
            ],
        },
        "goals": [
            {"type": "ospf", "device": "R2", "neighbors": 2, "label": "R2 has two OSPF neighbors, R1 and R3"},
            {"type": "route", "device": "R1", "prefix": "10.3.3.0/24", "code": "O",
             "label": "R1 learns 10.3.3.0/24 through OSPF"},
            {"type": "route", "device": "R3", "prefix": "10.2.2.0/24", "code": "O",
             "label": "R3 learns R2's LAN 10.2.2.0/24 through OSPF"},
            {"type": "route", "device": "R1", "prefix": "0.0.0.0/0", "code": "O",
             "label": "R1 learns the default route from R3 through OSPF"},
            {"type": "ping", "from": "PC1", "to": "10.3.3.10", "label": "PC1 reaches Server1"},
            {"type": "ping", "from": "PC2", "to": "198.51.100.10", "label": "PC2 reaches the provider's web server"},
            {"type": "ping", "from": "PC1", "to": "198.51.100.10",
             "label": "PC1 reaches the provider's web server, four routers away"},
            {"type": "ping", "from": "Server1", "to": "10.1.1.10", "label": "Server1 reaches PC1"},
        ],
        "solution": [
            {"device": "R2", "cli": [
                "enable", "configure terminal", "router ospf 1",
                "no network 10.0.23.0 0.0.0.3 area 1",
                "network 10.0.23.0 0.0.0.3 area 0", "network 10.2.2.0 0.0.0.255 area 0",
                "passive-interface g0/2", "end",
            ]},
            {"device": "R3", "cli": [
                "enable", "configure terminal", "ip route 0.0.0.0 0.0.0.0 203.0.113.2",
                "router ospf 1", "router-id 3.3.3.3",
                "network 10.0.23.0 0.0.0.3 area 0", "network 10.3.3.0 0.0.0.255 area 0",
                "passive-interface g0/1", "default-information originate", "end",
            ]},
            {"device": "R1", "cli": ["enable", "configure terminal", "router ospf 1", "passive-interface g0/0", "end"]},
        ],
    },
    "exam": {
        "passPercent": 80,
        "questions": [
            question(
                f"{C7}-e1",
                "What do OSPF routers flood so that they all build the same map of the network?",
                [
                    "Their full routing tables, sent to every neighbor every 30 seconds",
                    "Link-state advertisements (LSAs) that describe their links",
                    "Their ARP caches and MAC address tables",
                ],
                "b",
                "LSAs describe each router's links. Flooded through the area, they give every router the same "
                "link-state database to run SPF on.",
                f"{C7}-s1",
            ),
            question(
                f"{C7}-e2",
                "Which statement enables OSPF area 0 on the interface 192.168.5.1/24 and on nothing else?",
                [
                    "`network 192.168.5.1 0.0.0.0 area 0`",
                    "`network 192.168.0.0 0.0.255.255 area 0`",
                    "`network 192.168.5.0 0.0.0.255 area 1`",
                ],
                "a",
                "A 0.0.0.0 wildcard matches exactly one address. The /16 wildcard would also enable every other "
                "192.168.x.x interface, and the last option uses the wrong area.",
                f"{C7}-s2",
            ),
            question(
                f"{C7}-e3",
                "Two routers on one /30 link show no OSPF neighbors, although their areas match. Which of these "
                "must also match?",
                [
                    "Their hostnames, which OSPF exchanges in every hello packet",
                    "Their OSPF process IDs, the number after `router ospf`",
                    "Subnet and mask, plus timers and authentication on real routers",
                ],
                "c",
                "Process IDs are local to each router and hostnames play no part. Neighbors must agree on the "
                "subnet, the mask and the hello parameters.",
                f"{C7}-s3",
            ),
            question(
                f"{C7}-e4",
                "What do the numbers in `O 10.3.3.0/24 [110/3] via 10.0.12.2` mean?",
                [
                    "Administrative distance 110 and OSPF cost 3",
                    "Process 110 and area 3",
                    "Learned 110 seconds ago, 3 hops away",
                ],
                "a",
                "The first number ranks the route source (OSPF is 110 by default) and the second is the total "
                "cost to the destination.",
                f"{C7}-s4",
            ),
            question(
                f"{C7}-e5",
                "Why make a LAN interface passive in OSPF?",
                [
                    "To stop advertising the LAN's subnet to the other OSPF routers",
                    "To advertise the subnet but send no hellos and form no adjacency",
                    "To shut the interface down while OSPF is still converging",
                ],
                "b",
                "Passive interfaces stay in OSPF, so their subnet is still advertised, but no neighbor can form "
                "there. That also blocks rogue adjacencies from the LAN.",
                f"{C7}-s4",
            ),
        ],
    },
    "sources": [
        rfc(2328, "OSPF Version 2"),
        rfc(1812, "Requirements for IP Version 4 Routers"),
    ],
}

# ---------------------------------------------------------------------------------------------
# Course 8
# ---------------------------------------------------------------------------------------------

C8 = "net-services"

R1_BRANCH = [
    "enable", "configure terminal",
    "interface g0/0", "description STAFF LAN", "ip address 192.168.10.1 255.255.255.0", "no shutdown",
    "interface g0/1", "description LAB LAN", "ip address 192.168.20.1 255.255.255.0", "no shutdown",
    "end",
]

COURSE_8 = {
    "id": C8,
    "version": 1,
    "order": 8,
    "title": "8. DHCP and DNS services",
    "summary": (
        "Hand out addresses automatically with DHCP and turn names into addresses with DNS. Follow the DORA "
        "exchange, build router DHCP pools with excluded ranges, read DNS records with nslookup, and open an "
        "intranet page by name. The lab takes a branch office from no addresses to a working web page."
    ),
    "difficulty": "Intermediate",
    "minutes": 45,
    "lessons": [
        lesson(
            f"{C8}-s1",
            "DHCP and the DORA exchange",
            [
                "The Dynamic Host Configuration Protocol (DHCP, RFC 2131) gives hosts their IP settings "
                "automatically: address, mask, default gateway and DNS server, together with a lease time. "
                "Clients use UDP port 68 and servers UDP port 67. Without DHCP every laptop would need hand-typed "
                "settings, and mistakes such as duplicate addresses would be common.",
                "A client with no address talks in four steps, called DORA. It broadcasts a Discover from 0.0.0.0 "
                "to 255.255.255.255. A server answers with an Offer, the client broadcasts a Request for that "
                "offer, and the server confirms with an Acknowledge. The client then uses the address until the "
                "lease ends; real clients renew halfway through the lease, while the lab has no lease timers.",
                "Routers do not forward broadcasts, so a Discover never leaves its subnet. Real networks run a "
                "DHCP relay on the router (`ip helper-address` in the widely used router CLI style) to pass "
                "requests to a central server. The VoltQuest lab does not simulate relays, so the router must hold "
                "a pool for each subnet it serves directly. When no server answers, the lab prints `DHCP request "
                "failed.`, while Windows would fall back to a 169.254.x.x link-local address.",
            ],
            "pc",
            lines(
                "! Ask any DHCP server on this subnet for a lease",
                r"C:\> ipconfig /renew",
                "! Show the lease: address, mask, gateway and DNS server",
                r"C:\> ipconfig /all",
                "! Give the address back, then ask again",
                r"C:\> ipconfig /release",
                r"C:\> ipconfig /renew",
            ),
            "Expecting DHCP to cross a router by itself. The Discover is a broadcast, and routers stop "
            "broadcasts. A client in a subnet without a local pool or a relay never gets an offer.",
            question(
                f"{C8}-q1",
                "In which order do the four DHCP messages travel?",
                [
                    "Discover, Offer, Request, Acknowledge",
                    "Request, Offer, Discover, Acknowledge",
                    "Offer, Discover, Acknowledge, Request",
                ],
                "a",
                "The client discovers servers, a server offers an address, the client requests that offer, and "
                "the server acknowledges it: DORA.",
            ),
        ),
        lesson(
            f"{C8}-s2",
            "A router as DHCP server",
            [
                "A router can serve DHCP itself. First exclude the addresses you assign by hand, in global "
                "configuration: `ip dhcp excluded-address 192.168.10.1 192.168.10.20`. Then create a pool with "
                "`ip dhcp pool STAFF`, which opens the `(dhcp-config)#` prompt, and set `network`, "
                "`default-router` and `dns-server`.",
                "The lab's router answers a Discover from the pool whose network and mask match the interface "
                "that received it, and leases the lowest free address that is neither excluded nor its own. Real "
                "servers may choose differently, and many first ping an address to check that nobody uses it, so "
                "never rely on a particular number: give servers and printers static addresses outside the pool, "
                "or reservations.",
                "`show ip dhcp binding` lists every leased address with the client's MAC address. On the client, "
                "`ipconfig /all` shows `DHCP Enabled: Yes` together with the leased address, gateway and DNS "
                "server. Real pools also set a lease time and a domain name; the lab's pools take the network, "
                "the gateway and the DNS server only.",
            ],
            "router",
            lines(
                "R1> enable",
                "R1# configure terminal",
                "! Keep the gateway and the fixed servers out of the pool",
                "R1(config)# ip dhcp excluded-address 192.168.10.1 192.168.10.20",
                "R1(config)# ip dhcp pool STAFF",
                "R1(dhcp-config)# network 192.168.10.0 255.255.255.0",
                "R1(dhcp-config)# default-router 192.168.10.1",
                "R1(dhcp-config)# dns-server 192.168.10.5",
                "R1(dhcp-config)# end",
                "R1# show ip dhcp binding",
            ),
            "Forgetting the exclusions. Without `ip dhcp excluded-address`, the pool can lease a PC the address "
            "that a server or printer already uses. The lab's DHCP server does no conflict check at all, so the "
            "duplicate appears at once.",
            question(
                f"{C8}-q2",
                "Where do you type `ip dhcp excluded-address`?",
                [
                    "Inside the DHCP pool, at the `(dhcp-config)#` prompt",
                    "In global configuration, at the `(config)#` prompt",
                    "In interface configuration mode",
                ],
                "b",
                "Exclusions apply to every pool on the router, so they live in global configuration.",
            ),
        ),
        lesson(
            f"{C8}-s3",
            "DNS: names to addresses",
            [
                "The Domain Name System (DNS, RFC 1034 and RFC 1035) maps names to addresses. A host's resolver "
                "sends a query, usually over UDP port 53, to its configured DNS server, which answers from its own "
                "records or asks other servers on the client's behalf. Answers are cached for their time to live, "
                "so repeated lookups are fast.",
                "Records have types. An A record maps a name to an IPv4 address and an AAAA record to an IPv6 "
                "address. A CNAME makes one name an alias of another, MX names a domain's mail servers, NS names "
                "its DNS servers and PTR maps an address back to a name. The lab's DNS service stores A records "
                "only.",
                "`nslookup <name>` shows which server answered and the address it returned; a name the server does "
                "not know gives `Non-existent domain`. If no answer arrives, the resolver retries; after three lost "
                "queries the lab prints `DNS request timed out.`, which points at reachability, not at a missing "
                "record. In labs, use names under a reserved domain such as `.test` (RFC 6761), so they never "
                "collide with real ones. DNS answers can be forged; DNSSEC adds signatures, which the lab does not "
                "simulate.",
            ],
            "pc",
            lines(
                "! Which DNS server does this PC use?",
                r"C:\> ipconfig /all",
                "! Ask that server for the A record of a name",
                r"C:\> nslookup intranet.voltquest.test",
                "! Use the name directly: the PC resolves it first",
                r"C:\> ping intranet.voltquest.test",
            ),
            "Blaming DNS for a routing fault, or the reverse. Ping the server's IP address first. If the address "
            "works but the name fails, check the DNS server setting and the records; if the address fails too, "
            "fix addressing or routing before you touch DNS.",
            question(
                f"{C8}-q3",
                "`ping 192.168.10.5` works, but `ping intranet.voltquest.test` cannot find the host. What is the most "
                "likely cause?",
                [
                    "A missing route between the PC and 192.168.10.5",
                    "A shut switch port on the server's LAN",
                    "A wrong DNS server setting or a missing DNS record",
                ],
                "c",
                "The successful ping by address proves the path. Only name resolution is left, so check the "
                "client's DNS server and the record on that server.",
            ),
        ),
        lesson(
            f"{C8}-s4",
            "Browsing by name, end to end",
            [
                "Opening http://intranet.voltquest.test chains several services. The PC needs a lease (DHCP), the "
                "MAC address of the next hop (ARP), the server's address (DNS), a TCP connection to port 80, and "
                "finally the HTTP request and response. Each step depends on the ones before it, so troubleshoot "
                "in the same order.",
                "TCP (RFC 9293) sets up a connection before data flows. Real TCP uses a three-way handshake (SYN, "
                "SYN+ACK, ACK), acknowledges data and closes with FIN segments. The lab simplifies a web request to "
                "four segments: SYN, SYN+ACK, the request and the response. HTTP (RFC 9110) then carries `GET /` "
                "and a status such as 200 OK. Plain HTTP on TCP port 80 is unencrypted; real sites use HTTPS on "
                "TCP port 443.",
                "Ping and the browser test different things. A ping reply proves that the host is reachable at "
                "layer 3; it says nothing about the web service. If the server's web service is off, ping still "
                "works while the browser reports `Connection refused: no web service is listening.`, because the "
                "server resets the TCP connection.",
            ],
            "none",
            lines(
                "1  DHCP  PC1 leases 192.168.10.21, gateway 192.168.10.1, DNS 192.168.10.5",
                "2  ARP   PC1 learns the DNS server's MAC (same subnet, no router needed)",
                "3  DNS   query A intranet.voltquest.test over UDP 53, answer 192.168.10.5",
                "4  TCP   SYN to port 80, then SYN+ACK from the server",
                "5  HTTP  GET / and the reply 200 OK with the page",
            ),
            "Testing a web server with ping only. ICMP replies prove the host is up, not that anything listens "
            "on TCP port 80. Test the service itself with the browser.",
            question(
                f"{C8}-q4",
                "Which transport protocol and port does plain HTTP use by default?",
                ["UDP 53", "TCP 443", "TCP 80"],
                "c",
                "HTTP runs over TCP port 80. TCP 443 is HTTPS, and UDP 53 is DNS.",
            ),
        ),
    ],
    "steps": [
        "Run `ipconfig` on PC1: it is a DHCP client without a lease, so it shows 0.0.0.0. `ipconfig /renew` prints "
        "`DHCP request failed.` because no server exists yet.",
        "On R1 exclude the fixed addresses: `ip dhcp excluded-address 192.168.10.1 192.168.10.20` and `ip dhcp "
        "excluded-address 192.168.20.1 192.168.20.20`.",
        "Create `ip dhcp pool STAFF` with `network 192.168.10.0 255.255.255.0`, `default-router 192.168.10.1` "
        "and `dns-server 192.168.10.5`. Then create pool LAB for 192.168.20.0/24 with gateway 192.168.20.1 and "
        "the same DNS server.",
        "Run `ipconfig /renew` on PC1, PC2 and PC3, then `ipconfig /all`. Check the bindings with `show ip dhcp "
        "binding` on R1.",
        "On PC1 run `nslookup intranet.voltquest.test`, then open http://intranet.voltquest.test in the browser.",
        "On PC3 run `nslookup intranet.voltquest.test`, then open http://intranet.voltquest.test. Both cross R1; "
        "in the step-by-step view the first query may be dropped while R1 resolves ARP, and the resolver's retry "
        "gets through.",
        "Press Check results.",
    ],
    "expected": (
        "The first lease in each LAN is .21, because .1 to .20 are excluded. `show ip dhcp binding` lists three "
        "bindings, `nslookup` answers 192.168.10.5 on PC1 and PC3, and all three PCs open the intranet by name, "
        "PC3 across R1."
    ),
    "challenge": {
        "task": (
            "Course labs cannot be edited, so use \"Open a sandbox copy in a new tab\" under the lab and work in the copy. "
            "Add a GUEST LAN on R1 g0/2: cable a new switch and PC to it, give g0/2 the address 192.168.30.1/24, "
            "exclude .1 to .20, and create a GUEST pool that hands out gateway 192.168.30.1 and DNS server "
            "192.168.10.5. Prove that the new PC leases an address and opens the intranet by name."
        ),
        "acceptance": [
            "R1 g0/2 is up with 192.168.30.1/24, and a third pool covers 192.168.30.0/24",
            "The new PC's `ipconfig /all` shows 192.168.30.21, gateway 192.168.30.1 and DNS server 192.168.10.5",
            "The new PC opens http://intranet.voltquest.test by name, across R1",
        ],
    },
    "lab": {
        "title": "Bring a branch office online with DHCP and DNS",
        "brief": (
            "The branch has two LANs on R1: STAFF 192.168.10.0/24 on g0/0 (PC1, PC2 and Server1) and LAB "
            "192.168.20.0/24 on g0/1 (PC3). Server1 (192.168.10.5) already runs DNS and the intranet web site, "
            "with an A record for intranet.voltquest.test. The PCs are DHCP clients, but no DHCP server exists. On "
            "R1, exclude .1 to .20 in both LANs and create pools STAFF and LAB with gateway .1 and DNS server "
            "192.168.10.5. Then lease addresses and open the intranet."
        ),
        "topology": {
            "devices": [
                device("R1", "router", 400, 70, config=R1_BRANCH),
                device("S1", "switch", 200, 210),
                device("S2", "switch", 600, 210),
                device("PC1", "pc", 70, 340, dhcp_client()),
                device("PC2", "pc", 200, 340, dhcp_client()),
                device("Server1", "server", 330, 340, host("192.168.10.5", "255.255.255.0", "192.168.10.1", "192.168.10.5"),
                       web("VoltQuest branch intranet: welcome!", [("intranet.voltquest.test", "192.168.10.5")])),
                device("PC3", "pc", 600, 340, dhcp_client()),
            ],
            "links": [
                "PC1 Fa0 S1 Fa0/1",
                "PC2 Fa0 S1 Fa0/2",
                "Server1 Fa0 S1 Fa0/3",
                "S1 Gi0/1 R1 Gi0/0",
                "S2 Gi0/1 R1 Gi0/1",
                "PC3 Fa0 S2 Fa0/1",
            ],
        },
        "goals": [
            {"type": "host", "device": "PC1", "dhcp": True, "gateway": "192.168.10.1",
             "label": "PC1 leases an address with gateway 192.168.10.1"},
            {"type": "host", "device": "PC2", "dhcp": True, "gateway": "192.168.10.1",
             "label": "PC2 leases an address with gateway 192.168.10.1"},
            {"type": "host", "device": "PC3", "dhcp": True, "gateway": "192.168.20.1",
             "label": "PC3 leases an address with gateway 192.168.20.1"},
            {"type": "http", "from": "PC1", "url": "http://intranet.voltquest.test",
             "label": "PC1 opens the intranet by name"},
            {"type": "http", "from": "PC2", "url": "http://intranet.voltquest.test",
             "label": "PC2 opens the intranet by name"},
            {"type": "http", "from": "PC3", "url": "http://intranet.voltquest.test",
             "label": "PC3 opens the intranet by name across R1"},
        ],
        "solution": [
            {"device": "R1", "cli": [
                "enable", "configure terminal",
                "ip dhcp excluded-address 192.168.10.1 192.168.10.20",
                "ip dhcp excluded-address 192.168.20.1 192.168.20.20",
                "ip dhcp pool STAFF", "network 192.168.10.0 255.255.255.0", "default-router 192.168.10.1",
                "dns-server 192.168.10.5",
                "ip dhcp pool LAB", "network 192.168.20.0 255.255.255.0", "default-router 192.168.20.1",
                "dns-server 192.168.10.5",
                "end",
            ]},
            {"device": "PC1", "desktop": ["ipconfig /renew"]},
            {"device": "PC2", "desktop": ["ipconfig /renew"]},
            {"device": "PC3", "desktop": ["ipconfig /renew"]},
        ],
    },
    "exam": {
        "passPercent": 80,
        "questions": [
            question(
                f"{C8}-e1",
                "Why does a DHCP Discover go to the broadcast address 255.255.255.255?",
                [
                    "The client has no address yet and does not know where a server is",
                    "DHCP messages are always broadcasts, even when a client renews",
                    "To reach the DNS servers on the Internet at the same time",
                ],
                "a",
                "A client without an address cannot target a server it does not know, so it asks everyone on the "
                "subnet. Later renewals can be unicast.",
                f"{C8}-s1",
            ),
            question(
                f"{C8}-e2",
                "A pool covers 192.168.20.0/24, but the router interface facing those clients has 192.168.21.1/24. "
                "What happens when a client there sends a Discover?",
                [
                    "The client gets an address from 192.168.20.0/24 anyway, with gateway .1",
                    "No offer: the pool must match the subnet of the receiving interface",
                    "The router forwards the Discover to the next router",
                ],
                "b",
                "The server picks the pool by the subnet the request arrived on. With no matching pool, the client "
                "gets no offer, and routers do not forward the broadcast.",
                f"{C8}-s2",
            ),
            question(
                f"{C8}-e3",
                "Which DNS record type maps a name to an IPv4 address?",
                ["MX", "PTR", "A"],
                "c",
                "An A record holds an IPv4 address. MX names mail servers, and PTR maps an address back to a name.",
                f"{C8}-s3",
            ),
            question(
                f"{C8}-e4",
                "The browser shows `Connection refused`, but ping to the server works. What does that tell you?",
                [
                    "The host is reachable, but nothing listens on TCP port 80",
                    "The DNS record for the server points to the wrong address",
                    "The PC's default gateway is missing, so replies cannot return",
                ],
                "a",
                "The ping proves the path and the address. A refused connection means the server answered the TCP "
                "request with a reset because no web service is running.",
                f"{C8}-s4",
            ),
            question(
                f"{C8}-e5",
                "Why should servers usually keep static addresses outside the DHCP pool?",
                [
                    "DHCP servers refuse to lease addresses to devices that run services",
                    "Clients and DNS records rely on the server's address staying the same",
                    "Static addresses make the server's traffic faster than leased ones",
                ],
                "b",
                "DNS records and client settings point at the server's address. A changing lease would break them, "
                "so servers get static addresses or reservations.",
                f"{C8}-s2",
            ),
        ],
    },
    "sources": [
        rfc(2131, "Dynamic Host Configuration Protocol"),
        rfc(1034, "Domain Names - Concepts and Facilities"),
        rfc(1035, "Domain Names - Implementation and Specification"),
        rfc(9110, "HTTP Semantics"),
    ],
}

# ---------------------------------------------------------------------------------------------
# Course 9
# ---------------------------------------------------------------------------------------------

C9 = "net-acl"

S1_ROUTED_VLANS = [
    "enable", "configure terminal",
    "vlan 10", "name STAFF", "vlan 20", "name GUEST", "vlan 30", "name SERVERS", "exit",
    "interface fa0/1", "switchport mode access", "switchport access vlan 10",
    "interface fa0/2", "switchport mode access", "switchport access vlan 20",
    "interface fa0/3", "switchport mode access", "switchport access vlan 30",
    "interface g0/2", "switchport mode trunk",
    "end",
]
R1_ROUTED_VLANS = [
    "enable", "configure terminal",
    "interface g0/0", "no shutdown",
    "interface g0/0.10", "description STAFF", "encapsulation dot1Q 10", "ip address 192.168.10.1 255.255.255.0",
    "interface g0/0.20", "description GUEST", "encapsulation dot1Q 20", "ip address 192.168.20.1 255.255.255.0",
    "interface g0/0.30", "description SERVERS", "encapsulation dot1Q 30", "ip address 192.168.30.1 255.255.255.0",
]
R1_ACL_LAB = R1_ROUTED_VLANS + [
    "interface g0/1", "description Test Internet segment", "ip address 203.0.113.1 255.255.255.0", "no shutdown",
    "end",
]

COURSE_9 = {
    "id": C9,
    "version": 1,
    "order": 9,
    "title": "9. Access control lists",
    "summary": (
        "Filter traffic on a router with access control lists. Read wildcard masks, write standard, extended "
        "and named lists, and apply them in the right place and direction. Learn how first match and the "
        "implicit deny decide every packet, and use ACLs for least-privilege segmentation: keep guests away "
        "from a staff web server while still letting them ping it."
    ),
    "difficulty": "Advanced",
    "minutes": 55,
    "lessons": [
        lesson(
            f"{C9}-s1",
            "How routers process access lists",
            [
                "An access control list (ACL) is an ordered list of permit and deny entries. When a packet meets "
                "an interface that has an ACL, the router compares it with the entries from the top down. The "
                "first entry that matches decides the packet's fate, and the router stops reading. If no entry "
                "matches, an invisible implicit deny at the end drops the packet.",
                "You apply an ACL to an interface in one direction: inbound, for packets entering the interface "
                "(checked before routing), or outbound, for packets leaving it (checked after routing). Each "
                "interface holds at most one list per direction. The lab's router drops a denied packet and, like "
                "many real routers, tells the sender with an ICMP administratively prohibited message, which the "
                "lab's PCs show as `Communication administratively prohibited.`",
                "ACLs are a tool for least privilege: permit only the traffic a group needs and deny the rest. "
                "They decide who can reach a service; they do not fix the service. If a web application has a "
                "flaw, anyone still allowed to reach it can exploit it, so filtering and fixing the application "
                "are both needed. Classic ACLs are also stateless: they judge each packet alone, so replies need "
                "their own permit.",
            ],
            "none",
            lines(
                "access list GUEST-IN, applied inbound on the guest interface",
                "  10 deny tcp 192.168.20.0 0.0.0.255 host 192.168.30.10 eq www",
                "  20 permit ip 192.168.20.0 0.0.0.255 any",
                "Guest to 192.168.30.10, TCP port 80:  matches 10, denied",
                "Guest to 192.168.30.10, ICMP echo:    skips 10, matches 20, permitted",
                "Guest to 203.0.113.10, TCP port 80:   skips 10, matches 20, permitted",
                "Any packet that matches no entry:     implicit deny, dropped",
            ),
            "Forgetting the implicit deny. A list that contains only deny entries blocks every packet on that "
            "interface, including the traffic you meant to allow. End the list with an explicit permit for the "
            "traffic that should still pass.",
            question(
                f"{C9}-q1",
                "A packet matches entry 20, a permit, and would also match entry 30, a deny. What happens?",
                [
                    "It is denied, because deny entries win",
                    "It is permitted, because the first matching entry decides",
                    "The router counts permits and denies and takes the majority",
                ],
                "b",
                "The router stops at the first match. Entry 30 is never read for this packet, which is why the "
                "order of entries matters.",
            ),
        ),
        lesson(
            f"{C9}-s2",
            "Wildcard masks and standard ACLs",
            [
                "ACL entries match addresses with wildcard masks, just like OSPF network statements: 0 bits must "
                "match and 1 bits are ignored. `192.168.20.0 0.0.0.255` matches the whole /24, `host "
                "192.168.10.50` is short for `192.168.10.50 0.0.0.0`, and `any` is short for `0.0.0.0 "
                "255.255.255.255`. For a /26 the wildcard is 0.0.0.63, and for a /30 it is 0.0.0.3.",
                "Standard ACLs, numbered 1 to 99 in the lab, match only the source address. `access-list 10 deny "
                "192.168.20.0 0.0.0.255` stops packets from that subnet, whatever their destination. Because they "
                "cannot tell destinations apart, standard ACLs belong as close to the destination as possible; "
                "near the source they would cut the source off from everything.",
                "Add a `remark` line that says why an entry exists. Entries are appended in the order you type "
                "them. Real routers also let you insert or delete single entries by sequence number; in the lab, "
                "rebuild a list with `no access-list 10` (or `no ip access-list extended NAME` for a named list) "
                "when the order is wrong.",
            ],
            "router",
            lines(
                "R1> enable",
                "R1# configure terminal",
                "R1(config)# access-list 10 remark Staff: only the admin PC may reach the server LAN",
                "R1(config)# access-list 10 permit host 192.168.10.50",
                "R1(config)# access-list 10 deny 192.168.10.0 0.0.0.255",
                "R1(config)# access-list 10 permit any",
                "R1(config)# interface g0/2",
                "R1(config-if)# ip access-group 10 out",
                "R1(config-if)# end",
                "R1# show access-lists",
            ),
            "Using a subnet mask where a wildcard belongs. `access-list 10 deny 192.168.20.0 255.255.255.0` does "
            "not mean the /24. The lab rejects that wildcard; real routers accept it and match every address that "
            "ends in .0 instead. The /24 wildcard is 0.0.0.255.",
            question(
                f"{C9}-q2",
                "Which wildcard matches every host in 10.10.8.0/21?",
                ["0.0.7.255", "0.0.8.255", "255.255.248.0"],
                "a",
                "A /21 mask is 255.255.248.0, and 255.255.255.255 minus that is 0.0.7.255. 255.255.248.0 is the "
                "subnet mask itself, not a wildcard.",
            ),
        ),
        lesson(
            f"{C9}-s3",
            "Extended and named ACLs",
            [
                "Extended ACLs, numbered 100 to 199 in the lab or named, match the protocol, the source, the "
                "destination and, for TCP and UDP, the destination port. The order is fixed: `permit|deny "
                "<protocol> <source> <destination> [eq <port>]`. Ports may be numbers or names, such as `eq 80` or "
                "`eq www` and `eq 53` or `eq domain`. For ICMP the lab accepts the `echo` and `echo-reply` types.",
                "Because they are so precise, extended ACLs belong close to the source: unwanted traffic is "
                "dropped before it crosses the network, and nothing else is affected. To block guests from one web "
                "server, deny TCP from the guest subnet to that host on port 80, permit the rest, and apply the "
                "list inbound on the guest interface.",
                "Named lists are easier to read and maintain. `ip access-list extended GUEST-IN` opens the "
                "`(config-ext-nacl)#` prompt, where you type entries without the list name, and `ip access-group "
                "GUEST-IN in` applies the list. Real routers can also match source ports, port ranges and "
                "established TCP sessions; the lab matches destination ports only.",
            ],
            "router",
            lines(
                "R1> enable",
                "R1# configure terminal",
                "R1(config)# ip access-list extended GUEST-IN",
                "R1(config-ext-nacl)# remark Guests may not open the staff web server",
                "R1(config-ext-nacl)# deny tcp 192.168.20.0 0.0.0.255 host 192.168.30.10 eq www",
                "R1(config-ext-nacl)# permit ip 192.168.20.0 0.0.0.255 any",
                "R1(config-ext-nacl)# exit",
                "R1(config)# interface g0/0.20",
                "R1(config-subif)# ip access-group GUEST-IN in",
                "R1(config-subif)# end",
                "R1# show access-lists",
            ),
            "Putting the port on the wrong side. A web server listens on destination port 80, and the client's "
            "source port is random. Write `eq 80` after the destination. The lab only accepts a port there; real "
            "routers also accept one after the source, where it would match the server's replies instead of the "
            "requests.",
            question(
                f"{C9}-q3",
                "Which single entry blocks the guest subnet 192.168.20.0/24 from the web service on 192.168.30.10 "
                "without blocking anything else?",
                [
                    "`deny ip 192.168.20.0 0.0.0.255 host 192.168.30.10`",
                    "`deny tcp 192.168.20.0 0.0.0.255 any eq 80`",
                    "`deny tcp 192.168.20.0 0.0.0.255 host 192.168.30.10 eq 80`",
                ],
                "c",
                "Only that entry names the protocol, the source subnet, the server and the port. The first option "
                "blocks all traffic to the server, and the second blocks the guests from every web server. A "
                "permit entry must still follow for the traffic that should pass.",
            ),
        ),
        lesson(
            f"{C9}-s4",
            "Placement, direction and verification",
            [
                "Direction is always seen from the router. Inbound on the guest gateway sees packets that come from "
                "the guests; outbound on the same interface sees packets going to the guests. An outbound list does "
                "not filter packets that the router itself creates, such as its own pings. Draw the packet's path "
                "and ask where, and in which direction, it first meets the router.",
                "Verify with `show access-lists`: each entry shows its sequence number (10, 20, 30 and so on) and "
                "how many packets matched it. `clear access-list counters` resets the counts before a test, and "
                "`show running-config` shows where each list is applied. Test both sides: what must fail, and what "
                "must still work.",
                "An inbound list also filters traffic addressed to the router itself. A DHCP Discover arrives from "
                "source 0.0.0.0 to UDP port 67, so any inbound list on an interface with DHCP clients must permit "
                "it, for example with `permit udp any any eq bootps` at the top; the lab enforces this too. Real "
                "routers filter OSPF hellos the same way, which the lab does not model as packets. Applying a list "
                "name that does not exist permits everything, in the lab and in the widely used router CLI style "
                "alike.",
            ],
            "router",
            lines(
                "R1> enable",
                "! Which entry did each packet hit?",
                "R1# show access-lists",
                "! Start a clean test",
                "R1# clear access-list counters",
                "R1# configure terminal",
                "R1(config)# interface g0/0.20",
                "! Wrong direction: remove it, then apply it inbound",
                "R1(config-subif)# no ip access-group GUEST-IN out",
                "R1(config-subif)# ip access-group GUEST-IN in",
                "R1(config-subif)# end",
                "R1# show running-config",
            ),
            "Applying the list in the wrong direction. GUEST-IN matches packets from 192.168.20.0/24. Applied "
            "`out` on the guest interface, it only sees packets going to the guests, whose source never matches "
            "the permit, so the implicit deny drops every reply and the guests lose all connectivity.",
            question(
                f"{C9}-q4",
                "Where should an extended ACL that keeps guests away from one server usually go?",
                [
                    "Outbound on the router interface that faces the guests, close to them",
                    "Inbound on the interface that faces the guests, close to the source",
                    "Inbound on the router interface that faces the Internet uplink",
                ],
                "b",
                "Inbound on the guest gateway, the list sees every guest packet before it is routed, and it "
                "affects nobody else.",
            ),
        ),
    ],
    "steps": [
        "From PC2 (guest) open http://192.168.30.10 and ping 192.168.10.11. Both work today, which breaks the "
        "policy.",
        "On R1 enter `ip access-list extended GUEST-IN` and add a `remark` that states the policy.",
        "Add the entries in this order: `deny tcp 192.168.20.0 0.0.0.255 host 192.168.30.10 eq www`, `deny ip "
        "192.168.20.0 0.0.0.255 192.168.10.0 0.0.0.255` and `permit ip 192.168.20.0 0.0.0.255 any`.",
        "Apply the list close to the source: `interface g0/0.20`, then `ip access-group GUEST-IN in`.",
        "Test from PC2: the staff page is blocked, the ping to 192.168.30.10 still works, PC1 is unreachable, and "
        "http://203.0.113.10 still loads. Then open http://192.168.30.10 from PC1.",
        "Run `show access-lists` on R1 and match each counter to the tests you just ran.",
        "Press Check results.",
    ],
    "expected": (
        "PC2's browser shows `Blocked: communication administratively prohibited.` for http://192.168.30.10 but "
        "loads http://203.0.113.10. PC2's ping to 192.168.10.11 is answered with `Communication administratively "
        "prohibited.`, its ping to 192.168.30.10 succeeds, and PC1 still opens the staff page. `show access-lists` "
        "shows `Extended IP access list GUEST-IN` with match counts."
    ),
    "challenge": {
        "task": (
            "Staff PC1 can no longer ping guest PC2, because PC2's echo replies hit the staff deny entry. Rebuild "
            "GUEST-IN so that staff may ping guests, while guests still cannot ping or open anything in the STAFF "
            "LAN."
        ),
        "acceptance": [
            "GUEST-IN is rebuilt (for example after `no ip access-list extended GUEST-IN`) with `permit icmp "
            "192.168.20.0 0.0.0.255 192.168.10.0 0.0.0.255 echo-reply` above the staff deny entry",
            "PC1 pings PC2 successfully, while PC2's ping to PC1 is still administratively prohibited",
            "Guests still cannot open http://192.168.30.10, and you can explain why a stateless list needs an "
            "explicit entry for replies",
        ],
    },
    "lab": {
        "title": "Keep guests away from the staff web server",
        "brief": (
            "R1 routes STAFF (VLAN 10, 192.168.10.0/24), GUEST (VLAN 20, 192.168.20.0/24) and SERVERS (VLAN 30, "
            "192.168.30.0/24) on g0/0 subinterfaces, and reaches a test Internet site (203.0.113.10) on g0/1 "
            "without NAT, which comes in course 10. The policy: guests may ping the staff web server "
            "(192.168.30.10) for troubleshooting but may not open it, guests may not reach the STAFF LAN at all, "
            "and guests may use everything else. Write the named extended list GUEST-IN on R1, apply it where it "
            "belongs, and prove that staff access still works."
        ),
        "topology": {
            "devices": [
                device("R1", "router", 380, 70, config=R1_ACL_LAB),
                device("Server2", "server", 640, 70, host("203.0.113.10", "255.255.255.0", "203.0.113.1"),
                       web("Public test site")),
                device("S1", "switch", 380, 210, config=S1_ROUTED_VLANS),
                device("PC1", "pc", 130, 340, host("192.168.10.11", "255.255.255.0", "192.168.10.1")),
                device("PC2", "pc", 380, 340, host("192.168.20.11", "255.255.255.0", "192.168.20.1")),
                device("Server1", "server", 630, 340, host("192.168.30.10", "255.255.255.0", "192.168.30.1"),
                       web("Staff intranet: internal use only")),
            ],
            "links": [
                "PC1 Fa0 S1 Fa0/1",
                "PC2 Fa0 S1 Fa0/2",
                "Server1 Fa0 S1 Fa0/3",
                "S1 Gi0/2 R1 Gi0/0",
                "Server2 Fa0 R1 Gi0/1",
            ],
        },
        "goals": [
            {"type": "acl", "device": "R1", "iface": "g0/0.20", "direction": "in",
             "label": "An access list filters traffic entering R1 from the guest VLAN (g0/0.20 in)"},
            {"type": "http", "from": "PC2", "url": "http://192.168.30.10", "expect": "fail",
             "label": "Guest PC2 cannot open the staff web server"},
            {"type": "ping", "from": "PC2", "to": "192.168.30.10",
             "label": "Guest PC2 can still ping the staff web server"},
            {"type": "ping", "from": "PC2", "to": "192.168.10.11", "expect": "fail",
             "label": "Guest PC2 cannot reach staff PC1"},
            {"type": "http", "from": "PC2", "url": "http://203.0.113.10",
             "label": "Guest PC2 still opens the Internet test site"},
            {"type": "http", "from": "PC1", "url": "http://192.168.30.10",
             "label": "Staff PC1 still opens the staff web server"},
        ],
        "solution": [
            {"device": "R1", "cli": [
                "enable", "configure terminal",
                "ip access-list extended GUEST-IN",
                "remark Guests: ping only to the staff web server, no STAFF LAN, Internet allowed",
                "deny tcp 192.168.20.0 0.0.0.255 host 192.168.30.10 eq www",
                "deny ip 192.168.20.0 0.0.0.255 192.168.10.0 0.0.0.255",
                "permit ip 192.168.20.0 0.0.0.255 any",
                "exit",
                "interface g0/0.20", "ip access-group GUEST-IN in",
                "end",
            ]},
        ],
    },
    "exam": {
        "passPercent": 80,
        "questions": [
            question(
                f"{C9}-e1",
                "An ACL holds only `deny tcp any host 192.168.30.10 eq www` and is applied inbound on the guest "
                "interface. What can guests still reach?",
                [
                    "Everything except the web service on 192.168.30.10",
                    "Nothing: every other packet hits the implicit deny",
                    "Only 192.168.30.10",
                ],
                "b",
                "With no permit entry, everything that does not match the deny falls through to the implicit deny "
                "at the end of the list.",
                f"{C9}-s1",
            ),
            question(
                f"{C9}-e2",
                "Why should a standard ACL usually sit close to the destination?",
                [
                    "It matches only the source, so near the source it would cut that source off from "
                    "everything",
                    "Standard lists can only be applied outbound, and outbound means near the destination",
                    "Routers check standard lists faster when the packet is close to its destination",
                ],
                "a",
                "A standard ACL cannot say where the traffic is going. Near the destination it affects only the "
                "path to the resource you want to protect.",
                f"{C9}-s2",
            ),
            question(
                f"{C9}-e3",
                "Which entry permits DNS queries from 192.168.20.0/24 to the server 192.168.30.10?",
                [
                    "`permit tcp 192.168.20.0 0.0.0.255 host 192.168.30.10 eq 80`",
                    "`permit udp host 192.168.30.10 192.168.20.0 0.0.0.255 eq 53`",
                    "`permit udp 192.168.20.0 0.0.0.255 host 192.168.30.10 eq 53`",
                ],
                "c",
                "DNS queries are UDP to destination port 53, from the clients to the server. The second option "
                "swaps source and destination, and the first permits web traffic.",
                f"{C9}-s3",
            ),
            question(
                f"{C9}-e4",
                "A list that permits source 192.168.20.0/24 is applied `out` on the guest gateway, and guests lose "
                "all connectivity. Why?",
                [
                    "It sees packets going to the guests, whose source never matches, so the implicit deny "
                    "drops them",
                    "Outbound lists are not supported on subinterfaces, so the router silently drops all guest "
                    "traffic",
                    "Outbound lists also filter the router's own packets, such as ARP replies, on that "
                    "subinterface",
                ],
                "a",
                "Direction is seen from the router. Packets leaving the guest interface come from other subnets, so "
                "only the implicit deny matches them.",
                f"{C9}-s4",
            ),
            question(
                f"{C9}-e5",
                "The staff web application has an injection flaw. An ACL blocks guests from it, but staff can still "
                "reach it. Which statement is accurate?",
                [
                    "The ACL removes the flaw, because blocked guests can no longer reach the application",
                    "The ACL inspects every HTTP request and strips out the injection attempts it finds",
                    "It narrows who can reach the flaw; staff, or a compromised staff PC, can still exploit it",
                ],
                "c",
                "ACLs look at addresses, protocols and ports, not at application content. They reduce exposure; "
                "fixing the application removes the flaw.",
                f"{C9}-s1",
            ),
        ],
    },
    "sources": [
        rfc(9293, "Transmission Control Protocol (TCP)"),
        rfc(792, "Internet Control Message Protocol"),
        NIST_80041,
    ],
}

# ---------------------------------------------------------------------------------------------
# Course 10
# ---------------------------------------------------------------------------------------------

C10 = "net-nat"

R1_BRANCH_EDGE = R1_ROUTED_VLANS + [
    "interface g0/1", "description Provider uplink", "ip address 203.0.113.2 255.255.255.252", "no shutdown",
    "end",
]
R2_PROVIDER = [
    "enable", "configure terminal",
    "interface g0/0", "description Link to the branch", "ip address 203.0.113.1 255.255.255.252", "no shutdown",
    "interface g0/1", "description Web server LAN", "ip address 198.51.100.1 255.255.255.0", "no shutdown",
    "interface g0/2", "description Internet users", "ip address 192.0.2.1 255.255.255.0", "no shutdown",
    "exit",
    "ip route 203.0.113.8 255.255.255.248 203.0.113.2",
    "end",
]

COURSE_10 = {
    "id": C10,
    "version": 1,
    "order": 10,
    "title": "10. NAT, PAT and a secure branch capstone",
    "summary": (
        "Connect private networks to the Internet with NAT. Learn the inside and outside terms, publish a server "
        "with static NAT, share one public address with PAT, and read the translation table. Then combine VLANs, "
        "DHCP, an access list and NAT in a branch network, and see why NAT is not a security control."
    ),
    "difficulty": "Advanced",
    "minutes": 75,
    "lessons": [
        lesson(
            f"{C10}-s1",
            "Why NAT exists: inside and outside",
            [
                "IPv4 has about 4.3 billion addresses, far fewer than the devices that want one. Private RFC 1918 "
                "ranges let every organization reuse the same addresses internally, but the Internet does not route "
                "them. Network address translation (NAT, RFC 3022) rewrites addresses at the border: inside hosts "
                "use private addresses, and the router swaps in a public address on the way out and back again on "
                "the way in.",
                "NAT has its own vocabulary. Interfaces are inside (`ip nat inside`) or outside (`ip nat "
                "outside`). An inside local address is the private address configured on an inside host, and an "
                "inside global address is the public address that represents that host outside. Outside global is "
                "the real address of a host on the Internet, and outside local is how inside hosts see it, usually "
                "the same address.",
                "The router translates only traffic that crosses from an inside interface to an outside interface, "
                "or back, and keeps a table of active translations. NAT breaks the end-to-end model: an outside "
                "host cannot start a session to an inside host unless a mapping exists. IPv6 has enough addresses "
                "for every device and removes the need for NAT; the lab does not simulate IPv6.",
            ],
            "none",
            lines(
                "Term            Example          Meaning",
                "Inside local    192.168.10.21    private address on the inside host",
                "Inside global   203.0.113.2      public address that stands for it outside",
                "Outside global  198.51.100.10    real address of the Internet server",
                "Outside local   198.51.100.10    how inside hosts see that server (the same here)",
            ),
            "Marking interfaces backwards. If the LAN interface is `ip nat outside` and the provider link `ip nat "
            "inside`, LAN traffic leaves untranslated with private source addresses, and the replies never come "
            "back.",
            question(
                f"{C10}-q1",
                "In NAT terms, what is the inside global address?",
                [
                    "The private address configured on the inside host's network card",
                    "The public address that represents an inside host to the outside",
                    "The address of the provider's DNS server, as seen from the inside",
                ],
                "b",
                "Inside describes whose address it is, and global says where it is used. The inside global address "
                "is what the Internet sees for the inside host.",
            ),
        ),
        lesson(
            f"{C10}-s2",
            "Static NAT for a server",
            [
                "Static NAT maps one inside local address to one inside global address, permanently and in both "
                "directions: `ip nat inside source static 192.168.30.10 203.0.113.10`. Packets from the server "
                "leave with source 203.0.113.10, and packets that arrive for 203.0.113.10 are delivered to "
                "192.168.30.10. That is how you publish an internal server to the Internet.",
                "The public address must reach your router. It can come from the outside interface's own subnet, "
                "and then the router answers ARP for it on that interface, or from a separate block that the "
                "provider routes to your router. In this course the provider routes 203.0.113.8/29 to the branch "
                "router, because the /30 link has no spare address, and the server uses 203.0.113.10 from it.",
                "A one-to-one mapping forwards every protocol and every port, not just the web service. Publishing "
                "a server with static NAT therefore exposes all of it. Real designs forward only the ports they "
                "need (static PAT, often called port forwarding) and add filtering on the outside interface or a "
                "stateful firewall; the lab supports one-to-one static NAT only. Filters on the outside interface "
                "see public addresses: an inbound list runs before arriving packets are translated, and an outbound "
                "list runs after leaving packets are translated.",
            ],
            "router",
            lines(
                "R1> enable",
                "R1# configure terminal",
                "R1(config)# interface g0/0",
                "R1(config-if)# ip nat inside",
                "R1(config-if)# interface g0/1",
                "R1(config-if)# ip nat outside",
                "R1(config-if)# exit",
                "! Publish the web server: one inside address, one public address",
                "R1(config)# ip nat inside source static 192.168.30.10 203.0.113.10",
                "R1(config)# end",
                "R1# show ip nat translations",
            ),
            "Thinking static NAT publishes only the web service. A one-to-one mapping forwards every protocol to "
            "the server, so anything it answers, from ping to remote administration, is reachable from the "
            "Internet until you filter it.",
            question(
                f"{C10}-q2",
                "What does `ip nat inside source static 192.168.30.10 203.0.113.10` do?",
                [
                    "Maps the server to 203.0.113.10 for good, so outside hosts can start connections",
                    "Translates the server only while the server itself has a session open to the outside",
                    "Publishes only TCP port 80 of the server and blocks every other port and protocol",
                ],
                "a",
                "A static entry always exists, so traffic for 203.0.113.10 is translated whoever starts it. NAT "
                "itself filters nothing.",
            ),
        ),
        lesson(
            f"{C10}-s3",
            "PAT: many hosts behind one address",
            [
                "Port address translation (PAT), also called NAT overload, lets many inside hosts share one public "
                "address. The router rewrites each session's source port (for ICMP, the query ID) as well as the "
                "address, and records the mapping in its translation table. Replies come back to the shared "
                "address and port, and the table tells the router which inside host and port to restore.",
                "Configure PAT with an access list that selects which inside sources to translate, and one command "
                "that ties it to the outside interface: `ip nat inside source list 1 interface g0/1 overload`. "
                "Here the access list classifies traffic for NAT; it filters nothing. `show ip nat translations` "
                "lists each entry with its protocol and the inside global, inside local, outside local and outside "
                "global addresses and ports.",
                "When two inside hosts use the same source port or ICMP ID, the router gives one of them a "
                "different port on the outside, so the replies stay apart; in the lab, the second host's ICMP ID 1 "
                "becomes 1024. PAT also stops outside hosts from starting sessions to inside hosts, but treat that "
                "as a side effect, not as a security policy.",
            ],
            "router",
            lines(
                "R1> enable",
                "R1# configure terminal",
                "! Which inside sources may be translated",
                "R1(config)# access-list 1 permit 192.168.10.0 0.0.0.255",
                "R1(config)# access-list 1 permit 192.168.20.0 0.0.0.255",
                "! Share the address of g0/1 among all of them",
                "R1(config)# ip nat inside source list 1 interface g0/1 overload",
                "R1(config)# end",
                "R1# show ip nat translations",
                "R1# clear ip nat translation *",
            ),
            "A NAT access list that misses a subnet. If `access-list 1` permits 192.168.10.0/24 only, hosts in "
            "192.168.20.0/24 leave with their private addresses, and the provider cannot route the replies back.",
            question(
                f"{C10}-q3",
                "How does PAT tell apart two inside hosts that share the public address 203.0.113.2?",
                [
                    "By their MAC addresses, which the router keeps per session",
                    "By the TTL value each host puts in its packets",
                    "By a unique port or ICMP ID per session in the translation table",
                ],
                "c",
                "The translation table maps each public address and port pair back to one inside address and port. "
                "MAC addresses never leave the LAN, and the TTL changes at every hop.",
            ),
        ),
        lesson(
            f"{C10}-s4",
            "Capstone design: a secure branch",
            [
                "A small branch combines everything in this track. VLANs separate staff, guests and servers. A "
                "router-on-a-stick gives each VLAN its gateway. DHCP pools hand out addresses with the right "
                "gateway and DNS server. An access list limits what guests can reach. NAT connects the private "
                "ranges to the Internet: PAT for the users and static NAT for the published server.",
                "Segmentation is what limits damage. If a guest laptop is infected, the guest ACL keeps it away from "
                "staff PCs and the servers; if the published web server is compromised, filtering between VLANs "
                "limits where an attacker can go next. NAT does none of this: it changes addresses, and static NAT "
                "exposes the server completely. Real edges also run a stateful firewall, and real devices need "
                "passwords, SSH and logging, which this lab does not model.",
                "Verify a design layer by layer and keep the evidence: leases (`ipconfig /all`, `show ip dhcp "
                "binding`), routing (`show ip route`, `tracert`), filtering (`show access-lists` counters, one "
                "blocked and one allowed test) and translation (`show ip nat translations`). In the lab, a first "
                "ping that crosses two routers can lose two echoes to ARP before the replies arrive.",
            ],
            "none",
            lines(
                "Area         Branch design decision",
                "VLANs        10 STAFF, 20 GUEST, 30 SERVERS on S1, trunk to R1",
                "Gateways     R1 g0/0.10, g0/0.20 and g0/0.30, each .1 in its subnet",
                "DHCP         pools STAFF and GUEST on R1, .1 to .20 excluded",
                "Filtering    GUEST-IN inbound on g0/0.20: DHCP and DNS only inside, Internet allowed",
                "NAT          PAT on g0/1 for STAFF and GUEST, static 192.168.30.10 as 203.0.113.10",
                "Routing      default route to the provider at 203.0.113.1",
            ),
            "Treating NAT as a firewall. Static NAT forwards every protocol to the published server, and PAT "
            "blocks unsolicited inbound traffic only as a side effect. Write explicit filtering rules for every "
            "segment and for the Internet edge.",
            question(
                f"{C10}-q4",
                "Which statement about NAT and security is accurate?",
                [
                    "NAT only changes addresses; filtering must come from access lists or a firewall",
                    "PAT encrypts the traffic it translates, so it works like a VPN for the users",
                    "Static NAT forwards only web traffic, which keeps the published server safe",
                ],
                "a",
                "NAT rewrites addresses and ports. It neither encrypts nor filters, and a static mapping forwards "
                "every protocol.",
            ),
        ),
    ],
    "steps": [
        "Check the starting point: `show vlan brief` and `show interfaces trunk` on S1, `show ip interface brief` "
        "on R1. The VLANs, trunk and gateways work, but PC1 and PC2 have no addresses and R1 has no route to the "
        "Internet.",
        "DHCP: on R1 exclude .1 to .20 in 192.168.10.0/24 and 192.168.20.0/24, create pools STAFF and GUEST with "
        "gateway .1 and DNS server 192.168.30.10, then run `ipconfig /renew` on PC1 and PC2.",
        "Guest filter: `ip access-list extended GUEST-IN` with `permit udp any any eq bootps`, `permit udp "
        "192.168.20.0 0.0.0.255 host 192.168.30.10 eq domain`, `deny ip 192.168.20.0 0.0.0.255 192.168.0.0 "
        "0.0.255.255` and `permit ip 192.168.20.0 0.0.0.255 any`. Apply it with `ip access-group GUEST-IN in` on "
        "g0/0.20. Keep the first entry: a DHCP Discover comes from 0.0.0.0, so without it the implicit deny "
        "blocks guest leases. Run `ipconfig /renew` on PC2 again to prove it still gets one.",
        "NAT: mark g0/0.10, g0/0.20 and g0/0.30 `ip nat inside` and g0/1 `ip nat outside`. Add `access-list 1` "
        "entries for 192.168.10.0/24 and 192.168.20.0/24, then `ip nat inside source list 1 interface g0/1 "
        "overload` and `ip nat inside source static 192.168.30.10 203.0.113.10`.",
        "Add `ip route 0.0.0.0 0.0.0.0 203.0.113.1`. Ping 198.51.100.10 from PC1 and PC2 (the first echoes can be "
        "lost to ARP at R1 and R2), then read `show ip nat translations`.",
        "From PC3, the Internet user, ping 203.0.113.10. Static NAT delivers it to Server1, which proves that the "
        "server now answers the Internet on every protocol, not only on port 80.",
        "Test the guest limits: on PC2, `nslookup www.branch.test` works because GUEST-IN permits DNS, but "
        "http://192.168.30.10 and a ping to its own gateway are blocked, while PC1 opens http://www.branch.test. "
        "Press Check results, then read `show access-lists`.",
    ],
    "expected": (
        "PC1 and PC2 hold leases from .21 upward. PC2 resolves www.branch.test but is blocked from "
        "http://192.168.30.10, while PC1 opens http://www.branch.test. Both reach 198.51.100.10, and `show ip nat "
        "translations` shows their echoes translated to 203.0.113.2 (the first keeps ICMP ID 1, the second "
        "becomes 1024) plus the static 203.0.113.10 to 192.168.30.10 entry. PC3's pings to 203.0.113.10 are "
        "answered."
    ),
    "challenge": {
        "task": (
            "Static NAT exposes every service on Server1. Add an inbound list on R1 g0/1 that permits only web "
            "traffic to 203.0.113.10, drops everything else sent to that address, and lets all other packets "
            "through so that PAT keeps working. Then explain why a stateful firewall is the usual tool at a real "
            "Internet edge."
        ),
        "acceptance": [
            "The list applied inbound on g0/1 holds `permit tcp any host 203.0.113.10 eq www`, then `deny ip any "
            "host 203.0.113.10`, then `permit ip any any`",
            "PC3's ping to 203.0.113.10 is now administratively prohibited, while PC1 and PC2 still reach "
            "198.51.100.10",
            "You explain that the list is stateless, matches the public address because inbound filtering runs "
            "before translation, and that a stateful firewall tracks sessions instead",
        ],
    },
    "lab": {
        "title": "Capstone: a secure branch with DHCP, ACL and NAT",
        "brief": (
            "S1 and R1 already carry VLAN 10 STAFF (PC1), VLAN 20 GUEST (PC2) and VLAN 30 SERVERS (Server1, "
            "192.168.30.10, web and DNS), with gateways on R1 g0/0.10, g0/0.20 and g0/0.30. R1 g0/1 "
            "(203.0.113.2/30) connects to the provider router R2, which routes the branch's public block "
            "203.0.113.8/29 to R1 and serves an Internet web server (198.51.100.10) and an Internet user, PC3. "
            "Finish R1: DHCP for STAFF and GUEST (gateway .1, DNS 192.168.30.10, .1 to .20 excluded), the guest "
            "filter GUEST-IN (DHCP and DNS only inside, Internet allowed), PAT for both user VLANs, static NAT of "
            "Server1 to 203.0.113.10, and a default route to 203.0.113.1."
        ),
        "topology": {
            "devices": [
                device("R1", "router", 300, 80, config=R1_BRANCH_EDGE),
                device("R2", "router", 530, 80, config=R2_PROVIDER),
                device("Server2", "server", 700, 80, host("198.51.100.10", "255.255.255.0", "198.51.100.1"),
                       web("Internet web server")),
                device("PC3", "pc", 700, 240, host("192.0.2.50", "255.255.255.0", "192.0.2.1")),
                device("S1", "switch", 300, 230, config=S1_ROUTED_VLANS),
                device("PC1", "pc", 110, 350, dhcp_client()),
                device("PC2", "pc", 300, 350, dhcp_client()),
                device("Server1", "server", 490, 350, host("192.168.30.10", "255.255.255.0", "192.168.30.1", "192.168.30.10"),
                       web("Branch web site", [("www.branch.test", "192.168.30.10")])),
            ],
            "links": [
                "PC1 Fa0 S1 Fa0/1",
                "PC2 Fa0 S1 Fa0/2",
                "Server1 Fa0 S1 Fa0/3",
                "S1 Gi0/2 R1 Gi0/0",
                "R1 Gi0/1 R2 Gi0/0",
                "Server2 Fa0 R2 Gi0/1",
                "PC3 Fa0 R2 Gi0/2",
            ],
        },
        "goals": [
            {"type": "host", "device": "PC1", "dhcp": True, "gateway": "192.168.10.1",
             "label": "PC1 (STAFF) leases an address with gateway 192.168.10.1"},
            {"type": "host", "device": "PC2", "dhcp": True, "gateway": "192.168.20.1",
             "label": "PC2 (GUEST) leases an address with gateway 192.168.20.1"},
            {"type": "acl", "device": "R1", "iface": "g0/0.20", "direction": "in",
             "label": "A filter checks guest traffic entering R1 g0/0.20"},
            {"type": "http", "from": "PC2", "url": "http://192.168.30.10", "expect": "fail",
             "label": "Guests cannot open the internal web server"},
            {"type": "http", "from": "PC1", "url": "http://www.branch.test",
             "label": "Staff open the internal web site by name"},
            {"type": "ping", "from": "PC1", "to": "198.51.100.10", "label": "Staff reach the Internet through PAT"},
            {"type": "http", "from": "PC2", "url": "http://198.51.100.10",
             "label": "Guests browse the Internet web server through PAT"},
            {"type": "ping", "from": "PC3", "to": "203.0.113.10",
             "label": "An Internet user reaches Server1 through static NAT"},
        ],
        "solution": [
            {"device": "R1", "cli": [
                "enable", "configure terminal",
                "ip dhcp excluded-address 192.168.10.1 192.168.10.20",
                "ip dhcp excluded-address 192.168.20.1 192.168.20.20",
                "ip dhcp pool STAFF", "network 192.168.10.0 255.255.255.0", "default-router 192.168.10.1",
                "dns-server 192.168.30.10",
                "ip dhcp pool GUEST", "network 192.168.20.0 255.255.255.0", "default-router 192.168.20.1",
                "dns-server 192.168.30.10",
                "exit",
                "ip access-list extended GUEST-IN",
                "remark Guests: DHCP and DNS only inside, Internet allowed",
                "permit udp any any eq bootps",
                "permit udp 192.168.20.0 0.0.0.255 host 192.168.30.10 eq domain",
                "deny ip 192.168.20.0 0.0.0.255 192.168.0.0 0.0.255.255",
                "permit ip 192.168.20.0 0.0.0.255 any",
                "exit",
                "interface g0/0.10", "ip nat inside",
                "interface g0/0.20", "ip nat inside", "ip access-group GUEST-IN in",
                "interface g0/0.30", "ip nat inside",
                "interface g0/1", "ip nat outside",
                "exit",
                "access-list 1 permit 192.168.10.0 0.0.0.255",
                "access-list 1 permit 192.168.20.0 0.0.0.255",
                "ip nat inside source list 1 interface g0/1 overload",
                "ip nat inside source static 192.168.30.10 203.0.113.10",
                "ip route 0.0.0.0 0.0.0.0 203.0.113.1",
                "end",
            ]},
            {"device": "PC1", "desktop": ["ipconfig /renew"]},
            {"device": "PC2", "desktop": ["ipconfig /renew"]},
        ],
    },
    "exam": {
        "passPercent": 80,
        "questions": [
            question(
                f"{C10}-e1",
                "Why can a host with 192.168.10.21 not browse the Internet without NAT?",
                [
                    "Private addresses cannot carry TCP sessions to servers that use public addresses",
                    "The Internet does not route RFC 1918 addresses, so replies could not come back",
                    "Web browsers refuse to open pages when the source address is a private one",
                ],
                "b",
                "Many organizations use the same private ranges, so Internet routers carry no routes for them. NAT "
                "gives the traffic a public source address that replies can reach.",
                f"{C10}-s1",
            ),
            question(
                f"{C10}-e2",
                "Which kind of NAT lets Internet hosts start connections to an inside server?",
                [
                    "Static NAT, a permanent one-to-one mapping",
                    "PAT on the users' outside interface",
                    "None: NAT blocks every inbound connection",
                ],
                "a",
                "A static mapping exists before any traffic flows, so the router can translate a connection that "
                "starts outside. PAT entries only exist for sessions that inside hosts started.",
                f"{C10}-s2",
            ),
            question(
                f"{C10}-e3",
                "Two inside hosts both ping 198.51.100.10 with ICMP ID 1 through PAT on 203.0.113.2. What does the "
                "translation table show?",
                [
                    "One shared entry for both hosts, since both of them used ICMP ID 1",
                    "Two entries on 203.0.113.2 with different IDs, such as 1 and 1024",
                    "Two entries, each with its own public address from the provider",
                ],
                "b",
                "Each session needs a unique public address and port (or ID) pair, so the router renumbers the "
                "second host's ID. Replies can then be told apart.",
                f"{C10}-s3",
            ),
            question(
                f"{C10}-e4",
                "Hosts in 192.168.20.0/24 cannot reach the Internet, while 192.168.10.0/24 can. PAT uses "
                "`access-list 1`. What do you check first?",
                [
                    "Whether access-list 1 permits 192.168.20.0 0.0.0.255",
                    "Whether VLAN 20 has the same name on S1 and R1",
                    "Whether the DNS server has records for the Internet",
                ],
                "a",
                "Only sources that match the NAT access list are translated. Untranslated private sources cannot "
                "get replies from the Internet.",
                f"{C10}-s3",
            ),
            question(
                f"{C10}-e5",
                "A branch publishes its web server with static NAT and has no filter on the outside interface. "
                "Which statement is true?",
                [
                    "Only web traffic reaches the server, because NAT acts as a simple firewall",
                    "The server stays hidden, because NAT always hides the inside addresses",
                    "Anything the server answers is reachable from the Internet until you filter it",
                ],
                "c",
                "A one-to-one mapping forwards everything for the public address. Exposure is limited by filtering "
                "and by keeping the server's software secure, not by NAT.",
                f"{C10}-s4",
            ),
        ],
    },
    "sources": [
        rfc(3022, "Traditional IP Network Address Translator (Traditional NAT)"),
        rfc(2663, "IP Network Address Translator (NAT) Terminology and Considerations"),
        rfc(1918, "Address Allocation for Private Internets"),
        NIST_80041,
    ],
}

COURSES_7_TO_10 = [COURSE_7, COURSE_8, COURSE_9, COURSE_10]
