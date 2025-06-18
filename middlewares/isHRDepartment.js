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
  if (!req.user || !req.user.department || req.user.department.toLowerCase() !== 'hr') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only HR department can perform this action.'
    });
  }
  next();
};
  