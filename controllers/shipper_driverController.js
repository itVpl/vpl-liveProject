import ShipperDriver from '../models/shipper_driverModel.js';
import hashPassword from '../utils/hashPassword.js';
import { normalizeShipperTruckerPath, normalizeCMTDocumentPath } from '../middlewares/upload.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/sendEmail.js';

const registerUser = async (req, res) => {
    try {
        const {
            userType, compName, mc_dot_no, carrierType, fleetsize,
            compAdd, country, state, city, zipcode, phoneNo, email, password
        } = req.body;

        if (!userType || !phoneNo || !email || !password) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }

        const existingUser = await ShipperDriver.findOne({ $or: [{ email }, { phoneNo }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email or Phone already registered' });
        }

        const hashedPassword = await hashPassword(password);
        const docUploadPath = req.file ? (req.file.location || req.file.path) : '';

        const newUser = new ShipperDriver({
            userType,
            compName,
            mc_dot_no,
            carrierType,
            fleetsize,
            compAdd,
            country,
            state,
            city,
            zipcode,
            phoneNo,
            email,
            password: hashedPassword,
            docUpload: docUploadPath,
        });

        await newUser.save();

        console.log('📁 File uploaded to S3:', docUploadPath);
        console.log('🏢 Company folder created for:', compName);

        // 🔥 Send registration confirmation email
        try {
            const emailSubject = `🎉 Registration Successful - ${compName}`;
            const emailMessage = generateRegistrationEmail(compName, userType, email);

            await sendEmail({
                to: email,
                subject: emailSubject,
                html: emailMessage,
            });

            console.log('📧 Registration email sent to:', email);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
            // Don't fail registration if email fails
        }

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            userId: newUser.userId,
            filePath: docUploadPath
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 🔥 Generate registration email template
const generateRegistrationEmail = (compName, userType, email) => {
    const userTypeText = userType === 'shipper' ? 'Shipper' : 'Trucker';

    return `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fb; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.07); padding: 40px;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Success" width="80" style="margin-bottom: 20px;" />
        <h1 style="color: #2d3748; margin-bottom: 10px; font-size: 28px;">Registration Successful!</h1>
        <p style="color: #4a5568; font-size: 18px; margin: 0;">Welcome to our platform</p>
      </div>
      
      <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
        <h2 style="color: #1e40af; margin-top: 0; font-size: 20px;">📋 Registration Details</h2>
        <p style="color: #1e3a8a; margin-bottom: 8px;"><strong>Company Name:</strong> ${compName}</p>
        <p style="color: #1e3a8a; margin-bottom: 8px;"><strong>Account Type:</strong> ${userTypeText}</p>
        <p style="color: #1e3a8a; margin-bottom: 0;"><strong>Email:</strong> ${email}</p>
      </div>
      
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
        <h3 style="color: #92400e; margin-top: 0; font-size: 18px;">⏳ Next Steps</h3>
        <p style="color: #78350f; margin-bottom: 10px;">Your registration has been received successfully. Our team is currently reviewing your submitted documents.</p>
        <p style="color: #78350f; margin-bottom: 0;"><strong>Status:</strong> <span style="background: #fbbf24; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 12px;">PENDING REVIEW</span></p>
      </div>
      
      <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
        <h3 style="color: #065f46; margin-top: 0; font-size: 18px;">📧 What Happens Next?</h3>
        <ul style="color: #047857; margin-bottom: 0; padding-left: 20px;">
          <li>Our admin team will review your submitted documents</li>
          <li>You'll receive an email notification once your account is approved</li>
          <li>Once approved, you can login and start using our platform</li>
          <li>This process typically takes 24-48 hours</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 30px; border-top: 1px solid #e2e8f0;">
        <p style="color: #718096; font-size: 14px; margin-bottom: 10px;">
          If you have any questions, please contact our support team.
        </p>
        <p style="color: #a0aec0; font-size: 12px; margin: 0;">
          Thank you for choosing our platform!
        </p>
      </div>
      
    </div>
  </div>
  `;
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // ✅ 1. Required Field Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
                errors: {
                    email: !email ? 'Email is required' : null,
                    password: !password ? 'Password is required' : null
                }
            });
        }

        // ✅ 2. Email Format Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address',
                errors: {
                    email: 'Invalid email format'
                }
            });
        }

        // ✅ 3. Password Length Validation
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long',
                errors: {
                    password: 'Password must be at least 6 characters'
                }
            });
        }

        // ✅ 4. Email Trim and Lowercase
        const cleanEmail = email.trim().toLowerCase();

        // ✅ 5. Find User
        const user = await ShipperDriver.findOne({ email: cleanEmail });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found with this email address',
                errors: {
                    email: 'No user found with this email'
                }
            });
        }

        // ✅ 6. Check Account Status
        if (user.status !== 'approved') {
            return res.status(403).json({
                success: false,
                message: `Your account is ${user.status}. Please wait for admin approval.`,
                errors: {
                    email: `Account is ${user.status}`
                },
                status: user.status
            });
        }

        // ✅ 7. Password Verification
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password',
                errors: {
                    password: 'Incorrect password'
                }
            });
        }

        const token = jwt.sign(
            { id: user._id, userId: user.userId, userType: user.userType },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            sameSite: 'Lax',
            secure: false,
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
                id: user._id,
                userId: user.userId,
                userType: user.userType,
                compName: user.compName,
                phoneNo: user.phoneNo,
                email: user.email,
                status: user.status,
                mc_dot_no: user.mc_dot_no,
                token: token

            }
        });

    } catch (err) {
        console.error('❌ Login error:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await ShipperDriver.find().select('-password');
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const getAllShippers = async (req, res) => {
    try {
        const shippers = await ShipperDriver.find({ userType: 'shipper' }).select('-password');
        res.status(200).json({ success: true, data: shippers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const getAllTruckers = async (req, res) => {
    try {
        const truckers = await ShipperDriver.find({ userType: 'trucker' }).select('-password');
        res.status(200).json({ success: true, data: truckers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        console.log('🔍 Updating status for userId:', userId);
        console.log('🔍 New status:', status);

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be pending, approved, or rejected'
            });
        }

        // First check if user exists with different queries
        console.log('🔍 Checking user with userId:', userId);
        const existingUser = await ShipperDriver.findOne({ userId });
        console.log('🔍 Existing user found:', existingUser ? 'Yes' : 'No');

        if (!existingUser) {
            // Try with _id
            console.log('🔍 Trying with _id...');
            const userById = await ShipperDriver.findById(userId);
            console.log('🔍 User by _id found:', userById ? 'Yes' : 'No');

            if (!userById) {
                console.log('❌ User not found with userId or _id:', userId);
                return res.status(404).json({ success: false, message: 'User not found' });
            }
        }

        // Try update with userId first
        let user = await ShipperDriver.findOneAndUpdate(
            { userId },
            { status },
            { new: true }
        ).select('-password');

        // If not found, try with _id
        if (!user) {
            console.log('🔍 Trying update with _id...');
            user = await ShipperDriver.findByIdAndUpdate(
                userId,
                { status },
                { new: true }
            ).select('-password');
        }

        if (!user) {
            console.log('❌ User not found for update');
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log('✅ Status updated successfully for:', user.compName);

        // 🔥 Send status update email
        try {
            const emailSubject = `Account Status Update - ${user.compName}`;
            const emailMessage = generateStatusUpdateEmail(user.compName, user.userType, status, user.email);

            await sendEmail({
                to: user.email,
                subject: emailSubject,
                html: emailMessage,
            });

            console.log('📧 Status update email sent to:', user.email);
        } catch (emailError) {
            console.error('❌ Status update email failed:', emailError);
            // Don't fail status update if email fails
        }

        res.status(200).json({
            success: true,
            message: `User status updated to ${status}`,
            user
        });

    } catch (error) {
        console.error('❌ Status update error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


// const simpleStatusUpdate = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { status } = req.body;

//         if (!['approved', 'pending', 'rejected'].includes(status)) {
//             return res.status(400).json({ success: false, message: 'Invalid status value' });
//         }

//         let user = await ShipperDriver.findOneAndUpdate(
//             { userId }, // 🔥 UUID wala field
//             { status },
//             { new: true }
//         ).select('-password');

//         // ⚠️ Only try findById if userId length is 24 (valid ObjectId)
//         if (!user && userId.length === 24) {
//             user = await ShipperDriver.findByIdAndUpdate(
//                 userId, // 🔥 ObjectId
//                 { status },
//                 { new: true }
//             ).select('-password');
//         }

//         if (!user) {
//             return res.status(404).json({ success: false, message: 'User not found' });
//         }

//         res.status(200).json({ success: true, message: 'Status updated', user });

//     } catch (err) {
//         console.error('❌ Status update failed:', err);
//         res.status(500).json({ success: false, message: 'Server error' });
//     }
// };


const simpleStatusUpdate = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, reason = '' } = req.body;

        if (!['approved', 'pending', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        let user = await ShipperDriver.findOneAndUpdate(
            { userId },
            {
                status,
                statusUpdatedAt: new Date(),
            },
            { new: true }
        ).select('-password');

        if (!user && userId.length === 24) {
            user = await ShipperDriver.findByIdAndUpdate(
                userId,
                {
                    status,
                    statusUpdatedAt: new Date(),
                },
                { new: true }
            ).select('-password');
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // ✅ Send status update email
        try {
            const emailSubject = `Account Status Update - ${user.compName}`;
            const emailMessage = generateStatusUpdateEmail(
                user.compName,
                user.userType,
                status,
                user.email,
                reason
            );

            await sendEmail({
                to: user.email,
                subject: emailSubject,
                html: emailMessage,
            });

            console.log('📧 Status update email sent to:', user.email);
        } catch (emailErr) {
            console.error('❌ Email send failed:', emailErr);
            // Don't fail the API if email fails
        }

        res.status(200).json({ success: true, message: 'Status updated & email sent', user });
    } catch (err) {
        console.error('❌ Status update failed:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};





// 🔥 Update status update email template to include reason
const generateStatusUpdateEmail = (compName, userType, status, email, reason = '') => {
    const userTypeText = userType === 'shipper' ? 'Shipper' : 'Trucker';
    const statusText = status === 'approved' ? 'APPROVED' : 'REJECTED';
    const statusColor = status === 'approved' ? '#10b981' : '#ef4444';
    const statusBgColor = status === 'approved' ? '#ecfdf5' : '#fef2f2';
    const statusBorderColor = status === 'approved' ? '#10b981' : '#ef4444';

    let statusMessage = '';
    let nextSteps = '';

    if (status === 'approved') {
        statusMessage = 'Congratulations! Your account has been approved. You can now login and start using our platform.';
        nextSteps = `
      <ul style="color: #047857; margin-bottom: 0; padding-left: 20px;">
        <li>You can now login to your account</li>
        <li>Start creating loads (if you're a shipper)</li>
        <li>Start bidding on loads (if you're a trucker)</li>
        <li>Add drivers to your fleet (if you're a trucker)</li>
        <li>Access all platform features</li>
      </ul>
    `;
    } else if (status === 'rejected') {
        statusMessage = 'We regret to inform you that your account has been rejected. Please review your submitted documents and try again.';
        nextSteps = `
      <ul style="color: #dc2626; margin-bottom: 0; padding-left: 20px;">
        <li>Please review your submitted documents</li>
        <li>Ensure all required documents are uploaded</li>
        <li>Contact support if you need assistance</li>
        <li>You may reapply with corrected documents</li>
      </ul>
    `;
    }

    const reasonSection = reason ? `
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
      <h3 style="color: #92400e; margin-top: 0; font-size: 18px;">📝 Review Notes</h3>
      <p style="color: #78350f; margin-bottom: 0;"><strong>Reason:</strong> ${reason}</p>
    </div>
  ` : '';

    return `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fb; padding: 40px 0;">
    <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.07); padding: 40px;">
      
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${status === 'approved' ? 'https://cdn-icons-png.flaticon.com/512/190/190411.png' : 'https://cdn-icons-png.flaticon.com/512/1828/1828840.png'}" alt="Status" width="80" style="margin-bottom: 20px;" />
        <h1 style="color: #2d3748; margin-bottom: 10px; font-size: 28px;">Account Status Update</h1>
        <p style="color: #4a5568; font-size: 18px; margin: 0;">Your account review is complete</p>
      </div>
      
      <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
        <h2 style="color: #1e40af; margin-top: 0; font-size: 20px;">📋 Account Details</h2>
        <p style="color: #1e3a8a; margin-bottom: 8px;"><strong>Company Name:</strong> ${compName}</p>
        <p style="color: #1e3a8a; margin-bottom: 8px;"><strong>Account Type:</strong> ${userTypeText}</p>
        <p style="color: #1e3a8a; margin-bottom: 0;"><strong>Email:</strong> ${email}</p>
      </div>
      
      <div style="background: ${statusBgColor}; border-left: 4px solid ${statusBorderColor}; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
        <h3 style="color: ${status === 'approved' ? '#065f46' : '#991b1b'}; margin-top: 0; font-size: 18px;">📊 Status Update</h3>
        <p style="color: ${status === 'approved' ? '#047857' : '#dc2626'}; margin-bottom: 10px;">${statusMessage}</p>
        <p style="color: ${status === 'approved' ? '#047857' : '#dc2626'}; margin-bottom: 0;"><strong>Status:</strong> <span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${statusText}</span></p>
      </div>
      
      ${reasonSection}
      
      <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
        <h3 style="color: #065f46; margin-top: 0; font-size: 18px;">🚀 Next Steps</h3>
        ${nextSteps}
      </div>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 30px; border-top: 1px solid #e2e8f0;">
        <p style="color: #718096; font-size: 14px; margin-bottom: 10px;">
          If you have any questions, please contact our support team.
        </p>
        <p style="color: #a0aec0; font-size: 12px; margin: 0;">
          Thank you for choosing our platform!
        </p>
      </div>
      
    </div>
  </div>
  `;
};

// 🔥 New: Employee adds shipper/trucker
const addShipperTruckerByEmployee = async (req, res) => {
    try {
        const employee = req.user; // From auth middleware
        const {
            userType, compName, mc_dot_no, carrierType, fleetsize,
            compAdd, country, state, city, zipcode, phoneNo, email, password,
            agentIds // Accept agentIds from request body
        } = req.body;

        // ✅ Validation
        if (!userType || !phoneNo || !email || !password) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }

        if (!['shipper', 'trucker'].includes(userType)) {
            return res.status(400).json({ success: false, message: 'Invalid userType. Must be shipper or trucker' });
        }

        // ✅ Check if employee has permission (admin or superadmin)
        if (employee.role !== 'admin' && employee.role !== 'superadmin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. Only admins and superadmins can add shippers/truckers.' 
            });
        }

        // ✅ Check for existing user
        const existingUser = await ShipperDriver.findOne({ $or: [{ email }, { phoneNo }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email or Phone already registered' });
        }

        // ✅ Hash password and handle file upload
        const hashedPassword = await hashPassword(password);
        const docUploadPath = req.file ? normalizeShipperTruckerPath(req.file.path) : '';

        // ✅ Create new shipper/trucker with employee reference
        const newUser = new ShipperDriver({
            userType,
            compName,
            mc_dot_no,
            carrierType,
            fleetsize,
            compAdd,
            country,
            state,
            city,
            zipcode,
            phoneNo,
            email,
            password: hashedPassword,
            docUpload: docUploadPath,
            // 🔥 Add employee reference
            addedBy: {
                empId: employee.empId,
                employeeName: employee.employeeName,
                department: employee.department
            },
            // 🔥 Save agentIds (array of empId)
            agentIds: Array.isArray(agentIds) ? agentIds : [],
            // Auto-approve if added by employee
            status: 'approved',
            statusUpdatedBy: employee.empId,
            statusUpdatedAt: new Date()
        });

        await newUser.save();

        console.log('✅ Shipper/Trucker added by employee:', {
            employee: employee.empId,
            company: compName,
            userType: userType
        });

        // 🔥 Send approval email (since auto-approved)
        try {
            const emailSubject = `🎉 Account Approved - ${compName}`;
            const emailMessage = generateStatusUpdateEmail(
                compName, 
                userType, 
                'approved', 
                email, 
                'Account approved by ' + employee.employeeName + ' (' + employee.department + ')'
            );

            await sendEmail({
                to: email,
                subject: emailSubject,
                html: emailMessage,
            });

            console.log('📧 Approval email sent to:', email);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
            // Don't fail the operation if email fails
        }

        res.status(201).json({
            success: true,
            message: `${userType} added successfully and auto-approved`,
            userId: newUser.userId,
            addedBy: {
                empId: employee.empId,
                employeeName: employee.employeeName,
                department: employee.department
            },
            filePath: docUploadPath
        });

    } catch (error) {
        console.error('❌ Add shipper/trucker error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 🔥 Get shippers/truckers added by specific employee
const getShipperTruckersByEmployee = async (req, res) => {
    try {
        const employee = req.user;
        const { empId } = req.params;

        // ✅ Check if employee has permission
        if (employee.role !== 'admin' && employee.role !== 'superadmin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. Only admins and superadmins can view this data.' 
            });
        }

        // ✅ If not superadmin, can only view their own additions
        if (employee.role === 'admin' && empId !== employee.empId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. You can only view your own additions.' 
            });
        }

        const users = await ShipperDriver.find({ 
            'addedBy.empId': empId 
        }).select('-password').sort({ createdAt: -1 });

        const shippers = users.filter(user => user.userType === 'shipper');
        const truckers = users.filter(user => user.userType === 'trucker');

        res.status(200).json({
            success: true,
            employee: {
                empId: empId,
                employeeName: employee.role === 'admin' ? employee.employeeName : 'Unknown',
                department: employee.role === 'admin' ? employee.department : 'Unknown'
            },
            totalAdded: users.length,
            shippers: {
                count: shippers.length,
                data: shippers
            },
            truckers: {
                count: truckers.length,
                data: truckers
            }
        });

    } catch (error) {
        console.error('❌ Get shipper/truckers by employee error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 🔥 Get all shippers/truckers with employee reference info
const getAllUsersWithEmployeeInfo = async (req, res) => {
    try {
        const employee = req.user;

        // ✅ Check if employee has permission
        if (employee.role !== 'admin' && employee.role !== 'superadmin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied. Only admins and superadmins can view this data.' 
            });
        }

        const users = await ShipperDriver.find().select('-password').sort({ createdAt: -1 });

        // ✅ Group by added by employee
        const groupedByEmployee = {};
        const withoutEmployee = [];

        users.forEach(user => {
            if (user.addedBy && user.addedBy.empId) {
                if (!groupedByEmployee[user.addedBy.empId]) {
                    groupedByEmployee[user.addedBy.empId] = {
                        employee: {
                            empId: user.addedBy.empId,
                            employeeName: user.addedBy.employeeName,
                            department: user.addedBy.department
                        },
                        users: []
                    };
                }
                groupedByEmployee[user.addedBy.empId].users.push(user);
            } else {
                withoutEmployee.push(user);
            }
        });

        res.status(200).json({
            success: true,
            totalUsers: users.length,
            addedByEmployees: Object.values(groupedByEmployee),
            publicRegistrations: withoutEmployee,
            summary: {
                totalAddedByEmployees: Object.keys(groupedByEmployee).length,
                totalPublicRegistrations: withoutEmployee.length
            }
        });

    } catch (error) {
        console.error('❌ Get all users with employee info error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// 🔥 NEW: CMT Department Inhouse User can add Trucker only
const addTruckerByCMTEmployee = async (req, res) => {
    try {
        // ✅ 1. Check if user is authenticated and is an inhouse employee
        const inhouseUser = req.user;
        if (!inhouseUser || !inhouseUser.empId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // ✅ 2. Check if user belongs to CMT department
        if (inhouseUser.department !== 'CMT') {
            return res.status(403).json({
                success: false,
                message: 'Only CMT department employees can add truckers'
            });
        }

        // ✅ 3. Extract trucker data from request body
        const {
            compName,
            mc_dot_no,
            carrierType,
            fleetsize,
            compAdd,
            country,
            state,
            city,
            zipcode,
            phoneNo,
            email,
            password
        } = req.body;

        // ✅ 4. Validate required fields
        if (!compName || !phoneNo || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Company name, phone number, email, and password are required',
                errors: {
                    compName: !compName ? 'Company name is required' : null,
                    phoneNo: !phoneNo ? 'Phone number is required' : null,
                    email: !email ? 'Email is required' : null,
                    password: !password ? 'Password is required' : null
                }
            });
        }

        // ✅ 5. Check if email already exists
        const existingEmail = await ShipperDriver.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered',
                errors: {
                    email: 'This email is already in use'
                }
            });
        }

        // ✅ 6. Check if phone already exists
        const existingPhone = await ShipperDriver.findOne({ phoneNo });
        if (existingPhone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already registered',
                errors: {
                    phoneNo: 'This phone number is already in use'
                }
            });
        }

        // ✅ 7. Hash password
        const hashedPassword = await hashPassword(password);

        // ✅ 8. Handle file uploads for documents
        let docUploadPath = '';
        let documents = {};
        
        // Debug: Log all request information
        
        // Handle single document upload (backward compatibility)
        if (req.file) {
            docUploadPath = normalizeShipperTruckerPath(req.file.path);
            console.log('📁 Single file uploaded:', docUploadPath);
        }
        
        // Handle multiple document uploads (new functionality)
        if (req.files) {
            console.log('📁 Multiple files uploaded:', Object.keys(req.files));
            console.log('📁 Files details:', JSON.stringify(req.files, null, 2));
            
            // Process each document type
            const documentTypes = [
                'brokeragePacket',
                'carrierPartnerAgreement', 
                'w9Form',
                'mcAuthority',
                'safetyLetter',
                'bankingInfo',
                'inspectionLetter',
                'insurance'
            ];
            
            documentTypes.forEach(docType => {
                if (req.files[docType] && req.files[docType][0]) {
                    const file = req.files[docType][0];
                    console.log(`📄 Processing ${docType}:`, {
                        originalname: file.originalname,
                        filename: file.filename,
                        path: file.path,
                        location: file.location
                    });
                    
                    // Try different path properties
                    const filePath = file.location || file.path || file.filename;
                    const normalizedPath = normalizeCMTDocumentPath(filePath);
                    documents[docType] = normalizedPath;
                    console.log(`📄 ${docType} uploaded:`, normalizedPath);
                } else {
                    console.log(`❌ ${docType} not found in uploaded files`);
                }
            });
        } else {
            console.log('❌ No files found in req.files');
        }

        // ✅ 9. Create new trucker record
        const newTrucker = new ShipperDriver({
            userType: 'trucker', // Always set as trucker
            status: 'pending', // Set as pending for review
            statusUpdatedBy: inhouseUser.empId,
            statusUpdatedAt: new Date(),
            statusReason: 'Added by CMT department - Pending for approval',
            addedBy: {
                empId: inhouseUser.empId,
                employeeName: inhouseUser.employeeName,
                department: inhouseUser.department
            },
            agentIds: [inhouseUser.empId], // Add the CMT employee as agent
            compName,
            mc_dot_no,
            carrierType,
            fleetsize: fleetsize ? parseInt(fleetsize) : undefined,
            compAdd,
            country,
            state,
            city,
            zipcode,
            phoneNo,
            email: email.toLowerCase(),
            password: hashedPassword,
            docUpload: docUploadPath,
            documents: documents // Add the new documents object
        });

        await newTrucker.save();

        // ✅ 10. Send registration confirmation email (pending status)
        try {
            const emailSubject = `📋 Account Created - ${compName}`;
            const emailMessage = generateStatusUpdateEmail(
                compName, 
                'trucker', 
                'pending', 
                email, 
                'Account created by CMT department - ' + inhouseUser.employeeName + ' (Pending for approval)'
            );

            await sendEmail({
                to: email,
                subject: emailSubject,
                html: emailMessage,
            });

            console.log('📧 Registration confirmation email sent to:', email);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
            // Don't fail the operation if email fails
        }

        // ✅ 11. Success response
        res.status(201).json({
            success: true,
            message: 'Trucker added successfully by CMT employee - Status: Pending for approval',
            trucker: {
                userId: newTrucker.userId,
                compName: newTrucker.compName,
                mc_dot_no: newTrucker.mc_dot_no,
                email: newTrucker.email,
                phoneNo: newTrucker.phoneNo,
                status: newTrucker.status,
                statusReason: newTrucker.statusReason,
                addedBy: newTrucker.addedBy
            },
            documents: {
                uploaded: Object.keys(documents),
                totalUploaded: Object.keys(documents).length,
                documentTypes: documents
            },
            nextSteps: {
                message: 'Trucker account is pending for approval',
                actionRequired: 'Admin/Superadmin needs to review and approve the account',
                estimatedTime: 'Usually processed within 24-48 hours'
            }
        });

    } catch (err) {
        console.error('❌ Error adding trucker by CMT employee:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Get Trucker details by CMT Employee's empId
const getTruckersByCMTEmployee = async (req, res) => {
    try {
        // ✅ 1. Check if user is authenticated and is an inhouse employee
        const inhouseUser = req.user;
        if (!inhouseUser || !inhouseUser.empId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // ✅ 2. Check if user belongs to CMT department
        if (inhouseUser.department !== 'CMT') {
            return res.status(403).json({
                success: false,
                message: 'Only CMT department employees can access this data'
            });
        }

        // ✅ 3. Get empId from params or use current user's empId
        const { empId } = req.params;
        const targetEmpId = empId || inhouseUser.empId;

        // ✅ 4. Check if user is trying to access other employee's data
        if (empId && empId !== inhouseUser.empId) {
            // Only allow if user is admin or superadmin
            if (inhouseUser.role !== 'admin' && inhouseUser.role !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'You can only view truckers added by yourself'
                });
            }
        }

        // ✅ 5. Find all truckers added by this employee
        const truckers = await ShipperDriver.find({
            'addedBy.empId': targetEmpId,
            userType: 'trucker'
        }).select('-password').sort({ createdAt: -1 });

        // ✅ 6. Get employee details
        const employeeDetails = {
            empId: targetEmpId,
            employeeName: truckers.length > 0 ? truckers[0].addedBy.employeeName : inhouseUser.employeeName,
            department: truckers.length > 0 ? truckers[0].addedBy.department : inhouseUser.department
        };

        // ✅ 7. Calculate statistics
        const totalTruckers = truckers.length;
        const approvedTruckers = truckers.filter(t => t.status === 'approved').length;
        const pendingTruckers = truckers.filter(t => t.status === 'pending').length;
        const rejectedTruckers = truckers.filter(t => t.status === 'rejected').length;

        // ✅ 8. Calculate document statistics
        const truckersWithDocuments = truckers.filter(t => t.documents && Object.keys(t.documents).some(key => t.documents[key]));
        const totalDocuments = truckers.reduce((total, t) => {
            if (t.documents) {
                return total + Object.keys(t.documents).filter(key => t.documents[key]).length;
            }
            return total;
        }, 0);

        // ✅ 9. Success response
        res.status(200).json({
            success: true,
            message: `Trucker details retrieved for CMT employee: ${employeeDetails.employeeName}`,
            employee: employeeDetails,
            statistics: {
                totalTruckers,
                approvedTruckers,
                pendingTruckers,
                rejectedTruckers,
                truckersWithDocuments: truckersWithDocuments.length,
                totalDocuments
            },
            truckers: truckers.map(trucker => ({
                userId: trucker.userId,
                compName: trucker.compName,
                mc_dot_no: trucker.mc_dot_no,
                email: trucker.email,
                phoneNo: trucker.phoneNo,
                status: trucker.status,
                carrierType: trucker.carrierType,
                fleetsize: trucker.fleetsize,
                country: trucker.country,
                state: trucker.state,
                city: trucker.city,
                addedAt: trucker.createdAt,
                statusUpdatedAt: trucker.statusUpdatedAt,
                statusReason: trucker.statusReason,
                // 🔥 NEW: Add documents information
                documents: trucker.documents || {},
                docUpload: trucker.docUpload || '',
                documentCount: trucker.documents ? Object.keys(trucker.documents).filter(key => trucker.documents[key]).length : 0,
                uploadedDocuments: trucker.documents ? Object.keys(trucker.documents).filter(key => trucker.documents[key]) : [],
                // 🔥 NEW: Document preview information
                documentPreview: trucker.documents ? Object.keys(trucker.documents).reduce((acc, key) => {
                    if (trucker.documents[key]) {
                        acc[key] = {
                            url: trucker.documents[key],
                            fileName: trucker.documents[key].split('/').pop(),
                            fileType: trucker.documents[key].split('.').pop().toUpperCase()
                        };
                    }
                    return acc;
                }, {}) : {}
            }))
        });

    } catch (err) {
        console.error('❌ Error getting truckers by CMT employee:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Get Today's Trucker Count by CMT Employee
const getTodayTruckerCount = async (req, res) => {
    try {
        // ✅ 1. Check if user is authenticated and is an inhouse employee
        const inhouseUser = req.user;
        if (!inhouseUser || !inhouseUser.empId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // ✅ 2. Check if user belongs to CMT department
        if (inhouseUser.department !== 'CMT') {
            return res.status(403).json({
                success: false,
                message: 'Only CMT department employees can access this data'
            });
        }

        // ✅ 3. Get empId from params or use current user's empId
        const { empId } = req.params;
        const targetEmpId = empId || inhouseUser.empId;

        // ✅ 4. Check if user is trying to access other employee's data
        if (empId && empId !== inhouseUser.empId) {
            // Only allow if user is admin or superadmin
            if (inhouseUser.role !== 'admin' && inhouseUser.role !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'You can only view your own trucker count'
                });
            }
        }

        // ✅ 5. Get today's date range (start and end of day)
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        // ✅ 6. Find truckers added today by this employee
        const todayTruckers = await ShipperDriver.find({
            'addedBy.empId': targetEmpId,
            userType: 'trucker',
            createdAt: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        }).select('compName mc_dot_no email phoneNo status createdAt').sort({ createdAt: -1 });

        // ✅ 7. Get employee details
        const employeeDetails = {
            empId: targetEmpId,
            employeeName: inhouseUser.employeeName,
            department: inhouseUser.department
        };

        // ✅ 8. Calculate today's statistics
        const todayCount = todayTruckers.length;
        const todayApproved = todayTruckers.filter(t => t.status === 'approved').length;
        const todayPending = todayTruckers.filter(t => t.status === 'pending').length;
        const todayRejected = todayTruckers.filter(t => t.status === 'rejected').length;

        // ✅ 9. Get total truckers count (all time) for comparison
        const totalTruckers = await ShipperDriver.countDocuments({
            'addedBy.empId': targetEmpId,
            userType: 'trucker'
        });

        // ✅ 10. Get this week's count for trend analysis
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
        startOfWeek.setHours(0, 0, 0, 0);

        const weekTruckers = await ShipperDriver.countDocuments({
            'addedBy.empId': targetEmpId,
            userType: 'trucker',
            createdAt: {
                $gte: startOfWeek,
                $lt: endOfDay
            }
        });

        // ✅ 11. Success response
        res.status(200).json({
            success: true,
            message: `Today's trucker count for ${employeeDetails.employeeName}`,
            date: {
                today: today.toISOString().split('T')[0], // YYYY-MM-DD format
                startOfDay: startOfDay.toISOString(),
                endOfDay: endOfDay.toISOString()
            },
            employee: employeeDetails,
            todayStats: {
                totalAdded: todayCount,
                approved: todayApproved,
                pending: todayPending,
                rejected: todayRejected
            },
            comparison: {
                totalAllTime: totalTruckers,
                thisWeek: weekTruckers,
                todayVsWeek: todayCount,
                todayVsTotal: todayCount
            },
            todayTruckers: todayTruckers.map(trucker => ({
                compName: trucker.compName,
                mc_dot_no: trucker.mc_dot_no,
                email: trucker.email,
                phoneNo: trucker.phoneNo,
                status: trucker.status,
                addedAt: trucker.createdAt
            }))
        });

    } catch (err) {
        console.error('❌ Error getting today\'s trucker count:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Accountant Approval for CMT Truckers
const approveByAccountant = async (req, res) => {
    try {
        // ✅ 1. Get user information from request body or use default
        const { approvedBy, approvedByName, department } = req.body;
        const accountant = { 
            empId: approvedBy || 'anonymous', 
            employeeName: approvedByName || 'Anonymous User', 
            department: department || 'Unknown' 
        };

        // ✅ 3. Get trucker ID from request
        const { truckerId } = req.params;
        const { approvalReason } = req.body;

        if (!truckerId) {
            return res.status(400).json({
                success: false,
                message: 'Trucker ID is required'
            });
        }

        // ✅ 4. Find the trucker
        const trucker = await ShipperDriver.findOne({ 
            userId: truckerId,
            userType: 'trucker'
        });

        if (!trucker) {
            return res.status(404).json({
                success: false,
                message: 'Trucker not found'
            });
        }

        // ✅ 5. Check if trucker is in pending status
        if (trucker.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Trucker is already ${trucker.status}. Cannot approve.`
            });
        }

        // ✅ 6. Update trucker status to accountant_approved
        trucker.status = 'accountant_approved';
        trucker.statusUpdatedBy = accountant.empId;
        trucker.statusUpdatedAt = new Date();
        trucker.statusReason = `Approved by ${accountant.employeeName} (${accountant.department})${approvalReason ? `: ${approvalReason}` : ''}`;
        
        // Add approval history
        if (!trucker.approvalHistory) {
            trucker.approvalHistory = [];
        }
        trucker.approvalHistory.push({
            step: 'accountant_approval',
            status: 'approved',
            approvedBy: accountant.empId,
            approvedByName: accountant.employeeName,
            approvedAt: new Date(),
            reason: approvalReason || 'Accountant approval'
        });

        await trucker.save();

        // ✅ 7. Send notification email
        try {
            const emailSubject = `📋 Accountant Approval - ${trucker.compName}`;
            const emailMessage = generateStatusUpdateEmail(
                trucker.compName, 
                'trucker', 
                'accountant_approved', 
                trucker.email, 
                `Approved by ${accountant.employeeName} (${accountant.department})${approvalReason ? `: ${approvalReason}` : ''}`
            );

            await sendEmail({
                to: trucker.email,
                subject: emailSubject,
                html: emailMessage,
            });

            console.log('📧 Accountant approval email sent to:', trucker.email);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
        }

        // ✅ 8. Success response
        res.status(200).json({
            success: true,
            message: 'Trucker approved by Accountant successfully',
            trucker: {
                userId: trucker.userId,
                compName: trucker.compName,
                status: trucker.status,
                statusReason: trucker.statusReason,
                approvedBy: {
                    empId: accountant.empId,
                    employeeName: accountant.employeeName,
                    department: accountant.department
                }
            },
            nextStep: {
                message: 'Trucker approved by Accountant',
                actionRequired: 'Manager approval required',
                currentStep: 'accountant_approved',
                nextStep: 'manager_approval'
            }
        });

    } catch (err) {
        console.error('❌ Error approving trucker by Accountant:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Manager Approval for CMT Truckers
const approveByManager = async (req, res) => {
    try {
        // ✅ 1. Get user information from request body or use default
        const { approvedBy, approvedByName, department } = req.body;
        const manager = { 
            empId: approvedBy || 'anonymous', 
            employeeName: approvedByName || 'Anonymous User', 
            department: department || 'Unknown' 
        };

        // ✅ 3. Get trucker ID from request
        const { truckerId } = req.params;
        const { approvalReason } = req.body;

        if (!truckerId) {
            return res.status(400).json({
                success: false,
                message: 'Trucker ID is required'
            });
        }

        // ✅ 4. Find the trucker
        const trucker = await ShipperDriver.findOne({ 
            userId: truckerId,
            userType: 'trucker'
        });

        if (!trucker) {
            return res.status(404).json({
                success: false,
                message: 'Trucker not found'
            });
        }

        // ✅ 5. Check if trucker is in accountant_approved status
        if (trucker.status !== 'accountant_approved') {
            return res.status(400).json({
                success: false,
                message: `Trucker status is ${trucker.status}. Must be accountant_approved for manager approval.`
            });
        }

        // ✅ 6. Update trucker status to approved
        trucker.status = 'approved';
        trucker.statusUpdatedBy = manager.empId;
        trucker.statusUpdatedAt = new Date();
        trucker.statusReason = `Approved by ${manager.employeeName} (${manager.department})${approvalReason ? `: ${approvalReason}` : ''}`;
        
        // Add approval history
        if (!trucker.approvalHistory) {
            trucker.approvalHistory = [];
        }
        trucker.approvalHistory.push({
            step: 'manager_approval',
            status: 'approved',
            approvedBy: manager.empId,
            approvedByName: manager.employeeName,
            approvedAt: new Date(),
            reason: approvalReason || 'Manager approval'
        });

        await trucker.save();

        // ✅ 7. Send approval email
        try {
            const emailSubject = `🎉 Account Approved - ${trucker.compName}`;
            const emailMessage = generateStatusUpdateEmail(
                trucker.compName, 
                'trucker', 
                'approved', 
                trucker.email, 
                `Approved by ${manager.employeeName} (${manager.department})${approvalReason ? `: ${approvalReason}` : ''}`
            );

            await sendEmail({
                to: trucker.email,
                subject: emailSubject,
                html: emailMessage,
            });

            console.log('📧 Final approval email sent to:', trucker.email);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
        }

        // ✅ 8. Success response
        res.status(200).json({
            success: true,
            message: 'Trucker approved by Manager successfully',
            trucker: {
                userId: trucker.userId,
                compName: trucker.compName,
                status: trucker.status,
                statusReason: trucker.statusReason,
                approvedBy: {
                    empId: manager.empId,
                    employeeName: manager.employeeName,
                    department: manager.department
                }
            },
            finalStatus: {
                message: 'Trucker account is fully approved',
                status: 'approved',
                canLogin: true
            }
        });

    } catch (err) {
        console.error('❌ Error approving trucker by Manager:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Reject Trucker (by Accountant or Manager)
const rejectTrucker = async (req, res) => {
    try {
        // ✅ 1. Get user information from request body or use default
        const { rejectedBy, rejectedByName, department } = req.body;
        const user = { 
            empId: rejectedBy || 'anonymous', 
            employeeName: rejectedByName || 'Anonymous User', 
            department: department || 'Unknown' 
        };

        // ✅ 3. Get trucker ID and rejection reason from request
        const { truckerId } = req.params;
        const { rejectionReason } = req.body;

        if (!truckerId) {
            return res.status(400).json({
                success: false,
                message: 'Trucker ID is required'
            });
        }

        if (!rejectionReason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        // ✅ 4. Find the trucker
        const trucker = await ShipperDriver.findOne({ 
            userId: truckerId,
            userType: 'trucker'
        });

        if (!trucker) {
            return res.status(404).json({
                success: false,
                message: 'Trucker not found'
            });
        }

        // ✅ 5. Check if trucker can be rejected
        if (trucker.status === 'approved' || trucker.status === 'rejected') {
            return res.status(400).json({
                success: false,
                message: `Trucker is already ${trucker.status}. Cannot reject.`
            });
        }

        // ✅ 6. Update trucker status to rejected
        trucker.status = 'rejected';
        trucker.statusUpdatedBy = user.empId;
        trucker.statusUpdatedAt = new Date();
        trucker.statusReason = `Rejected by ${user.employeeName} (${user.department}): ${rejectionReason}`;
        
        // Add rejection history
        if (!trucker.approvalHistory) {
            trucker.approvalHistory = [];
        }
        trucker.approvalHistory.push({
            step: `${user.department.toLowerCase()}_rejection`,
            status: 'rejected',
            rejectedBy: user.empId,
            rejectedByName: user.employeeName,
            rejectedAt: new Date(),
            reason: rejectionReason
        });

        await trucker.save();

        // ✅ 7. Send rejection email
        try {
            const emailSubject = `❌ Account Rejected - ${trucker.compName}`;
            const emailMessage = generateStatusUpdateEmail(
                trucker.compName, 
                'trucker', 
                'rejected', 
                trucker.email, 
                `Rejected by ${user.employeeName} (${user.department}): ${rejectionReason}`
            );

            await sendEmail({
                to: trucker.email,
                subject: emailSubject,
                html: emailMessage,
            });

            console.log('📧 Rejection email sent to:', trucker.email);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
        }

        // ✅ 8. Success response
        res.status(200).json({
            success: true,
            message: 'Trucker rejected successfully',
            trucker: {
                userId: trucker.userId,
                compName: trucker.compName,
                status: trucker.status,
                statusReason: trucker.statusReason,
                rejectedBy: {
                    empId: user.empId,
                    employeeName: user.employeeName,
                    department: user.department
                }
            },
            rejection: {
                reason: rejectionReason,
                rejectedBy: user.employeeName,
                department: user.department,
                rejectedAt: new Date()
            }
        });

    } catch (err) {
        console.error('❌ Error rejecting trucker:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Department-based customer addition (CMT=Trucker, Sales=Shipper)
const addCustomerByDepartmentEmployee = async (req, res) => {
    try {
        // ✅ 1. Check if user is authenticated and is an inhouse employee
        const inhouseUser = req.user;
        if (!inhouseUser || !inhouseUser.empId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // ✅ 2. Check if user belongs to CMT or Sales department
        if (inhouseUser.department !== 'CMT' && inhouseUser.department !== 'Sales') {
            return res.status(403).json({
                success: false,
                message: 'Only CMT and Sales department employees can add customers'
            });
        }

        // ✅ 3. Set userType based on department
        const userType = inhouseUser.department === 'CMT' ? 'trucker' : 'shipper';
        const departmentText = inhouseUser.department === 'CMT' ? 'Trucker' : 'Shipper';

        // ✅ 4. Extract customer data from request body with proper error handling
        console.log('🔍 Request body:', req.body);
        console.log('🔍 Request files:', req.files);
        console.log('🔍 Request file:', req.file);
        
        // Handle both form data and JSON
        let customerData = {};
        
        // Try to get data from different sources
        if (req.body && Object.keys(req.body).length > 0) {
            customerData = req.body;
        } else if (req.body) {
            customerData = req.body;
        } else {
            console.log('⚠️ req.body is empty or undefined');
        }
        
        console.log('🔍 Final customer data:', customerData);

        const {
            compName,
            mc_dot_no,
            carrierType,
            fleetsize,
            compAdd,
            country,
            state,
            city,
            zipcode,
            phoneNo,
            email,
            password
        } = customerData;

        // ✅ 5. Validate required fields
        if (!compName || !phoneNo || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Company name, phone number, email, and password are required',
                errors: {
                    compName: !compName ? 'Company name is required' : null,
                    phoneNo: !phoneNo ? 'Phone number is required' : null,
                    email: !email ? 'Email is required' : null,
                    password: !password ? 'Password is required' : null
                }
            });
        }

        // ✅ 6. Check if email already exists
        const existingEmail = await ShipperDriver.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered',
                errors: {
                    email: 'This email is already in use'
                }
            });
        }

        // ✅ 7. Check if phone already exists
        const existingPhone = await ShipperDriver.findOne({ phoneNo });
        if (existingPhone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already registered',
                errors: {
                    phoneNo: 'This phone number is already in use'
                }
            });
        }

        // ✅ 8. Hash password
        const hashedPassword = await hashPassword(password);

        // ✅ 9. Handle file uploads for documents
        let docUploadPath = '';
        let documents = {};
        
        // Handle single document upload (backward compatibility)
        if (req.file) {
            docUploadPath = normalizeShipperTruckerPath(req.file.path);
        }
        
        // Handle multiple document uploads (new functionality)
        if (req.files) {
            console.log('📁 Multiple files uploaded:', Object.keys(req.files));
            
            // Process each document type
            const documentTypes = [
                'brokeragePacket',
                'carrierPartnerAgreement', 
                'w9Form',
                'mcAuthority',
                'safetyLetter',
                'bankingInfo',
                'inspectionLetter',
                'insurance'
            ];
            
            documentTypes.forEach(docType => {
                if (req.files[docType] && req.files[docType][0]) {
                    const filePath = normalizeCMTDocumentPath(req.files[docType][0].path);
                    documents[docType] = filePath;
                    console.log(`📄 ${docType} uploaded:`, filePath);
                }
            });
        }

        // ✅ 10. Create new customer record with department-based userType
        const newCustomer = new ShipperDriver({
            userType: userType, // Auto-set based on department
            status: inhouseUser.department === 'CMT' ? 'pending' : 'approved', // CMT = pending, Sales = approved
            statusUpdatedBy: inhouseUser.empId,
            statusUpdatedAt: new Date(),
            statusReason: inhouseUser.department === 'CMT' 
                ? `Added by ${inhouseUser.department} department - Pending for approval`
                : `Approved by ${inhouseUser.department} department`,
            addedBy: {
                empId: inhouseUser.empId,
                employeeName: inhouseUser.employeeName,
                department: inhouseUser.department
            },
            agentIds: [inhouseUser.empId], // Add the department employee as agent
            compName,
            mc_dot_no,
            carrierType,
            fleetsize: fleetsize ? parseInt(fleetsize) : undefined,
            compAdd,
            country,
            state,
            city,
            zipcode,
            phoneNo,
            email: email.toLowerCase(),
            password: hashedPassword,
            docUpload: docUploadPath,
            documents: documents // Add the new documents object
        });

        await newCustomer.save();

        // ✅ 11. Send email notification based on department
        try {
            const isPending = inhouseUser.department === 'CMT';
            const emailSubject = isPending 
                ? `📋 Account Created - ${compName}` 
                : `🎉 Account Approved - ${compName}`;
            
            const emailMessage = generateStatusUpdateEmail(
                compName, 
                userType, 
                isPending ? 'pending' : 'approved', 
                email, 
                isPending 
                    ? `Account created by ${inhouseUser.department} department - ${inhouseUser.employeeName} (Pending for approval)`
                    : `Account approved by ${inhouseUser.department} department - ${inhouseUser.employeeName}`
            );

            await sendEmail({
                to: email,
                subject: emailSubject,
                html: emailMessage,
            });

            console.log(`📧 ${isPending ? 'Registration confirmation' : 'Approval'} email sent to:`, email);
        } catch (emailError) {
            console.error('❌ Email sending failed:', emailError);
            // Don't fail the operation if email fails
        }

        // ✅ 12. Success response
        const isPending = inhouseUser.department === 'CMT';
        res.status(201).json({
            success: true,
            message: `${departmentText} added successfully by ${inhouseUser.department} department employee${isPending ? ' - Status: Pending for approval' : ''}`,
            customer: {
                userId: newCustomer.userId,
                userType: newCustomer.userType,
                compName: newCustomer.compName,
                mc_dot_no: newCustomer.mc_dot_no,
                email: newCustomer.email,
                phoneNo: newCustomer.phoneNo,
                status: newCustomer.status,
                statusReason: newCustomer.statusReason,
                addedBy: newCustomer.addedBy
            },
            documents: {
                uploaded: Object.keys(documents),
                totalUploaded: Object.keys(documents).length,
                documentTypes: documents
            },
            department: {
                name: inhouseUser.department,
                employee: inhouseUser.employeeName,
                empId: inhouseUser.empId
            },
            nextSteps: isPending ? {
                message: `${departmentText} account is pending for approval`,
                actionRequired: 'Admin/Superadmin needs to review and approve the account',
                estimatedTime: 'Usually processed within 24-48 hours'
            } : null
        });

    } catch (err) {
        console.error('❌ Error adding customer by department employee:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Assign additional users to a customer
const assignUsersToCustomer = async (req, res) => {
    try {
        // ✅ 1. Check if user is authenticated and is an inhouse employee
        const inhouseUser = req.user;
        if (!inhouseUser || !inhouseUser.empId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // ✅ 2. Check if user has permission (admin, superadmin, or the one who added the customer)
        if (inhouseUser.role !== 'admin' && inhouseUser.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only admins and superadmins can assign users to customers'
            });
        }

        // ✅ 3. Get customer ID and user IDs from request
        const { customerId, userIds, action } = req.body;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: 'Customer ID is required'
            });
        }

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User IDs array is required and must not be empty'
            });
        }

        if (!action || !['add', 'remove'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Action must be either "add" or "remove"'
            });
        }

        // ✅ 4. Find the customer
        const customer = await ShipperDriver.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // ✅ 5. Verify that the users exist
        const { Employee } = await import('../models/inhouseUserModel.js');
        const users = await Employee.find({ empId: { $in: userIds } });
        
        if (users.length !== userIds.length) {
            const foundUserIds = users.map(u => u.empId);
            const missingUserIds = userIds.filter(id => !foundUserIds.includes(id));
            
            return res.status(400).json({
                success: false,
                message: 'Some users not found',
                missingUserIds
            });
        }

        // ✅ 6. Update customer's agentIds based on action
        let updatedAgentIds = [...(customer.agentIds || [])];
        
        if (action === 'add') {
            // Add new users (avoid duplicates)
            userIds.forEach(userId => {
                if (!updatedAgentIds.includes(userId)) {
                    updatedAgentIds.push(userId);
                }
            });
        } else if (action === 'remove') {
            // Remove specified users
            updatedAgentIds = updatedAgentIds.filter(id => !userIds.includes(id));
        }

        // ✅ 7. Update the customer
        customer.agentIds = updatedAgentIds;
        await customer.save();

        // ✅ 8. Get updated customer info
        const updatedCustomer = await ShipperDriver.findById(customerId)
            .select('-password');

        // ✅ 9. Success response
        res.status(200).json({
            success: true,
            message: `Users ${action === 'add' ? 'assigned to' : 'removed from'} customer successfully`,
            customer: {
                _id: updatedCustomer._id,
                userId: updatedCustomer.userId,
                compName: updatedCustomer.compName,
                userType: updatedCustomer.userType,
                status: updatedCustomer.status,
                agentIds: updatedCustomer.agentIds,
                addedBy: updatedCustomer.addedBy
            },
            action: {
                type: action,
                userIds: userIds,
                totalAssignedUsers: updatedAgentIds.length
            },
            assignedUsers: users.map(user => ({
                empId: user.empId,
                employeeName: user.employeeName,
                department: user.department,
                role: user.role
            }))
        });

    } catch (err) {
        console.error('❌ Error assigning users to customer:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Get assigned users for a customer
const getAssignedUsersForCustomer = async (req, res) => {
    try {
        // ✅ 1. Check if user is authenticated
        const inhouseUser = req.user;
        if (!inhouseUser || !inhouseUser.empId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // ✅ 2. Get customer ID from params
        const { customerId } = req.params;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: 'Customer ID is required'
            });
        }

        // ✅ 3. Find the customer
        const customer = await ShipperDriver.findById(customerId)
            .select('-password');
            
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // ✅ 4. Get assigned users details
        const { Employee } = await import('../models/inhouseUserModel.js');
        const assignedUsers = await Employee.find({ 
            empId: { $in: customer.agentIds || [] } 
        }).select('empId employeeName department role');

        // ✅ 5. Success response
        res.status(200).json({
            success: true,
            message: 'Assigned users retrieved successfully',
            customer: {
                _id: customer._id,
                userId: customer.userId,
                compName: customer.compName,
                userType: customer.userType,
                status: customer.status
            },
            assignedUsers: {
                count: assignedUsers.length,
                users: assignedUsers
            },
            agentIds: customer.agentIds || []
        });

    } catch (err) {
        console.error('❌ Error getting assigned users for customer:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Get customers by department employee
const getCustomersByDepartmentEmployee = async (req, res) => {
    try {
        // ✅ 1. Check if user is authenticated and is an inhouse employee
        const inhouseUser = req.user;
        if (!inhouseUser || !inhouseUser.empId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // ✅ 2. Check if user belongs to CMT or Sales department
        if (inhouseUser.department !== 'CMT' && inhouseUser.department !== 'Sales') {
            return res.status(403).json({
                success: false,
                message: 'Only CMT and Sales department employees can access this data'
            });
        }

        // ✅ 3. Get empId from params or use current user's empId
        const { empId } = req.params;
        const targetEmpId = empId || inhouseUser.empId;

        // ✅ 4. Check if user is trying to access other employee's data
        if (empId && empId !== inhouseUser.empId) {
            // Only allow if user is admin or superadmin
            if (inhouseUser.role !== 'admin' && inhouseUser.role !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'You can only view customers added by yourself'
                });
            }
        }

        // ✅ 5. Find all customers added by this employee
        const customers = await ShipperDriver.find({
            'addedBy.empId': targetEmpId
        }).select('-password').sort({ createdAt: -1 });

        // ✅ 6. Filter by userType based on department
        const expectedUserType = inhouseUser.department === 'CMT' ? 'trucker' : 'shipper';
        const departmentCustomers = customers.filter(customer => customer.userType === expectedUserType);

        // ✅ 7. Get employee details
        const employeeDetails = {
            empId: targetEmpId,
            employeeName: customers.length > 0 ? customers[0].addedBy.employeeName : inhouseUser.employeeName,
            department: customers.length > 0 ? customers[0].addedBy.department : inhouseUser.department
        };

        // ✅ 8. Calculate statistics
        const totalCustomers = departmentCustomers.length;
        const approvedCustomers = departmentCustomers.filter(c => c.status === 'approved').length;
        const pendingCustomers = departmentCustomers.filter(c => c.status === 'pending').length;
        const rejectedCustomers = departmentCustomers.filter(c => c.status === 'rejected').length;

        // ✅ 9. Success response
        res.status(200).json({
            success: true,
            message: `${expectedUserType.charAt(0).toUpperCase() + expectedUserType.slice(1)} details retrieved for ${employeeDetails.department} employee: ${employeeDetails.employeeName}`,
            employee: employeeDetails,
            department: inhouseUser.department,
            expectedUserType: expectedUserType,
            statistics: {
                totalCustomers,
                approvedCustomers,
                pendingCustomers,
                rejectedCustomers
            },
            customers: departmentCustomers.map(customer => ({
                _id: customer._id,
                userId: customer.userId,
                userType: customer.userType,
                compName: customer.compName,
                mc_dot_no: customer.mc_dot_no,
                email: customer.email,
                phoneNo: customer.phoneNo,
                status: customer.status,
                carrierType: customer.carrierType,
                fleetsize: customer.fleetsize,
                country: customer.country,
                state: customer.state,
                city: customer.city,
                addedAt: customer.createdAt,
                statusUpdatedAt: customer.statusUpdatedAt,
                statusReason: customer.statusReason
            }))
        });

    } catch (err) {
        console.error('❌ Error getting customers by department employee:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Get Today's Customer Count by Department Employee
const getTodayCustomerCount = async (req, res) => {
    try {
        // ✅ 1. Check if user is authenticated and is an inhouse employee
        const inhouseUser = req.user;
        if (!inhouseUser || !inhouseUser.empId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // ✅ 2. Check if user belongs to CMT or Sales department
        if (inhouseUser.department !== 'CMT' && inhouseUser.department !== 'Sales') {
            return res.status(403).json({
                success: false,
                message: 'Only CMT and Sales department employees can access this data'
            });
        }

        // ✅ 3. Get empId from params or use current user's empId
        const { empId } = req.params;
        const targetEmpId = empId || inhouseUser.empId;

        // ✅ 4. Check if user is trying to access other employee's data
        if (empId && empId !== inhouseUser.empId) {
            // Only allow if user is admin or superadmin
            if (inhouseUser.role !== 'admin' && inhouseUser.role !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'You can only view your own customer count'
                });
            }
        }

        // ✅ 5. Set expected userType based on department
        const expectedUserType = inhouseUser.department === 'CMT' ? 'trucker' : 'shipper';
        const departmentText = inhouseUser.department === 'CMT' ? 'Trucker' : 'Shipper';

        // ✅ 6. Get today's date range (start and end of day)
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

        // ✅ 7. Find customers added today by this employee
        const todayCustomers = await ShipperDriver.find({
            'addedBy.empId': targetEmpId,
            userType: expectedUserType,
            createdAt: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        }).select('compName mc_dot_no email phoneNo status createdAt userType').sort({ createdAt: -1 });

        // ✅ 8. Get employee details
        const employeeDetails = {
            empId: targetEmpId,
            employeeName: inhouseUser.employeeName,
            department: inhouseUser.department
        };

        // ✅ 9. Calculate today's statistics
        const todayCount = todayCustomers.length;
        const todayApproved = todayCustomers.filter(c => c.status === 'approved').length;
        const todayPending = todayCustomers.filter(c => c.status === 'pending').length;
        const todayRejected = todayCustomers.filter(c => c.status === 'rejected').length;

        // ✅ 10. Get total customers count (all time) for comparison
        const totalCustomers = await ShipperDriver.countDocuments({
            'addedBy.empId': targetEmpId,
            userType: expectedUserType
        });

        // ✅ 11. Get this week's count for trend analysis
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
        startOfWeek.setHours(0, 0, 0, 0);

        const weekCustomers = await ShipperDriver.countDocuments({
            'addedBy.empId': targetEmpId,
            userType: expectedUserType,
            createdAt: {
                $gte: startOfWeek,
                $lt: endOfDay
            }
        });

        // ✅ 12. Success response
        res.status(200).json({
            success: true,
            message: `Today's ${departmentText.toLowerCase()} count for ${employeeDetails.employeeName}`,
            date: {
                today: today.toISOString().split('T')[0], // YYYY-MM-DD format
                startOfDay: startOfDay.toISOString(),
                endOfDay: endOfDay.toISOString()
            },
            employee: employeeDetails,
            department: inhouseUser.department,
            expectedUserType: expectedUserType,
            todayStats: {
                totalAdded: todayCount,
                approved: todayApproved,
                pending: todayPending,
                rejected: todayRejected
            },
            comparison: {
                totalAllTime: totalCustomers,
                thisWeek: weekCustomers,
                todayVsWeek: todayCount,
                todayVsTotal: todayCount
            },
            todayCustomers: todayCustomers.map(customer => ({
                userType: customer.userType,
                compName: customer.compName,
                mc_dot_no: customer.mc_dot_no,
                email: customer.email,
                phoneNo: customer.phoneNo,
                status: customer.status,
                addedAt: customer.createdAt
            }))
        });

    } catch (err) {
        console.error('❌ Error getting today\'s customer count:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

// 🔥 NEW: Get all truckers (simple API)
const getAllTruckersSimple = async (req, res) => {
    try {
        // ✅ 1. Get all truckers
        const truckers = await ShipperDriver.find({ userType: 'trucker' })
            .select('-password')
            .sort({ createdAt: -1 });

        // ✅ 2. Calculate statistics
        const totalTruckers = truckers.length;
        const pendingTruckers = truckers.filter(t => t.status === 'pending').length;
        const approvedTruckers = truckers.filter(t => t.status === 'approved').length;
        const accountantApprovedTruckers = truckers.filter(t => t.status === 'accountant_approved').length;
        const rejectedTruckers = truckers.filter(t => t.status === 'rejected').length;

        // ✅ 3. Success response
        res.status(200).json({
            success: true,
            message: 'All truckers retrieved successfully',
            statistics: {
                totalTruckers,
                pendingTruckers,
                approvedTruckers,
                accountantApprovedTruckers,
                rejectedTruckers
            },
            truckers: truckers.map(trucker => ({
                _id: trucker._id,
                userId: trucker.userId,
                compName: trucker.compName,
                mc_dot_no: trucker.mc_dot_no,
                email: trucker.email,
                phoneNo: trucker.phoneNo,
                status: trucker.status,
                statusReason: trucker.statusReason,
                carrierType: trucker.carrierType,
                fleetsize: trucker.fleetsize,
                country: trucker.country,
                state: trucker.state,
                city: trucker.city,
                zipcode: trucker.zipcode,
                addedAt: trucker.createdAt,
                statusUpdatedAt: trucker.statusUpdatedAt,
                addedBy: trucker.addedBy,
                documents: trucker.documents || {},
                documentCount: trucker.documents ? Object.keys(trucker.documents).filter(key => trucker.documents[key]).length : 0,
                uploadedDocuments: trucker.documents ? Object.keys(trucker.documents).filter(key => trucker.documents[key]) : []
            }))
        });

    } catch (err) {
        console.error('❌ Error getting all truckers:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

export {
    registerUser,
    loginUser,
    getAllUsers,
    getAllShippers,
    getAllTruckers,
    updateUserStatus,
    simpleStatusUpdate,
    addShipperTruckerByEmployee,
    getShipperTruckersByEmployee,
    getAllUsersWithEmployeeInfo,
    addTruckerByCMTEmployee,
    getTruckersByCMTEmployee,
    getTodayTruckerCount,
    addCustomerByDepartmentEmployee,
    getCustomersByDepartmentEmployee,
    getTodayCustomerCount,
    approveByAccountant,
    approveByManager,
    rejectTrucker,
    getAllTruckersSimple,
    assignUsersToCustomer,
    getAssignedUsersForCustomer
};