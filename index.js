'use strict';

const os = require('os');
const nodeStatic = require('node-static');
const http = require('http');
const socketIO = require('socket.io');
const port = process.env.PORT || 3030;

const fileServer = new nodeStatic.Server();
const app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(port);

const io = socketIO.listen(app);
const rooms = {}; // Store active rooms and their participants

io.sockets.on('connection', function(socket) {
  function log() {
    const array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    const clientsInRoom = rooms[room] || [];
    const numClients = clientsInRoom.length;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      // Creating a new room
      socket.join(room);
      clientsInRoom.push(socket.id);
      rooms[room] = clientsInRoom;
      log('Client ID ' + socket.id + ' created and joined room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients < 2) {
      // Joining an existing room
      socket.join(room);
      clientsInRoom.push(socket.id);
      rooms[room] = clientsInRoom;
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else {
      // Room is full
      socket.emit('full', room);
    }
  });

  socket.on('message', function(message) {
    const room = getRoomBySocketId(socket.id);
    if (room) {
      log('Client in room ' + room + ' said: ' + message);
      io.sockets.in(room).emit('message', message);
    }
  });

  socket.on('turn-on-video', function() {
    const room = getRoomBySocketId(socket.id);
    if (room) {
      socket.to(room).emit('turn-on-video', socket.id);
    }
  });

  socket.on('turn-off-video', function() {
    const room = getRoomBySocketId(socket.id);
    if (room) {
      socket.to(room).emit('turn-off-video', socket.id);
    }
  });

  socket.on('disconnect', function() {
    const room = getRoomBySocketId(socket.id);
    if (room) {
      const clientsInRoom = rooms[room];
      const index = clientsInRoom.indexOf(socket.id);
      if (index !== -1) {
        clientsInRoom.splice(index, 1);
        if (clientsInRoom.length === 0) {
          delete rooms[room];
        }
      }
      log('Client ID ' + socket.id + ' left room ' + room);
      socket.to(room).emit('participant-left', socket.id);
    }
  });

  socket.on('ipaddr', function() {
    const ifaces = os.networkInterfaces();
    for (const dev in ifaces) {
      if (ifaces.hasOwnProperty(dev)) {
        ifaces[dev].forEach(function(details) {
          if (details.family === 'IPv4' && details.address
          && details.address !== '127.0.0.1' && details.address !== '10.173.1.175') {
            socket.emit('ipaddr', details.address);
          }
        });
      }
    }
  });

  socket.on('bye', function() {
    console.log('received bye');
    const room = getRoomBySocketId(socket.id);
    if (room) {
      const clientsInRoom = rooms[room];
      const index = clientsInRoom.indexOf(socket.id);
      if (index !== -1) {
        clientsInRoom.splice(index, 1);
        if (clientsInRoom.length === 0) {
          delete rooms[room];
        }
      }
      socket.to(room).emit('participant-left', socket.id);
    }
  });

  // Helper function to get the room ID based on socket ID
  function getRoomBySocketId(socketId) {
    for (const room in rooms) {
      if (rooms.hasOwnProperty(room)) {
        if (rooms[room].includes(socketId)) {
          return room;
        }
      }
    }
    return null;
  }
});