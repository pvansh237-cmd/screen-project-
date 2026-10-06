# Remote Screen Control — Website (No login, no install on viewer side)

## Kya hai ye
- **Target laptop** (jiski screen share/control karni hai): yahan Python agent chalega. Yahi par "sab kuch" setup hota hai.
- **Viewer laptop** (jisse control karna hai): sirf **browser me website kholni hai**. Koi install nahi, koi login nahi, koi "allow screen/camera access" wala popup nahi — kyunki viewer kuch capture nahi kar raha, bas receive + control-commands bhej raha hai.

## Architecture
```
[Target laptop]                [Node.js Server]              [Viewer laptop]
  agent.py  ----(screen frames)---->  server.js  ----(frames)---->  Browser (website)
  (pyautogui executes  <----(click/key events)---- (relay) <----(click/key events)---
   control commands)
```

Server sirf ek **relay** hai (signaling + frame forwarding) — koi account/database nahi, sirf random PIN se session match hota hai.

## Setup

### 1. Server chalao (kisi bhi ek machine pe — target laptop pe bhi chala sakte ho)
```bash
cd web-remote-control        # project root (server.js wala folder)
npm install
npm start
```
Isse `http://<server-ip>:3000` pe website live ho jayegi.

> Agar dono laptop same WiFi pe hain, toh server target laptop pe hi chala sakte ho, aur server ka local IP (jaise `192.168.1.5`) doosre laptop ko share kar dena.

### 2. Target laptop pe agent chalao (jiski screen control karni hai)
```bash
cd agent
pip install -r requirements.txt
python agent.py --server ws://<server-ip>:3000
```
Terminal me PIN print hoga — ye PIN doosre laptop ko do (WhatsApp/verbally).

### 3. Viewer laptop pe — bas browser kholo
```
http://<server-ip>:3000
```
PIN daalo → Connect dabao → screen live dikhne lagegi. Canvas ke andar click karke mouse/keyboard se control karo.

## Important points (viva/demo ke liye)
- **No login:** session sirf random 6-digit PIN se bind hoti hai, PIN server restart hote hi invalid ho jata hai.
- **Viewer side zero install, zero permission popup:** website sirf WebSocket se connect karti hai aur JPEG frames receive karti hai — isliye browser koi "allow access" prompt nahi dikhata.
- **Target side pe sab kuch hota hai:** Python agent screen capture (`mss`), encode (`OpenCV`), aur control execution (`pyautogui`) khud karta hai.
- Dono laptop same WiFi pe hone chahiye for LAN demo. Alag network (internet) pe chalana ho toh server ko kisi cloud VM/port-forwarded machine pe deploy karo — code same rahega, bas `--server` URL change hoga.

## File structure
```
web-remote-control/
├── server.js              # Node WebSocket relay + serves the website
├── package.json
├── public/
│   ├── index.html          # viewer website UI
│   └── client.js           # viewer logic: connect, render frames, send control
└── agent/
    ├── agent.py             # runs on target laptop
    └── requirements.txt
```
