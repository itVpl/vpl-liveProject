import emailClient from '../utils/emailClient.js';

// export const getInbox = async (req, res) => {
//   try {
//     const emails = await emailClient.fetchInbox();
//     res.json({ success: true, emails });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

export const getInbox = async (req, res) => {
    try {
        const emails = await emailClient.fetchInbox(req.query.limit);
        const filtered = emails.map(email => ({
            uid: email.attrs?.uid || '',
            from: email.from?.text || '',
            subject: email.subject || '',
            content: email.text || '',
            date: email.date ? new Date(email.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
            seen: email.attrs?.flags?.includes('\\Seen') || false
        }));
        res.json({ success: true, emails: filtered });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const getEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const email = await emailClient.fetchEmailByUid(id);
        res.json({ success: true, email });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const replyEmail = async (req, res) => {
    try {
        const { to, subject, text, inReplyTo, references, attachments } = req.body;  
        const info = await emailClient.sendReply({ to, subject, text, inReplyTo, references, attachments });
        res.json({ success: true, message: 'Reply sent successfully', info });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const sendMail = async (req, res) => {
    try {
        const { to, subject, text, html, attachments } = req.body;
        const info = await emailClient.sendMail({ to, subject, text, html, attachments });
        res.json({ success: true, message: 'Email sent successfully', info });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const deleteEmail = async (req, res) => {
    try {
        const { id } = req.params;
        await emailClient.deleteEmail(id);
        res.json({ success: true, message: 'Email deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const saveDraft = async (req, res) => {
    try {
        const { to, subject, text, html, attachments } = req.body;
        const info = await emailClient.saveDraft({ to, subject, text, html, attachments });
        res.json({ success: true, message: 'Draft saved successfully', info });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};




