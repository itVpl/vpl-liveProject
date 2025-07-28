import Message from '../models/Message.js';
import { Employee } from '../models/inhouseUserModel.js';
import { onlineUsers } from '../server.js';
import { normalizeChatFilePath } from '../middlewares/upload.js';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';

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

// Download chat file
export const downloadChatFile = async (req, res) => {
  try {
    const { messageId } = req.params;
    const myEmpId = req.user.empId;

    // Find the message and verify access
    const message = await Message.findById(messageId)
      .populate('sender', 'empId employeeName')
      .populate('receiver', 'empId employeeName');

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user has access to this message (sender or receiver)
    const myUser = await Employee.findOne({ empId: myEmpId });
    if (!myUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isSender = message.sender._id.equals(myUser._id);
    const isReceiver = message.receiver._id.equals(myUser._id);

    if (!isSender && !isReceiver) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get file URL (image or file)
    const fileUrl = message.image || message.file;
    if (!fileUrl) {
      return res.status(404).json({ error: 'No file found in this message' });
    }

    // Determine file type and name
    const fileType = message.image ? 'image' : 'document';
    const fileName = fileUrl.split('/').pop() || 'download';
    
    // Check if it's S3 URL or local file
    if (fileUrl.startsWith('http')) {
      // S3 file - redirect to S3 URL
      res.redirect(fileUrl);
    } else {
      // Local file
      const filePath = path.join(process.cwd(), fileUrl);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on server' });
      }

      // Set headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', getContentType(fileName));
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }

  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Download failed' });
  }
};

// Helper function to get content type
const getContentType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
};

// Get download URLs for multiple files (for frontend use)
export const getFileDownloadUrls = async (req, res) => {
  try {
    const { messageIds } = req.body; // Array of message IDs
    const myEmpId = req.user.empId;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'Message IDs array is required' });
    }

    const myUser = await Employee.findOne({ empId: myEmpId });
    if (!myUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find all messages and verify access
    const messages = await Message.find({
      _id: { $in: messageIds },
      $or: [
        { sender: myUser._id },
        { receiver: myUser._id }
      ]
    }).populate('sender', 'empId employeeName');

    if (messages.length === 0) {
      return res.status(404).json({ error: 'No accessible messages found' });
    }

    // Format response with download URLs
    const downloadUrls = messages.map(msg => {
      const fileUrl = msg.image || msg.file;
      if (!fileUrl) return null;

      return {
        messageId: msg._id,
        fileName: fileUrl.split('/').pop() || 'download',
        fileType: msg.image ? 'image' : 'document',
        downloadUrl: `/api/chat/download/${msg._id}`,
        originalUrl: normalizeChatFilePath(fileUrl),
        uploadedBy: msg.sender.employeeName,
        uploadedAt: msg.timestamp
      };
    }).filter(item => item !== null);

    res.json({
      files: downloadUrls,
      total: downloadUrls.length
    });

  } catch (err) {
    console.error('Get download URLs error:', err);
    res.status(500).json({ error: 'Failed to get download URLs' });
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

// Get unread messages for the current user
export const getUnreadMessages = async (req, res) => {
  try {
    const myEmpId = req.user.empId;
    const myUser = await Employee.findOne({ empId: myEmpId });
    
    if (!myUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all unread messages where current user is the receiver
    const unreadMessages = await Message.find({
      receiver: myUser._id,
      status: { $ne: 'seen' }
    })
      .populate('sender', 'empId employeeName email department designation')
      .populate('receiver', 'empId employeeName email department designation')
      .sort({ timestamp: -1 })
      .lean();

    // Group messages by sender
    const unreadBySender = {};
    
    for (const msg of unreadMessages) {
      const senderEmpId = msg.sender.empId;
      
      if (!unreadBySender[senderEmpId]) {
        unreadBySender[senderEmpId] = {
          sender: {
            empId: msg.sender.empId,
            employeeName: msg.sender.employeeName,
            email: msg.sender.email,
            department: msg.sender.department,
            designation: msg.sender.designation
          },
          unreadCount: 0,
          lastMessage: null,
          lastMessageTime: null,
          messages: []
        };
      }
      
      unreadBySender[senderEmpId].unreadCount += 1;
      unreadBySender[senderEmpId].messages.push({
        _id: msg._id,
        message: msg.message,
        image: msg.image ? normalizeChatFilePath(msg.image) : undefined,
        file: msg.file ? normalizeChatFilePath(msg.file) : undefined,
        timestamp: msg.timestamp,
        status: msg.status,
        replyTo: msg.replyTo
      });
      
      // Update last message info
      if (!unreadBySender[senderEmpId].lastMessageTime || 
          msg.timestamp > unreadBySender[senderEmpId].lastMessageTime) {
        unreadBySender[senderEmpId].lastMessage = msg.message;
        unreadBySender[senderEmpId].lastMessageTime = msg.timestamp;
      }
    }

    // Convert to array and sort by last message time
    const unreadMessagesList = Object.values(unreadBySender).sort((a, b) => 
      new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );

    res.json({
      success: true,
      totalUnreadCount: unreadMessages.length,
      unreadBySender: unreadMessagesList,
      totalSenders: unreadMessagesList.length
    });

  } catch (err) {
    console.error('Get unread messages error:', err);
    res.status(500).json({ error: err.message });
  }
}; 