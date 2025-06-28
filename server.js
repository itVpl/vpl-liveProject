import { app } from "./app.js";
import http from 'http';
import { Server } from 'socket.io';
import Message from './models/Message.js';
import { Employee } from './models/inhouseUserModel.js';

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // You can restrict this to your frontend origin
    methods: ['GET', 'POST']
  }
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('join', (empId) => {
    socket.empId = empId;
    onlineUsers.set(empId, socket.id);
    io.emit('user_online', empId);
  });

  socket.on('typing', ({ toEmpId }) => {
    const toSocketId = onlineUsers.get(toEmpId);
    if (toSocketId) io.to(toSocketId).emit('typing', { fromEmpId: socket.empId });
  });

  socket.on('stop_typing', ({ toEmpId }) => {
    const toSocketId = onlineUsers.get(toEmpId);
    if (toSocketId) io.to(toSocketId).emit('stop_typing', { fromEmpId: socket.empId });
  });

  socket.on('send_message', async (data) => {
    // data: { senderEmpId, receiverEmpId, message }
    const senderUser = await Employee.findOne({ empId: data.senderEmpId });
    const receiverUser = await Employee.findOne({ empId: data.receiverEmpId });
    if (!senderUser || !receiverUser) return;
    let newMsg = await Message.create({
      sender: senderUser._id,
      receiver: receiverUser._id,
      message: data.message,
      status: 'sent'
    });
    // Deliver to receiver
    const toSocketId = onlineUsers.get(data.receiverEmpId);
    if (toSocketId) {
      io.to(toSocketId).emit('receive_message', newMsg);
      // Update status to delivered
      await Message.findByIdAndUpdate(newMsg._id, { status: 'delivered' });
      io.to(socket.id).emit('message_status', { messageId: newMsg._id, status: 'delivered' });
    }
    // Send to sender for confirmation
    io.to(socket.id).emit('message_sent', newMsg);
  });

  socket.on('message_seen', async ({ messageId }) => {
    await Message.findByIdAndUpdate(messageId, { status: 'seen' });
    // Optionally, notify sender
  });

  socket.on('disconnect', () => {
    if (socket.empId) {
      onlineUsers.delete(socket.empId);
      io.emit('user_offline', socket.empId);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});