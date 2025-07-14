import ShipperDriver from '../models/shipper_driverModel.js';
import hashPassword from '../utils/hashPassword.js';
import { normalizeShipperTruckerPath } from '../middlewares/upload.js';
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
            sameSite: 'None',
            secure: true,
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
                mc_dot_no: user.mc_dot_no
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
};