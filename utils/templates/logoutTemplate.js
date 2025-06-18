export const logoutTemplate = ({ name, logoutTime }) => {
    return `
      <div style="max-width:600px;margin:auto;font-family:'Segoe UI',Arial,sans-serif;border:1px solid #e0e0e0;border-radius:10px;padding:30px;background:#f9f9f9;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="color:#c0392b;margin:0;">Logout Notification</h2>
        </div>
        <p style="font-size:16px;color:#333;">Hi <strong>${name}</strong>,</p>
        <p style="font-size:15px;color:#333;">You have successfully logged out at:</p>
        <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;margin:20px 0;font-size:16px;font-weight:bold;color:#d35400;">
          ${logoutTime}
        </div>
        <p style="font-size:14px;color:#666;">If this logout was <strong>not done by you</strong>, please contact our IT team immediately.</p>
        <br/>
        <hr style="border:none;border-top:1px solid #ccc;"/>
        <p style="font-size:13px;color:#999;text-align:center;">
          V Power Logistics – <em>Trust | Transparency | Technology</em><br/>
          Gurgaon, India 🇮🇳
        </p>
      </div>
    `;
  };
  