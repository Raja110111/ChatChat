const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let waiting = [];
const partners = new Map();

function pair() {
  while (waiting.length >= 2) {
    const a = waiting.shift();
    const b = waiting.shift();
    partners.set(a, b);
    partners.set(b, a);
    io.to(a).emit('paired', { partner: b });
    io.to(b).emit('paired', { partner: a });
  }
}

io.on('connection', socket => {
  socket.on('find', () => {
    if (!waiting.includes(socket.id)) waiting.push(socket.id);
    pair();
  });

  socket.on('signal', ({ to, data }) => {
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('disconnect', () => {
    waiting = waiting.filter(id => id !== socket.id);
    const p = partners.get(socket.id);
    if (p) {
      partners.delete(p);
      partners.delete(socket.id);
      io.to(p).emit('partner-left');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Running on port", PORT));
