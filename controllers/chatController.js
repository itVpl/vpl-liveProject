import Message from '../models/Message.js';
import { Employee } from '../models/inhouseUserModel.js';

export const sendMessage = async (req, res) => {
  try {
    const { receiverEmpId, message, replyTo } = req.body;
    const senderEmpId = req.user.empId;
    // Find sender and receiver ObjectIds
    const senderUser = await Employee.findOne({ empId: senderEmpId });
    const receiverUser = await Employee.findOne({ empId: receiverEmpId });
    if (!senderUser || !receiverUser) {
      return res.status(404).json({ error: 'Sender or receiver not found' });
    }
    const newMsg = await Message.create({ sender: senderUser._id, receiver: receiverUser._id, message, status: 'sent', replyTo: replyTo || null });
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
    res.json(chat.reverse());
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