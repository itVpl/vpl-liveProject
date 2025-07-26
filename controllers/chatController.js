import Message from '../models/Message.js';
import { Employee } from '../models/inhouseUserModel.js';
import { onlineUsers } from '../server.js';

// export const sendMessage = async (req, res) => {
//   try {
//     const { receiverEmpId, message, replyTo } = req.body;
//     const senderEmpId = req.user.empId;
//     // Find sender and receiver ObjectIds
//     const senderUser = await Employee.findOne({ empId: senderEmpId });
//     const receiverUser = await Employee.findOne({ empId: receiverEmpId });
//     if (!senderUser || !receiverUser) {
//       return res.status(404).json({ error: 'Sender or receiver not found' });
//     }
//     const newMsg = await Message.create({ sender: senderUser._id, receiver: receiverUser._id, message, status: 'sent', replyTo: replyTo || null });
//     res.status(201).json(newMsg);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

export const sendMessage = (io) => async (req, res) => {
  try {
    const { receiverEmpId, message, replyTo } = req.body;
    const senderEmpId = req.user.empId;

    const senderUser = await Employee.findOne({ empId: senderEmpId });
    const receiverUser = await Employee.findOne({ empId: receiverEmpId });

    if (!senderUser || !receiverUser) {
      return res.status(404).json({ error: 'Sender or receiver not found' });
    }

    // Handle file upload (image/pdf)
    let imageUrl = undefined;
    let fileUrl = undefined;
    if (req.file) {
      const ext = req.file.originalname.split('.').pop().toLowerCase();
      if (["jpg", "jpeg", "png"].includes(ext)) {
        imageUrl = req.file.location || req.file.path;
      } else if (ext === "pdf") {
        fileUrl = req.file.location || req.file.path;
      } else {
        // fallback: treat as file
        fileUrl = req.file.location || req.file.path;
      }
    }

    const newMsg = await Message.create({
      sender: senderUser._id,
      receiver: receiverUser._id,
      message,
      image: imageUrl,
      file: fileUrl,
      status: 'sent',
      replyTo: replyTo || null
    });

    // Sirf receiver ko emit karo
    const toSocketId = onlineUsers.get(receiverEmpId);
    if (toSocketId) {
      io.to(toSocketId).emit('newMessage', {
        senderEmpId,
        receiverEmpId,
        message,
        image: imageUrl,
        file: fileUrl,
        _id: newMsg._id,
        timestamp: newMsg.timestamp
      });
      // Optional: notification event
      io.to(toSocketId).emit('notification', {
        title: 'New Message',
        body: message || 'You received a new message',
        from: senderEmpId
      });
    }

    res.status(201).json(newMsg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getChat = async (req, res) => {
  try {
    const { empId } = req.params;
    const myEmpId = req.user.empId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const myUser = await Employee.findOne({ empId: myEmpId });
    const otherUser = await Employee.findOne({ empId });
    if (!myUser || !otherUser) return res.status(404).json({ error: 'User not found' });
    
    const chat = await Message.find({
      $or: [
        { sender: myUser._id, receiver: otherUser._id },
        { sender: otherUser._id, receiver: myUser._id }
      ]
    })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Add empId information to each message
    const chatWithEmpIds = chat.map(msg => ({
      ...msg,
      senderEmpId: msg.sender.equals(myUser._id) ? myEmpId : empId,
      // receiverEmpId: msg.sender.equals(myEmpId) ? empId : myEmpId,
      receiverEmpId: msg.sender.equals(myUser._id) ? empId : myEmpId,
      isMyMessage: msg.sender.equals(myUser._id)
    }));

    res.json(chatWithEmpIds.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getChatList = async (req, res) => {
  try {
    const myEmpId = req.user.empId;
    const myUser = await Employee.findOne({ empId: myEmpId });
    if (!myUser) return res.status(404).json({ error: 'User not found' });
    const messages = await Message.find({
      $or: [{ sender: myUser._id }, { receiver: myUser._id }]
    }).sort({ timestamp: -1 });
    const chatMap = {};
    for (const msg of messages) {
      const otherUserId = msg.sender.equals(myUser._id) ? msg.receiver : msg.sender;
      if (!chatMap[otherUserId]) {
        const user = await Employee.findById(otherUserId);
        if (!user) continue;
        chatMap[otherUserId] = {
          empId: user.empId,
          employeeName: user.employeeName,
          lastMessage: msg.message,
          lastMessageTime: msg.timestamp,
          unreadCount: 0,
          online: false // Will be set by Socket.io
        };
      }
      if (
        msg.receiver.equals(myUser._id) &&
        msg.status !== 'seen'
      ) {
        chatMap[otherUserId].unreadCount += 1;
      }
    }
    res.json(Object.values(chatMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const markAsSeen = async (req, res) => {
  try {
    const myEmpId = req.user.empId;
    const fromEmpId = req.params.empId;
    const myUser = await Employee.findOne({ empId: myEmpId });
    const fromUser = await Employee.findOne({ empId: fromEmpId });
    if (!myUser || !fromUser) return res.status(404).json({ error: 'User not found' });
    await Message.updateMany(
      { sender: fromUser._id, receiver: myUser._id, status: { $ne: 'seen' } },
      { $set: { status: 'seen' } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Search employees for chat initiation
export const searchEmployeesForChat = async (req, res) => {
  try {
    const myEmpId = req.user.empId;
    const q = req.query.q?.trim();
    if (!q) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    // Case-insensitive, partial match on employeeName or empId, exclude self
    const employees = await Employee.find({
      $and: [
        {
          $or: [
            { employeeName: { $regex: q, $options: 'i' } },
            { empId: { $regex: q, $options: 'i' } }
          ]
        },
        { empId: { $ne: myEmpId } }
      ]
    })
      .select('empId employeeName email department designation')
      .limit(20);
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 