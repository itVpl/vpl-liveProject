import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER; 
const EMAIL_FETCH_LIMIT = process.env.EMAIL_FETCH_LIMIT || 50;

// Reusable transporter
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' }
});

function getImapConfig() {
  if (EMAIL_PROVIDER === 'gmail') {
    return {
      user: EMAIL_USER,
      password: EMAIL_PASS,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    };
  } else if (EMAIL_PROVIDER === 'outlook') {
    return {
      user: EMAIL_USER,
      password: EMAIL_PASS,
      host: 'outlook.office365.com',
      port: 993,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    };
  } else {
    return {
      user: EMAIL_USER,
      password: EMAIL_PASS,
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
      },
    };
  }
}

async function fetchInbox(limit = EMAIL_FETCH_LIMIT) {
  // Temporary solution - return empty array to avoid IMAP errors
  console.log("📧 Inbox API called - returning empty array for now");
  return [];
}

async function fetchEmailByUid(uid) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());
    function openInbox(cb) {
      imap.openBox('INBOX', true, cb);
    }
    imap.once('ready', function () {
      openInbox(function (err, box) {
        if (err) return reject(err);
        const f = imap.fetch(uid, { bodies: '', markSeen: false });
        let email = {};
        f.on('message', function (msg, seqno) {
          msg.on('body', function (stream) {
            simpleParser(stream, (err, parsed) => {
              if (!err) {
                email = { ...email, ...parsed };
              }
            });
          });
          msg.once('attributes', function (attrs) {
            email.attrs = attrs;
          });
        });
        f.once('error', function (err) {
          reject(err);
        });
        f.once('end', function () {
          imap.end();
          resolve(email);
        });
      });
    });
    imap.once('error', function (err) {
      reject(err);
    });
    imap.connect();
  });
}

// Delete email by UID
async function deleteEmail(uid) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());
    function openInbox(cb) {
      imap.openBox('INBOX', false, cb); // false = write mode
    }
    imap.once('ready', function () {
      openInbox(function (err, box) {
        if (err) return reject(err);
        imap.seq.addFlags(uid, '\\Deleted', function (err) {
          if (err) return reject(err);
          imap.expunge(function (err) {
            imap.end();
            if (err) return reject(err);
            resolve(true);
          });
        });
      });
    });
    imap.once('error', function (err) {
      reject(err);
    });
    imap.connect();
  });
}

// Save draft
async function saveDraft({ to, subject, text, html, attachments }) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());
    function openDrafts(cb) {
      imap.openBox('Drafts', false, cb);
    }
    imap.once('ready', function () {
      openDrafts(function (err, box) {
        if (err) return reject(err);
        // Build raw email
        const mailOptions = {
          from: EMAIL_USER,
          to,
          subject,
          text,
          html,
          attachments
        };
        transporter.sendMail({ ...mailOptions, envelope: { to, from: EMAIL_USER } }, (err, info) => {
          if (err) return reject(err);
          resolve(info);
        });
      });
    });
    imap.once('error', function (err) {
      reject(err);
    });
    imap.connect();
  });
}

// Send mail with attachments support
async function sendMail({ to, subject, text, html, attachments }) {
  const mailOptions = {
    from: EMAIL_USER,
    to,
    subject,
    text,
    html,
    attachments // [{ filename, path }]
  };
  return transporter.sendMail(mailOptions);
}

async function sendReply({ to, subject, text, inReplyTo, references, attachments }) {
  const mailOptions = {
    from: EMAIL_USER,
    to,
    subject,
    text,
    inReplyTo,
    references,
    attachments
  };
  return transporter.sendMail(mailOptions);
}


async function fetchSentEmails(limit = process.env.EMAIL_FETCH_LIMIT) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());

    function openSent(cb) {
      const provider = EMAIL_PROVIDER?.toLowerCase();
      const sentBoxName =
        provider === 'gmail' ? '[Gmail]/Sent Mail' :
        provider === 'outlook' ? 'Sent Items' :
        'Sent';

      imap.openBox(sentBoxName, true, cb);
    }

    imap.once('ready', function () {
      openSent(function (err, box) {
        if (err) return reject(err);

        // Optional debug: List all available boxes if "Sent" fails
        // imap.getBoxes((err, boxes) => { console.log('Mailboxes:', boxes); });

        const highestUid = box.uidnext - 1;
        const startUid = highestUid - 200 > 0 ? highestUid - 200 : 1;
        const fetchRange = `${startUid}:${highestUid}`;

        const f = imap.fetch(fetchRange, { bodies: '', markSeen: false });

        const emailPromises = [];

        f.on('message', function (msg, seqno) {
          let attrs;
          const parserPromise = new Promise((res) => {
            msg.on('body', function (stream) {
              simpleParser(stream, (err, parsed) => {
                res({ seqno, attrs, ...parsed });
              });
            });
            msg.once('attributes', function (a) {
              attrs = a;
            });
          });
          emailPromises.push(parserPromise);
        });

        f.once('error', reject);

        f.once('end', async () => {
          imap.end();
          try {
            let emails = await Promise.all(emailPromises);
            emails = emails.filter(e => e.date).sort((a, b) => new Date(b.date) - new Date(a.date));
            resolve(emails.slice(0, limit));
          } catch (e) {
            reject(e);
          }
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

export default {
  fetchInbox,
  fetchEmailByUid,
  sendReply,
  sendMail,
  deleteEmail,
  saveDraft,
  fetchSentEmails
}; 