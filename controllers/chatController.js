import Message from '../models/Message.js';
import { Employee } from '../models/inhouseUserModel.js';
import { onlineUsers } from '../server.js';
import { normalizeChatFilePath } from '../middlewares/upload.js';

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
        imageUrl = normalizeChatFilePath(req.file.location || req.file.path);
      } else if (ext === "pdf") {
        fileUrl = normalizeChatFilePath(req.file.location || req.file.path);
      } else {
        // fallback: treat as file
        fileUrl = normalizeChatFilePath(req.file.location || req.file.path);
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

    // Add empId information to each message and normalize file URLs
    const chatWithEmpIds = chat.map(msg => ({
      ...msg,
      senderEmpId: msg.sender.equals(myUser._id) ? myEmpId : empId,
      receiverEmpId: msg.sender.equals(myUser._id) ? empId : myEmpId,
      isMyMessage: msg.sender.equals(myUser._id),
      // Normalize file URLs for proper display
      image: msg.image ? normalizeChatFilePath(msg.image) : undefined,
      file: msg.file ? normalizeChatFilePath(msg.file) : undefined
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

// Get all files uploaded by a specific user in chats
export const getUserChatFiles = async (req, res) => {
  try {
    const { empId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const user = await Employee.findOne({ empId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find all messages with files from this user
    const messagesWithFiles = await Message.find({
      sender: user._id,
      $or: [
        { image: { $exists: true, $ne: null } },
        { file: { $exists: true, $ne: null } }
      ]
    })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('receiver', 'empId employeeName')
      .lean();

    // Format the response with normalized URLs
    const files = messagesWithFiles.map(msg => ({
      _id: msg._id,
      fileName: msg.file ? msg.file.split('/').pop() : msg.image ? msg.image.split('/').pop() : 'Unknown',
      fileType: msg.file ? 'document' : 'image',
      fileUrl: msg.file ? normalizeChatFilePath(msg.file) : normalizeChatFilePath(msg.image),
      originalName: msg.file ? msg.file.split('/').pop() : msg.image ? msg.image.split('/').pop() : 'Unknown',
      uploadedAt: msg.timestamp,
      receiver: {
        empId: msg.receiver.empId,
        name: msg.receiver.employeeName
      },
      message: msg.message || ''
    }));

    res.json({
      files,
      total: files.length,
      page,
      limit,
      hasMore: files.length === limit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all files from a specific chat conversation
export const getChatFiles = async (req, res) => {
  try {
    const { empId } = req.params;
    const myEmpId = req.user.empId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const myUser = await Employee.findOne({ empId: myEmpId });
    const otherUser = await Employee.findOne({ empId });
    
    if (!myUser || !otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find all messages with files between these two users
    const messagesWithFiles = await Message.find({
      $or: [
        { sender: myUser._id, receiver: otherUser._id },
        { sender: otherUser._id, receiver: myUser._id }
      ],
      $or: [
        { image: { $exists: true, $ne: null } },
        { file: { $exists: true, $ne: null } }
      ]
    })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sender', 'empId employeeName')
      .populate('receiver', 'empId employeeName')
      .lean();

    // Format the response with normalized URLs
    const files = messagesWithFiles.map(msg => ({
      _id: msg._id,
      fileName: msg.file ? msg.file.split('/').pop() : msg.image ? msg.image.split('/').pop() : 'Unknown',
      fileType: msg.file ? 'document' : 'image',
      fileUrl: msg.file ? normalizeChatFilePath(msg.file) : normalizeChatFilePath(msg.image),
      originalName: msg.file ? msg.file.split('/').pop() : msg.image ? msg.image.split('/').pop() : 'Unknown',
      uploadedAt: msg.timestamp,
      sender: {
        empId: msg.sender.empId,
        name: msg.sender.employeeName
      },
      receiver: {
        empId: msg.receiver.empId,
        name: msg.receiver.employeeName
      },
      message: msg.message || '',
      isMyFile: msg.sender.empId === myEmpId
    }));

    res.json({
      files,
      total: files.length,
      page,
      limit,
      hasMore: files.length === limit
    });
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