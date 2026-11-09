# Networking courses and the network simulator

`/networking` offers ten courses, from a first LAN to a branch-network capstone. `/networking/:lessonId`
uses the shared `ReadingTrack` shell:

- four sections, each with paragraphs, an executable CLI or desktop example, a common mistake and a
  checkpoint question;
- guided steps and an interactive lab with goals;
- an applied challenge and a five-question exam (80% to pass), which issues a certificate.

`/sandbox?bench=network` is the free bench. It opens on a small working LAN; `&lesson=<id>` opens that
course's lab instead. Course narratives, questions and lab text are English. Interface controls,
rewards and the bridge panel support Indonesian.

| Course | Lab |
| --- | --- |
| 1. Networks, models and your first LAN | Two PCs and a web server on a switch; set addresses, ping and load the page |
| 2. IPv4 addressing and subnetting | Fix a wrong gateway, a wrong mask and an out-of-range address across a router |
| 3. Ethernet switching and ARP | Two switches with shut ports; read MAC and ARP tables |
| 4. Router configuration and static routes | Three routers in a chain; default and specific static routes |
| 5. VLANs and 802.1Q trunks | Match a second switch: VLANs 10 and 20, a trunk with native VLAN 99 |
| 6. Inter-VLAN routing with router-on-a-stick | Three VLANs routed on dot1Q subinterfaces |
| 7. Dynamic routing with OSPF | Fix an area mismatch and a missing process; passive interfaces and a default route |
| 8. DHCP and DNS services | Two router pools with exclusions; browse by name and by address |
| 9. Access control lists | A named extended list on the guest subinterface: block staff web and hosts, keep ping and the Internet |
| 10. NAT, PAT and a secure branch capstone | DHCP, a guest access list, PAT for two VLANs and a static NAT server |

## Engine (`frontend/src/engine/network/`)

The engine is plain JavaScript with no DOM, timers or randomness, and it runs in Node tests.

| Module | Role |
| --- | --- |
| `addr.js` | IPv4, masks, wildcards, classful grouping, deterministic MACs (`0060.xxxx.xxpp`) |
| `model.js` | Project format `kind: 'network', version: 1`; device types and ports; validation (24 devices, 48 cables, 200 KB) |
| `sim.js` | Event-driven packet model and the network operations (ping, traceroute, HTTP, DNS, DHCP) |
| `cli.js` | Router/switch command line and `show` output |
| `desktop.js` | PC/server command prompt and web browser |
| `checks.js` | Lab goals and solution replay |
| `lab.js` | Compact lab topologies → projects |

Devices and ports:

| Device | Ports |
| --- | --- |
| PC, server | `Fa0` |
| Switch | `Fa0/1`–`Fa0/8`, `Gi0/1`, `Gi0/2` |
| Router | `Gi0/0`–`Gi0/2`, plus dot1Q subinterfaces |

Router interfaces start administratively down. Switch ports start up in VLAN 1.

### What the model does

- **Ethernet:** switches learn MAC addresses per VLAN. They flood broadcasts and unknown unicast
  within the VLAN and filter frames whose destination is on the ingress port.
- **VLANs:** access ports carry untagged frames. Trunks tag every VLAN except the native one, honour
  the allowed list, and forward only VLANs that exist on the switch.
- **ARP:** hosts hold a packet while ARP resolves. Routers drop the packet that triggered ARP, as real
  routers do, so a first ping across *n* routers can lose up to *n* echoes.
- **IPv4 routing:** routes are selected by longest prefix. Connected and local routes come from up
  interfaces, then static routes with a next hop or an exit interface, then OSPF.
- **Route selection:** when several sources offer the same prefix, the lowest administrative
  distance wins (connected 0, static 1, OSPF 110).
- **TTL and ICMP:** routers decrement TTL and send ICMP time-exceeded, network-unreachable and
  administratively-prohibited (code 13) errors. They never send an ICMP error about an ICMP error.
- **Access lists:** standard (1–99) and extended (100–199), numbered or named. Lines are matched in
  order with an implicit deny. Extended lines can match `eq` ports and the ICMP `echo` and
  `echo-reply` types. Lists apply in or out on an interface. An inbound list filters everything that
  arrives, including DHCP requests, so a list on a DHCP-client interface must permit `bootps`.
  Outbound lists do not filter packets the router sends itself. A list that does not exist permits
  everything. OSPF hellos are not modelled as packets, so lists never block an adjacency.
- **NAT:** static one-to-one mappings and PAT overload on an interface, selected by an access list.
  - Outside → inside translation happens before routing.
  - Inside → outside translation happens after routing and before the outbound access list, as on
    real routers.
  - A router answers ARP for a static global address that lies in its outside interface's subnet.
  - `show ip nat translations` lists the entries.
- **DHCP:** router pools hand out the lowest free address that is not excluded, in DISCOVER → OFFER →
  REQUEST → ACK order. A pool serves only the subnet of the interface that received the request; there
  is no relay.
- **DNS and HTTP:** servers answer A records over UDP 53 and serve one page over TCP 80. TCP is
  modelled as four segments: SYN, SYN+ACK, the request and the response. Clients retry like real ones,
  because each router on a cold path drops one packet while it resolves ARP:
  - DNS sends up to 3 queries, and only prints a timeout when all of them are lost;
  - the browser sends up to 5 SYNs;
  - ping goals ping twice on the same tables, as a learner would.
- **OSPF:** single area, cost 1 per link, Dijkstra over adjacencies found at layer 2, passive
  interfaces and `default-information originate` (O*E2).

### Deliberate simplifications

- No Spanning Tree. A cabled switch loop is stopped by a hop guard after 24 switches, and a cap of
  3,000 events applies to each operation; both are logged in the event list.
- No IPv6, no passwords or `line` configuration, and no switch IP/SVI.
- OSPF has no DR/BDR elections or hello/dead timers. Neighbours show `FULL/  -` with dead time `--`.
  `router-id` applies at once; `clear ip ospf process` is accepted and confirms automatically.
  Adding a `network` statement that already exists in another area is rejected until the old one is
  removed with `no network`.
- Times are virtual (`time<1ms`). Tables do not age; `clear` commands empty them.

Unsupported commands are rejected with the CLI's invalid-input marker, never silently accepted.
Course text may teach STP, DR/BDR, IPv6 or DHCP relay, but must say the lab does not simulate them.
The interface never says "Cisco" or "Packet Tracer". It describes the command line as the widely used
router/switch CLI style.

### Command line

The CLI has user EXEC, privileged EXEC and these configuration modes: global, interface,
subinterface, `interface range`, `router ospf`, `ip dhcp pool`, `vlan`, and named standard/extended
access lists.

- Keywords can be abbreviated to any unique prefix, and `do` works in configuration modes.
- Rejected input gets `% Invalid input detected at '^' marker.` with a caret, `% Incomplete command.`
  or `% Ambiguous command`.
- `show` commands:
  - `running-config` and `startup-config`;
  - `ip interface brief`;
  - `ip route`, grouped by classful network as the router CLI prints it;
  - `ip arp`, `access-lists`, `ip nat translations`, `ip ospf neighbor` and `ip dhcp binding`;
  - `vlan brief`, `mac address-table` and `interfaces trunk`.
- Router `ping` prints `!`, `.`, `U` and `A`. `cliError(output)` separates rejections from
  informational notices such as `% Access VLAN does not exist. Creating vlan 10`.

The desktop prompt supports these commands; anything else answers `Invalid Command.`:

- `ipconfig`, `ipconfig /all`, `ipconfig /renew` and `ipconfig /release`;
- `ping` (with `-n`), `tracert`, `arp -a` and `nslookup`.

## Interface (`frontend/src/features/networking/`)

`NetworkLab` is used by course labs and by the bench (`editable`).

- **Topology canvas:** an SVG with original glyphs. Link ends are green when the port is up and red
  when it is down. Devices can be dragged; selecting one works with a click, a tap, the keyboard or
  the device `<select>`.
- **Device panel:**
  - routers and switches get a CLI terminal;
  - PCs get a Command Prompt, IP Configuration (static or DHCP) and a Web Browser;
  - servers also get Services (HTTP page and DNS records).
- **Simulation mode:** replays the events of the last command: time, from, to and protocol. The
  details list the headers outermost first and what the receiving device decided. The canvas
  highlights that hop.
- **Lab goals:** goals are checked on a copy of the runtime tables, so checking does not change what
  `show` displays. A disclosure shows a reference solution, and Reset restores the starting
  topology.
- **Bench only:** add devices, cable them through a port form, and remove them. The project can be
  saved to `vq.network.project.v1` (explicit save), loaded with a replace confirmation, or exported
  and imported as JSON.

## Content contract and verification

`content/networking.json` is generated by `scripts/generate_networking_json.py` from
`scripts/networking_courses/`. `features/networking/networkingContent.test.js` replays every lesson
example exactly as printed: every line is a prompt line or a `!` comment, the prompt must equal the
CLI's state at that point, and every command must be accepted. Every lab must build without CLI
errors, fail at least one goal at the start, and pass every goal after its `solution`.

Other tests:

- `engine/network/network.test.js` covers switching and the loop guard, the CLI, VLANs and trunks,
  router-on-a-stick, static and OSPF routing, DHCP, DNS, HTTP, access lists, PAT, and goals.
- `features/networking/networkLab.test.jsx` covers the interface.

## Connection to the cybersecurity track

`SECURITY_BRIDGES` in `features/courses/learningMap.js` link networking courses to web-security
courses (see COURSES.md, "Connected learning map"). They appear in two places:

- the **Networking ↔ cybersecurity** panel on `/networking` and `/cybersecurity`;
- the **Connected courses** panel on the linked course pages of both tracks.

The simulator and the security console never exchange traffic, so every bridge is a written
comparison.
