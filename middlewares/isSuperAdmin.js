export const isSuperAdmin = (req, res, next) => {
    const user = req.user; // populated by isAuthenticatedEmployee middleware
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only superadmin can perform this action'
      });
    }
    next();
  };
  