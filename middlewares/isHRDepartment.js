// export const isHRDepartment = (req, res, next) => {
//     if (req.user?.department !== 'HR') {
//       return res.status(403).json({
//         success: false,
//         message: 'Access denied. Only HR department can perform this action.'
//       });
//     }
//     next();
//   };

export const isHRDepartment = (req, res, next) => {
  // Allow superadmin to access everything
  if (req.user && req.user.role === 'superadmin') {
    return next();
  }
  
  // For others, check if they are in HR department
  if (!req.user || !req.user.department || req.user.department.toLowerCase() !== 'hr') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only HR department or superadmin can perform this action.'
    });
  }
  next();
};
  