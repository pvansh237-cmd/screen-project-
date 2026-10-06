"""
agent.py
Run this ONLY on the laptop whose screen will be shared & controlled.

It connects OUT to the signaling server (no incoming ports to open),
grabs a PIN, streams the screen as JPEG frames, and executes mouse/keyboard
commands it receives — using pyautogui.

The other laptop needs NOTHING installed: they just open the website
(index.html served by server.js) in a browser and enter the PIN.

Run:
    pip install -r requirements.txt
    python agent.py --server ws://<server-ip-or-localhost>:3000
"""

import argparse
import asyncio
import json
import cv2
import numpy as np
import mss
import pyautogui
import websockets

pyautogui.FAILSAFE = False

FPS = 12
JPEG_QUALITY = 55
FRAME_WIDTH = 1280


async def screen_sender(ws, stop_event):
    with mss.mss() as sct:
        monitor = sct.monitors[1]
        delay = 1 / FPS
        while not stop_event.is_set():
            img = np.array(sct.grab(monitor))
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
            h, w = img.shape[:2]
            scale = FRAME_WIDTH / w
            img = cv2.resize(img, (FRAME_WIDTH, int(h * scale)))
            ok, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            if ok:
                try:
                    await ws.send(buf.tobytes())
                except websockets.exceptions.ConnectionClosed:
                    break
            await asyncio.sleep(delay)


async def control_listener(ws, stop_event):
    screen_w, screen_h = pyautogui.size()
    async for message in ws:
        if isinstance(message, bytes):
            continue  # agent never receives frames
        try:
            msg = json.loads(message)
        except json.JSONDecodeError:
            continue
        if msg.get('type') != 'control':
            continue

        action = msg.get('action')
        try:
            if action == 'move':
                pyautogui.moveTo(int(msg['x'] * screen_w), int(msg['y'] * screen_h))
            elif action == 'click':
                pyautogui.click(
                    int(msg['x'] * screen_w),
                    int(msg['y'] * screen_h),
                    button=msg.get('button', 'left'),
                )
            elif action == 'scroll':
                pyautogui.scroll(int(msg.get('amount', 0)))
            elif action == 'key_down':
                key = map_key(msg['key'])
                if key:
                    pyautogui.keyDown(key)
            elif action == 'key_up':
                key = map_key(msg['key'])
                if key:
                    pyautogui.keyUp(key)
        except Exception as e:
            print('control exec error:', e)
    stop_event.set()


def map_key(browser_key: str):
    """Map a JS KeyboardEvent.key value to a pyautogui key name."""
    special = {
        ' ': 'space', 'Enter': 'enter', 'Backspace': 'backspace', 'Tab': 'tab',
        'Escape': 'esc', 'ArrowUp': 'up', 'ArrowDown': 'down',
        'ArrowLeft': 'left', 'ArrowRight': 'right', 'Shift': 'shift',
        'Control': 'ctrl', 'Alt': 'alt', 'Meta': 'win', 'Delete': 'delete',
        'CapsLock': 'capslock',
    }
    if browser_key in special:
        return special[browser_key]
    if len(browser_key) == 1:
        return browser_key.lower()
    return None  # ignore unmapped keys (F-keys etc. can be added if needed)


async def run(server_url):
    async with websockets.connect(server_url, max_size=None) as ws:
        await ws.send(json.dumps({'type': 'host:register'}))
        reply = json.loads(await ws.recv())
        code = reply['code']

        print('=' * 50)
        print(' LIVE SCREEN SHARE + CONTROL — HOST AGENT')
        print('=' * 50)
        print(f' PIN: {code}')
        print(' Share this PIN with the viewer. Open the website on')
        print(' the other laptop and enter it. No install needed there.')
        print('=' * 50)

        stop_event = asyncio.Event()
        await asyncio.gather(
            screen_sender(ws, stop_event),
            control_listener(ws, stop_event),
        )


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--server', default='ws://localhost:3000', help='WebSocket URL of server.js')
    args = parser.parse_args()
    asyncio.run(run(args.server))
