const joinBox = document.getElementById('joinBox');
const viewerWrap = document.getElementById('viewerWrap');
const pinInput = document.getElementById('pinInput');
const joinBtn = document.getElementById('joinBtn');
const statusEl = document.getElementById('status');
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

let ws = null;

function connect() {
  const code = pinInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    statusEl.textContent = 'Enter a valid 6-digit PIN';
    return;
  }

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${protocol}://${location.host}`);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'viewer:join', code }));
  };

  ws.onmessage = (event) => {
    if (typeof event.data === 'string') {
      const msg = JSON.parse(event.data);
      if (msg.type === 'joined') {
        joinBox.style.display = 'none';
        viewerWrap.style.display = 'flex';
        statusEl.textContent = '';
      } else if (msg.type === 'error') {
        statusEl.textContent = msg.message;
      } else if (msg.type === 'host-left') {
        statusEl.textContent = 'Host disconnected.';
        viewerWrap.style.display = 'none';
        joinBox.style.display = 'flex';
      }
      return;
    }

    // Binary = JPEG frame
    const blob = new Blob([event.data], { type: 'image/jpeg' });
    createImageBitmap(blob).then((bitmap) => {
      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
      }
      ctx.drawImage(bitmap, 0, 0);
    });
  };

  ws.onerror = () => { statusEl.textContent = 'Connection error.'; };
  ws.onclose = () => { statusEl.textContent = statusEl.textContent || 'Disconnected.'; };
}

joinBtn.addEventListener('click', connect);
pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });

function sendControl(payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'control', ...payload }));
  }
}

// ---- Mouse control: normalize coordinates 0..1 so it maps correctly
// regardless of the host's actual screen resolution ----
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  sendControl({ action: 'move', x, y });
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  const button = e.button === 2 ? 'right' : 'left';
  sendControl({ action: 'click', x, y, button });
  canvas.focus();
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  sendControl({ action: 'scroll', amount: e.deltaY > 0 ? -2 : 2 });
}, { passive: false });

// ---- Keyboard control (only while the canvas is focused) ----
canvas.addEventListener('keydown', (e) => {
  e.preventDefault();
  sendControl({ action: 'key_down', key: e.key });
});

canvas.addEventListener('keyup', (e) => {
  e.preventDefault();
  sendControl({ action: 'key_up', key: e.key });
});
